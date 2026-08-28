import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './main.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;
const ADMIN_KEY = 'source-ops-e2e-admin-key';
const ACTOR = 'source-ops-e2e@wastepl.test';
const headers = { 'x-wastepl-admin-key': ADMIN_KEY, 'x-wastepl-actor': ACTOR };

integrationDescribe('internal source-ops API', () => {
  let pool: InstanceType<typeof Pool>;
  let app: NestFastifyApplication;
  let sourceId: string;
  let artifactId: string;
  const coverageSourceIds: string[] = [];
  const sourceKey = `source-ops-e2e-${Date.now()}`;
  const sourceUrl = `https://example.invalid/wastepl/${sourceKey}`;
  const coveragePrefix = `source-ops-coverage-${Date.now()}`;
  const oldManifest = 'source-ops-e2e@2099.1';
  const latestManifest = 'source-ops-e2e@2099.10';
  const secretStorageUri = 's3://do-not-expose-bucket/private/source-object';
  const secretRawError = 'SECRET upstream body contained credentials-like diagnostic text';

  beforeAll(async () => {
    process.env.WASTEPL_ADMIN_API_KEY = ADMIN_KEY;
    pool = new Pool({ connectionString: databaseUrl });

    const municipality = await pool.query<{ id: string }>(
      `SELECT id FROM municipalities WHERE terc = '3261011' LIMIT 1`,
    );
    const municipalityId = municipality.rows[0]!.id;

    const source = await pool.query<{ id: string }>(
      `INSERT INTO sources (
         municipality_id, owner_type, owner_name, source_url, source_format,
         parser_key, poll_interval_minutes, active, source_key, data_type,
         manifest_status, health_status, consecutive_failures,
         last_checked_at, next_check_at, last_success_at, last_failure_at,
         last_error_code, last_error_message, source_shape, evidence_status,
         activation_blocker, assessed_at
       ) VALUES (
         $1, 'MUNICIPALITY', 'Source Ops E2E', $2, 'HTML',
         'source-ops-e2e-parser', 60, true, $3, 'OTHER',
         'ACTIVE', 'PARSE_FAILED', 3,
         now() - interval '3 hours', now() - interval '2 hours',
         now() - interval '1 day', now() - interval '2 hours',
         'E2E_PARSE_FAILED', $4, 'DIRECT_CONTENT', 'VERIFIED',
         NULL, now() - interval '1 minute'
       ) RETURNING id`,
      [municipalityId, sourceUrl, sourceKey, secretRawError],
    );
    sourceId = source.rows[0]!.id;

    const coverageSources = await pool.query<{ id: string }>(
      `INSERT INTO sources (
         municipality_id, owner_type, owner_name, source_url, source_format,
         parser_key, poll_interval_minutes, active, source_key, data_type,
         manifest_status, manifest_version, health_status, consecutive_failures,
         last_checked_at, next_check_at
       ) VALUES
         ($1, 'MUNICIPALITY', 'Coverage old active', $2, 'HTML', 'coverage-e2e-parser', 1440,
          true, $3, 'ALERTS', 'ACTIVE', $4, 'HEALTHY', 0, now(), now() + interval '1 day'),
         ($1, 'MUNICIPALITY', 'Coverage latest active', $5, 'HTML', 'coverage-e2e-parser', 1440,
          true, $6, 'ALERTS', 'ACTIVE', $7, 'HEALTHY', 0, now(), now() + interval '1 day'),
         ($1, 'MUNICIPALITY', 'Coverage latest planned', $8, 'HTML', NULL, 1440,
          false, $9, 'ALERTS', 'PLANNED', $7, 'UNKNOWN', 0, NULL, NULL)
       RETURNING id`,
      [
        municipalityId,
        `https://example.invalid/wastepl/${coveragePrefix}-old-active`,
        `${coveragePrefix}-old-active`,
        oldManifest,
        `https://example.invalid/wastepl/${coveragePrefix}-latest-active`,
        `${coveragePrefix}-latest-active`,
        latestManifest,
        `https://example.invalid/wastepl/${coveragePrefix}-latest-planned`,
        `${coveragePrefix}-latest-planned`,
      ],
    );
    coverageSourceIds.push(...coverageSources.rows.map((row) => row.id));

    const artifact = await pool.query<{ id: string }>(
      `INSERT INTO source_artifacts (
         source_id, retrieved_at, sha256, storage_uri, parser_key, parser_version,
         extraction_confidence, status, parse_report
       ) VALUES (
         $1, now() - interval '2 hours', $2, $3,
         'source-ops-e2e-parser', '9.9.9', 0.75, 'REVIEW_REQUIRED',
         '{"e2e":true}'::jsonb
       ) RETURNING id`,
      [sourceId, 'd'.repeat(64), secretStorageUri],
    );
    artifactId = artifact.rows[0]!.id;

    await pool.query(
      `INSERT INTO source_processing_attempts (
         source_id, artifact_id, started_at, completed_at, outcome,
         parser_key, error_code, error_message, metadata
       ) VALUES (
         $1, $2, now() - interval '119 minutes', now() - interval '118 minutes',
         'PARSE_FAILED', 'source-ops-e2e-parser', 'E2E_PARSE_FAILED', $3,
         '{"safe":"metadata"}'::jsonb
       )`,
      [sourceId, artifactId, secretRawError],
    );

    app = await createApp();
    app.useLogger(['error']);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (pool) {
      await pool.query('DELETE FROM source_processing_attempts WHERE source_id = $1', [sourceId]);
      await pool.query('DELETE FROM artifact_processing_outbox WHERE source_id = $1', [sourceId]);
      await pool.query('DELETE FROM source_artifacts WHERE source_id = $1', [sourceId]);
      await pool.query('DELETE FROM sources WHERE id = $1', [sourceId]);
      if (coverageSourceIds.length > 0) {
        await pool.query('DELETE FROM sources WHERE id = ANY($1::uuid[])', [coverageSourceIds]);
      }
      await pool.end();
    }
    delete process.env.WASTEPL_ADMIN_API_KEY;
  });

  it('requires the internal admin key and actor', async () => {
    const missingKey = await app.inject({
      method: 'GET',
      url: '/internal/v1/source-ops/summary',
      headers: { 'x-wastepl-actor': ACTOR },
    });
    expect(missingKey.statusCode).toBe(401);

    const missingActor = await app.inject({
      method: 'GET',
      url: '/internal/v1/source-ops/summary',
      headers: { 'x-wastepl-admin-key': ADMIN_KEY },
    });
    expect(missingActor.statusCode).toBe(400);
    expect(missingActor.json()).toMatchObject({ code: 'ACTOR_REQUIRED' });
  });

  it('filters one source and exposes safe operational provenance without raw secrets', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/internal/v1/source-ops/sources?sourceKey=${sourceKey}&terc=3261011&dataType=OTHER&manifestStatus=ACTIVE&healthStatus=PARSE_FAILED&stale=true`,
      headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json();
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: sourceId,
      sourceKey,
      municipality: { terc: '3261011', name: 'Koszalin' },
      dataType: 'OTHER',
      manifest: { status: 'ACTIVE', schedulable: true },
      health: {
        status: 'PARSE_FAILED',
        stale: true,
        consecutiveFailures: 3,
        lastErrorCode: 'E2E_PARSE_FAILED',
      },
      latestArtifact: {
        id: artifactId,
        sha256: 'd'.repeat(64),
        status: 'REVIEW_REQUIRED',
        parserKey: 'source-ops-e2e-parser',
        parserVersion: '9.9.9',
      },
      latestProcessing: {
        outcome: 'PARSE_FAILED',
        parserKey: 'source-ops-e2e-parser',
        errorCode: 'E2E_PARSE_FAILED',
      },
    });

    expect(response.body).not.toContain(secretStorageUri);
    expect(response.body).not.toContain(secretRawError);
    expect(response.body).not.toContain('last_error_message');
    expect(response.body).not.toContain('storage_uri');
  });

  it('keeps PLANNED sources distinct and defaults coverage to the naturally latest manifest version', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/internal/v1/source-ops/coverage',
      headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json();
    expect(body.manifestVersion).toBe(latestManifest);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      terc: '3261011',
      municipalityName: 'Koszalin',
      dataType: 'ALERTS',
      activeEntries: 1,
      plannedEntries: 1,
      schedulableEntries: 1,
      healthyEntries: 1,
      failingEntries: 0,
      staleEntries: 0,
    });
  });

  it('supports an explicit older manifest without mixing newer rows', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/internal/v1/source-ops/coverage?manifestVersion=${oldManifest}`,
      headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json();
    expect(body.manifestVersion).toBe(oldManifest);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      terc: '3261011',
      dataType: 'ALERTS',
      activeEntries: 1,
      plannedEntries: 0,
      schedulableEntries: 1,
      healthyEntries: 1,
    });
  });

  it('summarizes source health, processing and review queues in one request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/internal/v1/source-ops/summary',
      headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      sources: {
        total: expect.any(Number),
        active: expect.any(Number),
        planned: expect.any(Number),
        failing: expect.any(Number),
        stale: expect.any(Number),
      },
      processing: {
        pendingOutbox: expect.any(Number),
        enqueuedWithoutTerminalAttempt: expect.any(Number),
      },
      reviews: {
        reconciliationPending: expect.any(Number),
        dataQualityPending: expect.any(Number),
      },
    });
    expect(response.json().sources.failing).toBeGreaterThanOrEqual(1);
    expect(response.json().sources.stale).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid filters deterministically', async () => {
    const invalidTerc = await app.inject({
      method: 'GET',
      url: '/internal/v1/source-ops/sources?terc=32610',
      headers,
    });
    expect(invalidTerc.statusCode).toBe(400);
    expect(invalidTerc.json()).toMatchObject({ code: 'INVALID_TERC' });

    const invalidStale = await app.inject({
      method: 'GET',
      url: '/internal/v1/source-ops/sources?stale=maybe',
      headers,
    });
    expect(invalidStale.statusCode).toBe(400);
    expect(invalidStale.json()).toMatchObject({ code: 'INVALID_BOOLEAN' });

    const invalidManifest = await app.inject({
      method: 'GET',
      url: '/internal/v1/source-ops/coverage?manifestVersion=not-a-version',
      headers,
    });
    expect(invalidManifest.statusCode).toBe(400);
    expect(invalidManifest.json()).toMatchObject({ code: 'INVALID_MANIFEST_VERSION' });
  });
});
