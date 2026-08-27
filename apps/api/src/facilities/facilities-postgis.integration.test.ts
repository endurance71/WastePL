import pg from 'pg';
import { describe, expect, it } from 'vitest';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('facilities PostGIS query plan', () => {
  it('can use idx_facilities_geog for meter-based ST_DWithin queries', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query('SET enable_seqscan = off');
      const plan = await pool.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (COSTS OFF)
         SELECT id
         FROM facilities
         WHERE geom IS NOT NULL
           AND ST_DWithin(
             geom::geography,
             ST_SetSRID(ST_MakePoint(16.183616, 54.212266), 4326)::geography,
             1000
           )`,
      );
      const text = plan.rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(text).toContain('idx_facilities_geog');
    } finally {
      await pool.end();
    }
  });
});
