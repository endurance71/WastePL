import { describe, expect, it, vi } from 'vitest';
import { PermanentArtifactParseError } from './artifact-processing.js';
import { ArtifactReadError, type ArtifactReader } from './artifact-reader.js';
import {
  DispatchingArtifactProcessor,
  type ArtifactHandler,
} from './dispatching-artifact-processor.js';
import type { ArtifactProcessingLookup, ArtifactProcessingRecord } from './types.js';

const artifact: ArtifactProcessingRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  sourceId: '11111111-1111-4111-8111-111111111111',
  sha256: 'a'.repeat(64),
  storageUri: 's3://wastepl-artifacts/sources/source/hash',
  retrievedAt: new Date('2026-08-28T08:00:00Z'),
  parserKey: 'test-parser',
  status: 'FETCHED',
};

const job = {
  sourceId: artifact.sourceId,
  artifactId: artifact.id,
  parserKey: artifact.parserKey,
};

function setup(overrides: Partial<ArtifactProcessingRecord> = {}) {
  const persisted = { ...artifact, ...overrides };
  const lookup: ArtifactProcessingLookup = {
    getArtifactForProcessing: vi.fn().mockResolvedValue(persisted),
  };
  const reader: ArtifactReader = {
    readVerified: vi.fn().mockResolvedValue(Buffer.from('verified bytes')),
  };
  const handler: ArtifactHandler = {
    parserKey: 'test-parser',
    process: vi.fn().mockResolvedValue({ outcome: 'PUBLISHED', metadata: { rows: 2 } }),
  };
  return { persisted, lookup, reader, handler };
}

describe('DispatchingArtifactProcessor', () => {
  it('reads verified bytes and dispatches by the persisted parser key', async () => {
    const { lookup, reader, handler } = setup();
    const processor = new DispatchingArtifactProcessor(lookup, reader, [handler]);

    await expect(processor.process(job)).resolves.toEqual({
      outcome: 'PUBLISHED',
      metadata: {
        rows: 2,
        parserKey: 'test-parser',
        sha256: artifact.sha256,
        bytes: 14,
      },
    });
    expect(reader.readVerified).toHaveBeenCalledWith({
      storageUri: artifact.storageUri,
      expectedSha256: artifact.sha256,
    });
    expect(handler.process).toHaveBeenCalledWith(expect.objectContaining({
      artifact: expect.objectContaining({ id: artifact.id, sha256: artifact.sha256 }),
      body: Buffer.from('verified bytes'),
    }));
  });

  it('does not trust a queued parser key that differs from persistence', async () => {
    const { lookup, reader, handler } = setup();
    const processor = new DispatchingArtifactProcessor(lookup, reader, [handler]);

    await expect(processor.process({ ...job, parserKey: 'other-parser' })).rejects.toMatchObject({
      name: 'PermanentArtifactParseError',
      code: 'PARSER_KEY_MISMATCH',
    } satisfies Partial<PermanentArtifactParseError>);
    expect(reader.readVerified).not.toHaveBeenCalled();
    expect(handler.process).not.toHaveBeenCalled();
  });

  it('turns a non-retryable object checksum failure into permanent parse failure', async () => {
    const { lookup, reader, handler } = setup();
    vi.mocked(reader.readVerified).mockRejectedValue(
      new ArtifactReadError({
        message: 'checksum mismatch',
        code: 'ARTIFACT_SHA256_MISMATCH',
        retryable: false,
      }),
    );
    const processor = new DispatchingArtifactProcessor(lookup, reader, [handler]);

    await expect(processor.process(job)).rejects.toMatchObject({
      name: 'PermanentArtifactParseError',
      code: 'ARTIFACT_SHA256_MISMATCH',
    } satisfies Partial<PermanentArtifactParseError>);
    expect(handler.process).not.toHaveBeenCalled();
  });

  it('rethrows retryable object-store failures for BullMQ retry', async () => {
    const { lookup, reader, handler } = setup();
    const transient = new ArtifactReadError({
      message: 'temporary object store outage',
      code: 'ARTIFACT_STORAGE_READ_FAILED',
      retryable: true,
    });
    vi.mocked(reader.readVerified).mockRejectedValue(transient);
    const processor = new DispatchingArtifactProcessor(lookup, reader, [handler]);

    await expect(processor.process(job)).rejects.toBe(transient);
    expect(handler.process).not.toHaveBeenCalled();
  });

  it('short-circuits replay of an already published artifact', async () => {
    const { lookup, reader, handler } = setup({ status: 'PUBLISHED' });
    const processor = new DispatchingArtifactProcessor(lookup, reader, [handler]);

    await expect(processor.process(job)).resolves.toEqual({
      outcome: 'PUBLISHED',
      metadata: {
        replaySkipped: true,
        artifactStatus: 'PUBLISHED',
        sha256: artifact.sha256,
      },
    });
    expect(reader.readVerified).not.toHaveBeenCalled();
    expect(handler.process).not.toHaveBeenCalled();
  });

  it('fails visibly when no handler exists for a persisted parser key', async () => {
    const { lookup, reader } = setup();
    const processor = new DispatchingArtifactProcessor(lookup, reader, []);

    await expect(processor.process(job)).rejects.toMatchObject({
      name: 'PermanentArtifactParseError',
      code: 'UNKNOWN_PARSER_KEY',
    } satisfies Partial<PermanentArtifactParseError>);
    expect(reader.readVerified).not.toHaveBeenCalled();
  });
});
