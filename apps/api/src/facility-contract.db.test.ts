import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('facility v0.2 PostgreSQL invariants', () => {
  let pool: InstanceType<typeof Pool>;
  let artifactId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const artifact = await pool.query<{ id: string }>(
      'SELECT id FROM source_artifacts ORDER BY retrieved_at DESC, id LIMIT 1',
    );
    artifactId = artifact.rows[0]?.id ?? '';
    if (!artifactId) throw new Error('Expected a source artifact from pilot migrations');
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM facilities WHERE canonical_key LIKE 'db-contract-%'`);
    await pool.end();
  });

  it('allows an official-address facility without fabricated coordinates', async () => {
    const result = await pool.query<{ geom: unknown; operational_status: string }>(
      `INSERT INTO facilities (
         canonical_key, kind, name, address_text, accepted_materials,
         operational_status, source_artifact_id
       )
       VALUES (
         'db-contract-pszok-no-coordinates', 'PSZOK', 'DB contract PSZOK',
         'Source-backed address without trusted coordinates',
         ARRAY['TEXTILES','BULKY']::text[], 'UNKNOWN', $1
       )
       RETURNING geom, operational_status`,
      [artifactId],
    );

    expect(result.rows[0]?.geom).toBeNull();
    expect(result.rows[0]?.operational_status).toBe('UNKNOWN');
  });

  it('rejects OPERATIONAL without observation/source provenance', async () => {
    await expect(
      pool.query(
        `INSERT INTO facilities (
           canonical_key, kind, name, accepted_containers,
           operational_status, source_artifact_id
         )
         VALUES (
           'db-contract-rvm-invalid-status', 'DEPOSIT_RVM', 'Invalid status RVM',
           ARRAY['PET_BOTTLE']::text[], 'OPERATIONAL', $1
         )`,
        [artifactId],
      ),
    ).rejects.toMatchObject({
      constraint: 'facilities_operational_status_provenance_check',
    });
  });

  it('accepts a source-backed operational deposit point', async () => {
    const result = await pool.query<{ operational_status: string }>(
      `INSERT INTO facilities (
         canonical_key, kind, name, accepted_containers, operational_status,
         operational_status_observed_at, operational_status_source_artifact_id,
         source_artifact_id
       )
       VALUES (
         'db-contract-rvm-valid-status', 'DEPOSIT_RVM', 'Valid status RVM',
         ARRAY['PET_BOTTLE','METAL_CAN']::text[], 'OPERATIONAL',
         '2026-08-27T17:00:00Z'::timestamptz, $1, $1
       )
       RETURNING operational_status`,
      [artifactId],
    );

    expect(result.rows[0]?.operational_status).toBe('OPERATIONAL');
  });
});
