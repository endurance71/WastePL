import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../main.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('Resident telemetry API', () => {
  let app: NestFastifyApplication;
  let pool: pg.Pool;

  beforeEach(async () => {
    app = await createApp();
    app.useLogger(['error']);
    await app.init();
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("DELETE FROM resident_telemetry_events WHERE event_id LIKE 'e2e-telemetry-%'");
  });

  afterEach(async () => {
    await pool.query("DELETE FROM resident_telemetry_events WHERE event_id LIKE 'e2e-telemetry-%'");
    await pool.end();
    await app.close();
  });

  it('stores only hashed installation identity and allowlisted payload fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/telemetry/events',
      payload: {
        events: [
          {
            id: 'e2e-telemetry-1',
            installationId: 'raw-e2e-installation-id',
            eventType: 'ADDRESS_SELECTED',
            timestamp: new Date().toISOString(),
            payload: {
              terc: '3261011',
              addressId: '00000000-0000-0000-0000-000000000001',
              userAgent: 'must-not-be-stored',
            },
          },
        ],
      },
    });

    expect(response.statusCode, response.body).toBe(201);
    expect(response.json()).toEqual({ status: 'OK', received: 1, accepted: 1, deduplicated: 0 });

    const result = await pool.query<{
      installation_hash: string;
      event_type: string;
      payload: Record<string, unknown>;
    }>(
      `SELECT installation_hash, event_type, payload
       FROM resident_telemetry_events
       WHERE event_id = $1`,
      ['e2e-telemetry-1'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.installation_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.rows[0]?.installation_hash).not.toContain('raw-e2e-installation-id');
    expect(result.rows[0]?.event_type).toBe('ADDRESS_SELECTED');
    expect(result.rows[0]?.payload).toEqual({ terc: '3261011' });
  });

  it('deduplicates retries by client event id', async () => {
    const payload = {
      events: [
        {
          id: 'e2e-telemetry-dedupe',
          installationId: 'raw-e2e-installation-id',
          eventType: 'APP_OPEN',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const first = await app.inject({ method: 'POST', url: '/v1/telemetry/events', payload });
    expect(first.statusCode, first.body).toBe(201);
    expect(first.json().accepted).toBe(1);

    const second = await app.inject({ method: 'POST', url: '/v1/telemetry/events', payload });
    expect(second.statusCode, second.body).toBe(201);
    expect(second.json()).toEqual({ status: 'OK', received: 1, accepted: 0, deduplicated: 1 });
  });
});
