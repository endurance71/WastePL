import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseSianowH2,
  supportsSianowH2,
  SIANOW_SAFE_H2_SOURCE_KEY,
  SIANOW_BOROWIEC_SAFE_H2_SOURCE_KEY,
  SIANOW_SKWIERZYNKA_SAFE_H2_SOURCE_KEY,
  SIANOW_TERC,
} from './sianow-h2-profile.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const fixturePath = resolve(repoRoot, 'apps/worker/test/fixtures/pdf-text/sianow-dabrowa-grabowko-h2-2026.txt');
const borowiecFixturePath = resolve(repoRoot, 'apps/worker/test/fixtures/pdf-text/sianow-borowiec-h2-2026.txt');
const skwierzynkaFixturePath = resolve(repoRoot, 'apps/worker/test/fixtures/pdf-text/sianow-skwierzynka-h2-2026.txt');

const MOCK_REFERENCE: MunicipalCollectionReferenceContext = {
  municipality: {
    terc: SIANOW_TERC,
    name: 'Sianów',
    municipalityType: 'URBAN_RURAL',
  },
  localities: [
    { simc: '0310858', name: 'Grabówko' },
    { simc: '0310835', name: 'Dąbrowa' },
    { simc: '0310999', name: 'Borowiec' },
    { simc: '0311183', name: 'Szczeglino Nowe' },
    { simc: '0311036', name: 'Przytok' },
    { simc: '0310982', name: 'Ratajki' },
    { simc: '0311088', name: 'Sowno' },
    { simc: '0311094', name: 'Suszka' },
    { simc: '0311071', name: 'Sowieński Młyn' },
    { simc: '0311125', name: 'Skwierzynka' },
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

const MOCK_BOROWIEC_INPUT = {
  sourceKey: SIANOW_BOROWIEC_SAFE_H2_SOURCE_KEY,
  url: 'https://sianow.pl/wp-content/uploads/2026/06/14-Borowiec.pdf',
  sha256: '9fc868456bbc0dac553d353e8406ac34a1fe2ac3fcff693a8bcb0cbe2cc4eadf',
  retrievedAt: '2026-09-05T12:00:00.000Z',
  storageUri: 'fixture://sianow-borowiec-h2-2026',
  text: '',
};

const MOCK_SKWIERZYNKA_INPUT = {
  sourceKey: SIANOW_SKWIERZYNKA_SAFE_H2_SOURCE_KEY,
  url: 'https://sianow.pl/wp-content/uploads/2026/06/1-Skwierzynka.pdf',
  sha256: 'a1b2c3d4e5f6',
  retrievedAt: '2026-09-06T12:00:00.000Z',
  storageUri: 'fixture://sianow-skwierzynka-h2-2026',
  text: '',
};

function expectGenericSegregatedSemantics(
  events: ReturnType<typeof parseSianowH2>['collectionEvents'],
  expectedOtherCount: number,
): void {
  const otherEvents = events.filter((event) => event.fraction === 'OTHER');
  expect(otherEvents).toHaveLength(expectedOtherCount);
  expect(events.filter((event) => event.fraction === 'METALS_PLASTICS')).toHaveLength(0);
  expect(events.filter((event) => event.fraction === 'PAPER')).toHaveLength(0);
  expect(events.filter((event) => event.fraction === 'GLASS')).toHaveLength(0);
  expect(otherEvents.every((event) => event.quality.warnings.includes('SOURCE_FRACTION_GENERIC_SEGREGATED_MAPPED_TO_OTHER'))).toBe(true);
  expect(otherEvents.every((event) => event.note?.includes('bez inferowania frakcji materiałowych'))).toBe(true);
}

describe('parseSianowH2', () => {
  it('supports the three active Sianów single-family fixtures', async () => {
    const grabowko = await readFile(fixturePath, 'utf8');
    const borowiec = await readFile(borowiecFixturePath, 'utf8');
    const skwierzynka = await readFile(skwierzynkaFixturePath, 'utf8');

    expect(supportsSianowH2(grabowko)).toBe(true);
    expect(supportsSianowH2(borowiec)).toBe(true);
    expect(supportsSianowH2(skwierzynka)).toBe(true);
    expect(supportsSianowH2('Some unrelated text')).toBe(false);
  });

  it('maps Grabówko generic segregated dates to OTHER without inventing material fractions', async () => {
    const text = await readFile(fixturePath, 'utf8');
    const result = parseSianowH2({ ...MOCK_INPUT, text }, MOCK_REFERENCE, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.sources[0]?.artifact?.parserKey).toBe('municipal-collection-pdf-text');
    expect(result.sources[0]?.artifact?.parserVersion).toBe('0.2.0');
    expect(result.serviceAreas).toHaveLength(1);
    expect(result.serviceAreas[0]).toMatchObject({
      key: 'sianow-safe-h2-grabowko',
      name: 'Gmina Sianów — Grabówko (Trasa Dąbrowa/Grabówko)',
      buildingType: 'SINGLE_FAMILY',
    });
    expect(result.serviceAreas[0]?.coverage).toEqual([
      { type: 'LOCALITY', priority: 50, simc: '0310858' },
      { type: 'LOCALITY', priority: 50, simc: '0310835' },
    ]);

    // 13 MIXED + 13 OTHER + 11 BIO + 1 BULKY = 38 source-backed events.
    expect(result.collectionEvents).toHaveLength(38);
    expectGenericSegregatedSemantics(result.collectionEvents, 13);

    const mixedEvents = result.collectionEvents.filter((event) => event.fraction === 'MIXED');
    const otherEvents = result.collectionEvents.filter((event) => event.fraction === 'OTHER');
    const bioEvents = result.collectionEvents.filter((event) => event.fraction === 'BIO');
    const bulkyEvents = result.collectionEvents.filter((event) => event.fraction === 'BULKY');

    expect(mixedEvents).toHaveLength(13);
    expect(otherEvents).toHaveLength(13);
    expect(bioEvents).toHaveLength(11);
    expect(bulkyEvents).toHaveLength(1);
    expect(mixedEvents[0]?.date).toBe('2026-07-08');
    expect(mixedEvents.at(-1)?.date).toBe('2026-12-21');
    expect(otherEvents[0]?.date).toBe('2026-07-07');
    expect(otherEvents.at(-1)?.date).toBe('2026-12-19');
    expect(bulkyEvents[0]?.date).toBe('2026-09-26');
  });

  it('preserves generic segregated semantics for the Borowiec safe rural subset', async () => {
    const text = await readFile(borowiecFixturePath, 'utf8');
    const result = parseSianowH2({ ...MOCK_BOROWIEC_INPUT, text }, MOCK_REFERENCE, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.serviceAreas[0]).toMatchObject({
      key: 'sianow-safe-h2-borowiec-rural',
      name: 'Gmina Sianów — Trasa Borowiec (tereny wiejskie bezpieczne)',
      buildingType: 'SINGLE_FAMILY',
    });
    expect(result.serviceAreas[0]?.coverage).toHaveLength(7);
    expect(result.serviceAreas[0]?.coverage.map((coverage) => (coverage as { simc: string }).simc)).toEqual([
      '0310999',
      '0311183',
      '0311036',
      '0310982',
      '0311088',
      '0311094',
      '0311071',
    ]);

    // 13 MIXED + 13 OTHER + 10 BIO + 1 BULKY = 37 source-backed events.
    expect(result.collectionEvents).toHaveLength(37);
    expectGenericSegregatedSemantics(result.collectionEvents, 13);
    expect(result.collectionEvents.filter((event) => event.fraction === 'BIO')).toHaveLength(10);
  });

  it('preserves generic segregated semantics for Skwierzynka', async () => {
    const text = await readFile(skwierzynkaFixturePath, 'utf8');
    const result = parseSianowH2({ ...MOCK_SKWIERZYNKA_INPUT, text }, MOCK_REFERENCE, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.serviceAreas[0]).toMatchObject({
      key: 'sianow-skwierzynka-single-family',
      buildingType: 'SINGLE_FAMILY',
    });
    expect(result.serviceAreas[0]?.coverage).toEqual([
      { type: 'LOCALITY', priority: 50, simc: '0311125' },
    ]);

    // 13 MIXED + 13 OTHER + 11 BIO + 1 BULKY = 38 source-backed events.
    expect(result.collectionEvents).toHaveLength(38);
    expectGenericSegregatedSemantics(result.collectionEvents, 13);
    expect(result.collectionEvents.filter((event) => event.fraction === 'BIO')).toHaveLength(11);
  });

  it('fails when municipality TERC is mismatched', async () => {
    const text = await readFile(fixturePath, 'utf8');
    const badReference = {
      ...MOCK_REFERENCE,
      municipality: { ...MOCK_REFERENCE.municipality, terc: '3209012' },
    };

    expect(() => parseSianowH2({ ...MOCK_INPUT, text }, badReference, 'municipal-collection-pdf-text', '0.2.0')).toThrowError(
      /Sianów profile received unexpected TERC 3209012/,
    );
  });
});
