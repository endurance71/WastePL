import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseSianowH2,
  supportsSianowH2,
  SIANOW_SAFE_H2_SOURCE_KEY,
  SIANOW_TERC,
} from './sianow-h2-profile.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const fixturePath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/pdf-text/sianow-dabrowa-grabowko-h2-2026.txt',
);

const MOCK_REFERENCE: MunicipalCollectionReferenceContext = {
  municipality: {
    terc: SIANOW_TERC,
    name: 'Sianów',
    municipalityType: 'URBAN_RURAL',
  },
  localities: [
    {
      simc: '0310858',
      name: 'Grabówko',
    },
    {
      simc: '0310835',
      name: 'Dąbrowa',
    },
  ],
};

const MOCK_INPUT = {
  sourceKey: SIANOW_SAFE_H2_SOURCE_KEY,
  url: 'https://sianow.pl/wp-content/uploads/2026/06/9-Dabrowa-i-Grabowko.pdf',
  sha256: '618c62bcca3a374d78ecb8db1aa935cbae6fd08e7a280787245270327bf7b16c',
  retrievedAt: '2026-09-03T12:00:00.000Z',
  storageUri: 'fixture://sianow-dabrowa-grabowko-h2-2026',
  text: '',
};

describe('parseSianowH2', () => {
  it('supports Sianów Dąbrowa i Grabówko H2 text fixture', async () => {
    const text = await readFile(fixturePath, 'utf8');
    expect(supportsSianowH2(text)).toBe(true);
    expect(supportsSianowH2('Some unrelated text')).toBe(false);
  });

  it('parses Sianów Dąbrowa i Grabówko H2 text fixture into 37 collection events for Grabówko', async () => {
    const text = await readFile(fixturePath, 'utf8');
    const input = { ...MOCK_INPUT, text };
    const result = parseSianowH2(input, MOCK_REFERENCE, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.sources[0]?.artifact?.parserKey).toBe('municipal-collection-pdf-text');
    expect(result.sources[0]?.artifact?.parserVersion).toBe('0.2.0');
    expect(result.serviceAreas).toHaveLength(1);

    const serviceArea = result.serviceAreas[0]!;
    expect(serviceArea.key).toBe('sianow-safe-h2-grabowko');
    expect(serviceArea.name).toBe('Gmina Sianów — Grabówko (Trasa Dąbrowa/Grabówko)');
    expect(serviceArea.buildingType).toBe('SINGLE_FAMILY');
    expect(serviceArea.coverage).toEqual([
      {
        type: 'LOCALITY',
        priority: 50,
        simc: '0310858',
      },
    ]);

    // 13 MIXED + 13 OTHER + 11 BIO + 1 BULKY = 38 total events
    expect(result.collectionEvents).toHaveLength(38);

    const mixedEvents = result.collectionEvents.filter((e) => e.fraction === 'MIXED');
    const otherEvents = result.collectionEvents.filter((e) => e.fraction === 'OTHER');
    const bioEvents = result.collectionEvents.filter((e) => e.fraction === 'BIO');
    const bulkyEvents = result.collectionEvents.filter((e) => e.fraction === 'BULKY');

    expect(mixedEvents).toHaveLength(13);
    expect(otherEvents).toHaveLength(13);
    expect(bioEvents).toHaveLength(11);
    expect(bulkyEvents).toHaveLength(1);

    // Verify concrete dates
    expect(mixedEvents[0]?.date).toBe('2026-07-08');
    expect(mixedEvents[mixedEvents.length - 1]?.date).toBe('2026-12-21');

    expect(otherEvents[0]?.date).toBe('2026-07-07');
    expect(otherEvents[otherEvents.length - 1]?.date).toBe('2026-12-19');

    expect(bioEvents[0]?.date).toBe('2026-07-07');
    expect(bioEvents[bioEvents.length - 1]?.date).toBe('2026-12-19');

    expect(bulkyEvents[0]?.date).toBe('2026-09-26');
  });

  it('fails when municipality TERC is mismatched', async () => {
    const text = await readFile(fixturePath, 'utf8');
    const input = { ...MOCK_INPUT, text };
    const badRef = {
      ...MOCK_REFERENCE,
      municipality: { ...MOCK_REFERENCE.municipality, terc: '3209012' },
    };
    expect(() => parseSianowH2(input, badRef, 'municipal-collection-pdf-text', '0.2.0')).toThrowError(
      /Sianów profile received unexpected TERC 3209012/,
    );
  });
});
