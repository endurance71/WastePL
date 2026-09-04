import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import { INGESTION_QUEUE } from '@wastepl/domain';
import { PgkKoszalinCollectionArtifactHandler } from './collections/collection-artifact-handler.js';
import { MunicipalCollectionArtifactHandler } from './collections/municipal-collection-artifact-handler.js';
import { MunicipalPszokArtifactHandler } from './facilities/municipal-pszok-artifact-handler.js';
import { PgkKoszalinPszokBundleArtifactHandler } from './facilities/pgk-koszalin-pszok-bundle-artifact-handler.js';
import { createArtifactProcessingWorker } from './ingestion/artifact-processing.js';
import { MinioArtifactReader } from './ingestion/artifact-reader.js';
import { MinioArtifactStore } from './ingestion/artifact-store.js';
import { PgBundleAwareSourceRegistry } from './ingestion/bundle-aware-source-registry.js';
import {
  BullMqArtifactProcessingQueue,
  BullMqSourcePollQueue,
} from './ingestion/bullmq-queues.js';
import {
  DispatchingArtifactProcessor,
  type ArtifactHandler,
} from './ingestion/dispatching-artifact-processor.js';
import { HttpSourceFetcher } from './ingestion/http-source-fetcher.js';
import { PgArtifactProcessingLookup } from './ingestion/pg-artifact-processing-lookup.js';
import { SourceIngestionService } from './ingestion/source-ingestion-service.js';
import {
  ArtifactOutboxDispatcher,
  SourceScheduler,
} from './ingestion/source-scheduler.js';
import { PushNotificationService } from './notifications/push-notification-service.js';

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

export function createArtifactRuntimeProcessor(
  pool: InstanceType<typeof Pool>,
  handlers?: ArtifactHandler[],
): DispatchingArtifactProcessor {
  const reader = new MinioArtifactReader();
  const runtimeHandlers = handlers ?? [
    new PgkKoszalinCollectionArtifactHandler(pool),
    new MunicipalCollectionArtifactHandler(pool),
    new PgkKoszalinPszokBundleArtifactHandler(pool, reader),
    new MunicipalPszokArtifactHandler(pool),
  ];

  return new DispatchingArtifactProcessor(
    new PgArtifactProcessingLookup(pool),
    reader,
    runtimeHandlers,
  );
}

export function startMaintenanceLoop(
  sourceScheduler: SourceScheduler,
  artifactOutbox: ArtifactOutboxDispatcher,
  intervalMs = Number.parseInt(process.env.SCHEDULER_INTERVAL_MS ?? '30000', 10),
  pushService?: PushNotificationService,
): MaintenanceLoopHandle {
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
    throw new Error('SCHEDULER_INTERVAL_MS must be at least 1000');
  }

  let stopped = false;
  let inFlight: Promise<void> | null = null;
  let lastDispatchedHour = -1;

  const run = (): void => {
    if (stopped || inFlight) return;
    inFlight = (async () => {
      try {
        const sourceResult = await sourceScheduler.runOnce();
        const outboxResult = await artifactOutbox.runOnce();

        // Scheduled Web Push trigger
        let pushResult = null;
        if (pushService) {
          const now = new Date();
          const currentHour = now.getHours();
          const forceTick = process.env.PUSH_DISPATCH_ON_TICK === 'true';

          if (forceTick || currentHour !== lastDispatchedHour) {
            const todayStr = now.toISOString().slice(0, 10);
            const tomorrow = new Date(now.getTime() + 86_400_000);
            const tomorrowStr = tomorrow.toISOString().slice(0, 10);

            if (forceTick || currentHour === 18 || currentHour === 20) {
              pushResult = await pushService.dispatchForDate(tomorrowStr, 'EVENING_BEFORE');
              lastDispatchedHour = currentHour;
            } else if (currentHour === 6) {
              pushResult = await pushService.dispatchForDate(todayStr, 'MORNING_OF');
              lastDispatchedHour = currentHour;
            }
          }
        }

        console.log(
          JSON.stringify({
            level: 'info',
            event: 'scheduler.tick_completed',
            source: sourceResult,
            outbox: outboxResult,
            ...(pushResult ? { push: pushResult } : {}),
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
  const registry = new PgBundleAwareSourceRegistry(pool);
  const artifactStore = new MinioArtifactStore();
  const fetcher = new HttpSourceFetcher();
  const ingestionService = new SourceIngestionService(registry, artifactStore, fetcher);
  const ingestionWorker = createIngestionWorker(redisConnection, ingestionService);
  const sourceQueue = new BullMqSourcePollQueue(redisConnection);
  const artifactQueue = new BullMqArtifactProcessingQueue(redisConnection);
  const sourceScheduler = new SourceScheduler(registry, sourceQueue);
  const artifactOutbox = new ArtifactOutboxDispatcher(registry, artifactQueue);
  const pushService =
    process.env.PUSH_NOTIFICATIONS_ENABLED !== 'false'
      ? new PushNotificationService(pool)
      : undefined;
  const maintenanceLoop = startMaintenanceLoop(
    sourceScheduler,
    artifactOutbox,
    undefined,
    pushService,
  );

  // Collection publication (PGK + explicitly profiled municipal PDF sources), the
  // PGK Koszalin multi-artifact PSZOK coordinator and profiled municipal PSZOK
  // handlers are registered. Processing remains deployment opt-in.
  const artifactProcessingEnabled = process.env.ARTIFACT_PROCESSING_ENABLED === 'true';
  const artifactWorker = artifactProcessingEnabled
    ? createArtifactProcessingWorker(
        redisConnection,
        registry,
        createArtifactRuntimeProcessor(pool),
      )
    : null;

  ingestionWorker.on('ready', () =>
    console.log(JSON.stringify({ level: 'info', event: 'worker.ready', queue: INGESTION_QUEUE })),
  );
  ingestionWorker.on('failed', (job, error) =>
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
  artifactWorker?.on('ready', () =>
    console.log(JSON.stringify({ level: 'info', event: 'artifact.worker.ready' })),
  );
  artifactWorker?.on('failed', (job, error) =>
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'artifact.worker.job_failed',
        jobId: job?.id ?? null,
        sourceId: job?.data.sourceId ?? null,
        artifactId: job?.data.artifactId ?? null,
        parserKey: job?.data.parserKey ?? null,
        error: error.message,
      }),
    ),
  );

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await maintenanceLoop.stop();
    await ingestionWorker.close();
    if (artifactWorker) await artifactWorker.close();
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
