import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../ingestion/hash.js';
import { validateWastePlDataset } from '../../normalization/validate-wastepl-dataset.js';
import {
  MunicipalCollectionPdfTextAdapter,
  type MunicipalCollectionReferenceContext,
} from './municipal-collection-adapter.js';
import { PdfTextParseError, type PdfTextArtifactInput } from './types.js';

const SAFE_REFERENCE_LOCALITIES = [
  'Buczki', 'Czarnkowo', 'Dzięciołowo', 'Giżałki', 'Pobądz', 'Smęcino', 'Solno', 'Tyczewo', 'Wełdkowo', 'Wełdkówko',
  'Bukowo', 'Bukówko', 'Dobrowo', 'Dobrówko', 'Modrolas', 'Podborsko', 'Retowo', 'Skarszewice', 'Słonino', 'Zaspy Wielkie',
  'Doble', 'Kikowo', 'Krosinko', 'Liśnica', 'Nowe Dębno', 'Rudno', 'Sławomierz', 'Trzebiszyn', 'Trzebiec', 'Żukówek',
] as const;

const STANDARD_TEXT = `
Gmina Tychowo
Harmonogram odbioru odpadów komunalnych - 2026 rok
Miejscowość rodzaj odpadu styczeń luty marzec kwiecień maj czerwiec lipiec sierpień wrzesień październik listopad grudzień
zmieszane 05,19 02,16 02,16,30 13,27 11,25 08,22 06,20 03,17,31 17,28 12,26 09,23 07,21
bio 05,19 02,16 02,16,30 13,27 11,25 08,22 06,20 03,17,31 14,28 12,26 09,23 07,21
papier i tektura 15 12 12 09 07 03 02,30 27 24 22 19 17
tworzywa sztuczne 14 11 11 08 06 03 01,29 26 23 21 18 16
szkło 16 13 13 10 08 05 03,31 28 25 23 20 18
mycie 17
wielkogabaryty 28,29,30
Miejscowość rodzaj odpadu styczeń luty marzec kwiecień maj czerwiec lipiec sierpień wrzesień październik listopad grudzień
zmieszane 05,19 02,16 02,16,30 13,27 11,25 08,22 06,20 03,17,31 18,28 12,26 09,23 07,21
bio 05,19 02,16 02,16,30 13,27 11,25 08,22 06,20 03,17,31 14,28 12,26 09,23 07,21
papier i tektura 15 12 12 09 07 03 02,30 27 24 22 19 17
tworzywa sztuczne 14 11 11 08 06 03 01,29 26 23 21 18 16
szkło 16 13 13 10 08 05 03,31 28 25 23 20 18
mycie 18
wielkogabaryty 28,29,30
Buczki, Czarnkowo, Drzonowo Białogardzkie, Dzięciołowo, Giżałki, Kowalki, Pobądź, Smęcino, Solno, Tyczewo, Warnino, Wełdkowo, Wełdkówko.
Borzysław, Bukowo, Bukówko, Dobrowo, Dobrówko, Modrolas, Podborsko, Retowo, Skarszewice, Słonino, Zaspy Wielkie.
Miejscowość rodzaj odpadu styczeń luty marzec kwiecień maj czerwiec lipiec sierpień wrzesień październik listopad grudzień
zmieszane 12,26 09,23 09,23 04,20 04,18 01,15,29 13,27 10,24 07,14,21 05,19 02,16,30 14,28
bio 12,26 09,23 09,23 03,20 04,18 01,15,29 13,27 10,24 07,21 15,19 02,16,30 14,28
papier i tektura 29 26 26 23 21 18 16 13 10 08 05 03,30
tworzywa sztuczne 28 25 25 22 20 17 15 12 09 07 04 02,30
szkło 30 27 27 24 22 19 17 13 11 09 06 04
mycie 14,15
wielkogabaryty 14,15,16
Tychowo, Dobrochy.
Miejscowość rodzaj odpadu styczeń luty marzec kwiecień maj czerwiec lipiec sierpień wrzesień październik listopad grudzień
zmieszane 12,26 09,23 09,23 04,20 04,18 01,15,29 13,27 10,24 07,16,21 05,19 02,16,30 14,28
bio 12,26 09,23 09,23 03,20 04,18 01,15,29 13,27 10,24 07,21 05,19 02,16,30 14,28
papier i tektura 29 26 26 23 21 18 16 13 10 08 05 03,30
tworzywa sztuczne 28 25 25 22 20 17 15 12 09 07 04 02,30
szkło 30 27 27 24 22 19 17 13 11 09 06 04
mycie 16
wielkogabaryty 14,15,16
Doble, Kikowo, Krosinko, Liśnica, Motarzyn, Nowe Dębno, Osówko, Rudno, Sadkowo, Sławomierz, Stare Dębno, Trzebiszyn, Trzebiec, Wicewo, Żukówek
Tychowo (tylko wspólnoty mieszkaniowe z powołanym zarządem)
`;

function referenceContext(): MunicipalCollectionReferenceContext {
  return {
    municipality: {
      terc: '3201043',
      name: 'Tychowo',
      municipalityType: 'URBAN_RURAL',
    },
    localities: SAFE_REFERENCE_LOCALITIES.map((name, index) => ({
      name,
      simc: String(3000000 + index).padStart(7, '0'),
    })),
  };
}

function input(sourceKey = 'tychowo-collection-standard-2026'): PdfTextArtifactInput {
  return {
    text: STANDARD_TEXT,
    sourceKey,
    url: 'https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2151/pliki/zmianaharmonogram_tychowo_20261.pdf',
    sha256: sha256Hex(Buffer.from(STANDARD_TEXT)),
    retrievedAt: '2026-08-28T16:00:00.000Z',
    storageUri: 's3://test/tychowo-standard',
    ownerType: 'MUNICIPALITY',
  };
}

describe('MunicipalCollectionPdfTextAdapter', () => {
  it('publishes only Tychowo locality groups without hard-to-reach or city ambiguity', async () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(referenceContext());
    const dataset = adapter.parse(input());

    expect(dataset.municipality).toEqual({
      terc: '3201043',
      name: 'Tychowo',
      municipalityType: 'URBAN_RURAL',
    });
    expect(dataset.serviceAreas).toHaveLength(3);
    expect(dataset.serviceAreas.flatMap((area) => area.coverage)).toHaveLength(SAFE_REFERENCE_LOCALITIES.length);
    expect(dataset.serviceAreas.flatMap((area) => area.coverage).some((rule) => rule.type === 'LOCALITY')).toBe(true);
    expect(dataset.serviceAreas.some((area) => area.name.includes('Tychowo ('))).toBe(false);

    const fractions = new Set(dataset.collectionEvents.map((entry) => entry.fraction));
    expect(fractions).toEqual(new Set(['MIXED', 'BIO', 'PAPER', 'GLASS', 'OTHER']));
    expect(fractions.has('METALS_PLASTICS')).toBe(false);
    expect(dataset.collectionEvents).toContainEqual(
      expect.objectContaining({
        serviceAreaKey: 'tychowo-standard-east',
        fraction: 'MIXED',
        date: '2026-09-16',
      }),
    );
    expect(dataset.collectionEvents).toContainEqual(
      expect.objectContaining({
        fraction: 'OTHER',
        note: 'Źródło: tworzywa sztuczne',
      }),
    );
    expect(dataset.collectionEvents).toContainEqual(
      expect.objectContaining({
        serviceAreaKey: 'tychowo-standard-north-west',
        quality: expect.objectContaining({
          warnings: expect.arrayContaining([
            'SOURCE_LOCALITY_ALIAS: Pobądź -> official TERYT Pobądz',
          ]),
        }),
      }),
    );
    expect(dataset.sources[0]).toMatchObject({
      ownerType: 'MUNICIPALITY',
      artifact: {
        parserKey: 'municipal-collection-pdf-text',
        parserVersion: '0.1.1',
      },
    });
    await expect(validateWastePlDataset(dataset)).resolves.toBeUndefined();
  });

  it('fails when a source-backed locality cannot resolve uniquely to TERYT', () => {
    const context = referenceContext();
    context.localities = context.localities.filter((entry) => entry.name !== 'Buczki');
    const adapter = new MunicipalCollectionPdfTextAdapter(context);

    expect(() => adapter.parse(input())).toThrowError(PdfTextParseError);
    try {
      adapter.parse(input());
    } catch (error) {
      expect((error as PdfTextParseError).code).toBe('MISSING_METADATA');
      expect((error as Error).message).toContain('Buczki');
    }
  });

  it('requires the explicit official alias target instead of fuzzy matching the source typo', () => {
    const context = referenceContext();
    context.localities = context.localities.filter((entry) => entry.name !== 'Pobądz');
    context.localities.push({ name: 'Pobądź Mała', simc: '3999999' });
    const adapter = new MunicipalCollectionPdfTextAdapter(context);

    expect(() => adapter.parse(input())).toThrowError(PdfTextParseError);
    try {
      adapter.parse(input());
    } catch (error) {
      expect((error as PdfTextParseError).code).toBe('MISSING_METADATA');
      expect((error as Error).message).toContain('Pobądź');
    }
  });

  it('keeps the hard-to-reach child explicitly non-publishable until address coverage is complete', () => {
    const adapter = new MunicipalCollectionPdfTextAdapter(referenceContext());
    expect(() => adapter.parse(input('tychowo-collection-difficult-2026'))).toThrowError(PdfTextParseError);
    try {
      adapter.parse(input('tychowo-collection-difficult-2026'));
    } catch (error) {
      expect((error as PdfTextParseError).code).toBe('MISSING_METADATA');
    }
  });
});
