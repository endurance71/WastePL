import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export type ResidentTelemetryEventType =
  | 'APP_OPEN'
  | 'RETURN_VISIT'
  | 'ADDRESS_SEARCH'
  | 'ADDRESS_SELECTED'
  | 'SCHEDULE_SHOWN'
  | 'REMINDER_ICS_EXPORT'
  | 'REMINDER_PUSH_OPT_IN'
  | 'FEEDBACK_MODAL_OPEN'
  | 'FEEDBACK_SUBMITTED';

export interface ResidentTelemetryEventInput {
  id: string;
  installationId: string;
  eventType: ResidentTelemetryEventType;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
}

@Injectable()
export class TelemetryService {
  private lastRetentionCleanupAt = 0;

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async ingest(events: ResidentTelemetryEventInput[]): Promise<{ accepted: number; deduplicated: number }> {
    let accepted = 0;

    for (const event of events) {
      const installationHash = createHash('sha256').update(event.installationId).digest('hex');
      const result = await this.db.pool.query(
        `
          INSERT INTO resident_telemetry_events (
            event_id,
            installation_hash,
            event_type,
            client_timestamp,
            payload
          ) VALUES ($1, $2, $3, $4, $5::jsonb)
          ON CONFLICT (event_id) DO NOTHING
        `,
        [
          event.id,
          installationHash,
          event.eventType,
          new Date(event.timestamp),
          JSON.stringify(event.payload),
        ],
      );
      accepted += result.rowCount ?? 0;
    }

    await this.maybeCleanupExpiredEvents();

    return {
      accepted,
      deduplicated: events.length - accepted,
    };
  }

  private async maybeCleanupExpiredEvents(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRetentionCleanupAt < 60 * 60 * 1000) return;

    await this.db.pool.query('DELETE FROM resident_telemetry_events WHERE expires_at < NOW()');
    this.lastRetentionCleanupAt = now;
  }
}
