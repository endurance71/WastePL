import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { INGESTION_QUEUE, PIPELINE_STAGES } from '@wastepl/domain';

export interface IngestionJobData {
  sourceId: string;
}

export function createRedisConnection(
  redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379',
): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

export function createIngestionWorker(connection: IORedis): Worker<IngestionJobData> {
  return new Worker<IngestionJobData>(
    INGESTION_QUEUE,
    async (job: Job<IngestionJobData>) => {
      console.log('WastePL ingestion job received', {
        id: job.id,
        sourceId: job.data.sourceId,
        stages: PIPELINE_STAGES,
      });
    },
    { connection },
  );
}

export async function bootstrapWorker(): Promise<void> {
  const connection = createRedisConnection();
  const worker = createIngestionWorker(connection);

  worker.on('ready', () => console.log(`WastePL worker ready on queue ${INGESTION_QUEUE}`));
  worker.on('failed', (job, error) =>
    console.error('WastePL ingestion job failed', { id: job?.id, error }),
  );

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await connection.quit();
  };

  process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrapWorker().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
