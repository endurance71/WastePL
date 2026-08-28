import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSourceManifest, validateSourceManifest } from './source-manifest.js';

function loadPilot(): unknown {
  return JSON.parse(
    readFileSync(
      new URL('../../../../manifests/pilot-koszalin-region-2026.1.json', import.meta.url),
      'utf8',
    ),
  );
}

describe('source manifest v0.1', () => {
  it('contains exactly the 8 declared pilot municipalities with valid support claims', () => {
    const manifest = parseSourceManifest(loadPilot());
    expect(manifest.municipalities).toHaveLength(8);
    expect(manifest.municipalities.map((entry) => entry.terc).sort()).toEqual([
      '3201043',
      '3209012',
      '3209033',
      '3209042',
      '3209063',
      '3209073',
      '3209082',
      '3261011',
    ]);

    const sources = manifest.municipalities.flatMap((municipality) => municipality.sources);
    expect(new Set(sources.map((source) => source.key)).size).toBe(sources.length);
    expect(new Set(sources.map((source) => source.url)).size).toBe(sources.length);
    expect(sources.filter((source) => source.status === 'ACTIVE').every((source) => source.parserKey)).toBe(true);
    expect(sources.filter((source) => source.status === 'PLANNED').every((source) => source.parserKey === null)).toBe(true);
  });

  it('rejects duplicate municipality TERC, source keys and URLs', () => {
    const original = parseSourceManifest(loadPilot());

    const duplicateTerc = structuredClone(original);
    duplicateTerc.municipalities[1]!.terc = duplicateTerc.municipalities[0]!.terc;
    expect(() => validateSourceManifest(duplicateTerc)).toThrow(/Duplicate municipality TERC/);

    const duplicateKey = structuredClone(original);
    duplicateKey.municipalities[1]!.sources[0]!.key = duplicateKey.municipalities[0]!.sources[0]!.key;
    expect(() => validateSourceManifest(duplicateKey)).toThrow(/Duplicate source key/);

    const duplicateUrl = structuredClone(original);
    duplicateUrl.municipalities[1]!.sources[0]!.url = duplicateUrl.municipalities[0]!.sources[0]!.url;
    expect(() => validateSourceManifest(duplicateUrl)).toThrow(/Duplicate source URL/);
  });

  it('refuses accidental parser activation for unsupported or planned sources', () => {
    const unsupported = structuredClone(parseSourceManifest(loadPilot()));
    const planned = unsupported.municipalities.find((entry) => entry.terc === '3209033')!.sources[0]!;
    planned.status = 'ACTIVE';
    planned.parserKey = 'generic-html-that-does-not-exist';
    expect(() => validateSourceManifest(unsupported)).toThrow(/unsupported parser/);

    const plannedWithParser = structuredClone(parseSourceManifest(loadPilot()));
    const source = plannedWithParser.municipalities.find((entry) => entry.terc === '3209073')!.sources[0]!;
    source.parserKey = 'pgk-koszalin-pszok-html';
    expect(() => validateSourceManifest(plannedWithParser)).toThrow(/PLANNED source .* must not claim a parser key/);
  });
});
