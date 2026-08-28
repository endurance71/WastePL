import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PgkKoszalinPdfTextAdapter,
} from '../adapters/pdf-text/pgk-koszalin-adapter.js';
import type {
  NormalizedDataset,
  PdfTextAdapter,
} from '../adapters/pdf-text/types.js';
import { MinioArtifactReader } from '../ingestion/artifact-reader.js';
import { MinioArtifactStore } from '../ingestion/artifact-store.js';
import { DispatchingArtifactProcessor } from '../ingestion/dispatching-artifact-processor.js';
import { sha256Hex } from '../ingestion/hash.js';
import { PgArtifactProcessingLookup } from '../ingestion/pg-artifact-processing-lookup.js';
import { PgSourceRegistry } from '../ingestion/source-registry.js';
import { PgkKoszalinCollectionArtifactHandler } from './collection-artifact-handler.js';
import { PgCollectionPublisher } from './pg-collection-publisher.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

function namespaceDataset(dataset: NormalizedDataset, areaKey: string): NormalizedDataset {
  const originalKey = dataset.serviceAreas[0]?.key;
  if (!originalKey || dataset.serviceAreas.length !== 1) {
    throw new Error('Manowo runtime fixture must produce exactly one service area');
  }
  return {
    ...dataset,
    serviceAreas: dataset.serviceAreas.map((area) => ({
      ...area,
      key: area.key === originalKey ? areaKey : area.key,
      name: `${area.name} [runtime integration]`,
    })),
    collectionEvents: dataset.collectionEvents.map((event) => ({
      ...event,
      serviceAreaKey: event.serviceAreaKey === originalKey ? areaKey : event.serviceAreaKey,
    })),
  };
}

integrationDescribe('collection immutable artifact runtime', () => {
  const suffix = randomUUID();
  const sourceKey = `runtime-manowo-${suffix}`;
  const sourceUrl = `https://example.invalid/${sourceKey}.pdf`;
  const areaKey = `runtime-manowo-area-${suffix}`;
  let pool: InstanceType<typeof Pool>;
  let sourceId: string;
  let artifactId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const municipality = await pool.query<{ id: string }>(
      "SELECT id FROM municipalities WHERE terc = '3209042' LIMIT 1",
    );
    if (!municipality.rows[0]) throw new Error('Manowo municipality fixture missing');

    const source = await pool.query<{ id: string }>(
      `INSERT INTO sources (
         municipality_id, owner_type, owner_name, source_url, source_format,
         parser_key, source_key, data_type, manifest_status, active
       ) VALUES (
         $1, 'MUNICIPAL_COMPANY', 'Collection runtime integration', $2, 'PDF_TEXT',
         'pgk-koszalin-pdf-text', $3, 'COLLECTION_SCHEDULE', 'ACTIVE', false
       ) RETURNING id`,
      [municipality.rows[0].id, sourceUrl, sourceKey],
    );
    sourceId = source.rows[0]!.id;
  });

  afterAll(async () => {
    if (!pool) return;
    const area = await pool.query<{ id: string }>(
      'SELECT id FROM service_areas WHERE external_key = $1',
      [areaKey],
    );
    const areaId = area.rows[0]?.id;
    if (areaId) {
      await pool.query('DELETE FROM collection_events WHERE service_area_id = $1', [areaId]);
      await pool.query('DELETE FROM service_area_rules WHERE service_area_id = $1', [areaId]);
      await pool.query('DELETE FROM service_areas WHERE id = $1', [areaId]);
    }
    if (artifactId) {
      await pool.query('DELETE FROM data_change_log WHERE source_artifact_id = $1', [artifactId]);
      await pool.query('DELETE FROM collection_publications WHERE source_artifact_id = $1', [artifactId]);
      await pool.query('DELETE FROM source_processing_attempts WHERE artifact_id = $1', [artifactId]);
      await pool.query('DELETE FROM artifact_processing_outbox WHERE artifact_id = $1', [artifactId]);
      await pool.query('DELETE FROM source_artifacts WHERE id = $1', [artifactId]);
    }
    if (sourceId) await pool.query('DELETE FROM sources WHERE id = $1', [sourceId]);
    await pool.end();
  });

  it('reads a verified immutable Manowo artifact, parses it and publishes canonical events', async () => {
    const fixtureUrl = new URL('../../test/fixtures/pdf-text/manowo-2ab-2026.txt', import.meta.url);
    const body = await readFile(fixtureUrl);
    const hash = sha256Hex(body);
    const store = new MinioArtifactStore();
    const stored = await store.putIfAbsent({
      sourceId,
      sha256: hash,
      body,
      contentType: 'text/plain; charset=utf-8',
    });
    const registry = new PgSourceRegistry(pool);
    const inserted = await registry.insertArtifact({
      sourceId,
      retrievedAt: new Date('2026-08-28T08:00:00Z'),
      sha256: hash,
      storageUri: stored.uri,
      parserKey: 'pgk-koszalin-pdf-text',
    });
    artifactId = inserted.artifact.id;

    const baseAdapter = new PgkKoszalinPdfTextAdapter();
    const adapter: PdfTextAdapter = {
      parserKey: baseAdapter.parserKey,
      parserVersion: baseAdapter.parserVersion,
      supports: (text) => baseAdapter.supports(text),
      parse: (input) => namespaceDataset(baseAdapter.parse(input), areaKey),
    };
    const handler = new PgkKoszalinCollectionArtifactHandler(
      pool,
      adapter,
      new PgCollectionPublisher(pool),
    );
    const processor = new DispatchingArtifactProcessor(
      new PgArtifactProcessingLookup(pool),
      new MinioArtifactReader(),
      [handler],
    );

    await expect(
      processor.process({
        sourceId,
        artifactId,
        parserKey: 'pgk-koszalin-pdf-text',
      }),
    ).resolves.toMatchObject({
      outcome: 'PUBLISHED',
      metadata: {
        municipalityTerc: '3209042',
        serviceAreasAdded: 1,
        eventsAdded: 66,
      },
    });

    const canonical = await pool.query<{
      current_events: string;
      rules: string;
      published_artifact: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM collection_events ce
          WHERE ce.service_area_id = sa.id AND ce.valid_to IS NULL) AS current_events,
         (SELECT count(*)::text FROM service_area_rules r
          WHERE r.service_area_id = sa.id) AS rules,
         sa.published_from_artifact_id::text AS published_artifact
       FROM service_areas sa
       WHERE sa.external_key = $1`,
      [areaKey],
    );
    expect(canonical.rows[0]).toEqual({
      current_events: '66',
      rules: '4',
      published_artifact: artifactId,
    });

    const artifact = await pool.query<{
      status: string;
      parser_version: string | null;
    }>(
      'SELECT status, parser_version FROM source_artifacts WHERE id = $1',
      [artifactId],
    );
    expect(artifact.rows[0]).toEqual({
      status: 'PUBLISHED',
      parser_version: '0.1.0',
    });

    await expect(
      processor.process({
        sourceId,
        artifactId,
        parserKey: 'pgk-koszalin-pdf-text',
      }),
    ).resolves.toMatchObject({
      outcome: 'PUBLISHED',
      metadata: { replaySkipped: true },
    });

    const duplicateCheck = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM collection_events ce
       JOIN service_areas sa ON sa.id = ce.service_area_id
       WHERE sa.external_key = $1 AND ce.valid_to IS NULL`,
      [areaKey],
    );
    expect(duplicateCheck.rows[0]?.count).toBe('66');
  }, 20_000);
});
