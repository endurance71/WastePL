import { describe, expect, it, vi } from 'vitest';
import { FeedbackController } from './feedback.controller.js';
import type { FeedbackService } from './feedback.service.js';

describe('FeedbackController', () => {
  const mockService = {
    submitDiscrepancy: vi.fn().mockResolvedValue({ id: 'feedback-uuid-1' }),
  } as unknown as FeedbackService;

  const controller = new FeedbackController(mockService);

  it('accepts valid schedule discrepancy feedback', async () => {
    const result = await controller.submitScheduleDiscrepancy({
      installationId: 'inst-12345',
      addressId: '00000000-0000-0000-0000-000000000001',
      reportedIssueType: 'WRONG_DATE',
      details: 'Bio pickup was on Thursday, not Wednesday',
    });

    expect(result).toEqual({
      status: 'OK',
      feedbackId: 'feedback-uuid-1',
    });
    expect(mockService.submitDiscrepancy).toHaveBeenCalledWith({
      installationId: 'inst-12345',
      addressId: '00000000-0000-0000-0000-000000000001',
      reportedIssueType: 'WRONG_DATE',
      details: 'Bio pickup was on Thursday, not Wednesday',
      clientTimestamp: null,
    });
  });

  it('rejects missing installationId', async () => {
    await expect(
      controller.submitScheduleDiscrepancy({
        reportedIssueType: 'WRONG_DATE',
      }),
    ).rejects.toThrow('installationId is required');
  });

  it('rejects invalid reportedIssueType', async () => {
    await expect(
      controller.submitScheduleDiscrepancy({
        installationId: 'inst-123',
        reportedIssueType: 'NON_EXISTENT_ISSUE',
      }),
    ).rejects.toThrow('reportedIssueType must be one of');
  });
});
