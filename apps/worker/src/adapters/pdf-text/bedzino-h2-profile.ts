import type { WasteFractionCode } from '@wastepl/domain';
import {
  PdfTextParseError,
  type NormalizedCollectionEvent,
  type NormalizedDataset,
  type NormalizedQuality,
  type PdfTextArtifactInput,
} from './types.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

export const BEDZINO_TRASA_1_SAFE_H2_SOURCE_KEY = 'bedzino-collection-trasa-1-safe-h2-2026';
export const BEDZINO_TRASA_2_SAFE_H2_SOURCE_KEY = 'bedzino-collection-trasa-2-safe-h2-2026';

export const BEDZINO_TERC = '3209012';

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
  plastics: number[];
  paperGlass: number[];
  bio: number[];
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

function parseDayList(token: string, line: string): number[] {
  const days = token.split(',').map((value) => Number.parseInt(value, 10));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
    throw new PdfTextParseError(`Invalid Będzino day list: ${token}`, 'INVALID_ROW', line);
  }
  return days;
}

function isoDate(month: number, day: number): string {
  const date = new Date(Date.UTC(2026, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new PdfTextParseError(`Invalid Będzino date 2026-${month}-${day}`, 'INVALID_ROW');
  }
  return date.toISOString().slice(0, 10);
}

function parseRows(text: string): ParsedMonthRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(normalizedLine)
    .filter(Boolean);

  const monthLinePattern = /^(lipiec|sierpień|wrzesień|październik|listopad|grudzień)\s+\d/i;
  const monthLines = lines.filter((line) => monthLinePattern.test(line));

  if (monthLines.length !== 6) {
    throw new PdfTextParseError(
      `Expected exactly six H2 month rows for Będzino, got ${monthLines.length}`,
      'UNSUPPORTED_TEMPLATE',
    );
  }

  return monthLines.map((line, index) => {
    const expectedMonth = MONTHS[index];
    if (!expectedMonth) throw new PdfTextParseError(`Unexpected row index ${index}`, 'UNSUPPORTED_TEMPLATE', line);

    const tokens = line.split(' ');
    if (tokens.length !== 5) {
      throw new PdfTextParseError(
        `Expected month and four date cells for Będzino, got: "${line}"`,
        'UNSUPPORTED_TEMPLATE',
        line,
      );
    }

    const [monthName, mixedToken, plasticsToken, paperGlassToken, bioToken] = tokens;
    if (monthName?.toLocaleLowerCase('pl-PL') !== expectedMonth[0]) {
      throw new PdfTextParseError(
        `Expected ${expectedMonth[0]} at row ${index + 1}, got ${monthName}`,
        'UNSUPPORTED_TEMPLATE',
        line,
      );
    }

    return {
      monthName: expectedMonth[0],
      month: expectedMonth[1],
      mixed: parseDayList(mixedToken!, line),
      plastics: parseDayList(plasticsToken!, line),
      paperGlass: parseDayList(paperGlassToken!, line),
      bio: parseDayList(bioToken!, line),
    };
  });
}

function assertTemplate(text: string, isTrasa2: boolean): void {
  const normalized = normalizedText(text);
  if (!normalized.includes('harmonogram odbioru odpadów z terenu gminy będzino')) {
    throw new PdfTextParseError('Missing Będzino municipal schedule header', 'UNSUPPORTED_TEMPLATE');
  }
  if (!normalized.includes('lipiec – grudzień 202')) {
    throw new PdfTextParseError('Missing H2 2026 schedule period marker', 'UNSUPPORTED_TEMPLATE');
  }
  if (isTrasa2) {
    if (!normalized.includes('trasa ii')) {
      throw new PdfTextParseError('Missing H2 2026 Trasa II schedule marker', 'UNSUPPORTED_TEMPLATE');
    }
    if (!normalized.includes('dobiesławiec') || !normalized.includes('barninek')) {
      throw new PdfTextParseError('Missing Trasa II clean localities in locality list', 'UNSUPPORTED_TEMPLATE');
    }
  } else {
    if (!normalized.includes('trasa i')) {
      throw new PdfTextParseError('Missing H2 2026 Trasa I schedule marker', 'UNSUPPORTED_TEMPLATE');
    }
    if (!normalized.includes('dworek') || !normalized.includes('borkowice')) {
      throw new PdfTextParseError('Missing Trasa I clean localities in locality list', 'UNSUPPORTED_TEMPLATE');
    }
  }
  if (!normalized.includes('ekosan sp. z o.o.')) {
    throw new PdfTextParseError('Missing EKOSAN contractor marker', 'UNSUPPORTED_TEMPLATE');
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

export function supportsBedzinoH2(text: string): boolean {
  const normalized = normalizedText(text);
  return (
    normalized.includes('harmonogram odbioru odpadów z terenu gminy będzino') &&
    (normalized.includes('trasa i') || normalized.includes('trasa ii')) &&
    normalized.includes('ekosan') &&
    normalized.includes('lipiec – grudzień')
  );
}

export function parseBedzinoH2(
  input: PdfTextArtifactInput,
  context: MunicipalCollectionReferenceContext,
  parserKey: string,
  parserVersion: string,
): NormalizedDataset {
  const isTrasa1 = input.sourceKey === BEDZINO_TRASA_1_SAFE_H2_SOURCE_KEY;
  const isTrasa2 = input.sourceKey === BEDZINO_TRASA_2_SAFE_H2_SOURCE_KEY;

  if (!isTrasa1 && !isTrasa2) {
    throw new PdfTextParseError(`Unsupported Będzino source ${input.sourceKey}`, 'UNSUPPORTED_TEMPLATE');
  }
  if (context.municipality.terc !== BEDZINO_TERC) {
    throw new PdfTextParseError(
      `Będzino profile received unexpected TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
    );
  }
  assertTemplate(input.text, isTrasa2);

  const TRASA_1_SAFE_LOCALITY_NAMES = [
    'dworek',
    'będzinko',
    'borkowice',
    'kiszkowo',
    'łasin koszaliński',
    'łopienica',
    'miłogoszcz',
    'słowieńkowo',
    'słowienkowo',
    'smolne',
    'strachomino',
    'uliszki',
    'zagaje',
  ];

  const TRASA_2_SAFE_LOCALITY_NAMES = [
    'barninek',
    'dobiesławiec',
    'dobre',
    'dobre małe',
    'kazimierz pomorski',
    'kaziemierz pomorski',
    'łekno',
    'podamirowo',
    'ziębrze',
  ];

  const targetLocalityNames = isTrasa2 ? TRASA_2_SAFE_LOCALITY_NAMES : TRASA_1_SAFE_LOCALITY_NAMES;
  const serviceAreaKey = isTrasa2 ? 'bedzino-trasa-2-safe' : 'bedzino-trasa-1-safe-dworek';
  const serviceAreaName = isTrasa2 ? 'Gmina Będzino — Trasa II (część bezpieczna)' : 'Gmina Będzino — Dworek (Trasa I)';
  const reuseBasis = isTrasa2
    ? 'Będzino H2 2026 EKOSAN Trasa II schedule; 8 verified zero-risk rural localities'
    : 'Będzino H2 2026 EKOSAN Trasa I schedule; Dworek verified safe subset';

  const anchorLocalityName = isTrasa2 ? 'dobiesławiec' : 'dworek';
  const anchorMatches = context.localities.filter(
    (locality) => locality.name.toLocaleLowerCase('pl-PL') === anchorLocalityName,
  );
  if (anchorMatches.length !== 1 || !anchorMatches[0]) {
    throw new PdfTextParseError(
      `${anchorLocalityName} did not resolve uniquely inside TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
      anchorLocalityName,
    );
  }

  const rows = parseRows(input.text);
  const collectionEvents: NormalizedCollectionEvent[] = [];

  for (const row of rows) {
    for (const day of row.mixed) {
      collectionEvents.push(event(input, serviceAreaKey, 'MIXED', isoDate(row.month, day), null));
    }
    for (const day of row.bio) {
      collectionEvents.push(event(input, serviceAreaKey, 'BIO', isoDate(row.month, day), null));
    }
    for (const day of row.plastics) {
      collectionEvents.push(
        event(
          input,
          serviceAreaKey,
          'OTHER',
          isoDate(row.month, day),
          'Źródło: tworzywa sztuczne',
          ['SOURCE_FRACTION_PLASTICS_ONLY_NOT_METALS_PLASTICS'],
        ),
      );
    }
    for (const day of row.paperGlass) {
      collectionEvents.push(
        event(
          input,
          serviceAreaKey,
          'OTHER',
          isoDate(row.month, day),
          'Źródło: papier, szkło',
          ['SOURCE_FRACTION_COMBINED_PAPER_GLASS'],
        ),
      );
    }
  }

  collectionEvents.sort((a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction));

  const matchedSafeLocalities = context.localities.filter((locality) =>
    targetLocalityNames.includes(locality.name.toLocaleLowerCase('pl-PL')),
  );

  const coverage: Array<{ type: 'LOCALITY'; priority: number; simc: string }> = [];

  for (const loc of matchedSafeLocalities) {
    if (!coverage.some((c) => c.simc === loc.simc)) {
      coverage.push({ type: 'LOCALITY', priority: 50, simc: loc.simc });
    }
  }

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
        reuseBasis,
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
