import type { FacilityMaterial } from '@wastepl/domain';
import type { HtmlArtifactInput, NormalizedFacilityV02 } from './pgk-koszalin-pszok-adapter.js';

const BOBOLICE_SOURCE_KEY = 'bobolice-pszok';
const SWIESZYNO_SOURCE_KEY = 'swieszyno-pszok';

type Weekly = NonNullable<NormalizedFacilityV02['openingHours']>['weekly'];

function textFromHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function requireText(text: string, pattern: RegExp, sourceKey: string, message: string): void {
  if (!pattern.test(text)) {
    throw new Error(`Municipal PSZOK adapter ${sourceKey}: ${message}`);
  }
}

function openingHours(sourceKey: string, weekly: Weekly): NonNullable<NormalizedFacilityV02['openingHours']> {
  return {
    timezone: 'Europe/Warsaw',
    weekly,
    exceptions: [],
    sourceKey,
  };
}

function unknownOperationalStatus(): NormalizedFacilityV02['operationalStatus'] {
  return {
    state: 'UNKNOWN',
    observedAt: null,
    sourceKey: null,
    note: 'Opublikowane godziny nie są źródłem bieżącego statusu operacyjnego.',
  };
}

function boboliceMaterials(text: string): FacilityMaterial[] {
  const required: Array<[FacilityMaterial, RegExp]> = [
    ['BULKY', /wielkogabarytow/i],
    ['ELECTRONICS', /sprzęt elektrycz|elektrośmieci/i],
    ['TEXTILES', /tekstyl|odzież/i],
    ['TYRES', /opon/i],
    ['MEDICINES', /lek/i],
    ['BATTERIES', /bateri|akumulator/i],
    ['CONSTRUCTION', /rozbiórkow|remont/i],
    ['HAZARDOUS', /niebezpiecz|farb|lakier|rozpuszczal/i],
  ];

  for (const [, pattern] of required) {
    requireText(text, pattern, BOBOLICE_SOURCE_KEY, 'published accepted-material catalogue changed');
  }
  return required.map(([material]) => material);
}

function parseBobolice(input: HtmlArtifactInput, text: string): NormalizedFacilityV02 {
  requireText(text, /PSZOK.*Boboliczk/i, input.sourceKey, 'Boboliczki location statement missing');
  requireText(text, /nieczynnego (?:wysypiska|składowiska).*Boboliczk/i, input.sourceKey, 'landfill-adjacent location statement missing');
  requireText(text, /Poniedziałek\s*:?\s*10[:.]30\s*[–—-]\s*16[:.]30/i, input.sourceKey, 'Monday opening hours missing');
  requireText(text, /Środa\s*:?\s*10[:.]30\s*[–—-]\s*16[:.]30/i, input.sourceKey, 'Wednesday opening hours missing');
  requireText(text, /Sobota\s*:?\s*8[:.]30\s*[–—-]\s*14[:.]30/i, input.sourceKey, 'Saturday opening hours missing');
  requireText(text, /właścicieli nieruchomości zamieszkałych/i, input.sourceKey, 'access scope statement missing');

  return {
    schemaVersion: '0.2.0',
    key: 'pl-3209033-pszok-boboliczki',
    kind: 'PSZOK',
    name: 'PSZOK Boboliczki',
    address: 'Boboliczki, teren przyległy do nieczynnego składowiska odpadów, gmina Bobolice',
    location: null,
    locationSourceKey: null,
    externalIds: [],
    acceptedMaterials: boboliceMaterials(text),
    acceptedContainers: [],
    openingHours: openingHours(input.sourceKey, [
      { day: 'MONDAY', intervals: [{ opens: '10:30', closes: '16:30' }] },
      { day: 'TUESDAY', intervals: [] },
      { day: 'WEDNESDAY', intervals: [{ opens: '10:30', closes: '16:30' }] },
      { day: 'THURSDAY', intervals: [] },
      { day: 'FRIDAY', intervals: [] },
      { day: 'SATURDAY', intervals: [{ opens: '08:30', closes: '14:30' }] },
      { day: 'SUNDAY', intervals: [] },
    ]),
    access: {
      scope: 'MUNICIPALITY_PROPERTY_OWNERS',
      requiresProof: null,
      quantityLimits: [],
      notes: ['Źródło wskazuje właścicieli nieruchomości zamieszkałych; nie publikuje wymogu dokumentu potwierdzającego uprawnienie.'],
      sourceKey: input.sourceKey,
    },
    operationalStatus: unknownOperationalStatus(),
    operatorName: null,
    rulesUrl: input.url,
    sourceKey: input.sourceKey,
    quality: {
      verificationStatus: 'OFFICIAL_SOURCE',
      confidence: 0.97,
      retrievedAt: input.retrievedAt,
      warnings: ['TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE'],
    },
  };
}

function parseSwieszyno(input: HtmlArtifactInput, text: string): NormalizedFacilityV02 {
  requireText(text, /Chałupy\s*(?:nr\s*)?13\s*B/i, input.sourceKey, 'Chałupy 13B location missing');
  requireText(text, /EKOSAN\s*Sp\.?\s*z\s*o\.?\s*o/i, input.sourceKey, 'operator statement missing');
  requireText(text, /wszyscy mieszkańcy naszej Gminy/i, input.sourceKey, 'resident access statement missing');
  requireText(text, /poniedziałek.*9(?:[:.]?00|ºº).*17(?:[:.]?00|ºº)/i, input.sourceKey, 'Monday opening hours missing');
  requireText(text, /wtorku do piątku.*8(?:[:.]?00|ºº).*16(?:[:.]?00|ºº)/i, input.sourceKey, 'Tuesday-Friday opening hours missing');
  requireText(text, /odpady budowlane/i, input.sourceKey, 'published construction-waste example missing');

  return {
    schemaVersion: '0.2.0',
    key: 'pl-3209082-pszok-chalupy-13b',
    kind: 'PSZOK',
    name: 'PSZOK Chałupy 13B',
    address: 'Chałupy 13B, gmina Świeszyno',
    location: null,
    locationSourceKey: null,
    externalIds: [],
    acceptedMaterials: ['CONSTRUCTION'],
    acceptedContainers: [],
    openingHours: openingHours(input.sourceKey, [
      { day: 'MONDAY', intervals: [{ opens: '09:00', closes: '17:00' }] },
      { day: 'TUESDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
      { day: 'WEDNESDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
      { day: 'THURSDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
      { day: 'FRIDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
      { day: 'SATURDAY', intervals: [] },
      { day: 'SUNDAY', intervals: [] },
    ]),
    access: {
      scope: 'MUNICIPALITY_RESIDENTS',
      requiresProof: null,
      quantityLimits: [],
      notes: ['Źródło deklaruje dostęp dla wszystkich mieszkańców gminy; nie publikuje w tej stronie wymogu dokumentu potwierdzającego uprawnienie.'],
      sourceKey: input.sourceKey,
    },
    operationalStatus: unknownOperationalStatus(),
    operatorName: 'EKOSAN Sp. z o.o.',
    rulesUrl: input.url,
    sourceKey: input.sourceKey,
    quality: {
      verificationStatus: 'OFFICIAL_SOURCE',
      confidence: 0.96,
      retrievedAt: input.retrievedAt,
      warnings: [
        'TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE',
        'ACCEPTED_MATERIALS_PARTIAL_SOURCE_SUMMARY',
      ],
    },
  };
}

export class MunicipalPszokHtmlAdapter {
  readonly parserKey = 'municipal-pszok-html';
  readonly parserVersion = '0.1.0';

  supportsSourceKey(sourceKey: string): boolean {
    return sourceKey === BOBOLICE_SOURCE_KEY || sourceKey === SWIESZYNO_SOURCE_KEY;
  }

  parse(input: HtmlArtifactInput): NormalizedFacilityV02 {
    const text = textFromHtml(input.html);
    if (input.sourceKey === BOBOLICE_SOURCE_KEY) return parseBobolice(input, text);
    if (input.sourceKey === SWIESZYNO_SOURCE_KEY) return parseSwieszyno(input, text);
    throw new Error(`Municipal PSZOK adapter: unsupported source key ${input.sourceKey}`);
  }
}
