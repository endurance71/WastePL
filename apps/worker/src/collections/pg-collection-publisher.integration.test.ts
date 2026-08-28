import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NormalizedDataset } from '../adapters/pdf-text/types.js';
import { PgCollectionPublisher } from './pg-collection-publisher.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

integrationDescribe('PgCollectionPublisher', () => {
  const suffix = randomUUID();
  const sourceKey = `test-collection-publisher-${suffix}`;
  const sourceUrl = `https://example.invalid/${sourceKey}.pdf`;
  const areaKey = `test-manowo-area-${suffix}`;
  let pool: InstanceType<typeof Pool>;
  let sourceId: string;
  const artifactIds: string[] = [];

  function dataset(artifactSha: string, eventDate: string): NormalizedDataset {
    return {
      schemaVersion: '0.1.0',
      municipality: {
        terc: '3209042',
        name: 'Manowo',
        municipalityType: 'RURAL',
      },
      serviceAreas: [
        {
          key: areaKey,
          name: 'Temporal publisher integration area',
          buildingType: null,
          coverage: [{ type: 'LOCALITY', priority: 50, simc: '0308040' }],
        },
      ],
      collectionEvents: [
        {
          serviceAreaKey: areaKey,
          fraction: 'MIXED',
          date: eventDate,
          status: 'SCHEDULED',
          note: null,
          sourceKey,
          quality: {
            verificationStatus: 'OFFICIAL_SOURCE',
            confidence: 0.99,
            retrievedAt: '2026-08-28T08:00:00.000Z',
            warnings: [],
          },
        },
      ],
      facilities: [],
      alerts: [],
      sources: [
        {
          sourceKey,
          url: sourceUrl,
          ownerType: 'MUNICIPAL_COMPANY',
          format: 'PDF_TEXT',
          reuseBasis: null,
          artifact: {
            sha256: artifactSha,
            retrievedAt: '2026-08-28T08:00:00.000Z',
            parserKey: 'pgk-koszalin-pdf-text',
            parserVersion: '0.1.0',
            extractionConfidence: 0.99,
            storageUri: `s3://test/${artifactSha}`,
          },
        },
      ],
    };
  }

  async function insertArtifact(artifactSha: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO source_artifacts (
         source_id, retrieved_at, sha256, storage_uri, parser_key, status
       ) VALUES ($1, '2026-08-28T08:00:00Z', $2, $3, 'pgk-koszalin-pdf-text', 'FETCHED')
       RETURNING id`,
      [sourceId, artifactSha, `s3://test/${artifactSha}`],
    );
    const id = result.rows[0]!.id;
    artifactIds.push(id);
    return id;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const municipality = await pool.query<{ id: string }>(
      "SELECT id FROM municipalities WHERE terc = '3209042' LIMIT 1",
    );
    if (!municipality.rows[0]) throw new Error('Manowo municipality fixture missing');
    const locality = await pool.query<{ id: string }>(
      "SELECT id FROM localities WHERE simc = '0308040' AND active = true LIMIT 1",
    );
    if (!locality.rows[0]) throw new Error('Bonin SIMC fixture missing');

    const source = await pool.query<{ id: string }>(
      `INSERT INTO sources (
         municipality_id, owner_type, owner_name, source_url, source_format,
         parser_key, source_key, data_type, manifest_status, active
       ) VALUES (
         $1, 'MUNICIPAL_COMPANY', 'Temporal publisher integration', $2, 'PDF_TEXT',
         'pgk-koszalin-pdf-text', $3, 'COLLECTION_SCHEDULE', 'ACTIVE', false
       ) RETURNING id`,
      [municipality.rows[0].id, sourceUrl, sourceKey],
    );
    sourceId = source.rows[0]!.id;
  });

  afterAll(async () => {
    if (!pool) return;
    const area = await pool.query<{ id: string }>(
      'SELECT id FROM service_areas WHERE municipality_id = (SELECT id FROM municipalities WHERE terc = $1) AND external_key = $2',
      ['3209042', areaKey],
    );
    const areaId = area.rows[0]?.id;
    if (areaId) {
      await pool.query('DELETE FROM collection_events WHERE service_area_id = $1', [areaId]);
      await pool.query('DELETE FROM service_area_rules WHERE service_area_id = $1', [areaId]);
      await pool.query('DELETE FROM service_areas WHERE id = $1', [areaId]);
    }
    if (artifactIds.length > 0) {
      await pool.query('DELETE FROM data_change_log WHERE source_artifact_id = ANY($1::uuid[])', [artifactIds]);
      await pool.query('DELETE FROM collection_publications WHERE source_artifact_id = ANY($1::uuid[])', [artifactIds]);
      await pool.query('DELETE FROM artifact_processing_outbox WHERE artifact_id = ANY($1::uuid[])', [artifactIds]);
      await pool.query('DELETE FROM source_artifacts WHERE id = ANY($1::uuid[])', [artifactIds]);
    }
    if (sourceId) await pool.query('DELETE FROM sources WHERE id = $1', [sourceId]);
    await pool.end();
  });

  it('keeps superseded events auditable while exposing one current version', async () => {
    const publisher = new PgCollectionPublisher(pool);
    const firstSha = sha(`${suffix}:first`);
    const firstArtifactId = await insertArtifact(firstSha);

    await expect(
      publisher.publish(sourceId, firstArtifactId, dataset(firstSha, '2026-09-01')),
    ).resolves.toMatchObject({
      serviceAreasAdded: 1,
      eventsAdded: 1,
      replayed: false,
    });

    await expect(
      publisher.publish(sourceId, firstArtifactId, dataset(firstSha, '2026-09-01')),
    ).resolves.toMatchObject({ replayed: true });

    const secondSha = sha(`${suffix}:second`);
    const secondArtifactId = await insertArtifact(secondSha);
    await expect(
      publisher.publish(sourceId, secondArtifactId, dataset(secondSha, '2026-09-08')),
    ).resolves.toMatchObject({
      serviceAreasUnchanged: 1,
      eventsAdded: 1,
      eventsRemoved: 1,
      replayed: false,
    });

    const versions = await pool.query<{
      collection_date: string;
      valid_from: Date;
      valid_to: Date | null;
      source_artifact_id: string;
    }>(
      `SELECT to_char(ce.collection_date, 'YYYY-MM-DD') AS collection_date,
              ce.valid_from, ce.valid_to, ce.source_artifact_id
       FROM collection_events ce
       JOIN service_areas sa ON sa.id = ce.service_area_id
       WHERE sa.source_id = $1 AND sa.external_key = $2
       ORDER BY ce.valid_from, ce.collection_date`,
      [sourceId, areaKey],
    );

    expect(versions.rows).toHaveLength(2);
    expect(versions.rows[0]).toMatchObject({
      collection_date: '2026-09-01',
      source_artifact_id: firstArtifactId,
    });
    expect(versions.rows[0]!.valid_to).toBeInstanceOf(Date);
    expect(versions.rows[1]).toMatchObject({
      collection_date: '2026-09-08',
      source_artifact_id: secondArtifactId,
      valid_to: null,
    });

    const current = await pool.query<{ collection_date: string; count: string }>(
      `SELECT to_char(ce.collection_date, 'YYYY-MM-DD') AS collection_date,
              count(*)::text AS count
       FROM collection_events ce
       JOIN service_areas sa ON sa.id = ce.service_area_id
       WHERE sa.source_id = $1
         AND sa.external_key = $2
         AND ce.valid_to IS NULL
       GROUP BY ce.collection_date`,
      [sourceId, areaKey],
    );
    expect(current.rows).toEqual([{ collection_date: '2026-09-08', count: '1' }]);
  });

  it('rolls back a failed replacement and preserves the last known good event', async () => {
    const publisher = new PgCollectionPublisher(pool);
    const badSha = sha(`${suffix}:bad`);
    const badArtifactId = await insertArtifact(badSha);
    const invalid = dataset(badSha, '2026-09-15');
    invalid.municipality.terc = '3261011';

    await expect(
      publisher.publish(sourceId, badArtifactId, invalid),
    ).rejects.toMatchObject({ code: 'SOURCE_MUNICIPALITY_MISMATCH' });

    const current = await pool.query<{ collection_date: string }>(
      `SELECT to_char(ce.collection_date, 'YYYY-MM-DD') AS collection_date
       FROM collection_events ce
       JOIN service_areas sa ON sa.id = ce.service_area_id
       WHERE sa.source_id = $1
         AND sa.external_key = $2
         AND ce.valid_to IS NULL`,
      [sourceId, areaKey],
    );
    expect(current.rows).toEqual([{ collection_date: '2026-09-08' }]);

    const artifact = await pool.query<{ status: string }>(
      'SELECT status FROM source_artifacts WHERE id = $1',
      [badArtifactId],
    );
    expect(artifact.rows[0]?.status).toBe('FETCHED');
  });
});
