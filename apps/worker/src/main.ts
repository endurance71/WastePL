import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import { INGESTION_QUEUE } from '@wastepl/domain';
import { MinioArtifactStore } from './ingestion/artifact-store.js';
import { HttpSourceFetcher } from './ingestion/http-source-fetcher.js';
import { SourceIngestionService } from './ingestion/source-ingestion-service.js';
import { PgSourceRegistry } from './ingestion/source-registry.js';

const { Pool } = pg;

export interface IngestionJobData {
  sourceId: string;
}

export function createRedisConnection(
  redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379',
): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export function createIngestionWorker(
  connection: Redis,
  ingestionService: SourceIngestionService,
): Worker<IngestionJobData> {
  return new Worker<IngestionJobData>(
    INGESTION_QUEUE,
    async (job: Job<IngestionJobData>) => {
      const result = await ingestionService.ingest(job.data.sourceId);
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'source.ingestion.job_completed',
          jobId: job.id ?? null,
          ...result,
        }),
      );
      return result;
    },
    { connection, concurrency: 4 },
  );
}

export async function bootstrapWorker(): Promise<void> {
  const redisConnection = createRedisConnection();
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  });
  const registry = new PgSourceRegistry(pool);
  const artifactStore = new MinioArtifactStore();
  const fetcher = new HttpSourceFetcher();
  const ingestionService = new SourceIngestionService(registry, artifactStore, fetcher);
  const worker = createIngestionWorker(redisConnection, ingestionService);

  worker.on('ready', () =>
    console.log(JSON.stringify({ level: 'info', event: 'worker.ready', queue: INGESTION_QUEUE })),
  );
  worker.on('failed', (job, error) =>
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'worker.job_failed',
        jobId: job?.id ?? null,
        sourceId: job?.data.sourceId ?? null,
        error: error.message,
      }),
    ),
  );

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await pool.end();
    await redisConnection.quit();
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
