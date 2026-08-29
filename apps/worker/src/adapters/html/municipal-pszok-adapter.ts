import type { FacilityMaterial } from '@wastepl/domain';
import type { HtmlArtifactInput, NormalizedFacilityV02 } from './pgk-koszalin-pszok-adapter.js';

const BOBOLICE_SOURCE_KEY = 'bobolice-pszok';
const SWIESZYNO_SOURCE_KEY = 'swieszyno-pszok';
const SIANOW_SOURCE_KEY = 'sianow-pszok';
const TYCHOWO_SOURCE_KEY = 'tychowo-pszok';

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

function sianowMaterials(text: string): FacilityMaterial[] {
  const required: Array<[FacilityMaterial, RegExp]> = [
    ['BULKY', /meble i inne odpady wielkogabarytowe/i],
    ['ELECTRONICS', /sprzęt elektryczny i elektroniczny/i],
    ['TYRES', /zużyte opony/i],
    ['GREEN', /odpady zielone/i],
    ['CONSTRUCTION', /budowlane i rozbiórkowe/i],
    ['MEDICINES', /przeterminowane leki/i],
    ['BATTERIES', /baterie i akumulatory/i],
    ['HAZARDOUS', /farb.*lakier.*klej|rozpuszczalnik|środki ochrony roślin/i],
    ['TEXTILES', /odzież i tekstylia/i],
  ];

  for (const [, pattern] of required) {
    requireText(text, pattern, SIANOW_SOURCE_KEY, 'published accepted-material catalogue changed');
  }
  return required.map(([material]) => material);
}

function tychowoMaterials(text: string): FacilityMaterial[] {
  const required: Array<[FacilityMaterial, RegExp]> = [
    ['PAPER', /Rodzaje odpadów.*papier/i],
    ['GLASS', /Rodzaje odpadów.*szkło/i],
    ['BIO', /Rodzaje odpadów.*odpady ulegające biodegradacji/i],
    ['BATTERIES', /Rodzaje odpadów.*baterie i akumulatory/i],
    ['ELECTRONICS', /Rodzaje odpadów.*sprzęt elektryczny i elektroniczny/i],
    ['BULKY', /Rodzaje odpadów.*meble i inne odpady wielkogabarytowe/i],
    ['TYRES', /Rodzaje odpadów.*zużyte opony/i],
    ['CONSTRUCTION', /Rodzaje odpadów.*budowlane i rozbiórkowe/i],
  ];

  for (const [, pattern] of required) {
    requireText(text, pattern, TYCHOWO_SOURCE_KEY, 'published accepted-material catalogue changed');
  }
  return required.map(([material]) => material);
}

function parseBobolice(input: HtmlArtifactInput, text: string): NormalizedFacilityV02 {
  requireText(text, /PSZOK.*Boboliczk/i, input.sourceKey, 'Boboliczki location statement missing');
  requireText(text, /nieczynnego (?:wysypiska|składowiska).*Boboliczk/i, input.sourceKey, 'landfill-adjacent location statement missing');
  requireText(text, /Poniedziałek\s*:?\s*10[:.]30\s*[–—-]\s*16[:.]30/i, input.sourceKey, 'Monday opening hours missing');
  requireText(text, /Środa\s*:?\s*10[:.]30\s*[–—-]\s*16[:.]30/i, input.sourceKey, 'Wednesday opening hours missing');
  requireText(text, /Sobota\s*:?\s*8[:.]30\s*[–—-]\s*14[:.]30/i, input.sourceKey, 'Saturday opening hours missing');
  requireText(text, /właściciel(?:e|i).*nieruchomości zamieszkałych/i, input.sourceKey, 'access scope statement missing');

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

function parseSianow(input: HtmlArtifactInput, text: string): NormalizedFacilityV02 {
  requireText(text, /Sianow|Sianów/i, input.sourceKey, 'municipality identity missing');
  requireText(text, /(?:ul\.?\s*)?Łubuszan\s*80/i, input.sourceKey, 'Łubuszan 80 location missing');
  requireText(text, /Zakładu Odzysku Odpadów/i, input.sourceKey, 'waste recovery facility location context missing');
  requireText(text, /Przedsiębiorstwo Gospodarki Komunalnej\s*Sp\.?\s*z\s*o\.?\s*o/i, input.sourceKey, 'PGK operator statement missing');
  requireText(text, /poniedziałek.*8[.:]?00\s*[–—-]\s*16[.:]?00/i, input.sourceKey, 'Monday opening hours missing');
  requireText(text, /czwartek.*8[.:]?00\s*[–—-]\s*16[.:]?00/i, input.sourceKey, 'Thursday opening hours missing');
  requireText(text, /sobot.*8[.:]?00\s*[–—-]\s*14[.:]?00/i, input.sourceKey, 'Saturday opening hours missing');
  requireText(text, /Każdy mieszkaniec Gminy i Miasta Sianów/i, input.sourceKey, 'resident access statement missing');
  requireText(text, /okazać potwierdzenie wniesienia opłaty/i, input.sourceKey, 'proof-of-payment requirement missing');

  return {
    schemaVersion: '0.2.0',
    key: 'pl-3209073-pszok-sianow-lubuszan-80',
    kind: 'PSZOK',
    name: 'PSZOK Sianów, ul. Łubuszan 80',
    address: 'ul. Łubuszan 80, Sianów',
    location: null,
    locationSourceKey: null,
    externalIds: [],
    acceptedMaterials: sianowMaterials(text),
    acceptedContainers: [],
    openingHours: openingHours(input.sourceKey, [
      { day: 'MONDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
      { day: 'TUESDAY', intervals: [] },
      { day: 'WEDNESDAY', intervals: [] },
      { day: 'THURSDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
      { day: 'FRIDAY', intervals: [] },
      { day: 'SATURDAY', intervals: [{ opens: '08:00', closes: '14:00' }] },
      { day: 'SUNDAY', intervals: [] },
    ]),
    access: {
      scope: 'MUNICIPALITY_RESIDENTS',
      requiresProof: true,
      quantityLimits: [],
      notes: ['Mieszkaniec oddający odpady musi okazać potwierdzenie wniesienia opłaty za gospodarowanie odpadami komunalnymi na rzecz Gminy Sianów.'],
      sourceKey: input.sourceKey,
    },
    operationalStatus: unknownOperationalStatus(),
    operatorName: 'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie',
    rulesUrl: input.url,
    sourceKey: input.sourceKey,
    quality: {
      verificationStatus: 'OFFICIAL_SOURCE',
      confidence: 0.98,
      retrievedAt: input.retrievedAt,
      warnings: [
        'TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE',
        'ACCEPTED_MATERIALS_CANONICAL_SUBSET_OF_SOURCE_CATALOGUE',
      ],
    },
  };
}

function parseTychowo(input: HtmlArtifactInput, text: string): NormalizedFacilityV02 {
  requireText(text, /Biuletyn Informacji Publicznej Urząd Miejski w Tychowie/i, input.sourceKey, 'official BIP identity missing');
  requireText(text, /PSZOK.*Tychow.*(?:ulicy|ul\.?)\s*Dolnej\s*8/i, input.sourceKey, 'Dolna 8 location missing');
  requireText(text, /Godziny otwarcia Punktu.*Wtorek,\s*czwartek,\s*sobota\s*-?\s*8[:.]00\s*-\s*14[:.]30/i, input.sourceKey, 'Tuesday/Thursday/Saturday opening hours missing');
  requireText(text, /Rodzaje odpadów, które będą odbierane w PSZOK/i, input.sourceKey, 'accepted-material catalogue missing');

  return {
    schemaVersion: '0.2.0',
    key: 'pl-3201043-pszok-tychowo-dolna-8',
    kind: 'PSZOK',
    name: 'PSZOK Tychowo, ul. Dolna 8',
    address: 'ul. Dolna 8, Tychowo',
    location: null,
    locationSourceKey: null,
    externalIds: [],
    acceptedMaterials: tychowoMaterials(text),
    acceptedContainers: [],
    openingHours: openingHours(input.sourceKey, [
      { day: 'MONDAY', intervals: [] },
      { day: 'TUESDAY', intervals: [{ opens: '08:00', closes: '14:30' }] },
      { day: 'WEDNESDAY', intervals: [] },
      { day: 'THURSDAY', intervals: [{ opens: '08:00', closes: '14:30' }] },
      { day: 'FRIDAY', intervals: [] },
      { day: 'SATURDAY', intervals: [{ opens: '08:00', closes: '14:30' }] },
      { day: 'SUNDAY', intervals: [] },
    ]),
    access: {
      scope: 'UNKNOWN',
      requiresProof: null,
      quantityLimits: [],
      notes: ['Primary BIP HTML does not state PSZOK eligibility or proof requirements; linked regulation is not used as runtime evidence by this single-artifact profile.'],
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
      warnings: [
        'TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE',
        'ACCEPTED_MATERIALS_CANONICAL_SUBSET_OF_SOURCE_CATALOGUE',
        'ACCESS_RULES_NOT_PUBLISHED_IN_PRIMARY_SOURCE',
      ],
    },
  };
}

export class MunicipalPszokHtmlAdapter {
  readonly parserKey = 'municipal-pszok-html';
  readonly parserVersion = '0.3.0';

  supportsSourceKey(sourceKey: string): boolean {
    return sourceKey === BOBOLICE_SOURCE_KEY
      || sourceKey === SWIESZYNO_SOURCE_KEY
      || sourceKey === SIANOW_SOURCE_KEY
      || sourceKey === TYCHOWO_SOURCE_KEY;
  }

  parse(input: HtmlArtifactInput): NormalizedFacilityV02 {
    const text = textFromHtml(input.html);
    if (input.sourceKey === BOBOLICE_SOURCE_KEY) return parseBobolice(input, text);
    if (input.sourceKey === SWIESZYNO_SOURCE_KEY) return parseSwieszyno(input, text);
    if (input.sourceKey === SIANOW_SOURCE_KEY) return parseSianow(input, text);
    if (input.sourceKey === TYCHOWO_SOURCE_KEY) return parseTychowo(input, text);
    throw new Error(`Municipal PSZOK adapter: unsupported source key ${input.sourceKey}`);
  }
}
