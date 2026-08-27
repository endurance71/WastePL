import { describe, expect, it } from 'vitest';
import { SourceFetchError } from './http-source-fetcher.js';
import { SourceIngestionService } from './source-ingestion-service.js';
import type {
  ArtifactParseUpdate,
  ArtifactPutInput,
  ArtifactPutResult,
  ArtifactStore,
  FetchedSource,
  InsertSourceArtifactInput,
  InsertSourceArtifactResult,
  SourceArtifactRecord,
  SourceCheckUpdate,
  SourceFailureUpdate,
  SourceFetchAttemptInput,
  SourceFetcher,
  SourceProcessingAttemptInput,
  SourceProcessingStateUpdate,
  SourceRecord,
  SourceRegistry,
  StructuredLogger,
} from './types.js';

class FakeRegistry implements SourceRegistry {
  readonly source: SourceRecord = {
    id: '11111111-1111-1111-1111-111111111111',
    sourceUrl: 'https://example.test/schedule.pdf',
    sourceFormat: 'PDF_TEXT',
    parserKey: 'pdf-text-v1',
    etag: null,
    lastModified: null,
    lastSha256: null,
    active: true,
    pollIntervalMinutes: 1440,
    nextCheckAt: null,
    healthStatus: 'UNKNOWN',
    consecutiveFailures: 0,
    pollClaimToken: null,
    pollClaimExpiresAt: null,
  };
  readonly artifacts = new Map<string, SourceArtifactRecord>();
  readonly checks: SourceCheckUpdate[] = [];
  readonly failures: SourceFailureUpdate[] = [];
  readonly attempts: SourceFetchAttemptInput[] = [];
  readonly parseUpdates: ArtifactParseUpdate[] = [];
  readonly processingStates: SourceProcessingStateUpdate[] = [];
  readonly processingAttempts: SourceProcessingAttemptInput[] = [];

  async getSourceById(sourceId: string): Promise<SourceRecord | null> {
    return sourceId === this.source.id ? this.source : null;
  }

  async findArtifactByHash(_sourceId: string, sha256: string): Promise<SourceArtifactRecord | null> {
    return this.artifacts.get(sha256) ?? null;
  }

  async insertArtifact(input: InsertSourceArtifactInput): Promise<InsertSourceArtifactResult> {
    const existing = this.artifacts.get(input.sha256);
    if (existing) return { artifact: existing, created: false };
    const artifact: SourceArtifactRecord = {
      id: `artifact-${this.artifacts.size + 1}`,
      sourceId: input.sourceId,
      sha256: input.sha256,
      storageUri: input.storageUri,
      retrievedAt: input.retrievedAt,
    };
    this.artifacts.set(input.sha256, artifact);
    return { artifact, created: true };
  }

  async markArtifactParsed(update: ArtifactParseUpdate): Promise<void> {
    this.parseUpdates.push(update);
  }

  async markSourceChecked(_sourceId: string, update: SourceCheckUpdate): Promise<void> {
    this.checks.push(update);
  }

  async markSourceFailed(_sourceId: string, update: SourceFailureUpdate): Promise<void> {
    this.failures.push(update);
  }

  async markSourceProcessingState(update: SourceProcessingStateUpdate): Promise<void> {
    this.processingStates.push(update);
  }

  async recordFetchAttempt(input: SourceFetchAttemptInput): Promise<void> {
    this.attempts.push(input);
  }

  async recordProcessingAttempt(input: SourceProcessingAttemptInput): Promise<void> {
    this.processingAttempts.push(input);
  }
}

class FakeArtifactStore implements ArtifactStore {
  puts = 0;

  async putIfAbsent(input: ArtifactPutInput): Promise<ArtifactPutResult> {
    this.puts += 1;
    return { uri: `s3://test/${input.sourceId}/${input.sha256}`, created: true };
  }
}

const logger: StructuredLogger = {
  info: () => undefined,
  error: () => undefined,
};

function successfulFetcher(body = Buffer.from('same-payload')): SourceFetcher {
  return {
    async fetch(): Promise<FetchedSource> {
      return {
        status: 200,
        notModified: false,
        body,
        etag: '"v1"',
        lastModified: 'Thu, 27 Aug 2026 12:00:00 GMT',
        contentType: 'application/pdf',
        finalUrl: 'https://example.test/schedule.pdf',
        attempts: 1,
        retrievedAt: new Date('2026-08-27T12:00:00Z'),
      };
    },
  };
}

describe('SourceIngestionService', () => {
  it('stores a content-addressed artifact once and deduplicates repeated content', async () => {
    const registry = new FakeRegistry();
    const store = new FakeArtifactStore();
    const service = new SourceIngestionService(registry, store, successfulFetcher(), logger);

    const first = await service.ingest(registry.source.id);
    const second = await service.ingest(registry.source.id);

    expect(first.outcome).toBe('FETCHED');
    expect(second.outcome).toBe('DEDUPLICATED');
    expect(first.artifactId).toBe(second.artifactId);
    expect(store.puts).toBe(1);
    expect(registry.artifacts.size).toBe(1);
    expect(registry.checks.map((check) => check.healthStatus)).toEqual(['FETCHED', 'UNCHANGED']);
    expect(registry.attempts.map((attempt) => attempt.outcome)).toEqual(['FETCHED', 'DEDUPLICATED']);
  });

  it('does not store a new artifact for HTTP 304', async () => {
    const registry = new FakeRegistry();
    const store = new FakeArtifactStore();
    const fetcher: SourceFetcher = {
      async fetch(): Promise<FetchedSource> {
        return {
          status: 304,
          notModified: true,
          body: null,
          etag: '"v1"',
          lastModified: null,
          contentType: null,
          finalUrl: registry.source.sourceUrl,
          attempts: 1,
          retrievedAt: new Date('2026-08-27T12:00:00Z'),
        };
      },
    };
    const service = new SourceIngestionService(registry, store, fetcher, logger);

    const result = await service.ingest(registry.source.id);
    expect(result.outcome).toBe('NOT_MODIFIED');
    expect(store.puts).toBe(0);
    expect(registry.checks[0]?.healthStatus).toBe('UNCHANGED');
    expect(registry.attempts[0]?.outcome).toBe('NOT_MODIFIED');
  });

  it('records retryable fetch failures, schedules health backoff and rethrows', async () => {
    const registry = new FakeRegistry();
    const store = new FakeArtifactStore();
    const fetcher: SourceFetcher = {
      async fetch(): Promise<FetchedSource> {
        throw new SourceFetchError({
          message: 'upstream unavailable',
          attempts: 3,
          status: 503,
          code: 'HTTP_503',
          retryable: true,
        });
      },
    };
    const service = new SourceIngestionService(registry, store, fetcher, logger);

    await expect(service.ingest(registry.source.id)).rejects.toThrow('upstream unavailable');
    expect(registry.failures).toHaveLength(1);
    expect(registry.failures[0]).toMatchObject({
      errorCode: 'HTTP_503',
      retryable: true,
    });
    expect(registry.attempts).toHaveLength(1);
    expect(registry.attempts[0]).toMatchObject({
      outcome: 'FAILED',
      attempts: 3,
      httpStatus: 503,
      errorCode: 'HTTP_503',
    });
  });

  it('skips a delayed queue job whose scheduler claim is stale', async () => {
    const registry = new FakeRegistry();
    registry.source.pollClaimToken = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    registry.source.pollClaimExpiresAt = new Date(Date.now() + 60_000);
    const store = new FakeArtifactStore();
    let fetchCalls = 0;
    const fetcher: SourceFetcher = {
      async fetch(): Promise<FetchedSource> {
        fetchCalls += 1;
        return successfulFetcher().fetch(registry.source);
      },
    };
    const service = new SourceIngestionService(registry, store, fetcher, logger);

    const result = await service.ingest(registry.source.id, {
      claimToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(result.outcome).toBe('SKIPPED_STALE_CLAIM');
    expect(fetchCalls).toBe(0);
    expect(registry.attempts).toEqual([]);
  });
});
