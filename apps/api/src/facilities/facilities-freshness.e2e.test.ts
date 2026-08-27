import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../main.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('GET /v1/facilities assertion freshness', () => {
  let pool: InstanceType<typeof Pool>;
  let app: NestFastifyApplication;
  let sourceId: string;
  let artifactId: string;
  let facilityId: string;
  let assertionId: string;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const municipality = await pool.query<{ id: string }>(
      `SELECT id FROM municipalities WHERE terc = '3261011' LIMIT 1`,
    );
    const municipalityId = municipality.rows[0]?.id;
    if (!municipalityId) throw new Error('Koszalin pilot municipality missing');

    const source = await pool.query<{ id: string }>(
      `INSERT INTO sources (
         municipality_id, owner_type, owner_name, source_url, source_format, parser_key
       ) VALUES ($1, 'DEPOSIT_OPERATOR', 'Freshness test', $2, 'JSON', 'freshness-test-v1')
       RETURNING id`,
      [municipalityId, `https://example.test/facility-freshness/${suffix}`],
    );
    sourceId = source.rows[0]!.id;

    const artifact = await pool.query<{ id: string }>(
      `INSERT INTO source_artifacts (
         source_id, retrieved_at, sha256, storage_uri, parser_key, parser_version,
         extraction_confidence, status, parse_report
       ) VALUES (
         $1, now(), $2, $3, 'freshness-test-v1', '1.0.0', 1,
         'NORMALIZED', '{"freshnessTest":true}'::jsonb
       ) RETURNING id`,
      [sourceId, 'f'.repeat(64), `fixture://facility-freshness-${suffix}`],
    );
    artifactId = artifact.rows[0]!.id;

    const facility = await pool.query<{ id: string }>(
      `INSERT INTO facilities (
         municipality_id, canonical_key, kind, name, address_text, geom,
         external_ids, accepted_containers, operational_status,
         operational_status_observed_at, operational_status_source_artifact_id,
         location_source_artifact_id, verification_status, confidence, source_artifact_id
       ) VALUES (
         $1, $2, 'DEPOSIT_RVM', 'Freshness Test RVM', 'Testowa 88, Koszalin',
         ST_SetSRID(ST_MakePoint(16.18, 54.21), 4326),
         '[{"provider":"test","id":"freshness-rvm"}]'::jsonb,
         ARRAY['PET_BOTTLE']::text[], 'OPERATIONAL', now() - interval '2 hours', $3,
         $3, 'OFFICIAL_SOURCE', 1, $3
       ) RETURNING id`,
      [municipalityId, `freshness-test-${suffix}`, artifactId],
    );
    facilityId = facility.rows[0]!.id;

    const assertion = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         facility_id, source_artifact_id, source_key, source_authority, retrieved_at,
         static_freshness_seconds, status_freshness_seconds, kind, municipality_id,
         name, normalized_name, address_text, normalized_address, geom, external_ids,
         accepted_containers, operational_status, operational_status_observed_at,
         operational_status_source_key, fingerprint, reconciliation_state
       ) VALUES (
         $1, $2, 'freshness-test-source', 500, now(), 604800, 3600,
         'DEPOSIT_RVM', $3, 'Freshness Test RVM', 'freshness test rvm',
         'Testowa 88, Koszalin', 'testowa 88 koszalin',
         ST_SetSRID(ST_MakePoint(16.18, 54.21), 4326),
         '[{"namespace":"test","id":"freshness-rvm","role":"POINT"}]'::jsonb,
         ARRAY['PET_BOTTLE']::text[], 'OPERATIONAL', now() - interval '2 hours',
         'freshness-test-source', $4, 'CANONICAL'
       ) RETURNING id`,
      [facilityId, artifactId, municipalityId, `freshness-${suffix}`],
    );
    assertionId = assertion.rows[0]!.id;

    app = await createApp();
    app.useLogger(['error']);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (assertionId) await pool.query('DELETE FROM facility_source_assertions WHERE id = $1', [assertionId]);
    if (facilityId) await pool.query('DELETE FROM facilities WHERE id = $1', [facilityId]);
    if (sourceId) await pool.query('DELETE FROM sources WHERE id = $1', [sourceId]);
    await pool.end();
  });

  it('returns UNKNOWN instead of stale canonical OPERATIONAL and exposes assertion freshness', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/facilities?kind=DEPOSIT_RVM&terc=3261011&limit=200`,
    });
    expect(response.statusCode, response.body).toBe(200);

    const item = response.json().items.find(
      (candidate: { canonicalKey: string | null }) => candidate.canonicalKey === `freshness-test-${suffix}`,
    );
    expect(item).toBeTruthy();
    expect(item.operationalStatus).toEqual({ state: 'UNKNOWN', observedAt: null });
    expect(item.quality.warnings).toContain('OPERATIONAL_STATUS_STALE_IGNORED');
    expect(item.provenance.assertions).toHaveLength(1);
    expect(item.provenance.assertions[0]).toMatchObject({
      sourceKey: 'freshness-test-source',
      staticFreshnessState: 'CURRENT',
      operationalStatusStale: true,
    });
  });
});
