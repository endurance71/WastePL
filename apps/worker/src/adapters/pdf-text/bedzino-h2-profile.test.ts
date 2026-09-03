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
  BEDZINO_TERC,
} from './bedzino-h2-profile.js';
import { PdfTextParseError, type PdfTextArtifactInput } from './types.js';

const fixturePath = fileURLToPath(
  new URL('../../../test/fixtures/pdf-text/bedzino-trasa-1-h2-2026.txt', import.meta.url),
);
const BEDZINO_TEXT = readFileSync(fixturePath, 'utf8');

function context(): MunicipalCollectionReferenceContext {
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

function input(text = BEDZINO_TEXT): PdfTextArtifactInput {
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

describe('Będzino H2 municipal PDF profile', () => {
  it('publishes the single-family Dworek locality with source-safe fractions', async () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(context());
    const dataset = adapter.parse(input());

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

  it('fails fast if municipality reference lacks Dworek', () => {
    const adapter = new MunicipalCollectionPdfTextAdapter({
      municipality: { terc: BEDZINO_TERC, name: 'Będzino', municipalityType: 'RURAL' },
      localities: [{ name: 'Będzino', simc: '0302882' }],
    });

    expect(() => adapter.parse(input())).toThrowError(PdfTextParseError);
    expect(() => adapter.parse(input())).toThrowError(/Dworek did not resolve uniquely/);
  });

  it('fails fast on corrupted table structure', () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(context());
    const corrupted = BEDZINO_TEXT.replace('LIPIEC 14,28 2,16,30 2,16,30 3,17,31', 'LIPIEC 14,28');

    expect(() => adapter.parse(input(corrupted))).toThrowError(PdfTextParseError);
    expect(() => adapter.parse(input(corrupted))).toThrowError(/Expected month and four date cells/);
  });
});
