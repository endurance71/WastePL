import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processArtifactJob } from '../ingestion/artifact-processing.js';
import { MinioArtifactStore } from '../ingestion/artifact-store.js';
import { sha256Hex } from '../ingestion/hash.js';
import { PgSourceRegistry } from '../ingestion/source-registry.js';
import { createArtifactRuntimeProcessor } from '../main.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

interface Profile {
  sourceKey: string;
  terc: string;
  sourceUrl: string;
  fixture: string;
  canonicalKey: string;
  expectedMaterials: string[];
}

const profiles: Profile[] = [
  {
    sourceKey: 'bobolice-pszok',
    terc: '3209033',
    sourceUrl: 'https://bobolice.pl/cms/8587',
    fixture: 'bobolice-pszok.html',
    canonicalKey: 'pl-3209033-pszok-boboliczki',
    expectedMaterials: ['BULKY', 'ELECTRONICS', 'TEXTILES', 'TYRES', 'MEDICINES', 'BATTERIES', 'CONSTRUCTION', 'HAZARDOUS'],
  },
  {
    sourceKey: 'swieszyno-pszok',
    terc: '3209082',
    sourceUrl: 'https://swieszyno.pl/punkt-selektywnej-zbiorki-odpadow-komunalnych-pszok/',
    fixture: 'swieszyno-pszok.html',
    canonicalKey: 'pl-3209082-pszok-chalupy-13b',
    expectedMaterials: ['CONSTRUCTION'],
  },
];

integrationDescribe('municipal PSZOK immutable artifact runtime', () => {
  let pool: InstanceType<typeof Pool>;
  const artifactIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    for (const profile of profiles) {
      const municipality = await pool.query<{ id: string }>(
        `INSERT INTO municipalities (terc, name, municipality_type)
         VALUES ($1, $2, 'runtime-integration-test')
         ON CONFLICT (terc) DO UPDATE SET name = municipalities.name
         RETURNING id`,
        [profile.terc, profile.sourceKey === 'bobolice-pszok' ? 'Bobolice' : 'Świeszyno'],
      );
      await pool.query(
        `INSERT INTO sources (
           municipality_id, owner_type, owner_name, source_url, source_format,
           parser_key, source_key, data_type, manifest_status, manifest_version, active,
           source_shape, evidence_status, activation_blocker, assessed_at
         ) VALUES (
           $1, 'MUNICIPALITY', 'Runtime integration', $2, 'HTML',
           'municipal-pszok-html', $3, 'PSZOK', 'ACTIVE', 'pilot-koszalin-region@2026.2', true,
           'DIRECT_CONTENT', 'VERIFIED', NULL, '2026-08-28T10:30:00Z'
         )
         ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO UPDATE SET
           municipality_id = EXCLUDED.municipality_id,
           source_url = EXCLUDED.source_url,
           source_format = EXCLUDED.source_format,
           parser_key = EXCLUDED.parser_key,
           data_type = EXCLUDED.data_type,
           manifest_status = EXCLUDED.manifest_status,
           manifest_version = EXCLUDED.manifest_version,
           active = EXCLUDED.active,
           source_shape = EXCLUDED.source_shape,
           evidence_status = EXCLUDED.evidence_status,
           activation_blocker = NULL`,
        [municipality.rows[0]!.id, profile.sourceUrl, profile.sourceKey],
      );
    }
  });

  afterAll(async () => {
    if (!pool) return;
    if (artifactIds.length > 0) {
      await pool.query(
        `DELETE FROM facility_reconciliation_reviews
         WHERE assertion_id IN (
           SELECT id FROM facility_source_assertions WHERE source_artifact_id = ANY($1::uuid[])
         )`,
        [artifactIds],
      );
      await pool.query(
        'DELETE FROM facility_source_assertions WHERE source_artifact_id = ANY($1::uuid[])',
        [artifactIds],
      );
    }
    // Canonical facilities retain direct provenance FKs to the immutable source artifacts,
    // therefore canonical rows must be removed before the artifact rows themselves.
    await pool.query(
      `DELETE FROM facilities WHERE canonical_key = ANY($1::text[])`,
      [profiles.map((profile) => profile.canonicalKey)],
    );
    if (artifactIds.length > 0) {
      await pool.query('DELETE FROM source_processing_attempts WHERE artifact_id = ANY($1::uuid[])', [artifactIds]);
      await pool.query('DELETE FROM artifact_processing_outbox WHERE artifact_id = ANY($1::uuid[])', [artifactIds]);
      await pool.query('DELETE FROM source_artifacts WHERE id = ANY($1::uuid[])', [artifactIds]);
    }
    await pool.end();
  });

  for (const profile of profiles) {
    it(`publishes ${profile.sourceKey} through the registered production artifact runtime`, async () => {
      const source = await pool.query<{ id: string }>(
        'SELECT id FROM sources WHERE source_key = $1 LIMIT 1',
        [profile.sourceKey],
      );
      const sourceId = source.rows[0]?.id;
      if (!sourceId) throw new Error(`Source ${profile.sourceKey} missing`);

      const base = await readFile(new URL(`../../test/fixtures/${profile.fixture}`, import.meta.url));
      const body = Buffer.concat([base, Buffer.from(`\n<!-- runtime-${randomUUID()} -->\n`)]);
      const hash = sha256Hex(body);
      const store = new MinioArtifactStore();
      const stored = await store.putIfAbsent({
        sourceId,
        sha256: hash,
        body,
        contentType: 'text/html; charset=utf-8',
      });
      const registry = new PgSourceRegistry(pool);
      const inserted = await registry.insertArtifact({
        sourceId,
        retrievedAt: new Date('2026-08-28T10:30:00.000Z'),
        sha256: hash,
        storageUri: stored.uri,
        parserKey: 'municipal-pszok-html',
      });
      const artifactId = inserted.artifact.id;
      artifactIds.push(artifactId);

      const processor = createArtifactRuntimeProcessor(pool);
      await expect(processArtifactJob(registry, processor, {
        sourceId,
        artifactId,
        parserKey: 'municipal-pszok-html',
      })).resolves.toBe('PUBLISHED');

      const canonical = await pool.query<{
        id: string;
        canonical_key: string;
        geom_is_null: boolean;
        accepted_materials: string[];
        source_artifact_id: string | null;
        hours_source_artifact_id: string | null;
        access_source_artifact_id: string | null;
        verification_status: string;
      }>(
        `SELECT id, canonical_key, geom IS NULL AS geom_is_null, accepted_materials,
                source_artifact_id, hours_source_artifact_id, access_source_artifact_id,
                verification_status
         FROM facilities WHERE canonical_key=$1 LIMIT 1`,
        [profile.canonicalKey],
      );
      expect(canonical.rows[0]).toMatchObject({
        canonical_key: profile.canonicalKey,
        geom_is_null: true,
        accepted_materials: profile.expectedMaterials,
        source_artifact_id: artifactId,
        hours_source_artifact_id: artifactId,
        access_source_artifact_id: artifactId,
        verification_status: 'OFFICIAL_SOURCE',
      });

      const assertionCount = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM facility_source_assertions
         WHERE source_artifact_id=$1 AND facility_id=$2`,
        [artifactId, canonical.rows[0]!.id],
      );
      expect(assertionCount.rows[0]?.count).toBe('1');

      const artifact = await pool.query<{
        status: string;
        parser_key: string | null;
        parser_version: string | null;
        extraction_confidence: string | number | null;
      }>(
        `SELECT status, parser_key, parser_version, extraction_confidence
         FROM source_artifacts WHERE id=$1`,
        [artifactId],
      );
      expect(artifact.rows[0]).toMatchObject({
        status: 'PUBLISHED',
        parser_key: 'municipal-pszok-html',
        parser_version: '0.1.0',
      });
      expect(Number(artifact.rows[0]!.extraction_confidence)).toBeGreaterThanOrEqual(0.96);

      await expect(processArtifactJob(registry, processor, {
        sourceId,
        artifactId,
        parserKey: 'municipal-pszok-html',
      })).resolves.toBe('PUBLISHED');
      const duplicateCheck = await pool.query<{ canonical_count: string; assertion_count: string }>(
        `SELECT
           (SELECT count(*) FROM facilities WHERE canonical_key=$1)::text AS canonical_count,
           (SELECT count(*) FROM facility_source_assertions WHERE source_artifact_id=$2)::text AS assertion_count`,
        [profile.canonicalKey, artifactId],
      );
      expect(duplicateCheck.rows[0]).toEqual({ canonical_count: '1', assertion_count: '1' });

      const brokenBody = Buffer.from(
        `<html><body><h1>PSZOK</h1><p>template changed ${randomUUID()}</p></body></html>`,
      );
      const brokenHash = sha256Hex(brokenBody);
      const brokenStored = await store.putIfAbsent({
        sourceId,
        sha256: brokenHash,
        body: brokenBody,
        contentType: 'text/html; charset=utf-8',
      });
      const broken = await registry.insertArtifact({
        sourceId,
        retrievedAt: new Date('2026-08-28T11:00:00.000Z'),
        sha256: brokenHash,
        storageUri: brokenStored.uri,
        parserKey: 'municipal-pszok-html',
      });
      artifactIds.push(broken.artifact.id);

      await expect(processArtifactJob(registry, processor, {
        sourceId,
        artifactId: broken.artifact.id,
        parserKey: 'municipal-pszok-html',
      })).resolves.toBe('PARSE_FAILED');

      const retained = await pool.query<{ source_artifact_id: string | null; count: string }>(
        `SELECT source_artifact_id,
                (SELECT count(*) FROM facilities WHERE canonical_key=$1)::text AS count
         FROM facilities WHERE canonical_key=$1 LIMIT 1`,
        [profile.canonicalKey],
      );
      expect(retained.rows[0]).toEqual({ source_artifact_id: artifactId, count: '1' });

      // A replay of the last known good artifact restores source health without changing canonical data.
      await expect(processArtifactJob(registry, processor, {
        sourceId,
        artifactId,
        parserKey: 'municipal-pszok-html',
      })).resolves.toBe('PUBLISHED');
      const health = await pool.query<{ health_status: string }>(
        'SELECT health_status FROM sources WHERE id=$1',
        [sourceId],
      );
      expect(health.rows[0]?.health_status).toBe('HEALTHY');
    }, 25_000);
  }
});
