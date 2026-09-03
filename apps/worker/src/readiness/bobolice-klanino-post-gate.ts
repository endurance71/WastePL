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
  BOBOLICE_TERC,
  KLANINO_PRG_RESPONSE_SHA256,
  KLANINO_REAL_ADDRESS_COUNT,
  KLANINO_SERVICE_AREA,
  hydrateBoboliceKlaninoReferenceBackbone,
  loadBoboliceKlaninoReferenceSnapshot,
  boboliceKlaninoPrgRows,
} from './bobolice-klanino-reference.js';

const { Pool } = pg;
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const manifestPath = resolve(repoRoot, 'manifests/pilot-koszalin-region-2026.10.json');
const fixturePath = resolve(repoRoot, 'apps/worker/test/fixtures/pdf-text/bobolice-klanino-h2-2026.txt');
const SOURCE_KEY = 'bobolice-collection-klanino-safe-h2-2026';
const SOURCE_URL =
  'https://cms-v2-files.idcom-jst.pl/sites/52/cms/szablony/5169/zdjecia/orign/2a2130e07b8640d995b493f4bca53e20ej2pjkevuej9bq1k-6.jpg';
const LIVE_IMAGE_SHA256 = '3b91671c01a63d7dc7bd6eed37c82a02e0246a6c3407e095a6c7a7d6e597d5c2';
const RETRIEVED_AT = new Date('2026-09-03T15:00:00.000Z');

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
    if (manifestSync.version !== '2026.10' || manifestSync.activeCount !== 14) {
      throw new Error(`Unexpected 2026.10 manifest sync: ${JSON.stringify(manifestSync)}`);
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
      [SOURCE_KEY, BOBOLICE_TERC],
    );
    const sourceRow = source.rows[0];
    if (
      !sourceRow ||
      !sourceRow.active ||
      sourceRow.parser_key !== 'municipal-collection-pdf-text' ||
      sourceRow.source_url !== SOURCE_URL ||
      sourceRow.manifest_status !== 'ACTIVE' ||
      sourceRow.manifest_version !== 'pilot-koszalin-region@2026.10' ||
      sourceRow.evidence_status !== 'VERIFIED' ||
      sourceRow.activation_blocker !== null
    ) {
      throw new Error(`ACTIVE Bobolice Kłanino source missing after manifest sync: ${JSON.stringify(sourceRow ?? null)}`);
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
       WHERE s.source_key='bobolice-collection-2026' AND m.terc=$1`,
      [BOBOLICE_TERC],
    );
    const parentRow = parent.rows[0];
    if (
      !parentRow ||
      parentRow.active ||
      parentRow.manifest_status !== 'PLANNED' ||
      parentRow.parser_key !== null ||
      parentRow.evidence_status !== 'VERIFIED' ||
      parentRow.activation_blocker !== 'DISCOVERY_ONLY_SAFE_CHILDREN_VERSIONED_AS_DIRECT_SOURCES'
    ) {
      throw new Error(`Bobolice parent 2026 source state drifted: ${JSON.stringify(parentRow ?? null)}`);
    }

    const snapshot = await loadBoboliceKlaninoReferenceSnapshot();
    await hydrateBoboliceKlaninoReferenceBackbone(pool);
    const referenceImport = await new PgOfficialReferenceImporter(pool).importPrgAddresses(
      boboliceKlaninoPrgRows(snapshot),
      {
        dataset: 'PRG_ADDRESS',
        sourceVersion: 'bobolice-klanino-2026-09-03',
        sourceUri: 'https://services.gugik.gov.pl/uug/',
        sourceSha256: KLANINO_PRG_RESPONSE_SHA256,
        scopeKey: BOBOLICE_TERC,
        fullSnapshot: false,
        metadata: {
          locality: 'Kłanino',
          simc: snapshot.selection.simc,
          query: 'UUG_CITY_EXACT_KLANINO',
        },
      },
    );
    if (
      referenceImport.rejected !== 0 ||
      referenceImport.inserted + referenceImport.updated + referenceImport.unchanged !== KLANINO_REAL_ADDRESS_COUNT
    ) {
      throw new Error(`Kłanino PRG import failed: ${JSON.stringify(referenceImport)}`);
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
      throw new Error(`Bobolice Kłanino artifact processing returned ${firstOutcome}`);
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
      [KLANINO_SERVICE_AREA],
    );
    const area = serviceArea.rows[0];
    if (!area || !area.active || area.external_key !== KLANINO_SERVICE_AREA || area.building_type !== 'SINGLE_FAMILY') {
      throw new Error(`Kłanino service area was not published deterministically: ${JSON.stringify(area ?? null)}`);
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
    // 13 MIXED + 13 METALS_PLASTICS + 13 GLASS + 12 PAPER + 12 BIO = 63 total
    if (
      counts.MIXED !== 13 ||
      counts.METALS_PLASTICS !== 13 ||
      counts.GLASS !== 13 ||
      counts.PAPER !== 12 ||
      counts.BIO !== 12 ||
      Object.keys(counts).length !== 5
    ) {
      throw new Error(`Kłanino event counts drifted: ${JSON.stringify(counts)}`);
    }

    const ids = snapshot.addresses.map((address) => address.prgId);
    const activeAddresses = await scalarCount(
      pool,
      `SELECT count(*)::text AS count
       FROM addresses a
       JOIN municipalities m ON m.id=a.municipality_id
       WHERE m.terc=$1 AND a.active=true AND a.prg_id=ANY($2::text[])`,
      [BOBOLICE_TERC, ids],
    );
    if (activeAddresses !== KLANINO_REAL_ADDRESS_COUNT) {
      throw new Error(`Only ${activeAddresses}/${KLANINO_REAL_ADDRESS_COUNT} frozen Kłanino PRG addresses are active`);
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
      (row) => Number(row.service_area_count) !== 1 || row.external_keys.length !== 1 || row.external_keys[0] !== KLANINO_SERVICE_AREA,
    );
    if (missing.length > 0 || ambiguous.length > 0 || coverage.rows.length !== KLANINO_REAL_ADDRESS_COUNT) {
      throw new Error(
        `Kłanino deterministic coverage failed: missing=${JSON.stringify(missing)}, ambiguous=${JSON.stringify(ambiguous)}`,
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
    // HISTORIC MILESTONE: All 8 pilot municipalities with active collection schedules!
    if (activeCollectionMunicipalities !== 8) {
      throw new Error(`Expected exactly 8 municipalities with active collection schedules, got ${activeCollectionMunicipalities}`);
    }

    report.boboliceKlanino2026_10PostCheck = {
      status: 'PASS',
      verifiedAt: new Date().toISOString(),
      manifestVersion: '2026.10',
      sourceKey: SOURCE_KEY,
      sourceUrl: SOURCE_URL,
      liveImageSha256: LIVE_IMAGE_SHA256,
      deterministicFixtureSha256: fixtureSha256,
      serviceAreaKey: KLANINO_SERVICE_AREA,
      realAddressesInLocality: KLANINO_REAL_ADDRESS_COUNT,
      realAddressesWithCoverage: coverage.rows.length,
      collectionEventsPublished: 63,
      fractions: {
        mixed: counts.MIXED,
        metalsPlastics: counts.METALS_PLASTICS,
        glass: counts.GLASS,
        paper: counts.PAPER,
        bio: counts.BIO,
      },
      pilotCollectionMunicipalityProgress: `${activeCollectionMunicipalities}/8`,
      milestoneAchieved: '100% (8/8) PILOT MUNICIPALITY COLLECTION SCHEDULE COVERAGE',
    };

    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`[PASS] Bobolice Kłanino safe subset gate passed: ${KLANINO_REAL_ADDRESS_COUNT}/${KLANINO_REAL_ADDRESS_COUNT} addresses covered, 63 events, pilot collection coverage ${activeCollectionMunicipalities}/8 (100%).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[FAIL] Bobolice Kłanino safe subset gate failed:', err);
  process.exit(1);
});
