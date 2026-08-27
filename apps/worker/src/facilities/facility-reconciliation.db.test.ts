import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('facility reconciliation persistence', () => {
  let pool: InstanceType<typeof Pool>;
  let municipalityId: string;
  let facilityId: string;
  const sourceIds: string[] = [];
  const artifactIds: string[] = [];
  const assertionIds: string[] = [];
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const municipality = await pool.query<{ id: string }>(
      `SELECT id FROM municipalities WHERE terc = '3261011' LIMIT 1`,
    );
    municipalityId = municipality.rows[0]?.id ?? '';
    if (!municipalityId) throw new Error('Expected Koszalin pilot municipality');

    for (const [index, marker] of ['a', 'b'].entries()) {
      const source = await pool.query<{ id: string }>(
        `INSERT INTO sources (
           municipality_id, owner_type, owner_name, source_url, source_format, parser_key
         ) VALUES ($1, 'TEST', 'Reconciliation test', $2, 'JSON', 'test-facility-v1')
         RETURNING id`,
        [municipalityId, `https://example.test/facility-reconciliation/${suffix}/${marker}`],
      );
      const sourceId = source.rows[0]!.id;
      sourceIds.push(sourceId);

      const artifact = await pool.query<{ id: string }>(
        `INSERT INTO source_artifacts (
           source_id, retrieved_at, sha256, storage_uri, parser_key, parser_version,
           extraction_confidence, status, parse_report
         ) VALUES ($1, now(), $2, $3, 'test-facility-v1', '1.0.0', 1, 'NORMALIZED', '{}'::jsonb)
         RETURNING id`,
        [sourceId, marker.repeat(64), `s3://test/${suffix}/${marker}`],
      );
      artifactIds.push(artifact.rows[0]!.id);
    }

    const facility = await pool.query<{ id: string }>(
      `INSERT INTO facilities (
         municipality_id, kind, canonical_key, name, address_text, geom,
         external_ids, accepted_materials, operational_status,
         verification_status, confidence, source_artifact_id, location_source_artifact_id
       ) VALUES (
         $1, 'PSZOK', $2, 'Reconciliation canonical PSZOK', 'Komunalna 5, Koszalin',
         ST_SetSRID(ST_MakePoint(16.183616, 54.212266), 4326),
         '[]'::jsonb, ARRAY['TYRES']::text[], 'UNKNOWN', 'OFFICIAL_SOURCE', 1, $3, $3
       ) RETURNING id`,
      [municipalityId, `db-reconciliation-${suffix}`, artifactIds[0]],
    );
    facilityId = facility.rows[0]!.id;
  });

  afterAll(async () => {
    if (assertionIds.length) {
      await pool.query('DELETE FROM facility_source_assertions WHERE id = ANY($1::uuid[])', [assertionIds]);
    }
    if (facilityId) await pool.query('DELETE FROM facilities WHERE id = $1', [facilityId]);
    if (artifactIds.length) await pool.query('DELETE FROM source_artifacts WHERE id = ANY($1::uuid[])', [artifactIds]);
    if (sourceIds.length) await pool.query('DELETE FROM sources WHERE id = ANY($1::uuid[])', [sourceIds]);
    await pool.end();
  });

  it('retains multiple source assertions and provider ids on one canonical facility', async () => {
    for (let index = 0; index < 2; index += 1) {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO facility_source_assertions (
           facility_id, source_artifact_id, source_key, source_authority, retrieved_at,
           static_freshness_seconds, status_freshness_seconds, kind, municipality_id,
           name, normalized_name, address_text, normalized_address, geom, external_ids,
           accepted_materials, fingerprint, reconciliation_state
         ) VALUES (
           $1, $2, $3, $4, now(), 604800, 3600, 'PSZOK', $5,
           'PSZOK Komunalna 5', 'pszok komunalna 5', 'Komunalna 5, Koszalin',
           'komunalna 5 koszalin', ST_SetSRID(ST_MakePoint(16.183616,54.212266),4326),
           $6::jsonb, ARRAY['TYRES']::text[], $7, 'CANONICAL'
         ) RETURNING id`,
        [
          facilityId,
          artifactIds[index],
          `source-${index}`,
          index === 0 ? 400 : 300,
          municipalityId,
          JSON.stringify([{ namespace: `provider-${index}`, id: `point-${index}`, role: 'POINT' }]),
          `fingerprint-${suffix}-${index}`,
        ],
      );
      assertionIds.push(inserted.rows[0]!.id);
    }

    const rows = await pool.query<{ external_ids: Array<{ namespace: string; id: string }> }>(
      `SELECT external_ids FROM facility_source_assertions
       WHERE facility_id = $1 ORDER BY source_authority DESC`,
      [facilityId],
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]?.external_ids[0]).toMatchObject({ namespace: 'provider-0', id: 'point-0' });
    expect(rows.rows[1]?.external_ids[0]).toMatchObject({ namespace: 'provider-1', id: 'point-1' });
  });

  it('keeps review-required candidates auditable instead of attaching them', async () => {
    const assertion = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         facility_id, source_artifact_id, source_key, source_authority, retrieved_at,
         static_freshness_seconds, status_freshness_seconds, kind, municipality_id,
         name, normalized_name, address_text, normalized_address, fingerprint,
         reconciliation_state
       ) VALUES (
         NULL, $1, 'review-source', 200, now(), 604800, 3600, 'PSZOK', $2,
         'Punkt komunalny', 'punkt komunalny', 'Komunalna 7, Koszalin',
         'komunalna 7 koszalin', $3, 'REVIEW_REQUIRED'
       ) RETURNING id`,
      [artifactIds[1], municipalityId, `review-${suffix}`],
    );
    const assertionId = assertion.rows[0]!.id;
    assertionIds.push(assertionId);

    await pool.query(
      `INSERT INTO facility_reconciliation_reviews (
         assertion_id, candidate_facility_id, score, reasons
       ) VALUES ($1, $2, 0.7300, '["EXACT_NORMALIZED_ADDRESS","WITHIN_100M"]'::jsonb)`,
      [assertionId, facilityId],
    );

    const review = await pool.query<{ state: string; facility_id: string | null }>(
      `SELECT r.state, a.facility_id
       FROM facility_reconciliation_reviews r
       JOIN facility_source_assertions a ON a.id = r.assertion_id
       WHERE r.assertion_id = $1`,
      [assertionId],
    );
    expect(review.rows[0]).toEqual({ state: 'PENDING', facility_id: null });
  });

  it('projects stale assertions and degrades stale operational state to UNKNOWN', async () => {
    const stale = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         facility_id, source_artifact_id, source_key, source_authority, retrieved_at,
         static_freshness_seconds, status_freshness_seconds, kind, municipality_id,
         name, normalized_name, normalized_address, operational_status,
         operational_status_observed_at, operational_status_source_key,
         fingerprint, reconciliation_state
       ) VALUES (
         NULL, $1, 'stale-source', 500, now() - interval '8 days',
         86400, 3600, 'DEPOSIT_RVM', $2,
         'Stale RVM', 'stale rvm', 'test 1 koszalin', 'OPERATIONAL',
         now() - interval '2 hours', 'telemetry-source', $3, 'UNMATCHED'
       ) RETURNING id`,
      [artifactIds[1], municipalityId, `stale-${suffix}`],
    );
    assertionIds.push(stale.rows[0]!.id);

    const projected = await pool.query<{
      static_freshness_state: string;
      effective_operational_status: string;
      operational_status_stale: boolean;
    }>(
      `SELECT static_freshness_state, effective_operational_status, operational_status_stale
       FROM facility_source_assertion_freshness WHERE id = $1`,
      [stale.rows[0]!.id],
    );

    expect(projected.rows[0]).toEqual({
      static_freshness_state: 'STALE',
      effective_operational_status: 'UNKNOWN',
      operational_status_stale: true,
    });
  });
});
