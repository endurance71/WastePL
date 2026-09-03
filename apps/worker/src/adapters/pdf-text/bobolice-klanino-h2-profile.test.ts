import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseBoboliceKlaninoH2,
  supportsBoboliceKlaninoH2,
  BOBOLICE_KLANINO_SOURCE_KEY,
  BOBOLICE_TERC,
} from './bobolice-klanino-h2-profile.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const fixturePath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/pdf-text/bobolice-klanino-h2-2026.txt',
);

const MOCK_REFERENCE: MunicipalCollectionReferenceContext = {
  municipality: {
    terc: BOBOLICE_TERC,
    name: 'Bobolice',
    municipalityType: 'URBAN_RURAL',
  },
  localities: [
    {
      simc: '0304214',
      name: 'Kłanino',
    },
    {
      simc: '0304102',
      name: 'Przydargiń',
    },
    {
      simc: '0304510',
      name: 'Różewko',
    },
    {
      simc: '0304480',
      name: 'Ubiedrze',
    },
    {
      simc: '0304250',
      name: 'Wilczogóra',
    },
  ],
};

const MOCK_INPUT = {
  sourceKey: BOBOLICE_KLANINO_SOURCE_KEY,
  url: 'https://cms-v2-files.idcom-jst.pl/sites/52/cms/szablony/5169/zdjecia/orign/2a2130e07b8640d995b493f4bca53e20ej2pjkevuej9bq1k-6.jpg',
  sha256: '3b91671c01a63d7dc7bd6eed37c82a02e0246a6c3407e095a6c7a7d6e597d5c2',
  retrievedAt: '2026-09-03T15:00:00.000Z',
  storageUri: 'fixture://bobolice-klanino-h2-2026',
  text: '',
};

describe('parseBoboliceKlaninoH2', () => {
  it('supports Bobolice Kłanino text fixture', async () => {
    const text = await readFile(fixturePath, 'utf8');
    expect(supportsBoboliceKlaninoH2(text)).toBe(true);
    expect(supportsBoboliceKlaninoH2('Some unrelated text')).toBe(false);
  });

  it('parses Bobolice Kłanino text fixture into 63 collection events for Kłanino', async () => {
    const text = await readFile(fixturePath, 'utf8');
    const input = { ...MOCK_INPUT, text };
    const result = parseBoboliceKlaninoH2(input, MOCK_REFERENCE, 'municipal-collection-pdf-text', '0.2.0');

    expect(result.sources[0]?.artifact?.parserKey).toBe('municipal-collection-pdf-text');
    expect(result.sources[0]?.artifact?.parserVersion).toBe('0.2.0');
    expect(result.serviceAreas).toHaveLength(1);

    const serviceArea = result.serviceAreas[0]!;
    expect(serviceArea.key).toBe('bobolice-safe-h2-klanino');
    expect(serviceArea.name).toBe('Gmina Bobolice — Kłanino (Trasa Kłanino/Ubiedrze)');
    expect(serviceArea.buildingType).toBe('SINGLE_FAMILY');
    expect(serviceArea.coverage).toEqual([
      {
        type: 'LOCALITY',
        priority: 50,
        simc: '0304214',
      },
    ]);

    // 13 MIXED + 13 METALS_PLASTICS + 13 GLASS + 12 PAPER + 12 BIO = 63 events
    expect(result.collectionEvents).toHaveLength(63);

    const mixedEvents = result.collectionEvents.filter((event) => event.fraction === 'MIXED');
    expect(mixedEvents).toHaveLength(13);
    expect(mixedEvents[0]?.date).toBe('2026-07-09');
    expect(mixedEvents[1]?.date).toBe('2026-07-17');
    expect(mixedEvents[12]?.date).toBe('2026-12-17');

    const metalsEvents = result.collectionEvents.filter((event) => event.fraction === 'METALS_PLASTICS');
    expect(metalsEvents).toHaveLength(13);
    expect(metalsEvents[0]?.date).toBe('2026-07-10');
    expect(metalsEvents[12]?.date).toBe('2026-12-23');

    const glassEvents = result.collectionEvents.filter((event) => event.fraction === 'GLASS');
    expect(glassEvents).toHaveLength(13);

    const paperEvents = result.collectionEvents.filter((event) => event.fraction === 'PAPER');
    expect(paperEvents).toHaveLength(12);
    expect(paperEvents[0]?.date).toBe('2026-07-17');

    const bioEvents = result.collectionEvents.filter((event) => event.fraction === 'BIO');
    expect(result.sources[0]?.artifact?.extractionConfidence).toBe(0.99);
    expect(result.collectionEvents[0]?.quality.confidence).toBe(0.99);
  });

  it('rejects unsupported sourceKey or mismatched TERC', async () => {
    const text = await readFile(fixturePath, 'utf8');
    const wrongKeyInput = { ...MOCK_INPUT, sourceKey: 'invalid-source-key', text };

    expect(() =>
      parseBoboliceKlaninoH2(wrongKeyInput, MOCK_REFERENCE, 'municipal-collection-pdf-text', '0.2.0'),
    ).toThrowError(/Unsupported Bobolice source/);

    const wrongTercContext = {
      ...MOCK_REFERENCE,
      municipality: { ...MOCK_REFERENCE.municipality, terc: '9999999' },
    };
    expect(() =>
      parseBoboliceKlaninoH2(
        { ...MOCK_INPUT, text },
        wrongTercContext,
        'municipal-collection-pdf-text',
        '0.2.0',
      ),
    ).toThrowError(/Bobolice profile received unexpected TERC/);
  });
});
