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
  BEDZINO_TERC,
  DWOREK_PRG_RESPONSE_SHA256,
  DWOREK_REAL_ADDRESS_COUNT,
  DWOREK_SERVICE_AREA,
  hydrateBedzinoDworekReferenceBackbone,
  loadBedzinoDworekReferenceSnapshot,
  bedzinoDworekPrgRows,
} from './bedzino-dworek-reference.js';

const { Pool } = pg;
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const manifestPath = resolve(repoRoot, 'manifests/pilot-koszalin-region-2026.7.json');
const fixturePath = resolve(repoRoot, 'apps/worker/test/fixtures/pdf-text/bedzino-trasa-1-h2-2026.txt');
const SOURCE_KEY = 'bedzino-collection-trasa-1-safe-h2-2026';
const SOURCE_URL = 'https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-I.pdf';
const LIVE_PDF_SHA256 = '91d4a4f1cf406e1116937468247062ad371198d505690f4424addd1f5de31fee';
const RETRIEVED_AT = new Date('2026-09-03T11:00:00.000Z');

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
    if (manifestSync.version !== '2026.7' || manifestSync.activeCount !== 11) {
      throw new Error(`Unexpected 2026.7 manifest sync: ${JSON.stringify(manifestSync)}`);
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
      [SOURCE_KEY, BEDZINO_TERC],
    );
    const sourceRow = source.rows[0];
    if (
      !sourceRow ||
      !sourceRow.active ||
      sourceRow.parser_key !== 'municipal-collection-pdf-text' ||
      sourceRow.source_url !== SOURCE_URL ||
      sourceRow.manifest_status !== 'ACTIVE' ||
      sourceRow.manifest_version !== 'pilot-koszalin-region@2026.7' ||
      sourceRow.evidence_status !== 'VERIFIED' ||
      sourceRow.activation_blocker !== null
    ) {
      throw new Error(`ACTIVE Będzino Trasa I source missing after manifest sync: ${JSON.stringify(sourceRow ?? null)}`);
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
       WHERE s.source_key='bedzino-collection-2026-h2' AND m.terc=$1`,
      [BEDZINO_TERC],
    );
    const parentRow = parent.rows[0];
    if (
      !parentRow ||
      parentRow.active ||
      parentRow.manifest_status !== 'PLANNED' ||
      parentRow.parser_key !== null ||
      parentRow.evidence_status !== 'VERIFIED' ||
      parentRow.activation_blocker !== 'H2_ROUTE_I_II_OSLONY_AND_DIFFICULT_COVERAGE_NOT_YET_ADDRESS_DETERMINISTIC'
    ) {
      throw new Error(`Będzino H2 discovery parent scope drifted: ${JSON.stringify(parentRow ?? null)}`);
    }

    const snapshot = await loadBedzinoDworekReferenceSnapshot();
    await hydrateBedzinoDworekReferenceBackbone(pool, snapshot);
    const referenceImport = await new PgOfficialReferenceImporter(pool).importPrgAddresses(
      bedzinoDworekPrgRows(snapshot),
      {
        dataset: 'PRG_ADDRESS',
        sourceVersion: 'bedzino-dworek-2026-09-03',
        sourceUri: snapshot.source.uugUrl,
        sourceSha256: DWOREK_PRG_RESPONSE_SHA256,
        scopeKey: BEDZINO_TERC,
        fullSnapshot: false,
        metadata: {
          locality: 'Dworek',
          simc: snapshot.selection.simc,
          query: snapshot.source.query,
        },
      },
    );
    if (
      referenceImport.rejected !== 0 ||
      referenceImport.inserted + referenceImport.updated + referenceImport.unchanged !== DWOREK_REAL_ADDRESS_COUNT
    ) {
      throw new Error(`Dworek PRG import failed: ${JSON.stringify(referenceImport)}`);
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
      throw new Error(`Będzino Dworek artifact processing returned ${firstOutcome}`);
    }

    const serviceArea = await pool.query<{
      id: string;
      external_key: string;
      name: string;
      building_type: string | null;
    } & QueryResultRow>(
      `SELECT sa.id, sa.external_key, sa.name, sa.building_type
       FROM service_areas sa
       JOIN municipalities m ON m.id=sa.municipality_id
       WHERE sa.external_key=$1 AND m.terc=$2`,
      [DWOREK_SERVICE_AREA, BEDZINO_TERC],
    );
    const area = serviceArea.rows[0];
    if (!area || area.building_type !== 'SINGLE_FAMILY') {
      throw new Error(`Będzino Dworek service area missing: ${JSON.stringify(area ?? null)}`);
    }

    const coverageRules = await pool.query<{
      coverage_type: string;
      priority: number;
      simc: string | null;
    } & QueryResultRow>(
      `SELECT coverage_type, priority, simc FROM service_area_coverage WHERE service_area_id=$1`,
      [area.id],
    );
    if (
      coverageRules.rows.length !== 1 ||
      coverageRules.rows[0]?.coverage_type !== 'LOCALITY' ||
      coverageRules.rows[0]?.priority !== 50 ||
      coverageRules.rows[0]?.simc !== '0302400'
    ) {
      throw new Error(`Będzino Dworek coverage rule drifted: ${JSON.stringify(coverageRules.rows)}`);
    }

    const events = await pool.query<{ fraction: string; count: string } & QueryResultRow>(
      `SELECT fraction, count(*)::text AS count
       FROM collection_events
       WHERE service_area_id=$1 AND valid_to IS NULL
       GROUP BY fraction
       ORDER BY fraction`,
      [area.id],
    );
    const counts = Object.fromEntries(events.rows.map((row) => [row.fraction, Number(row.count)]));
    if (counts.MIXED !== 13 || counts.BIO !== 11 || counts.OTHER !== 21) {
      throw new Error(`Będzino Dworek event counts drifted: ${JSON.stringify(counts)}`);
    }

    const ids = snapshot.addresses.map((address) => address.prgId);
    const coverage = await pool.query<{
      prg_id: string;
      service_area_count: string;
      external_keys: string[];
    } & QueryResultRow>(
      `SELECT a.prg_id,
              count(DISTINCT c.service_area_id)::text AS service_area_count,
              array_agg(DISTINCT sa.external_key) AS external_keys
       FROM addresses a
       LEFT JOIN service_area_coverage c ON c.coverage_type='LOCALITY' AND c.simc=a.simc
       LEFT JOIN service_areas sa ON sa.id=c.service_area_id
       WHERE a.prg_id=ANY($1::text[])
       GROUP BY a.prg_id
       ORDER BY a.prg_id`,
      [ids],
    );
    const missing = ids.filter((id) => !coverage.rows.some((row) => row.prg_id === id));
    const ambiguous = coverage.rows.filter(
      (row) => Number(row.service_area_count) !== 1 || row.external_keys.length !== 1 || row.external_keys[0] !== DWOREK_SERVICE_AREA,
    );
    if (missing.length > 0 || ambiguous.length > 0 || coverage.rows.length !== DWOREK_REAL_ADDRESS_COUNT) {
      throw new Error(
        `Dworek deterministic coverage failed: missing=${JSON.stringify(missing)}, ambiguous=${JSON.stringify(ambiguous)}`,
      );
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
    if (
      !artifactRow ||
      artifactRow.status !== 'PUBLISHED' ||
      artifactRow.parser_key !== 'municipal-collection-pdf-text' ||
      artifactRow.parser_version !== '0.2.0'
    ) {
      throw new Error(`Unexpected Będzino Dworek artifact state: ${JSON.stringify(artifactRow ?? null)}`);
    }

    const replayOutcome = await processArtifactJob(registry, processor, {
      sourceId: sourceRow.id,
      artifactId,
      parserKey: 'municipal-collection-pdf-text',
    });
    if (replayOutcome !== 'PUBLISHED') throw new Error(`Będzino Dworek replay returned ${replayOutcome}`);

    report.bedzinoDworek2026_7PostCheck = {
      status: 'PASS',
      manifest: 'pilot-koszalin-region@2026.7',
      activeSources: manifestSync.activeCount,
      sourceKey: SOURCE_KEY,
      sourceUrl: SOURCE_URL,
      livePdfSha256: LIVE_PDF_SHA256,
      deterministicFixtureSha256: fixtureSha256,
      prgResponseSha256: DWOREK_PRG_RESPONSE_SHA256,
      realPrgAddresses: DWOREK_REAL_ADDRESS_COUNT,
      deterministicServiceAreaCoverage: coverage.rows.length,
      ambiguousServiceAreas: 0,
      serviceAreaKey: DWOREK_SERVICE_AREA,
      collectionEvents: counts,
      firstImport: firstOutcome,
      replay: replayOutcome,
      parserKey: artifactRow.parser_key,
      parserVersion: artifactRow.parser_version,
      extractionConfidence: Number(artifactRow.extraction_confidence),
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Będzino Dworek 2026.7 post-gate PASS: ${DWOREK_REAL_ADDRESS_COUNT}/${DWOREK_REAL_ADDRESS_COUNT} deterministic PRG addresses`);
  } catch (error) {
    report.bedzinoDworek2026_7PostCheck = {
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
