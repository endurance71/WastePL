import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { PgBundleAwareSourceRegistry } from './bundle-aware-source-registry.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationIt = databaseUrl ? it : it.skip;

describe('PgBundleAwareSourceRegistry', () => {
  integrationIt('keeps WAITING across unchanged polls and recovers to HEALTHY on bundle completion', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const token = randomUUID();
    let sourceId: string | null = null;

    try {
      const source = await pool.query<{ id: string }>(
        `INSERT INTO sources (
           municipality_id, owner_type, owner_name, source_url, source_format,
           parser_key, poll_interval_minutes, active, source_key,
           bundle_key, bundle_role, bundle_required_roles, bundle_freshness_minutes
         )
         SELECT
           m.id, 'OTHER_OFFICIAL', 'WastePL bundle lifecycle test', $1, 'HTML',
           'pgk-koszalin-pszok-html', 1440, true, $2,
           $3, 'main', '["main","faq"]'::jsonb, 1440
         FROM municipalities m
         WHERE m.terc = '3261011'
         RETURNING id`,
        [
          `https://example.invalid/wastepl-bundle-test/${token}`,
          `bundle-health-test-${token}`,
          `bundle-health-${token}`,
        ],
      );
      sourceId = source.rows[0]?.id ?? null;
      if (!sourceId) throw new Error('Failed to create temporary bundle source');

      const artifact = await pool.query<{ id: string }>(
        `INSERT INTO source_artifacts (
           source_id, retrieved_at, sha256, storage_uri, parser_key, status
         ) VALUES ($1, now(), $2, $3, 'pgk-koszalin-pszok-html', 'FETCHED')
         RETURNING id`,
        [sourceId, token.replaceAll('-', '').padEnd(64, '0').slice(0, 64), `memory://bundle-health/${token}`],
      );
      const artifactId = artifact.rows[0]!.id;
      const registry = new PgBundleAwareSourceRegistry(pool);
      const startedAt = new Date();

      await registry.markSourceProcessingState({
        sourceId,
        artifactId,
        startedAt,
        completedAt: new Date(startedAt.getTime() + 1000),
        outcome: 'WAITING_FOR_COMPANION',
        parserKey: 'pgk-koszalin-pszok-html',
        errorCode: null,
        errorMessage: null,
        metadata: { missingArtifactRoles: ['faq'] },
      });

      let state = await pool.query<{ health_status: string; consecutive_failures: number }>(
        'SELECT health_status, consecutive_failures FROM sources WHERE id = $1',
        [sourceId],
      );
      expect(state.rows[0]).toMatchObject({
        health_status: 'WAITING_FOR_COMPANION',
        consecutive_failures: 0,
      });

      await registry.markSourceChecked(sourceId, {
        checkedAt: new Date(startedAt.getTime() + 2000),
        etag: null,
        lastModified: null,
        sha256: null,
        healthStatus: 'UNCHANGED',
      });

      state = await pool.query<{ health_status: string; consecutive_failures: number }>(
        'SELECT health_status, consecutive_failures FROM sources WHERE id = $1',
        [sourceId],
      );
      expect(state.rows[0]).toMatchObject({
        health_status: 'WAITING_FOR_COMPANION',
        consecutive_failures: 0,
      });

      await registry.markSourceProcessingState({
        sourceId,
        artifactId,
        startedAt: new Date(startedAt.getTime() + 3000),
        completedAt: new Date(startedAt.getTime() + 4000),
        outcome: 'PUBLISHED',
        parserKey: 'pgk-koszalin-pszok-html',
        errorCode: null,
        errorMessage: null,
        metadata: { companionCompletion: true },
      });

      state = await pool.query<{ health_status: string; consecutive_failures: number }>(
        'SELECT health_status, consecutive_failures FROM sources WHERE id = $1',
        [sourceId],
      );
      expect(state.rows[0]).toMatchObject({
        health_status: 'HEALTHY',
        consecutive_failures: 0,
      });

      const attempts = await pool.query<{ outcome: string }>(
        `SELECT outcome
         FROM source_processing_attempts
         WHERE source_id = $1
         ORDER BY id`,
        [sourceId],
      );
      expect(attempts.rows.map((row) => row.outcome)).toEqual([
        'WAITING_FOR_COMPANION',
        'PUBLISHED',
      ]);
    } finally {
      if (sourceId) await pool.query('DELETE FROM sources WHERE id = $1', [sourceId]);
      await pool.end();
    }
  });
});
