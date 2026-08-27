import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import { INGESTION_QUEUE } from '@wastepl/domain';
import { MinioArtifactStore } from './ingestion/artifact-store.js';
import {
  BullMqArtifactProcessingQueue,
  BullMqSourcePollQueue,
} from './ingestion/bullmq-queues.js';
import { HttpSourceFetcher } from './ingestion/http-source-fetcher.js';
import { SourceIngestionService } from './ingestion/source-ingestion-service.js';
import { PgSourceRegistry } from './ingestion/source-registry.js';
import {
  ArtifactOutboxDispatcher,
  SourceScheduler,
} from './ingestion/source-scheduler.js';

const { Pool } = pg;

export interface IngestionJobData {
  sourceId: string;
  claimToken: string;
}

export interface MaintenanceLoopHandle {
  stop(): Promise<void>;
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
      const result = await ingestionService.ingest(job.data.sourceId, {
        claimToken: job.data.claimToken,
      });
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

export function startMaintenanceLoop(
  sourceScheduler: SourceScheduler,
  artifactOutbox: ArtifactOutboxDispatcher,
  intervalMs = Number.parseInt(process.env.SCHEDULER_INTERVAL_MS ?? '30000', 10),
): MaintenanceLoopHandle {
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
    throw new Error('SCHEDULER_INTERVAL_MS must be at least 1000');
  }

  let stopped = false;
  let inFlight: Promise<void> | null = null;

  const run = (): void => {
    if (stopped || inFlight) return;
    inFlight = (async () => {
      try {
        const sourceResult = await sourceScheduler.runOnce();
        const outboxResult = await artifactOutbox.runOnce();
        console.log(
          JSON.stringify({
            level: 'info',
            event: 'scheduler.tick_completed',
            source: sourceResult,
            outbox: outboxResult,
          }),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'scheduler.tick_failed',
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      } finally {
        inFlight = null;
      }
    })();
  };

  run();
  const timer = setInterval(run, intervalMs);

  return {
    async stop(): Promise<void> {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    },
  };
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
  const sourceQueue = new BullMqSourcePollQueue(redisConnection);
  const artifactQueue = new BullMqArtifactProcessingQueue(redisConnection);
  const sourceScheduler = new SourceScheduler(registry, sourceQueue);
  const artifactOutbox = new ArtifactOutboxDispatcher(registry, artifactQueue);
  const maintenanceLoop = startMaintenanceLoop(sourceScheduler, artifactOutbox);

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

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await maintenanceLoop.stop();
    await worker.close();
    await sourceQueue.close();
    await artifactQueue.close();
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
