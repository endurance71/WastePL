import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../ingestion/hash.js';
import { validateFacilityV02 } from '../../normalization/validate-facility-v02.js';
import { PgkKoszalinPszokHtmlAdapter } from './pgk-koszalin-pszok-adapter.js';

const mainHtml = readFileSync(
  new URL('../../../test/fixtures/pgk-koszalin-pszok-main.html', import.meta.url),
  'utf8',
);
const faqHtml = readFileSync(
  new URL('../../../test/fixtures/pgk-koszalin-pszok-faq.html', import.meta.url),
  'utf8',
);

function input() {
  return {
    main: {
      html: mainHtml,
      sourceKey: 'pgk-koszalin-pszok-main',
      url: 'https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-koszalin/',
      sha256: sha256Hex(Buffer.from(mainHtml)),
      retrievedAt: '2026-08-27T17:40:00Z',
      storageUri: 'fixture://pgk-koszalin-pszok-main.html',
    },
    faq: {
      html: faqHtml,
      sourceKey: 'pgk-koszalin-pszok-faq',
      url: 'https://www.pgkkoszalin.pl/najczesciej-zadawane-pytania-f-a-q/',
      sha256: sha256Hex(Buffer.from(faqHtml)),
      retrievedAt: '2026-08-27T17:41:00Z',
      storageUri: 'fixture://pgk-koszalin-pszok-faq.html',
    },
  };
}

describe('PgkKoszalinPszokHtmlAdapter', () => {
  it('normalizes Komunalna 5 from two official source assertions', async () => {
    const adapter = new PgkKoszalinPszokHtmlAdapter();
    const facility = adapter.parse(input());

    await expect(validateFacilityV02(facility)).resolves.toBeUndefined();
    expect(adapter.parserKey).toBe('pgk-koszalin-pszok-html');
    expect(adapter.parserVersion).toBe('1.0.0');
    expect(facility).toMatchObject({
      schemaVersion: '0.2.0',
      key: 'pl-3261011-pszok-komunalna-5',
      kind: 'PSZOK',
      address: 'ul. Komunalna 5, Koszalin',
      location: { lat: 54.212266, lon: 16.183616 },
      locationSourceKey: 'pgk-koszalin-pszok-main',
      operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
    });

    expect(facility.acceptedMaterials).toEqual(
      expect.arrayContaining([
        'PAPER', 'GLASS', 'METALS_PLASTICS', 'BIO', 'BULKY', 'TEXTILES',
        'ELECTRONICS', 'BATTERIES', 'MEDICINES', 'TYRES', 'CONSTRUCTION',
        'RUBBLE', 'HAZARDOUS',
      ]),
    );
    expect(facility.openingHours.weekly.find((item) => item.day === 'WEDNESDAY')?.intervals)
      .toEqual([{ opens: '10:00', closes: '18:00' }]);
    expect(facility.access).toMatchObject({
      scope: 'MUNICIPALITY_RESIDENTS',
      requiresProof: true,
    });
    expect(facility.access.quantityLimits).toEqual([
      {
        material: 'TYRES',
        limit: '8 sztuk na gospodarstwo domowe',
        period: 'YEAR',
        sourceKey: 'pgk-koszalin-pszok-faq',
      },
      {
        material: 'CONSTRUCTION',
        limit: '100 kg łącznie na gospodarstwo domowe',
        period: 'YEAR',
        sourceKey: 'pgk-koszalin-pszok-faq',
      },
    ]);
  });

  it('fails visibly when an official limit disappears from the expected template', () => {
    const adapter = new PgkKoszalinPszokHtmlAdapter();
    const broken = input();
    broken.faq.html = broken.faq.html.replace('100 kg rocznie', 'limit nieopublikowany');
    expect(() => adapter.parse(broken)).toThrow('construction limit missing');
  });
});
