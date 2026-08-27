import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../main.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

interface SeedIds {
  sourceIds: string[];
  artifactIds: string[];
  facilityIds: string[];
}

integrationDescribe('GET /v1/facilities', () => {
  let app: NestFastifyApplication;
  let pool: InstanceType<typeof Pool>;
  const seed: SeedIds = { sourceIds: [], artifactIds: [], facilityIds: [] };

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const municipality = await pool.query<{ id: string }>(
      `SELECT id FROM municipalities WHERE terc = '3261011' LIMIT 1`,
    );
    const municipalityId = municipality.rows[0]?.id;
    if (!municipalityId) throw new Error('Koszalin pilot municipality missing');

    const sourceSpecs = [
      ['https://example.test/wastepl/facility-api/pszok', 'MUNICIPAL_COMPANY', 'api-test-pszok'],
      ['https://example.test/wastepl/facility-api/rvm', 'DEPOSIT_OPERATOR', 'api-test-rvm'],
      ['https://example.test/wastepl/facility-api/manual', 'DEPOSIT_OPERATOR', 'api-test-manual'],
      ['https://example.test/wastepl/facility-api/outside', 'OTHER_PUBLIC', 'api-test-outside'],
    ] as const;

    for (const [url, ownerType, parserKey] of sourceSpecs) {
      const source = await pool.query<{ id: string }>(
        `INSERT INTO sources (
           municipality_id, owner_type, owner_name, source_url, source_format, parser_key
         ) VALUES ($1, $2, 'Facilities API integration test', $3, 'JSON', $4)
         ON CONFLICT (source_url) DO UPDATE SET parser_key = EXCLUDED.parser_key
         RETURNING id`,
        [municipalityId, ownerType, url, parserKey],
      );
      seed.sourceIds.push(source.rows[0]!.id);
    }

    for (const [index, sourceId] of seed.sourceIds.entries()) {
      const hash = String(index + 1).repeat(64);
      const artifact = await pool.query<{ id: string }>(
        `INSERT INTO source_artifacts (
           source_id, retrieved_at, sha256, storage_uri, parser_key, parser_version,
           extraction_confidence, status, parse_report
         ) VALUES (
           $1, '2026-08-27T18:30:00Z', $2, $3, $4, '1.0.0', 0.99,
           'NORMALIZED', '{"integrationTest":true}'::jsonb
         )
         ON CONFLICT (source_id, sha256) DO UPDATE SET parser_version = EXCLUDED.parser_version
         RETURNING id`,
        [sourceId, hash, `fixture://facility-api-${index + 1}`, `api-test-parser-${index + 1}`],
      );
      seed.artifactIds.push(artifact.rows[0]!.id);
    }

    const pszokHours = JSON.stringify({
      timezone: 'Europe/Warsaw',
      weekly: [
        { day: 'MONDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
        { day: 'WEDNESDAY', intervals: [{ opens: '10:00', closes: '18:00' }] },
      ],
      exceptions: [],
    });

    const inserts = [
      {
        canonicalKey: 'api-test-01-pszok',
        kind: 'PSZOK',
        name: 'API Test PSZOK Komunalna 5',
        address: 'ul. Komunalna 5, Koszalin',
        lon: 16.183616,
        lat: 54.212266,
        externalIds: [],
        materials: ['BULKY', 'TYRES', 'CONSTRUCTION'],
        containers: [],
        openingHours: pszokHours,
        accessScope: 'MUNICIPALITY_RESIDENTS',
        accessRequiresProof: true,
        accessRules: { quantityLimits: [{ material: 'TYRES', limit: '8/year' }] },
        operationalStatus: 'UNKNOWN',
        observedAt: null,
        artifactIndex: 0,
      },
      {
        canonicalKey: 'api-test-02-rvm',
        kind: 'DEPOSIT_RVM',
        name: 'API Test RVM',
        address: 'ul. Testowa 2, Koszalin',
        lon: 16.1845,
        lat: 54.213,
        externalIds: [{ provider: 'operator-test', id: 'rvm-1' }],
        materials: [],
        containers: ['PET_BOTTLE', 'METAL_CAN'],
        openingHours: pszokHours,
        accessScope: 'OPEN_TO_ALL',
        accessRequiresProof: false,
        accessRules: {},
        operationalStatus: 'OPERATIONAL',
        observedAt: '2026-08-27T18:29:00Z',
        artifactIndex: 1,
      },
      {
        canonicalKey: 'api-test-03-manual',
        kind: 'DEPOSIT_MANUAL',
        name: 'API Test Manual Return',
        address: 'ul. Testowa 3, Koszalin',
        lon: 16.1855,
        lat: 54.214,
        externalIds: [{ provider: 'retailer-test', id: 'store-3' }],
        materials: [],
        containers: ['PET_BOTTLE'],
        openingHours: null,
        accessScope: 'OPEN_TO_ALL',
        accessRequiresProof: false,
        accessRules: {},
        operationalStatus: 'UNKNOWN',
        observedAt: null,
        artifactIndex: 2,
      },
      {
        canonicalKey: 'api-test-99-outside',
        kind: 'PSZOK',
        name: 'API Test Outside Bbox',
        address: 'Outside test point',
        lon: 16.3,
        lat: 54.3,
        externalIds: [],
        materials: ['TEXTILES'],
        containers: [],
        openingHours: null,
        accessScope: 'UNKNOWN',
        accessRequiresProof: null,
        accessRules: {},
        operationalStatus: 'UNKNOWN',
        observedAt: null,
        artifactIndex: 3,
      },
    ];

    for (const item of inserts) {
      const artifactId = seed.artifactIds[item.artifactIndex]!;
      const hasHours = item.openingHours !== null;
      const knownAccess = item.accessScope !== 'UNKNOWN';
      const knownStatus = item.operationalStatus !== 'UNKNOWN';
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO facilities (
           municipality_id, canonical_key, kind, name, address_text, geom,
           external_ids, accepted_materials, accepted_containers,
           opening_hours, opening_hours_timezone, hours_source_artifact_id,
           access_scope, access_requires_proof, access_rules, access_source_artifact_id,
           operational_status, operational_status_observed_at,
           operational_status_source_artifact_id, location_source_artifact_id,
           operator_name, verification_status, confidence, source_artifact_id
         ) VALUES (
           $1, $2, $3, $4, $5,
           ST_SetSRID(ST_MakePoint($6, $7), 4326),
           $8::jsonb, $9::text[], $10::text[],
           $11::jsonb, $12, $13,
           $14, $15, $16::jsonb, $17,
           $18, $19::timestamptz, $20, $21,
           'Facilities API integration test', 'OFFICIAL_SOURCE', 0.99, $22
         ) RETURNING id`,
        [
          municipalityId,
          item.canonicalKey,
          item.kind,
          item.name,
          item.address,
          item.lon,
          item.lat,
          JSON.stringify(item.externalIds),
          item.materials,
          item.containers,
          item.openingHours,
          hasHours ? 'Europe/Warsaw' : null,
          hasHours ? artifactId : null,
          item.accessScope,
          item.accessRequiresProof,
          JSON.stringify(item.accessRules),
          knownAccess ? artifactId : null,
          item.operationalStatus,
          item.observedAt,
          knownStatus ? artifactId : null,
          artifactId,
          artifactId,
        ],
      );
      seed.facilityIds.push(inserted.rows[0]!.id);
    }

    app = await createApp();
    app.useLogger(['error']);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (seed.facilityIds.length > 0) {
      await pool.query('DELETE FROM facilities WHERE id = ANY($1::uuid[])', [seed.facilityIds]);
    }
    if (seed.sourceIds.length > 0) {
      await pool.query('DELETE FROM sources WHERE id = ANY($1::uuid[])', [seed.sourceIds]);
    }
    await pool.end();
  });

  it('returns a PSZOK with exact source and claim provenance and no openNow field', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/facilities?terc=3261011&kind=PSZOK&material=TYRES&limit=10',
    });

    expect(response.statusCode, response.body).toBe(200);
    const body = response.json();
    const pszok = body.items.find((item: { canonicalKey: string }) => item.canonicalKey === 'api-test-01-pszok');
    expect(pszok).toBeTruthy();
    expect(pszok).not.toHaveProperty('openNow');
    expect(pszok).toMatchObject({
      kind: 'PSZOK',
      location: { lat: 54.212266, lon: 16.183616 },
      operationalStatus: { state: 'UNKNOWN', observedAt: null },
      quality: { verificationStatus: 'OFFICIAL_SOURCE', confidence: 0.99 },
    });
    expect(pszok.provenance.primary.url).toContain('/facility-api/pszok');
    expect(pszok.provenance.location.artifactId).toBe(pszok.provenance.primary.artifactId);
    expect(pszok.provenance.openingHours.artifactId).toBe(pszok.provenance.primary.artifactId);
    expect(pszok.provenance.access.artifactId).toBe(pszok.provenance.primary.artifactId);
    expect(pszok.provenance.operationalStatus).toBeNull();
  });

  it('returns radius results ordered by distance while keeping PSZOK/RVM/manual distinct', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/facilities?lat=54.212266&lon=16.183616&radiusMeters=1000&limit=10',
    });
    expect(response.statusCode, response.body).toBe(200);
    const items = response.json().items;
    const testItems = items.filter((item: { canonicalKey: string | null }) => item.canonicalKey?.startsWith('api-test-'));
    expect(testItems.map((item: { kind: string }) => item.kind)).toEqual([
      'PSZOK', 'DEPOSIT_RVM', 'DEPOSIT_MANUAL',
    ]);
    expect(testItems[0].distanceMeters).toBeLessThanOrEqual(testItems[1].distanceMeters);
    expect(testItems[1].distanceMeters).toBeLessThanOrEqual(testItems[2].distanceMeters);
  });

  it('supports bbox and accepted-container filters', async () => {
    const bbox = await app.inject({
      method: 'GET',
      url: '/v1/facilities?bbox=16.17,54.20,16.20,54.22&limit=20',
    });
    expect(bbox.statusCode, bbox.body).toBe(200);
    const keys = bbox.json().items.map((item: { canonicalKey: string | null }) => item.canonicalKey);
    expect(keys).toContain('api-test-01-pszok');
    expect(keys).toContain('api-test-02-rvm');
    expect(keys).toContain('api-test-03-manual');
    expect(keys).not.toContain('api-test-99-outside');

    const container = await app.inject({
      method: 'GET',
      url: '/v1/facilities?container=METAL_CAN&terc=3261011',
    });
    expect(container.statusCode, container.body).toBe(200);
    const matched = container.json().items.filter((item: { canonicalKey: string | null }) => item.canonicalKey?.startsWith('api-test-'));
    expect(matched).toHaveLength(1);
    expect(matched[0].canonicalKey).toBe('api-test-02-rvm');
  });

  it('keeps null hours/status as unknown rather than false', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/facilities?kind=DEPOSIT_MANUAL&terc=3261011',
    });
    expect(response.statusCode, response.body).toBe(200);
    const manual = response.json().items.find((item: { canonicalKey: string }) => item.canonicalKey === 'api-test-03-manual');
    expect(manual.openingHours).toBeNull();
    expect(manual.operationalStatus).toEqual({ state: 'UNKNOWN', observedAt: null });
    expect(manual.quality.warnings).toContain('OPENING_HOURS_UNKNOWN');
    expect(manual.provenance.openingHours).toBeNull();
    expect(manual.provenance.operationalStatus).toBeNull();
  });

  it('paginates deterministically', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/v1/facilities?terc=3261011&limit=1&offset=0',
    });
    const second = await app.inject({
      method: 'GET',
      url: '/v1/facilities?terc=3261011&limit=1&offset=1',
    });
    expect(first.statusCode, first.body).toBe(200);
    expect(second.statusCode, second.body).toBe(200);
    expect(first.json().items).toHaveLength(1);
    expect(second.json().items).toHaveLength(1);
    expect(first.json().items[0].id).not.toBe(second.json().items[0].id);
    expect(first.json().page.nextOffset).toBe(1);
  });

  it.each([
    ['/v1/facilities?bbox=16,54,15,55', 'INVALID_BBOX_ORDER'],
    ['/v1/facilities?lat=54.2&lon=16.2', 'INCOMPLETE_NEAR_FILTER'],
    ['/v1/facilities?lat=54.2&lon=16.2&radiusMeters=200000', 'INVALID_RADIUSMETERS'],
    ['/v1/facilities?bbox=16,54,17,55&lat=54.2&lon=16.2&radiusMeters=1000', 'SPATIAL_FILTER_CONFLICT'],
  ])('rejects invalid spatial query %s', async (url, code) => {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode, response.body).toBe(400);
    expect(response.json().code).toBe(code);
  });
});
