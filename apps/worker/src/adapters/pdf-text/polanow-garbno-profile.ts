import type { WasteFractionCode } from '@wastepl/domain';
import {
  PdfTextParseError,
  type NormalizedCollectionEvent,
  type NormalizedDataset,
  type NormalizedQuality,
  type PdfTextArtifactInput,
} from './types.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

export const POLANOW_GARBNO_H2_SOURCE_KEY = 'polanow-collection-garbno-h2-2026';
export const POLANOW_RURAL_SET_A_H2_SOURCE_KEY = 'polanow-collection-rural-set-a-h2-2026';
export const POLANOW_RURAL_SET_B_H2_SOURCE_KEY = 'polanow-collection-rural-set-b-h2-2026';

export const POLANOW_TERC = '3209063';

export const POLANOW_RURAL_SET_A_LOCALITY_NAMES = [
  'bukowo',
  'dadzewo',
  'domachowo',
  'jacinki',
  'krytno',
  'karsina',
  'karsinka',
  'nacław',
  'nadbór',
  'osetno',
  'powidz',
  'puławy',
  'rekowo',
  'rzyszczewko',
  'sowinko',
  'stołpie',
  'świerczyna',
];

export const POLANOW_RURAL_SET_B_LOCALITY_NAMES = [
  'bożenice',
  'buszyno',
  'doły',
  'komorowo',
  'rochowo',
  'rzeczyca mała',
  'warblewo',
  'wielin',
];
const MONTHS = [
  ['lipiec', 7],
  ['sierpień', 8],
  ['wrzesień', 9],
  ['październik', 10],
  ['listopad', 11],
  ['grudzień', 12],
] as const;

interface ParsedMonthRow {
  monthName: string;
  month: number;
  mixed: number[];
  bio: number[];
  segregated: number[];
  bulky: number[];
}

function normalizedLine(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/,\s+/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pl-PL');
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL');
}

function parseDayList(token: string, line: string): number[] {
  const days = token.split(',').map((value) => Number.parseInt(value, 10));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
    throw new PdfTextParseError(`Invalid Polanów Garbno day list: ${token}`, 'INVALID_ROW', line);
  }
  return days;
}

function isoDate(month: number, day: number): string {
  const date = new Date(Date.UTC(2026, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new PdfTextParseError(`Invalid Polanów Garbno date 2026-${month}-${day}`, 'INVALID_ROW');
  }
  return date.toISOString().slice(0, 10);
}

function extractTableCopies(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map(normalizedLine)
    .filter(Boolean);
  // Do not use JS \b here: ASCII-style word boundaries mis-handle Polish
  // month endings such as "ń". The extracted table always separates the
  // month label from its first date cell with whitespace.
  const monthLinePattern = /^(lipiec|sierpień|wrzesień|październik|listopad|grudzień)(?:\s|$)/i;
  const monthLines = lines.filter((line) => monthLinePattern.test(line));

  if (monthLines.length !== 12) {
    throw new PdfTextParseError(
      `Expected exactly two six-row H2 table copies for Polanów Garbno, got ${monthLines.length} month rows`,
      'UNSUPPORTED_TEMPLATE',
    );
  }

  const first = monthLines.slice(0, 6);
  const second = monthLines.slice(6, 12);
  if (first.some((line, index) => line.toLocaleLowerCase('pl-PL') !== second[index]?.toLocaleLowerCase('pl-PL'))) {
    throw new PdfTextParseError(
      'Duplicated Polanów Garbno PDF tables are not identical',
      'UNSUPPORTED_TEMPLATE',
    );
  }
  return [first, second];
}

function parseRows(text: string): ParsedMonthRow[] {
  const [table] = extractTableCopies(text);
  if (!table) throw new PdfTextParseError('Polanów Garbno table is missing', 'UNSUPPORTED_TEMPLATE');

  return MONTHS.map(([monthName, month], index) => {
    const line = table[index];
    if (!line || !line.toLocaleLowerCase('pl-PL').startsWith(`${monthName} `)) {
      throw new PdfTextParseError(`Missing Polanów Garbno ${monthName} row`, 'UNSUPPORTED_TEMPLATE', line ?? null);
    }
    const payload = line.slice(monthName.length).trim();
    const tokens = payload.match(/\d{1,2}(?:,\d{1,2})*/g) ?? [];
    if (tokens.length !== 3 && tokens.length !== 4) {
      throw new PdfTextParseError(
        `Expected 3 or 4 collection cells for Polanów Garbno ${monthName}, got ${tokens.length}`,
        'UNSUPPORTED_TEMPLATE',
        line,
      );
    }
    return {
      monthName,
      month,
      mixed: parseDayList(tokens[0]!, line),
      bio: parseDayList(tokens[1]!, line),
      segregated: parseDayList(tokens[2]!, line),
      bulky: tokens[3] ? parseDayList(tokens[3], line) : [],
    };
  });
}

function assertTemplate(text: string, subset: 'GARBNO' | 'SET_A' | 'SET_B'): void {
  const normalized = normalizedText(text);
  const requiredMarkers = [
    'harmonogram odbioru odpadów w roku 2026',
    'urząd miejski w polanowie',
    'przedsiębiorstwo gospodarki komunalnej',
    'zmieszane bio segregacja gabaryty',
  ];
  if (subset === 'SET_A') {
    requiredMarkers.push('zabudowa jednorodzinna miejscowości: bukowo, dadzewo');
  } else if (subset === 'SET_B') {
    requiredMarkers.push('zabudowa jednorodzinna miejscowości: bożenice, buszyno');
  } else {
    requiredMarkers.push('zabudowa jednorodzinna miejscowości garbno');
  }
  for (const marker of requiredMarkers) {
    if (!normalized.includes(marker)) {
      throw new PdfTextParseError(`Expected Polanów marker is missing: ${marker}`, 'UNSUPPORTED_TEMPLATE');
    }
  }
}

function quality(input: PdfTextArtifactInput, warnings: string[] = []): NormalizedQuality {
  return {
    verificationStatus: 'OFFICIAL_SOURCE',
    confidence: 0.99,
    retrievedAt: input.retrievedAt,
    warnings,
  };
}

function event(
  input: PdfTextArtifactInput,
  serviceAreaKey: string,
  fraction: WasteFractionCode,
  date: string,
  note: string | null,
  warnings: string[] = [],
): NormalizedCollectionEvent {
  return {
    serviceAreaKey,
    fraction,
    date,
    status: 'SCHEDULED',
    note,
    sourceKey: input.sourceKey,
    quality: quality(input, warnings),
  };
}

export function supportsPolanowGarbnoH2(text: string): boolean {
  const normalized = normalizedText(text);
  return (
    (normalized.includes('zabudowa jednorodzinna miejscowości garbno') ||
      normalized.includes('zabudowa jednorodzinna miejscowości: bukowo, dadzewo') ||
      normalized.includes('zabudowa jednorodzinna miejscowości: bożenice, buszyno')) &&
    normalized.includes('harmonogram odbioru odpadów w roku 2026') &&
    normalized.includes('zmieszane bio segregacja gabaryty')
  );
}

export function parsePolanowGarbnoH2(
  input: PdfTextArtifactInput,
  context: MunicipalCollectionReferenceContext,
  parserKey: string,
  parserVersion: string,
): NormalizedDataset {
  const isSetA = input.sourceKey === POLANOW_RURAL_SET_A_H2_SOURCE_KEY;
  const isSetB = input.sourceKey === POLANOW_RURAL_SET_B_H2_SOURCE_KEY;
  if (input.sourceKey !== POLANOW_GARBNO_H2_SOURCE_KEY && !isSetA && !isSetB) {
    throw new PdfTextParseError(`Unsupported Polanów source ${input.sourceKey}`, 'UNSUPPORTED_TEMPLATE');
  }
  if (context.municipality.terc !== POLANOW_TERC) {
    throw new PdfTextParseError(
      `Polanów profile received unexpected TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
    );
  }
  const subset = isSetA ? 'SET_A' : isSetB ? 'SET_B' : 'GARBNO';
  assertTemplate(input.text, subset);

  const serviceAreaKey = isSetA
    ? 'polanow-rural-set-a-single-family'
    : isSetB
      ? 'polanow-rural-set-b-single-family'
      : 'polanow-garbno-single-family';
  const serviceAreaName = isSetA
    ? 'Gmina Polanów — Rejon wiejski A (17 miejscowości), zabudowa jednorodzinna'
    : isSetB
      ? 'Gmina Polanów — Rejon wiejski B (8 miejscowości), zabudowa jednorodzinna'
      : 'Gmina Polanów — Garbno, zabudowa jednorodzinna';

  let coverage: Array<{ type: 'LOCALITY'; priority: number; simc: string }>;

  if (isSetA) {
    const matched = context.localities.filter((loc) =>
      POLANOW_RURAL_SET_A_LOCALITY_NAMES.includes(normalizedName(loc.name)),
    );
    coverage = matched.map((loc) => ({ type: 'LOCALITY' as const, priority: 50, simc: loc.simc }));
  } else if (isSetB) {
    const matched = context.localities.filter((loc) =>
      POLANOW_RURAL_SET_B_LOCALITY_NAMES.includes(normalizedName(loc.name)),
    );
    coverage = matched.map((loc) => ({ type: 'LOCALITY' as const, priority: 50, simc: loc.simc }));
  } else {
    const garbnoMatches = context.localities.filter((locality) => normalizedName(locality.name) === 'garbno');
    if (garbnoMatches.length !== 1 || !garbnoMatches[0]) {
      throw new PdfTextParseError(
        `Garbno did not resolve uniquely inside TERC ${context.municipality.terc}`,
        'MISSING_METADATA',
        'Garbno',
      );
    }
    coverage = [{ type: 'LOCALITY' as const, priority: 50, simc: garbnoMatches[0].simc }];
  }

  const rows = parseRows(input.text);
  const collectionEvents: NormalizedCollectionEvent[] = [];
  for (const row of rows) {
    for (const day of row.mixed) collectionEvents.push(event(input, serviceAreaKey, 'MIXED', isoDate(row.month, day), null));
    for (const day of row.bio) collectionEvents.push(event(input, serviceAreaKey, 'BIO', isoDate(row.month, day), null));
    for (const day of row.segregated) {
      collectionEvents.push(
        event(
          input,
          serviceAreaKey,
          'OTHER',
          isoDate(row.month, day),
          'Źródło: segregacja',
          ['SOURCE_FRACTION_GENERIC_SEGREGATION_NOT_EXPANDED'],
        ),
      );
    }
    for (const day of row.bulky) collectionEvents.push(event(input, serviceAreaKey, 'BULKY', isoDate(row.month, day), null));
  }

  collectionEvents.sort((a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction));

  return {
    schemaVersion: '0.1.0',
    municipality: context.municipality,
    serviceAreas: [
      {
        key: serviceAreaKey,
        name: serviceAreaName,
        buildingType: 'SINGLE_FAMILY',
        coverage,
      },
    ],
    collectionEvents,
    facilities: [],
    alerts: [],
    sources: [
      {
        sourceKey: input.sourceKey,
        url: input.url,
        ownerType: input.ownerType ?? 'MUNICIPALITY',
        format: 'PDF_TEXT',
        reuseBasis: isSetA
          ? 'Polanów H2 2026 single-family locality PDF template; Rural Set A safe subset'
          : isSetB
            ? 'Polanów H2 2026 single-family locality PDF template; Rural Set B safe subset'
            : 'Polanów H2 2026 single-family locality PDF template; Garbno safe subset',
        artifact: {
          sha256: input.sha256,
          retrievedAt: input.retrievedAt,
          parserKey,
          parserVersion,
          extractionConfidence: 0.99,
          storageUri: input.storageUri,
        },
      },
    ],
  };
}
