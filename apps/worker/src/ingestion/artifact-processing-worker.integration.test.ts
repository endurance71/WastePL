import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createArtifactProcessingWorker } from './artifact-processing.js';
import { MinioArtifactReader } from './artifact-reader.js';
import { MinioArtifactStore } from './artifact-store.js';
import { BullMqArtifactProcessingQueue } from './bullmq-queues.js';
import {
  DispatchingArtifactProcessor,
  type ArtifactHandler,
} from './dispatching-artifact-processor.js';
import { sha256Hex } from './hash.js';
import { PgArtifactProcessingLookup } from './pg-artifact-processing-lookup.js';
import { PgSourceRegistry } from './source-registry.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const integrationDescribe = databaseUrl && redisUrl ? describe : describe.skip;

integrationDescribe('artifact processing worker runtime', () => {
  const sourceUrl = `https://example.invalid/wastepl-artifact-worker-${randomUUID()}`;
  let pool: InstanceType<typeof Pool>;
  let redis: Redis;
  let sourceId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    redis = new Redis(redisUrl!, { maxRetriesPerRequest: null });
    const municipality = await pool.query<{ id: string }>(
      "SELECT id FROM municipalities WHERE terc = '3261011' LIMIT 1",
    );
    if (!municipality.rows[0]) throw new Error('Koszalin municipality fixture missing');
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO sources (
         municipality_id, owner_type, owner_name, source_url, source_format,
         reuse_basis, parser_key, active
       ) VALUES ($1, 'MUNICIPAL_COMPANY', 'Artifact worker integration', $2, 'HTML',
         'CI deterministic artifact processing test', 'test-runtime-parser', false)
       RETURNING id`,
      [municipality.rows[0].id, sourceUrl],
    );
    sourceId = inserted.rows[0]!.id;
  });

  afterAll(async () => {
    if (pool && sourceId) await pool.query('DELETE FROM sources WHERE id = $1', [sourceId]);
    if (redis) await redis.quit();
    if (pool) await pool.end();
  });

  it('moves an immutable outbox artifact through Redis to a verified handler and audit state', async () => {
    const registry = new PgSourceRegistry(pool);
    const artifactStore = new MinioArtifactStore();
    const body = Buffer.from('<html><body>deterministic artifact worker payload</body></html>');
    const sha256 = sha256Hex(body);
    const stored = await artifactStore.putIfAbsent({
      sourceId,
      sha256,
      body,
      contentType: 'text/html',
    });
    const inserted = await registry.insertArtifact({
      sourceId,
      retrievedAt: new Date('2026-08-28T08:00:00Z'),
      sha256,
      storageUri: stored.uri,
      parserKey: 'test-runtime-parser',
    });
    expect(inserted.created).toBe(true);

    const outbox = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM artifact_processing_outbox WHERE artifact_id = $1',
      [inserted.artifact.id],
    );
    expect(Number(outbox.rows[0]?.count ?? 0)).toBe(1);

    let handlerCalls = 0;
    let resolveHandler!: () => void;
    const handlerCalled = new Promise<void>((resolve) => {
      resolveHandler = resolve;
    });
    const handler: ArtifactHandler = {
      parserKey: 'test-runtime-parser',
      async process(input) {
        handlerCalls += 1;
        expect(input.body.equals(body)).toBe(true);
        expect(input.artifact.id).toBe(inserted.artifact.id);
        expect(input.artifact.sha256).toBe(sha256);
        await registry.markArtifactParsed({
          artifactId: input.artifact.id,
          parserKey: 'test-runtime-parser',
          parserVersion: 'integration-1',
          extractionConfidence: 1,
          status: 'PUBLISHED',
          parseReport: { integration: true },
        });
        resolveHandler();
        return { outcome: 'PUBLISHED', metadata: { rows: 1 } };
      },
    };

    const lookup = new PgArtifactProcessingLookup(pool);
    const reader = new MinioArtifactReader();
    const processor = new DispatchingArtifactProcessor(lookup, reader, [handler]);
    const worker = createArtifactProcessingWorker(redis, registry, processor);
    const queue = new BullMqArtifactProcessingQueue(redis);

    try {
      await queue.enqueue({
        sourceId,
        artifactId: inserted.artifact.id,
        parserKey: 'test-runtime-parser',
      });
      await Promise.race([
        handlerCalled,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('artifact handler was not called')), 10_000),
        ),
      ]);

      let attemptCount = 0;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const result = await pool.query<{ count: string }>(
          `SELECT count(*)::text AS count
           FROM source_processing_attempts
           WHERE artifact_id = $1 AND outcome = 'PUBLISHED'`,
          [inserted.artifact.id],
        );
        attemptCount = Number(result.rows[0]?.count ?? 0);
        if (attemptCount === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(attemptCount).toBe(1);

      const state = await pool.query<{
        artifact_status: string;
        parser_version: string | null;
        health_status: string;
      }>(
        `SELECT a.status AS artifact_status, a.parser_version, s.health_status
         FROM source_artifacts a
         JOIN sources s ON s.id = a.source_id
         WHERE a.id = $1`,
        [inserted.artifact.id],
      );
      expect(state.rows[0]).toEqual({
        artifact_status: 'PUBLISHED',
        parser_version: 'integration-1',
        health_status: 'HEALTHY',
      });

      await expect(
        processor.process({
          sourceId,
          artifactId: inserted.artifact.id,
          parserKey: 'test-runtime-parser',
        }),
      ).resolves.toMatchObject({
        outcome: 'PUBLISHED',
        metadata: { replaySkipped: true },
      });
      expect(handlerCalls).toBe(1);
    } finally {
      await worker.close();
      await queue.close();
    }
  }, 20_000);
});
