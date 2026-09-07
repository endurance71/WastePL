import { createHash } from 'node:crypto';
import { parsePrgAddressGml } from './prg-gml.js';
import type { PrgAddressRow } from './types.js';

export const PRG_KINA_WFS_URL = 'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej';
export const DEFAULT_PRG_WFS_PAGE_SIZE = 2000;

export interface PrgWfsCollectionCounts {
  numberMatched: number;
  numberReturned: number;
}

export interface PrgWfsPageEvidence {
  startIndex: number;
  requestedCount: number;
  numberMatched: number;
  numberReturned: number;
  parsedRows: number;
  sha256: string;
}

export interface PrgMunicipalityAcquisition {
  municipalityTerc: string;
  kinaTeryt: string;
  sourceUrl: string;
  retrievedAt: string;
  pageSize: number;
  totalRows: number;
  rows: PrgAddressRow[];
  pages: PrgWfsPageEvidence[];
  aggregateSha256: string;
}

export type PrgWfsFetch = (url: string) => Promise<string>;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function requiredIntegerAttribute(xml: string, name: string): number {
  const match = new RegExp(`\\b${name}=["']([^"']+)["']`, 'i').exec(xml);
  if (!match?.[1] || !/^\d+$/.test(match[1])) {
    throw new Error(`PRG WFS FeatureCollection missing numeric ${name}`);
  }
  const value = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`PRG WFS FeatureCollection invalid ${name}: ${match[1]}`);
  }
  return value;
}

export function prgWfsCollectionCounts(xml: string): PrgWfsCollectionCounts {
  return {
    numberMatched: requiredIntegerAttribute(xml, 'numberMatched'),
    numberReturned: requiredIntegerAttribute(xml, 'numberReturned'),
  };
}

export function municipalityKinaTeryt(municipalityTerc: string): string {
  if (!/^\d{7}$/.test(municipalityTerc)) {
    throw new Error(`Invalid municipality TERC for PRG acquisition: ${municipalityTerc}`);
  }
  return municipalityTerc.slice(0, 6);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildPrgWfsPageUrl(input: {
  municipalityTerc: string;
  startIndex: number;
  count?: number;
}): string {
  const count = input.count ?? DEFAULT_PRG_WFS_PAGE_SIZE;
  if (!Number.isSafeInteger(input.startIndex) || input.startIndex < 0) {
    throw new Error(`Invalid PRG WFS startIndex: ${input.startIndex}`);
  }
  if (!Number.isSafeInteger(count) || count < 1 || count > DEFAULT_PRG_WFS_PAGE_SIZE) {
    throw new Error(`Invalid PRG WFS count: ${count}`);
  }

  const kinaTeryt = municipalityKinaTeryt(input.municipalityTerc);
  const filter = `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:ValueReference>teryt</fes:ValueReference><fes:Literal>${escapeXml(kinaTeryt)}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>`;
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: 'ms:prg-adresy',
    startIndex: String(input.startIndex),
    count: String(count),
    filter,
  });
  return `${PRG_KINA_WFS_URL}?${params.toString()}`;
}

function canonicalAggregate(rows: readonly PrgAddressRow[], pages: readonly PrgWfsPageEvidence[]): string {
  return JSON.stringify({
    rows: rows.map((row) => ({
      prgId: row.prgId,
      municipalityTerc: row.municipalityTerc,
      simc: row.simc,
      ulic: row.ulic,
      buildingNumber: row.buildingNumber,
      postalCode: row.postalCode,
      status: row.status,
      validFrom: row.validFrom,
      validTo: row.validTo,
      sourceUpdatedAt: row.sourceUpdatedAt,
      x: row.x,
      y: row.y,
      crs: row.crs,
    })),
    pageHashes: pages.map((page) => page.sha256),
  });
}

export async function acquirePrgMunicipality(input: {
  municipalityTerc: string;
  fetchPage: PrgWfsFetch;
  pageSize?: number;
  retrievedAt?: string;
}): Promise<PrgMunicipalityAcquisition> {
  const pageSize = input.pageSize ?? DEFAULT_PRG_WFS_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > DEFAULT_PRG_WFS_PAGE_SIZE) {
    throw new Error(`Invalid PRG WFS pageSize: ${pageSize}`);
  }

  const kinaTeryt = municipalityKinaTeryt(input.municipalityTerc);
  const rows: PrgAddressRow[] = [];
  const pages: PrgWfsPageEvidence[] = [];
  const seenPrgIds = new Set<string>();
  let expectedTotal: number | null = null;
  let startIndex = 0;

  while (expectedTotal === null || startIndex < expectedTotal) {
    const url = buildPrgWfsPageUrl({
      municipalityTerc: input.municipalityTerc,
      startIndex,
      count: pageSize,
    });
    const xml = await input.fetchPage(url);
    const counts = prgWfsCollectionCounts(xml);
    if (expectedTotal === null) expectedTotal = counts.numberMatched;
    if (counts.numberMatched !== expectedTotal) {
      throw new Error(
        `PRG WFS numberMatched drifted during pagination: expected ${expectedTotal}, got ${counts.numberMatched} at startIndex ${startIndex}`,
      );
    }
    if (expectedTotal > 0 && counts.numberReturned === 0) {
      throw new Error(`PRG WFS returned an empty page before total was exhausted at startIndex ${startIndex}`);
    }
    if (counts.numberReturned > pageSize) {
      throw new Error(`PRG WFS returned ${counts.numberReturned} rows for requested page size ${pageSize}`);
    }

    const parsed = parsePrgAddressGml(xml);
    if (parsed.rejected.length > 0) {
      throw new Error(
        `PRG WFS page at startIndex ${startIndex} contained ${parsed.rejected.length} rejected address features: ${parsed.rejected[0]?.featureKey ?? 'unknown'} ${parsed.rejected[0]?.reason ?? ''}`.trim(),
      );
    }
    if (parsed.rows.length !== counts.numberReturned) {
      throw new Error(
        `PRG WFS parsed row count mismatch at startIndex ${startIndex}: numberReturned=${counts.numberReturned}, parsed=${parsed.rows.length}`,
      );
    }

    for (const row of parsed.rows) {
      if (row.municipalityTerc !== input.municipalityTerc) {
        throw new Error(
          `PRG WFS row ${row.prgId} escaped municipality scope: expected ${input.municipalityTerc}, got ${row.municipalityTerc}`,
        );
      }
      if (seenPrgIds.has(row.prgId)) {
        throw new Error(`Duplicate PRG id across WFS pages: ${row.prgId}`);
      }
      seenPrgIds.add(row.prgId);
      rows.push(row);
    }

    pages.push({
      startIndex,
      requestedCount: pageSize,
      numberMatched: counts.numberMatched,
      numberReturned: counts.numberReturned,
      parsedRows: parsed.rows.length,
      sha256: sha256(xml),
    });
    startIndex += counts.numberReturned;
  }

  const total = expectedTotal ?? 0;
  if (rows.length !== total) {
    throw new Error(`PRG WFS acquisition incomplete: expected ${total} rows, captured ${rows.length}`);
  }

  rows.sort((left, right) => left.prgId.localeCompare(right.prgId, 'pl-PL'));
  const aggregateSha256 = sha256(canonicalAggregate(rows, pages));

  return {
    municipalityTerc: input.municipalityTerc,
    kinaTeryt,
    sourceUrl: PRG_KINA_WFS_URL,
    retrievedAt: input.retrievedAt ?? new Date().toISOString(),
    pageSize,
    totalRows: rows.length,
    rows,
    pages,
    aggregateSha256,
  };
}
