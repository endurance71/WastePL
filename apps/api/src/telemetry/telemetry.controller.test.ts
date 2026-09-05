import { describe, expect, it, vi } from 'vitest';
import { TelemetryController } from './telemetry.controller.js';
import type { TelemetryService } from './telemetry.service.js';

describe('TelemetryController', () => {
  const mockService = {
    ingest: vi.fn().mockResolvedValue({ accepted: 1, deduplicated: 0 }),
  } as unknown as TelemetryService;

  const controller = new TelemetryController(mockService);

  it('accepts a valid event and strips exact-address/user-agent style fields', async () => {
    const timestamp = new Date().toISOString();
    const result = await controller.ingest({
      events: [
        {
          id: 'evt-1',
          installationId: 'install-123',
          eventType: 'SCHEDULE_SHOWN',
          timestamp,
          payload: {
            addressId: '00000000-0000-0000-0000-000000000001',
            userAgent: 'should-not-be-stored',
            terc: '3261011',
            eventCount: 12,
            isCached: false,
            sourceParser: 'pdf-text-v1',
          },
        },
      ],
    });

    expect(result).toEqual({ status: 'OK', received: 1, accepted: 1, deduplicated: 0 });
    expect(mockService.ingest).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'evt-1',
        installationId: 'install-123',
        eventType: 'SCHEDULE_SHOWN',
        payload: {
          terc: '3261011',
          eventCount: 12,
          isCached: false,
          sourceParser: 'pdf-text-v1',
        },
      }),
    ]);
  });

  it('rejects an unsupported event type', async () => {
    await expect(
      controller.ingest({
        events: [
          {
            id: 'evt-2',
            installationId: 'install-123',
            eventType: 'ARBITRARY_EVENT',
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    ).rejects.toThrow('Unsupported telemetry event type');
  });

  it('rejects batches larger than 100 events', async () => {
    const events = Array.from({ length: 101 }, (_, index) => ({
      id: `evt-${index}`,
      installationId: 'install-123',
      eventType: 'APP_OPEN',
      timestamp: new Date().toISOString(),
    }));

    await expect(controller.ingest({ events })).rejects.toThrow('A maximum of 100 events is accepted');
  });

  it('rejects stale timestamps outside the accepted window', async () => {
    const stale = new Date(Date.now() - 181 * 24 * 60 * 60 * 1000).toISOString();
    await expect(
      controller.ingest({
        events: [
          {
            id: 'evt-old',
            installationId: 'install-123',
            eventType: 'APP_OPEN',
            timestamp: stale,
          },
        ],
      }),
    ).rejects.toThrow('timestamp is invalid or outside the accepted time window');
  });
});
