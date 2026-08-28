import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../ingestion/hash.js';
import { validateWastePlDataset } from '../../normalization/validate-wastepl-dataset.js';
import { PgkKoszalinPdfTextAdapter } from './pgk-koszalin-adapter.js';
import { PdfTextParseError, type PdfTextArtifactInput } from './types.js';

async function fixture(name: string, url: string, sourceKey: string): Promise<PdfTextArtifactInput> {
  const text = await readFile(new URL(`../../../test/fixtures/pdf-text/${name}`, import.meta.url), 'utf8');
  const sha256 = sha256Hex(Buffer.from(text));
  return {
    text,
    sourceKey,
    url,
    sha256,
    retrievedAt: '2026-08-27T15:00:00.000Z',
    storageUri: `s3://test-fixtures/${sha256}`,
  };
}

describe('PgkKoszalinPdfTextAdapter', () => {
  const adapter = new PgkKoszalinPdfTextAdapter();

  it('normalizes the Manowo monthly table deterministically and validates WastePL v0.1', async () => {
    const input = await fixture(
      'manowo-2ab-2026.txt',
      'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/manowo/2AB.pdf',
      'pgk-manowo-2ab-2026',
    );

    expect(adapter.supports(input.text)).toBe(true);
    const first = adapter.parse(input);
    const second = adapter.parse(input);

    expect(second).toEqual(first);
    expect(first.municipality).toEqual({
      terc: '3209042',
      name: 'Manowo',
      municipalityType: 'RURAL',
    });
    expect(first.serviceAreas).toHaveLength(1);
    expect(first.serviceAreas[0]?.coverage).toEqual([
      { type: 'LOCALITY', priority: 50, simc: '0308040' },
      { type: 'LOCALITY', priority: 50, simc: '0308212' },
      { type: 'LOCALITY', priority: 50, simc: '0308229' },
      { type: 'LOCALITY', priority: 50, simc: '0308206' },
    ]);
    expect(first.collectionEvents).toHaveLength(66);
    expect(new Set(first.collectionEvents.map((entry) => entry.fraction))).toEqual(
      new Set(['MIXED', 'METALS_PLASTICS', 'GLASS', 'PAPER', 'BIO', 'BULKY']),
    );
    expect(first.collectionEvents).toContainEqual(
      expect.objectContaining({ fraction: 'BULKY', date: '2026-05-30' }),
    );
    expect(first.sources[0]?.artifact).toMatchObject({
      sha256: input.sha256,
      parserKey: 'pgk-koszalin-pdf-text',
      parserVersion: '0.1.0',
      storageUri: input.storageUri,
    });
    expect(first.collectionEvents.every((entry) => entry.sourceKey === input.sourceKey)).toBe(true);
    await expect(validateWastePlDataset(first)).resolves.toBeUndefined();
  });

  it('turns Koszalin multi-family BIO address weekdays into concrete dates', async () => {
    const input = await fixture(
      'koszalin-bio-2026.txt',
      'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/koszalin2/bio.pdf',
      'pgk-koszalin-bio-multifamily-2026-h2',
    );

    const dataset = adapter.parse(input);
    expect(dataset.municipality).toEqual({
      terc: '3261011',
      name: 'Koszalin',
      municipalityType: 'DISTRICT_CITY',
    });
    expect(dataset.serviceAreas).toHaveLength(5);
    expect(dataset.collectionEvents).toHaveLength(132);
    expect(dataset.collectionEvents.every((entry) => entry.fraction === 'BIO')).toBe(true);

    const wednesday = dataset.serviceAreas.find((area) => area.key === 'koszalin-bio-środa');
    expect(wednesday?.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ explicitAddress: '1 MAJA 3, Koszalin' }),
        expect.objectContaining({ explicitAddress: '4 MARCA 10, Koszalin' }),
        expect.objectContaining({ explicitAddress: 'FREZJI 11, Koszalin' }),
      ]),
    );
    expect(dataset.collectionEvents).toContainEqual(
      expect.objectContaining({
        serviceAreaKey: 'koszalin-bio-środa',
        date: '2026-07-01',
        fraction: 'BIO',
      }),
    );
    expect(dataset.collectionEvents).toContainEqual(
      expect.objectContaining({
        serviceAreaKey: 'koszalin-bio-czwartek',
        date: '2026-12-31',
        fraction: 'BIO',
      }),
    );
    await expect(validateWastePlDataset(dataset)).resolves.toBeUndefined();
  });

  it('fails visibly instead of guessing a combined mixed + generic segregated column', async () => {
    const input = await fixture(
      'koszalin-sr2-ambiguous-2026.txt',
      'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/koszalin/sr2.pdf?ver5=',
      'pgk-koszalin-sr2-2026',
    );

    try {
      adapter.parse(input);
      throw new Error('Expected adapter to reject ambiguous source');
    } catch (error) {
      expect(error).toBeInstanceOf(PdfTextParseError);
      expect((error as PdfTextParseError).code).toBe('AMBIGUOUS_FRACTION');
    }
  });
});
