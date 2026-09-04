import type { Page } from '@playwright/test';

export const mockAddressDworek = {
  id: 'addr-bedzino-dworek-1',
  prgId: '320901_2.0004.1',
  canonicalText: 'Dworek 1, 76-037 Dworek',
  municipality: {
    id: 'muni-bedzino',
    terc: '3209012',
    name: 'Będzino',
  },
};

export const mockAddressTychowo = {
  id: 'addr-tychowo-1',
  prgId: '320104_4.0001.1',
  canonicalText: 'Tychowo 1, 78-220 Tychowo',
  municipality: {
    id: 'muni-tychowo',
    terc: '3201043',
    name: 'Tychowo',
  },
};

export const mockAddressSearchResults = {
  query: 'Dworek',
  items: [
    {
      address: mockAddressDworek,
      score: 1.0,
    },
    {
      address: {
        id: 'addr-bedzino-dworek-2',
        prgId: '320901_2.0004.2',
        canonicalText: 'Dworek 2, 76-037 Dworek',
        municipality: {
          id: 'muni-bedzino',
          terc: '3209012',
          name: 'Będzino',
        },
      },
      score: 0.95,
    },
  ],
};

export const mockScheduleResponse = {
  address: mockAddressDworek,
  municipality: mockAddressDworek.municipality,
  serviceArea: {
    id: 'sa-bedzino-trasa-1',
    name: 'Będzino – Trasa 1 (Zabudowa jednorodzinna)',
  },
  events: [
    {
      date: '2026-09-15',
      fraction: 'METALS_PLASTICS',
      status: 'SCHEDULED',
    },
    {
      date: '2026-09-18',
      fraction: 'PAPER',
      status: 'SCHEDULED',
    },
    {
      date: '2026-09-22',
      fraction: 'BIO',
      status: 'SCHEDULED',
    },
    {
      date: '2026-09-25',
      fraction: 'GLASS',
      status: 'SCHEDULED',
    },
    {
      date: '2026-09-29',
      fraction: 'RESIDUAL',
      status: 'SCHEDULED',
    },
  ],
  source: {
    url: 'https://bip.bedzino.pl/odpady/trasa-1.pdf',
    format: 'PDF_TEXT',
    artifactId: 'art-bedzino-123',
    sha256: 'abc123def456',
    parserKey: 'municipal-collection-pdf-text',
    parserVersion: '1.0.0',
  },
  quality: {
    verificationStatus: 'OFFICIAL_SOURCE',
    confidence: 1.0,
    retrievedAt: '2026-09-03T18:00:00Z',
  },
};

export const mockFacilitiesResponse = {
  items: [
    {
      id: 'f-bedzino',
      canonicalKey: 'pl-3209012-pszok-bedzino-17',
      kind: 'PSZOK',
      name: 'PSZOK Będzino, Będzino 17',
      address: 'Będzino 17, 76-037 Będzino',
      location: null, // Test enrichment via trusted PRG resolver!
      openingHours: {
        timezone: 'Europe/Warsaw',
        weekly: [
          { day: 'TUESDAY', intervals: [{ opens: '10:00', closes: '16:00' }] },
          { day: 'THURSDAY', intervals: [{ opens: '12:00', closes: '18:00' }] },
          { day: 'SATURDAY', intervals: [{ opens: '08:00', closes: '14:00' }] },
        ],
        exceptions: [],
      },
      access: {
        scope: 'RESIDENTS_ONLY',
        requiresProof: true,
        notes: ['Wymagane okazanie dowodu opłaty śmieciowej.'],
      },
      acceptedMaterials: [
        'Papier',
        'Szkło',
        'Metale i tworzywa',
        'Bioodpady',
        'Odpady wielkogabarytowe',
        'Elektroodpady',
        'Baterie i akumulatory',
        'Opony',
      ],
      operatorName: 'Gospodarka Komunalna Będzino',
      rulesUrl: 'https://bip.bedzino.pl/pszok',
      quality: {
        verificationStatus: 'OFFICIAL_SOURCE',
        confidence: 0.98,
        warnings: ['TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE'],
      },
    },
  ],
};

export async function setupStandardApiMocks(page: Page) {
  // Mock address search
  await page.route(/\/v1\/addresses\/resolve/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAddressSearchResults),
    });
  });

  // Mock collection schedule
  await page.route(/\/v1\/collection/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockScheduleResponse),
    });
  });

  // Mock facilities
  await page.route(/\/v1\/facilities/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockFacilitiesResponse),
    });
  });
}
