import type { WasteFractionCode } from '@wastepl/domain';
import {
  PdfTextParseError,
  type NormalizedCollectionEvent,
  type NormalizedDataset,
  type NormalizedMunicipalityType,
  type NormalizedQuality,
  type NormalizedServiceArea,
  type PdfTextArtifactInput,
} from './types.js';

const TYCHOWO_STANDARD_SOURCE_KEY = 'tychowo-collection-standard-2026';
const TYCHOWO_DIFFICULT_SOURCE_KEY = 'tychowo-collection-difficult-2026';

const MONTH_COUNT = 12;

export interface MunicipalCollectionLocalityRef {
  simc: string;
  name: string;
}

export interface MunicipalCollectionReferenceContext {
  municipality: {
    terc: string;
    name: string;
    municipalityType: NormalizedMunicipalityType;
  };
  localities: MunicipalCollectionLocalityRef[];
}

interface RouteDefinition {
  key: string;
  name: string;
  tableIndex: number;
  localities: string[];
}

interface ParsedTable {
  mixed: number[][];
  bio: number[][];
  paper: number[][];
  plastics: number[][];
  glass: number[][];
}

interface ResolvedLocality {
  locality: MunicipalCollectionLocalityRef;
  warnings: string[];
}

const TYCHOWO_SAFE_ROUTES: RouteDefinition[] = [
  {
    key: 'tychowo-standard-north-west',
    name: 'Gmina Tychowo — grupa Buczki/Czarnkowo',
    tableIndex: 0,
    localities: [
      'Buczki',
      'Czarnkowo',
      'Dzięciołowo',
      'Giżałki',
      'Pobądź',
      'Smęcino',
      'Solno',
      'Tyczewo',
      'Wełdkowo',
      'Wełdkówko',
    ],
  },
  {
    key: 'tychowo-standard-south',
    name: 'Gmina Tychowo — grupa Bukowo/Dobrowo',
    tableIndex: 1,
    localities: [
      'Bukowo',
      'Bukówko',
      'Dobrowo',
      'Dobrówko',
      'Modrolas',
      'Podborsko',
      'Retowo',
      'Skarszewice',
      'Słonino',
      'Zaspy Wielkie',
    ],
  },
  {
    key: 'tychowo-standard-east',
    name: 'Gmina Tychowo — grupa Doble/Kikowo',
    tableIndex: 3,
    localities: [
      'Doble',
      'Kikowo',
      'Krosinko',
      'Liśnica',
      'Nowe Dębno',
      'Rudno',
      'Sławomierz',
      'Trzebiszyn',
      'Trzebiec',
      'Żukówek',
    ],
  },
];

const EXCLUDED_STANDARD_LOCALITIES = [
  'Borzysław',
  'Drzonowo Białogardzkie',
  'Dobrochy',
  'Kowalki',
  'Motarzyn',
  'Osówko',
  'Sadkowo',
  'Stare Dębno',
  'Tychowo',
  'Warnino',
  'Wicewo',
] as const;

/**
 * Explicit source-to-reference corrections only. These are evidence-backed
 * publication typos, not fuzzy matches. The source text must still contain the
 * original spelling so template drift cannot be hidden by the alias.
 */
const TYCHOWO_LOCALITY_ALIASES: Readonly<Record<string, string>> = {
  'Pobądź': 'Pobądz',
};

function normalizeText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/,\s+/g, ',')
    .replace(/tworzywa\s+sztuczne/gi, 'tworzywa sztuczne')
    .replace(/papier\s+i\s+tektura/gi, 'papier i tektura')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value: string): string {
  return value
    .trim()
    .replace(/[.]$/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pl-PL');
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

function parseDayToken(value: string, label: string): number[] {
  const days = value.split(',').map((part) => Number.parseInt(part, 10));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
    throw new PdfTextParseError(`Invalid ${label} day list: ${value}`, 'INVALID_ROW', value);
  }
  return days;
}

function rowTokens(block: string, label: string, nextLabel: string): number[][] {
  const lower = block.toLocaleLowerCase('pl-PL');
  const start = lower.indexOf(label);
  const end = lower.indexOf(nextLabel, start + label.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new PdfTextParseError(`Missing ${label} row in Tychowo table`, 'UNSUPPORTED_TEMPLATE', block);
  }
  const payload = block.slice(start + label.length, end);
  const tokens = payload.match(/\d{1,2}(?:,\d{1,2})*/g) ?? [];
  if (tokens.length !== MONTH_COUNT) {
    throw new PdfTextParseError(
      `Expected 12 monthly cells for ${label}, got ${tokens.length}`,
      'UNSUPPORTED_TEMPLATE',
      payload,
    );
  }
  return tokens.map((token) => parseDayToken(token, label));
}

function parseStandardTables(text: string): ParsedTable[] {
  const normalized = normalizeText(text);
  const lower = normalized.toLocaleLowerCase('pl-PL');
  const starts = [...lower.matchAll(/\bzmieszane\b/g)].map((match) => match.index ?? -1).filter((index) => index >= 0);
  if (starts.length < 4) {
    throw new PdfTextParseError(
      `Expected at least four Tychowo schedule tables, got ${starts.length}`,
      'UNSUPPORTED_TEMPLATE',
    );
  }

  return starts.slice(0, 4).map((start, index) => {
    const end = starts[index + 1] ?? normalized.length;
    const block = normalized.slice(start, end);
    return {
      mixed: rowTokens(block, 'zmieszane', 'bio'),
      bio: rowTokens(block, 'bio', 'papier i tektura'),
      paper: rowTokens(block, 'papier i tektura', 'tworzywa sztuczne'),
      plastics: rowTokens(block, 'tworzywa sztuczne', 'szkło'),
      glass: rowTokens(block, 'szkło', 'mycie'),
    };
  });
}

function quality(input: PdfTextArtifactInput, warnings: string[] = []): NormalizedQuality {
  return {
    verificationStatus: 'OFFICIAL_SOURCE',
    confidence: 0.99,
    retrievedAt: input.retrievedAt,
    warnings,
  };
}

function source(input: PdfTextArtifactInput, parserKey: string, parserVersion: string) {
  return {
    sourceKey: input.sourceKey,
    url: input.url,
    ownerType: input.ownerType ?? ('MUNICIPALITY' as const),
    format: 'PDF_TEXT' as const,
    reuseBasis: 'Tychowo municipal 2026 text-bearing PDF template',
    artifact: {
      sha256: input.sha256,
      retrievedAt: input.retrievedAt,
      parserKey,
      parserVersion,
      extractionConfidence: 0.99,
      storageUri: input.storageUri,
    },
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

function resolveLocality(
  context: MunicipalCollectionReferenceContext,
  localityName: string,
): ResolvedLocality {
  const referenceName = TYCHOWO_LOCALITY_ALIASES[localityName] ?? localityName;
  const target = normalizeName(referenceName);
  const matches = context.localities.filter((locality) => normalizeName(locality.name) === target);
  if (matches.length !== 1 || !matches[0]) {
    throw new PdfTextParseError(
      `Locality ${localityName} did not resolve uniquely inside TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
      localityName,
    );
  }
  return {
    locality: matches[0],
    warnings: referenceName === localityName
      ? []
      : [`SOURCE_LOCALITY_ALIAS: ${localityName} -> official TERYT ${referenceName}`],
  };
}

function assertTemplateEvidence(text: string): void {
  const normalized = normalizeText(text).toLocaleLowerCase('pl-PL');
  if (!normalized.includes('gmina tychowo') || !normalized.includes('harmonogram odbioru odpadów komunalnych')) {
    throw new PdfTextParseError('Tychowo schedule heading is missing', 'UNSUPPORTED_TEMPLATE');
  }
  if (!normalized.includes('tychowo (tylko wspólnoty mieszkaniowe z powołanym zarządem)')) {
    throw new PdfTextParseError(
      'Expected separate Tychowo managed-community schedule marker is missing',
      'UNSUPPORTED_TEMPLATE',
    );
  }
  for (const locality of [...TYCHOWO_SAFE_ROUTES.flatMap((route) => route.localities), ...EXCLUDED_STANDARD_LOCALITIES]) {
    if (!normalized.includes(normalizeName(locality))) {
      throw new PdfTextParseError(`Expected Tychowo locality evidence is missing: ${locality}`, 'UNSUPPORTED_TEMPLATE');
    }
  }
}

function appendMonthlyEvents(
  input: PdfTextArtifactInput,
  events: NormalizedCollectionEvent[],
  serviceAreaKey: string,
  table: ParsedTable,
  routeWarnings: string[] = [],
): void {
  const rows: Array<{
    fraction: WasteFractionCode;
    months: number[][];
    note: string | null;
    warnings?: string[];
  }> = [
    { fraction: 'MIXED', months: table.mixed, note: null },
    { fraction: 'BIO', months: table.bio, note: null },
    { fraction: 'PAPER', months: table.paper, note: null },
    {
      fraction: 'OTHER',
      months: table.plastics,
      note: 'Źródło: tworzywa sztuczne',
      warnings: ['SOURCE_FRACTION_PLASTICS_NOT_EXPANDED_TO_METALS_PLASTICS'],
    },
    { fraction: 'GLASS', months: table.glass, note: null },
  ];

  for (const row of rows) {
    row.months.forEach((days, monthIndex) => {
      for (const day of days) {
        events.push(
          event(
            input,
            serviceAreaKey,
            row.fraction,
            isoDate(2026, monthIndex + 1, day),
            row.note,
            [...routeWarnings, ...(row.warnings ?? [])],
          ),
        );
      }
    });
  }
}

function parseTychowoStandard(
  input: PdfTextArtifactInput,
  context: MunicipalCollectionReferenceContext,
  parserKey: string,
  parserVersion: string,
): NormalizedDataset {
  if (context.municipality.terc !== '3201043') {
    throw new PdfTextParseError(
      `Tychowo adapter received unexpected TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
    );
  }
  assertTemplateEvidence(input.text);
  const tables = parseStandardTables(input.text);
  const serviceAreas: NormalizedServiceArea[] = [];
  const collectionEvents: NormalizedCollectionEvent[] = [];

  for (const route of TYCHOWO_SAFE_ROUTES) {
    const table = tables[route.tableIndex];
    if (!table) {
      throw new PdfTextParseError(`Missing Tychowo table ${route.tableIndex}`, 'UNSUPPORTED_TEMPLATE');
    }
    const resolved = route.localities.map((locality) => resolveLocality(context, locality));
    const routeWarnings = [...new Set(resolved.flatMap((entry) => entry.warnings))];
    serviceAreas.push({
      key: route.key,
      name: route.name,
      buildingType: null,
      coverage: resolved.map((entry) => ({
        type: 'LOCALITY' as const,
        priority: 50,
        simc: entry.locality.simc,
      })),
    });
    appendMonthlyEvents(input, collectionEvents, route.key, table, routeWarnings);
  }

  serviceAreas.sort((a, b) => a.key.localeCompare(b.key));
  collectionEvents.sort(
    (a, b) => a.date.localeCompare(b.date) || a.serviceAreaKey.localeCompare(b.serviceAreaKey) || a.fraction.localeCompare(b.fraction),
  );

  return {
    schemaVersion: '0.1.0',
    municipality: context.municipality,
    serviceAreas,
    collectionEvents,
    facilities: [],
    alerts: [],
    sources: [source(input, parserKey, parserVersion)],
  };
}

export class MunicipalCollectionPdfTextAdapter {
  readonly parserKey = 'municipal-collection-pdf-text';
  readonly parserVersion = '0.1.1';

  constructor(private readonly context: MunicipalCollectionReferenceContext) {}

  supports(text: string): boolean {
    const normalized = normalizeText(text).toLocaleLowerCase('pl-PL');
    return normalized.includes('gmina tychowo') && normalized.includes('harmonogram odbioru odpadów komunalnych');
  }

  parse(input: PdfTextArtifactInput): NormalizedDataset {
    if (!this.supports(input.text)) {
      throw new PdfTextParseError('Unsupported municipal PDF_TEXT template', 'UNSUPPORTED_TEMPLATE');
    }
    if (input.sourceKey === TYCHOWO_STANDARD_SOURCE_KEY) {
      return parseTychowoStandard(input, this.context, this.parserKey, this.parserVersion);
    }
    if (input.sourceKey === TYCHOWO_DIFFICULT_SOURCE_KEY) {
      throw new PdfTextParseError(
        'Tychowo hard-to-reach schedule is intentionally not publishable until explicit-address reference coverage is complete',
        'MISSING_METADATA',
      );
    }
    throw new PdfTextParseError(`Unsupported municipal collection source ${input.sourceKey}`, 'UNSUPPORTED_TEMPLATE');
  }
}
