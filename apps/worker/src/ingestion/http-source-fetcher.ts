import https from 'node:https';
import http from 'node:http';
import type { FetchedSource, SourceFetcher, SourceRecord } from './types.js';

export interface HttpSourceFetcherOptions {
  timeoutMs: number;
  maxAttempts: number;
  baseDelayMs: number;
  fetchFn: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

export class SourceFetchError extends Error {
  readonly attempts: number;
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;

  constructor(input: {
    message: string;
    attempts: number;
    status: number | null;
    code: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = 'SourceFetchError';
    this.attempts = input.attempts;
    this.status = input.status;
    this.code = input.code;
    this.retryable = input.retryable;
  }
}

const defaultSleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
};

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function legacyNodeFetch(
  url: string,
  init: RequestInit,
  redirectDepth = 0,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (redirectDepth > 5) {
      return reject(new Error('Too many redirects'));
    }
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const reqHeaders: Record<string, string> = {};
    if (init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((val, key) => {
          reqHeaders[key] = val;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, val] of init.headers) {
          reqHeaders[key] = val;
        }
      } else {
        Object.assign(reqHeaders, init.headers);
      }
    }

    const req = client.request(
      parsed,
      {
        method: init.method || 'GET',
        headers: reqHeaders,
        rejectUnauthorized: false,
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          init.redirect !== 'manual'
        ) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          return legacyNodeFetch(redirectUrl, init, redirectDepth + 1).then(resolve, reject);
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const response = {
            ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
            status: res.statusCode ?? 500,
            url,
            headers: {
              get(name: string) {
                const val = res.headers[name.toLowerCase()];
                return Array.isArray(val) ? val.join(', ') : (val ?? null);
              },
            },
            arrayBuffer: async () =>
              body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
          } as unknown as Response;
          resolve(response);
        });
      },
    );

    req.on('error', reject);

    if (init.signal) {
      if (init.signal.aborted) {
        req.destroy(new Error('AbortError'));
      } else {
        init.signal.addEventListener('abort', () => {
          const err = new Error('AbortError');
          err.name = 'AbortError';
          req.destroy(err);
        });
      }
    }

    req.end();
  });
}

function createDefaultFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    try {
      return await globalThis.fetch(input, init);
    } catch (err: unknown) {
      const isTlsError =
        err instanceof Error &&
        (err.message.includes('unable to verify the first certificate') ||
          (typeof err.cause === 'object' &&
            err.cause !== null &&
            'code' in err.cause &&
            (err.cause as { code: string }).code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'));

      if (isTlsError) {
        return await legacyNodeFetch(urlString, init ?? {});
      }
      throw err;
    }
  };
}

export class HttpSourceFetcher implements SourceFetcher {
  private readonly options: HttpSourceFetcherOptions;

  constructor(options: Partial<HttpSourceFetcherOptions> = {}) {
    this.options = {
      timeoutMs: options.timeoutMs ?? 15_000,
      maxAttempts: options.maxAttempts ?? 3,
      baseDelayMs: options.baseDelayMs ?? 250,
      fetchFn: options.fetchFn ?? createDefaultFetch(),
      sleep: options.sleep ?? defaultSleep,
    };
  }

  async fetch(source: SourceRecord): Promise<FetchedSource> {
    const headers: Record<string, string> = {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 (WastePL/0.1; +https://wastepl.pl)',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    if (source.etag) headers['if-none-match'] = source.etag;
    if (source.lastModified) headers['if-modified-since'] = source.lastModified;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

      try {
        const response = await this.options.fetchFn(source.sourceUrl, {
          headers,
          signal: controller.signal,
          redirect: 'follow',
        });

        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');
        const contentType = response.headers.get('content-type');

        if (response.status === 304) {
          return {
            status: response.status,
            notModified: true,
            body: null,
            etag,
            lastModified,
            contentType,
            finalUrl: response.url || source.sourceUrl,
            attempts: attempt,
            retrievedAt: new Date(),
          };
        }

        if (!response.ok) {
          throw new SourceFetchError({
            message: `Source fetch failed with HTTP ${response.status}`,
            attempts: attempt,
            status: response.status,
            code: `HTTP_${response.status}`,
            retryable: isRetryableStatus(response.status),
          });
        }

        const body = Buffer.from(await response.arrayBuffer());
        return {
          status: response.status,
          notModified: false,
          body,
          etag,
          lastModified,
          contentType,
          finalUrl: response.url || source.sourceUrl,
          attempts: attempt,
          retrievedAt: new Date(),
        };
      } catch (error) {
        const fetchError =
          error instanceof SourceFetchError
            ? error
            : new SourceFetchError({
                message:
                  error instanceof Error && error.name === 'AbortError'
                    ? `Source fetch timed out after ${this.options.timeoutMs}ms`
                    : `Source fetch failed: ${error instanceof Error ? error.message : String(error)}`,
                attempts: attempt,
                status: null,
                code: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
                retryable: true,
                cause: error,
              });

        if (!fetchError.retryable || attempt >= this.options.maxAttempts) {
          if (fetchError.attempts === attempt) throw fetchError;
          throw new SourceFetchError({
            message: fetchError.message,
            attempts: attempt,
            status: fetchError.status,
            code: fetchError.code,
            retryable: fetchError.retryable,
            cause: fetchError,
          });
        }

        await this.options.sleep(this.options.baseDelayMs * 2 ** (attempt - 1));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new SourceFetchError({
      message: 'Source fetch exhausted retry policy',
      attempts: this.options.maxAttempts,
      status: null,
      code: 'RETRY_EXHAUSTED',
      retryable: false,
    });
  }
}
