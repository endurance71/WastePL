import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './main.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('WastePL API vertical slice', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    app = await createApp();
    app.useLogger(['error']);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('resolves canonical addresses from free text', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/addresses/resolve?query=1%20Maja%203',
    });

    expect(response.statusCode, response.body).toBe(200);
    const body = response.json();
    expect(body.query).toBe('1 Maja 3');
    expect(body.items).toHaveLength(1);
    expect(body.items[0].address).toMatchObject({
      canonicalText: '1 Maja 3, 75-800 Koszalin',
      municipality: { terc: '3261011', name: 'Koszalin' },
    });
    expect(body.items[0].score).toBe(0.9);
  });

  it('returns the Koszalin BIO schedule with provenance', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/collection?address=1%20Maja%203&from=2026-08-26&days=8',
    });

    expect(response.statusCode, response.body).toBe(200);
    const body = response.json();
    expect(body.address.canonicalText).toBe('1 Maja 3, 75-800 Koszalin');
    expect(body.municipality.terc).toBe('3261011');
    expect(body.serviceArea.name).toContain('środa');
    expect(body.events).toEqual([
      { date: '2026-08-26', fraction: 'BIO', status: 'SCHEDULED' },
      { date: '2026-09-02', fraction: 'BIO', status: 'SCHEDULED' },
    ]);
    expect(body.source).toEqual({
      url: 'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/koszalin2/bio.pdf',
      format: 'PDF_TEXT',
    });
    expect(body.quality).toMatchObject({
      verificationStatus: 'OFFICIAL_SOURCE',
      confidence: 0.995,
      retrievedAt: '2026-08-27T15:00:00.000Z',
      warnings: [],
    });
  });

  it('returns the Manowo canonical fractions from the fixture schedule', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/collection?address=Bonin%202&from=2026-01-01&days=31',
    });

    expect(response.statusCode, response.body).toBe(200);
    const body = response.json();
    expect(body.municipality.terc).toBe('3209042');
    expect(body.events).toHaveLength(10);
    expect(body.events.filter((event: { date: string }) => event.date === '2026-01-07')).toHaveLength(4);
    expect(body.events).toContainEqual({
      date: '2026-01-13',
      fraction: 'MIXED',
      status: 'SCHEDULED',
    });
    expect(body.quality.confidence).toBe(0.99);
  });

  it('supports canonical addressId input', async () => {
    const addressResponse = await app.inject({
      method: 'GET',
      url: '/v1/addresses/resolve?query=1%20Maja%208',
    });
    expect(addressResponse.statusCode, addressResponse.body).toBe(200);
    const addressId = addressResponse.json().items[0]?.address?.id as string | undefined;
    expect(addressId).toBeTruthy();

    const response = await app.inject({
      method: 'GET',
      url: `/v1/collection?addressId=${addressId}&from=2026-08-28&days=1`,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().events).toEqual([
      { date: '2026-08-28', fraction: 'BIO', status: 'SCHEDULED' },
    ]);
  });

  it('returns 404 for an unresolved address', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/collection?address=Nieistniejaca%209999&from=2026-08-27&days=7',
    });
    expect(response.statusCode, response.body).toBe(404);
    expect(response.json().code).toBe('ADDRESS_NOT_FOUND');
  });

  it('returns 409 instead of silently choosing between equally ranked service areas', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    let conflictingAreaId: string | null = null;
    try {
      const addressResult = await pool.query<{ id: string; municipality_id: string }>(
        `SELECT id, municipality_id
         FROM addresses
         WHERE canonical_text = '1 Maja 3, 75-800 Koszalin'
         LIMIT 1`,
      );
      const address = addressResult.rows[0];
      if (!address) throw new Error('Golden Koszalin address missing');

      const areaResult = await pool.query<{ id: string }>(
        `INSERT INTO service_areas (municipality_id, external_key, name, building_type)
         VALUES ($1, $2, 'Integration conflict area', 'MULTI_FAMILY')
         RETURNING id`,
        [address.municipality_id, `integration-conflict-${Date.now()}`],
      );
      conflictingAreaId = areaResult.rows[0]?.id ?? null;
      if (!conflictingAreaId) throw new Error('Failed to create conflict service area');

      await pool.query(
        `INSERT INTO service_area_rules (service_area_id, rule_type, address_id, priority)
         VALUES ($1, 'EXPLICIT_ADDRESS', $2, 100)`,
        [conflictingAreaId, address.id],
      );

      const response = await app.inject({
        method: 'GET',
        url: `/v1/collection?addressId=${address.id}&from=2026-08-26&days=7`,
      });
      expect(response.statusCode, response.body).toBe(409);
      const body = response.json();
      expect(body.code).toBe('AMBIGUOUS_SERVICE_AREA');
      expect(body.candidates).toHaveLength(2);
    } finally {
      if (conflictingAreaId) {
        await pool.query('DELETE FROM service_areas WHERE id = $1', [conflictingAreaId]);
      }
      await pool.end();
    }
  });
});
