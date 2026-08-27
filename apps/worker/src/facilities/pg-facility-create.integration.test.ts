import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { PgFacilityReconciliationRepository } from './pg-facility-reconciliation-repository.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationIt = databaseUrl ? it : it.skip;

describe('PgFacilityReconciliationRepository create canonical', () => {
  integrationIt('creates a canonical facility from an unmatched source assertion', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    let assertionId: string | null = null;
    let facilityId: string | null = null;
    try {
      const seed = await pool.query<{ municipality_id: string; artifact_id: string }>(
        `SELECT m.id AS municipality_id, sa.id AS artifact_id
         FROM municipalities m
         CROSS JOIN LATERAL (
           SELECT id FROM source_artifacts ORDER BY retrieved_at DESC, id LIMIT 1
         ) sa
         WHERE m.terc = '3261011'
         LIMIT 1`,
      );
      const row = seed.rows[0];
      if (!row) throw new Error('Expected pilot municipality and source artifact');

      const assertion = await pool.query<{ id: string }>(
        `INSERT INTO facility_source_assertions (
           source_artifact_id, source_key, source_authority, verification_status, confidence,
           retrieved_at, static_freshness_seconds, status_freshness_seconds,
           kind, municipality_id, name, normalized_name, address_text, normalized_address,
           geom, external_ids, accepted_materials, fingerprint, reconciliation_state
         ) VALUES (
           $1, 'create-canonical-test', 300, 'OFFICIAL_SOURCE', 0.97,
           now(), 604800, 3600, 'PSZOK', $2,
           'Create Canonical Test PSZOK', 'create canonical test pszok',
           'Testowa 123, Koszalin', 'testowa 123 koszalin',
           ST_SetSRID(ST_MakePoint(16.17,54.20),4326),
           '[{"namespace":"test","id":"create-canonical-1","role":"POINT"}]'::jsonb,
           ARRAY['BULKY']::text[], $3, 'UNMATCHED'
         ) RETURNING id`,
        [row.artifact_id, row.municipality_id, `create-canonical-${Date.now()}`],
      );
      assertionId = assertion.rows[0]!.id;

      const repository = new PgFacilityReconciliationRepository(pool);
      facilityId = await repository.createCanonicalFacility(assertionId);

      const persisted = await pool.query<{
        canonical_key: string;
        verification_status: string;
        confidence: string | number;
        assertion_facility_id: string;
        reconciliation_state: string;
      }>(
        `SELECT f.canonical_key, f.verification_status, f.confidence,
                a.facility_id AS assertion_facility_id, a.reconciliation_state
         FROM facilities f
         JOIN facility_source_assertions a ON a.facility_id = f.id
         WHERE f.id = $1 AND a.id = $2`,
        [facilityId, assertionId],
      );

      expect(persisted.rows[0]).toMatchObject({
        canonical_key: `assertion:${assertionId}`,
        verification_status: 'OFFICIAL_SOURCE',
        assertion_facility_id: facilityId,
        reconciliation_state: 'CANONICAL',
      });
      expect(Number(persisted.rows[0]!.confidence)).toBe(0.97);
    } finally {
      if (assertionId) await pool.query('DELETE FROM facility_source_assertions WHERE id = $1', [assertionId]);
      if (facilityId) await pool.query('DELETE FROM facilities WHERE id = $1', [facilityId]);
      await pool.end();
    }
  });
});
