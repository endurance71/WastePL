import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import webpush from 'web-push';
import { PushNotificationService } from './push-notification-service.js';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

describe('PushNotificationService', () => {
  let poolMock: { query: ReturnType<typeof vi.fn> };
  let service: PushNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    poolMock = {
      query: vi.fn(),
    };
    service = new PushNotificationService(poolMock as unknown as Pool, {
      subject: 'mailto:test@wastepl.local',
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
    });
  });

  it('sets vapid details on creation', () => {
    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:test@wastepl.local',
      'test-public-key',
      'test-private-key',
    );
  });

  it('dispatches notifications to eligible subscriptions and marks last_notified_at', async () => {
    poolMock.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT ps.id')) {
        return Promise.resolve({
          rows: [
            {
              id: 'sub-1',
              endpoint: 'https://push.example.com/1',
              p256dh_key: 'p256-key',
              auth_key: 'auth-key',
              address_id: 'addr-1',
              canonical_text: 'Dąbrowa 1',
              fractions: ['MIXED', 'BIO'],
            },
          ],
        });
      }
      if (sql.includes('UPDATE push_subscriptions')) {
        return Promise.resolve({ rowCount: 1 });
      }
      return Promise.resolve({ rows: [] });
    });

    vi.mocked(webpush.sendNotification).mockResolvedValue({} as any);

    const result = await service.dispatchForDate('2026-09-05', 'EVENING_BEFORE');

    expect(result).toEqual({
      totalEligible: 1,
      sent: 1,
      failed: 0,
      unsubscribed: 0,
    });

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example.com/1',
        keys: {
          p256dh: 'p256-key',
          auth: 'auth-key',
        },
      },
      expect.stringContaining('Jutro wywóz: Odpady zmieszane, Bioodpady'),
    );

    expect(poolMock.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE push_subscriptions SET last_notified_at'),
      ['sub-1'],
    );
  });

  it('deletes subscription if push service returns 410 Gone', async () => {
    poolMock.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT ps.id')) {
        return Promise.resolve({
          rows: [
            {
              id: 'sub-expired',
              endpoint: 'https://push.example.com/expired',
              p256dh_key: 'p256-key',
              auth_key: 'auth-key',
              address_id: 'addr-1',
              canonical_text: 'Dąbrowa 1',
              fractions: ['MIXED'],
            },
          ],
        });
      }
      if (sql.includes('DELETE FROM push_subscriptions')) {
        return Promise.resolve({ rowCount: 1 });
      }
      return Promise.resolve({ rows: [] });
    });

    const goneError = new Error('Subscription expired') as any;
    goneError.statusCode = 410;
    vi.mocked(webpush.sendNotification).mockRejectedValue(goneError);

    const result = await service.dispatchForDate('2026-09-05', 'EVENING_BEFORE');

    expect(result).toEqual({
      totalEligible: 1,
      sent: 0,
      failed: 0,
      unsubscribed: 1,
    });

    expect(poolMock.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM push_subscriptions WHERE id = $1'),
      ['sub-expired'],
    );
  });
});
