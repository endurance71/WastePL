import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSourceManifest, validateSourceManifest } from './source-manifest.js';

function loadRollout(): ReturnType<typeof parseSourceManifest> {
  return parseSourceManifest(JSON.parse(readFileSync(
    new URL('../../../../manifests/pilot-koszalin-region-2026.2.json', import.meta.url),
    'utf8',
  )));
}

describe('source manifest assessment semantics', () => {
  it('accepts the assessed 2026.2 rollout with exactly two new municipal PSZOK activations', () => {
    const manifest = loadRollout();
    const sources = manifest.municipalities.flatMap((municipality) => municipality.sources);
    const activeMunicipal = sources
      .filter((source) => source.parserKey === 'municipal-pszok-html' && source.status === 'ACTIVE')
      .map((source) => source.key)
      .sort();
    expect(activeMunicipal).toEqual(['bobolice-pszok', 'swieszyno-pszok']);
  });

  it('rejects a PLANNED assessed source without a blocker', () => {
    const manifest = structuredClone(loadRollout());
    const source = manifest.municipalities
      .flatMap((municipality) => municipality.sources)
      .find((candidate) => candidate.key === 'tychowo-collection-2026')!;
    source.assessment!.activationBlocker = null;
    expect(() => validateSourceManifest(manifest)).toThrow(/requires activationBlocker/);
  });

  it('rejects an ACTIVE assessed source whose evidence is not VERIFIED', () => {
    const manifest = structuredClone(loadRollout());
    const source = manifest.municipalities
      .flatMap((municipality) => municipality.sources)
      .find((candidate) => candidate.key === 'bobolice-pszok')!;
    source.assessment!.evidenceStatus = 'PARTIAL';
    expect(() => validateSourceManifest(manifest)).toThrow(/requires VERIFIED evidence/);
  });

  it('rejects verified multi-route evidence without exact child artifact identities', () => {
    const manifest = structuredClone(loadRollout());
    const source = manifest.municipalities
      .flatMap((municipality) => municipality.sources)
      .find((candidate) => candidate.key === 'sianow-collection-2026-h2')!;
    source.assessment!.childArtifactUrls = [];
    expect(() => validateSourceManifest(manifest)).toThrow(/requires childArtifactUrls/);
  });

  it('rejects duplicate child artifact URLs inside one source assessment', () => {
    const manifest = structuredClone(loadRollout());
    const source = manifest.municipalities
      .flatMap((municipality) => municipality.sources)
      .find((candidate) => candidate.key === 'tychowo-collection-2026')!;
    source.assessment!.childArtifactUrls = [
      source.assessment!.childArtifactUrls[0]!,
      source.assessment!.childArtifactUrls[0]!,
    ];
    expect(() => validateSourceManifest(manifest)).toThrow(/duplicate child artifact URL/i);
  });
});
