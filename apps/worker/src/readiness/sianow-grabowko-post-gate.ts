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
import { PgOfficialReferenceImporter } from '../reference/pg-reference-importer.js';
import {
  SIANOW_TERC,
  GRABOWKO_PRG_RESPONSE_SHA256,
  GRABOWKO_REAL_ADDRESS_COUNT,
  GRABOWKO_SERVICE_AREA,
  hydrateSianowGrabowkoReferenceBackbone,
  loadSianowGrabowkoReferenceSnapshot,
  sianowGrabowkoPrgRows,
} from './sianow-grabowko-reference.js';

const { Pool } = pg;
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const manifestPath = resolve(repoRoot, 'manifests/pilot-koszalin-region-2026.8.json');
const fixturePath = resolve(repoRoot, 'apps/worker/test/fixtures/pdf-text/sianow-dabrowa-grabowko-h2-2026.txt');
const SOURCE_KEY = 'sianow-collection-dabrowa-grabowko-safe-h2-2026';
const SOURCE_URL = 'https://sianow.pl/wp-content/uploads/2026/06/9-Dabrowa-i-Grabowko.pdf';
const LIVE_PDF_SHA256 = '618c62bcca3a374d78ecb8db1aa935cbae6fd08e7a280787245270327bf7b16c';
const RETRIEVED_AT = new Date('2026-09-03T12:00:00.000Z');

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
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SourceManifest;
    const manifestSync = await new PgSourceManifestSync(pool).sync(manifest, RETRIEVED_AT);
    if (manifestSync.version !== '2026.8' || manifestSync.activeCount !== 12) {
      throw new Error(`Unexpected 2026.8 manifest sync: ${JSON.stringify(manifestSync)}`);
    }

    const source = await pool.query<{
      id: string;
      active: boolean;
      parser_key: string | null;
      source_url: string;
      manifest_status: string | null;
      manifest_version: string | null;
      evidence_status: string | null;
      activation_blocker: string | null;
    } & QueryResultRow>(
      `SELECT s.id, s.active, s.parser_key, s.source_url, s.manifest_status,
              s.manifest_version, s.evidence_status, s.activation_blocker
       FROM sources s
       JOIN municipalities m ON m.id=s.municipality_id
       WHERE s.source_key=$1 AND m.terc=$2`,
      [SOURCE_KEY, SIANOW_TERC],
    );
    const sourceRow = source.rows[0];
    if (
      !sourceRow ||
      !sourceRow.active ||
      sourceRow.parser_key !== 'municipal-collection-pdf-text' ||
      sourceRow.source_url !== SOURCE_URL ||
      sourceRow.manifest_status !== 'ACTIVE' ||
      sourceRow.manifest_version !== 'pilot-koszalin-region@2026.8' ||
      sourceRow.evidence_status !== 'VERIFIED' ||
      sourceRow.activation_blocker !== null
    ) {
      throw new Error(`ACTIVE Sianów Grabówko source missing after manifest sync: ${JSON.stringify(sourceRow ?? null)}`);
    }

    const parent = await pool.query<{
      active: boolean;
      manifest_status: string | null;
      parser_key: string | null;
      source_url: string;
      evidence_status: string | null;
      activation_blocker: string | null;
    } & QueryResultRow>(
      `SELECT s.active, s.manifest_status, s.parser_key, s.source_url,
              s.evidence_status, s.activation_blocker
       FROM sources s
       JOIN municipalities m ON m.id=s.municipality_id
       WHERE s.source_key='sianow-collection-2026-h2' AND m.terc=$1`,
      [SIANOW_TERC],
    );
    const parentRow = parent.rows[0];
    if (
      !parentRow ||
      parentRow.active ||
      parentRow.manifest_status !== 'PLANNED' ||
      parentRow.parser_key !== null ||
      parentRow.evidence_status !== 'VERIFIED' ||
      parentRow.activation_blocker !== 'GENERIC_SEGREGATED_COLUMN_NOT_CANONICALLY_MAPPED'
    ) {
      throw new Error(`Sianów parent H2 source state drifted: ${JSON.stringify(parentRow ?? null)}`);
    }

    const snapshot = await loadSianowGrabowkoReferenceSnapshot();
    await hydrateSianowGrabowkoReferenceBackbone(pool);
    const referenceImport = await new PgOfficialReferenceImporter(pool).importPrgAddresses(
      sianowGrabowkoPrgRows(snapshot),
      {
        dataset: 'PRG_ADDRESS',
        sourceVersion: 'sianow-grabowko-2026-09-03',
        sourceUri: snapshot.source.uugUrl,
        sourceSha256: GRABOWKO_PRG_RESPONSE_SHA256,
        scopeKey: SIANOW_TERC,
        fullSnapshot: false,
        metadata: {
          locality: 'Grabówko',
          simc: snapshot.selection.simc,
          query: snapshot.source.query,
        },
      },
    );
    if (
      referenceImport.rejected !== 0 ||
      referenceImport.inserted + referenceImport.updated + referenceImport.unchanged !== GRABOWKO_REAL_ADDRESS_COUNT
    ) {
      throw new Error(`Grabówko PRG import failed: ${JSON.stringify(referenceImport)}`);
    }

    const body = await readFile(fixturePath);
    const fixtureSha256 = sha256Hex(body);
    const store = new MinioArtifactStore();
    const stored = await store.putIfAbsent({
      sourceId: sourceRow.id,
      sha256: fixtureSha256,
      body,
      contentType: 'text/plain; charset=utf-8',
    });
    const registry = new PgSourceRegistry(pool);
    const inserted = await registry.insertArtifact({
      sourceId: sourceRow.id,
      retrievedAt: RETRIEVED_AT,
      sha256: fixtureSha256,
      storageUri: stored.uri,
      parserKey: 'municipal-collection-pdf-text',
    });
    const artifactId = inserted.artifact.id;
    const processor = createArtifactRuntimeProcessor(pool);

    const firstOutcome = await processArtifactJob(registry, processor, {
      sourceId: sourceRow.id,
      artifactId,
      parserKey: 'municipal-collection-pdf-text',
    });
    if (firstOutcome !== 'PUBLISHED') {
      throw new Error(`Sianów Grabówko artifact processing returned ${firstOutcome}`);
    }

    const serviceArea = await pool.query<{
      id: string;
      external_key: string | null;
      building_type: string | null;
      active: boolean;
    } & QueryResultRow>(
      `SELECT id, external_key, building_type, active
       FROM service_areas
       WHERE external_key=$1`,
      [GRABOWKO_SERVICE_AREA],
    );
    const area = serviceArea.rows[0];
    if (!area || !area.active || area.external_key !== GRABOWKO_SERVICE_AREA || area.building_type !== 'SINGLE_FAMILY') {
      throw new Error(`Grabówko service area was not published deterministically: ${JSON.stringify(area ?? null)}`);
    }

    const eventCounts = await pool.query<{
      fraction: string;
      count: string;
    } & QueryResultRow>(
      `SELECT fraction_code AS fraction, count(*)::text AS count
       FROM collection_events
       WHERE service_area_id=$1 AND valid_to IS NULL
       GROUP BY fraction_code
       ORDER BY fraction_code`,
      [area.id],
    );
    const counts = Object.fromEntries(eventCounts.rows.map((row) => [row.fraction, Number(row.count)]));
    // 13 MIXED + 13 GLASS + 13 METALS_PLASTICS + 13 PAPER + 11 BIO + 1 BULKY = 64 total
    if (
      counts.MIXED !== 13 ||
      counts.BIO !== 11 ||
      counts.GLASS !== 13 ||
      counts.METALS_PLASTICS !== 13 ||
      counts.PAPER !== 13 ||
      counts.BULKY !== 1 ||
      Object.keys(counts).length !== 6
    ) {
      throw new Error(`Grabówko event counts drifted: ${JSON.stringify(counts)}`);
    }

    const ids = snapshot.addresses.map((address) => address.prgId);
    const activeAddresses = await scalarCount(
      pool,
      `SELECT count(*)::text AS count
       FROM addresses a
       JOIN municipalities m ON m.id=a.municipality_id
       WHERE m.terc=$1 AND a.active=true AND a.prg_id=ANY($2::text[])`,
      [SIANOW_TERC, ids],
    );
    if (activeAddresses !== GRABOWKO_REAL_ADDRESS_COUNT) {
      throw new Error(`Only ${activeAddresses}/${GRABOWKO_REAL_ADDRESS_COUNT} frozen Grabówko PRG addresses are active`);
    }

    const coverage = await pool.query<{
      prg_id: string;
      service_area_count: string;
      external_keys: string[];
    } & QueryResultRow>(
      `SELECT a.prg_id,
              count(DISTINCT sa.id)::text AS service_area_count,
              array_agg(DISTINCT sa.external_key ORDER BY sa.external_key) AS external_keys
       FROM addresses a
       JOIN service_area_rules sar ON sar.locality_id=a.locality_id AND sar.rule_type='LOCALITY'
       JOIN service_areas sa ON sa.id=sar.service_area_id AND sa.active=true
       WHERE a.prg_id=ANY($1::text[])
         AND a.active=true
         AND EXISTS (
           SELECT 1 FROM collection_events ce
           WHERE ce.service_area_id=sa.id AND ce.valid_to IS NULL
         )
       GROUP BY a.prg_id
       ORDER BY a.prg_id`,
      [ids],
    );
    const missing = ids.filter((id) => !coverage.rows.some((row) => row.prg_id === id));
    const ambiguous = coverage.rows.filter(
      (row) => Number(row.service_area_count) !== 1 || row.external_keys.length !== 1 || row.external_keys[0] !== GRABOWKO_SERVICE_AREA,
    );
    if (missing.length > 0 || ambiguous.length > 0 || coverage.rows.length !== GRABOWKO_REAL_ADDRESS_COUNT) {
      throw new Error(
        `Grabówko deterministic coverage failed: missing=${JSON.stringify(missing)}, ambiguous=${JSON.stringify(ambiguous)}`,
      );
    }

    const activeCollectionMunicipalities = await scalarCount(
      pool,
      `SELECT count(DISTINCT m.id)
       FROM municipalities m
       JOIN service_areas sa ON sa.municipality_id=m.id
       JOIN collection_events ce ON ce.service_area_id=sa.id
       WHERE sa.active=true AND ce.valid_to IS NULL`,
    );
    // Progress: Koszalin, Polanów, Manowo, Tychowo, Będzino, Sianów = 6/8 municipalities!
    if (activeCollectionMunicipalities !== 6) {
      throw new Error(`Expected exactly 6 municipalities with active collection schedules, got ${activeCollectionMunicipalities}`);
    }

    report.sianowGrabowko2026_8PostCheck = {
      status: 'PASS',
      verifiedAt: new Date().toISOString(),
      manifestVersion: '2026.8',
      sourceKey: SOURCE_KEY,
      sourceUrl: SOURCE_URL,
      livePdfSha256: LIVE_PDF_SHA256,
      deterministicFixtureSha256: fixtureSha256,
      serviceAreaKey: GRABOWKO_SERVICE_AREA,
      realAddressesInLocality: GRABOWKO_REAL_ADDRESS_COUNT,
      realAddressesWithCoverage: coverage.rows.length,
      collectionEventsPublished: 64,
      fractions: {
        mixed: counts.MIXED,
        glass: counts.GLASS,
        metalsPlastics: counts.METALS_PLASTICS,
        paper: counts.PAPER,
        bio: counts.BIO,
        bulky: counts.BULKY,
      },
      pilotCollectionMunicipalityProgress: `${activeCollectionMunicipalities}/8`,
    };

    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`[PASS] Sianów Grabówko safe subset gate passed: ${GRABOWKO_REAL_ADDRESS_COUNT}/${GRABOWKO_REAL_ADDRESS_COUNT} addresses covered, 64 events, pilot collection coverage ${activeCollectionMunicipalities}/8.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[FAIL] Sianów Grabówko safe subset gate failed:', err);
  process.exit(1);
});
