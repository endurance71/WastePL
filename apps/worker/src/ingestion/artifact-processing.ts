import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { ARTIFACT_PROCESSING_QUEUE } from '@wastepl/domain';
import type {
  ArtifactProcessingJobInput,
  SourceProcessingStateUpdate,
  SourceRegistry,
  StructuredLogger,
} from './types.js';

export type ArtifactProcessingOutcome =
  | 'PUBLISHED'
  | 'REVIEW_REQUIRED'
  | 'WAITING_FOR_COMPANION'
  | 'PARSE_FAILED';

export interface ArtifactProcessorResult {
  outcome: Exclude<ArtifactProcessingOutcome, 'PARSE_FAILED'>;
  metadata?: Record<string, unknown>;
}

export interface ArtifactProcessor {
  process(input: ArtifactProcessingJobInput): Promise<ArtifactProcessorResult>;
}

export class PermanentArtifactParseError extends Error {
  readonly code: string;
  readonly metadata: Record<string, unknown>;

  constructor(
    message: string,
    options: { code?: string; metadata?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'PermanentArtifactParseError';
    this.code = options.code ?? 'PARSE_FAILED';
    this.metadata = options.metadata ?? {};
  }
}

const consoleLogger: StructuredLogger = {
  info(event, metadata) {
    console.log(JSON.stringify({ level: 'info', event, ...metadata }));
  },
  error(event, metadata) {
    console.error(JSON.stringify({ level: 'error', event, ...metadata }));
  },
};

export async function processArtifactJob(
  registry: SourceRegistry,
  processor: ArtifactProcessor,
  input: ArtifactProcessingJobInput,
  logger: StructuredLogger = consoleLogger,
): Promise<ArtifactProcessingOutcome> {
  const startedAt = new Date();
  try {
    const result = await processor.process(input);
    const completedAt = new Date();
    const update: SourceProcessingStateUpdate = {
      sourceId: input.sourceId,
      artifactId: input.artifactId,
      startedAt,
      completedAt,
      outcome: result.outcome,
      parserKey: input.parserKey,
      errorCode: null,
      errorMessage: null,
      metadata: result.metadata ?? {},
    };
    await registry.markSourceProcessingState(update);
    logger.info('artifact.processing.completed', {
      sourceId: input.sourceId,
      artifactId: input.artifactId,
      parserKey: input.parserKey,
      outcome: result.outcome,
    });
    return result.outcome;
  } catch (error) {
    if (!(error instanceof PermanentArtifactParseError)) throw error;

    const completedAt = new Date();
    await registry.markSourceProcessingState({
      sourceId: input.sourceId,
      artifactId: input.artifactId,
      startedAt,
      completedAt,
      outcome: 'PARSE_FAILED',
      parserKey: input.parserKey,
      errorCode: error.code,
      errorMessage: error.message,
      metadata: error.metadata,
    });
    logger.error('artifact.processing.parse_failed', {
      sourceId: input.sourceId,
      artifactId: input.artifactId,
      parserKey: input.parserKey,
      errorCode: error.code,
      error: error.message,
    });

    // Deliberately resolve the queue job. A deterministic data/parser failure must
    // not consume BullMQ retry attempts forever. A future source SHA creates a new
    // immutable artifact and therefore a new processing job.
    return 'PARSE_FAILED';
  }
}

export function createArtifactProcessingWorker(
  connection: Redis,
  registry: SourceRegistry,
  processor: ArtifactProcessor,
  logger: StructuredLogger = consoleLogger,
): Worker<ArtifactProcessingJobInput> {
  return new Worker<ArtifactProcessingJobInput>(
    ARTIFACT_PROCESSING_QUEUE,
    async (job: Job<ArtifactProcessingJobInput>) =>
      processArtifactJob(registry, processor, job.data, logger),
    { connection, concurrency: 4 },
  );
}
