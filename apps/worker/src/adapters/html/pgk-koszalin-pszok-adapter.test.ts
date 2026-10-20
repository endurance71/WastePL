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
    expect(adapter.parserVersion).toBe('1.2.0');
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
    expect(facility.openingHours).toEqual({
      timezone: 'Europe/Warsaw',
      weekly: [
        { day: 'MONDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
        { day: 'TUESDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
        { day: 'WEDNESDAY', intervals: [{ opens: '08:00', closes: '18:00' }] },
        { day: 'THURSDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
        { day: 'FRIDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
        { day: 'SATURDAY', intervals: [{ opens: '08:00', closes: '13:00' }] },
        { day: 'SUNDAY', intervals: [] },
      ],
      exceptions: [],
      sourceKey: 'pgk-koszalin-pszok-main',
    });
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

  it('returns the second official PSZOK as review-required without inventing coordinates', async () => {
    const adapter = new PgkKoszalinPszokHtmlAdapter();
    const facilities = adapter.parseAll(input());

    expect(facilities).toHaveLength(2);
    for (const facility of facilities) {
      await expect(validateFacilityV02(facility)).resolves.toBeUndefined();
    }

    expect(facilities[1]).toMatchObject({
      key: 'pl-3261011-pszok-na-skwierzynke-2',
      kind: 'PSZOK',
      address: 'ul. Na Skwierzynkę 2, Koszalin',
      location: null,
      locationSourceKey: null,
      acceptedMaterials: [],
      quality: {
        verificationStatus: 'REVIEW_REQUIRED',
        confidence: 0.8,
        warnings: ['TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE'],
      },
    });
  });

  it('takes opening hours from the main page even when the FAQ still publishes older hours', () => {
    // ADR-0007: the main page owns opening-hours claims; the FAQ owns materials and limits.
    expect(faqHtml).toContain('Środa: 10:00 – 18:00');
    const adapter = new PgkKoszalinPszokHtmlAdapter();

    for (const facility of adapter.parseAll(input())) {
      expect(facility.openingHours.sourceKey).toBe('pgk-koszalin-pszok-main');
      expect(facility.openingHours.weekly.find((item) => item.day === 'WEDNESDAY')?.intervals)
        .toEqual([{ opens: '08:00', closes: '18:00' }]);
    }
  });

  it('follows the hours the main page publishes instead of fixed values', () => {
    const adapter = new PgkKoszalinPszokHtmlAdapter();
    const changed = input();
    changed.main.html = `<p>Środa: 10.00 – 19.30</p>${changed.main.html.replace(/Środa:/g, 'Inne:')}`;

    const facility = adapter.parse(changed);
    expect(facility.openingHours.weekly.find((item) => item.day === 'WEDNESDAY')?.intervals)
      .toEqual([{ opens: '10:00', closes: '19:30' }]);
  });

  it('fails visibly when the Wednesday hours disappear or become implausible', () => {
    const adapter = new PgkKoszalinPszokHtmlAdapter();
    const missing = input();
    missing.main.html = missing.main.html.replace(/Środa:/g, 'Inne:');
    expect(() => adapter.parse(missing)).toThrow('Wednesday hours missing');

    const reversed = input();
    reversed.main.html = `<p>Środa: 18:00 – 8:00</p>${reversed.main.html}`;
    expect(() => adapter.parse(reversed)).toThrow('Wednesday hours missing');
  });

  it('fails visibly when an official limit disappears from the expected template', () => {
    const adapter = new PgkKoszalinPszokHtmlAdapter();
    const broken = input();
    broken.faq.html = broken.faq.html.replaceAll('100 kg rocznie', 'limit nieopublikowany');
    expect(() => adapter.parse(broken)).toThrow('construction limit missing');
  });

  it('normalizes Komunalna 5 with location: null when coordinates are not published in main HTML', async () => {
    const adapter = new PgkKoszalinPszokHtmlAdapter();
    const noCoords = input();
    noCoords.main.html = noCoords.main.html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
    expect(noCoords.main.html).not.toContain('54.212266');
    const facility = adapter.parse(noCoords);

    await expect(validateFacilityV02(facility)).resolves.toBeUndefined();
    expect(facility.location).toBeNull();
    expect(facility.locationSourceKey).toBeNull();
    expect(facility.quality.warnings).toContain('TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE');
  });
});
