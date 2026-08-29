import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../ingestion/hash.js';
import { validateFacilityV02 } from '../../normalization/validate-facility-v02.js';
import { MunicipalPszokHtmlAdapter } from './municipal-pszok-adapter.js';

const boboliceHtml = readFileSync(
  new URL('../../../test/fixtures/bobolice-pszok.html', import.meta.url),
  'utf8',
);
const swieszynoHtml = readFileSync(
  new URL('../../../test/fixtures/swieszyno-pszok.html', import.meta.url),
  'utf8',
);
const sianowHtml = readFileSync(
  new URL('../../../test/fixtures/sianow-pszok.html', import.meta.url),
  'utf8',
);
const tychowoHtml = readFileSync(
  new URL('../../../test/fixtures/tychowo-pszok.html', import.meta.url),
  'utf8',
);

function artifact(html: string, sourceKey: string, url: string) {
  return {
    html,
    sourceKey,
    url,
    sha256: sha256Hex(Buffer.from(html)),
    retrievedAt: '2026-08-29T11:47:09.000Z',
    storageUri: `fixture://${sourceKey}.html`,
  };
}

describe('MunicipalPszokHtmlAdapter', () => {
  it('normalizes Bobolice PSZOK without inventing geometry', async () => {
    const adapter = new MunicipalPszokHtmlAdapter();
    const facility = adapter.parse(artifact(
      boboliceHtml,
      'bobolice-pszok',
      'https://bobolice.pl/cms/8587',
    ));

    await expect(validateFacilityV02(facility)).resolves.toBeUndefined();
    expect(facility).toMatchObject({
      key: 'pl-3209033-pszok-boboliczki',
      kind: 'PSZOK',
      location: null,
      locationSourceKey: null,
      access: {
        scope: 'MUNICIPALITY_PROPERTY_OWNERS',
        requiresProof: null,
        sourceKey: 'bobolice-pszok',
      },
      quality: {
        verificationStatus: 'OFFICIAL_SOURCE',
        confidence: 0.97,
        warnings: ['TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE'],
      },
    });
    expect(facility.acceptedMaterials).toEqual([
      'BULKY',
      'ELECTRONICS',
      'TEXTILES',
      'TYRES',
      'MEDICINES',
      'BATTERIES',
      'CONSTRUCTION',
      'HAZARDOUS',
    ]);
    expect(facility.openingHours.weekly.find((day) => day.day === 'MONDAY')?.intervals)
      .toEqual([{ opens: '10:30', closes: '16:30' }]);
    expect(facility.openingHours.weekly.find((day) => day.day === 'SATURDAY')?.intervals)
      .toEqual([{ opens: '08:30', closes: '14:30' }]);
  });

  it('normalizes only source-backed Świeszyno material claims', async () => {
    const adapter = new MunicipalPszokHtmlAdapter();
    const facility = adapter.parse(artifact(
      swieszynoHtml,
      'swieszyno-pszok',
      'https://swieszyno.pl/punkt-selektywnej-zbiorki-odpadow-komunalnych-pszok/',
    ));

    await expect(validateFacilityV02(facility)).resolves.toBeUndefined();
    expect(facility).toMatchObject({
      key: 'pl-3209082-pszok-chalupy-13b',
      address: 'Chałupy 13B, gmina Świeszyno',
      location: null,
      acceptedMaterials: ['CONSTRUCTION'],
      operatorName: 'EKOSAN Sp. z o.o.',
      access: {
        scope: 'MUNICIPALITY_RESIDENTS',
        requiresProof: null,
      },
      quality: {
        verificationStatus: 'OFFICIAL_SOURCE',
        confidence: 0.96,
        warnings: [
          'TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE',
          'ACCEPTED_MATERIALS_PARTIAL_SOURCE_SUMMARY',
        ],
      },
    });
    expect(facility.openingHours.weekly.find((day) => day.day === 'MONDAY')?.intervals)
      .toEqual([{ opens: '09:00', closes: '17:00' }]);
    expect(facility.openingHours.weekly.find((day) => day.day === 'FRIDAY')?.intervals)
      .toEqual([{ opens: '08:00', closes: '16:00' }]);
  });

  it('normalizes Sianów PSZOK with source-backed proof requirement and canonical material subset', async () => {
    const adapter = new MunicipalPszokHtmlAdapter();
    const facility = adapter.parse(artifact(
      sianowHtml,
      'sianow-pszok',
      'https://sianow.pl/dla-mieszkanca/odpady-komunalne/nieruchomosci-zamieszkale/punkt-selektywnej-zbiorki-odpadow-komunalnych/',
    ));

    await expect(validateFacilityV02(facility)).resolves.toBeUndefined();
    expect(facility).toMatchObject({
      key: 'pl-3209073-pszok-sianow-lubuszan-80',
      address: 'ul. Łubuszan 80, Sianów',
      location: null,
      operatorName: 'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie',
      access: {
        scope: 'MUNICIPALITY_RESIDENTS',
        requiresProof: true,
        sourceKey: 'sianow-pszok',
      },
      quality: {
        verificationStatus: 'OFFICIAL_SOURCE',
        confidence: 0.98,
        warnings: [
          'TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE',
          'ACCEPTED_MATERIALS_CANONICAL_SUBSET_OF_SOURCE_CATALOGUE',
        ],
      },
    });
    expect(facility.acceptedMaterials).toEqual([
      'BULKY',
      'ELECTRONICS',
      'TYRES',
      'GREEN',
      'CONSTRUCTION',
      'MEDICINES',
      'BATTERIES',
      'HAZARDOUS',
      'TEXTILES',
    ]);
    expect(facility.openingHours.weekly.find((day) => day.day === 'MONDAY')?.intervals)
      .toEqual([{ opens: '08:00', closes: '16:00' }]);
    expect(facility.openingHours.weekly.find((day) => day.day === 'THURSDAY')?.intervals)
      .toEqual([{ opens: '08:00', closes: '16:00' }]);
    expect(facility.openingHours.weekly.find((day) => day.day === 'SATURDAY')?.intervals)
      .toEqual([{ opens: '08:00', closes: '14:00' }]);
  });

  it('normalizes Tychowo PSZOK from the single official BIP HTML without leaking PDF-only claims', async () => {
    const adapter = new MunicipalPszokHtmlAdapter();
    const facility = adapter.parse(artifact(
      tychowoHtml,
      'tychowo-pszok',
      'https://bip.tychowo.pl/artykul/646/9305/oplata-za-gospodarowanie-odpadami-komunalnymi',
    ));

    await expect(validateFacilityV02(facility)).resolves.toBeUndefined();
    expect(facility).toMatchObject({
      key: 'pl-3201043-pszok-tychowo-dolna-8',
      name: 'PSZOK Tychowo, ul. Dolna 8',
      address: 'ul. Dolna 8, Tychowo',
      location: null,
      operatorName: null,
      access: {
        scope: 'UNKNOWN',
        requiresProof: null,
        quantityLimits: [],
        sourceKey: null,
      },
      quality: {
        verificationStatus: 'OFFICIAL_SOURCE',
        confidence: 0.97,
        warnings: [
          'TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE',
          'ACCEPTED_MATERIALS_CANONICAL_SUBSET_OF_SOURCE_CATALOGUE',
          'ACCESS_RULES_NOT_PUBLISHED_IN_PRIMARY_SOURCE',
        ],
      },
    });
    expect(facility.acceptedMaterials).toEqual([
      'PAPER',
      'GLASS',
      'BIO',
      'BATTERIES',
      'ELECTRONICS',
      'BULKY',
      'TYRES',
      'CONSTRUCTION',
    ]);
    expect(facility.openingHours.weekly.find((day) => day.day === 'TUESDAY')?.intervals)
      .toEqual([{ opens: '08:00', closes: '14:30' }]);
    expect(facility.openingHours.weekly.find((day) => day.day === 'THURSDAY')?.intervals)
      .toEqual([{ opens: '08:00', closes: '14:30' }]);
    expect(facility.openingHours.weekly.find((day) => day.day === 'SATURDAY')?.intervals)
      .toEqual([{ opens: '08:00', closes: '14:30' }]);
  });

  it('rejects an unregistered municipality profile even when HTML resembles PSZOK content', () => {
    const adapter = new MunicipalPszokHtmlAdapter();
    expect(() => adapter.parse(artifact(
      boboliceHtml,
      'unknown-pszok',
      'https://example.test/pszok',
    ))).toThrow('unsupported source key unknown-pszok');
  });

  it('fails visibly when a required Bobolice opening-hour assertion disappears', () => {
    const adapter = new MunicipalPszokHtmlAdapter();
    const broken = boboliceHtml.replace('Środa: 10:30 – 16:30', 'Środa: informacja niedostępna');
    expect(() => adapter.parse(artifact(
      broken,
      'bobolice-pszok',
      'https://bobolice.pl/cms/8587',
    ))).toThrow('Wednesday opening hours missing');
  });

  it('fails visibly when the Świeszyno access assertion disappears', () => {
    const adapter = new MunicipalPszokHtmlAdapter();
    const broken = swieszynoHtml.replace('wszyscy mieszkańcy naszej Gminy', 'uprawnieni użytkownicy');
    expect(() => adapter.parse(artifact(
      broken,
      'swieszyno-pszok',
      'https://swieszyno.pl/punkt-selektywnej-zbiorki-odpadow-komunalnych-pszok/',
    ))).toThrow('resident access statement missing');
  });

  it('fails visibly when Sianów proof-of-payment semantics disappear', () => {
    const adapter = new MunicipalPszokHtmlAdapter();
    const broken = sianowHtml.replace(
      'okazać potwierdzenie wniesienia opłaty',
      'posiadać nieokreślone uprawnienie',
    );
    expect(() => adapter.parse(artifact(
      broken,
      'sianow-pszok',
      'https://sianow.pl/dla-mieszkanca/odpady-komunalne/nieruchomosci-zamieszkale/punkt-selektywnej-zbiorki-odpadow-komunalnych/',
    ))).toThrow('proof-of-payment requirement missing');
  });

  it('fails visibly when the Tychowo PSZOK hours drift', () => {
    const adapter = new MunicipalPszokHtmlAdapter();
    const broken = tychowoHtml.replace(
      'Wtorek, czwartek, sobota - 8:00 - 14:30',
      'Wtorek, czwartek, sobota - godziny zmienione',
    );
    expect(() => adapter.parse(artifact(
      broken,
      'tychowo-pszok',
      'https://bip.tychowo.pl/artykul/646/9305/oplata-za-gospodarowanie-odpadami-komunalnymi',
    ))).toThrow('Tuesday/Thursday/Saturday opening hours missing');
  });
});
