import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { ARTIFACT_PROCESSING_QUEUE, INGESTION_QUEUE } from '@wastepl/domain';
import type {
  ArtifactProcessingJobInput,
  ArtifactProcessingQueue,
  SourcePollJobInput,
  SourcePollJobQueue,
} from './types.js';

export interface ClosableJobQueue {
  close(): Promise<void>;
}

export class BullMqSourcePollQueue implements SourcePollJobQueue, ClosableJobQueue {
  private readonly queue: Queue<SourcePollJobInput>;

  constructor(connection: Redis) {
    this.queue = new Queue<SourcePollJobInput>(INGESTION_QUEUE, { connection });
  }

  async enqueue(input: SourcePollJobInput): Promise<void> {
    await this.queue.add('poll-source', input, {
      jobId: `source-${input.sourceId}-${input.claimToken}`,
      attempts: 1,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export class BullMqArtifactProcessingQueue
  implements ArtifactProcessingQueue, ClosableJobQueue
{
  private readonly queue: Queue<ArtifactProcessingJobInput>;

  constructor(connection: Redis) {
    this.queue = new Queue<ArtifactProcessingJobInput>(ARTIFACT_PROCESSING_QUEUE, { connection });
  }

  async enqueue(input: ArtifactProcessingJobInput): Promise<void> {
    await this.queue.add('process-artifact', input, {
      jobId: `artifact-${input.artifactId}`,
      attempts: 1,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
