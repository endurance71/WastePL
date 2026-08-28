import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg, { type QueryResultRow } from 'pg';
import rolloutManifestJson from '../../../../manifests/pilot-koszalin-region-2026.2.json' with { type: 'json' };
import { processArtifactJob } from '../ingestion/artifact-processing.js';
import { MinioArtifactStore } from '../ingestion/artifact-store.js';
import { SourceFetchError } from '../ingestion/http-source-fetcher.js';
import { SourceIngestionService } from '../ingestion/source-ingestion-service.js';
import { PgSourceRegistry } from '../ingestion/source-registry.js';
import type { FetchedSource, SourceFetcher, SourceRecord } from '../ingestion/types.js';
import { createArtifactRuntimeProcessor } from '../main.js';
import { PgSourceManifestSync } from '../manifests/source-manifest-sync.js';
import { parseSourceManifest, type SourceManifest } from '../manifests/source-manifest.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for the 2026.2 readiness gate');

const manifest = parseSourceManifest(rolloutManifestJson) as SourceManifest;
const asOf = new Date('2026-08-28T10:30:00.000Z');
const reportPath = fileURLToPath(
  new URL('../../test-results/pilot-readiness-2026.2-report.json', import.meta.url),
);
const fixtureRoot = new URL('../../test/fixtures/', import.meta.url);

const NEW_ACTIVE = [
  {
    sourceKey: 'bobolice-pszok',
    terc: '3209033',
    fixture: 'bobolice-pszok.html',
    canonicalKey: 'pl-3209033-pszok-boboliczki',
  },
  {
    sourceKey: 'swieszyno-pszok',
    terc: '3209082',
    fixture: 'swieszyno-pszok.html',
    canonicalKey: 'pl-3209082-pszok-chalupy-13b',
  },
] as const;

const REQUIRED_BLOCKED_SCHEDULES = [
  'bobolice-collection-2026',
  'sianow-collection-2026-h2',
  'swieszyno-collection-2026',
  'bedzino-collection-2026-h2',
  'polanow-collection-2026',
  'tychowo-collection-2026',
] as const;

interface SourceRow extends QueryResultRow {
  id: string;
  source_key: string;
  terc: string;
  data_type: string;
  parser_key: string | null;
  manifest_status: string;
  active: boolean;
  health_status: string;
  activation_blocker: string | null;
  source_shape: string | null;
  evidence_status: string | null;
}

interface FacilityRow extends QueryResultRow {
  canonical_key: string;
  source_artifact_id: string | null;
  geom_is_null: boolean;
  active: boolean;
}

class RolloutFetcher implements SourceFetcher {
  private readonly bodies = new Map<string, Buffer>();
  private readonly failures = new Set<string>();
  private tick = 0;

  setBody(sourceId: string, body: Buffer): void {
    this.bodies.set(sourceId, body);
  }

  setFailure(sourceId: string, failed: boolean): void {
    if (failed) this.failures.add(sourceId);
    else this.failures.delete(sourceId);
  }

  async fetch(source: SourceRecord): Promise<FetchedSource> {
    this.tick += 1;
    if (this.failures.has(source.id)) {
      throw new SourceFetchError({
        message: '2026.2 readiness simulated source outage',
        attempts: 1,
        status: 503,
        code: 'READINESS_2026_2_SIMULATED_FAILURE',
        retryable: true,
      });
    }
    const body = this.bodies.get(source.id);
    if (!body) throw new Error(`No rollout fixture configured for source ${source.id}`);
    return {
      status: 200,
      notModified: false,
      body,
      etag: `"rollout-${source.id}-${body.length}"`,
      lastModified: 'Fri, 28 Aug 2026 10:30:00 GMT',
      contentType: 'text/html; charset=utf-8',
      finalUrl: source.sourceUrl,
      attempts: 1,
      retrievedAt: new Date(asOf.getTime() + this.tick * 1000),
    };
  }
}

async function manifestRows(pool: InstanceType<typeof Pool>): Promise<SourceRow[]> {
  return (
    await pool.query<SourceRow>(
      `SELECT s.id, s.source_key, m.terc, s.data_type, s.parser_key,
              s.manifest_status, s.active, s.health_status,
              s.activation_blocker, s.source_shape, s.evidence_status
       FROM sources s
       JOIN municipalities m ON m.id = s.municipality_id
       WHERE s.manifest_version = $1
       ORDER BY s.source_key`,
      [`${manifest.manifestId}@${manifest.version}`],
    )
  ).rows;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const failures: string[] = [];
  const artifactIds = new Map<string, string>();
  let report: Record<string, unknown> = {
    gateVersion: '2026.2-v1',
    manifest: { id: manifest.manifestId, version: manifest.version },
    generatedAt: new Date().toISOString(),
    status: 'FAIL',
  };

  try {
    const sync = new PgSourceManifestSync(pool);
    const syncResult = await sync.sync(manifest, asOf);
    if (syncResult.municipalityCount !== 8) failures.push(`expected 8 municipalities, got ${syncResult.municipalityCount}`);
    if (syncResult.sourceCount !== 13) failures.push(`expected 13 source identities, got ${syncResult.sourceCount}`);
    if (syncResult.activeCount !== 6) failures.push(`expected 6 ACTIVE sources, got ${syncResult.activeCount}`);
    if (syncResult.plannedCount !== 7) failures.push(`expected 7 PLANNED sources, got ${syncResult.plannedCount}`);

    let sources = await manifestRows(pool);
    const activeScheduleTercs = [...new Set(
      sources
        .filter((source) => source.data_type === 'COLLECTION_SCHEDULE' && source.active)
        .map((source) => source.terc),
    )].sort();
    if (activeScheduleTercs.join('|') !== ['3209042', '3261011'].join('|')) {
      failures.push(`schedule coverage changed unexpectedly: ${activeScheduleTercs.join(', ')}`);
    }

    for (const key of REQUIRED_BLOCKED_SCHEDULES) {
      const source = sources.find((row) => row.source_key === key);
      if (!source) {
        failures.push(`blocked source ${key} missing from registry`);
        continue;
      }
      if (source.active || source.manifest_status !== 'PLANNED' || source.parser_key !== null) {
        failures.push(`blocked source ${key} became schedulable`);
      }
      if (!source.activation_blocker) failures.push(`blocked source ${key} has no activation_blocker`);
    }

    const fetcher = new RolloutFetcher();
    const registry = new PgSourceRegistry(pool);
    const ingestion = new SourceIngestionService(registry, new MinioArtifactStore(), fetcher);
    const processor = createArtifactRuntimeProcessor(pool);
    const publicationResults: Array<Record<string, unknown>> = [];

    for (const profile of NEW_ACTIVE) {
      const source = sources.find((row) => row.source_key === profile.sourceKey);
      if (!source) {
        failures.push(`new ACTIVE source ${profile.sourceKey} missing from registry`);
        continue;
      }
      if (
        source.terc !== profile.terc
        || source.parser_key !== 'municipal-pszok-html'
        || !source.active
        || source.manifest_status !== 'ACTIVE'
        || source.source_shape !== 'DIRECT_CONTENT'
        || source.evidence_status !== 'VERIFIED'
        || source.activation_blocker !== null
      ) {
        failures.push(`new ACTIVE source ${profile.sourceKey} has invalid rollout metadata`);
        continue;
      }

      const fixture = await readFile(new URL(profile.fixture, fixtureRoot));
      const bodyV1 = Buffer.concat([
        fixture,
        Buffer.from(`\n<!-- wastepl-readiness-2026.2:${profile.sourceKey}:v1 -->\n`),
      ]);
      fetcher.setBody(source.id, bodyV1);
      const first = await ingestion.ingest(source.id);
      if (first.outcome !== 'FETCHED' || !first.artifactId) {
        failures.push(`${profile.sourceKey} initial ingestion was ${first.outcome}`);
        continue;
      }
      artifactIds.set(profile.sourceKey, first.artifactId);
      const firstProcess = await processArtifactJob(registry, processor, {
        sourceId: source.id,
        artifactId: first.artifactId,
        parserKey: 'municipal-pszok-html',
      });
      if (firstProcess !== 'PUBLISHED') failures.push(`${profile.sourceKey} initial processing was ${firstProcess}`);

      const canonicalV1 = await pool.query<FacilityRow>(
        `SELECT canonical_key, source_artifact_id, geom IS NULL AS geom_is_null, active
         FROM facilities WHERE canonical_key=$1`,
        [profile.canonicalKey],
      );
      if (canonicalV1.rows.length !== 1) {
        failures.push(`${profile.sourceKey} canonical count after initial publish is ${canonicalV1.rows.length}`);
      } else {
        const canonical = canonicalV1.rows[0]!;
        if (canonical.source_artifact_id !== first.artifactId) failures.push(`${profile.sourceKey} canonical provenance does not point to initial artifact`);
        if (!canonical.geom_is_null) failures.push(`${profile.sourceKey} unexpectedly fabricated geometry`);
        if (!canonical.active) failures.push(`${profile.sourceKey} canonical facility is inactive`);
      }

      const replay = await processArtifactJob(registry, processor, {
        sourceId: source.id,
        artifactId: first.artifactId,
        parserKey: 'municipal-pszok-html',
      });
      if (replay !== 'PUBLISHED') failures.push(`${profile.sourceKey} replay was ${replay}`);

      const bodyV2 = Buffer.concat([
        fixture,
        Buffer.from(`\n<!-- wastepl-readiness-2026.2:${profile.sourceKey}:v2 -->\n`),
      ]);
      fetcher.setBody(source.id, bodyV2);
      const changed = await ingestion.ingest(source.id);
      if (changed.outcome !== 'FETCHED' || !changed.artifactId || changed.artifactId === first.artifactId) {
        failures.push(`${profile.sourceKey} changed artifact did not create a new immutable version`);
        continue;
      }
      artifactIds.set(`${profile.sourceKey}:v2`, changed.artifactId);
      const changedProcess = await processArtifactJob(registry, processor, {
        sourceId: source.id,
        artifactId: changed.artifactId,
        parserKey: 'municipal-pszok-html',
      });
      if (changedProcess !== 'PUBLISHED') failures.push(`${profile.sourceKey} changed processing was ${changedProcess}`);

      const canonicalV2 = await pool.query<FacilityRow>(
        `SELECT canonical_key, source_artifact_id, geom IS NULL AS geom_is_null, active
         FROM facilities WHERE canonical_key=$1`,
        [profile.canonicalKey],
      );
      if (canonicalV2.rows.length !== 1 || canonicalV2.rows[0]?.source_artifact_id !== changed.artifactId) {
        failures.push(`${profile.sourceKey} canonical replacement did not move to changed artifact`);
      }

      fetcher.setFailure(source.id, true);
      let simulatedFailure: string | null = null;
      try {
        await ingestion.ingest(source.id);
        failures.push(`${profile.sourceKey} simulated outage unexpectedly succeeded`);
      } catch (error) {
        simulatedFailure = error instanceof Error ? error.message : String(error);
      }
      const afterFailure = await registry.getSourceById(source.id);
      const retained = await pool.query<FacilityRow>(
        `SELECT canonical_key, source_artifact_id, geom IS NULL AS geom_is_null, active
         FROM facilities WHERE canonical_key=$1`,
        [profile.canonicalKey],
      );
      if (afterFailure?.healthStatus !== 'FETCH_FAILED') failures.push(`${profile.sourceKey} simulated outage is not visible as FETCH_FAILED`);
      if (retained.rows.length !== 1 || retained.rows[0]?.source_artifact_id !== changed.artifactId) {
        failures.push(`${profile.sourceKey} simulated outage changed last-known-good canonical data`);
      }

      fetcher.setFailure(source.id, false);
      await processArtifactJob(registry, processor, {
        sourceId: source.id,
        artifactId: changed.artifactId,
        parserKey: 'municipal-pszok-html',
      });
      const recovered = await registry.getSourceById(source.id);
      if (recovered?.healthStatus !== 'HEALTHY') failures.push(`${profile.sourceKey} did not recover to HEALTHY after last-known-good replay`);

      publicationResults.push({
        sourceKey: profile.sourceKey,
        terc: profile.terc,
        canonicalKey: profile.canonicalKey,
        initialArtifactId: first.artifactId,
        changedArtifactId: changed.artifactId,
        simulatedFailure,
        finalHealth: recovered?.healthStatus ?? null,
        geometryPublished: retained.rows[0] ? !retained.rows[0].geom_is_null : null,
      });
    }

    sources = await manifestRows(pool);
    const municipalitiesWithActiveData = [...new Set(sources.filter((source) => source.active).map((source) => source.terc))].sort();
    const expectedActiveMunicipalities = ['3209033', '3209042', '3209082', '3261011'].sort();
    if (municipalitiesWithActiveData.join('|') !== expectedActiveMunicipalities.join('|')) {
      failures.push(`municipalities with ACTIVE data are ${municipalitiesWithActiveData.join(', ')}`);
    }

    const duplicateCanonical = await pool.query<{ canonical_key: string; count: string }>(
      `SELECT canonical_key, count(*)::text AS count
       FROM facilities
       WHERE canonical_key = ANY($1::text[])
       GROUP BY canonical_key
       HAVING count(*) > 1`,
      [NEW_ACTIVE.map((profile) => profile.canonicalKey)],
    );
    if (duplicateCanonical.rows.length > 0) failures.push('wave-2 created duplicate canonical facilities');

    report = {
      gateVersion: '2026.2-v1',
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
      scheduleCoverage: {
        activeMunicipalityCount: activeScheduleTercs.length,
        tercs: activeScheduleTercs,
      },
      activeDataCoverage: {
        municipalityCount: municipalitiesWithActiveData.length,
        tercs: municipalitiesWithActiveData,
      },
      newlyActivatedFacilities: publicationResults,
      plannedBlockers: sources
        .filter((source) => REQUIRED_BLOCKED_SCHEDULES.includes(source.source_key as (typeof REQUIRED_BLOCKED_SCHEDULES)[number]))
        .map((source) => ({
          sourceKey: source.source_key,
          terc: source.terc,
          blocker: source.activation_blocker,
          shape: source.source_shape,
          evidenceStatus: source.evidence_status,
        })),
      integrity: {
        duplicateCanonicalFacilities: duplicateCanonical.rows,
        noFabricatedGeometry: publicationResults.every((result) => result.geometryPublished === false),
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
    console.error(`Pilot readiness 2026.2 FAILED:\n${JSON.stringify(report, null, 2)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Pilot readiness 2026.2 PASS:\n${JSON.stringify(report, null, 2)}`);
}

await main();
