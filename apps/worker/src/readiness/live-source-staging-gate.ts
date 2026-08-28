import { createHash } from 'node:crypto';
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
import { HttpSourceFetcher, SourceFetchError } from '../ingestion/http-source-fetcher.js';
import { SourceIngestionService } from '../ingestion/source-ingestion-service.js';
import { ArtifactOutboxDispatcher } from '../ingestion/source-scheduler.js';
import { createArtifactRuntimeProcessor } from '../main.js';
import { PgSourceManifestSync } from '../manifests/source-manifest-sync.js';
import type { SourceManifest } from '../manifests/source-manifest.js';
import { PgOfficialReferenceImporter } from '../reference/pg-reference-importer.js';
import {
  productionGatePrgRows,
  productionGateSimcRows,
  productionGateTercRows,
  productionGateUlicRows,
} from './production-gate-reference.js';

const { Client, Pool } = pg;
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const manifestPath = resolve(repoRoot, 'manifests/pilot-koszalin-region-2026.2.json');
const reportPath = resolve(repoRoot, 'apps/worker/test-results/live-source-staging-report.json');
const summaryPath = resolve(repoRoot, 'apps/worker/test-results/live-source-staging-summary.md');
const fixtureRoot = resolve(repoRoot, 'apps/worker/test/fixtures');

export const LIVE_ACTIVE_SOURCE_KEYS = [
  'bobolice-pszok',
  'koszalin-collection-bio-2026',
  'koszalin-pszok-faq',
  'koszalin-pszok-main',
  'manowo-collection-2ab-2026',
  'swieszyno-pszok',
] as const;

export type LiveActiveSourceKey = typeof LIVE_ACTIVE_SOURCE_KEYS[number];
export type LiveSourceOutcome =
  | 'HEALTHY'
  | 'CHANGED_BUT_PARSEABLE'
  | 'REVIEW_REQUIRED'
  | 'FETCH_FAILED'
  | 'PARSE_FAILED'
  | 'WAITING_FOR_COMPANION';

const baselineFixturePath: Partial<Record<LiveActiveSourceKey, string>> = {
  'koszalin-pszok-main': 'pgk-koszalin-pszok-main.html',
  'koszalin-pszok-faq': 'pgk-koszalin-pszok-faq.html',
  'bobolice-pszok': 'bobolice-pszok.html',
  'swieszyno-pszok': 'swieszyno-pszok.html',
};

const expectedCanonicalKeys: Partial<Record<LiveActiveSourceKey, string>> = {
  'koszalin-pszok-main': 'pl-3261011-pszok-komunalna-5',
  'koszalin-pszok-faq': 'pl-3261011-pszok-komunalna-5',
  'bobolice-pszok': 'pl-3209033-pszok-boboliczki',
  'swieszyno-pszok': 'pl-3209082-pszok-chalupy-13b',
};

interface ActiveSourceRow extends QueryResultRow {
  id: string;
  source_key: LiveActiveSourceKey;
  source_url: string;
  source_format: string;
  parser_key: string | null;
  data_type: string;
  terc: string;
  bundle_key: string | null;
  bundle_role: string | null;
}

interface FetchAttemptRow extends QueryResultRow {
  outcome: string;
  attempts: number;
  http_status: number | null;
  sha256: string | null;
  bytes_received: string | null;
  content_type: string | null;
  error_code: string | null;
  metadata: Record<string, unknown>;
  started_at: Date;
  completed_at: Date;
}

interface ArtifactRow extends QueryResultRow {
  id: string;
  sha256: string;
  parser_key: string | null;
  parser_version: string | null;
  status: string;
}

interface ProcessingAttemptRow extends QueryResultRow {
  outcome: string;
  parser_key: string | null;
  error_code: string | null;
  started_at: Date;
  completed_at: Date;
}

interface SourceHealthRow extends QueryResultRow {
  health_status: string;
  consecutive_failures: number;
  last_error_code: string | null;
}

export interface LiveSourceResult {
  sourceKey: string;
  terc: string;
  dataType: string;
  sourceUrl: string;
  finalUrl: string | null;
  sourceFormat: string;
  parserKey: string | null;
  parserVersion: string | null;
  bundleKey: string | null;
  bundleRole: string | null;
  outcome: LiveSourceOutcome;
  httpStatus: number | null;
  contentType: string | null;
  sha256: string | null;
  baselineSha256: string | null;
  baselineComparable: boolean;
  bytesReceived: number | null;
  fetchAttempts: number;
  fetchDurationMs: number | null;
  parseDurationMs: number | null;
  artifactStatus: string | null;
  processingOutcome: string | null;
  healthStatus: string;
  consecutiveFailures: number;
  safeErrorCode: string | null;
  canonicalEvidence: {
    expectedCanonicalKey: string | null;
    expectedCanonicalKeyObserved: boolean | null;
    collectionPublicationCount: number | null;
  };
}

interface GateReport {
  gate: string;
  gateVersion: string;
  manifest: string;
  mode: string;
  startedAt: string;
  completedAt?: string;
  isolation: {
    database: string | null;
    bucket: string | null;
    productionMutationAllowed: false;
  };
  sourceResults: LiveSourceResult[];
  bundleChecks: Array<Record<string, unknown>>;
  canonicalChecks: Record<string, unknown>;
  summary: {
    status: 'PASS' | 'WARN' | 'FAIL';
    activeSourcesExpected: number;
    activeSourcesObserved: number;
    healthy: number;
    changedButParseable: number;
    reviewRequired: number;
    criticalFailures: number;
  };
  fatalError?: { code: string; message: string };
}

function sha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

export function classifyLiveSourceOutcome(input: {
  fetchFailed: boolean;
  processingOutcome: string | null;
  sha256: string | null;
  baselineSha256: string | null;
}): LiveSourceOutcome {
  if (input.fetchFailed) return 'FETCH_FAILED';
  if (input.processingOutcome === 'PARSE_FAILED' || input.processingOutcome === null) return 'PARSE_FAILED';
  if (input.processingOutcome === 'WAITING_FOR_COMPANION') return 'WAITING_FOR_COMPANION';
  if (input.processingOutcome === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  if (
    input.processingOutcome === 'PUBLISHED' &&
    input.baselineSha256 !== null &&
    input.sha256 !== null &&
    input.sha256 !== input.baselineSha256
  ) {
    return 'CHANGED_BUT_PARSEABLE';
  }
  return 'HEALTHY';
}

function liveDatabaseUrl(): string {
  if (process.env.LIVE_SOURCE_DATABASE_URL) return process.env.LIVE_SOURCE_DATABASE_URL;
  const base = new URL(
    process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  );
  base.pathname = '/wastepl_live_source_gate';
  return base.toString();
}

function adminDatabaseUrl(gateUrl: string): string {
  const url = new URL(gateUrl);
  url.pathname = '/postgres';
  return url.toString();
}

export function assertLiveGateIsolation(input: {
  liveDatabaseUrl: string;
  ordinaryDatabaseUrl: string | undefined;
  bucket: string | undefined;
}): void {
  const live = new URL(input.liveDatabaseUrl);
  const databaseName = live.pathname.replace(/^\//, '');
  if (databaseName !== 'wastepl_live_source_gate') {
    throw new Error(`LIVE_GATE_UNSAFE_DATABASE: expected wastepl_live_source_gate, got ${databaseName}`);
  }
  if (input.ordinaryDatabaseUrl && input.liveDatabaseUrl === input.ordinaryDatabaseUrl) {
    throw new Error('LIVE_GATE_UNSAFE_DATABASE: live gate must not use DATABASE_URL');
  }
  if (!input.bucket || !input.bucket.startsWith('wastepl-live-source-')) {
    throw new Error('LIVE_GATE_UNSAFE_BUCKET: S3_BUCKET must start with wastepl-live-source-');
  }
}

async function resetGateDatabase(gateUrl: string): Promise<void> {
  const databaseName = new URL(gateUrl).pathname.replace(/^\//, '');
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

async function baselineHashes(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const [sourceKey, relativePath] of Object.entries(baselineFixturePath)) {
    const body = await readFile(resolve(fixtureRoot, relativePath));
    result.set(sourceKey, sha256(body));
  }
  return result;
}

async function waitForTerminalProcessing(
  pool: InstanceType<typeof Pool>,
  artifactIds: string[],
  timeoutMs = 45_000,
): Promise<void> {
  if (artifactIds.length === 0) return;
  const terminal = new Set(['PUBLISHED', 'REVIEW_REQUIRED', 'WAITING_FOR_COMPANION', 'PARSE_FAILED']);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await pool.query<{ artifact_id: string; outcome: string } & QueryResultRow>(
      `SELECT DISTINCT ON (artifact_id) artifact_id, outcome
       FROM source_processing_attempts
       WHERE artifact_id = ANY($1::uuid[])
       ORDER BY artifact_id, completed_at DESC, id DESC`,
      [artifactIds],
    );
    const state = new Map(result.rows.map((row) => [row.artifact_id, row.outcome]));
    if (artifactIds.every((artifactId) => terminal.has(state.get(artifactId) ?? ''))) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error('LIVE_GATE_PROCESSING_TIMEOUT');
}

async function latestFetchAttempt(
  pool: InstanceType<typeof Pool>,
  sourceId: string,
): Promise<FetchAttemptRow | null> {
  const result = await pool.query<FetchAttemptRow>(
    `SELECT outcome, attempts, http_status, sha256, bytes_received, content_type,
            error_code, metadata, started_at, completed_at
     FROM source_fetch_attempts WHERE source_id = $1
     ORDER BY id DESC LIMIT 1`,
    [sourceId],
  );
  return result.rows[0] ?? null;
}

async function latestArtifact(
  pool: InstanceType<typeof Pool>,
  sourceId: string,
): Promise<ArtifactRow | null> {
  const result = await pool.query<ArtifactRow>(
    `SELECT id, sha256, parser_key, parser_version, status
     FROM source_artifacts WHERE source_id = $1
     ORDER BY retrieved_at DESC, id DESC LIMIT 1`,
    [sourceId],
  );
  return result.rows[0] ?? null;
}

async function latestProcessingAttempt(
  pool: InstanceType<typeof Pool>,
  artifactId: string,
): Promise<ProcessingAttemptRow | null> {
  const result = await pool.query<ProcessingAttemptRow>(
    `SELECT outcome, parser_key, error_code, started_at, completed_at
     FROM source_processing_attempts WHERE artifact_id = $1
     ORDER BY id DESC LIMIT 1`,
    [artifactId],
  );
  return result.rows[0] ?? null;
}

async function sourceHealth(
  pool: InstanceType<typeof Pool>,
  sourceId: string,
): Promise<SourceHealthRow> {
  const result = await pool.query<SourceHealthRow>(
    `SELECT health_status, consecutive_failures, last_error_code FROM sources WHERE id = $1`,
    [sourceId],
  );
  return result.rows[0] ?? { health_status: 'UNKNOWN', consecutive_failures: 0, last_error_code: null };
}

async function canonicalEvidence(
  pool: InstanceType<typeof Pool>,
  source: ActiveSourceRow,
): Promise<LiveSourceResult['canonicalEvidence']> {
  if (source.data_type === 'COLLECTION_SCHEDULE') {
    const result = await pool.query<{ count: string } & QueryResultRow>(
      `SELECT count(*)::text AS count FROM collection_publications WHERE source_id = $1`,
      [source.id],
    );
    return {
      expectedCanonicalKey: null,
      expectedCanonicalKeyObserved: null,
      collectionPublicationCount: Number(result.rows[0]?.count ?? 0),
    };
  }

  const expected = expectedCanonicalKeys[source.source_key] ?? null;
  if (!expected) {
    return { expectedCanonicalKey: null, expectedCanonicalKeyObserved: null, collectionPublicationCount: null };
  }
  const result = await pool.query<{ count: string } & QueryResultRow>(
    `SELECT count(DISTINCT f.id)::text AS count
     FROM facilities f
     LEFT JOIN facility_source_assertions a ON a.facility_id = f.id
     WHERE f.canonical_key = $1
       AND (
         f.source_artifact_id IN (SELECT id FROM source_artifacts WHERE source_id = $2)
         OR a.source_key = $3
       )`,
    [expected, source.id, source.source_key],
  );
  return {
    expectedCanonicalKey: expected,
    expectedCanonicalKeyObserved: Number(result.rows[0]?.count ?? 0) > 0,
    collectionPublicationCount: null,
  };
}

async function writeReports(report: GateReport): Promise<void> {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# WastePL live-source staging report',
    '',
    `Status: **${report.summary.status}**`,
    '',
    `Manifest: \`${report.manifest}\``,
    '',
    '| Source | TERC | Data | Outcome | HTTP | Parser | SHA-256 |',
    '| --- | --- | --- | --- | ---: | --- | --- |',
    ...report.sourceResults.map((source) =>
      `| ${source.sourceKey} | ${source.terc} | ${source.dataType} | ${source.outcome} | ${source.httpStatus ?? '—'} | ${source.parserKey ?? '—'} | ${source.sha256?.slice(0, 12) ?? '—'} |`,
    ),
    '',
    `Healthy: ${report.summary.healthy}; changed but parseable: ${report.summary.changedButParseable}; review required: ${report.summary.reviewRequired}; critical failures: ${report.summary.criticalFailures}.`,
    '',
    'This workflow uses an isolated database and object bucket and never writes production canonical data.',
  ];
  if (report.fatalError) lines.push('', `Fatal error code: \`${report.fatalError.code}\`.`);
  await writeFile(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

function safeFatal(error: unknown): { code: string; message: string } {
  if (error instanceof SourceFetchError) return { code: error.code, message: error.code };
  const message = error instanceof Error ? error.message : String(error);
  const code = /^[A-Z0-9_:-]+$/.test(message) ? message : 'LIVE_GATE_FATAL';
  return { code, message: code };
}

async function main(): Promise<void> {
  const startedAt = new Date();
  const gateUrl = liveDatabaseUrl();
  const bucket = process.env.S3_BUCKET;
  const report: GateReport = {
    gate: 'live-source-staging-soak',
    gateVersion: '0.1.0',
    manifest: 'pilot-koszalin-region@2026.2',
    mode: 'LIVE_HTTP_ISOLATED_RUNTIME',
    startedAt: startedAt.toISOString(),
    isolation: {
      database: new URL(gateUrl).pathname.replace(/^\//, ''),
      bucket: bucket ?? null,
      productionMutationAllowed: false,
    },
    sourceResults: [],
    bundleChecks: [],
    canonicalChecks: {},
    summary: {
      status: 'FAIL',
      activeSourcesExpected: LIVE_ACTIVE_SOURCE_KEYS.length,
      activeSourcesObserved: 0,
      healthy: 0,
      changedButParseable: 0,
      reviewRequired: 0,
      criticalFailures: 0,
    },
  };

  let pool: InstanceType<typeof Pool> | null = null;
  let redis: Redis | null = null;
  try {
    assertLiveGateIsolation({
      liveDatabaseUrl: gateUrl,
      ordinaryDatabaseUrl: process.env.DATABASE_URL,
      bucket,
    });
    await resetGateDatabase(gateUrl);
    pool = new Pool({ connectionString: gateUrl });
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

    const importer = new PgOfficialReferenceImporter(pool);
    const referenceRuns = [
      await importer.importTerc(productionGateTercRows(), {
        dataset: 'TERYT_TERC', sourceVersion: 'live-source-gate-2026.2', metadata: { stagingOnly: true },
      }),
      await importer.importSimc(productionGateSimcRows(), {
        dataset: 'TERYT_SIMC', sourceVersion: 'live-source-gate-2026.2', metadata: { stagingOnly: true },
      }),
      await importer.importUlic(productionGateUlicRows(), {
        dataset: 'TERYT_ULIC', sourceVersion: 'live-source-gate-2026.2', metadata: { stagingOnly: true },
      }),
      await importer.importPrgAddresses(productionGatePrgRows(), {
        dataset: 'PRG_ADDRESS', sourceVersion: 'live-source-gate-2026.2', metadata: { stagingOnly: true },
      }),
    ];
    if (referenceRuns.some((run) => run.rejected > 0)) throw new Error('LIVE_GATE_REFERENCE_IMPORT_REJECTED');

    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SourceManifest;
    const manifestSync = await new PgSourceManifestSync(pool).sync(manifest, new Date());
    if (manifestSync.activeCount !== LIVE_ACTIVE_SOURCE_KEYS.length) {
      throw new Error('LIVE_GATE_ACTIVE_SOURCE_COUNT_DRIFT');
    }

    const activeResult = await pool.query<ActiveSourceRow>(
      `SELECT s.id, s.source_key, s.source_url, s.source_format, s.parser_key,
              s.data_type, m.terc, s.bundle_key, s.bundle_role
       FROM sources s
       JOIN municipalities m ON m.id = s.municipality_id
       WHERE s.active = true
       ORDER BY s.source_key`,
    );
    const active = activeResult.rows;
    report.summary.activeSourcesObserved = active.length;
    const keys = active.map((source) => source.source_key);
    if (JSON.stringify(keys) !== JSON.stringify([...LIVE_ACTIVE_SOURCE_KEYS].sort())) {
      throw new Error('LIVE_GATE_ACTIVE_SOURCE_IDENTITY_DRIFT');
    }

    const baselines = await baselineHashes();
    const registry = new PgBundleAwareSourceRegistry(pool);
    const ingestion = new SourceIngestionService(
      registry,
      new MinioArtifactStore(),
      new HttpSourceFetcher({ timeoutMs: 20_000, maxAttempts: 3, baseDelayMs: 500 }),
    );
    const artifactIds: string[] = [];
    const fetchFailures = new Set<string>();

    for (const source of active) {
      try {
        const result = await ingestion.ingest(source.id);
        if (result.artifactId) artifactIds.push(result.artifactId);
      } catch {
        fetchFailures.add(source.id);
      }
    }

    if (artifactIds.length > 0) {
      const queue = new BullMqArtifactProcessingQueue(redis);
      const worker = createArtifactProcessingWorker(redis, registry, createArtifactRuntimeProcessor(pool));
      const dispatcher = new ArtifactOutboxDispatcher(registry, queue, { batchSize: 100 });
      try {
        for (let pass = 0; pass < 4; pass += 1) {
          const dispatch = await dispatcher.runOnce(new Date(Date.now() + 1_000));
          if (dispatch.enqueueFailed > 0) throw new Error('LIVE_GATE_OUTBOX_ENQUEUE_FAILED');
          if (dispatch.claimed === 0) break;
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
        }
        await waitForTerminalProcessing(pool, artifactIds);
      } finally {
        await worker.close();
        await queue.close();
      }
    }

    for (const source of active) {
      const fetchAttempt = await latestFetchAttempt(pool, source.id);
      const artifact = await latestArtifact(pool, source.id);
      const processing = artifact ? await latestProcessingAttempt(pool, artifact.id) : null;
      const health = await sourceHealth(pool, source.id);
      const baseline = baselines.get(source.source_key) ?? null;
      const evidence = await canonicalEvidence(pool, source);
      const outcome = classifyLiveSourceOutcome({
        fetchFailed: fetchFailures.has(source.id) || fetchAttempt?.outcome === 'FAILED',
        processingOutcome: processing?.outcome ?? null,
        sha256: artifact?.sha256 ?? fetchAttempt?.sha256 ?? null,
        baselineSha256: baseline,
      });
      const safeErrorCode =
        fetchAttempt?.error_code ?? processing?.error_code ?? health.last_error_code ?? null;
      report.sourceResults.push({
        sourceKey: source.source_key,
        terc: source.terc,
        dataType: source.data_type,
        sourceUrl: source.source_url,
        finalUrl:
          typeof fetchAttempt?.metadata?.finalUrl === 'string'
            ? fetchAttempt.metadata.finalUrl
            : null,
        sourceFormat: source.source_format,
        parserKey: artifact?.parser_key ?? source.parser_key,
        parserVersion: artifact?.parser_version ?? null,
        bundleKey: source.bundle_key,
        bundleRole: source.bundle_role,
        outcome,
        httpStatus: fetchAttempt?.http_status ?? null,
        contentType: fetchAttempt?.content_type ?? null,
        sha256: artifact?.sha256 ?? fetchAttempt?.sha256 ?? null,
        baselineSha256: baseline,
        baselineComparable: baseline !== null,
        bytesReceived: fetchAttempt?.bytes_received === null || fetchAttempt?.bytes_received === undefined
          ? null
          : Number(fetchAttempt.bytes_received),
        fetchAttempts: fetchAttempt?.attempts ?? 0,
        fetchDurationMs: fetchAttempt
          ? fetchAttempt.completed_at.getTime() - fetchAttempt.started_at.getTime()
          : null,
        parseDurationMs: processing
          ? processing.completed_at.getTime() - processing.started_at.getTime()
          : null,
        artifactStatus: artifact?.status ?? null,
        processingOutcome: processing?.outcome ?? null,
        healthStatus: health.health_status,
        consecutiveFailures: health.consecutive_failures,
        safeErrorCode,
        canonicalEvidence: evidence,
      });
    }

    const main = report.sourceResults.find((source) => source.sourceKey === 'koszalin-pszok-main');
    const faq = report.sourceResults.find((source) => source.sourceKey === 'koszalin-pszok-faq');
    const bundleComplete = Boolean(
      main && faq &&
      !['FETCH_FAILED', 'PARSE_FAILED', 'WAITING_FOR_COMPANION'].includes(main.outcome) &&
      !['FETCH_FAILED', 'PARSE_FAILED', 'WAITING_FOR_COMPANION'].includes(faq.outcome),
    );
    report.bundleChecks.push({
      bundleKey: 'koszalin-pszok',
      requiredRoles: ['main', 'faq'],
      mainOutcome: main?.outcome ?? null,
      faqOutcome: faq?.outcome ?? null,
      complete: bundleComplete,
    });

    const missingCanonicalEvidence = report.sourceResults.filter((source) => {
      if (source.dataType === 'COLLECTION_SCHEDULE') {
        return (source.canonicalEvidence.collectionPublicationCount ?? 0) < 1;
      }
      return source.canonicalEvidence.expectedCanonicalKey !== null &&
        source.canonicalEvidence.expectedCanonicalKeyObserved !== true;
    });
    report.canonicalChecks = {
      missingSourceKeys: missingCanonicalEvidence.map((source) => source.sourceKey),
      allExpectedObserved: missingCanonicalEvidence.length === 0,
    };

    report.summary.healthy = report.sourceResults.filter((source) => source.outcome === 'HEALTHY').length;
    report.summary.changedButParseable = report.sourceResults.filter(
      (source) => source.outcome === 'CHANGED_BUT_PARSEABLE',
    ).length;
    report.summary.reviewRequired = report.sourceResults.filter(
      (source) => source.outcome === 'REVIEW_REQUIRED',
    ).length;
    const criticalOutcomes = new Set<LiveSourceOutcome>([
      'FETCH_FAILED',
      'PARSE_FAILED',
      'WAITING_FOR_COMPANION',
    ]);
    report.summary.criticalFailures = report.sourceResults.filter(
      (source) => criticalOutcomes.has(source.outcome),
    ).length + missingCanonicalEvidence.length + (bundleComplete ? 0 : 1);
    report.summary.status = report.summary.criticalFailures > 0
      ? 'FAIL'
      : report.summary.reviewRequired > 0
        ? 'WARN'
        : 'PASS';
    report.completedAt = new Date().toISOString();
    await writeReports(report);

    if (report.summary.status === 'FAIL') {
      throw new Error('LIVE_GATE_CRITICAL_DRIFT');
    }
    console.log(`Live-source staging gate ${report.summary.status}; report=${reportPath}`);
  } catch (error) {
    if (!report.completedAt) report.completedAt = new Date().toISOString();
    if (!report.fatalError) report.fatalError = safeFatal(error);
    report.summary.status = 'FAIL';
    await writeReports(report);
    throw error;
  } finally {
    if (redis) await redis.quit();
    if (pool) await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
