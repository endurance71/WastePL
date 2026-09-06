import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../ingestion/hash.js';
import { validateWastePlDataset } from '../../normalization/validate-wastepl-dataset.js';
import {
  MunicipalCollectionPdfTextAdapter,
  type MunicipalCollectionReferenceContext,
} from './municipal-collection-adapter.js';
import { PdfTextParseError, type PdfTextArtifactInput } from './types.js';

const fixturePath = fileURLToPath(
  new URL('../../../test/fixtures/pdf-text/polanow-garbno-h2-2026.txt', import.meta.url),
);
const GARBNO_TEXT = readFileSync(fixturePath, 'utf8');

function context(): MunicipalCollectionReferenceContext {
  return {
    municipality: {
      terc: '3209063',
      name: 'Polanów',
      municipalityType: 'URBAN_RURAL',
    },
    localities: [
      { name: 'Garbno', simc: '0308749' },
      { name: 'Polanów', simc: '0979162' },
    ],
  };
}

function input(text = GARBNO_TEXT): PdfTextArtifactInput {
  return {
    text,
    sourceKey: 'polanow-collection-garbno-h2-2026',
    url: 'https://bip.polanow.pl/pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5',
    sha256: sha256Hex(Buffer.from(text)),
    retrievedAt: '2026-08-29T19:00:00.000Z',
    storageUri: 's3://test/polanow-garbno-h2',
    ownerType: 'MUNICIPALITY',
  };
}

describe('Polanów Garbno H2 municipal PDF profile', () => {
  it('publishes only the single-family Garbno locality with source-safe fractions', async () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(context());
    const dataset = adapter.parse(input());

    expect(dataset.municipality).toEqual({
      terc: '3209063',
      name: 'Polanów',
      municipalityType: 'URBAN_RURAL',
    });
    expect(dataset.serviceAreas).toEqual([
      {
        key: 'polanow-garbno-single-family',
        name: 'Gmina Polanów — Garbno, zabudowa jednorodzinna',
        buildingType: 'SINGLE_FAMILY',
        coverage: [{ type: 'LOCALITY', priority: 50, simc: '0308749' }],
      },
    ]);

    expect(new Set(dataset.collectionEvents.map((event) => event.fraction))).toEqual(
      new Set(['MIXED', 'BIO', 'OTHER', 'BULKY']),
    );
    expect(dataset.collectionEvents.some((event) => event.fraction === 'PAPER')).toBe(false);
    expect(dataset.collectionEvents.some((event) => event.fraction === 'GLASS')).toBe(false);
    expect(dataset.collectionEvents.some((event) => event.fraction === 'METALS_PLASTICS')).toBe(false);

    expect(dataset.collectionEvents).toContainEqual(
      expect.objectContaining({ fraction: 'MIXED', date: '2026-07-09' }),
    );
    expect(dataset.collectionEvents).toContainEqual(
      expect.objectContaining({ fraction: 'BIO', date: '2026-07-31' }),
    );
    expect(dataset.collectionEvents).toContainEqual(
      expect.objectContaining({
        fraction: 'OTHER',
        date: '2026-10-23',
        note: 'Źródło: segregacja',
        quality: expect.objectContaining({
          warnings: ['SOURCE_FRACTION_GENERIC_SEGREGATION_NOT_EXPANDED'],
        }),
      }),
    );
    expect(dataset.collectionEvents.filter((event) => event.fraction === 'BULKY')).toEqual([
      expect.objectContaining({ date: '2026-10-24' }),
    ]);

    // The PDF text contains the same rendered table twice. It must not double the events.
    expect(dataset.collectionEvents.filter((event) => event.fraction === 'MIXED')).toHaveLength(13);
    expect(dataset.collectionEvents.filter((event) => event.fraction === 'BIO')).toHaveLength(11);
    expect(dataset.collectionEvents.filter((event) => event.fraction === 'OTHER')).toHaveLength(7);
    expect(dataset.sources[0]).toMatchObject({
      sourceKey: 'polanow-collection-garbno-h2-2026',
      artifact: {
        parserKey: 'municipal-collection-pdf-text',
        parserVersion: '0.2.0',
      },
    });
    await expect(validateWastePlDataset(dataset)).resolves.toBeUndefined();
  });

  it('fails closed when the duplicated rendered tables drift apart', () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(context());
    const drifted = GARBNO_TEXT.replace(
      'zmieszane bio segregacja gabaryty\nlipiec 9, 23 3, 17, 31 3, 31\nsierpień 6, 20 14, 28 28\nwrzesień 3,17 11, 25 25\npaździernik 1, 15, 29 9, 23 23 24\nlistopad 13, 26 20 20\ngrudzień 10, 22 17 18\n2026',
      'zmieszane bio segregacja gabaryty\nlipiec 10, 23 3, 17, 31 3, 31\nsierpień 6, 20 14, 28 28\nwrzesień 3,17 11, 25 25\npaździernik 1, 15, 29 9, 23 23 24\nlistopad 13, 26 20 20\ngrudzień 10, 22 17 18\n2026',
    );

    expect(() => adapter.parse(input(drifted))).toThrowError(PdfTextParseError);
    try {
      adapter.parse(input(drifted));
    } catch (error) {
      expect((error as PdfTextParseError).code).toBe('UNSUPPORTED_TEMPLATE');
      expect((error as Error).message).toContain('not identical');
    }
  });

  it('fails when Garbno is not uniquely available in the municipality reference context', () => {
    const broken = context();
    broken.localities = [{ name: 'Polanów', simc: '0979162' }];
    const adapter = new MunicipalCollectionPdfTextAdapter(broken);

    expect(() => adapter.parse(input())).toThrowError(PdfTextParseError);
    try {
      adapter.parse(input());
    } catch (error) {
      expect((error as PdfTextParseError).code).toBe('MISSING_METADATA');
      expect((error as Error).message).toContain('Garbno');
    }
  });

  it('fails when the source is evaluated under a different municipality TERC', () => {
    const wrong = context();
    wrong.municipality.terc = '3201043';
    const adapter = new MunicipalCollectionPdfTextAdapter(wrong);

    expect(() => adapter.parse(input())).toThrowError(PdfTextParseError);
    try {
      adapter.parse(input());
    } catch (error) {
      expect((error as PdfTextParseError).code).toBe('MISSING_METADATA');
    }
  });

  it('does not accept a generic Polanów schedule without the exact Garbno single-family marker', () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(context());
    expect(adapter.supports(GARBNO_TEXT.replace('Zabudowa jednorodzinna miejscowości GARBNO', 'Miasto Polanów'))).toBe(false);
  });

  it('publishes Rural Set A (17 localities) with source-safe fractions and events', async () => {
    const setAFixturePath = fileURLToPath(
      new URL('../../../test/fixtures/pdf-text/polanow-rural-set-a-h2-2026.txt', import.meta.url),
    );
    const setAText = readFileSync(setAFixturePath, 'utf8');

    const setAContext: MunicipalCollectionReferenceContext = {
      municipality: {
        terc: '3209063',
        name: 'Polanów',
        municipalityType: 'URBAN_RURAL',
      },
      localities: [
        { name: 'Bukowo', simc: '0309192' },
        { name: 'Dadzewo', simc: '0308904' },
        { name: 'Domachowo', simc: '0309200' },
        { name: 'Jacinki', simc: '0308896' },
        { name: 'Krytno', simc: '0309000' },
        { name: 'Karsina', simc: '0308933' },
        { name: 'Karsinka', simc: '0308910' },
        { name: 'Nacław', simc: '0309080' },
        { name: 'Nadbór', simc: '0309097' },
        { name: 'Osetno', simc: '0309105' },
        { name: 'Powidz', simc: '0309051' },
        { name: 'Puławy', simc: '0309230' },
        { name: 'Rekowo', simc: '0309074' },
        { name: 'Rzyszczewko', simc: '0309170' },
        { name: 'Sowinko', simc: '0309269' },
        { name: 'Stołpie', simc: '0309068' },
        { name: 'Świerczyna', simc: '0309246' },
      ],
    };

    const setAInput: PdfTextArtifactInput = {
      text: setAText,
      sourceKey: 'polanow-collection-rural-set-a-h2-2026',
      url: 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289185_Polanow-3.pdf',
      sha256: sha256Hex(Buffer.from(setAText)),
      retrievedAt: '2026-09-06T10:00:00.000Z',
      storageUri: 's3://test/polanow-rural-set-a-h2',
      ownerType: 'MUNICIPALITY',
    };

    const adapter = new MunicipalCollectionPdfTextAdapter(setAContext);
    const dataset = adapter.parse(setAInput);

    expect(dataset.serviceAreas).toEqual([
      {
        key: 'polanow-rural-set-a-single-family',
        name: 'Gmina Polanów — Rejon wiejski A (17 miejscowości), zabudowa jednorodzinna',
        buildingType: 'SINGLE_FAMILY',
        coverage: expect.arrayContaining([
          { type: 'LOCALITY', priority: 50, simc: '0309192' },
          { type: 'LOCALITY', priority: 50, simc: '0308904' },
          { type: 'LOCALITY', priority: 50, simc: '0309246' },
        ]),
      },
    ]);
    expect(dataset.serviceAreas[0]?.coverage).toHaveLength(17);

    expect(new Set(dataset.collectionEvents.map((e) => e.fraction))).toEqual(
      new Set(['MIXED', 'BIO', 'OTHER', 'BULKY']),
    );
    expect(dataset.collectionEvents.filter((e) => e.fraction === 'MIXED')).toHaveLength(13);
    expect(dataset.collectionEvents.filter((e) => e.fraction === 'BIO')).toHaveLength(11);
    expect(dataset.collectionEvents.filter((e) => e.fraction === 'OTHER')).toHaveLength(6);
    expect(dataset.collectionEvents.filter((e) => e.fraction === 'BULKY')).toHaveLength(1);

    await expect(validateWastePlDataset(dataset)).resolves.toBeUndefined();
  });
});