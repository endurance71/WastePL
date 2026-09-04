import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface ScheduleDiscrepancyFeedbackInput {
  installationId: string;
  addressId?: string | null;
  reportedIssueType: string;
  details?: string | null;
  clientTimestamp?: string | null;
}

@Injectable()
export class FeedbackService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async submitDiscrepancy(input: ScheduleDiscrepancyFeedbackInput): Promise<{ id: string }> {
    const query = `
      INSERT INTO schedule_feedback (
        installation_id,
        address_id,
        reported_issue_type,
        details,
        client_timestamp
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const values = [
      input.installationId,
      input.addressId ?? null,
      input.reportedIssueType,
      input.details ?? null,
      input.clientTimestamp ? new Date(input.clientTimestamp) : null,
    ];

    const result = await this.db.pool.query<{ id: string }>(query, values);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to insert schedule feedback');
    }
    return { id: row.id };
  }
}

