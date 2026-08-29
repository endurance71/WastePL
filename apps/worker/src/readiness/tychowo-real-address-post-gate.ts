import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg, { type QueryResultRow } from 'pg';
import { loadRealGoldenReferenceSnapshot } from './real-golden-reference.js';

const { Pool } = pg;
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const TYCHOWO_TERC = '3201043';
const TYCHOWO_SOURCE_KEY = 'tychowo-collection-standard-2026';

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
    if (report.runtimeStatus !== 'PASS' || report.status !== 'PASS') {
      throw new Error('Base runtime and consumer API gates must pass before Tychowo real-address post-check');
    }

    const snapshot = await loadRealGoldenReferenceSnapshot();
    const tychowo = snapshot.addresses.filter((address) => address.municipalityTerc === TYCHOWO_TERC);
    if (tychowo.length !== 45) throw new Error(`Expected 45 real Tychowo PRG addresses, got ${tychowo.length}`);
    const ids = tychowo.map((address) => address.prgId);

    const activeAddresses = await scalarCount(
      pool,
      `SELECT count(*)::text AS count
       FROM addresses a
       JOIN municipalities m ON m.id=a.municipality_id
       WHERE m.terc=$1 AND a.active=true AND a.prg_id=ANY($2::text[])`,
      [TYCHOWO_TERC, ids],
    );
    if (activeAddresses !== 45) throw new Error(`Only ${activeAddresses}/45 frozen Tychowo PRG addresses are active`);

    const coverage = await pool.query<{
      prg_id: string;
      service_area_count: string;
    } & QueryResultRow>(
      `SELECT a.prg_id,
              count(DISTINCT sa.id)::text AS service_area_count
       FROM addresses a
       JOIN municipalities m ON m.id=a.municipality_id
       JOIN service_area_rules sar ON sar.locality_id=a.locality_id AND sar.rule_type='LOCALITY'
       JOIN service_areas sa ON sa.id=sar.service_area_id AND sa.active=true
       WHERE m.terc=$1
         AND a.active=true
         AND a.prg_id=ANY($2::text[])
         AND EXISTS (
           SELECT 1 FROM collection_events ce
           WHERE ce.service_area_id=sa.id AND ce.valid_to IS NULL
         )
       GROUP BY a.prg_id
       ORDER BY a.prg_id`,
      [TYCHOWO_TERC, ids],
    );
    const missing = ids.filter((id) => !coverage.rows.some((row) => row.prg_id === id));
    const ambiguous = coverage.rows.filter((row) => Number(row.service_area_count) !== 1);
    if (missing.length > 0 || ambiguous.length > 0) {
      throw new Error(
        `Tychowo deterministic coverage failed: missing=${JSON.stringify(missing)}, ambiguous=${JSON.stringify(ambiguous)}`,
      );
    }

    const source = await pool.query<{
      health_status: string;
      parser_key: string | null;
      parser_version: string | null;
      published_artifacts: string;
    } & QueryResultRow>(
      `SELECT s.health_status,
              s.parser_key,
              max(sa.parser_version) FILTER (WHERE sa.status='PUBLISHED') AS parser_version,
              count(sa.id) FILTER (WHERE sa.status='PUBLISHED')::text AS published_artifacts
       FROM sources s
       LEFT JOIN source_artifacts sa ON sa.source_id=s.id
       WHERE s.source_key=$1 AND s.active=true
       GROUP BY s.id, s.health_status, s.parser_key`,
      [TYCHOWO_SOURCE_KEY],
    );
    const sourceRow = source.rows[0];
    if (!sourceRow) throw new Error('ACTIVE Tychowo standard collection source missing');
    if (sourceRow.parser_key !== 'municipal-collection-pdf-text') {
      throw new Error(`Unexpected Tychowo parser key ${sourceRow.parser_key}`);
    }
    if (sourceRow.parser_version !== '0.1.1') {
      throw new Error(`Expected Tychowo parser version 0.1.1, got ${sourceRow.parser_version}`);
    }
    if (!['HEALTHY', 'REVIEW_REQUIRED'].includes(sourceRow.health_status)) {
      throw new Error(`Tychowo source is not terminal healthy/review: ${sourceRow.health_status}`);
    }
    if (Number(sourceRow.published_artifacts) < 1) throw new Error('Tychowo has no published source artifact');

    report.tychowoRealAddressPostCheck = {
      status: 'PASS',
      realPrgAddresses: tychowo.length,
      deterministicServiceAreaCoverage: coverage.rows.length,
      ambiguousServiceAreas: 0,
      sourceKey: TYCHOWO_SOURCE_KEY,
      parserKey: sourceRow.parser_key,
      parserVersion: sourceRow.parser_version,
      sourceHealth: sourceRow.health_status,
      publishedArtifacts: Number(sourceRow.published_artifacts),
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('Tychowo real-address post-gate PASS: 45/45 deterministic PRG addresses');
  } catch (error) {
    report.tychowoRealAddressPostCheck = {
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
