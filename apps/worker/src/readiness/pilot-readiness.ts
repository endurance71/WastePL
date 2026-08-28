import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg, { type QueryResultRow } from 'pg';
import pilotManifestJson from '../../../../manifests/pilot-koszalin-region-2026.1.json' with { type: 'json' };
import { MinioArtifactStore } from '../ingestion/artifact-store.js';
import { PgBundleAwareSourceRegistry } from '../ingestion/bundle-aware-source-registry.js';
import { SourceFetchError } from '../ingestion/http-source-fetcher.js';
import { SourceIngestionService } from '../ingestion/source-ingestion-service.js';
import type { FetchedSource, SourceFetcher, SourceRecord } from '../ingestion/types.js';
import { PgSourceManifestSync } from '../manifests/source-manifest-sync.js';
import { parseSourceManifest, type SourceManifest } from '../manifests/source-manifest.js';
import { PgOfficialReferenceImporter } from '../reference/pg-reference-importer.js';
import type { TercRow } from '../reference/types.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for the pilot readiness gate');

const reportPath = fileURLToPath(new URL('../../test-results/pilot-readiness-report.json', import.meta.url));
const scheduleGoldenPath = fileURLToPath(
  new URL('../../../api/test-results/golden-mismatch-report.json', import.meta.url),
);
const facilityGoldenPath = fileURLToPath(
  new URL('../../../api/test-results/golden-facility-mismatch-report.json', import.meta.url),
);
const fixtureRoot = new URL('../../test/fixtures/', import.meta.url);
const manifest = parseSourceManifest(pilotManifestJson) as SourceManifest;
const asOf = new Date('2026-08-28T05:30:00Z');

interface ManifestSourceRow extends QueryResultRow {
  id: string;
  terc: string;
  source_key: string;
  source_url: string;
  data_type: string;
  source_format: string;
  parser_key: string | null;
  manifest_status: string;
  active: boolean;
  last_sha256: string | null;
  last_success_at: Date | null;
  last_failure_at: Date | null;
  last_checked_at: Date | null;
  next_check_at: Date | null;
  health_status: string;
  consecutive_failures: number;
  last_error_code: string | null;
  last_error_message: string | null;
  poll_interval_minutes: number;
  bundle_key: string | null;
  bundle_role: string | null;
  bundle_required_roles: unknown;
  bundle_freshness_minutes: number | null;
}

interface CountRow extends QueryResultRow { count: string }
interface ReviewCountRow extends QueryResultRow { kind: string; state: string; count: string }
interface GoldenReport {
  threshold: number;
  correctness: number;
  correctnessPercent: number;
  total: number;
  failed: number;
}

function terytKindName(rodz: string): string {
  if (rodz === '1') return 'gmina miejska';
  if (rodz === '2') return 'gmina wiejska';
  if (rodz === '3') return 'gmina miejsko-wiejska';
  return 'gmina';
}

function pilotTercRows(): TercRow[] {
  return manifest.municipalities.map((municipality) => {
    const terc = municipality.terc;
    const rodz = terc.slice(6, 7);
    return {
      woj: terc.slice(0, 2),
      pow: terc.slice(2, 4),
      gmi: terc.slice(4, 6),
      rodz,
      name: municipality.name,
      nameAdditional: terytKindName(rodz),
      stateDate: '2026-01-01',
    };
  });
}

async function fixtureBody(source: ManifestSourceRow): Promise<Buffer> {
  let relative: string;
  if (source.parser_key === 'pgk-koszalin-pdf-text') {
    relative = source.terc === '3209042'
      ? 'pdf-text/manowo-2ab-2026.txt'
      : 'pdf-text/koszalin-bio-2026.txt';
  } else if (source.parser_key === 'pgk-koszalin-pszok-html') {
    relative = source.source_url.toLowerCase().includes('faq')
      ? 'pgk-koszalin-pszok-faq.html'
      : 'pgk-koszalin-pszok-main.html';
  } else {
    throw new Error(`No readiness fixture for parser ${source.parser_key ?? 'null'}`);
  }
  const body = await readFile(new URL(relative, fixtureRoot));
  return Buffer.concat([body, Buffer.from(`\n<!-- wastepl-readiness:${source.source_key}:v1 -->\n`)]);
}

class DeterministicPilotFetcher implements SourceFetcher {
  private readonly bodies = new Map<string, Buffer>();
  private readonly failures = new Set<string>();
  private tick = 0;

  setBody(sourceId: string, body: Buffer): void {
    this.bodies.set(sourceId, body);
  }

  setFailure(sourceId: string, failed: boolean): void {
    failed ? this.failures.add(sourceId) : this.failures.delete(sourceId);
  }

  async fetch(source: SourceRecord): Promise<FetchedSource> {
    this.tick += 1;
    if (this.failures.has(source.id)) {
      throw new SourceFetchError({
        message: 'Readiness gate simulated source outage',
        attempts: 1,
        status: 503,
        code: 'READINESS_SIMULATED_FAILURE',
        retryable: true,
      });
    }
    const body = this.bodies.get(source.id);
    if (!body) throw new Error(`Readiness fetcher has no fixture body for ${source.id}`);
    return {
      status: 200,
      notModified: false,
      body,
      etag: `"readiness-${source.id}-${body.length}"`,
      lastModified: 'Fri, 28 Aug 2026 05:00:00 GMT',
      contentType: source.sourceFormat === 'HTML' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
      finalUrl: source.sourceUrl,
      attempts: 1,
      retrievedAt: new Date(asOf.getTime() + this.tick * 1000),
    };
  }
}

async function count(pool: InstanceType<typeof Pool>, sql: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query<CountRow>(sql, params);
  return Number(result.rows[0]?.count ?? 0);
}

async function readGolden(path: string, label: string): Promise<GoldenReport> {
  const report = JSON.parse(await readFile(path, 'utf8')) as GoldenReport;
  if (!Number.isFinite(report.correctness) || !Number.isFinite(report.threshold)) {
    throw new Error(`${label} golden report is malformed`);
  }
  return report;
}

async function manifestSources(pool: InstanceType<typeof Pool>): Promise<ManifestSourceRow[]> {
  return (
    await pool.query<ManifestSourceRow>(
      `SELECT
         s.id, m.terc, s.source_key, s.source_url, s.data_type, s.source_format,
         s.parser_key, s.manifest_status, s.active, s.last_sha256,
         s.last_success_at, s.last_failure_at, s.last_checked_at, s.next_check_at,
         s.health_status, s.consecutive_failures, s.last_error_code,
         s.last_error_message, s.poll_interval_minutes,
         s.bundle_key, s.bundle_role, s.bundle_required_roles, s.bundle_freshness_minutes
       FROM sources s
       JOIN municipalities m ON m.id = s.municipality_id
       WHERE s.manifest_version = $1
       ORDER BY m.terc, s.data_type, s.source_key`,
      [`${manifest.manifestId}@${manifest.version}`],
    )
  ).rows;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const failures: string[] = [];
  let report: Record<string, unknown> = {
    gateVersion: '0.2.0',
    manifest: { id: manifest.manifestId, version: manifest.version },
    generatedAt: new Date().toISOString(),
    status: 'FAILED',
  };

  try {
    const referenceImporter = new PgOfficialReferenceImporter(pool);
    const referenceImport = await referenceImporter.importTerc(pilotTercRows(), {
      dataset: 'TERYT_TERC',
      sourceVersion: '2026-01-01-pilot-readiness-slice',
      sourceUri: 'fixture://pilot-readiness/official-teryt-terc-slice',
      scopeKey: 'pilot-koszalin-region',
      fullSnapshot: false,
      metadata: { purpose: 'deterministic CI readiness gate', municipalityCount: 8 },
    });
    if (referenceImport.rejected !== 0) failures.push(`TERYT readiness import rejected ${referenceImport.rejected} rows`);

    const manifestSync = new PgSourceManifestSync(pool);
    const syncResult = await manifestSync.sync(manifest, asOf);
    const coverage = await manifestSync.coverage(manifest.manifestId, manifest.version);
    if (syncResult.municipalityCount !== 8) failures.push(`manifest municipality count is ${syncResult.municipalityCount}, expected 8`);
    if (new Set(coverage.map((row) => row.terc)).size !== 8) failures.push('coverage does not contain all 8 municipalities');

    let sources = await manifestSources(pool);
    const activeSources = sources.filter((source) => source.active);
    const plannedSources = sources.filter((source) => source.manifest_status === 'PLANNED');
    if (plannedSources.some((source) => source.active || source.parser_key !== null)) {
      failures.push('at least one PLANNED source became schedulable or claimed a parser');
    }
    if (activeSources.length === 0) failures.push('manifest has no schedulable ACTIVE sources');

    const bundleGroups = new Map<string, ManifestSourceRow[]>();
    for (const source of activeSources) {
      if (!source.bundle_key) continue;
      const key = `${source.terc}:${source.bundle_key}`;
      const members = bundleGroups.get(key) ?? [];
      members.push(source);
      bundleGroups.set(key, members);
    }
    for (const [key, members] of bundleGroups) {
      const roles = members.map((member) => member.bundle_role).filter((role): role is string => Boolean(role)).sort();
      const configuredRoles = members[0]?.bundle_required_roles;
      const required = Array.isArray(configuredRoles)
        ? configuredRoles.filter((role): role is string => typeof role === 'string').sort()
        : [];
      if (roles.join('|') !== required.join('|')) {
        failures.push(`active bundle ${key} source roles do not match required roles`);
      }
    }

    const fetcher = new DeterministicPilotFetcher();
    for (const source of activeSources) fetcher.setBody(source.id, await fixtureBody(source));
    const registry = new PgBundleAwareSourceRegistry(pool);
    const ingestion = new SourceIngestionService(registry, new MinioArtifactStore(), fetcher);
    const activeIds = activeSources.map((source) => source.id);

    const artifactsBefore = await count(
      pool,
      'SELECT count(*)::text AS count FROM source_artifacts WHERE source_id = ANY($1::uuid[])',
      [activeIds],
    );
    const run1 = [];
    for (const source of activeSources) run1.push(await ingestion.ingest(source.id));
    const artifactsAfterRun1 = await count(
      pool,
      'SELECT count(*)::text AS count FROM source_artifacts WHERE source_id = ANY($1::uuid[])',
      [activeIds],
    );

    const run2 = [];
    for (const source of activeSources) run2.push(await ingestion.ingest(source.id));
    const artifactsAfterRun2 = await count(
      pool,
      'SELECT count(*)::text AS count FROM source_artifacts WHERE source_id = ANY($1::uuid[])',
      [activeIds],
    );
    if (artifactsAfterRun2 !== artifactsAfterRun1) failures.push('unchanged second run created duplicate artifacts');
    if (run2.some((result) => result.outcome !== 'DEDUPLICATED')) {
      failures.push(`second run was not fully deduplicated: ${run2.map((result) => result.outcome).join(', ')}`);
    }

    const changedSource = activeSources.find(
      (source) => source.terc === '3261011' && source.data_type === 'COLLECTION_SCHEDULE',
    ) ?? activeSources[0]!;
    const previousChangedSource = await registry.getSourceById(changedSource.id);
    const changedV1 = await fixtureBody(changedSource);
    const changedV2 = Buffer.concat([changedV1, Buffer.from('\nREADINESS_CHANGED_VERSION=2\n')]);
    fetcher.setBody(changedSource.id, changedV2);

    const outboxBeforeBySource = new Map<string, number>();
    for (const source of activeSources) {
      outboxBeforeBySource.set(
        source.id,
        await count(pool, 'SELECT count(*)::text AS count FROM artifact_processing_outbox WHERE source_id=$1', [source.id]),
      );
    }
    const changedResult = await ingestion.ingest(changedSource.id);
    const outboxAfterBySource = new Map<string, number>();
    for (const source of activeSources) {
      outboxAfterBySource.set(
        source.id,
        await count(pool, 'SELECT count(*)::text AS count FROM artifact_processing_outbox WHERE source_id=$1', [source.id]),
      );
    }
    const downstreamAffected = activeSources
      .filter((source) => outboxAfterBySource.get(source.id)! > outboxBeforeBySource.get(source.id)!)
      .map((source) => source.source_key);
    if (changedResult.outcome !== 'FETCHED') failures.push(`changed artifact outcome was ${changedResult.outcome}, expected FETCHED`);
    if (downstreamAffected.length !== 1 || downstreamAffected[0] !== changedSource.source_key) {
      failures.push(`changed artifact affected unexpected downstream sources: ${downstreamAffected.join(', ')}`);
    }

    const failedSource = activeSources.find(
      (source) => source.terc === '3209042' && source.data_type === 'COLLECTION_SCHEDULE',
    ) ?? activeSources.find((source) => source.id !== changedSource.id) ?? changedSource;
    const failedBefore = await registry.getSourceById(failedSource.id);
    const publishedEventsBeforeFailure = await count(
      pool,
      `SELECT count(*)::text AS count
       FROM collection_events ce
       JOIN source_artifacts a ON a.id = ce.source_artifact_id
       WHERE a.source_id = $1 AND a.status = 'PUBLISHED' AND ce.valid_to IS NULL`,
      [failedSource.id],
    );
    const publishedArtifactsBeforeFailure = await count(
      pool,
      `SELECT count(*)::text AS count FROM source_artifacts WHERE source_id=$1 AND status='PUBLISHED'`,
      [failedSource.id],
    );
    fetcher.setFailure(failedSource.id, true);
    let simulatedFailure: string | null = null;
    try {
      await ingestion.ingest(failedSource.id);
      failures.push('simulated failed source unexpectedly succeeded');
    } catch (error) {
      simulatedFailure = error instanceof Error ? error.message : String(error);
    }
    const failedAfter = await registry.getSourceById(failedSource.id);
    const publishedEventsAfterFailure = await count(
      pool,
      `SELECT count(*)::text AS count
       FROM collection_events ce
       JOIN source_artifacts a ON a.id = ce.source_artifact_id
       WHERE a.source_id = $1 AND a.status = 'PUBLISHED' AND ce.valid_to IS NULL`,
      [failedSource.id],
    );
    const publishedArtifactsAfterFailure = await count(
      pool,
      `SELECT count(*)::text AS count FROM source_artifacts WHERE source_id=$1 AND status='PUBLISHED'`,
      [failedSource.id],
    );
    if (failedAfter?.healthStatus !== 'FETCH_FAILED') failures.push('failed source is not visible as FETCH_FAILED in health state');
    if (failedAfter?.lastSha256 !== failedBefore?.lastSha256) failures.push('failed fetch overwrote last known good source hash');
    if (publishedEventsAfterFailure !== publishedEventsBeforeFailure) failures.push('failed fetch changed last known good published collection events');
    if (publishedArtifactsAfterFailure !== publishedArtifactsBeforeFailure) failures.push('failed fetch changed last known good published artifacts');

    const duplicateFacilities = await pool.query<{ canonical_key: string; count: string }>(
      `SELECT canonical_key, count(*)::text AS count
       FROM facilities
       WHERE active=true AND canonical_key IS NOT NULL
       GROUP BY canonical_key HAVING count(*) > 1
       ORDER BY canonical_key`,
    );
    const duplicateEvents = await pool.query<{ service_area_id: string; fraction_code: string; collection_date: string; count: string }>(
      `SELECT service_area_id, fraction_code, collection_date::text, count(*)::text AS count
       FROM collection_events
       WHERE valid_to IS NULL
       GROUP BY service_area_id, fraction_code, collection_date
       HAVING count(*) > 1
       ORDER BY service_area_id, collection_date, fraction_code`,
    );
    if (duplicateFacilities.rows.length) failures.push(`duplicate canonical facilities found: ${duplicateFacilities.rows.length}`);
    if (duplicateEvents.rows.length) failures.push(`duplicate active collection events found: ${duplicateEvents.rows.length}`);

    const reviewCountsResult = await pool.query<ReviewCountRow>(
      `SELECT kind, state, count(*)::text AS count FROM (
         SELECT 'RECONCILIATION'::text AS kind, state FROM facility_reconciliation_reviews
         UNION ALL
         SELECT 'DATA_QUALITY'::text AS kind, state FROM facility_data_quality_reviews
       ) reviews
       GROUP BY kind, state ORDER BY kind, state`,
    );

    sources = await manifestSources(pool);
    const waitingBundles = sources
      .filter((source) => source.active && source.health_status === 'WAITING_FOR_COMPANION')
      .map((source) => ({
        sourceKey: source.source_key,
        terc: source.terc,
        bundleKey: source.bundle_key,
        bundleRole: source.bundle_role,
        requiredRoles: source.bundle_required_roles,
        freshnessMinutes: source.bundle_freshness_minutes,
      }));
    if (waitingBundles.length > 0) {
      failures.push(`active bundle sources still waiting for companion: ${waitingBundles.map((item) => item.sourceKey).join(', ')}`);
    }

    const staleSources = sources
      .filter((source) => {
        if (!source.active) return false;
        if (!source.last_success_at) return true;
        return asOf.getTime() - source.last_success_at.getTime() > source.poll_interval_minutes * 2 * 60_000;
      })
      .map((source) => ({
        sourceKey: source.source_key,
        terc: source.terc,
        dataType: source.data_type,
        healthStatus: source.health_status,
        lastSuccessAt: source.last_success_at?.toISOString() ?? null,
        lastFailureAt: source.last_failure_at?.toISOString() ?? null,
        nextCheckAt: source.next_check_at?.toISOString() ?? null,
      }));

    const scheduleGolden = await readGolden(scheduleGoldenPath, 'collection');
    const facilityGolden = await readGolden(facilityGoldenPath, 'facility');
    if (scheduleGolden.correctness < 0.99) failures.push(`collection golden correctness below 99%: ${scheduleGolden.correctness}`);
    if (facilityGolden.correctness < 0.99) failures.push(`facility golden correctness below 99%: ${facilityGolden.correctness}`);

    const currentChangedSource = await registry.getSourceById(changedSource.id);
    report = {
      gateVersion: '0.2.0',
      manifest: {
        id: manifest.manifestId,
        version: manifest.version,
        municipalities: syncResult.municipalityCount,
        sources: syncResult.sourceCount,
        active: syncResult.activeCount,
        planned: syncResult.plannedCount,
      },
      generatedAt: new Date().toISOString(),
      status: failures.length === 0 ? 'PASS' : 'FAIL',
      referenceImport: {
        runId: referenceImport.runId,
        inserted: referenceImport.inserted,
        updated: referenceImport.updated,
        unchanged: referenceImport.unchanged,
        rejected: referenceImport.rejected,
      },
      coverage,
      bundleHealth: {
        configured: [...bundleGroups.entries()].map(([key, members]) => ({
          key,
          memberSourceKeys: members.map((member) => member.source_key).sort(),
          roles: members.map((member) => member.bundle_role).sort(),
          requiredRoles: members[0]?.bundle_required_roles ?? [],
          freshnessMinutes: members[0]?.bundle_freshness_minutes ?? null,
        })),
        waiting: waitingBundles,
      },
      deterministicIngestion: {
        activeSourceKeys: activeSources.map((source) => source.source_key),
        artifactsBefore,
        artifactsAfterRun1,
        artifactsAfterRun2,
        run1: run1.map((result) => ({ sourceId: result.sourceId, outcome: result.outcome, artifactId: result.artifactId, sha256: result.sha256 })),
        run2: run2.map((result) => ({ sourceId: result.sourceId, outcome: result.outcome, artifactId: result.artifactId, sha256: result.sha256 })),
        unchangedSecondRunCreatedArtifacts: artifactsAfterRun2 - artifactsAfterRun1,
      },
      changedArtifact: {
        sourceKey: changedSource.source_key,
        previousSha256: previousChangedSource?.lastSha256 ?? null,
        newSha256: currentChangedSource?.lastSha256 ?? null,
        artifactId: changedResult.artifactId,
        outcome: changedResult.outcome,
        downstreamAffectedSourceKeys: downstreamAffected,
      },
      failedSource: {
        sourceKey: failedSource.source_key,
        simulatedError: simulatedFailure,
        healthStatus: failedAfter?.healthStatus ?? null,
        consecutiveFailures: failedAfter?.consecutiveFailures ?? null,
        lastSha256Before: failedBefore?.lastSha256 ?? null,
        lastSha256After: failedAfter?.lastSha256 ?? null,
        publishedEventsBefore: publishedEventsBeforeFailure,
        publishedEventsAfter: publishedEventsAfterFailure,
        publishedArtifactsBefore: publishedArtifactsBeforeFailure,
        publishedArtifactsAfter: publishedArtifactsAfterFailure,
      },
      integrity: {
        duplicateCanonicalFacilities: duplicateFacilities.rows,
        duplicateActiveCollectionEvents: duplicateEvents.rows,
      },
      reviews: reviewCountsResult.rows.map((row) => ({ kind: row.kind, state: row.state, count: Number(row.count) })),
      staleSources,
      sourceHealth: sources.map((source) => ({
        sourceKey: source.source_key,
        terc: source.terc,
        dataType: source.data_type,
        manifestStatus: source.manifest_status,
        active: source.active,
        healthStatus: source.health_status,
        consecutiveFailures: Number(source.consecutive_failures),
        lastSuccessAt: source.last_success_at?.toISOString() ?? null,
        lastFailureAt: source.last_failure_at?.toISOString() ?? null,
        lastErrorCode: source.last_error_code,
        bundleKey: source.bundle_key,
        bundleRole: source.bundle_role,
        bundleRequiredRoles: source.bundle_required_roles,
        bundleFreshnessMinutes: source.bundle_freshness_minutes,
      })),
      goldenGates: {
        collection: scheduleGolden,
        facilities: facilityGolden,
      },
      failures,
    };
  } catch (error) {
    failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
    report = { ...report, status: 'FAIL', failures };
  } finally {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await pool.end();
  }

  if (failures.length > 0) {
    console.error(`Pilot readiness gate FAILED:\n${JSON.stringify(report, null, 2)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Pilot readiness gate PASS:\n${JSON.stringify(report, null, 2)}`);
}

await main();
