import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { PgSourceRegistry } from './source-registry.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationIt = databaseUrl ? it : it.skip;

describe('PgSourceRegistry integration', () => {
  integrationIt('persists source state, immutable artifacts, one outbox row and fetch audit records', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const sourceUrl = `https://example.test/${randomUUID()}.pdf`;
    let sourceId: string | null = null;

    try {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO sources (owner_type, owner_name, source_url, source_format, parser_key)
         VALUES ('MUNICIPALITY', 'Integration test', $1, 'PDF_TEXT', 'pdf-text-v1')
         RETURNING id`,
        [sourceUrl],
      );
      sourceId = inserted.rows[0]?.id ?? null;
      if (!sourceId) throw new Error('Failed to create integration-test source');

      const registry = new PgSourceRegistry(pool);
      const source = await registry.getSourceById(sourceId);
      expect(source).toMatchObject({
        sourceUrl,
        sourceFormat: 'PDF_TEXT',
        active: true,
        healthStatus: 'UNKNOWN',
        consecutiveFailures: 0,
      });

      const retrievedAt = new Date('2026-08-27T12:00:00Z');
      const first = await registry.insertArtifact({
        sourceId,
        retrievedAt,
        sha256: 'a'.repeat(64),
        storageUri: `s3://test/${sourceId}/${'a'.repeat(64)}`,
        parserKey: 'pdf-text-v1',
      });
      const second = await registry.insertArtifact({
        sourceId,
        retrievedAt,
        sha256: 'a'.repeat(64),
        storageUri: `s3://test/${sourceId}/${'a'.repeat(64)}`,
        parserKey: 'pdf-text-v1',
      });
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.artifact.id).toBe(first.artifact.id);

      await registry.markSourceChecked(sourceId, {
        checkedAt: retrievedAt,
        etag: '"v1"',
        lastModified: 'Thu, 27 Aug 2026 12:00:00 GMT',
        sha256: 'a'.repeat(64),
        healthStatus: 'FETCHED',
      });
      await registry.recordFetchAttempt({
        sourceId,
        startedAt: new Date('2026-08-27T11:59:59Z'),
        completedAt: retrievedAt,
        outcome: 'FETCHED',
        attempts: 1,
        httpStatus: 200,
        etag: '"v1"',
        lastModified: 'Thu, 27 Aug 2026 12:00:00 GMT',
        sha256: 'a'.repeat(64),
        bytesReceived: 123,
        contentType: 'application/pdf',
        errorCode: null,
        errorMessage: null,
        metadata: { test: true },
      });

      const artifactCount = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM source_artifacts WHERE source_id = $1',
        [sourceId],
      );
      const outboxCount = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM artifact_processing_outbox WHERE source_id = $1',
        [sourceId],
      );
      const attemptCount = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM source_fetch_attempts WHERE source_id = $1',
        [sourceId],
      );
      const health = await registry.getSourceById(sourceId);

      expect(artifactCount.rows[0]?.count).toBe('1');
      expect(outboxCount.rows[0]?.count).toBe('1');
      expect(attemptCount.rows[0]?.count).toBe('1');
      expect(health).toMatchObject({
        lastSha256: 'a'.repeat(64),
        healthStatus: 'FETCHED',
        consecutiveFailures: 0,
      });
    } finally {
      if (sourceId) await pool.query('DELETE FROM sources WHERE id = $1', [sourceId]);
      await pool.end();
    }
  });
});
