import { BadRequestException, Body, Controller, Inject, Post } from '@nestjs/common';
import { FeedbackService, type ScheduleDiscrepancyFeedbackInput } from './feedback.service.js';

const VALID_ISSUE_TYPES = new Set([
  'WRONG_DATE',
  'MISSING_FRACTION',
  'UNSUPPORTED_ADDRESS',
  'EXTRA_COLLECTION',
  'OTHER',
]);

@Controller('v1/feedback')
export class FeedbackController {
  constructor(@Inject(FeedbackService) private readonly feedback: FeedbackService) {}

  @Post('schedule-discrepancy')
  async submitScheduleDiscrepancy(
    @Body() body: Partial<ScheduleDiscrepancyFeedbackInput>,
  ): Promise<{ status: 'OK'; feedbackId: string }> {
    if (!body.installationId || typeof body.installationId !== 'string' || body.installationId.trim().length === 0) {
      throw new BadRequestException({
        code: 'INVALID_INSTALLATION_ID',
        message: 'installationId is required',
      });
    }

    if (!body.reportedIssueType || !VALID_ISSUE_TYPES.has(body.reportedIssueType)) {
      throw new BadRequestException({
        code: 'INVALID_ISSUE_TYPE',
        message: `reportedIssueType must be one of: ${Array.from(VALID_ISSUE_TYPES).join(', ')}`,
      });
    }

    const result = await this.feedback.submitDiscrepancy({
      installationId: body.installationId.trim(),
      addressId: body.addressId?.trim() || null,
      reportedIssueType: body.reportedIssueType,
      details: body.details?.trim() || null,
      clientTimestamp: body.clientTimestamp || null,
    });

    return {
      status: 'OK',
      feedbackId: result.id,
    };
  }
}
