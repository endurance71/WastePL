import type { SimcRow, TercRow, UlicRow } from './types.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIGITS_RE = /^\d+$/;

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function rowMaps(xml: string): Array<Record<string, string>> {
  const result: Array<Record<string, string>> = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const columns: Record<string, string> = {};
    const columnPattern = /<col\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/col>/gi;
    let columnMatch: RegExpExecArray | null;
    while ((columnMatch = columnPattern.exec(rowMatch[1] ?? '')) !== null) {
      columns[columnMatch[1]!.trim().toUpperCase()] = decodeXml(columnMatch[2] ?? '');
    }
    if (Object.keys(columns).length > 0) result.push(columns);
  }
  return result;
}

function required(row: Record<string, string>, key: string): string {
  const value = row[key]?.trim();
  if (!value) throw new Error(`TERYT row missing ${key}`);
  return value;
}

function digits(row: Record<string, string>, key: string, length?: number): string {
  const value = required(row, key);
  if (!DIGITS_RE.test(value) || (length !== undefined && value.length !== length)) {
    throw new Error(`TERYT ${key} must be ${length ?? ''} digits: ${value}`.trim());
  }
  return value;
}

function stateDate(row: Record<string, string>): string {
  const value = required(row, 'STAN_NA');
  if (!DATE_RE.test(value)) throw new Error(`TERYT STAN_NA must be YYYY-MM-DD: ${value}`);
  return value;
}

export function parseTercXml(xml: string): TercRow[] {
  return rowMaps(xml)
    .filter((row) => Boolean(row.GMI?.trim() && row.RODZ?.trim()))
    .map((row) => ({
      woj: digits(row, 'WOJ', 2),
      pow: digits(row, 'POW', 2),
      gmi: digits(row, 'GMI', 2),
      rodz: digits(row, 'RODZ', 1),
      name: required(row, 'NAZWA'),
      nameAdditional: required(row, 'NAZDOD'),
      stateDate: stateDate(row),
    }));
}

export function parseSimcXml(xml: string): SimcRow[] {
  return rowMaps(xml).map((row) => ({
    woj: digits(row, 'WOJ', 2),
    pow: digits(row, 'POW', 2),
    gmi: digits(row, 'GMI', 2),
    rodzGmi: digits(row, 'RODZ_GMI', 1),
    localityTypeCode: digits(row, 'RM'),
    basic: required(row, 'MZ'),
    name: required(row, 'NAZWA'),
    simc: digits(row, 'SYM', 7),
    parentSimc: row.SYMPOD?.trim() ? digits(row, 'SYMPOD', 7) : null,
    stateDate: stateDate(row),
  }));
}

export function parseUlicXml(xml: string): UlicRow[] {
  return rowMaps(xml).map((row) => ({
    woj: digits(row, 'WOJ', 2),
    pow: digits(row, 'POW', 2),
    gmi: digits(row, 'GMI', 2),
    rodzGmi: digits(row, 'RODZ_GMI', 1),
    simc: digits(row, 'SYM', 7),
    ulic: digits(row, 'SYM_UL', 5),
    streetType: required(row, 'CECHA'),
    name1: required(row, 'NAZWA_1'),
    name2: row.NAZWA_2?.trim() ?? '',
    stateDate: stateDate(row),
  }));
}

export function streetDisplayName(row: Pick<UlicRow, 'name1' | 'name2'>): string {
  return [row.name2, row.name1].map((part) => part.trim()).filter(Boolean).join(' ');
}
