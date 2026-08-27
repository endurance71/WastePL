import { describe, expect, it, vi } from 'vitest';
import {
  PermanentArtifactParseError,
  processArtifactJob,
  type ArtifactProcessor,
} from './artifact-processing.js';
import type { ArtifactProcessingJobInput, SourceRegistry } from './types.js';

const input: ArtifactProcessingJobInput = {
  sourceId: '11111111-1111-4111-8111-111111111111',
  artifactId: '22222222-2222-4222-8222-222222222222',
  parserKey: 'test-parser',
};

const logger = { info: vi.fn(), error: vi.fn() };

describe('artifact processing retry classification', () => {
  it('records a published processing outcome', async () => {
    const markSourceProcessingState = vi.fn().mockResolvedValue(undefined);
    const registry = { markSourceProcessingState } as unknown as SourceRegistry;
    const processor: ArtifactProcessor = {
      async process() {
        return { outcome: 'PUBLISHED', metadata: { rows: 3 } };
      },
    };

    await expect(processArtifactJob(registry, processor, input, logger)).resolves.toBe('PUBLISHED');
    expect(markSourceProcessingState).toHaveBeenCalledOnce();
    expect(markSourceProcessingState).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: input.sourceId,
      artifactId: input.artifactId,
      outcome: 'PUBLISHED',
      errorCode: null,
      metadata: { rows: 3 },
    }));
  });

  it('turns a deterministic parse error into a completed PARSE_FAILED outcome', async () => {
    const markSourceProcessingState = vi.fn().mockResolvedValue(undefined);
    const registry = { markSourceProcessingState } as unknown as SourceRegistry;
    const processor: ArtifactProcessor = {
      async process() {
        throw new PermanentArtifactParseError('unsupported table layout', {
          code: 'UNSUPPORTED_LAYOUT',
          metadata: { page: 2 },
        });
      },
    };

    await expect(processArtifactJob(registry, processor, input, logger)).resolves.toBe('PARSE_FAILED');
    expect(markSourceProcessingState).toHaveBeenCalledOnce();
    expect(markSourceProcessingState).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'PARSE_FAILED',
      errorCode: 'UNSUPPORTED_LAYOUT',
      errorMessage: 'unsupported table layout',
      metadata: { page: 2 },
    }));
  });

  it('rethrows transient infrastructure errors so BullMQ can retry them', async () => {
    const markSourceProcessingState = vi.fn().mockResolvedValue(undefined);
    const registry = { markSourceProcessingState } as unknown as SourceRegistry;
    const processor: ArtifactProcessor = {
      async process() {
        throw new Error('object store temporarily unavailable');
      },
    };

    await expect(processArtifactJob(registry, processor, input, logger)).rejects.toThrow(
      'object store temporarily unavailable',
    );
    expect(markSourceProcessingState).not.toHaveBeenCalled();
  });
});
