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

export class HttpSourceFetcher implements SourceFetcher {
  private readonly options: HttpSourceFetcherOptions;

  constructor(options: Partial<HttpSourceFetcherOptions> = {}) {
    this.options = {
      timeoutMs: options.timeoutMs ?? 15_000,
      maxAttempts: options.maxAttempts ?? 3,
      baseDelayMs: options.baseDelayMs ?? 250,
      fetchFn: options.fetchFn ?? globalThis.fetch.bind(globalThis),
      sleep: options.sleep ?? defaultSleep,
    };
  }

  async fetch(source: SourceRecord): Promise<FetchedSource> {
    const headers: Record<string, string> = {
      'user-agent': 'WastePL/0.1 (+https://wastepl.pl)',
      accept: '*/*',
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
