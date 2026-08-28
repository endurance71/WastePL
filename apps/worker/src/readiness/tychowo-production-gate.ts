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
import { productionGateSimcRows, productionGateTercRows } from './production-gate-reference.js';

const { Client, Pool } = pg;
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const manifestPath = resolve(repoRoot, 'manifests/pilot-koszalin-region-2026.3.json');
const fixturePath = resolve(repoRoot, 'apps/worker/test/fixtures/pdf-text/tychowo-standard-2026.txt');
const reportPath = resolve(repoRoot, 'apps/worker/test-results/tychowo-production-gate-report.json');
const asOf = new Date('2026-08-28T16:30:00Z');
const SOURCE_KEY = 'tychowo-collection-standard-2026';

interface SourceRow extends QueryResultRow {
  id: string;
  source_url: string;
  health_status: string;
}
interface CountRow extends QueryResultRow { count: string }

function gateDatabaseUrl(): string {
  const base = new URL(
    process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  );
  base.pathname = '/wastepl_tychowo_gate';
  return base.toString();
}

function adminDatabaseUrl(gateUrl: string): string {
  const url = new URL(gateUrl);
  url.pathname = '/postgres';
  return url.toString();
}

async function resetDatabase(gateUrl: string): Promise<void> {
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
    env: { ...process.env, DATABASE_URL: gateUrl, WASTEPL_MIGRATION_PROFILE: 'structural' },
  });
}

async function count(pool: InstanceType<typeof Pool>, table: string, where = ''): Promise<number> {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`Unsafe table name ${table}`);
  const result = await pool.query<CountRow>(`SELECT count(*)::text AS count FROM ${table} ${where}`);
  return Number(result.rows[0]?.count ?? 0);
}

class SingleFixtureFetcher implements SourceFetcher {
  private failNext = false;

  constructor(
    private readonly url: string,
    private body: Buffer,
  ) {}

  setBody(body: Buffer): void {
    this.body = body;
    this.failNext = false;
  }

  fail(): void {
    this.failNext = true;
  }

  async fetch(source: SourceRecord): Promise<FetchedSource> {
    if (source.sourceUrl !== this.url) throw new Error(`Unexpected source URL ${source.sourceUrl}`);
    if (this.failNext) {
      throw new SourceFetchError({
        message: 'Deterministic Tychowo gate upstream failure',
        attempts: 3,
        status: 503,
        code: 'HTTP_503',
        retryable: true,
      });
    }
    return {
      status: 200,
      notModified: false,
      body: this.body,
      etag: `"tychowo-${this.body.length}"`,
      lastModified: 'Fri, 28 Aug 2026 16:30:00 GMT',
      contentType: 'text/plain; charset=utf-8',
      finalUrl: this.url,
      attempts: 1,
      retrievedAt: asOf,
    };
  }
}

async function dispatchAndWait(
  pool: InstanceType<typeof Pool>,
  redis: Redis,
  registry: PgBundleAwareSourceRegistry,
  artifactId: string,
): Promise<void> {
  const queue = new BullMqArtifactProcessingQueue(redis);
  const worker = createArtifactProcessingWorker(redis, registry, createArtifactRuntimeProcessor(pool));
  const dispatcher = new ArtifactOutboxDispatcher(registry, queue, { batchSize: 20 });
  try {
    const dispatched = await dispatcher.runOnce(new Date(Date.now() + 1_000));
    if (dispatched.enqueued !== 1 || dispatched.enqueueFailed !== 0) {
      throw new Error(`Expected one Tychowo artifact dispatch: ${JSON.stringify(dispatched)}`);
    }
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const result = await pool.query<{ outcome: string } & QueryResultRow>(
        `SELECT outcome
         FROM source_processing_attempts
         WHERE artifact_id = $1
         ORDER BY id DESC
         LIMIT 1`,
        [artifactId],
      );
      const outcome = result.rows[0]?.outcome;
      if (outcome === 'PUBLISHED') return;
      if (outcome === 'PARSE_FAILED' || outcome === 'REVIEW_REQUIRED') {
        throw new Error(`Tychowo artifact reached unexpected outcome ${outcome}`);
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
    throw new Error('Timed out waiting for Tychowo artifact publication');
  } finally {
    await worker.close();
    await queue.close();
  }
}

async function main(): Promise<void> {
  const gateUrl = gateDatabaseUrl();
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
  const report: Record<string, unknown> = {
    gate: 'tychowo-clean-runtime-2026.3',
    manifest: 'pilot-koszalin-region@2026.3',
    sourceKey: SOURCE_KEY,
    startedAt: new Date().toISOString(),
  };

  await resetDatabase(gateUrl);
  const pool = new Pool({ connectionString: gateUrl });
  try {
    if (await count(pool, 'collection_events') !== 0 || await count(pool, 'collection_publications') !== 0) {
      throw new Error('Tychowo clean gate started with canonical collection data');
    }

    const importer = new PgOfficialReferenceImporter(pool);
    const terc = await importer.importTerc(productionGateTercRows(), {
      dataset: 'TERYT_TERC', sourceVersion: 'tychowo-gate-2026.3', metadata: { testOnly: true },
    });
    const simc = await importer.importSimc(productionGateSimcRows(), {
      dataset: 'TERYT_SIMC', sourceVersion: 'tychowo-gate-2026.3', metadata: { testOnly: true },
    });
    if (terc.rejected !== 0 || simc.rejected !== 0) {
      throw new Error(`Reference import rejected rows: ${JSON.stringify({ terc, simc })}`);
    }

    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SourceManifest;
    const manifestSync = await new PgSourceManifestSync(pool).sync(manifest, asOf);
    if (manifestSync.version !== '2026.3' || manifestSync.activeCount !== 7) {
      throw new Error(`Unexpected 2026.3 manifest sync: ${JSON.stringify(manifestSync)}`);
    }

    const sourceResult = await pool.query<SourceRow>(
      `SELECT id, source_url, health_status
       FROM sources
       WHERE source_key = $1`,
      [SOURCE_KEY],
    );
    const source = sourceResult.rows[0];
    if (!source) throw new Error(`Missing ${SOURCE_KEY} after manifest sync`);

    const original = await readFile(fixturePath);
    const fetcher = new SingleFixtureFetcher(source.source_url, original);
    const registry = new PgBundleAwareSourceRegistry(pool);
    const ingestion = new SourceIngestionService(registry, new MinioArtifactStore(), fetcher);

    const initial = await ingestion.ingest(source.id);
    if (initial.outcome !== 'FETCHED' || !initial.artifactId) {
      throw new Error(`Initial Tychowo ingest returned ${initial.outcome}`);
    }
    if (await count(pool, 'collection_events') !== 0) {
      throw new Error('Canonical Tychowo data appeared before durable outbox processing');
    }
    await dispatchAndWait(pool, redis, registry, initial.artifactId);

    const serviceAreas = await count(
      pool,
      'service_areas',
      `WHERE source_id = '${source.id}'::uuid AND active = true`,
    );
    const localityRules = await pool.query<{ count: string } & QueryResultRow>(
      `SELECT count(*)::text AS count
       FROM service_area_rules r
       JOIN service_areas sa ON sa.id = r.service_area_id
       WHERE sa.source_id = $1 AND sa.active = true AND r.rule_type = 'LOCALITY'`,
      [source.id],
    );
    const fractions = await pool.query<{ fraction_code: string } & QueryResultRow>(
      `SELECT DISTINCT ce.fraction_code
       FROM collection_events ce
       JOIN service_areas sa ON sa.id = ce.service_area_id
       WHERE sa.source_id = $1 AND ce.valid_to IS NULL
       ORDER BY ce.fraction_code`,
      [source.id],
    );
    const fractionCodes = fractions.rows.map((row) => row.fraction_code);
    if (serviceAreas !== 3 || Number(localityRules.rows[0]?.count ?? 0) !== 30) {
      throw new Error(`Unexpected safe Tychowo coverage: ${JSON.stringify({ serviceAreas, localityRules: localityRules.rows })}`);
    }
    if (JSON.stringify(fractionCodes) !== JSON.stringify(['BIO', 'GLASS', 'MIXED', 'OTHER', 'PAPER'])) {
      throw new Error(`Tychowo fraction set drifted: ${JSON.stringify(fractionCodes)}`);
    }
    const currentEvents = await count(pool, 'collection_events', 'WHERE valid_to IS NULL');
    if (currentEvents === 0 || await count(pool, 'collection_publications') !== 1) {
      throw new Error('Tychowo runtime did not create one canonical publication');
    }

    const artifact = await pool.query<{
      parser_key: string | null;
      parser_version: string | null;
      status: string;
    } & QueryResultRow>(
      'SELECT parser_key, parser_version, status FROM source_artifacts WHERE id = $1',
      [initial.artifactId],
    );
    if (
      artifact.rows[0]?.parser_key !== 'municipal-collection-pdf-text' ||
      artifact.rows[0]?.parser_version !== '0.1.0' ||
      artifact.rows[0]?.status !== 'PUBLISHED'
    ) {
      throw new Error(`Tychowo provenance missing parser identity: ${JSON.stringify(artifact.rows[0])}`);
    }

    const replay = await ingestion.ingest(source.id);
    if (replay.outcome !== 'DEDUPLICATED' || await count(pool, 'collection_publications') !== 1) {
      throw new Error(`Tychowo replay was not idempotent: ${JSON.stringify(replay)}`);
    }

    fetcher.fail();
    let failureCode: string | null = null;
    try {
      await ingestion.ingest(source.id);
      throw new Error('Expected deterministic Tychowo upstream failure');
    } catch (error) {
      if (!(error instanceof SourceFetchError)) throw error;
      failureCode = error.code;
    }
    const afterFailure = await pool.query<{ health_status: string } & QueryResultRow>(
      'SELECT health_status FROM sources WHERE id = $1',
      [source.id],
    );
    if (afterFailure.rows[0]?.health_status !== 'FETCH_FAILED' || await count(pool, 'collection_events', 'WHERE valid_to IS NULL') !== currentEvents) {
      throw new Error('Tychowo fetch failure did not preserve last-known-good data');
    }

    fetcher.setBody(Buffer.concat([original, Buffer.from('\nWastePL deterministic Tychowo revision marker\n')]));
    const changed = await ingestion.ingest(source.id);
    if (changed.outcome !== 'FETCHED' || !changed.artifactId) {
      throw new Error(`Changed Tychowo ingest returned ${changed.outcome}`);
    }
    await dispatchAndWait(pool, redis, registry, changed.artifactId);
    const currentAfterChange = await count(pool, 'collection_events', 'WHERE valid_to IS NULL');
    const retiredAfterChange = await count(pool, 'collection_events', 'WHERE valid_to IS NOT NULL');
    if (currentAfterChange !== currentEvents || retiredAfterChange === 0 || await count(pool, 'collection_publications') !== 2) {
      throw new Error('Tychowo changed artifact did not create scoped temporal replacement');
    }

    report.reference = { terc, simc };
    report.manifestSync = manifestSync;
    report.initial = {
      artifactId: initial.artifactId,
      serviceAreas,
      localityRules: Number(localityRules.rows[0]?.count ?? 0),
      fractionCodes,
      currentEvents,
    };
    report.replay = { outcome: replay.outcome, publicationCount: 1 };
    report.failure = { code: failureCode, healthStatus: afterFailure.rows[0]?.health_status, lastKnownGoodPreserved: true };
    report.changedArtifact = { artifactId: changed.artifactId, currentEvents: currentAfterChange, retiredEvents: retiredAfterChange, publications: 2 };
    report.status = 'PASS';
    report.completedAt = new Date().toISOString();
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Tychowo clean runtime gate PASS; report=${reportPath}`);
  } catch (error) {
    report.status = 'FAIL';
    report.error = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error);
    report.completedAt = new Date().toISOString();
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    throw error;
  } finally {
    await pool.end();
    await redis.quit();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
