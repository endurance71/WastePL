import type { WasteFractionCode } from '@wastepl/domain';
import {
  PdfTextParseError,
  type NormalizedCollectionEvent,
  type NormalizedDataset,
  type NormalizedQuality,
  type PdfTextArtifactInput,
} from './types.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

export const SIANOW_SAFE_H2_SOURCE_KEY = 'sianow-collection-dabrowa-grabowko-safe-h2-2026';
export const SIANOW_BOROWIEC_SAFE_H2_SOURCE_KEY = 'sianow-collection-borowiec-safe-h2-2026';
export const SIANOW_SKWIERZYNKA_SAFE_H2_SOURCE_KEY = 'sianow-collection-skwierzynka-safe-h2-2026';

export const SIANOW_TERC = '3209073';

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
  segregated: number[];
  bio: number[];
  bulky?: number[] | undefined;
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
    throw new PdfTextParseError(`Invalid Sianów day list: ${token}`, 'INVALID_ROW', line);
  }
  return days;
}

function isoDate(month: number, day: number): string {
  const date = new Date(Date.UTC(2026, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new PdfTextParseError(`Invalid Sianów date 2026-${month}-${day}`, 'INVALID_ROW');
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
      `Expected exactly six H2 month rows for Sianów, got ${monthLines.length}`,
      'UNSUPPORTED_TEMPLATE',
    );
  }

  return monthLines.map((line, index) => {
    const expectedMonth = MONTHS[index];
    if (!expectedMonth) throw new PdfTextParseError(`Unexpected row index ${index}`, 'UNSUPPORTED_TEMPLATE', line);

    const tokens = line.split(' ');
    // Ordinary months have 4 tokens: month mixed segregated bio
    // September has 5 tokens: month mixed segregated bio bulky
    if (tokens.length !== 4 && tokens.length !== 5) {
      throw new PdfTextParseError(
        `Expected 4 or 5 cells for Sianów row, got: "${line}"`,
        'UNSUPPORTED_TEMPLATE',
        line,
      );
    }

    const [monthName, mixedToken, segregatedToken, bioToken, bulkyToken] = tokens;
    if (monthName?.toLocaleLowerCase('pl-PL') !== expectedMonth[0]) {
      throw new PdfTextParseError(
        `Expected ${expectedMonth[0]} at row ${index + 1}, got ${monthName}`,
        'UNSUPPORTED_TEMPLATE',
        line,
      );
    }

    const mixed = parseDayList(mixedToken!, line);
    const segregated = parseDayList(segregatedToken!, line);
    const bio = parseDayList(bioToken!, line);
    const bulky = bulkyToken ? parseDayList(bulkyToken, line) : undefined;

    return {
      monthName: expectedMonth[0],
      month: expectedMonth[1],
      mixed,
      segregated,
      bio,
      bulky,
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

export function supportsSianowH2(text: string): boolean {
  const normalized = normalizedText(text);
  const isPgkSianow =
    normalized.includes('harmonogram odbioru odpadów') &&
    normalized.includes('pgk koszalin') &&
    normalized.includes('sianów');

  return (
    isPgkSianow &&
    (normalized.includes('dąbrowa i grabówko') ||
      normalized.includes('borowiec') ||
      normalized.includes('skwierzynka'))
  );
}

export function parseSianowH2(
  input: PdfTextArtifactInput,
  context: MunicipalCollectionReferenceContext,
  parserKey: string,
  parserVersion: string,
): NormalizedDataset {
  if (
    input.sourceKey !== SIANOW_SAFE_H2_SOURCE_KEY &&
    input.sourceKey !== SIANOW_BOROWIEC_SAFE_H2_SOURCE_KEY &&
    input.sourceKey !== SIANOW_SKWIERZYNKA_SAFE_H2_SOURCE_KEY
  ) {
    throw new PdfTextParseError(`Unsupported Sianów source ${input.sourceKey}`, 'UNSUPPORTED_TEMPLATE');
  }
  if (context.municipality.terc !== SIANOW_TERC) {
    throw new PdfTextParseError(
      `Sianów profile received unexpected TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
    );
  }

  const norm = normalizedText(input.text);
  if (!norm.includes('harmonogram odbioru odpadów') || !norm.includes('2026')) {
    throw new PdfTextParseError('Missing expected Sianów header markers', 'UNSUPPORTED_TEMPLATE');
  }

  const isBorowiec = input.sourceKey === SIANOW_BOROWIEC_SAFE_H2_SOURCE_KEY;
  const isSkwierzynka = input.sourceKey === SIANOW_SKWIERZYNKA_SAFE_H2_SOURCE_KEY;

  if (isBorowiec) {
    if (!norm.includes('borowiec')) {
      throw new PdfTextParseError('Missing expected Sianów Borowiec locality markers', 'UNSUPPORTED_TEMPLATE');
    }
  } else if (isSkwierzynka) {
    if (!norm.includes('skwierzynka')) {
      throw new PdfTextParseError('Missing expected Sianów Skwierzynka locality markers', 'UNSUPPORTED_TEMPLATE');
    }
  } else {
    if (!norm.includes('dąbrowa i grabówko')) {
      throw new PdfTextParseError('Missing expected Sianów Dąbrowa i Grabówko locality markers', 'UNSUPPORTED_TEMPLATE');
    }
  }

  const rows = parseRows(input.text);
  const collectionEvents: NormalizedCollectionEvent[] = [];

  const CANONICAL_SEGREGATED_FRACTIONS: WasteFractionCode[] = [
    'METALS_PLASTICS',
    'PAPER',
    'GLASS',
  ];

  const serviceAreaKey = isBorowiec
    ? 'sianow-safe-h2-borowiec-rural'
    : isSkwierzynka
      ? 'sianow-skwierzynka-single-family'
      : 'sianow-safe-h2-grabowko';

  for (const row of rows) {
    for (const day of row.mixed) {
      collectionEvents.push(event(input, serviceAreaKey, 'MIXED', isoDate(row.month, day), null));
    }
    for (const day of row.bio) {
      collectionEvents.push(event(input, serviceAreaKey, 'BIO', isoDate(row.month, day), null));
    }
    for (const day of row.segregated) {
      const date = isoDate(row.month, day);
      for (const fraction of CANONICAL_SEGREGATED_FRACTIONS) {
        collectionEvents.push(
          event(
            input,
            serviceAreaKey,
            fraction,
            date,
            'Źródło: odpady segregowane (wspólny odbiór tworzyw, papieru i szkła)',
          ),
        );
      }
    }
    if (row.bulky) {
      for (const day of row.bulky) {
        collectionEvents.push(event(input, serviceAreaKey, 'BULKY', isoDate(row.month, day), 'Źródło: gabaryty'));
      }
    }
  }

  collectionEvents.sort((a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction));

  if (isBorowiec) {
    // 7 clean rural localities absent from 15-utrudnione.pdf
    const cleanLocalities = [
      'borowiec',
      'szczeglino nowe',
      'przytok',
      'ratajki',
      'sowno',
      'suszka',
      'sowieński młyn',
    ];

    const coverage = cleanLocalities
      .map((name) => context.localities.find((l) => l.name.toLocaleLowerCase('pl-PL') === name))
      .filter((l): l is NonNullable<typeof l> => Boolean(l))
      .map((l) => ({ type: 'LOCALITY' as const, priority: 50, simc: l.simc }));

    return {
      schemaVersion: '0.1.0',
      municipality: context.municipality,
      serviceAreas: [
        {
          key: serviceAreaKey,
          name: 'Gmina Sianów — Trasa Borowiec (tereny wiejskie bezpieczne)',
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
          reuseBasis: 'Sianów H2 2026 PGK Borowiec schedule; clean rural safe subset',
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

  if (isSkwierzynka) {
    const skwierzynkaMatches = context.localities.filter(
      (locality) => locality.name.toLocaleLowerCase('pl-PL') === 'skwierzynka',
    );
    if (skwierzynkaMatches.length !== 1 || !skwierzynkaMatches[0]) {
      throw new PdfTextParseError(
        `Skwierzynka did not resolve uniquely inside TERC ${context.municipality.terc}`,
        'MISSING_METADATA',
        'Skwierzynka',
      );
    }

    return {
      schemaVersion: '0.1.0',
      municipality: context.municipality,
      serviceAreas: [
        {
          key: serviceAreaKey,
          name: 'Gmina Sianów — Skwierzynka (zabudowa jednorodzinna safe subset)',
          buildingType: 'SINGLE_FAMILY',
          coverage: [
            {
              type: 'LOCALITY',
              priority: 50,
              simc: skwierzynkaMatches[0].simc,
            },
          ],
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
          reuseBasis: 'Sianów H2 2026 PGK Skwierzynka schedule; standard single-family verified safe subset',
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

  // Grabówko route
  const grabowkoMatches = context.localities.filter(
    (locality) => locality.name.toLocaleLowerCase('pl-PL') === 'grabówko',
  );
  if (grabowkoMatches.length !== 1 || !grabowkoMatches[0]) {
    throw new PdfTextParseError(
      `Grabówko did not resolve uniquely inside TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
      'Grabówko',
    );
  }

  const dabrowaMatches = context.localities.filter(
    (locality) => locality.name.toLocaleLowerCase('pl-PL') === 'dąbrowa',
  );

  const coverage = [{ type: 'LOCALITY' as const, priority: 50, simc: grabowkoMatches[0].simc }];
  if (dabrowaMatches.length === 1 && dabrowaMatches[0]) {
    coverage.push({ type: 'LOCALITY' as const, priority: 50, simc: dabrowaMatches[0].simc });
  }

  return {
    schemaVersion: '0.1.0',
    municipality: context.municipality,
    serviceAreas: [
      {
        key: serviceAreaKey,
        name: 'Gmina Sianów — Grabówko (Trasa Dąbrowa/Grabówko)',
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
        reuseBasis: 'Sianów H2 2026 PGK Dąbrowa i Grabówko schedule; Grabówko verified safe subset',
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
