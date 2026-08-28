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

function artifact(html: string, sourceKey: string, url: string) {
  return {
    html,
    sourceKey,
    url,
    sha256: sha256Hex(Buffer.from(html)),
    retrievedAt: '2026-08-28T10:30:00.000Z',
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
});
