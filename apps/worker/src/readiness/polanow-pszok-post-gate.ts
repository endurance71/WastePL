import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg, { type QueryResultRow } from 'pg';
import { processArtifactJob } from '../ingestion/artifact-processing.js';
import { MinioArtifactStore } from '../ingestion/artifact-store.js';
import { sha256Hex } from '../ingestion/hash.js';
import { PgSourceRegistry } from '../ingestion/source-registry.js';
import { createArtifactRuntimeProcessor } from '../main.js';
import { PgSourceManifestSync } from '../manifests/source-manifest-sync.js';
import type { SourceManifest } from '../manifests/source-manifest.js';

const { Pool } = pg;
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const manifestPath = resolve(repoRoot, 'manifests/pilot-koszalin-region-2026.11.json');
const fixturePath = resolve(repoRoot, 'apps/worker/test/fixtures/polanow-pszok.html');
const SOURCE_KEY = 'polanow-pszok';
const POLANOW_TERC = '3209063';
const FACILITY_KEY = 'pl-3209063-pszok-polanow-stawna-2';

interface CountRow extends QueryResultRow { count: string }

function gateDatabaseUrl(): string {
  if (process.env.PRODUCTION_GATE_DATABASE_URL) return process.env.PRODUCTION_GATE_DATABASE_URL;
  const base = new URL(
    process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  );
  base.pathname = '/wastepl_production_gate';
  return base.toString();
}

async function scalarCount(
  pool: InstanceType<typeof Pool>,
  sql: string,
  values: unknown[] = [],
): Promise<number> {
  const result = await pool.query<CountRow>(sql, values);
  return Number(result.rows[0]?.count ?? 0);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: gateDatabaseUrl() });
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>;
  try {
    if (report.runtimeStatus !== 'PASS') {
      throw new Error('Base production runtime must pass before Polanów PSZOK 2026.11 post-gate');
    }

    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SourceManifest;
    const manifestSync = await new PgSourceManifestSync(pool).sync(manifest, new Date('2026-09-03T20:00:00.000Z'));
    if (manifestSync.version !== '2026.11' || manifestSync.activeCount !== 15) {
      throw new Error(`Unexpected 2026.11 manifest sync: ${JSON.stringify(manifestSync)}`);
    }

    const source = await pool.query<{
      id: string;
      active: boolean;
      parser_key: string | null;
      source_url: string;
      manifest_version: string | null;
      health_status: string;
    } & QueryResultRow>(
      `SELECT s.id, s.active, s.parser_key, s.source_url, s.manifest_version, s.health_status
       FROM sources s
       JOIN municipalities m ON m.id=s.municipality_id
       WHERE s.source_key=$1 AND m.terc=$2`,
      [SOURCE_KEY, POLANOW_TERC],
    );
    const sourceRow = source.rows[0];
    if (!sourceRow || !sourceRow.active || sourceRow.parser_key !== 'municipal-pszok-html') {
      throw new Error(`ACTIVE Polanów PSZOK source missing after manifest sync: ${JSON.stringify(sourceRow ?? null)}`);
    }
    if (sourceRow.manifest_version !== 'pilot-koszalin-region@2026.11') {
      throw new Error(`Unexpected Polanów PSZOK manifest provenance ${sourceRow.manifest_version}`);
    }

    const collectionProtection = await pool.query<{
      garbno_active: string;
      parent_planned: string;
    } & QueryResultRow>(
      `SELECT
         count(*) FILTER (WHERE s.source_key='polanow-collection-garbno-h2-2026' AND s.active=true AND s.manifest_status='ACTIVE')::text AS garbno_active,
         count(*) FILTER (WHERE s.source_key='polanow-collection-2026' AND s.active=false AND s.manifest_status='PLANNED')::text AS parent_planned
       FROM sources s
       JOIN municipalities m ON m.id=s.municipality_id
       WHERE m.terc=$1`,
      [POLANOW_TERC],
    );
    if (collectionProtection.rows[0]?.garbno_active !== '1' || collectionProtection.rows[0]?.parent_planned !== '1') {
      throw new Error(`Polanów collection scope changed during PSZOK rollout: ${JSON.stringify(collectionProtection.rows[0] ?? null)}`);
    }

    const body = await readFile(fixturePath);
    const hash = sha256Hex(body);
    const store = new MinioArtifactStore();
    const stored = await store.putIfAbsent({
      sourceId: sourceRow.id,
      sha256: hash,
      body,
      contentType: 'text/html; charset=utf-8',
    });
    const registry = new PgSourceRegistry(pool);
    const inserted = await registry.insertArtifact({
      sourceId: sourceRow.id,
      retrievedAt: new Date('2026-09-03T20:00:00.000Z'),
      sha256: hash,
      storageUri: stored.uri,
      parserKey: 'municipal-pszok-html',
    });
    const artifactId = inserted.artifact.id;
    const processor = createArtifactRuntimeProcessor(pool);

    const firstOutcome = await processArtifactJob(registry, processor, {
      sourceId: sourceRow.id,
      artifactId,
      parserKey: 'municipal-pszok-html',
    });
    if (firstOutcome !== 'PUBLISHED') throw new Error(`Polanów first import returned ${firstOutcome}`);

    const canonical = await pool.query<{
      id: string;
      canonical_key: string;
      address: string;
      geom_is_null: boolean;
      accepted_materials: string[];
      source_artifact_id: string | null;
      hours_source_artifact_id: string | null;
      access_source_artifact_id: string | null;
      verification_status: string;
    } & QueryResultRow>(
      `SELECT id, canonical_key, address_text AS address, geom IS NULL AS geom_is_null, accepted_materials,
              source_artifact_id, hours_source_artifact_id, access_source_artifact_id,
              verification_status
       FROM facilities WHERE canonical_key=$1`,
      [FACILITY_KEY],
    );
    const facility = canonical.rows[0];
    if (!facility) throw new Error('Polanów canonical PSZOK was not published');
    if (
      facility.address !== 'ul. Stawna 2, 76-010 Polanów' ||
      facility.geom_is_null !== true ||
      facility.source_artifact_id !== artifactId ||
      facility.hours_source_artifact_id !== artifactId ||
      facility.access_source_artifact_id !== artifactId ||
      facility.verification_status !== 'OFFICIAL_SOURCE'
    ) {
      throw new Error(`Polanów canonical provenance drift: ${JSON.stringify(facility)}`);
    }
    const expectedMaterials = [
      'BULKY',
      'CONSTRUCTION',
      'HAZARDOUS',
      'MEDICINES',
      'BATTERIES',
      'ELECTRONICS',
      'TYRES',
      'PAPER',
      'METALS_PLASTICS',
      'GLASS',
    ];
    if (JSON.stringify(facility.accepted_materials) !== JSON.stringify(expectedMaterials)) {
      throw new Error(`Polanów accepted materials drift: ${JSON.stringify(facility.accepted_materials)}`);
    }

    const artifact = await pool.query<{
      status: string;
      parser_key: string | null;
      parser_version: string | null;
      extraction_confidence: string | number | null;
    } & QueryResultRow>(
      `SELECT status, parser_key, parser_version, extraction_confidence
       FROM source_artifacts WHERE id=$1`,
      [artifactId],
    );
    const artifactRow = artifact.rows[0];
    if (!artifactRow || artifactRow.status !== 'PUBLISHED' || artifactRow.parser_key !== 'municipal-pszok-html' || artifactRow.parser_version !== '0.3.0') {
      throw new Error(`Unexpected Polanów artifact parse state: ${JSON.stringify(artifactRow ?? null)}`);
    }

    const assertionCount = await scalarCount(
      pool,
      `SELECT count(*)::text AS count FROM facility_source_assertions
       WHERE facility_id=$1 AND source_artifact_id=$2 AND source_key=$3`,
      [facility.id, artifactId, SOURCE_KEY],
    );
    if (assertionCount !== 1) throw new Error(`Expected one Polanów provenance assertion, got ${assertionCount}`);

    const replayOutcome = await processArtifactJob(registry, processor, {
      sourceId: sourceRow.id,
      artifactId,
      parserKey: 'municipal-pszok-html',
    });
    if (replayOutcome !== 'PUBLISHED') throw new Error(`Polanów replay returned ${replayOutcome}`);
    const duplicateFacilities = await scalarCount(pool, `SELECT count(*)::text AS count FROM facilities WHERE canonical_key=$1`, [FACILITY_KEY]);
    const duplicateAssertions = await scalarCount(
      pool,
      `SELECT count(*)::text AS count FROM facility_source_assertions
       WHERE facility_id=$1 AND source_artifact_id=$2`,
      [facility.id, artifactId],
    );
    if (duplicateFacilities !== 1 || duplicateAssertions !== 1) {
      throw new Error(`Polanów replay is not idempotent: facilities=${duplicateFacilities}, assertions=${duplicateAssertions}`);
    }

    const health = await pool.query<{ health_status: string } & QueryResultRow>(
      `SELECT health_status FROM sources WHERE id=$1`,
      [sourceRow.id],
    );
    if (health.rows[0]?.health_status !== 'HEALTHY') {
      throw new Error(`Polanów source health is ${health.rows[0]?.health_status ?? 'missing'}`);
    }

    report.polanowPszok2026_11PostCheck = {
      status: 'PASS',
      manifest: 'pilot-koszalin-region@2026.11',
      activeSources: manifestSync.activeCount,
      sourceKey: SOURCE_KEY,
      facilityKey: FACILITY_KEY,
      firstImport: firstOutcome,
      replay: replayOutcome,
      parserKey: artifactRow.parser_key,
      parserVersion: artifactRow.parser_version,
      extractionConfidence: Number(artifactRow.extraction_confidence),
      geometryIntentionallyNull: true,
      provenanceAssertions: assertionCount,
      sourceHealth: health.rows[0]?.health_status,
      collectionStillActive: true,
      pszokCoverageMilestone: '6/8 MUNICIPALITIES WITH ACTIVE PSZOK',
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('Polanów PSZOK 2026.11 post-gate PASS: first import + replay + provenance (6/8 PSZOK active)');
  } catch (error) {
    report.polanowPszok2026_11PostCheck = {
      status: 'FAIL',
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
    };
    report.status = 'FAIL';
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
