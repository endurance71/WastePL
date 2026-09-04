import type { WasteFractionCode } from '@wastepl/domain';
import {
  PdfTextParseError,
  type NormalizedCollectionEvent,
  type NormalizedDataset,
  type NormalizedQuality,
  type PdfTextArtifactInput,
} from './types.js';
import type { MunicipalCollectionReferenceContext } from './municipal-collection-adapter.js';

export const SWIESZYNO_SAFE_H2_SOURCE_KEY = 'swieszyno-collection-trasa-1-safe-h2-2026';

export const SWIESZYNO_TERC = '3209082';

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
  const clean = token.replace(/\/[^/]+\//g, '').replace(/,/g, ' ').trim();
  const days = clean.split(/\s+/).map((value) => Number.parseInt(value, 10));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
    throw new PdfTextParseError(`Invalid Świeszyno day list: ${token}`, 'INVALID_ROW', line);
  }
  return days;
}

function isoDate(month: number, day: number): string {
  const date = new Date(Date.UTC(2026, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new PdfTextParseError(`Invalid Świeszyno date 2026-${month}-${day}`, 'INVALID_ROW');
  }
  return date.toISOString().slice(0, 10);
}

function assertTemplate(text: string): void {
  const norm = normalizedText(text);

  if (!norm.includes('gminy świeszyno') && !norm.includes('gminy swieszyno')) {
    throw new PdfTextParseError('Missing Gmina Świeszyno municipal identity', 'UNSUPPORTED_TEMPLATE');
  }
  if (!norm.includes('trasa i') || !norm.includes('chałupy') || !norm.includes('niekłonice')) {
    throw new PdfTextParseError('Missing Świeszyno Trasa I locality markers', 'UNSUPPORTED_TEMPLATE');
  }
  if (!norm.includes('ekosan')) {
    throw new PdfTextParseError('Missing Świeszyno EKOSAN operator marker', 'UNSUPPORTED_TEMPLATE');
  }
}

function extractH2Rows(text: string): ParsedMonthRow[] {
  assertTemplate(text);

  const lines = text
    .split('\n')
    .map(normalizedLine)
    .filter((line) => line.length > 0);

  const parsedMonths: ParsedMonthRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lower = line.toLowerCase();

    for (const [mName, mNum] of MONTHS) {
      if (lower.startsWith(mName)) {
        if (mNum === 7) {
          const parts = line.split(/\s+/);
          if (parts.length < 3) throw new PdfTextParseError('Invalid Lipiec row', 'INVALID_ROW', line);
          parsedMonths.push({
            monthName: mName,
            month: mNum,
            mixed: parseDayList(parts[1]!, line),
            segregated: parseDayList(parts[2]!, line),
          });
        } else if (mNum === 8) {
          const parts = line.split(/\s+/);
          if (parts.length < 3) throw new PdfTextParseError('Invalid Sierpień row', 'INVALID_ROW', line);
          parsedMonths.push({
            monthName: mName,
            month: mNum,
            mixed: parseDayList(parts[1]!, line),
            segregated: parseDayList(parts[2]!, line),
          });
        } else if (mNum === 9) {
          const parts = line.split(/\s+/);
          if (parts.length < 3) throw new PdfTextParseError('Invalid Wrzesień row', 'INVALID_ROW', line);
          parsedMonths.push({
            monthName: mName,
            month: mNum,
            mixed: parseDayList(parts[1]!, line),
            segregated: parseDayList(parts[2]!, line),
          });
        } else if (mNum === 10) {
          const parts = line.split(/\s+/);
          if (parts.length < 4) throw new PdfTextParseError('Invalid Październik row', 'INVALID_ROW', line);
          parsedMonths.push({
            monthName: mName,
            month: mNum,
            mixed: parseDayList(parts[1]!, line),
            segregated: parseDayList(parts[2]!, line),
            bulky: parseDayList(parts[3]!, line),
          });
        } else if (mNum === 11) {
          const parts = line.split(/\s+/);
          if (parts.length < 3) throw new PdfTextParseError('Invalid Listopad row', 'INVALID_ROW', line);
          parsedMonths.push({
            monthName: mName,
            month: mNum,
            mixed: parseDayList(parts[1]!, line),
            segregated: parseDayList(parts[2]!, line),
          });
        } else if (mNum === 12) {
          let mixedTokens = '';
          let segToken = '';
          let j = i;
          if (line.split(/\s+/).length > 1) {
            const parts = line.split(/\s+/);
            mixedTokens = parts[1] || '';
            segToken = parts[2] || '';
          } else {
            const l1 = lines[++j] || '';
            const l2 = lines[++j] || '';
            const l3 = lines[++j] || '';
            mixedTokens = `${l1} ${l2}`;
            segToken = l3;
          }
          parsedMonths.push({
            monthName: mName,
            month: mNum,
            mixed: parseDayList(mixedTokens, line),
            segregated: parseDayList(segToken, line),
          });
        }
      }
    }
  }

  if (parsedMonths.length !== 6) {
    throw new PdfTextParseError(
      `Expected all 6 H2 months for Świeszyno, found ${parsedMonths.length}`,
      'INVALID_ROW',
    );
  }

  return parsedMonths;
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
  note: string | null,
  warnings: string[] = [],
): NormalizedCollectionEvent {
  return {
    serviceAreaKey: 'swieszyno-safe-h2-chalupy',
    fraction,
    date,
    status: 'SCHEDULED',
    note,
    sourceKey: input.sourceKey,
    quality: quality(input, warnings),
  };
}

export function supportsSwieszynoH2(text: string): boolean {
  const norm = normalizedText(text);
  return (
    (norm.includes('gminy świeszyno') || norm.includes('gminy swieszyno')) &&
    norm.includes('trasa i') &&
    norm.includes('chałupy') &&
    norm.includes('niekłonice') &&
    norm.includes('ekosan')
  );
}

export function parseSwieszynoH2(
  input: PdfTextArtifactInput,
  context: MunicipalCollectionReferenceContext,
  parserKey: string,
  parserVersion: string,
): NormalizedDataset {
  if (input.sourceKey !== SWIESZYNO_SAFE_H2_SOURCE_KEY) {
    throw new PdfTextParseError(`Unsupported Świeszyno source ${input.sourceKey}`, 'UNSUPPORTED_TEMPLATE');
  }
  if (context.municipality.terc !== SWIESZYNO_TERC) {
    throw new PdfTextParseError(
      `Świeszyno profile received unexpected TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
    );
  }
  assertTemplate(input.text);

  const chalupyMatches = context.localities.filter(
    (locality) => locality.name.toLocaleLowerCase('pl-PL') === 'chałupy',
  );
  if (chalupyMatches.length !== 1 || !chalupyMatches[0]) {
    throw new PdfTextParseError(
      `Chałupy did not resolve uniquely inside TERC ${context.municipality.terc}`,
      'MISSING_METADATA',
      'Chałupy',
    );
  }

  const rows = extractH2Rows(input.text);
  const collectionEvents: NormalizedCollectionEvent[] = [];

  for (const row of rows) {
    for (const day of row.mixed) {
      collectionEvents.push(event(input, 'MIXED', isoDate(row.month, day), null));
    }
    for (const day of row.segregated) {
      collectionEvents.push(
        event(
          input,
          'OTHER',
          isoDate(row.month, day),
          'Źródło: odpady segregowane (papier, tworzywa sztuczne, szkło, bio)',
          ['SOURCE_FRACTION_GENERIC_SEGREGATED_MAPPED_TO_OTHER'],
        ),
      );
    }
    if (row.bulky) {
      for (const day of row.bulky) {
        collectionEvents.push(
          event(input, 'BULKY', isoDate(row.month, day), 'Źródło: wielkogabarytowe, sprzęt AGD RTV'),
        );
      }
    }
  }

  // Verify counts: 14 MIXED, 14 OTHER, 1 BULKY = 29 total
  const mixedCount = collectionEvents.filter((e) => e.fraction === 'MIXED').length;
  const otherCount = collectionEvents.filter((e) => e.fraction === 'OTHER').length;
  const bulkyCount = collectionEvents.filter((e) => e.fraction === 'BULKY').length;

  if (mixedCount !== 14 || otherCount !== 14 || bulkyCount !== 1) {
    throw new PdfTextParseError(
      `Unexpected Świeszyno event counts: mixed=${mixedCount}, other=${otherCount}, bulky=${bulkyCount}`,
      'INVALID_ROW',
    );
  }

  collectionEvents.sort((a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction));

  const coverage = [{ type: 'LOCALITY' as const, priority: 50, simc: chalupyMatches[0].simc }];

  const otherLocalities = ['konikowo', 'niekłonice'];
  for (const name of otherLocalities) {
    const match = context.localities.find((l) => l.name.toLocaleLowerCase('pl-PL') === name);
    if (match && !coverage.some((c) => c.simc === match.simc)) {
      coverage.push({ type: 'LOCALITY' as const, priority: 50, simc: match.simc });
    }
  }

  return {
    schemaVersion: '0.1.0',
    municipality: context.municipality,
    serviceAreas: [
      {
        key: 'swieszyno-safe-h2-chalupy',
        name: 'Gmina Świeszyno — Chałupy (Trasa I)',
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
        reuseBasis: 'Świeszyno 2026 Trasa I schedule; Chałupy verified safe single-family subset',
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
