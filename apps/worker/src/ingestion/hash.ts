import { createHash } from 'node:crypto';

export function sha256Hex(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

export function artifactObjectKey(sourceId: string, sha256: string): string {
  const safeSourceId = sourceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `sources/${safeSourceId}/${sha256}`;
}
