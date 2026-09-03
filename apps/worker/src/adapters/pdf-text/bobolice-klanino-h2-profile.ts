import type { WasteFractionCode } from '@wastepl/domain';
import {
  PdfTextParseError,
  type NormalizedCollectionEvent,
  type NormalizedDataset,
  type NormalizedQuality,
  type PdfTextArtifactInput,
} from './types.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

export const BOBOLICE_KLANINO_SOURCE_KEY = 'bobolice-collection-klanino-safe-h2-2026';

export const BOBOLICE_TERC = '3209033';

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
  metalsGlass: number[];
  paperBio: number[];
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
  const clean = token.replace(/\*/g, '').replace(/,/g, ' ').trim();
  const days = clean.split(/\s+/).map((value) => Number.parseInt(value, 10));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
    throw new PdfTextParseError(`Invalid Bobolice day list: ${token}`, 'INVALID_ROW', line);
  }
  return days;
}

function isoDate(month: number, day: number): string {
  const date = new Date(Date.UTC(2026, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new PdfTextParseError(`Invalid Bobolice date 2026-${month}-${day}`, 'INVALID_ROW');
  }
  return date.toISOString().slice(0, 10);
}

function parseMonthRow(line: string): ParsedMonthRow | null {
  const lower = line.toLocaleLowerCase('pl-PL');
  const matched = MONTHS.find(([name]) => lower.startsWith(name));
  if (!matched) return null;

  const [monthName, month] = matched;
  const tail = line.slice(monthName.length).trim();
  const parts = tail.split(/\s+/).filter(Boolean);

  if (parts.length < 3) {
    throw new PdfTextParseError(
      `Bobolice row for ${monthName} has fewer than 3 day groups: ${line}`,
      'INVALID_ROW',
      line,
    );
  }

  const mixed = parseDayList(parts[0]!, line);
  const metalsGlass = parseDayList(parts[1]!, line);
  const paperBio = parseDayList(parts[2]!, line);

  return {
    monthName,
    month,
    mixed,
    metalsGlass,
    paperBio,
  };
}

function extractH2Rows(text: string): ParsedMonthRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(normalizedLine)
    .filter(Boolean);

  const parsedByMonth = new Map<number, ParsedMonthRow>();

  for (const line of lines) {
    const row = parseMonthRow(line);
    if (row && !parsedByMonth.has(row.month)) {
      parsedByMonth.set(row.month, row);
    }
  }

  const rows = MONTHS.map(([, month]) => parsedByMonth.get(month));
  if (rows.some((row) => row === undefined)) {
    const missing = MONTHS.filter(([, month]) => !parsedByMonth.has(month))
      .map(([name]) => name)
      .join(', ');
    throw new PdfTextParseError(
      `Bobolice schedule missing month rows: ${missing}`,
      'INVALID_ROW',
    );
  }

  return rows as ParsedMonthRow[];
}

function assertTemplate(text: string): void {
  const norm = normalizedText(text);
  const hasMunicipality = norm.includes('gminy bobolice') || norm.includes('urząd miejski w bobolicach');
  const hasOperator = norm.includes('atf transport') || norm.includes('atf');
  const hasKlanino = norm.includes('kłanino') || norm.includes('klanino');

  if (!hasMunicipality || !hasOperator || !hasKlanino) {
    throw new PdfTextParseError(
      'Document does not match expected Bobolice Kłanino ATF H2 2026 template',
      'UNSUPPORTED_TEMPLATE',
    );
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
  fraction: WasteFractionCode,
  date: string,
  note: string | null = null,
  warnings: string[] = [],
): NormalizedCollectionEvent {
  return {
    serviceAreaKey: 'bobolice-safe-h2-klanino',
    fraction,
    date,
    status: 'SCHEDULED',
    note,
    sourceKey: input.sourceKey,
    quality: quality(input, warnings),
  };
}

export function supportsBoboliceKlaninoH2(text: string): boolean {
  const norm = normalizedText(text);
  return (
    (norm.includes('bobolice') || norm.includes('bobolicach')) &&
    (norm.includes('kłanino') || norm.includes('klanino')) &&
    (norm.includes('atf') || norm.includes('atf transport'))
  );
}

export function parseBoboliceKlaninoH2(
  input: PdfTextArtifactInput,
  context: MunicipalCollectionReferenceContext,
  parserKey: string,
  parserVersion: string,
): NormalizedDataset {
  if (input.sourceKey !== BOBOLICE_KLANINO_SOURCE_KEY) {
    throw new PdfTextParseError(`Unsupported Bobolice source ${input.sourceKey}`, 'UNSUPPORTED_TEMPLATE');
  }
  if (context.municipality.terc !== BOBOLICE_TERC) {
    throw new PdfTextParseError(
      `Bobolice profile received unexpected TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
    );
  }
  assertTemplate(input.text);

  const klaninoMatches = context.localities.filter(
    (locality) => locality.name.toLocaleLowerCase('pl-PL') === 'kłanino',
  );
  if (klaninoMatches.length !== 1 || !klaninoMatches[0]) {
    throw new PdfTextParseError(
      `Kłanino did not resolve uniquely inside TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
      'Kłanino',
    );
  }

  const rows = extractH2Rows(input.text);
  const collectionEvents: NormalizedCollectionEvent[] = [];

  for (const row of rows) {
    // 1. Zmieszane
    for (const day of row.mixed) {
      collectionEvents.push(event(input, 'MIXED', isoDate(row.month, day), 'Zmieszane'));
    }
    // 2. Metale i tworzywa sztuczne + Szkło
    for (const day of row.metalsGlass) {
      const dt = isoDate(row.month, day);
      collectionEvents.push(
        event(input, 'METALS_PLASTICS', dt, 'Metale i tworzywa sztuczne'),
      );
      collectionEvents.push(
        event(input, 'GLASS', dt, 'Szkło'),
      );
    }
    // 3. Papier + Bioodpady
    for (const day of row.paperBio) {
      const dt = isoDate(row.month, day);
      collectionEvents.push(
        event(input, 'PAPER', dt, 'Papier'),
      );
      collectionEvents.push(
        event(input, 'BIO', dt, 'Bio'),
      );
    }
  }

  collectionEvents.sort(
    (a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction),
  );

  const warnings: string[] = [];

  return {
    schemaVersion: '0.1.0',
    municipality: context.municipality,
    serviceAreas: [
      {
        key: 'bobolice-safe-h2-klanino',
        name: 'Gmina Bobolice — Kłanino (Trasa Kłanino/Ubiedrze)',
        buildingType: 'SINGLE_FAMILY',
        coverage: [{ type: 'LOCALITY', priority: 50, simc: klaninoMatches[0].simc }],
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
        reuseBasis: 'Bobolice H2 2026 ATF Transport schedule; Kłanino safe zero-overlap subset',
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
