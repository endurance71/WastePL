import { readFileSync } from 'node:fs';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './main.js';
import { PgkKoszalinPszokHtmlAdapter } from '../../worker/src/adapters/html/pgk-koszalin-pszok-adapter.js';
import { PgkKoszalinPszokIngestionOrchestrator } from '../../worker/src/adapters/html/pgk-koszalin-pszok-ingestion-orchestrator.js';
import { PgFacilityBundlePublisher } from '../../worker/src/facilities/facility-bundle-publisher.js';
import { sha256Hex } from '../../worker/src/ingestion/hash.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

const MAIN_URL = 'https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-koszalin/';
const FAQ_URL = 'https://www.pgkkoszalin.pl/najczesciej-zadawane-pytania-f-a-q/';
const MAIN_KEY = 'pgk-koszalin-pszok-main';
const FAQ_KEY = 'pgk-koszalin-pszok-faq';
const KOMUNALNA_KEY = 'pl-3261011-pszok-komunalna-5';
const SKWIERZYNKE_KEY = 'pl-3261011-pszok-na-skwierzynke-2';

interface SourceArtifactSeed {
  id: string;
  sourceId: string;
  sha256: string;
  storageUri: string;
  retrievedAt: Date;
}

integrationDescribe('official facility ingestion -> canonical API', () => {
  let pool: InstanceType<typeof Pool>;
  let app: NestFastifyApplication;
  let orchestrator: PgkKoszalinPszokIngestionOrchestrator;
  let mainArtifact: SourceArtifactSeed;
  let faqArtifact: SourceArtifactSeed;
  let mainHtml = '';
  let faqHtml = '';
  let firstOutcomes: Awaited<ReturnType<PgkKoszalinPszokIngestionOrchestrator['ingest']>>;

  const sourceArtifactIds: string[] = [];

  function ingestionInput() {
    return {
      main: {
        artifactId: mainArtifact.id,
        html: mainHtml,
        sourceKey: MAIN_KEY,
        url: MAIN_URL,
        sha256: mainArtifact.sha256,
        retrievedAt: mainArtifact.retrievedAt.toISOString(),
        storageUri: mainArtifact.storageUri,
      },
      faq: {
        artifactId: faqArtifact.id,
        html: faqHtml,
        sourceKey: FAQ_KEY,
        url: FAQ_URL,
        sha256: faqArtifact.sha256,
        retrievedAt: faqArtifact.retrievedAt.toISOString(),
        storageUri: faqArtifact.storageUri,
      },
    };
  }

  async function seedArtifact(sourceUrl: string, body: string, label: string): Promise<SourceArtifactSeed> {
    const source = await pool.query<{ id: string }>(
      'SELECT id FROM sources WHERE source_url = $1 LIMIT 1',
      [sourceUrl],
    );
    const sourceId = source.rows[0]?.id;
    if (!sourceId) throw new Error(`Official source registry row missing: ${sourceUrl}`);

    const hash = sha256Hex(Buffer.from(body));
    const retrievedAt = new Date('2026-08-27T19:20:00.000Z');
    const storageUri = `fixture://facility-ingestion/${label}/${hash}`;
    const inserted = await pool.query<SourceArtifactSeed>(
      `INSERT INTO source_artifacts (
         source_id, retrieved_at, sha256, storage_uri, parser_key, status
       ) VALUES ($1, $2, $3, $4, 'pgk-koszalin-pszok-html', 'FETCHED')
       ON CONFLICT (source_id, sha256) DO UPDATE SET
         storage_uri = EXCLUDED.storage_uri,
         retrieved_at = EXCLUDED.retrieved_at,
         parser_key = EXCLUDED.parser_key,
         parser_version = NULL,
         extraction_confidence = NULL,
         status = 'FETCHED',
         parse_report = NULL
       RETURNING id, source_id AS "sourceId", sha256, storage_uri AS "storageUri", retrieved_at AS "retrievedAt"`,
      [sourceId, retrievedAt, hash, storageUri],
    );
    const row = inserted.rows[0]!;
    sourceArtifactIds.push(row.id);
    return row;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });

    const suffix = `<!-- facility-ingestion-${Date.now()} -->`;
    mainHtml = `${readFileSync(new URL('../../worker/test/fixtures/pgk-koszalin-pszok-main.html', import.meta.url), 'utf8')}\n${suffix}`;
    faqHtml = `${readFileSync(new URL('../../worker/test/fixtures/pgk-koszalin-pszok-faq.html', import.meta.url), 'utf8')}\n${suffix}`;

    mainArtifact = await seedArtifact(MAIN_URL, mainHtml, 'main');
    faqArtifact = await seedArtifact(FAQ_URL, faqHtml, 'faq');

    orchestrator = new PgkKoszalinPszokIngestionOrchestrator(pool);
    firstOutcomes = await orchestrator.ingest(ingestionInput());

    app = await createApp();
    app.useLogger(['error']);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (sourceArtifactIds.length > 0) {
      await pool.query(
        `DELETE FROM facility_reconciliation_reviews
         WHERE assertion_id IN (
           SELECT id FROM facility_source_assertions WHERE source_artifact_id = ANY($1::uuid[])
         )`,
        [sourceArtifactIds],
      );
      await pool.query(
        'DELETE FROM facility_source_assertions WHERE source_artifact_id = ANY($1::uuid[])',
        [sourceArtifactIds],
      );
      await pool.query(
        `DELETE FROM facilities
         WHERE canonical_key IN ($1, $2)`,
        [KOMUNALNA_KEY, SKWIERZYNKE_KEY],
      );
      await pool.query('DELETE FROM source_artifacts WHERE id = ANY($1::uuid[])', [sourceArtifactIds]);
    }
    await pool?.end();
  });

  it('publishes Komunalna 5 and exposes exact artifact/parser provenance through /v1/facilities', async () => {
    expect(firstOutcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facilityKey: KOMUNALNA_KEY,
          state: 'CREATED',
          facilityId: expect.any(String),
        }),
        expect.objectContaining({
          facilityKey: SKWIERZYNKE_KEY,
          state: 'REVIEW_REQUIRED',
        }),
      ]),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/v1/facilities?terc=3261011&kind=PSZOK&material=TYRES&limit=200',
    });
    expect(response.statusCode, response.body).toBe(200);
    const item = response.json().items.find(
      (candidate: { canonicalKey: string | null }) => candidate.canonicalKey === KOMUNALNA_KEY,
    );
    expect(item).toBeTruthy();
    expect(item).toMatchObject({
      kind: 'PSZOK',
      address: 'ul. Komunalna 5, Koszalin',
      location: { lat: 54.212266, lon: 16.183616 },
      operationalStatus: { state: 'UNKNOWN', observedAt: null },
      quality: { verificationStatus: 'OFFICIAL_SOURCE', confidence: 0.99 },
    });
    expect(item.provenance.primary.artifactId).toBe(mainArtifact.id);
    expect(item.provenance.primary.parserKey).toBe('pgk-koszalin-pszok-html');
    expect(item.provenance.primary.parserVersion).toBe('1.1.0');
    expect(item.provenance.assertions).toHaveLength(2);
    expect(item.provenance.assertions.map((assertion: { sourceKey: string }) => assertion.sourceKey).sort())
      .toEqual([FAQ_KEY, MAIN_KEY].sort());
  });

  it('keeps the second official PSZOK review-required without fabricating geometry', async () => {
    const assertion = await pool.query<{
      facility_id: string | null;
      reconciliation_state: string;
      verification_status: string;
      lat: number | null;
      lon: number | null;
    }>(
      `SELECT
         a.facility_id,
         a.reconciliation_state,
         a.verification_status,
         CASE WHEN a.geom IS NULL THEN NULL ELSE ST_Y(a.geom) END AS lat,
         CASE WHEN a.geom IS NULL THEN NULL ELSE ST_X(a.geom) END AS lon
       FROM facility_source_assertions a
       WHERE a.source_artifact_id = $1
         AND a.name = 'PSZOK – ul. Na Skwierzynkę 2'
       LIMIT 1`,
      [mainArtifact.id],
    );
    expect(assertion.rows[0]).toEqual({
      facility_id: null,
      reconciliation_state: 'REVIEW_REQUIRED',
      verification_status: 'REVIEW_REQUIRED',
      lat: null,
      lon: null,
    });

    const inventedCanonical = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM facilities WHERE canonical_key = $1',
      [SKWIERZYNKE_KEY],
    );
    expect(inventedCanonical.rows[0]?.count).toBe('0');
  });

  it('replays the same immutable artifacts idempotently', async () => {
    const secondOutcomes = await orchestrator.ingest(ingestionInput());
    expect(secondOutcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ facilityKey: KOMUNALNA_KEY, state: 'UNCHANGED' }),
        expect.objectContaining({ facilityKey: SKWIERZYNKE_KEY, state: 'REVIEW_REQUIRED' }),
      ]),
    );

    const counts = await pool.query<{
      canonical_count: string;
      assertion_count: string;
      artifact_count: string;
    }>(
      `SELECT
         (SELECT count(*) FROM facilities WHERE canonical_key = $1)::text AS canonical_count,
         (SELECT count(*) FROM facility_source_assertions WHERE source_artifact_id = ANY($2::uuid[]))::text AS assertion_count,
         (SELECT count(*) FROM source_artifacts WHERE id = ANY($2::uuid[]))::text AS artifact_count`,
      [KOMUNALNA_KEY, sourceArtifactIds],
    );
    expect(counts.rows[0]).toEqual({
      canonical_count: '1',
      assertion_count: '3',
      artifact_count: '2',
    });
  });

  it('publishes parse audit metadata onto the exact immutable artifacts', async () => {
    const artifacts = await pool.query<{
      id: string;
      parser_version: string | null;
      status: string;
      parse_report: Record<string, unknown> | null;
    }>(
      `SELECT id, parser_version, status, parse_report
       FROM source_artifacts
       WHERE id = ANY($1::uuid[])
       ORDER BY id`,
      [sourceArtifactIds],
    );
    expect(artifacts.rows).toHaveLength(2);
    for (const artifact of artifacts.rows) {
      expect(artifact.parser_version).toBe('1.1.0');
      expect(artifact.status).toBe('PUBLISHED');
      expect(artifact.parse_report).toHaveProperty('facilityIngestion');
    }
  });

  it('rolls back assertions and a newly-created canonical facility when finalization fails after reconciliation', async () => {
    const adapter = new PgkKoszalinPszokHtmlAdapter();
    const atomic = structuredClone(adapter.parse({
      main: ingestionInput().main,
      faq: ingestionInput().faq,
    }));
    atomic.key = `pl-3261011-pszok-atomicity-${Date.now()}`;
    atomic.name = `Atomicity PSZOK ${Date.now()}`;
    atomic.address = `Atomicity ${Date.now()}, Koszalin`;
    atomic.location = { lat: 54.31, lon: 16.31 };
    atomic.locationSourceKey = MAIN_KEY;
    atomic.openingHours.sourceKey = 'missing-source-key';

    const publisher = new PgFacilityBundlePublisher(pool);
    await expect(
      publisher.publish({
        municipalityTerc: '3261011',
        artifacts: [
          {
            artifactId: mainArtifact.id,
            sourceKey: MAIN_KEY,
            retrievedAt: mainArtifact.retrievedAt.toISOString(),
          },
          {
            artifactId: faqArtifact.id,
            sourceKey: FAQ_KEY,
            retrievedAt: faqArtifact.retrievedAt.toISOString(),
          },
        ],
        entities: [
          {
            facility: atomic,
            assertions: [
              {
                sourceKey: MAIN_KEY,
                claims: ['identity', 'address', 'location', 'openingHours', 'access'],
                sourceAuthority: 200,
                verificationStatus: 'OFFICIAL_SOURCE',
                confidence: 0.99,
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow('missing-source-key');

    const rolledBack = await pool.query<{ facilities: string; assertions: string }>(
      `SELECT
         (SELECT count(*) FROM facilities WHERE canonical_key = $1)::text AS facilities,
         (SELECT count(*) FROM facility_source_assertions WHERE name = $2)::text AS assertions`,
      [atomic.key, atomic.name],
    );
    expect(rolledBack.rows[0]).toEqual({ facilities: '0', assertions: '0' });
  });
});
