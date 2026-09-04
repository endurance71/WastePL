import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import type { NotificationsService } from './notifications.service.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let serviceMock: Partial<NotificationsService>;

  beforeEach(() => {
    serviceMock = {
      getVapidPublicKey: vi.fn().mockReturnValue('test-public-key'),
      subscribe: vi.fn().mockResolvedValue({
        id: 'sub-uuid-1',
        installationId: 'inst-1',
        addressId: 'addr-uuid-1',
        endpoint: 'https://push.example.com/sub/1',
        reminderTiming: 'EVENING_BEFORE_20',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    controller = new NotificationsController(serviceMock as NotificationsService);
  });

  it('returns vapid public key', () => {
    const result = controller.getVapidPublicKey();
    expect(result).toEqual({ publicKey: 'test-public-key' });
  });

  it('validates subscription input and subscribes successfully', async () => {
    const result = await controller.subscribe({
      installationId: 'inst-1',
      addressId: 'addr-uuid-1',
      endpoint: 'https://push.example.com/sub/1',
      keys: {
        p256dh: 'p256-test',
        auth: 'auth-test',
      },
      reminderTiming: 'EVENING_BEFORE_20',
    });

    expect(result).toEqual({
      status: 'OK',
      subscriptionId: 'sub-uuid-1',
    });
    expect(serviceMock.subscribe).toHaveBeenCalledWith({
      installationId: 'inst-1',
      addressId: 'addr-uuid-1',
      endpoint: 'https://push.example.com/sub/1',
      keys: {
        p256dh: 'p256-test',
        auth: 'auth-test',
      },
      reminderTiming: 'EVENING_BEFORE_20',
    });
  });

  it('rejects invalid endpoint without https', async () => {
    await expect(
      controller.subscribe({
        installationId: 'inst-1',
        addressId: 'addr-uuid-1',
        endpoint: 'http://insecure.example.com',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects missing keys', async () => {
    await expect(
      controller.subscribe({
        installationId: 'inst-1',
        addressId: 'addr-uuid-1',
        endpoint: 'https://push.example.com',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('unsubscribes with valid endpoint', async () => {
    const result = await controller.unsubscribe('https://push.example.com/sub/1');
    expect(result).toEqual({
      status: 'OK',
      removed: true,
    });
    expect(serviceMock.unsubscribe).toHaveBeenCalledWith('https://push.example.com/sub/1');
  });

  it('rejects unsubscribe with missing endpoint', async () => {
    await expect(controller.unsubscribe('')).rejects.toThrow(BadRequestException);
  });
});
