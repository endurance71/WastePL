import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import pg, { type QueryResultRow } from 'pg';
import { createArtifactProcessingWorker } from '../ingestion/artifact-processing.js';
import { MinioArtifactStore } from '../ingestion/artifact-store.js';
import { BullMqArtifactProcessingQueue } from '../ingestion/bullmq-queues.js';
import { PgBundleAwareSourceRegistry } from '../ingestion/bundle-aware-source-registry.js';
import { SourceIngestionService } from '../ingestion/source-ingestion-service.js';
import { ArtifactOutboxDispatcher } from '../ingestion/source-scheduler.js';
import type { FetchedSource, SourceFetcher, SourceRecord } from '../ingestion/types.js';
import { createArtifactRuntimeProcessor } from '../main.js';
import { PgSourceManifestSync } from '../manifests/source-manifest-sync.js';

const { Pool } = pg;
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const faqFixturePath = resolve(repoRoot, 'apps/worker/test/fixtures/pgk-koszalin-pszok-faq.html');
const changedAt = new Date('2026-08-28T17:00:00Z');
const MANIFEST_VERSION = '2026.3';
const MANIFEST_ID = `pilot-koszalin-region@${MANIFEST_VERSION}`;
const EXPECTED_PILOT_TERCS = [
  '3201043',
  '3209012',
  '3209033',
  '3209042',
  '3209063',
  '3209073',
  '3209082',
  '3261011',
] as const;

interface SourceRow extends QueryResultRow {
  id: string;
  source_url: string;
}

interface CountRow extends QueryResultRow { count: string }

interface AccessStateRow extends QueryResultRow {
  access_source_artifact_id: string | null;
  access_rules: Record<string, unknown>;
}

function gateDatabaseUrl(): string {
  if (process.env.PRODUCTION_GATE_DATABASE_URL) return process.env.PRODUCTION_GATE_DATABASE_URL;
  const base = new URL(
    process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  );
  base.pathname = '/wastepl_production_gate';
  return base.toString();
}

class SingleFixtureFetcher implements SourceFetcher {
  constructor(
    private readonly url: string,
    private readonly body: Buffer,
  ) {}

  async fetch(source: SourceRecord): Promise<FetchedSource> {
    if (source.sourceUrl !== this.url) throw new Error(`Unexpected source ${source.sourceUrl}`);
    return {
      status: 200,
      notModified: false,
      body: this.body,
      etag: `"gate-faq-changed-${this.body.length}"`,
      lastModified: 'Fri, 28 Aug 2026 17:00:00 GMT',
      contentType: 'text/html; charset=utf-8',
      finalUrl: source.sourceUrl,
      attempts: 1,
      retrievedAt: changedAt,
    };
  }
}

async function scalarCount(
  pool: InstanceType<typeof Pool>,
  sql: string,
  values: unknown[] = [],
): Promise<number> {
  const result = await pool.query<CountRow>(sql, values);
  return Number(result.rows[0]?.count ?? 0);
}

async function waitForArtifact(
  pool: InstanceType<typeof Pool>,
  artifactId: string,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await pool.query<{ outcome: string } & QueryResultRow>(
      `SELECT outcome FROM source_processing_attempts
       WHERE artifact_id=$1 ORDER BY completed_at DESC`,
      [artifactId],
    );
    if (result.rows.some((row) => row.outcome === 'PARSE_FAILED')) {
      throw new Error(`Changed facility companion artifact ${artifactId} PARSE_FAILED`);
    }
    if (result.rows.some((row) => row.outcome === 'PUBLISHED' || row.outcome === 'REVIEW_REQUIRED')) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for changed facility companion ${artifactId}`);
}

async function main(): Promise<void> {
  const gateUrl = gateDatabaseUrl();
  const pool = new Pool({ connectionString: gateUrl });
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>;

  try {
    if (report.runtimeStatus !== 'PASS') throw new Error('Base production runtime gate did not pass');
    if (report.manifest !== MANIFEST_ID) throw new Error(`Base gate used unexpected manifest ${String(report.manifest)}`);

    const faqSource = await pool.query<SourceRow>(
      `SELECT id, source_url FROM sources WHERE source_key='koszalin-pszok-faq' AND active=true LIMIT 1`,
    );
    const faq = faqSource.rows[0];
    if (!faq) throw new Error('ACTIVE koszalin-pszok-faq source missing');

    const facilitiesBefore = await scalarCount(pool, 'SELECT count(*)::text AS count FROM facilities');
    const assertionsBefore = await scalarCount(pool, 'SELECT count(*)::text AS count FROM facility_source_assertions');
    const original = await readFile(faqFixturePath);
    const changedBody = Buffer.concat([
      original,
      Buffer.from('\n<!-- WastePL production gate companion revision 2026-08-29 -->\n'),
    ]);

    const registry = new PgBundleAwareSourceRegistry(pool);
    const ingestion = new SourceIngestionService(
      registry,
      new MinioArtifactStore(),
      new SingleFixtureFetcher(faq.source_url, changedBody),
    );
    const changed = await ingestion.ingest(faq.id);
    if (changed.outcome !== 'FETCHED' || !changed.artifactId) {
      throw new Error(`Changed facility companion ingest returned ${changed.outcome}`);
    }

    const queue = new BullMqArtifactProcessingQueue(redis);
    const worker = createArtifactProcessingWorker(redis, registry, createArtifactRuntimeProcessor(pool));
    const dispatcher = new ArtifactOutboxDispatcher(registry, queue, { batchSize: 100 });
    try {
      const dispatched = await dispatcher.runOnce(new Date(Date.now() + 1_000));
      if (dispatched.enqueued !== 1 || dispatched.enqueueFailed !== 0) {
        throw new Error(`Changed facility companion dispatch mismatch: ${JSON.stringify(dispatched)}`);
      }
      await waitForArtifact(pool, changed.artifactId);
    } finally {
      await worker.close();
      await queue.close();
    }

    const facilitiesAfter = await scalarCount(pool, 'SELECT count(*)::text AS count FROM facilities');
    const assertionsAfter = await scalarCount(pool, 'SELECT count(*)::text AS count FROM facility_source_assertions');
    if (facilitiesAfter !== facilitiesBefore) {
      throw new Error(`Facility companion change altered canonical facility count ${facilitiesBefore} -> ${facilitiesAfter}`);
    }
    if (assertionsAfter <= assertionsBefore) {
      throw new Error('Facility companion change did not preserve new artifact provenance assertion history');
    }

    const changedFaqAssertionCount = await scalarCount(
      pool,
      `SELECT count(*)::text AS count
       FROM facility_source_assertions a
       JOIN facilities f ON f.id=a.facility_id
       WHERE f.canonical_key='pl-3261011-pszok-komunalna-5'
         AND a.source_artifact_id=$1
         AND a.source_key='koszalin-pszok-faq'
         AND a.reconciliation_state='CANONICAL'`,
      [changed.artifactId],
    );
    if (changedFaqAssertionCount !== 1) {
      throw new Error(`Changed FAQ artifact expected one canonical FAQ assertion, got ${changedFaqAssertionCount}`);
    }

    const accessState = await pool.query<AccessStateRow>(
      `SELECT access_source_artifact_id, access_rules
       FROM facilities WHERE canonical_key='pl-3261011-pszok-komunalna-5' LIMIT 1`,
    );
    const access = accessState.rows[0];
    if (!access?.access_source_artifact_id) throw new Error('Komunalna 5 aggregate access provenance missing');
    if (access.access_source_artifact_id === changed.artifactId) {
      throw new Error('FAQ artifact incorrectly replaced main-page aggregate access provenance');
    }
    const limits = Array.isArray(access.access_rules?.quantityLimits)
      ? access.access_rules.quantityLimits as Array<Record<string, unknown>>
      : [];
    if (limits.length !== 2 || limits.some((limit) => limit.sourceKey !== 'koszalin-pszok-faq')) {
      throw new Error(`Canonical quantity limits lost FAQ claim attribution: ${JSON.stringify(limits)}`);
    }

    const duplicateCurrentEvents = await scalarCount(
      pool,
      `SELECT count(*)::text AS count FROM (
         SELECT service_area_id, fraction_code, collection_date, status, COALESCE(note, ''), count(*)
         FROM collection_events
         WHERE valid_to IS NULL
         GROUP BY service_area_id, fraction_code, collection_date, status, COALESCE(note, '')
         HAVING count(*) > 1
       ) duplicates`,
    );
    const duplicateCanonicalFacilities = await scalarCount(
      pool,
      `SELECT count(*)::text AS count FROM (
         SELECT canonical_key, count(*) FROM facilities
         WHERE canonical_key IS NOT NULL AND active=true
         GROUP BY canonical_key HAVING count(*) > 1
       ) duplicates`,
    );
    const duplicateArtifactAssertions = await scalarCount(
      pool,
      `SELECT count(*)::text AS count FROM (
         SELECT source_artifact_id, fingerprint, count(*) FROM facility_source_assertions
         GROUP BY source_artifact_id, fingerprint HAVING count(*) > 1
       ) duplicates`,
    );
    if (duplicateCurrentEvents || duplicateCanonicalFacilities || duplicateArtifactAssertions) {
      throw new Error(
        `Duplicate runtime rows detected: events=${duplicateCurrentEvents}, facilities=${duplicateCanonicalFacilities}, assertions=${duplicateArtifactAssertions}`,
      );
    }

    const coverage = await new PgSourceManifestSync(pool).coverage('pilot-koszalin-region', MANIFEST_VERSION);
    const coverageMunicipalityTercs = [...new Set(coverage.map((row) => row.terc))].sort();
    if (JSON.stringify(coverageMunicipalityTercs) !== JSON.stringify([...EXPECTED_PILOT_TERCS].sort())) {
      throw new Error(
        `Pilot coverage municipality set drifted: expected=${JSON.stringify([...EXPECTED_PILOT_TERCS].sort())}, actual=${JSON.stringify(coverageMunicipalityTercs)}`,
      );
    }

    const manifestCounts = await pool.query<{
      manifest_status: string;
      active: boolean;
      count: string;
    } & QueryResultRow>(
      `SELECT manifest_status, active, count(*)::text AS count
       FROM sources WHERE manifest_version=$1
       GROUP BY manifest_status, active ORDER BY manifest_status, active`,
      [MANIFEST_ID],
    );
    const sourceHealth = await pool.query<{
      source_key: string;
      manifest_status: string;
      active: boolean;
      health_status: string;
      last_checked_at: Date | null;
      poll_interval_minutes: number;
    } & QueryResultRow>(
      `SELECT source_key, manifest_status, active, health_status, last_checked_at, poll_interval_minutes
       FROM sources WHERE manifest_version=$1 ORDER BY source_key`,
      [MANIFEST_ID],
    );
    const activeSources = sourceHealth.rows.filter((source) => source.active);
    if (activeSources.length !== 7) throw new Error(`Expected 7 ACTIVE sources, got ${activeSources.length}`);
    const nonTerminalActive = activeSources.filter(
      (source) => !['HEALTHY', 'REVIEW_REQUIRED'].includes(source.health_status),
    );
    if (nonTerminalActive.length > 0) {
      throw new Error(`ACTIVE sources are not terminal: ${JSON.stringify(nonTerminalActive)}`);
    }

    const reviewQueue = {
      dataQualityPending: await scalarCount(
        pool,
        `SELECT count(*)::text AS count FROM facility_data_quality_reviews WHERE state='PENDING'`,
      ),
      reconciliationPending: await scalarCount(
        pool,
        `SELECT count(*)::text AS count FROM facility_reconciliation_reviews WHERE state='PENDING'`,
      ),
    };

    report.changedFacilityCompanion = {
      sourceKey: 'koszalin-pszok-faq',
      artifactId: changed.artifactId,
      canonicalFacilityCountStable: true,
      assertionsBefore,
      assertionsAfter,
      changedFaqCanonicalAssertionCount: changedFaqAssertionCount,
      aggregateAccessProvenanceRemainedMain: true,
      quantityLimitClaimAttribution: 'koszalin-pszok-faq',
    };
    report.duplicateChecks = {
      duplicateCurrentCollectionEvents: duplicateCurrentEvents,
      duplicateCanonicalFacilities,
      duplicateArtifactAssertions,
    };
    report.coverage = {
      manifest: MANIFEST_ID,
      municipalityTercs: coverageMunicipalityTercs,
      rows: coverage,
      manifestCounts: manifestCounts.rows,
    };
    report.sourceHealth = sourceHealth.rows.map((source) => ({
      ...source,
      last_checked_at: source.last_checked_at?.toISOString() ?? null,
    }));
    report.reviewQueue = reviewQueue;
    report.externalPilotBlockers = [
      'LIVE_SOURCE_STAGING_SOAK_NOT_RUN',
      'FULL_8_MUNICIPALITY_COLLECTION_COVERAGE_NOT_REACHED',
      'VERIFIED_DEPOSIT_RETURN_LOCATION_COVERAGE_NOT_ESTABLISHED',
      'ARTIFACT_PROCESSING_DEFAULT_ENABLEMENT_REQUIRES_PRODUCTION_GATES_TO_MERGE_GREEN',
    ];
    report.extendedRuntimeStatus = 'PASS';
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('Production extended runtime 2026.3 gate PASS');
  } catch (error) {
    report.extendedRuntimeStatus = 'FAIL';
    report.status = 'FAIL';
    report.extendedRuntimeError = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : String(error);
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
