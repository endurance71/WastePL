import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseSwieszynoH2,
  supportsSwieszynoH2,
  SWIESZYNO_SAFE_H2_SOURCE_KEY,
  SWIESZYNO_TERC,
} from './swieszyno-h2-profile.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const fixturePath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/pdf-text/swieszyno-trasa-1-2026.txt',
);

const MOCK_REFERENCE: MunicipalCollectionReferenceContext = {
  municipality: {
    terc: SWIESZYNO_TERC,
    name: 'Świeszyno',
    municipalityType: 'RURAL',
  },
  localities: [
    {
      simc: '0313377',
      name: 'Chałupy',
    },
    {
      simc: '0313414',
      name: 'Konikowo',
    },
    {
      simc: '0313443',
      name: 'Niekłonice',
    },
  ],
};

const MOCK_INPUT = {
  sourceKey: SWIESZYNO_SAFE_H2_SOURCE_KEY,
  url: 'https://ug.swieszyno.ibip.pl/public/getFile?id=472491',
  sha256: '8a37e48e2031ef611135b4157e7706dc1bd9531213ea3af417d9c53fc1d6cd5d',
  retrievedAt: '2026-09-03T12:00:00.000Z',
  storageUri: 'fixture://swieszyno-trasa-1-2026',
  text: '',
};

describe('parseSwieszynoH2', () => {
  it('supports Świeszyno Trasa I text fixture', async () => {
    const text = await readFile(fixturePath, 'utf8');
    expect(supportsSwieszynoH2(text)).toBe(true);
    expect(supportsSwieszynoH2('Some unrelated text')).toBe(false);
  });

  it('parses Świeszyno Trasa I text fixture into 29 collection events for Chałupy', async () => {
    const text = await readFile(fixturePath, 'utf8');
    const input = { ...MOCK_INPUT, text };
    const result = parseSwieszynoH2(input, MOCK_REFERENCE, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.sources[0]?.artifact?.parserKey).toBe('municipal-collection-pdf-text');
    expect(result.sources[0]?.artifact?.parserVersion).toBe('0.2.0');
    expect(result.serviceAreas).toHaveLength(1);

    const serviceArea = result.serviceAreas[0]!;
    expect(serviceArea.key).toBe('swieszyno-safe-h2-chalupy');
    expect(serviceArea.name).toBe('Gmina Świeszyno — Chałupy (Trasa I)');
    expect(serviceArea.buildingType).toBe('SINGLE_FAMILY');
    expect(serviceArea.coverage).toEqual([
      {
        type: 'LOCALITY',
        priority: 50,
        simc: '0313377',
      },
      {
        type: 'LOCALITY',
        priority: 50,
        simc: '0313414',
      },
      {
        type: 'LOCALITY',
        priority: 50,
        simc: '0313443',
      },
    ]);

    // 14 MIXED + 14 OTHER + 1 BULKY = 29 total events
    expect(result.collectionEvents).toHaveLength(29);

    const mixedEvents = result.collectionEvents.filter((e) => e.fraction === 'MIXED');
    const otherEvents = result.collectionEvents.filter((e) => e.fraction === 'OTHER');
    const bulkyEvents = result.collectionEvents.filter((e) => e.fraction === 'BULKY');

    expect(mixedEvents).toHaveLength(14);
    expect(otherEvents).toHaveLength(14);
    expect(bulkyEvents).toHaveLength(1);

    // Verify concrete dates
    expect(mixedEvents[0]?.date).toBe('2026-07-03');
    expect(mixedEvents[mixedEvents.length - 1]?.date).toBe('2026-12-31');

    expect(otherEvents[0]?.date).toBe('2026-07-01');
    expect(otherEvents[otherEvents.length - 1]?.date).toBe('2026-12-30');

    expect(bulkyEvents[0]?.date).toBe('2026-10-01');
  });

  it('fails when municipality TERC is mismatched', async () => {
    const text = await readFile(fixturePath, 'utf8');
    const input = { ...MOCK_INPUT, text };
    const badRef = {
      ...MOCK_REFERENCE,
      municipality: { ...MOCK_REFERENCE.municipality, terc: '3209012' },
    };
    expect(() => parseSwieszynoH2(input, badRef, 'municipal-collection-pdf-text', '0.2.0')).toThrowError(
      /Świeszyno profile received unexpected TERC 3209012/,
    );
  });
});
