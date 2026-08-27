import type {
  ArtifactOutboxRegistry,
  ArtifactProcessingQueue,
  SourcePollJobQueue,
  SourceSchedulerRegistry,
  StructuredLogger,
} from './types.js';

const consoleLogger: StructuredLogger = {
  info(event, metadata) {
    console.log(JSON.stringify({ level: 'info', event, ...metadata }));
  },
  error(event, metadata) {
    console.error(JSON.stringify({ level: 'error', event, ...metadata }));
  },
};

export interface SourceSchedulerOptions {
  batchSize: number;
  leaseMs: number;
  enqueueFailureDelayMs: number;
}

export interface SourceSchedulerRunResult {
  claimed: number;
  enqueued: number;
  enqueueFailed: number;
}

export class SourceScheduler {
  private readonly options: SourceSchedulerOptions;

  constructor(
    private readonly registry: SourceSchedulerRegistry,
    private readonly queue: SourcePollJobQueue,
    options: Partial<SourceSchedulerOptions> = {},
    private readonly logger: StructuredLogger = consoleLogger,
  ) {
    this.options = {
      batchSize: options.batchSize ?? 100,
      leaseMs: options.leaseMs ?? 120_000,
      enqueueFailureDelayMs: options.enqueueFailureDelayMs ?? 30_000,
    };
  }

  async runOnce(now = new Date()): Promise<SourceSchedulerRunResult> {
    const claims = await this.registry.claimDueSources({
      now,
      limit: this.options.batchSize,
      leaseMs: this.options.leaseMs,
    });

    let enqueued = 0;
    let enqueueFailed = 0;
    for (const claim of claims) {
      try {
        await this.queue.enqueue({ sourceId: claim.sourceId, claimToken: claim.claimToken });
        enqueued += 1;
        this.logger.info('source.scheduler.enqueued', {
          sourceId: claim.sourceId,
          claimToken: claim.claimToken,
          claimExpiresAt: claim.claimExpiresAt.toISOString(),
        });
      } catch (error) {
        enqueueFailed += 1;
        const retryAt = new Date(now.getTime() + this.options.enqueueFailureDelayMs);
        await this.registry.releasePollClaim(claim.sourceId, claim.claimToken, retryAt);
        this.logger.error('source.scheduler.enqueue_failed', {
          sourceId: claim.sourceId,
          retryAt: retryAt.toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { claimed: claims.length, enqueued, enqueueFailed };
  }
}

export interface ArtifactOutboxDispatcherOptions {
  batchSize: number;
  leaseMs: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
}

export interface ArtifactOutboxRunResult {
  claimed: number;
  enqueued: number;
  enqueueFailed: number;
}

export class ArtifactOutboxDispatcher {
  private readonly options: ArtifactOutboxDispatcherOptions;

  constructor(
    private readonly registry: ArtifactOutboxRegistry,
    private readonly queue: ArtifactProcessingQueue,
    options: Partial<ArtifactOutboxDispatcherOptions> = {},
    private readonly logger: StructuredLogger = consoleLogger,
  ) {
    this.options = {
      batchSize: options.batchSize ?? 100,
      leaseMs: options.leaseMs ?? 120_000,
      baseRetryDelayMs: options.baseRetryDelayMs ?? 5_000,
      maxRetryDelayMs: options.maxRetryDelayMs ?? 300_000,
    };
  }

  private retryDelay(enqueueAttempts: number): number {
    return Math.min(
      this.options.maxRetryDelayMs,
      this.options.baseRetryDelayMs * 2 ** Math.min(enqueueAttempts, 10),
    );
  }

  async runOnce(now = new Date()): Promise<ArtifactOutboxRunResult> {
    const claims = await this.registry.claimPendingArtifactWork({
      now,
      limit: this.options.batchSize,
      leaseMs: this.options.leaseMs,
    });

    let enqueued = 0;
    let enqueueFailed = 0;
    for (const claim of claims) {
      try {
        await this.queue.enqueue({
          sourceId: claim.sourceId,
          artifactId: claim.artifactId,
          parserKey: claim.parserKey,
        });
        await this.registry.markArtifactWorkEnqueued(claim.artifactId, claim.claimToken, now);
        enqueued += 1;
        this.logger.info('artifact.outbox.enqueued', {
          sourceId: claim.sourceId,
          artifactId: claim.artifactId,
          parserKey: claim.parserKey,
        });
      } catch (error) {
        enqueueFailed += 1;
        const retryAt = new Date(now.getTime() + this.retryDelay(claim.enqueueAttempts));
        const message = error instanceof Error ? error.message : String(error);
        await this.registry.releaseArtifactWorkClaim(
          claim.artifactId,
          claim.claimToken,
          retryAt,
          message,
        );
        this.logger.error('artifact.outbox.enqueue_failed', {
          sourceId: claim.sourceId,
          artifactId: claim.artifactId,
          retryAt: retryAt.toISOString(),
          error: message,
        });
      }
    }

    return { claimed: claims.length, enqueued, enqueueFailed };
  }
}
