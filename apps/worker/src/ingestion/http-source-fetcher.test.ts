import { describe, expect, it } from 'vitest';
import { HttpSourceFetcher } from './http-source-fetcher.js';
import type { SourceRecord } from './types.js';

const source: SourceRecord = {
  id: '11111111-1111-1111-1111-111111111111',
  sourceUrl: 'https://example.test/schedule.pdf',
  sourceFormat: 'PDF_TEXT',
  parserKey: 'pdf-text-v1',
  etag: '"old"',
  lastModified: 'Wed, 26 Aug 2026 12:00:00 GMT',
  lastSha256: null,
  active: true,
  pollIntervalMinutes: 1440,
  nextCheckAt: null,
  healthStatus: 'UNKNOWN',
  consecutiveFailures: 0,
  pollClaimToken: null,
  pollClaimExpiresAt: null,
};

describe('HttpSourceFetcher', () => {
  it('retries retryable HTTP errors and preserves conditional headers', async () => {
    let calls = 0;
    const delays: number[] = [];
    const conditionalHeaders: Array<{ etag: string | null; lastModified: string | null }> = [];
    const fetchFn: typeof fetch = async (_input, init) => {
      calls += 1;
      const headers = new Headers(init?.headers);
      conditionalHeaders.push({
        etag: headers.get('if-none-match'),
        lastModified: headers.get('if-modified-since'),
      });
      if (calls <= 2) return new Response('temporary', { status: 503 });
      return new Response('payload', {
        status: 200,
        headers: {
          etag: '"new"',
          'last-modified': 'Thu, 27 Aug 2026 12:00:00 GMT',
          'content-type': 'application/pdf',
        },
      });
    };

    const fetcher = new HttpSourceFetcher({
      fetchFn,
      maxAttempts: 3,
      baseDelayMs: 100,
      timeoutMs: 1_000,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    const result = await fetcher.fetch(source);
    expect(result.attempts).toBe(3);
    expect(result.status).toBe(200);
    expect(result.body?.toString('utf8')).toBe('payload');
    expect(result.etag).toBe('"new"');
    expect(delays).toEqual([100, 200]);
    expect(conditionalHeaders).toEqual([
      { etag: '"old"', lastModified: 'Wed, 26 Aug 2026 12:00:00 GMT' },
      { etag: '"old"', lastModified: 'Wed, 26 Aug 2026 12:00:00 GMT' },
      { etag: '"old"', lastModified: 'Wed, 26 Aug 2026 12:00:00 GMT' },
    ]);
  });

  it('does not retry a permanent HTTP failure', async () => {
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls += 1;
      return new Response('gone', { status: 404 });
    };
    const fetcher = new HttpSourceFetcher({
      fetchFn,
      maxAttempts: 3,
      baseDelayMs: 1,
      timeoutMs: 1_000,
      sleep: async () => undefined,
    });

    await expect(fetcher.fetch(source)).rejects.toMatchObject({
      code: 'HTTP_404',
      retryable: false,
      attempts: 1,
    });
    expect(calls).toBe(1);
  });

  it('returns NOT_MODIFIED without downloading an artifact body', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(null, {
        status: 304,
        headers: { etag: '"same"' },
      });

    const fetcher = new HttpSourceFetcher({
      fetchFn,
      maxAttempts: 1,
      timeoutMs: 1_000,
      sleep: async () => undefined,
    });

    const result = await fetcher.fetch(source);
    expect(result.notModified).toBe(true);
    expect(result.body).toBeNull();
    expect(result.attempts).toBe(1);
  });
});
