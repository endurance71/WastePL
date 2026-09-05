import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import { TelemetryService } from './telemetry.service.js';

describe('TelemetryService', () => {
  it('hashes installation id before persistence and reports deduplicated events', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 });

    const db = { pool: { query } } as unknown as DatabaseService;
    const service = new TelemetryService(db);
    const timestamp = new Date().toISOString();

    const result = await service.ingest([
      {
        id: 'evt-1',
        installationId: 'raw-installation-id',
        eventType: 'APP_OPEN',
        timestamp,
        payload: {},
      },
      {
        id: 'evt-2',
        installationId: 'raw-installation-id',
        eventType: 'RETURN_VISIT',
        timestamp,
        payload: {},
      },
    ]);

    const expectedHash = createHash('sha256').update('raw-installation-id').digest('hex');
    expect(query.mock.calls[0]?.[1]?.[1]).toBe(expectedHash);
    expect(query.mock.calls[0]?.[1]).not.toContain('raw-installation-id');
    expect(result).toEqual({ accepted: 1, deduplicated: 1 });
    expect(query).toHaveBeenLastCalledWith(
      'DELETE FROM resident_telemetry_events WHERE expires_at < NOW()',
    );
  });
});
