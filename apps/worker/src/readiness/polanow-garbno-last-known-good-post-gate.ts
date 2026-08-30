import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg, { type QueryResultRow } from 'pg';
import { processArtifactJob } from '../ingestion/artifact-processing.js';
import { MinioArtifactStore } from '../ingestion/artifact-store.js';
import { SourceFetchError } from '../ingestion/http-source-fetcher.js';
import { SourceIngestionService } from '../ingestion/source-ingestion-service.js';
import { PgSourceRegistry } from '../ingestion/source-registry.js';
import type { SourceFetcher } from '../ingestion/types.js';
import { createArtifactRuntimeProcessor } from '../main.js';

const { Pool } = pg;
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const SOURCE_KEY = 'polanow-collection-garbno-h2-2026';
const SERVICE_AREA_KEY = 'polanow-garbno-single-family';

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
    const rollout = report.polanowGarbno2026_6PostCheck as Record<string, unknown> | undefined;
    if (report.status !== 'PASS' || rollout?.status !== 'PASS') {
      throw new Error('Polanów Garbno rollout post-gate must pass before last-known-good verification');
    }

    const sourceResult = await pool.query<{
      id: string;
      active: boolean;
      parser_key: string | null;
      health_status: string;
    } & QueryResultRow>(
      `SELECT id, active, parser_key, health_status
       FROM sources
       WHERE source_key=$1`,
      [SOURCE_KEY],
    );
    const source = sourceResult.rows[0];
    if (!source || !source.active || source.parser_key !== 'municipal-collection-pdf-text') {
      throw new Error(`Polanów Garbno source is unavailable for LKG gate: ${JSON.stringify(source ?? null)}`);
    }

    const artifactResult = await pool.query<{
      id: string;
      status: string;
      parser_key: string | null;
      parser_version: string | null;
    } & QueryResultRow>(
      `SELECT id, status, parser_key, parser_version
       FROM source_artifacts
       WHERE source_id=$1 AND status='PUBLISHED'
       ORDER BY retrieved_at DESC, id DESC
       LIMIT 1`,
      [source.id],
    );
    const artifact = artifactResult.rows[0];
    if (
      !artifact ||
      artifact.status !== 'PUBLISHED' ||
      artifact.parser_key !== 'municipal-collection-pdf-text' ||
      artifact.parser_version !== '0.2.0'
    ) {
      throw new Error(`Published Polanów Garbno artifact missing before LKG gate: ${JSON.stringify(artifact ?? null)}`);
    }

    const eventsBeforeFailure = await scalarCount(
      pool,
      `SELECT count(*)::text AS count
       FROM collection_events ce
       JOIN service_areas sa ON sa.id=ce.service_area_id
       WHERE sa.external_key=$1 AND ce.valid_to IS NULL`,
      [SERVICE_AREA_KEY],
    );
    if (eventsBeforeFailure !== 32) {
      throw new Error(`Expected 32 current Garbno events before simulated outage, got ${eventsBeforeFailure}`);
    }

    const failingFetcher: SourceFetcher = {
      async fetch() {
        throw new SourceFetchError({
          message: 'Deterministic Polanów 2026.6 upstream failure',
          attempts: 3,
          status: 503,
          code: 'HTTP_503',
          retryable: true,
        });
      },
    };
    const registry = new PgSourceRegistry(pool);
    const ingestion = new SourceIngestionService(registry, new MinioArtifactStore(), failingFetcher);

    let failureCode: string | null = null;
    try {
      await ingestion.ingest(source.id);
      throw new Error('Expected deterministic Polanów upstream failure');
    } catch (error) {
      if (!(error instanceof SourceFetchError)) throw error;
      failureCode = error.code;
    }
    if (failureCode !== 'HTTP_503') throw new Error(`Unexpected Polanów simulated failure code ${failureCode}`);

    const failedHealthResult = await pool.query<{
      health_status: string;
      consecutive_failures: number;
      last_error_code: string | null;
    } & QueryResultRow>(
      `SELECT health_status, consecutive_failures, last_error_code
       FROM sources WHERE id=$1`,
      [source.id],
    );
    const failedHealth = failedHealthResult.rows[0];
    const eventsAfterFailure = await scalarCount(
      pool,
      `SELECT count(*)::text AS count
       FROM collection_events ce
       JOIN service_areas sa ON sa.id=ce.service_area_id
       WHERE sa.external_key=$1 AND ce.valid_to IS NULL`,
      [SERVICE_AREA_KEY],
    );
    const artifactStillPublished = await scalarCount(
      pool,
      `SELECT count(*)::text AS count
       FROM source_artifacts
       WHERE id=$1 AND status='PUBLISHED' AND parser_version='0.2.0'`,
      [artifact.id],
    );
    if (
      !failedHealth ||
      failedHealth.health_status !== 'FETCH_FAILED' ||
      failedHealth.consecutive_failures < 1 ||
      failedHealth.last_error_code !== 'HTTP_503' ||
      eventsAfterFailure !== eventsBeforeFailure ||
      artifactStillPublished !== 1
    ) {
      throw new Error(
        `Polanów last-known-good state was not preserved: ${JSON.stringify({ failedHealth, eventsBeforeFailure, eventsAfterFailure, artifactStillPublished })}`,
      );
    }

    const recoveryOutcome = await processArtifactJob(
      registry,
      createArtifactRuntimeProcessor(pool),
      {
        sourceId: source.id,
        artifactId: artifact.id,
        parserKey: 'municipal-collection-pdf-text',
      },
    );
    if (recoveryOutcome !== 'PUBLISHED') {
      throw new Error(`Polanów LKG recovery replay returned ${recoveryOutcome}`);
    }

    const recoveredHealthResult = await pool.query<{
      health_status: string;
      consecutive_failures: number;
      last_error_code: string | null;
    } & QueryResultRow>(
      `SELECT health_status, consecutive_failures, last_error_code
       FROM sources WHERE id=$1`,
      [source.id],
    );
    const recoveredHealth = recoveredHealthResult.rows[0];
    const eventsAfterRecovery = await scalarCount(
      pool,
      `SELECT count(*)::text AS count
       FROM collection_events ce
       JOIN service_areas sa ON sa.id=ce.service_area_id
       WHERE sa.external_key=$1 AND ce.valid_to IS NULL`,
      [SERVICE_AREA_KEY],
    );
    if (
      !recoveredHealth ||
      recoveredHealth.health_status !== 'HEALTHY' ||
      recoveredHealth.consecutive_failures !== 0 ||
      recoveredHealth.last_error_code !== null ||
      eventsAfterRecovery !== 32
    ) {
      throw new Error(`Polanów LKG recovery failed: ${JSON.stringify({ recoveredHealth, eventsAfterRecovery })}`);
    }

    report.polanowGarbnoLastKnownGood2026_6 = {
      status: 'PASS',
      sourceKey: SOURCE_KEY,
      simulatedFailureCode: failureCode,
      fetchHealthDuringOutage: failedHealth.health_status,
      currentEventsBeforeFailure: eventsBeforeFailure,
      currentEventsAfterFailure: eventsAfterFailure,
      publishedArtifactPreserved: true,
      recoveryOutcome,
      recoveredHealth: recoveredHealth.health_status,
      currentEventsAfterRecovery: eventsAfterRecovery,
    };
    report.status = 'PASS';
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('Polanów Garbno last-known-good gate PASS: HTTP_503 preserved 32 events and recovery returned HEALTHY');
  } catch (error) {
    report.polanowGarbnoLastKnownGood2026_6 = {
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
