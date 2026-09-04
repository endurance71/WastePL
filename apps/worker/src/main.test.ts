import { describe, expect, it } from 'vitest';
import { createIngestionWorker, createRedisConnection, startMaintenanceLoop } from './main.js';

describe('worker bootstrap exports', () => {
  it('exposes factories without connecting during module import', () => {
    expect(typeof createRedisConnection).toBe('function');
    expect(typeof createIngestionWorker).toBe('function');
    expect(typeof startMaintenanceLoop).toBe('function');
  });

  it('runs maintenance loop tick and invokes push dispatch when forced', async () => {
    let pushInvoked = false;
    const fakeSourceScheduler = {
      runOnce: async () => ({ claimed: 0 }),
    } as any;
    const fakeArtifactOutbox = {
      runOnce: async () => ({ processed: 0 }),
    } as any;
    const fakePushService = {
      dispatchForDate: async () => {
        pushInvoked = true;
        return { totalEligible: 0, sent: 0, failed: 0, unsubscribed: 0 };
      },
    } as any;

    process.env.PUSH_DISPATCH_ON_TICK = 'true';
    const loop = startMaintenanceLoop(fakeSourceScheduler, fakeArtifactOutbox, 5000, fakePushService);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await loop.stop();
    delete process.env.PUSH_DISPATCH_ON_TICK;

    expect(pushInvoked).toBe(true);
  });
});
