import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseSwieszynoH2,
  supportsSwieszynoH2,
  SWIESZYNO_SAFE_H2_SOURCE_KEY,
  SWIESZYNO_TRASA_2_SAFE_H2_SOURCE_KEY,
  SWIESZYNO_TERC,
} from './swieszyno-h2-profile.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const trasa1FixturePath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/pdf-text/swieszyno-trasa-1-2026.txt',
);
const trasa2FixturePath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/pdf-text/swieszyno-trasa-2-2026.txt',
);

const MOCK_REFERENCE_TRASA_1: MunicipalCollectionReferenceContext = {
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

const MOCK_REFERENCE_TRASA_2: MunicipalCollectionReferenceContext = {
  municipality: {
    terc: SWIESZYNO_TERC,
    name: 'Świeszyno',
    municipalityType: 'RURAL',
  },
  localities: [
    { simc: '0313271', name: 'Czacz' },
    { simc: '0313472', name: 'Zegrzyn' },
    { simc: '0313450', name: 'Kurozwęcz' },
    { simc: '0313466', name: 'Sieranie' },
    { simc: '0313443', name: 'Czaple' },
    { simc: '0313390', name: 'Kępa Świeszyńska' },
    { simc: '0313414', name: 'Olszak' },
    { simc: '0313420', name: 'Włoki' },
    { simc: '0313348', name: 'Bagno' },
    { simc: '0313383', name: 'Chłopska Kępa' },
    { simc: '0313360', name: 'Brzeźniki' },
    { simc: '0313288', name: 'Golica' },
    { simc: '0313354', name: 'Biała Kępa' },
    { simc: '0313408', name: 'Krokowo' },
    { simc: '0313207', name: 'Jarzyce' },
    { simc: '0313236', name: 'Czersk Koszaliński' },
    { simc: '0313213', name: 'Kłokęcin' },
    { simc: '0313302', name: 'Węgorki' },
  ],
};

const MOCK_INPUT_TRASA_1 = {
  sourceKey: SWIESZYNO_SAFE_H2_SOURCE_KEY,
  url: 'https://ug.swieszyno.ibip.pl/public/getFile?id=472491',
  sha256: '8a37e48e2031ef611135b4157e7706dc1bd9531213ea3af417d9c53fc1d6cd5d',
  retrievedAt: '2026-09-03T12:00:00.000Z',
  storageUri: 'fixture://swieszyno-trasa-1-2026',
  text: '',
};

const MOCK_INPUT_TRASA_2 = {
  sourceKey: SWIESZYNO_TRASA_2_SAFE_H2_SOURCE_KEY,
  url: 'https://ug.swieszyno.ibip.pl/public/getFile?id=472490',
  sha256: '82de261454b0d085d60800f1c936f4c01ea6a485a3e57ac18551b56f8fbaff96',
  retrievedAt: '2026-09-06T12:00:00.000Z',
  storageUri: 'fixture://swieszyno-trasa-2-2026',
  text: '',
};

describe('parseSwieszynoH2', () => {
  it('supports Świeszyno Trasa I and Trasa II text fixtures', async () => {
    const text1 = await readFile(trasa1FixturePath, 'utf8');
    const text2 = await readFile(trasa2FixturePath, 'utf8');
    expect(supportsSwieszynoH2(text1)).toBe(true);
    expect(supportsSwieszynoH2(text2)).toBe(true);
    expect(supportsSwieszynoH2('Some unrelated text')).toBe(false);
  });

  it('parses Świeszyno Trasa I text fixture into 29 collection events for Chałupy', async () => {
    const text = await readFile(trasa1FixturePath, 'utf8');
    const input = { ...MOCK_INPUT_TRASA_1, text };
    const result = parseSwieszynoH2(input, MOCK_REFERENCE_TRASA_1, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.sources[0]?.artifact?.parserKey).toBe('municipal-collection-pdf-text');
    expect(result.sources[0]?.artifact?.parserVersion).toBe('0.2.0');
    expect(result.serviceAreas).toHaveLength(1);

    const serviceArea = result.serviceAreas[0]!;
    expect(serviceArea.key).toBe('swieszyno-safe-h2-chalupy');
    expect(serviceArea.name).toBe('Gmina Świeszyno — Chałupy (Trasa I)');
    expect(serviceArea.buildingType).toBe('SINGLE_FAMILY');
    expect(serviceArea.coverage).toEqual([
      { type: 'LOCALITY', priority: 50, simc: '0313377' },
      { type: 'LOCALITY', priority: 50, simc: '0313414' },
      { type: 'LOCALITY', priority: 50, simc: '0313443' },
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

  it('parses Świeszyno Trasa II text fixture into 29 collection events for 18 rural localities', async () => {
    const text = await readFile(trasa2FixturePath, 'utf8');
    const input = { ...MOCK_INPUT_TRASA_2, text };
    const result = parseSwieszynoH2(input, MOCK_REFERENCE_TRASA_2, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.serviceAreas).toHaveLength(1);
    const serviceArea = result.serviceAreas[0]!;
    expect(serviceArea.key).toBe('swieszyno-safe-h2-trasa-2');
    expect(serviceArea.name).toBe('Gmina Świeszyno — Trasa II (18 miejscowości wiejskich)');
    expect(serviceArea.buildingType).toBe('SINGLE_FAMILY');
    expect(serviceArea.coverage).toHaveLength(18);

    expect(result.collectionEvents).toHaveLength(27);

    const mixedEvents = result.collectionEvents.filter((e) => e.fraction === 'MIXED');
    const otherEvents = result.collectionEvents.filter((e) => e.fraction === 'OTHER');
    const bulkyEvents = result.collectionEvents.filter((e) => e.fraction === 'BULKY');

    expect(mixedEvents).toHaveLength(13);
    expect(otherEvents).toHaveLength(13);
    expect(bulkyEvents).toHaveLength(1);

    expect(mixedEvents[0]?.date).toBe('2026-07-10');
    expect(mixedEvents[mixedEvents.length - 1]?.date).toBe('2026-12-23');

    expect(otherEvents[0]?.date).toBe('2026-07-08');
    expect(otherEvents[otherEvents.length - 1]?.date).toBe('2026-12-23');

    expect(bulkyEvents[0]?.date).toBe('2026-10-15');
  });

  it('fails when municipality TERC is mismatched', async () => {
    const text = await readFile(trasa1FixturePath, 'utf8');
    const input = { ...MOCK_INPUT_TRASA_1, text };
    const badRef = {
      ...MOCK_REFERENCE_TRASA_1,
      municipality: { ...MOCK_REFERENCE_TRASA_1.municipality, terc: '3209012' },
    };
    expect(() => parseSwieszynoH2(input, badRef, 'municipal-collection-pdf-text', '0.2.0')).toThrowError(
      /Świeszyno profile received unexpected TERC 3209012/,
    );
  });
});
