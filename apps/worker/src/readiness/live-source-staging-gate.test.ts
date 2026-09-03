import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceManifest } from '../manifests/source-manifest.js';
import {
  activeSourceKeysFromManifest,
  assertLiveGateIsolation,
  classifyLiveSourceOutcome,
  effectiveLiveProcessingOutcome,
  hasRequiredCanonicalEvidence,
  latestPilotManifestFilename,
  requiresPolanowGarbnoReference,
  requiresBedzinoDworekReference,
  requiresSianowGrabowkoReference,
  requiresSwieszynoChalupyReference,
} from './live-source-staging-gate.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

describe('live-source staging gate policy', () => {
  it('classifies parseable byte drift separately from parser failure', () => {
    expect(classifyLiveSourceOutcome({
      fetchFailed: false,
      processingOutcome: 'PUBLISHED',
      sha256: 'new',
      baselineSha256: 'old',
    })).toBe('CHANGED_BUT_PARSEABLE');

    expect(classifyLiveSourceOutcome({
      fetchFailed: false,
      processingOutcome: 'PUBLISHED',
      sha256: 'same',
      baselineSha256: 'same',
    })).toBe('HEALTHY');

    expect(classifyLiveSourceOutcome({
      fetchFailed: true,
      processingOutcome: null,
      sha256: null,
      baselineSha256: null,
    })).toBe('FETCH_FAILED');

    expect(classifyLiveSourceOutcome({
      fetchFailed: false,
      processingOutcome: 'WAITING_FOR_COMPANION',
      sha256: 'x',
      baselineSha256: null,
    })).toBe('WAITING_FOR_COMPANION');
  });

  it('uses natural manifest ordering and current pilot ACTIVE identities', async () => {
    expect(latestPilotManifestFilename([
      'pilot-koszalin-region-2026.9.json',
      'pilot-koszalin-region-2026.10.json',
      'other.json',
    ])).toBe('pilot-koszalin-region-2026.10.json');

    const manifestRoot = resolve(repoRoot, 'manifests');
    const latest = latestPilotManifestFilename(await readdir(manifestRoot));
    expect(latest).toBe('pilot-koszalin-region-2026.9.json');
    const manifest = JSON.parse(await readFile(resolve(manifestRoot, latest), 'utf8')) as SourceManifest;
    const keys = activeSourceKeysFromManifest(manifest);
    expect(keys).toHaveLength(13);
    expect(keys).toContain('tychowo-collection-standard-2026');
    expect(keys).toContain('sianow-pszok');
    expect(keys).toContain('tychowo-pszok');
    expect(keys).toContain('polanow-collection-garbno-h2-2026');
    expect(keys).toContain('bedzino-collection-trasa-1-safe-h2-2026');
    expect(keys).toContain('sianow-collection-dabrowa-grabowko-safe-h2-2026');
    expect(keys).toContain('swieszyno-collection-trasa-1-safe-h2-2026');
    expect(requiresPolanowGarbnoReference(manifest)).toBe(true);
    expect(requiresBedzinoDworekReference(manifest)).toBe(true);
    expect(requiresSianowGrabowkoReference(manifest)).toBe(true);
    expect(requiresSwieszynoChalupyReference(manifest)).toBe(true);
  });

  it('recognizes a bundle member that was completed by its companion', () => {
    expect(effectiveLiveProcessingOutcome({
      processingOutcome: 'WAITING_FOR_COMPANION',
      artifactStatus: 'PUBLISHED',
      healthStatus: 'HEALTHY',
      canonicalObserved: true,
    })).toBe('PUBLISHED');

    expect(effectiveLiveProcessingOutcome({
      processingOutcome: 'WAITING_FOR_COMPANION',
      artifactStatus: 'PUBLISHED',
      healthStatus: 'REVIEW_REQUIRED',
      canonicalObserved: true,
    })).toBe('REVIEW_REQUIRED');

    expect(effectiveLiveProcessingOutcome({
      processingOutcome: 'WAITING_FOR_COMPANION',
      artifactStatus: 'PUBLISHED',
      healthStatus: 'WAITING_FOR_COMPANION',
      canonicalObserved: true,
    })).toBe('WAITING_FOR_COMPANION');

    expect(effectiveLiveProcessingOutcome({
      processingOutcome: 'WAITING_FOR_COMPANION',
      artifactStatus: 'PUBLISHED',
      healthStatus: 'HEALTHY',
      canonicalObserved: false,
    })).toBe('WAITING_FOR_COMPANION');
  });

  it('requires generic facility evidence even without a hardcoded canonical key', () => {
    expect(hasRequiredCanonicalEvidence('PSZOK', {
      expectedCanonicalKey: null,
      expectedCanonicalKeyObserved: null,
      collectionPublicationCount: null,
      facilityAssertionCount: 1,
    })).toBe(true);

    expect(hasRequiredCanonicalEvidence('PSZOK', {
      expectedCanonicalKey: null,
      expectedCanonicalKeyObserved: null,
      collectionPublicationCount: null,
      facilityAssertionCount: 0,
    })).toBe(false);

    expect(hasRequiredCanonicalEvidence('PSZOK', {
      expectedCanonicalKey: 'expected-key',
      expectedCanonicalKeyObserved: false,
      collectionPublicationCount: null,
      facilityAssertionCount: 1,
    })).toBe(false);

    expect(hasRequiredCanonicalEvidence('COLLECTION_SCHEDULE', {
      expectedCanonicalKey: null,
      expectedCanonicalKeyObserved: null,
      collectionPublicationCount: 1,
      facilityAssertionCount: null,
    })).toBe(true);
  });

  it('rejects production-like database and bucket targets', () => {
    expect(() => assertLiveGateIsolation({
      liveDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl_live_source_gate',
      ordinaryDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
      bucket: 'wastepl-live-source-123',
    })).not.toThrow();

    expect(() => assertLiveGateIsolation({
      liveDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
      ordinaryDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
      bucket: 'wastepl-live-source-123',
    })).toThrow(/LIVE_GATE_UNSAFE_DATABASE/);

    expect(() => assertLiveGateIsolation({
      liveDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl_live_source_gate',
      ordinaryDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
      bucket: 'wastepl-artifacts',
    })).toThrow(/LIVE_GATE_UNSAFE_BUCKET/);
  });
});
