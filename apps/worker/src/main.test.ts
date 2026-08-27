import { describe, expect, it } from 'vitest';
import { createIngestionWorker, createRedisConnection, startMaintenanceLoop } from './main.js';

describe('worker bootstrap exports', () => {
  it('exposes factories without connecting during module import', () => {
    expect(typeof createRedisConnection).toBe('function');
    expect(typeof createIngestionWorker).toBe('function');
    expect(typeof startMaintenanceLoop).toBe('function');
  });
});
