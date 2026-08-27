import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SourceRegistry } from '../../ingestion/types.js';
import { sha256Hex } from '../../ingestion/hash.js';
import { PgkKoszalinPszokNormalizationService } from './pgk-koszalin-pszok-normalization-service.js';

const mainHtml = readFileSync(new URL('../../../test/fixtures/pgk-koszalin-pszok-main.html', import.meta.url), 'utf8');
const faqHtml = readFileSync(new URL('../../../test/fixtures/pgk-koszalin-pszok-faq.html', import.meta.url), 'utf8');

describe('PgkKoszalinPszokNormalizationService', () => {
  it('links each source artifact to all claims parsed from the bundle', async () => {
    const markArtifactParsed = vi.fn().mockResolvedValue(undefined);
    const registry = { markArtifactParsed } as unknown as SourceRegistry;
    const service = new PgkKoszalinPszokNormalizationService(registry);

    const facilities = await service.normalizeAll({
      main: {
        artifactId: '11111111-1111-1111-1111-111111111111',
        html: mainHtml,
        sourceKey: 'pgk-koszalin-pszok-main',
        url: 'https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-koszalin/',
        sha256: sha256Hex(Buffer.from(mainHtml)),
        retrievedAt: '2026-08-27T17:40:00Z',
        storageUri: 'fixture://main',
      },
      faq: {
        artifactId: '22222222-2222-2222-2222-222222222222',
        html: faqHtml,
        sourceKey: 'pgk-koszalin-pszok-faq',
        url: 'https://www.pgkkoszalin.pl/najczesciej-zadawane-pytania-f-a-q/',
        sha256: sha256Hex(Buffer.from(faqHtml)),
        retrievedAt: '2026-08-27T17:41:00Z',
        storageUri: 'fixture://faq',
      },
    });

    expect(facilities.map((facility) => facility.key)).toEqual([
      'pl-3261011-pszok-komunalna-5',
      'pl-3261011-pszok-na-skwierzynke-2',
    ]);
    expect(markArtifactParsed).toHaveBeenCalledTimes(2);
    expect(markArtifactParsed).toHaveBeenNthCalledWith(1, expect.objectContaining({
      artifactId: '11111111-1111-1111-1111-111111111111',
      parserKey: 'pgk-koszalin-pszok-html',
      parserVersion: '1.1.0',
      status: 'NORMALIZED',
      parseReport: expect.objectContaining({
        facilityKeys: [
          'pl-3261011-pszok-komunalna-5',
          'pl-3261011-pszok-na-skwierzynke-2',
        ],
        assertions: expect.arrayContaining([
          'location',
          'openingHours',
          'accessScope',
          'reviewCandidateWithoutTrustedGeometry',
        ]),
      }),
    }));
    expect(markArtifactParsed).toHaveBeenNthCalledWith(2, expect.objectContaining({
      artifactId: '22222222-2222-2222-2222-222222222222',
      parserVersion: '1.1.0',
      parseReport: expect.objectContaining({
        facilityKeys: ['pl-3261011-pszok-komunalna-5'],
        assertions: expect.arrayContaining(['acceptedMaterials', 'quantityLimits']),
      }),
    }));
  });

  it('keeps normalize() backward-compatible with the publishable primary facility', async () => {
    const registry = { markArtifactParsed: vi.fn().mockResolvedValue(undefined) } as unknown as SourceRegistry;
    const service = new PgkKoszalinPszokNormalizationService(registry);
    const facility = await service.normalize({
      main: {
        artifactId: '11111111-1111-1111-1111-111111111111',
        html: mainHtml,
        sourceKey: 'pgk-koszalin-pszok-main',
        url: 'https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-koszalin/',
        sha256: sha256Hex(Buffer.from(mainHtml)),
        retrievedAt: '2026-08-27T17:40:00Z',
        storageUri: 'fixture://main',
      },
      faq: {
        artifactId: '22222222-2222-2222-2222-222222222222',
        html: faqHtml,
        sourceKey: 'pgk-koszalin-pszok-faq',
        url: 'https://www.pgkkoszalin.pl/najczesciej-zadawane-pytania-f-a-q/',
        sha256: sha256Hex(Buffer.from(faqHtml)),
        retrievedAt: '2026-08-27T17:41:00Z',
        storageUri: 'fixture://faq',
      },
    });

    expect(facility.key).toBe('pl-3261011-pszok-komunalna-5');
  });
});
