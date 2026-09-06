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
const fixturePath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/pdf-text/sianow-dabrowa-grabowko-h2-2026.txt',
);
const borowiecFixturePath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/pdf-text/sianow-borowiec-h2-2026.txt',
);
const skwierzynkaFixturePath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/pdf-text/sianow-skwierzynka-h2-2026.txt',
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

describe('parseSianowH2', () => {
  it('supports Sianów Dąbrowa i Grabówko H2 text fixture', async () => {
    const text = await readFile(fixturePath, 'utf8');
    expect(supportsSianowH2(text)).toBe(true);
    expect(supportsSianowH2('Some unrelated text')).toBe(false);
  });

  it('supports Sianów Borowiec H2 text fixture', async () => {
    const text = await readFile(borowiecFixturePath, 'utf8');
    expect(supportsSianowH2(text)).toBe(true);
  });

  it('parses Sianów Dąbrowa i Grabówko H2 text fixture into 64 collection events for Grabówko', async () => {
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
      {
        type: 'LOCALITY',
        priority: 50,
        simc: '0310835',
      },
    ]);

    // 13 MIXED + (13 * 3 = 39) METALS_PLASTICS/PAPER/GLASS + 11 BIO + 1 BULKY = 64 total events
    expect(result.collectionEvents).toHaveLength(64);

    const mixedEvents = result.collectionEvents.filter((e) => e.fraction === 'MIXED');
    const metalsPlasticsEvents = result.collectionEvents.filter((e) => e.fraction === 'METALS_PLASTICS');
    const paperEvents = result.collectionEvents.filter((e) => e.fraction === 'PAPER');
    const glassEvents = result.collectionEvents.filter((e) => e.fraction === 'GLASS');
    const bioEvents = result.collectionEvents.filter((e) => e.fraction === 'BIO');
    const bulkyEvents = result.collectionEvents.filter((e) => e.fraction === 'BULKY');

    expect(mixedEvents).toHaveLength(13);
    expect(metalsPlasticsEvents).toHaveLength(13);
    expect(paperEvents).toHaveLength(13);
    expect(glassEvents).toHaveLength(13);
    expect(bioEvents).toHaveLength(11);
    expect(bulkyEvents).toHaveLength(1);

    // Verify concrete dates
    expect(mixedEvents[0]?.date).toBe('2026-07-08');
    expect(mixedEvents[mixedEvents.length - 1]?.date).toBe('2026-12-21');

    expect(metalsPlasticsEvents[0]?.date).toBe('2026-07-07');
    expect(metalsPlasticsEvents[metalsPlasticsEvents.length - 1]?.date).toBe('2026-12-19');

    expect(bioEvents[0]?.date).toBe('2026-07-07');
    expect(bioEvents[bioEvents.length - 1]?.date).toBe('2026-12-19');

    expect(bulkyEvents[0]?.date).toBe('2026-09-26');
  });

  it('parses Sianów Borowiec H2 text fixture into 63 collection events across 7 clean rural localities', async () => {
    const text = await readFile(borowiecFixturePath, 'utf8');
    const input = { ...MOCK_BOROWIEC_INPUT, text };
    const result = parseSianowH2(input, MOCK_REFERENCE, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.sources[0]?.artifact?.parserKey).toBe('municipal-collection-pdf-text');
    expect(result.sources[0]?.artifact?.parserVersion).toBe('0.2.0');
    expect(result.serviceAreas).toHaveLength(1);

    const serviceArea = result.serviceAreas[0]!;
    expect(serviceArea.key).toBe('sianow-safe-h2-borowiec-rural');
    expect(serviceArea.name).toBe('Gmina Sianów — Trasa Borowiec (tereny wiejskie bezpieczne)');
    expect(serviceArea.buildingType).toBe('SINGLE_FAMILY');
    expect(serviceArea.coverage).toHaveLength(7);

    const simcs = serviceArea.coverage.map((c) => (c as { simc: string }).simc);
    expect(simcs).toEqual([
      '0310999', // Borowiec
      '0311183', // Szczeglino Nowe
      '0311036', // Przytok
      '0310982', // Ratajki
      '0311088', // Sowno
      '0311094', // Suszka
      '0311071', // Sowieński Młyn
    ]);

    // 13 MIXED + (13 * 3 = 39) METALS_PLASTICS/PAPER/GLASS + 10 BIO + 1 BULKY = 63 total events
    expect(result.collectionEvents).toHaveLength(63);

    const mixedEvents = result.collectionEvents.filter((e) => e.fraction === 'MIXED');
    const metalsPlasticsEvents = result.collectionEvents.filter((e) => e.fraction === 'METALS_PLASTICS');
    const paperEvents = result.collectionEvents.filter((e) => e.fraction === 'PAPER');
    const glassEvents = result.collectionEvents.filter((e) => e.fraction === 'GLASS');
    const bioEvents = result.collectionEvents.filter((e) => e.fraction === 'BIO');
    const bulkyEvents = result.collectionEvents.filter((e) => e.fraction === 'BULKY');

    expect(mixedEvents).toHaveLength(13);
    expect(metalsPlasticsEvents).toHaveLength(13);
    expect(paperEvents).toHaveLength(13);
    expect(glassEvents).toHaveLength(13);
    expect(bioEvents).toHaveLength(10);
    expect(bulkyEvents).toHaveLength(1);

    // Verify concrete dates
    expect(mixedEvents[0]?.date).toBe('2026-07-09');
    expect(mixedEvents[mixedEvents.length - 1]?.date).toBe('2026-12-22');

    expect(metalsPlasticsEvents[0]?.date).toBe('2026-07-13');
    expect(metalsPlasticsEvents[metalsPlasticsEvents.length - 1]?.date).toBe('2026-12-28');

    expect(bioEvents[0]?.date).toBe('2026-07-13');
    expect(bioEvents[bioEvents.length - 1]?.date).toBe('2026-12-12');

    expect(bulkyEvents[0]?.date).toBe('2026-09-19');
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

  it('supports and parses Sianów Skwierzynka H2 text fixture', async () => {
    const text = await readFile(skwierzynkaFixturePath, 'utf8');
    expect(supportsSianowH2(text)).toBe(true);

    const input = { ...MOCK_SKWIERZYNKA_INPUT, text };
    const result = parseSianowH2(input, MOCK_REFERENCE, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.serviceAreas).toHaveLength(1);
    const serviceArea = result.serviceAreas[0]!;
    expect(serviceArea.key).toBe('sianow-skwierzynka-single-family');
    expect(serviceArea.buildingType).toBe('SINGLE_FAMILY');
    expect(serviceArea.coverage).toEqual([
      {
        type: 'LOCALITY',
        priority: 50,
        simc: '0311125',
      },
    ]);

    const mixedEvents = result.collectionEvents.filter((e) => e.fraction === 'MIXED');
    const metalsPlasticsEvents = result.collectionEvents.filter((e) => e.fraction === 'METALS_PLASTICS');
    const paperEvents = result.collectionEvents.filter((e) => e.fraction === 'PAPER');
    const glassEvents = result.collectionEvents.filter((e) => e.fraction === 'GLASS');
    const bioEvents = result.collectionEvents.filter((e) => e.fraction === 'BIO');
    const bulkyEvents = result.collectionEvents.filter((e) => e.fraction === 'BULKY');

    // 13 MIXED + (13 * 3 = 39) segregated + 11 BIO + 1 BULKY = 64 total
    expect(mixedEvents).toHaveLength(13);
    expect(metalsPlasticsEvents).toHaveLength(13);
    expect(paperEvents).toHaveLength(13);
    expect(glassEvents).toHaveLength(13);
    expect(bioEvents).toHaveLength(11);
    expect(bulkyEvents).toHaveLength(1);

    expect(mixedEvents[0]?.date).toBe('2026-07-14');
    expect(mixedEvents[mixedEvents.length - 1]?.date).toBe('2026-12-29');

    expect(metalsPlasticsEvents[0]?.date).toBe('2026-07-06');
    expect(metalsPlasticsEvents[metalsPlasticsEvents.length - 1]?.date).toBe('2026-12-18');

    expect(bioEvents[0]?.date).toBe('2026-07-06');
    expect(bioEvents[bioEvents.length - 1]?.date).toBe('2026-12-18');

    expect(bulkyEvents[0]?.date).toBe('2026-09-19');
  });
});
