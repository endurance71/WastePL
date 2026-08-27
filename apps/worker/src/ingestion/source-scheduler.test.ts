import { describe, expect, it, vi } from 'vitest';
import { ArtifactOutboxDispatcher, SourceScheduler } from './source-scheduler.js';
import type {
  ArtifactOutboxClaim,
  ArtifactOutboxRegistry,
  ArtifactProcessingQueue,
  SourcePollClaim,
  SourcePollJobQueue,
  SourceSchedulerRegistry,
} from './types.js';

const now = new Date('2026-08-27T20:00:00Z');

function sourceClaim(sourceId: string, claimToken: string): SourcePollClaim {
  return {
    sourceId,
    claimToken,
    sourceUrl: `https://example.test/${sourceId}`,
    parserKey: 'test-parser',
    claimedAt: now,
    claimExpiresAt: new Date(now.getTime() + 120_000),
  };
}

function outboxClaim(artifactId: string, enqueueAttempts = 0): ArtifactOutboxClaim {
  return {
    sourceId: '11111111-1111-4111-8111-111111111111',
    artifactId,
    parserKey: 'test-parser',
    claimToken: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    claimExpiresAt: new Date(now.getTime() + 120_000),
    enqueueAttempts,
  };
}

describe('SourceScheduler', () => {
  it('enqueues each claimed source exactly once', async () => {
    const claims = [
      sourceClaim('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      sourceClaim('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    ];
    const claimDueSources = vi.fn().mockResolvedValue(claims);
    const releasePollClaim = vi.fn().mockResolvedValue(undefined);
    const registry = { claimDueSources, releasePollClaim } as unknown as SourceSchedulerRegistry;
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const queue = { enqueue } as SourcePollJobQueue;

    const scheduler = new SourceScheduler(registry, queue, { batchSize: 10, leaseMs: 60_000 });
    await expect(scheduler.runOnce(now)).resolves.toEqual({
      claimed: 2,
      enqueued: 2,
      enqueueFailed: 0,
    });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(releasePollClaim).not.toHaveBeenCalled();
  });

  it('releases a DB claim when Redis enqueue fails instead of waiting for lease expiry', async () => {
    const claim = sourceClaim(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    const registry = {
      claimDueSources: vi.fn().mockResolvedValue([claim]),
      releasePollClaim: vi.fn().mockResolvedValue(undefined),
    } as unknown as SourceSchedulerRegistry;
    const queue = {
      enqueue: vi.fn().mockRejectedValue(new Error('redis unavailable')),
    } as SourcePollJobQueue;

    const scheduler = new SourceScheduler(registry, queue, { enqueueFailureDelayMs: 30_000 });
    await expect(scheduler.runOnce(now)).resolves.toEqual({
      claimed: 1,
      enqueued: 0,
      enqueueFailed: 1,
    });
    expect(registry.releasePollClaim).toHaveBeenCalledWith(
      claim.sourceId,
      claim.claimToken,
      new Date('2026-08-27T20:00:30.000Z'),
    );
  });
});

describe('ArtifactOutboxDispatcher', () => {
  it('marks a durable outbox row enqueued only after queue.add succeeds', async () => {
    const claim = outboxClaim('22222222-2222-4222-8222-222222222222');
    const registry = {
      claimPendingArtifactWork: vi.fn().mockResolvedValue([claim]),
      markArtifactWorkEnqueued: vi.fn().mockResolvedValue(undefined),
      releaseArtifactWorkClaim: vi.fn().mockResolvedValue(undefined),
    } as unknown as ArtifactOutboxRegistry;
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) } as ArtifactProcessingQueue;

    const dispatcher = new ArtifactOutboxDispatcher(registry, queue);
    await expect(dispatcher.runOnce(now)).resolves.toEqual({
      claimed: 1,
      enqueued: 1,
      enqueueFailed: 0,
    });
    expect(registry.markArtifactWorkEnqueued).toHaveBeenCalledWith(
      claim.artifactId,
      claim.claimToken,
      now,
    );
    expect(registry.releaseArtifactWorkClaim).not.toHaveBeenCalled();
  });

  it('uses exponential outbox enqueue backoff after a transport failure', async () => {
    const claim = outboxClaim('33333333-3333-4333-8333-333333333333', 2);
    const registry = {
      claimPendingArtifactWork: vi.fn().mockResolvedValue([claim]),
      markArtifactWorkEnqueued: vi.fn().mockResolvedValue(undefined),
      releaseArtifactWorkClaim: vi.fn().mockResolvedValue(undefined),
    } as unknown as ArtifactOutboxRegistry;
    const queue = {
      enqueue: vi.fn().mockRejectedValue(new Error('redis unavailable')),
    } as ArtifactProcessingQueue;

    const dispatcher = new ArtifactOutboxDispatcher(registry, queue, {
      baseRetryDelayMs: 5_000,
      maxRetryDelayMs: 300_000,
    });
    await expect(dispatcher.runOnce(now)).resolves.toEqual({
      claimed: 1,
      enqueued: 0,
      enqueueFailed: 1,
    });
    expect(registry.releaseArtifactWorkClaim).toHaveBeenCalledWith(
      claim.artifactId,
      claim.claimToken,
      new Date('2026-08-27T20:00:20.000Z'),
      'redis unavailable',
    );
  });
});
