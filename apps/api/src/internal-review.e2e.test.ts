import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './main.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;
const ADMIN_KEY = 'review-e2e-admin-key';
const ACTOR = 'e2e-reviewer@wastepl.test';
const headers = { 'x-wastepl-admin-key': ADMIN_KEY, 'x-wastepl-actor': ACTOR };

integrationDescribe('internal data-ops review API', () => {
  let pool: InstanceType<typeof Pool>;
  let app: NestFastifyApplication;
  let sourceId: string;
  let artifactId: string;
  let geometryAssertionId: string;
  let geometryReviewId: string;
  let reconciliationAssertionId: string;
  let reconciliationReviewId: string;
  let candidateFacilityId: string;
  let rejectedAssertionId: string;
  let rejectedReviewId: string;

  beforeAll(async () => {
    process.env.WASTEPL_ADMIN_API_KEY = ADMIN_KEY;
    pool = new Pool({ connectionString: databaseUrl });
    const source = await pool.query<{ id: string }>(
      `SELECT id FROM sources
       WHERE source_url = 'https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-koszalin/'
       LIMIT 1`,
    );
    sourceId = source.rows[0]!.id;

    const artifact = await pool.query<{ id: string }>(
      `INSERT INTO source_artifacts (
         source_id, retrieved_at, sha256, storage_uri, parser_key, parser_version,
         extraction_confidence, status, parse_report
       ) VALUES (
         $1, now(), $2, 'fixture://review-e2e/pgk-main',
         'pgk-koszalin-pszok-html', '1.1.0', 0.99, 'NORMALIZED',
         '{"fixtureDerived":true,"reviewE2E":true}'::jsonb
       ) RETURNING id`,
      [sourceId, 'c'.repeat(64)],
    );
    artifactId = artifact.rows[0]!.id;

    const municipality = await pool.query<{ id: string }>(
      `SELECT id FROM municipalities WHERE terc='3261011' LIMIT 1`,
    );
    const municipalityId = municipality.rows[0]!.id;

    const geometryAssertion = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         source_artifact_id, source_key, source_authority, verification_status,
         confidence, retrieved_at, static_freshness_seconds, status_freshness_seconds,
         kind, municipality_id, name, normalized_name, address_text,
         normalized_address, external_ids, fingerprint, reconciliation_state
       ) VALUES (
         $1, 'pgk-koszalin-pszok-main', 200, 'REVIEW_REQUIRED',
         0.85, now(), 604800, 3600, 'PSZOK', $2,
         'PSZOK Na Skwierzynkę 2', 'pszok na skwierzynke 2', 'Na Skwierzynkę 2, Koszalin',
         'na skwierzynke 2 koszalin', '[]'::jsonb, 'review-e2e-skwierzynke', 'REVIEW_REQUIRED'
       ) RETURNING id`,
      [artifactId, municipalityId],
    );
    geometryAssertionId = geometryAssertion.rows[0]!.id;
    const geometryReview = await pool.query<{ id: string }>(
      `SELECT id FROM facility_data_quality_reviews
       WHERE assertion_id=$1 AND review_type='MISSING_TRUSTED_GEOMETRY'`,
      [geometryAssertionId],
    );
    geometryReviewId = geometryReview.rows[0]!.id;

    const candidate = await pool.query<{ id: string }>(
      `INSERT INTO facilities (
         municipality_id, canonical_key, kind, name, address_text, geom,
         verification_status, confidence, source_artifact_id, location_source_artifact_id
       ) VALUES (
         $1, $2, 'PSZOK', 'Candidate PSZOK', 'Komunalna 5, Koszalin',
         ST_SetSRID(ST_MakePoint(16.183616,54.212266),4326),
         'OFFICIAL_SOURCE', 0.99, $3, $3
       ) RETURNING id`,
      [municipalityId, `review-e2e-candidate-${Date.now()}`, artifactId],
    );
    candidateFacilityId = candidate.rows[0]!.id;

    const reconciliationAssertion = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         source_artifact_id, source_key, source_authority, verification_status,
         confidence, retrieved_at, static_freshness_seconds, status_freshness_seconds,
         kind, municipality_id, name, normalized_name, address_text,
         normalized_address, geom, external_ids, fingerprint, reconciliation_state
       ) VALUES (
         $1, 'review-e2e-source', 100, 'UNVERIFIED', 0.8, now(), 604800, 3600,
         'PSZOK', $2, 'Candidate PSZOK', 'candidate pszok', 'Komunalna 5, Koszalin',
         'komunalna 5 koszalin', ST_SetSRID(ST_MakePoint(16.183620,54.212270),4326),
         '[]'::jsonb, 'review-e2e-reconciliation', 'REVIEW_REQUIRED'
       ) RETURNING id`,
      [artifactId, municipalityId],
    );
    reconciliationAssertionId = reconciliationAssertion.rows[0]!.id;
    const reconciliationReview = await pool.query<{ id: string }>(
      `INSERT INTO facility_reconciliation_reviews (
         assertion_id, candidate_facility_id, score, reasons
       ) VALUES ($1,$2,0.91,'["NAME_EXACT","WITHIN_150M"]'::jsonb)
       RETURNING id`,
      [reconciliationAssertionId, candidateFacilityId],
    );
    reconciliationReviewId = reconciliationReview.rows[0]!.id;

    const rejectedAssertion = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         source_artifact_id, source_key, source_authority, verification_status,
         confidence, retrieved_at, static_freshness_seconds, status_freshness_seconds,
         kind, municipality_id, name, normalized_name, address_text,
         normalized_address, geom, external_ids, fingerprint, reconciliation_state
       ) VALUES (
         $1, 'review-e2e-reject-source', 50, 'UNVERIFIED', 0.7, now(), 604800, 3600,
         'PSZOK', $2, 'Wrong candidate', 'wrong candidate', 'Other address',
         'other address', ST_SetSRID(ST_MakePoint(16.183700,54.212300),4326),
         '[]'::jsonb, 'review-e2e-reject', 'REVIEW_REQUIRED'
       ) RETURNING id`,
      [artifactId, municipalityId],
    );
    rejectedAssertionId = rejectedAssertion.rows[0]!.id;
    const rejectedReview = await pool.query<{ id: string }>(
      `INSERT INTO facility_reconciliation_reviews (
         assertion_id, candidate_facility_id, score, reasons
       ) VALUES ($1,$2,0.72,'["PROXIMITY_ONLY"]'::jsonb)
       RETURNING id`,
      [rejectedAssertionId, candidateFacilityId],
    );
    rejectedReviewId = rejectedReview.rows[0]!.id;

    app = await createApp();
    app.useLogger(['error']);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (pool) {
      await pool.query(`DELETE FROM review_decision_audit WHERE review_id = ANY($1::uuid[])`, [[geometryReviewId, reconciliationReviewId, rejectedReviewId]]);
      await pool.query(`DELETE FROM facility_reconciliation_reviews WHERE id = ANY($1::uuid[])`, [[reconciliationReviewId, rejectedReviewId]]);
      await pool.query(`DELETE FROM facility_data_quality_reviews WHERE assertion_id = ANY($1::uuid[])`, [[geometryAssertionId, reconciliationAssertionId, rejectedAssertionId]]);
      await pool.query(`DELETE FROM facility_source_assertions WHERE id = ANY($1::uuid[])`, [[geometryAssertionId, reconciliationAssertionId, rejectedAssertionId]]);
      await pool.query(`DELETE FROM facilities WHERE id=$1`, [candidateFacilityId]);
      await pool.query(`DELETE FROM source_artifacts WHERE id=$1`, [artifactId]);
      await pool.end();
    }
    delete process.env.WASTEPL_ADMIN_API_KEY;
  });

  it('is not accessible without the internal admin key', async () => {
    const response = await app.inject({ method: 'GET', url: '/internal/v1/reviews', headers: { 'x-wastepl-actor': ACTOR } });
    expect(response.statusCode).toBe(401);
  });

  it('lists Na Skwierzynkę 2 as a source-backed missing-geometry review', async () => {
    const response = await app.inject({ method: 'GET', url: '/internal/v1/reviews?state=PENDING&limit=200', headers });
    expect(response.statusCode, response.body).toBe(200);
    const review = response.json().items.find((item: { id: string }) => item.id === geometryReviewId);
    expect(review).toMatchObject({
      kind: 'DATA_QUALITY',
      reviewType: 'MISSING_TRUSTED_GEOMETRY',
      assertion: {
        id: geometryAssertionId,
        name: 'PSZOK Na Skwierzynkę 2',
        location: null,
        source: {
          artifactSha256: 'c'.repeat(64),
          parserVersion: '1.1.0',
        },
      },
    });
  });

  it('approves source-backed geometry, records actor/audit, and rejects repeat decisions deterministically', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/internal/v1/reviews/DATA_QUALITY/${geometryReviewId}/decision`,
      headers: { ...headers, 'content-type': 'application/json' },
      payload: {
        decision: 'APPROVE',
        note: 'Coordinates manually verified in the source artifact.',
        geometry: { lat: 54.2101, lon: 16.1755, sourceArtifactId: artifactId },
      },
    });
    expect(response.statusCode, response.body).toBe(201);

    const assertion = await pool.query<{ state: string; lat: number; lon: number }>(
      `SELECT reconciliation_state AS state, ST_Y(geom) AS lat, ST_X(geom) AS lon
       FROM facility_source_assertions WHERE id=$1`,
      [geometryAssertionId],
    );
    expect(assertion.rows[0]?.state).toBe('UNMATCHED');
    expect(Number(assertion.rows[0]?.lat)).toBeCloseTo(54.2101, 5);
    expect(Number(assertion.rows[0]?.lon)).toBeCloseTo(16.1755, 5);

    const repeated = await app.inject({
      method: 'POST',
      url: `/internal/v1/reviews/DATA_QUALITY/${geometryReviewId}/decision`,
      headers: { ...headers, 'content-type': 'application/json' },
      payload: { decision: 'REJECT', note: 'repeat must not change state' },
    });
    expect(repeated.statusCode).toBe(409);

    const audit = await app.inject({
      method: 'GET',
      url: `/internal/v1/reviews/audit?kind=DATA_QUALITY&reviewId=${geometryReviewId}`,
      headers,
    });
    expect(audit.statusCode, audit.body).toBe(200);
    expect(audit.json().items).toHaveLength(1);
    expect(audit.json().items[0]).toMatchObject({ actor: ACTOR, decision: 'APPROVE' });
  });

  it('approves reconciliation atomically without deleting the assertion', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/internal/v1/reviews/RECONCILIATION/${reconciliationReviewId}/decision`,
      headers: { ...headers, 'content-type': 'application/json' },
      payload: { decision: 'APPROVE', note: 'Same physical PSZOK.' },
    });
    expect(response.statusCode, response.body).toBe(201);

    const assertion = await pool.query<{ facility_id: string | null; reconciliation_state: string }>(
      `SELECT facility_id, reconciliation_state FROM facility_source_assertions WHERE id=$1`,
      [reconciliationAssertionId],
    );
    expect(assertion.rows[0]).toEqual({ facility_id: candidateFacilityId, reconciliation_state: 'CANONICAL' });
  });

  it('rejects a candidate without touching canonical data', async () => {
    const before = await pool.query<{ name: string }>('SELECT name FROM facilities WHERE id=$1', [candidateFacilityId]);
    const response = await app.inject({
      method: 'POST',
      url: `/internal/v1/reviews/RECONCILIATION/${rejectedReviewId}/decision`,
      headers: { ...headers, 'content-type': 'application/json' },
      payload: { decision: 'REJECT', note: 'Only proximity matched.' },
    });
    expect(response.statusCode, response.body).toBe(201);

    const assertion = await pool.query<{ facility_id: string | null; reconciliation_state: string }>(
      `SELECT facility_id, reconciliation_state FROM facility_source_assertions WHERE id=$1`,
      [rejectedAssertionId],
    );
    expect(assertion.rows[0]).toEqual({ facility_id: null, reconciliation_state: 'REVIEW_REQUIRED' });
    const after = await pool.query<{ name: string }>('SELECT name FROM facilities WHERE id=$1', [candidateFacilityId]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});
