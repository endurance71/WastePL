import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Redis } from 'ioredis';
import pg, { type QueryResultRow } from 'pg';
import { createArtifactProcessingWorker } from '../ingestion/artifact-processing.js';
import { MinioArtifactStore } from '../ingestion/artifact-store.js';
import { BullMqArtifactProcessingQueue } from '../ingestion/bullmq-queues.js';
import { PgBundleAwareSourceRegistry } from '../ingestion/bundle-aware-source-registry.js';
import { SourceFetchError } from '../ingestion/http-source-fetcher.js';
import { SourceIngestionService } from '../ingestion/source-ingestion-service.js';
import { ArtifactOutboxDispatcher } from '../ingestion/source-scheduler.js';
import type { FetchedSource, SourceFetcher, SourceRecord } from '../ingestion/types.js';
import { createArtifactRuntimeProcessor } from '../main.js';
import { PgSourceManifestSync } from '../manifests/source-manifest-sync.js';
import type { SourceManifest } from '../manifests/source-manifest.js';
import { PgOfficialReferenceImporter } from '../reference/pg-reference-importer.js';
import {
  PRODUCTION_GATE_REFERENCE_COUNTS,
  productionGatePrgRows,
  productionGateSimcRows,
  productionGateTercRows,
  productionGateUlicRows,
} from './production-gate-reference.js';

const { Client, Pool } = pg;
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const manifestPath = resolve(repoRoot, 'manifests/pilot-koszalin-region-2026.2.json');
const fixtureRoot = resolve(repoRoot, 'apps/worker/test/fixtures');
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const asOf = new Date('2026-08-28T12:00:00Z');

const EXPECTED_ACTIVE_KEYS = [
  'bobolice-pszok',
  'koszalin-collection-bio-2026',
  'koszalin-pszok-faq',
  'koszalin-pszok-main',
  'manowo-collection-2ab-2026',
  'swieszyno-pszok',
] as const;

type ActiveSourceKey = typeof EXPECTED_ACTIVE_KEYS[number];

const fixtureRelativePath: Record<ActiveSourceKey, string> = {
  'koszalin-collection-bio-2026': 'pdf-text/koszalin-bio-2026.txt',
  'manowo-collection-2ab-2026': 'pdf-text/manowo-2ab-2026.txt',
  'koszalin-pszok-main': 'pgk-koszalin-pszok-main.html',
  'koszalin-pszok-faq': 'pgk-koszalin-pszok-faq.html',
  'bobolice-pszok': 'bobolice-pszok.html',
  'swieszyno-pszok': 'swieszyno-pszok.html',
};

interface ActiveSourceRow extends QueryResultRow {
  id: string;
  source_key: string;
  source_url: string;
  source_format: string;
  health_status: string;
}

interface CountRow extends QueryResultRow { count: string }

function gateDatabaseUrl(): string {
  if (process.env.PRODUCTION_GATE_DATABASE_URL) return process.env.PRODUCTION_GATE_DATABASE_URL;
  const base = new URL(
    process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  );
  base.pathname = '/wastepl_production_gate';
  return base.toString();
}

function adminDatabaseUrl(gateUrl: string): string {
  const url = new URL(gateUrl);
  url.pathname = '/postgres';
  return url.toString();
}

async function resetGateDatabase(gateUrl: string): Promise<void> {
  const databaseName = new URL(gateUrl).pathname.replace(/^\//, '');
  if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) throw new Error(`Unsafe gate database name ${databaseName}`);
  const client = new Client({ connectionString: adminDatabaseUrl(gateUrl) });
  await client.connect();
  try {
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }

  await execFileAsync(process.execPath, ['scripts/migrate.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: gateUrl,
      WASTEPL_MIGRATION_PROFILE: 'structural',
    },
  });
}

class FixtureSourceFetcher implements SourceFetcher {
  private readonly fixtures = new Map<string, { body: Buffer; contentType: string }>();
  private readonly failures = new Set<string>();

  set(url: string, body: Buffer, contentType: string): void {
    this.fixtures.set(url, { body, contentType });
    this.failures.delete(url);
  }

  fail(url: string): void {
    this.failures.add(url);
  }

  async fetch(source: SourceRecord): Promise<FetchedSource> {
    if (this.failures.has(source.sourceUrl)) {
      throw new SourceFetchError({
        message: 'Deterministic production-gate upstream failure',
        attempts: 3,
        status: 503,
        code: 'HTTP_503',
        retryable: true,
      });
    }
    const fixture = this.fixtures.get(source.sourceUrl);
    if (!fixture) throw new Error(`No production-gate fixture registered for ${source.sourceUrl}`);
    return {
      status: 200,
      notModified: false,
      body: fixture.body,
      etag: `"gate-${fixture.body.length}"`,
      lastModified: 'Fri, 28 Aug 2026 12:00:00 GMT',
      contentType: fixture.contentType,
      finalUrl: source.sourceUrl,
      attempts: 1,
      retrievedAt: asOf,
    };
  }
}

async function count(pool: InstanceType<typeof Pool>, table: string, where = ''): Promise<number> {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`Unsafe table name ${table}`);
  const result = await pool.query<CountRow>(`SELECT count(*)::text AS count FROM ${table} ${where}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function waitForPublishedArtifacts(
  pool: InstanceType<typeof Pool>,
  artifactIds: string[],
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await pool.query<{ artifact_id: string; good: string; failed: string } & QueryResultRow>(
      `SELECT artifact_id,
              count(*) FILTER (WHERE outcome IN ('PUBLISHED','REVIEW_REQUIRED'))::text AS good,
              count(*) FILTER (WHERE outcome = 'PARSE_FAILED')::text AS failed
       FROM source_processing_attempts
       WHERE artifact_id = ANY($1::uuid[])
       GROUP BY artifact_id`,
      [artifactIds],
    );
    if (result.rows.some((row) => Number(row.failed) > 0)) {
      throw new Error(`Production artifact parse failure: ${JSON.stringify(result.rows)}`);
    }
    const goodIds = new Set(
      result.rows.filter((row) => Number(row.good) > 0).map((row) => row.artifact_id),
    );
    if (artifactIds.every((id) => goodIds.has(id))) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error('Timed out waiting for all ACTIVE source artifacts to publish/review');
}

async function dispatchPendingArtifacts(
  pool: InstanceType<typeof Pool>,
  redis: Redis,
  registry: PgBundleAwareSourceRegistry,
): Promise<void> {
  const queue = new BullMqArtifactProcessingQueue(redis);
  const worker = createArtifactProcessingWorker(redis, registry, createArtifactRuntimeProcessor(pool));
  const dispatcher = new ArtifactOutboxDispatcher(registry, queue, { batchSize: 100 });
  try {
    for (let pass = 0; pass < 5; pass += 1) {
      const result = await dispatcher.runOnce(new Date(Date.now() + 1_000));
      if (result.claimed === 0) break;
      if (result.enqueueFailed > 0) throw new Error(`Artifact outbox enqueue failures: ${result.enqueueFailed}`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  } finally {
    // Worker remains open only long enough to finish jobs already queued. Callers wait
    // for persisted processing outcomes before this function returns through a separate poll.
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    await worker.close();
    await queue.close();
  }
}

async function main(): Promise<void> {
  const gateUrl = gateDatabaseUrl();
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  await resetGateDatabase(gateUrl);

  const pool = new Pool({ connectionString: gateUrl });
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const report: Record<string, unknown> = {
    gate: 'fixture-independent-production-pilot',
    manifest: 'pilot-koszalin-region@2026.2',
    database: new URL(gateUrl).pathname.replace(/^\//, ''),
    fixturePolicy: {
      liveHttp: false,
      collectionRepresentation: 'PREEXTRACTED_TEXT_REGRESSION',
      rawPdfExtractionCoveredSeparately: true,
      canonicalSqlSeeds: false,
    },
    startedAt: new Date().toISOString(),
  };

  try {
    const canonicalBefore = {
      collectionEvents: await count(pool, 'collection_events'),
      collectionPublications: await count(pool, 'collection_publications'),
      facilities: await count(pool, 'facilities'),
      facilityAssertions: await count(pool, 'facility_source_assertions'),
    };
    if (Object.values(canonicalBefore).some((value) => value !== 0)) {
      throw new Error(`Clean database already contains canonical data: ${JSON.stringify(canonicalBefore)}`);
    }
    report.canonicalBeforeRuntime = canonicalBefore;

    const importer = new PgOfficialReferenceImporter(pool);
    const referenceRuns = {
      terc: await importer.importTerc(productionGateTercRows(), {
        dataset: 'TERYT_TERC', sourceVersion: 'production-gate-2026.2', metadata: { testOnly: true },
      }),
      simc: await importer.importSimc(productionGateSimcRows(), {
        dataset: 'TERYT_SIMC', sourceVersion: 'production-gate-2026.2', metadata: { testOnly: true },
      }),
      ulic: await importer.importUlic(productionGateUlicRows(), {
        dataset: 'TERYT_ULIC', sourceVersion: 'production-gate-2026.2', metadata: { testOnly: true },
      }),
      prg: await importer.importPrgAddresses(productionGatePrgRows(), {
        dataset: 'PRG_ADDRESS', sourceVersion: 'production-gate-2026.2', metadata: { testOnly: true },
      }),
    };
    if (Object.values(referenceRuns).some((run) => run.rejected !== 0)) {
      throw new Error(`Reference import rejected rows: ${JSON.stringify(referenceRuns)}`);
    }
    report.reference = { expected: PRODUCTION_GATE_REFERENCE_COUNTS, runs: referenceRuns };

    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SourceManifest;
    const manifestSync = await new PgSourceManifestSync(pool).sync(manifest, asOf);
    if (manifestSync.activeCount !== EXPECTED_ACTIVE_KEYS.length) {
      throw new Error(`Expected ${EXPECTED_ACTIVE_KEYS.length} ACTIVE sources, got ${manifestSync.activeCount}`);
    }
    report.manifestSync = manifestSync;

    const active = await pool.query<ActiveSourceRow>(
      `SELECT id, source_key, source_url, source_format, health_status
       FROM sources WHERE active = true ORDER BY source_key`,
    );
    const actualKeys = active.rows.map((row) => row.source_key);
    if (JSON.stringify(actualKeys) !== JSON.stringify([...EXPECTED_ACTIVE_KEYS].sort())) {
      throw new Error(`ACTIVE source set drifted: ${JSON.stringify(actualKeys)}`);
    }

    const fetcher = new FixtureSourceFetcher();
    const sourceByKey = new Map(active.rows.map((row) => [row.source_key as ActiveSourceKey, row]));
    for (const key of EXPECTED_ACTIVE_KEYS) {
      const row = sourceByKey.get(key);
      if (!row) throw new Error(`Missing ACTIVE source ${key}`);
      const body = await readFile(resolve(fixtureRoot, fixtureRelativePath[key]));
      fetcher.set(
        row.source_url,
        body,
        row.source_format === 'HTML' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
      );
    }

    const registry = new PgBundleAwareSourceRegistry(pool);
    const ingestion = new SourceIngestionService(registry, new MinioArtifactStore(), fetcher);
    const initialArtifacts: string[] = [];
    for (const source of active.rows) {
      const result = await ingestion.ingest(source.id);
      if (result.outcome !== 'FETCHED' || !result.artifactId) {
        throw new Error(`Initial fixture ingest for ${source.source_key} returned ${result.outcome}`);
      }
      initialArtifacts.push(result.artifactId);
    }

    const beforePublishAgain = {
      collectionEvents: await count(pool, 'collection_events'),
      facilities: await count(pool, 'facilities'),
    };
    if (beforePublishAgain.collectionEvents !== 0 || beforePublishAgain.facilities !== 0) {
      throw new Error('Canonical data appeared before durable outbox processing');
    }

    const queue = new BullMqArtifactProcessingQueue(redis);
    const worker = createArtifactProcessingWorker(redis, registry, createArtifactRuntimeProcessor(pool));
    const dispatcher = new ArtifactOutboxDispatcher(registry, queue, { batchSize: 100 });
    try {
      const dispatched = await dispatcher.runOnce(new Date(Date.now() + 1_000));
      if (dispatched.enqueued !== EXPECTED_ACTIVE_KEYS.length || dispatched.enqueueFailed !== 0) {
        throw new Error(`Expected ${EXPECTED_ACTIVE_KEYS.length} enqueued artifacts: ${JSON.stringify(dispatched)}`);
      }
      await waitForPublishedArtifacts(pool, initialArtifacts);
    } finally {
      await worker.close();
      await queue.close();
    }

    const canonicalAfterInitial = {
      collectionEventsCurrent: await count(pool, 'collection_events', 'WHERE valid_to IS NULL'),
      collectionPublications: await count(pool, 'collection_publications'),
      facilities: await count(pool, 'facilities'),
      facilityAssertions: await count(pool, 'facility_source_assertions'),
      processingAttempts: await count(pool, 'source_processing_attempts'),
    };
    if (canonicalAfterInitial.collectionEventsCurrent === 0 || canonicalAfterInitial.collectionPublications < 2) {
      throw new Error(`Collection runtime failed to publish canonical data: ${JSON.stringify(canonicalAfterInitial)}`);
    }
    if (canonicalAfterInitial.facilities < 3 || canonicalAfterInitial.facilityAssertions < 4) {
      throw new Error(`Facility runtime produced insufficient canonical evidence: ${JSON.stringify(canonicalAfterInitial)}`);
    }
    report.initialPublish = canonicalAfterInitial;

    // Same bytes must resolve through SHA dedupe and must not create another publication/outbox item.
    const manowo = sourceByKey.get('manowo-collection-2ab-2026')!;
    const publicationsBeforeReplay = await count(pool, 'collection_publications');
    const replay = await ingestion.ingest(manowo.id);
    if (replay.outcome !== 'DEDUPLICATED') throw new Error(`Expected DEDUPLICATED replay, got ${replay.outcome}`);
    if (await count(pool, 'collection_publications') !== publicationsBeforeReplay) {
      throw new Error('Dedupe replay unexpectedly changed collection publication count');
    }
    report.replay = { outcome: replay.outcome, publicationCountUnchanged: true };

    // A fetch failure must degrade source health but keep current canonical data untouched.
    const currentEventsBeforeFailure = await count(pool, 'collection_events', 'WHERE valid_to IS NULL');
    fetcher.fail(manowo.source_url);
    let failureCode: string | null = null;
    try {
      await ingestion.ingest(manowo.id);
      throw new Error('Expected deterministic upstream failure');
    } catch (error) {
      if (!(error instanceof SourceFetchError)) throw error;
      failureCode = error.code;
    }
    const healthAfterFailure = await pool.query<{ health_status: string } & QueryResultRow>(
      'SELECT health_status FROM sources WHERE id = $1', [manowo.id],
    );
    const currentEventsAfterFailure = await count(pool, 'collection_events', 'WHERE valid_to IS NULL');
    if (healthAfterFailure.rows[0]?.health_status !== 'FETCH_FAILED' || currentEventsAfterFailure !== currentEventsBeforeFailure) {
      throw new Error('Fetch failure did not preserve last-known-good canonical collection state');
    }
    report.failure = {
      code: failureCode,
      healthStatus: healthAfterFailure.rows[0]?.health_status,
      lastKnownGoodPreserved: true,
    };

    // New SHA with unchanged logical schedule must publish a replacement version, not duplicate current events.
    const originalManowo = await readFile(resolve(fixtureRoot, fixtureRelativePath['manowo-collection-2ab-2026']));
    const changedManowo = Buffer.concat([
      originalManowo,
      Buffer.from('\nWastePL production gate upstream revision marker 2026-08-28\n'),
    ]);
    fetcher.set(manowo.source_url, changedManowo, 'text/plain; charset=utf-8');
    const changed = await ingestion.ingest(manowo.id);
    if (changed.outcome !== 'FETCHED' || !changed.artifactId) {
      throw new Error(`Changed artifact ingest returned ${changed.outcome}`);
    }
    const currentBeforeChangePublish = await count(pool, 'collection_events', 'WHERE valid_to IS NULL');
    const changedQueue = new BullMqArtifactProcessingQueue(redis);
    const changedWorker = createArtifactProcessingWorker(redis, registry, createArtifactRuntimeProcessor(pool));
    const changedDispatcher = new ArtifactOutboxDispatcher(registry, changedQueue, { batchSize: 100 });
    try {
      const dispatched = await changedDispatcher.runOnce(new Date(Date.now() + 1_000));
      if (dispatched.enqueued !== 1 || dispatched.enqueueFailed !== 0) {
        throw new Error(`Changed artifact was not dispatched exactly once: ${JSON.stringify(dispatched)}`);
      }
      await waitForPublishedArtifacts(pool, [changed.artifactId]);
    } finally {
      await changedWorker.close();
      await changedQueue.close();
    }
    const currentAfterChangePublish = await count(pool, 'collection_events', 'WHERE valid_to IS NULL');
    const retiredEvents = await count(pool, 'collection_events', 'WHERE valid_to IS NOT NULL');
    const publicationsAfterChange = await count(pool, 'collection_publications');
    if (currentAfterChangePublish !== currentBeforeChangePublish || retiredEvents === 0) {
      throw new Error('Changed artifact did not preserve current logical set with versioned replacement history');
    }
    if (publicationsAfterChange !== publicationsBeforeReplay + 1) {
      throw new Error('Changed artifact did not create exactly one new collection publication');
    }
    report.changedArtifact = {
      newArtifactId: changed.artifactId,
      currentLogicalEventCountStable: true,
      retiredHistoricalEvents: retiredEvents,
      publicationCount: publicationsAfterChange,
    };

    const badOutcomes = await pool.query<{ outcome: string; count: string } & QueryResultRow>(
      `SELECT outcome, count(*)::text AS count
       FROM source_processing_attempts
       WHERE outcome IN ('PARSE_FAILED','WAITING_FOR_COMPANION')
       GROUP BY outcome ORDER BY outcome`,
    );
    if (badOutcomes.rows.some((row) => row.outcome === 'PARSE_FAILED')) {
      throw new Error(`Production gate contains parse failures: ${JSON.stringify(badOutcomes.rows)}`);
    }

    report.processingOutcomeNotes = badOutcomes.rows;
    report.runtimeStatus = 'PASS';
    report.completedAt = new Date().toISOString();
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Production runtime gate PASS; report=${reportPath}`);
    console.log(`PRODUCTION_GATE_DATABASE_URL=${gateUrl}`);
  } catch (error) {
    report.runtimeStatus = 'FAIL';
    report.error = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error);
    report.completedAt = new Date().toISOString();
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    throw error;
  } finally {
    await redis.quit();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
