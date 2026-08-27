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
  SourceArtifactRecord,
  SourceCheckUpdate,
  SourceFetchAttemptInput,
  SourceFetcher,
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
    active: true,
  };
  readonly artifacts = new Map<string, SourceArtifactRecord>();
  readonly checks: SourceCheckUpdate[] = [];
  readonly attempts: SourceFetchAttemptInput[] = [];
  readonly parseUpdates: ArtifactParseUpdate[] = [];

  async getSourceById(sourceId: string): Promise<SourceRecord | null> {
    return sourceId === this.source.id ? this.source : null;
  }

  async findArtifactByHash(_sourceId: string, sha256: string): Promise<SourceArtifactRecord | null> {
    return this.artifacts.get(sha256) ?? null;
  }

  async insertArtifact(input: InsertSourceArtifactInput): Promise<SourceArtifactRecord> {
    const existing = this.artifacts.get(input.sha256);
    if (existing) return existing;
    const artifact: SourceArtifactRecord = {
      id: `artifact-${this.artifacts.size + 1}`,
      sourceId: input.sourceId,
      sha256: input.sha256,
      storageUri: input.storageUri,
      retrievedAt: input.retrievedAt,
    };
    this.artifacts.set(input.sha256, artifact);
    return artifact;
  }

  async markArtifactParsed(update: ArtifactParseUpdate): Promise<void> {
    this.parseUpdates.push(update);
  }

  async markSourceChecked(_sourceId: string, update: SourceCheckUpdate): Promise<void> {
    this.checks.push(update);
  }

  async recordFetchAttempt(input: SourceFetchAttemptInput): Promise<void> {
    this.attempts.push(input);
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
    expect(registry.attempts[0]?.outcome).toBe('NOT_MODIFIED');
  });

  it('records retryable fetch failures for audit and rethrows them', async () => {
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
    expect(registry.attempts).toHaveLength(1);
    expect(registry.attempts[0]).toMatchObject({
      outcome: 'FAILED',
      attempts: 3,
      httpStatus: 503,
      errorCode: 'HTTP_503',
    });
  });
});
