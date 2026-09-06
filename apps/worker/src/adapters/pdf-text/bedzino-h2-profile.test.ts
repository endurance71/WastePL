import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../ingestion/hash.js';
import { validateWastePlDataset } from '../../normalization/validate-wastepl-dataset.js';
import {
  MunicipalCollectionPdfTextAdapter,
  type MunicipalCollectionReferenceContext,
} from './municipal-collection-adapter.js';
import {
  BEDZINO_TRASA_1_SAFE_H2_SOURCE_KEY,
  BEDZINO_TRASA_2_SAFE_H2_SOURCE_KEY,
  BEDZINO_TERC,
} from './bedzino-h2-profile.js';
import { PdfTextParseError, type PdfTextArtifactInput } from './types.js';

const trasa1FixturePath = fileURLToPath(
  new URL('../../../test/fixtures/pdf-text/bedzino-trasa-1-h2-2026.txt', import.meta.url),
);
const BEDZINO_TRASA_1_TEXT = readFileSync(trasa1FixturePath, 'utf8');

const trasa2FixturePath = fileURLToPath(
  new URL('../../../test/fixtures/pdf-text/bedzino-trasa-2-h2-2026.txt', import.meta.url),
);
const BEDZINO_TRASA_2_TEXT = readFileSync(trasa2FixturePath, 'utf8');

function trasa1Context(): MunicipalCollectionReferenceContext {
  return {
    municipality: {
      terc: BEDZINO_TERC,
      name: 'Będzino',
      municipalityType: 'RURAL',
    },
    localities: [
      { name: 'Dworek', simc: '0302400' },
      { name: 'Będzino', simc: '0302882' },
    ],
  };
}

function trasa2Context(): MunicipalCollectionReferenceContext {
  return {
    municipality: {
      terc: BEDZINO_TERC,
      name: 'Będzino',
      municipalityType: 'RURAL',
    },
    localities: [
      { name: 'Dobiesławiec', simc: '0302280' },
      { name: 'Barninek', simc: '0302296' },
      { name: 'Dobre', simc: '0302327' },
      { name: 'Dobre Małe', simc: '0302333' },
      { name: 'Kazimierz Pomorski', simc: '0302468' },
      { name: 'Łekno', simc: '0302451' },
      { name: 'Podamirowo', simc: '0302304' },
      { name: 'Ziębrze', simc: '0302534' },
    ],
  };
}

function trasa1Input(text = BEDZINO_TRASA_1_TEXT): PdfTextArtifactInput {
  return {
    text,
    sourceKey: BEDZINO_TRASA_1_SAFE_H2_SOURCE_KEY,
    url: 'https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-I.pdf',
    sha256: sha256Hex(Buffer.from(text)),
    retrievedAt: '2026-09-03T10:00:00.000Z',
    storageUri: 's3://test/bedzino-trasa-1-h2',
    ownerType: 'MUNICIPALITY',
  };
}

function trasa2Input(text = BEDZINO_TRASA_2_TEXT): PdfTextArtifactInput {
  return {
    text,
    sourceKey: BEDZINO_TRASA_2_SAFE_H2_SOURCE_KEY,
    url: 'https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-II.pdf',
    sha256: sha256Hex(Buffer.from(text)),
    retrievedAt: '2026-09-06T10:00:00.000Z',
    storageUri: 's3://test/bedzino-trasa-2-h2',
    ownerType: 'MUNICIPALITY',
  };
}

describe('Będzino H2 municipal PDF profile', () => {
  it('publishes the single-family Dworek locality with source-safe fractions for Trasa I', async () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(trasa1Context());
    const dataset = adapter.parse(trasa1Input());

    expect(dataset.municipality).toEqual({
      terc: BEDZINO_TERC,
      name: 'Będzino',
      municipalityType: 'RURAL',
    });
    expect(dataset.serviceAreas).toEqual([
      {
        key: 'bedzino-trasa-1-safe-dworek',
        name: 'Gmina Będzino — Dworek (Trasa I)',
        buildingType: 'SINGLE_FAMILY',
        coverage: [{ type: 'LOCALITY', priority: 50, simc: '0302400' }],
      },
    ]);

    expect(dataset.sources[0]?.sourceKey).toBe(BEDZINO_TRASA_1_SAFE_H2_SOURCE_KEY);
    expect(dataset.sources[0]?.artifact.parserKey).toBe('municipal-collection-pdf-text');
    expect(dataset.sources[0]?.artifact.parserVersion).toBe('0.2.0');

    // Months: July-December
    const dates = dataset.collectionEvents.map((event) => event.date);
    expect(dates[0]).toBe('2026-07-02');
    expect(dates[dates.length - 1]).toBe('2026-12-29');

    // Fractions present
    const fractions = new Set(dataset.collectionEvents.map((event) => event.fraction));
    expect(fractions).toEqual(new Set(['MIXED', 'BIO', 'OTHER']));

    // Plastic notes & warnings
    const plasticEvents = dataset.collectionEvents.filter((e) => e.note?.includes('tworzywa sztuczne'));
    expect(plasticEvents.length).toBeGreaterThan(0);
    expect(plasticEvents[0]?.quality.warnings).toContain('SOURCE_FRACTION_PLASTICS_ONLY_NOT_METALS_PLASTICS');

    // Paper/glass combined notes & warnings
    const paperGlassEvents = dataset.collectionEvents.filter((e) => e.note?.includes('papier, szkło'));
    expect(paperGlassEvents.length).toBeGreaterThan(0);
    expect(paperGlassEvents[0]?.quality.warnings).toContain('SOURCE_FRACTION_COMBINED_PAPER_GLASS');

    await expect(validateWastePlDataset(dataset)).resolves.toBeUndefined();
  });

  it('publishes 8 zero-risk rural localities for Trasa II', async () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(trasa2Context());
    const dataset = adapter.parse(trasa2Input());

    expect(dataset.municipality).toEqual({
      terc: BEDZINO_TERC,
      name: 'Będzino',
      municipalityType: 'RURAL',
    });
    expect(dataset.serviceAreas[0]?.key).toBe('bedzino-trasa-2-safe');
    expect(dataset.serviceAreas[0]?.name).toBe('Gmina Będzino — Trasa II (część bezpieczna)');
    expect(dataset.serviceAreas[0]?.coverage).toHaveLength(8);

    expect(dataset.sources[0]?.sourceKey).toBe(BEDZINO_TRASA_2_SAFE_H2_SOURCE_KEY);

    // Months: July-December
    const dates = dataset.collectionEvents.map((event) => event.date);
    expect(dates[0]).toBe('2026-07-07');
    expect(dates[dates.length - 1]).toBe('2026-12-22');

    // Fractions present
    const fractions = new Set(dataset.collectionEvents.map((event) => event.fraction));
    expect(fractions).toEqual(new Set(['MIXED', 'BIO', 'OTHER']));

    await expect(validateWastePlDataset(dataset)).resolves.toBeUndefined();
  });

  it('fails fast if municipality reference lacks Dworek for Trasa I', () => {
    const adapter = new MunicipalCollectionPdfTextAdapter({
      municipality: { terc: BEDZINO_TERC, name: 'Będzino', municipalityType: 'RURAL' },
      localities: [{ name: 'Będzino', simc: '0302882' }],
    });

    expect(() => adapter.parse(trasa1Input())).toThrowError(PdfTextParseError);
    expect(() => adapter.parse(trasa1Input())).toThrowError(/dworek did not resolve uniquely/i);
  });

  it('fails fast on corrupted table structure', () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(trasa1Context());
    const corrupted = BEDZINO_TRASA_1_TEXT.replace('LIPIEC 14,28 2,16,30 2,16,30 3,17,31', 'LIPIEC 14,28');

    expect(() => adapter.parse(trasa1Input(corrupted))).toThrowError(PdfTextParseError);
    expect(() => adapter.parse(trasa1Input(corrupted))).toThrowError(/Expected month and four date cells/);
  });
});
