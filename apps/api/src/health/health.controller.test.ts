import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@wastepl/domain';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns a healthy WastePL response', () => {
    const response = new HealthController().getHealth();

    expect(response.status).toBe('ok');
    expect(response.service).toBe(APP_NAME);
    expect(Number.isNaN(Date.parse(response.time))).toBe(false);
  });
});
