import type { WasteFractionCode } from '@wastepl/domain';
import {
  PdfTextParseError,
  type NormalizedCollectionEvent,
  type NormalizedDataset,
  type NormalizedQuality,
  type NormalizedServiceArea,
  type PdfTextAdapter,
  type PdfTextArtifactInput,
} from './types.js';

const MONTHS: Record<string, number> = {
  styczeń: 1,
  luty: 2,
  marzec: 3,
  kwiecień: 4,
  maj: 5,
  czerwiec: 6,
  lipiec: 7,
  sierpień: 8,
  wrzesień: 9,
  październik: 10,
  listopad: 11,
  grudzień: 12,
};

const WEEKDAYS: Record<string, number> = {
  niedziela: 0,
  poniedziałek: 1,
  wtorek: 2,
  środa: 3,
  czwartek: 4,
  piątek: 5,
  sobota: 6,
};

const SEGREGATED_FRACTIONS: WasteFractionCode[] = [
  'METALS_PLASTICS',
  'GLASS',
  'PAPER',
  'BIO',
];

function cleanLines(text: string): string[] {
  return text
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new PdfTextParseError(`Invalid calendar date ${year}-${month}-${day}`, 'INVALID_ROW');
  }
  return date.toISOString().slice(0, 10);
}

function parseDays(value: string, line: string): number[] {
  const days = value.split(',').map((part) => Number.parseInt(part, 10));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
    throw new PdfTextParseError(`Invalid day list: ${value}`, 'INVALID_ROW', line);
  }
  return days;
}

function parsePolishDate(value: string): Date {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) throw new PdfTextParseError(`Invalid date: ${value}`, 'INVALID_ROW', value);
  return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
}

function datesForWeekday(start: Date, end: Date, weekday: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getUTCDay() === weekday) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function source(input: PdfTextArtifactInput, parserKey: string, parserVersion: string, confidence: number) {
  return {
    sourceKey: input.sourceKey,
    url: input.url,
    ownerType: 'MUNICIPAL_COMPANY' as const,
    format: 'PDF_TEXT' as const,
    reuseBasis: null,
    artifact: {
      sha256: input.sha256,
      retrievedAt: input.retrievedAt,
      parserKey,
      parserVersion,
      extractionConfidence: confidence,
      storageUri: input.storageUri,
    },
  };
}

function quality(input: PdfTextArtifactInput, confidence: number, warnings: string[] = []): NormalizedQuality {
  return {
    verificationStatus: 'OFFICIAL_SOURCE',
    confidence,
    retrievedAt: input.retrievedAt,
    warnings,
  };
}

function event(
  input: PdfTextArtifactInput,
  serviceAreaKey: string,
  fraction: WasteFractionCode,
  date: string,
  confidence: number,
  warnings: string[] = [],
): NormalizedCollectionEvent {
  return {
    serviceAreaKey,
    fraction,
    date,
    status: 'SCHEDULED',
    note: null,
    sourceKey: input.sourceKey,
    quality: quality(input, confidence, warnings),
  };
}

function parseManowo(input: PdfTextArtifactInput, parserKey: string, parserVersion: string): NormalizedDataset {
  const lines = cleanLines(input.text);
  const localityLine = lines.find(
    (line) => line.includes('Bonin') && line.includes('Dęborogi') && line.includes('Wyszebórz'),
  );
  if (!localityLine) {
    throw new PdfTextParseError('Manowo locality coverage line is missing', 'MISSING_METADATA');
  }

  const localities = localityLine
    .replace(/[.]$/, '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const serviceAreaKey = 'manowo-bonin-deborogi-policko-wyszeborz';
  const serviceArea: NormalizedServiceArea = {
    key: serviceAreaKey,
    name: `Gmina Manowo: ${localities.join(', ')}`,
    buildingType: null,
    coverage: localities.map((name) => ({
      type: 'EXPLICIT_ADDRESS',
      priority: 50,
      explicitAddress: `${name}, gmina Manowo`,
    })),
  };

  const rows: Array<{ month: number; mixed: number[]; segregated: number[]; bulky: number[] }> = [];
  const rowRegex = /^(styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień)\s+(\d+(?:,\d+)*)\s+(\d+(?:,\d+)*)(?:\s+(\d+(?:,\d+)*))?$/i;

  for (const line of lines) {
    const match = rowRegex.exec(line.toLocaleLowerCase('pl-PL'));
    if (!match) continue;
    const month = MONTHS[match[1] ?? ''];
    if (!month || !match[2] || !match[3]) {
      throw new PdfTextParseError('Incomplete monthly row', 'INVALID_ROW', line);
    }
    rows.push({
      month,
      mixed: parseDays(match[2], line),
      segregated: parseDays(match[3], line),
      bulky: match[4] ? parseDays(match[4], line) : [],
    });
  }

  if (rows.length === 0) {
    throw new PdfTextParseError('No Manowo monthly schedule rows found', 'UNSUPPORTED_TEMPLATE');
  }

  const coverageWarning = ['COVERAGE_AWAITING_TERYT_RESOLUTION'];
  const collectionEvents: NormalizedCollectionEvent[] = [];
  for (const row of rows) {
    for (const day of row.mixed) {
      collectionEvents.push(event(input, serviceAreaKey, 'MIXED', isoDate(2026, row.month, day), 0.99, coverageWarning));
    }
    for (const day of row.segregated) {
      const date = isoDate(2026, row.month, day);
      for (const fraction of SEGREGATED_FRACTIONS) {
        collectionEvents.push(event(input, serviceAreaKey, fraction, date, 0.99, coverageWarning));
      }
    }
    for (const day of row.bulky) {
      collectionEvents.push(event(input, serviceAreaKey, 'BULKY', isoDate(2026, row.month, day), 0.99, coverageWarning));
    }
  }

  collectionEvents.sort((a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction));

  return {
    schemaVersion: '0.1.0',
    municipality: { terc: '3209042', name: 'Manowo', municipalityType: 'RURAL' },
    serviceAreas: [serviceArea],
    collectionEvents,
    facilities: [],
    alerts: [],
    sources: [source(input, parserKey, parserVersion, 0.99)],
  };
}

function parseKoszalinBio(input: PdfTextArtifactInput, parserKey: string, parserVersion: string): NormalizedDataset {
  const lines = cleanLines(input.text);
  const rangeLine = lines.find((line) => /\d{2}\.\d{2}\.\d{4}\s*-\s*\d{2}\.\d{2}\.\d{4}/.test(line));
  const range = rangeLine?.match(/(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/);
  if (!range?.[1] || !range[2]) {
    throw new PdfTextParseError('Koszalin BIO validity range is missing', 'MISSING_METADATA');
  }
  const start = parsePolishDate(range[1]);
  const end = parsePolishDate(range[2]);
  if (end < start) throw new PdfTextParseError('Koszalin BIO validity range is reversed', 'INVALID_ROW', rangeLine ?? null);

  const rowRegex = /^(.+?)\s+(\d+[A-ZĄĆĘŁŃÓŚŹŻ]*(?:[-/]\d+[A-ZĄĆĘŁŃÓŚŹŻ]*)?)\s+(poniedziałek|wtorek|środa|czwartek|piątek|sobota|niedziela)$/i;
  const addressesByWeekday = new Map<string, Set<string>>();

  for (const line of lines) {
    const match = rowRegex.exec(line);
    if (!match?.[1] || !match[2] || !match[3]) continue;
    const weekday = match[3].toLocaleLowerCase('pl-PL');
    const address = `${match[1].trim()} ${match[2].trim()}, Koszalin`;
    const addresses = addressesByWeekday.get(weekday) ?? new Set<string>();
    addresses.add(address);
    addressesByWeekday.set(weekday, addresses);
  }

  if (addressesByWeekday.size === 0) {
    throw new PdfTextParseError('No Koszalin BIO address rows found', 'UNSUPPORTED_TEMPLATE');
  }

  const serviceAreas: NormalizedServiceArea[] = [];
  const collectionEvents: NormalizedCollectionEvent[] = [];
  for (const [weekdayName, addresses] of [...addressesByWeekday.entries()].sort()) {
    const weekday = WEEKDAYS[weekdayName];
    if (weekday === undefined) throw new PdfTextParseError(`Unsupported weekday ${weekdayName}`, 'INVALID_ROW');
    const key = `koszalin-bio-${weekdayName}`;
    serviceAreas.push({
      key,
      name: `Koszalin zabudowa wielorodzinna BIO - ${weekdayName}`,
      buildingType: 'MULTI_FAMILY',
      coverage: [...addresses].sort().map((address) => ({
        type: 'EXPLICIT_ADDRESS',
        priority: 100,
        explicitAddress: address,
      })),
    });
    for (const date of datesForWeekday(start, end, weekday)) {
      collectionEvents.push(event(input, key, 'BIO', date, 0.995));
    }
  }

  collectionEvents.sort((a, b) => a.date.localeCompare(b.date) || a.serviceAreaKey.localeCompare(b.serviceAreaKey));
  serviceAreas.sort((a, b) => a.key.localeCompare(b.key));

  return {
    schemaVersion: '0.1.0',
    municipality: { terc: '3261011', name: 'Koszalin', municipalityType: 'DISTRICT_CITY' },
    serviceAreas,
    collectionEvents,
    facilities: [],
    alerts: [],
    sources: [source(input, parserKey, parserVersion, 0.995)],
  };
}

export class PgkKoszalinPdfTextAdapter implements PdfTextAdapter {
  readonly parserKey = 'pgk-koszalin-pdf-text';
  readonly parserVersion = '0.1.0';

  supports(text: string): boolean {
    const normalized = text.toLocaleLowerCase('pl-PL');
    return (
      normalized.includes('gmina manowo') ||
      normalized.includes('zabudowa wielorodzinna miasta koszalina - bio') ||
      normalized.includes('data odbioru odpadów zmieszanych i segregowanych')
    );
  }

  parse(input: PdfTextArtifactInput): NormalizedDataset {
    const normalized = input.text.toLocaleLowerCase('pl-PL');
    if (normalized.includes('data odbioru odpadów zmieszanych i segregowanych')) {
      throw new PdfTextParseError(
        'The source combines mixed and generic segregated waste in one column; canonical fractions cannot be inferred safely.',
        'AMBIGUOUS_FRACTION',
      );
    }
    if (normalized.includes('gmina manowo')) {
      return parseManowo(input, this.parserKey, this.parserVersion);
    }
    if (normalized.includes('zabudowa wielorodzinna miasta koszalina - bio')) {
      return parseKoszalinBio(input, this.parserKey, this.parserVersion);
    }
    throw new PdfTextParseError('Unsupported PGK Koszalin PDF_TEXT template', 'UNSUPPORTED_TEMPLATE');
  }
}
