import type { Pool, QueryResultRow } from 'pg';
import webpush from 'web-push';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    addressId?: string;
    date?: string;
    fractions?: string[];
  };
}

export interface DispatchResult {
  totalEligible: number;
  sent: number;
  failed: number;
  unsubscribed: number;
}

interface SubscriptionRow extends QueryResultRow {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  address_id: string;
  canonical_text: string;
  fractions: string[];
}

const FRACTION_LABELS: Record<string, string> = {
  MIXED: 'Odpady zmieszane',
  BIO: 'Bioodpady',
  PAPER: 'Papier',
  GLASS: 'Szkło',
  METALS_PLASTICS: 'Metale i tworzywa sztuczne',
  BULKY: 'Wielkogabarytowe',
  GREEN: 'Odpady zielone',
  ASH: 'Popiół',
  TEXTILES: 'Tekstylia',
  OTHER: 'Pozostałe odpady',
};

export class PushNotificationService {
  constructor(
    private readonly pool: Pool,
    private readonly vapidDetails: {
      subject: string;
      publicKey: string;
      privateKey: string;
    } = {
      subject: process.env.VAPID_SUBJECT || 'mailto:admin@wastepl.local',
      publicKey: process.env.VAPID_PUBLIC_KEY || 'BCwZJ_iYyKzY1Vw5sZ0t7mYVw7i8f0s6w1z8w6v4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1',
      privateKey: process.env.VAPID_PRIVATE_KEY || 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    },
  ) {
    webpush.setVapidDetails(
      this.vapidDetails.subject,
      this.vapidDetails.publicKey,
      this.vapidDetails.privateKey,
    );
  }

  /**
   * Dispatches notifications for an upcoming collection date (e.g. tomorrow or today)
   * matching the specified reminder timing slot.
   */
  async dispatchForDate(
    targetDate: string,
    timingSlot: 'EVENING_BEFORE' | 'MORNING_OF',
  ): Promise<DispatchResult> {
    const timingFilter =
      timingSlot === 'EVENING_BEFORE'
        ? ['EVENING_BEFORE_18', 'EVENING_BEFORE_20', 'BOTH']
        : ['MORNING_OF_06', 'BOTH'];

    // Query active subscriptions whose linked address has scheduled collections on targetDate
    const subscriptions = await this.pool.query<SubscriptionRow>(
      `SELECT ps.id, ps.endpoint, ps.p256dh_key, ps.auth_key, ps.address_id,
              a.canonical_text,
              array_agg(DISTINCT ce.fraction_code) AS fractions
       FROM push_subscriptions ps
       JOIN addresses a ON a.id = ps.address_id AND a.active = true
       JOIN address_service_areas asa ON asa.address_id = a.id AND asa.active = true
       JOIN collection_events ce ON ce.service_area_id = asa.service_area_id
       WHERE ce.collection_date = $1::date
         AND ce.valid_to IS NULL
         AND ce.status = 'SCHEDULED'
         AND ps.reminder_timing = ANY($2::text[])
         AND (ps.last_notified_at IS NULL OR ps.last_notified_at::date < now()::date)
       GROUP BY ps.id, ps.endpoint, ps.p256dh_key, ps.auth_key, ps.address_id, a.canonical_text`,
      [targetDate, timingFilter],
    );

    let sent = 0;
    let failed = 0;
    let unsubscribed = 0;

    for (const sub of subscriptions.rows) {
      const fractionNames = sub.fractions
        .map((f) => FRACTION_LABELS[f] ?? f)
        .join(', ');

      const prefix = timingSlot === 'EVENING_BEFORE' ? 'Jutro' : 'Dzisiaj';
      const payload: PushNotificationPayload = {
        title: `WastePL: ${prefix} odbiór odpadów`,
        body: `${prefix} wywóz: ${fractionNames}. Wystaw pojemnik przed posesję! (${sub.canonical_text})`,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: {
          url: '/',
          addressId: sub.address_id,
          date: targetDate,
          fractions: sub.fractions,
        },
      };

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh_key,
              auth: sub.auth_key,
            },
          },
          JSON.stringify(payload),
        );

        await this.pool.query(
          'UPDATE push_subscriptions SET last_notified_at = now() WHERE id = $1',
          [sub.id],
        );
        sent += 1;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or unregistered -> fail closed / clean up
          await this.pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
          unsubscribed += 1;
        } else {
          failed += 1;
        }
      }
    }

    return {
      totalEligible: subscriptions.rows.length,
      sent,
      failed,
      unsubscribed,
    };
  }
}
