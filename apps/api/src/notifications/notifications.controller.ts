import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { NotificationsService, type PushSubscriptionInput } from './notifications.service.js';

@Controller('v1/notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  @Get('vapid-public-key')
  getVapidPublicKey(): { publicKey: string } {
    return {
      publicKey: this.notifications.getVapidPublicKey(),
    };
  }

  @Post('subscribe')
  async subscribe(
    @Body() body: Partial<PushSubscriptionInput>,
  ): Promise<{ status: 'OK'; subscriptionId: string }> {
    if (!body.installationId || typeof body.installationId !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_INSTALLATION_ID',
        message: 'installationId is required',
      });
    }
    if (!body.addressId || typeof body.addressId !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_ADDRESS_ID',
        message: 'addressId is required',
      });
    }
    if (!body.endpoint || typeof body.endpoint !== 'string' || !body.endpoint.startsWith('https://')) {
      throw new BadRequestException({
        code: 'INVALID_ENDPOINT',
        message: 'endpoint must be a valid https URL',
      });
    }
    if (!body.keys || typeof body.keys.p256dh !== 'string' || typeof body.keys.auth !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_KEYS',
        message: 'keys with p256dh and auth are required',
      });
    }

    const timing = body.reminderTiming ?? 'EVENING_BEFORE_20';
    const validTimings = ['EVENING_BEFORE_18', 'EVENING_BEFORE_20', 'MORNING_OF_06', 'BOTH'];
    if (!validTimings.includes(timing)) {
      throw new BadRequestException({
        code: 'INVALID_REMINDER_TIMING',
        message: `reminderTiming must be one of: ${validTimings.join(', ')}`,
      });
    }

    const result = await this.notifications.subscribe({
      installationId: body.installationId.trim(),
      addressId: body.addressId.trim(),
      endpoint: body.endpoint.trim(),
      keys: {
        p256dh: body.keys.p256dh.trim(),
        auth: body.keys.auth.trim(),
      },
      reminderTiming: timing,
    });

    return {
      status: 'OK',
      subscriptionId: result.id,
    };
  }

  @Post('unsubscribe')
  async unsubscribe(
    @Body('endpoint') endpoint?: string,
  ): Promise<{ status: 'OK'; removed: boolean }> {
    if (!endpoint || typeof endpoint !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_ENDPOINT',
        message: 'endpoint is required',
      });
    }

    const removed = await this.notifications.unsubscribe(endpoint.trim());
    return {
      status: 'OK',
      removed,
    };
  }
}
