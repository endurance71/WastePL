import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';

export interface PushSubscriptionInput {
  installationId: string;
  addressId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  reminderTiming: string;
}

export interface PushSubscriptionRecord {
  id: string;
  installationId: string;
  addressId: string;
  endpoint: string;
  reminderTiming: string;
  createdAt: Date;
  updatedAt: Date;
}

// Development default VAPID public key (can be overridden via VAPID_PUBLIC_KEY env var)
export const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BCwZJ_iYyKzY1Vw5sZ0t7mYVw7i8f0s6w1z8w6v4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
  ) {}

  getVapidPublicKey(): string {
    return DEFAULT_VAPID_PUBLIC_KEY;
  }

  async subscribe(input: PushSubscriptionInput): Promise<PushSubscriptionRecord> {
    // 1. Verify address exists
    const addressCheck = await this.database.pool.query<QueryResultRow & { id: string }>(
      'SELECT id FROM addresses WHERE id = $1 AND active = true',
      [input.addressId],
    );
    if (!addressCheck.rows[0]) {
      throw new NotFoundException({
        code: 'ADDRESS_NOT_FOUND',
        message: `Address ${input.addressId} does not exist or is inactive`,
      });
    }

    // 2. Upsert subscription on endpoint conflict
    const result = await this.database.pool.query<QueryResultRow & {
      id: string;
      installation_id: string;
      address_id: string;
      endpoint: string;
      reminder_timing: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO push_subscriptions (
         installation_id, address_id, endpoint, p256dh_key, auth_key, reminder_timing, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (endpoint) DO UPDATE SET
         installation_id = EXCLUDED.installation_id,
         address_id = EXCLUDED.address_id,
         p256dh_key = EXCLUDED.p256dh_key,
         auth_key = EXCLUDED.auth_key,
         reminder_timing = EXCLUDED.reminder_timing,
         updated_at = now()
       RETURNING id, installation_id, address_id, endpoint, reminder_timing, created_at, updated_at`,
      [
        input.installationId,
        input.addressId,
        input.endpoint,
        input.keys.p256dh,
        input.keys.auth,
        input.reminderTiming,
      ],
    );

    const row = result.rows[0]!;
    return {
      id: row.id,
      installationId: row.installation_id,
      addressId: row.address_id,
      endpoint: row.endpoint,
      reminderTiming: row.reminder_timing,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async unsubscribe(endpoint: string): Promise<boolean> {
    const result = await this.database.pool.query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1',
      [endpoint],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
