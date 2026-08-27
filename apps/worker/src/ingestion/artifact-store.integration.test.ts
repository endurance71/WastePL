import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MinioArtifactStore } from './artifact-store.js';
import { sha256Hex } from './hash.js';

const integrationIt = process.env.S3_ENDPOINT ? it : it.skip;

describe('MinioArtifactStore integration', () => {
  integrationIt('stores a content-addressed object once and never rewrites it', async () => {
    const store = new MinioArtifactStore();
    const sourceId = randomUUID();
    const body = Buffer.from(`immutable-${randomUUID()}`);
    const sha256 = sha256Hex(body);

    const first = await store.putIfAbsent({
      sourceId,
      sha256,
      body,
      contentType: 'application/octet-stream',
    });
    const second = await store.putIfAbsent({
      sourceId,
      sha256,
      body,
      contentType: 'application/octet-stream',
    });

    expect(first.uri).toBe(second.uri);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
  });
});
