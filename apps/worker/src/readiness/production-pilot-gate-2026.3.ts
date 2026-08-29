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
  REAL_GOLDEN_REFERENCE_COUNTS,
  hydrateRealGoldenReferenceBackbone,
  insertKoszalinSourceOnlySupportAddress,
  loadRealGoldenReferenceSnapshot,
  realGoldenPrgRows,
} from './real-golden-reference.js';
import { productionGateTercRows } from './production-gate-reference.js';

const { Client, Pool } = pg;
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const manifestPath = resolve(repoRoot, 'manifests/pilot-koszalin-region-2026.3.json');
const fixtureRoot = resolve(repoRoot, 'apps/worker/test/fixtures');
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const asOf = new Date('2026-08-28T16:30:00Z');

const EXPECTED_ACTIVE_KEYS = [
  'bobolice-pszok',
  'koszalin-collection-bio-2026',
  'koszalin-pszok-faq',
  'koszalin-pszok-main',
  'manowo-collection-2ab-2026',
  'swieszyno-pszok',
  'tychowo-collection-standard-2026',
] as const;

type ActiveSourceKey = typeof EXPECTED_ACTIVE_KEYS[number];

const fixtureRelativePath: Record<ActiveSourceKey, string> = {
  'koszalin-collection-bio-2026': 'pdf-text/koszalin-bio-2026.txt',
  'manowo-collection-2ab-2026': 'pdf-text/manowo-2ab-2026.txt',
  'tychowo-collection-standard-2026': 'pdf-text/tychowo-standard-2026.txt',
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
      lastModified: 'Fri, 28 Aug 2026 16:30:00 GMT',
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

async function scalarCount(
  pool: InstanceType<typeof Pool>,
  sql: string,
  values: unknown[] = [],
): Promise<number> {
  const result = await pool.query<CountRow>(sql, values);
  return Number(result.rows[0]?.count ?? 0);
}

async function waitForPublishedArtifacts(
  pool: InstanceType<typeof Pool>,
  artifactIds: string[],
  timeoutMs = 25_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await pool.query<{ artifact_id: string; outcome: string } & QueryResultRow>(
      `SELECT artifact_id, outcome
       FROM source_processing_attempts
       WHERE artifact_id = ANY($1::uuid[])
       ORDER BY completed_at DESC NULLS LAST`,
      [artifactIds],
    );
    if (result.rows.some((row) => row.outcome === 'PARSE_FAILED')) {
      throw new Error(`Production artifact parse failure: ${JSON.stringify(result.rows)}`);
    }
    const terminal = new Set(
      result.rows
        .filter((row) => row.outcome === 'PUBLISHED' || row.outcome === 'REVIEW_REQUIRED')
        .map((row) => row.artifact_id),
    );
    if (artifactIds.every((id) => terminal.has(id))) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error('Timed out waiting for all ACTIVE source artifacts to reach a terminal publish/review state');
}

async function main(): Promise<void> {
  const gateUrl = gateDatabaseUrl();
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  await resetGateDatabase(gateUrl);

  const pool = new Pool({ connectionString: gateUrl });
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const report: Record<string, unknown> = {
    gate: 'fixture-independent-production-pilot-real-100',
    manifest: 'pilot-koszalin-region@2026.3',
    database: new URL(gateUrl).pathname.replace(/^\//, ''),
    fixturePolicy: {
      liveHttp: false,
      collectionRepresentation: 'PREEXTRACTED_TEXT_REGRESSION',
      rawPdfExtractionCoveredSeparately: true,
      canonicalSqlSeeds: false,
      addressReference: 'FROZEN_REAL_GUGIK_PRG_SNAPSHOT',
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
    const terc = await importer.importTerc(productionGateTercRows(), {
      dataset: 'TERYT_TERC',
      sourceVersion: 'production-gate-2026.3',
      metadata: { testOnly: true, purpose: 'municipality-backbone-for-real-prg-gate' },
    });
    if (terc.rejected !== 0) throw new Error(`TERC import rejected rows: ${JSON.stringify(terc)}`);

    const snapshot = await loadRealGoldenReferenceSnapshot();
    const backbone = await hydrateRealGoldenReferenceBackbone(pool, snapshot);
    const prg = await importer.importPrgAddresses(realGoldenPrgRows(snapshot), {
      dataset: 'PRG_ADDRESS',
      sourceVersion: 'gugik-prg-golden-2026-08-28',
      sourceUri: 'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej',
      metadata: {
        testOnly: true,
        frozenSnapshot: 'apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json',
        selectedRealAddresses: REAL_GOLDEN_REFERENCE_COUNTS.realAddresses,
      },
    });
    if (prg.rejected !== 0) throw new Error(`Real PRG import rejected rows: ${JSON.stringify(prg)}`);
    await insertKoszalinSourceOnlySupportAddress(pool);

    const realPrgCount = await scalarCount(
      pool,
      `SELECT count(*)::text AS count FROM addresses WHERE prg_id LIKE 'prg-adresy.%' AND active=true`,
    );
    const syntheticPrgCount = await scalarCount(
      pool,
      `SELECT count(*)::text AS count FROM addresses WHERE prg_id LIKE 'wastepl-gate-%'`,
    );
    const totalAddressCount = await scalarCount(pool, `SELECT count(*)::text AS count FROM addresses WHERE active=true`);
    if (realPrgCount !== REAL_GOLDEN_REFERENCE_COUNTS.realAddresses) {
      throw new Error(`Expected 100 real PRG addresses, got ${realPrgCount}`);
    }
    if (syntheticPrgCount !== 0) throw new Error(`Synthetic PRG identities leaked into real gate: ${syntheticPrgCount}`);
    if (totalAddressCount !== REAL_GOLDEN_REFERENCE_COUNTS.totalAddressesAfterHydration) {
      throw new Error(
        `Expected ${REAL_GOLDEN_REFERENCE_COUNTS.totalAddressesAfterHydration} total support+real addresses, got ${totalAddressCount}`,
      );
    }
    report.reference = {
      snapshotDate: snapshot.snapshotDate,
      source: snapshot.source,
      selection: snapshot.selection,
      expected: REAL_GOLDEN_REFERENCE_COUNTS,
      terc,
      backbone,
      prg,
      realPrgCount,
      sourceOnlySupportAddresses: REAL_GOLDEN_REFERENCE_COUNTS.sourceOnlySupportAddresses,
      syntheticPrgCount,
    };

    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SourceManifest;
    const manifestSync = await new PgSourceManifestSync(pool).sync(manifest, asOf);
    if (manifestSync.version !== '2026.3' || manifestSync.activeCount !== EXPECTED_ACTIVE_KEYS.length) {
      throw new Error(`Unexpected 2026.3 manifest sync: ${JSON.stringify(manifestSync)}`);
    }
    report.manifestSync = manifestSync;

    const active = await pool.query<ActiveSourceRow>(
      `SELECT id, source_key, source_url, source_format, health_status
       FROM sources WHERE active=true ORDER BY source_key`,
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

    if (await count(pool, 'collection_events') !== 0 || await count(pool, 'facilities') !== 0) {
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
      collectionMunicipalities: await scalarCount(
        pool,
        `SELECT count(DISTINCT m.terc)::text AS count
         FROM collection_events ce
         JOIN service_areas sa ON sa.id=ce.service_area_id
         JOIN municipalities m ON m.id=sa.municipality_id
         WHERE ce.valid_to IS NULL`,
      ),
      tychowoServiceAreas: await scalarCount(
        pool,
        `SELECT count(*)::text AS count
         FROM service_areas sa JOIN municipalities m ON m.id=sa.municipality_id
         WHERE m.terc='3201043' AND sa.active=true AND sa.external_key LIKE 'tychowo-standard-%'`,
      ),
      facilities: await count(pool, 'facilities'),
      facilityAssertions: await count(pool, 'facility_source_assertions'),
      processingAttempts: await count(pool, 'source_processing_attempts'),
    };
    if (
      canonicalAfterInitial.collectionEventsCurrent === 0
      || canonicalAfterInitial.collectionPublications < 3
      || canonicalAfterInitial.collectionMunicipalities !== 3
      || canonicalAfterInitial.tychowoServiceAreas !== 3
    ) {
      throw new Error(`Collection runtime failed full 3-municipality publication: ${JSON.stringify(canonicalAfterInitial)}`);
    }
    if (canonicalAfterInitial.facilities < 3 || canonicalAfterInitial.facilityAssertions < 4) {
      throw new Error(`Facility runtime produced insufficient canonical evidence: ${JSON.stringify(canonicalAfterInitial)}`);
    }
    report.initialPublish = canonicalAfterInitial;

    const manowo = sourceByKey.get('manowo-collection-2ab-2026')!;
    const publicationsBeforeReplay = await count(pool, 'collection_publications');
    const replay = await ingestion.ingest(manowo.id);
    if (replay.outcome !== 'DEDUPLICATED') throw new Error(`Expected DEDUPLICATED replay, got ${replay.outcome}`);
    if (await count(pool, 'collection_publications') !== publicationsBeforeReplay) {
      throw new Error('Dedupe replay unexpectedly changed collection publication count');
    }
    report.replay = { outcome: replay.outcome, publicationCountUnchanged: true };

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
      'SELECT health_status FROM sources WHERE id=$1',
      [manowo.id],
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

    const originalManowo = await readFile(resolve(fixtureRoot, fixtureRelativePath['manowo-collection-2ab-2026']));
    const changedManowo = Buffer.concat([
      originalManowo,
      Buffer.from('\nWastePL production gate upstream revision marker 2026-08-29\n'),
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

    const parseFailures = await scalarCount(
      pool,
      `SELECT count(*)::text AS count FROM source_processing_attempts WHERE outcome='PARSE_FAILED'`,
    );
    if (parseFailures !== 0) throw new Error(`Production gate contains ${parseFailures} parse failures`);

    report.runtimeStatus = 'PASS';
    report.completedAt = new Date().toISOString();
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Production runtime real-100 gate PASS; report=${reportPath}`);
    console.log(`PRODUCTION_GATE_DATABASE_URL=${gateUrl}`);
  } catch (error) {
    report.runtimeStatus = 'FAIL';
    report.error = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : String(error);
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
