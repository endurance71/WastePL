import { describe, expect, it } from 'vitest';
import { artifactObjectKey, sha256Hex } from './hash.js';

describe('content hashing', () => {
  it('computes deterministic SHA-256 hashes', () => {
    expect(sha256Hex(Buffer.from('wastepl'))).toBe(
      'd3d3ec34f33dbca696bd5a6b31316a6abae0ceddd9d2b373d1cf607dba88859c',
    );
  });

  it('uses source and hash as immutable object key', () => {
    expect(artifactObjectKey('source/unsafe', 'abc123')).toBe('sources/source_unsafe/abc123');
  });
});
