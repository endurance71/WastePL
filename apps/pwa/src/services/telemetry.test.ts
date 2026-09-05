import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import {
  clearQueuedEvents,
  flushTelemetryQueue,
  getAnonymousInstallationId,
  getQueuedEvents,
  recordSessionStart,
  trackEvent,
} from './telemetry.js';

describe('Telemetry Service', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };

    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates and persists an anonymous installation ID', () => {
    const id1 = getAnonymousInstallationId();
    expect(id1).toBeTruthy();
    expect(mockStorage['wastepl_installation_id']).toBe(id1);

    const id2 = getAnonymousInstallationId();
    expect(id2).toBe(id1);
  });

  it('queues telemetry events with appropriate metadata', () => {
    const event = trackEvent('ADDRESS_SEARCH', { queryLength: 8, resultCount: 2 });
    expect(event.eventType).toBe('ADDRESS_SEARCH');
    expect(event.payload).toEqual({ queryLength: 8, resultCount: 2 });
    expect(event.timestamp).toBeDefined();

    const queued = getQueuedEvents();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.eventType).toBe('ADDRESS_SEARCH');
  });

  it('strips exact address and fingerprint-like fields before queueing', () => {
    const event = trackEvent('ADDRESS_SELECTED', {
      addressId: '00000000-0000-0000-0000-000000000001',
      municipality: 'Koszalin',
      terc: '3261011',
      userAgent: 'should-not-leave-browser',
    });

    expect(event.payload).toEqual({ terc: '3261011' });
    expect(JSON.stringify(getQueuedEvents())).not.toContain('addressId');
    expect(JSON.stringify(getQueuedEvents())).not.toContain('userAgent');
  });

  it('bounds queue size to 100 entries', () => {
    for (let i = 0; i < 110; i++) {
      trackEvent('ADDRESS_SEARCH', { queryLength: i, resultCount: 0 });
    }
    const queued = getQueuedEvents();
    expect(queued.length).toBe(100);
    expect(queued[0]?.payload?.['queryLength']).toBe(10);
  });

  it('records APP_OPEN on first visit and RETURN_VISIT after 2+ hours', () => {
    const firstEvent = recordSessionStart();
    expect(firstEvent.eventType).toBe('APP_OPEN');
    expect(firstEvent.payload).toBeUndefined();

    const immediateEvent = recordSessionStart();
    expect(immediateEvent.eventType).toBe('APP_OPEN');

    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    mockStorage['wastepl_last_visit_timestamp'] = threeHoursAgo.toString();

    const returnEvent = recordSessionStart();
    expect(returnEvent.eventType).toBe('RETURN_VISIT');
  });

  it('flushes queue via HTTP and clears stored items upon success', async () => {
    trackEvent('ADDRESS_SELECTED', { terc: '3261011' });
    expect(getQueuedEvents()).toHaveLength(1);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const success = await flushTelemetryQueue();
    expect(success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/telemetry/events',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(getQueuedEvents()).toHaveLength(0);
  });

  it('preserves queue if backend flush fails', async () => {
    trackEvent('ADDRESS_SELECTED', { terc: '3261011' });

    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    const success = await flushTelemetryQueue();
    expect(success).toBe(false);
    expect(getQueuedEvents()).toHaveLength(1);
  });

  it('clearQueuedEvents removes buffered telemetry', () => {
    trackEvent('APP_OPEN');
    expect(getQueuedEvents()).toHaveLength(1);
    clearQueuedEvents();
    expect(getQueuedEvents()).toHaveLength(0);
  });
});
