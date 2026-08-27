import { sha256Hex } from './hash.js';
import { SourceFetchError } from './http-source-fetcher.js';
import type {
  ArtifactStore,
  FetchedSource,
  SourceFetcher,
  SourceRegistry,
  StructuredLogger,
} from './types.js';

export type IngestionOutcome = 'FETCHED' | 'NOT_MODIFIED' | 'DEDUPLICATED';

export interface IngestionResult {
  sourceId: string;
  outcome: IngestionOutcome;
  artifactId: string | null;
  sha256: string | null;
  storageUri: string | null;
  attempts: number;
}

const consoleLogger: StructuredLogger = {
  info(event, metadata) {
    console.log(JSON.stringify({ level: 'info', event, ...metadata }));
  },
  error(event, metadata) {
    console.error(JSON.stringify({ level: 'error', event, ...metadata }));
  },
};

export class SourceIngestionService {
  constructor(
    private readonly registry: SourceRegistry,
    private readonly artifactStore: ArtifactStore,
    private readonly fetcher: SourceFetcher,
    private readonly logger: StructuredLogger = consoleLogger,
  ) {}

  async ingest(sourceId: string): Promise<IngestionResult> {
    const startedAt = new Date();
    const source = await this.registry.getSourceById(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);
    if (!source.active) throw new Error(`Source ${sourceId} is inactive`);

    let fetched: FetchedSource | null = null;
    let sha256: string | null = null;

    try {
      fetched = await this.fetcher.fetch(source);
      const etag = fetched.etag ?? source.etag;
      const lastModified = fetched.lastModified ?? source.lastModified;

      if (fetched.notModified) {
        await this.registry.markSourceChecked(source.id, {
          checkedAt: fetched.retrievedAt,
          etag,
          lastModified,
          sha256: null,
        });
        await this.registry.recordFetchAttempt({
          sourceId: source.id,
          startedAt,
          completedAt: fetched.retrievedAt,
          outcome: 'NOT_MODIFIED',
          attempts: fetched.attempts,
          httpStatus: fetched.status,
          etag,
          lastModified,
          sha256: null,
          bytesReceived: 0,
          contentType: fetched.contentType,
          errorCode: null,
          errorMessage: null,
          metadata: { finalUrl: fetched.finalUrl, sourceFormat: source.sourceFormat },
        });

        this.logger.info('source.ingestion.not_modified', {
          sourceId: source.id,
          attempts: fetched.attempts,
          httpStatus: fetched.status,
        });
        return {
          sourceId: source.id,
          outcome: 'NOT_MODIFIED',
          artifactId: null,
          sha256: null,
          storageUri: null,
          attempts: fetched.attempts,
        };
      }

      if (!fetched.body) throw new Error('Successful source fetch returned no body');
      sha256 = sha256Hex(fetched.body);

      const existing = await this.registry.findArtifactByHash(source.id, sha256);
      if (existing) {
        await this.registry.markSourceChecked(source.id, {
          checkedAt: fetched.retrievedAt,
          etag,
          lastModified,
          sha256,
        });
        await this.registry.recordFetchAttempt({
          sourceId: source.id,
          startedAt,
          completedAt: fetched.retrievedAt,
          outcome: 'DEDUPLICATED',
          attempts: fetched.attempts,
          httpStatus: fetched.status,
          etag,
          lastModified,
          sha256,
          bytesReceived: fetched.body.length,
          contentType: fetched.contentType,
          errorCode: null,
          errorMessage: null,
          metadata: {
            finalUrl: fetched.finalUrl,
            sourceFormat: source.sourceFormat,
            artifactId: existing.id,
          },
        });

        this.logger.info('source.ingestion.deduplicated', {
          sourceId: source.id,
          artifactId: existing.id,
          sha256,
          bytes: fetched.body.length,
        });
        return {
          sourceId: source.id,
          outcome: 'DEDUPLICATED',
          artifactId: existing.id,
          sha256,
          storageUri: existing.storageUri,
          attempts: fetched.attempts,
        };
      }

      const stored = await this.artifactStore.putIfAbsent({
        sourceId: source.id,
        sha256,
        body: fetched.body,
        contentType: fetched.contentType,
      });
      const artifact = await this.registry.insertArtifact({
        sourceId: source.id,
        retrievedAt: fetched.retrievedAt,
        sha256,
        storageUri: stored.uri,
        parserKey: source.parserKey,
      });

      await this.registry.markSourceChecked(source.id, {
        checkedAt: fetched.retrievedAt,
        etag,
        lastModified,
        sha256,
      });
      await this.registry.recordFetchAttempt({
        sourceId: source.id,
        startedAt,
        completedAt: fetched.retrievedAt,
        outcome: 'FETCHED',
        attempts: fetched.attempts,
        httpStatus: fetched.status,
        etag,
        lastModified,
        sha256,
        bytesReceived: fetched.body.length,
        contentType: fetched.contentType,
        errorCode: null,
        errorMessage: null,
        metadata: {
          finalUrl: fetched.finalUrl,
          sourceFormat: source.sourceFormat,
          parserKey: source.parserKey,
          objectCreated: stored.created,
          artifactId: artifact.id,
        },
      });

      this.logger.info('source.ingestion.fetched', {
        sourceId: source.id,
        artifactId: artifact.id,
        sha256,
        storageUri: artifact.storageUri,
        bytes: fetched.body.length,
        attempts: fetched.attempts,
      });
      return {
        sourceId: source.id,
        outcome: 'FETCHED',
        artifactId: artifact.id,
        sha256,
        storageUri: artifact.storageUri,
        attempts: fetched.attempts,
      };
    } catch (error) {
      const completedAt = new Date();
      const attempts =
        fetched?.attempts ?? (error instanceof SourceFetchError ? error.attempts : 1);
      const httpStatus =
        fetched?.status ?? (error instanceof SourceFetchError ? error.status : null);
      const errorCode = error instanceof SourceFetchError ? error.code : 'PIPELINE_ERROR';
      const errorMessage = error instanceof Error ? error.message : String(error);

      try {
        await this.registry.recordFetchAttempt({
          sourceId: source.id,
          startedAt,
          completedAt,
          outcome: 'FAILED',
          attempts,
          httpStatus,
          etag: fetched?.etag ?? source.etag,
          lastModified: fetched?.lastModified ?? source.lastModified,
          sha256,
          bytesReceived: fetched?.body?.length ?? null,
          contentType: fetched?.contentType ?? null,
          errorCode,
          errorMessage: errorMessage.slice(0, 4000),
          metadata: {
            sourceFormat: source.sourceFormat,
            retryable: error instanceof SourceFetchError ? error.retryable : true,
          },
        });
      } catch (auditError) {
        this.logger.error('source.ingestion.audit_failed', {
          sourceId: source.id,
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      this.logger.error('source.ingestion.failed', {
        sourceId: source.id,
        errorCode,
        error: errorMessage,
        attempts,
      });
      throw error;
    }
  }
}
