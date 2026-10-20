import { createHash } from 'node:crypto';
import type { PrgAddressRow } from './types.js';

export const PRG_KINA_WFS_URL = 'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej';
export const DEFAULT_PRG_WFS_PAGE_SIZE = 2000;

export interface PrgWfsCollectionCounts {
  numberMatched: number | null;
  numberMatchedRaw: string;
  numberReturned: number;
  nextStartIndex: number | null;
}

export interface PrgWfsPageEvidence {
  startIndex: number;
  requestedCount: number;
  numberMatched: number | null;
  numberMatchedRaw: string;
  numberReturned: number;
  nextStartIndex: number | null;
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

interface ParsedKinaPage {
  rows: PrgAddressRow[];
  rejected: Array<{ featureKey: string; reason: string }>;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function decodeXmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function rootAttribute(xml: string, name: string): string | null {
  const root = /<wfs:FeatureCollection\b[\s\S]*?>/i.exec(xml)?.[0];
  if (!root) throw new Error('PRG WFS response does not contain wfs:FeatureCollection');
  const match = new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(root);
  return match?.[1] ? decodeXmlAttribute(match[1]) : null;
}

function requiredNonNegativeIntegerAttribute(xml: string, name: string): number {
  const raw = rootAttribute(xml, name);
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error(`PRG WFS FeatureCollection missing numeric ${name}`);
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`PRG WFS FeatureCollection invalid ${name}: ${raw}`);
  }
  return value;
}

function nextStartIndexFromLink(nextLink: string | null): number | null {
  if (!nextLink) return null;
  let url: URL;
  try {
    url = new URL(nextLink);
  } catch {
    throw new Error('PRG WFS FeatureCollection contains invalid next URL');
  }

  const expected = new URL(PRG_KINA_WFS_URL);
  const supportedProtocol = url.protocol === 'https:' || url.protocol === 'http:';
  const canonicalEndpoint =
    supportedProtocol &&
    url.hostname === expected.hostname &&
    url.port === '' &&
    url.pathname === expected.pathname &&
    url.username === '' &&
    url.password === '';
  if (!canonicalEndpoint) {
    throw new Error(`PRG WFS next URL escaped official endpoint: ${url.protocol}//${url.host}${url.pathname}`);
  }

  // KINA currently emits an http:// next-link even for an https:// request. We never
  // follow that URL; we only validate/extract STARTINDEX and rebuild the next request
  // ourselves with PRG_KINA_WFS_URL (HTTPS), the original municipality filter and page size.
  const entry = [...url.searchParams.entries()].find(([key]) => key.toLocaleLowerCase('en-US') === 'startindex');
  const raw = entry?.[1];
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error('PRG WFS next URL is missing numeric STARTINDEX');
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`PRG WFS next URL has invalid STARTINDEX: ${raw}`);
  }
  return value;
}

/**
 * GUGiK KINA returns WFS 2.0 with numeric `numberReturned` and server `next` pagination.
 * In the observed live contract intermediate pages can expose `numberMatched="unknown"`
 * while the final partial page switches to the authoritative numeric total.
 */
export function prgWfsCollectionCounts(xml: string): PrgWfsCollectionCounts {
  const numberMatchedRaw = rootAttribute(xml, 'numberMatched');
  if (!numberMatchedRaw || !(numberMatchedRaw === 'unknown' || /^\d+$/.test(numberMatchedRaw))) {
    throw new Error(`PRG WFS FeatureCollection invalid numberMatched: ${numberMatchedRaw ?? 'missing'}`);
  }
  const numberMatched = numberMatchedRaw === 'unknown'
    ? null
    : Number.parseInt(numberMatchedRaw, 10);
  if (numberMatched !== null && (!Number.isSafeInteger(numberMatched) || numberMatched < 0)) {
    throw new Error(`PRG WFS FeatureCollection invalid numberMatched: ${numberMatchedRaw}`);
  }

  return {
    numberMatched,
    numberMatchedRaw,
    numberReturned: requiredNonNegativeIntegerAttribute(xml, 'numberReturned'),
    nextStartIndex: nextStartIndexFromLink(rootAttribute(xml, 'next')),
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

function localText(feature: string, localName: string): string | null {
  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${localName}>`,
    'i',
  );
  const match = pattern.exec(feature);
  if (!match?.[1]) return null;
  return match[1].replace(/<[^>]+>/g, '').trim() || null;
}

function parseKinaFeature(
  feature: string,
  municipalityTerc: string,
  kinaTeryt: string,
): PrgAddressRow {
  const opening = /<(?:[A-Za-z_][\w.-]*:)?prg-adresy\b[^>]*>/i.exec(feature)?.[0];
  if (!opening) throw new Error('missing prg-adresy opening tag');
  const idRaw = /\bgml:id=["'](prg-adresy\.[^"']+)["']/i.exec(opening)?.[1];
  if (!idRaw || !/^prg-adresy\.\d+$/i.test(idRaw)) {
    throw new Error(`invalid gml:id ${idRaw ?? 'missing'}`);
  }

  const sourceTeryt = localText(feature, 'teryt');
  if (sourceTeryt !== kinaTeryt) {
    throw new Error(`source teryt ${sourceTeryt ?? 'missing'} does not match KINA scope ${kinaTeryt}`);
  }

  const simc = localText(feature, 'simc');
  if (!simc || !/^\d{7}$/.test(simc)) throw new Error(`invalid SIMC ${simc ?? 'missing'}`);
  const ulic = localText(feature, 'ulic');
  if (ulic !== null && !/^\d{5}$/.test(ulic)) throw new Error(`invalid ULIC ${ulic}`);
  const buildingNumber = localText(feature, 'numer')?.toLocaleUpperCase('pl-PL');
  if (!buildingNumber) throw new Error('missing building number');
  const postalCode = localText(feature, 'kod');

  const point = /<gml:Point\b[^>]*srsName=["'][^"']*2180[^"']*["'][^>]*>[\s\S]*?<gml:pos\b[^>]*>\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*<\/gml:pos>[\s\S]*?<\/gml:Point>/i.exec(feature);
  if (!point?.[1] || !point[2]) throw new Error('missing EPSG:2180 point geometry');
  const northing = Number.parseFloat(point[1]);
  const easting = Number.parseFloat(point[2]);
  if (!Number.isFinite(northing) || !Number.isFinite(easting)) {
    throw new Error('invalid EPSG:2180 point geometry');
  }

  return {
    // Preserve the canonical KINA feature identifier used by existing audited snapshots and prg_id persistence.
    prgId: idRaw,
    municipalityTerc,
    simc,
    ulic,
    buildingNumber,
    postalCode,
    status: null,
    validFrom: null,
    validTo: null,
    sourceUpdatedAt: null,
    // KINA GML encodes EPSG:2180 pos as northing,easting; PostGIS x/y must be easting,northing.
    x: easting,
    y: northing,
    crs: 'EPSG:2180',
  };
}

export function parseKinaPrgAddressGml(
  xml: string,
  municipalityTerc: string,
): ParsedKinaPage {
  const kinaTeryt = municipalityKinaTeryt(municipalityTerc);
  const features = xml.match(/<(?:[A-Za-z_][\w.-]*:)?prg-adresy\b[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?prg-adresy>/gi) ?? [];
  const rows: PrgAddressRow[] = [];
  const rejected: ParsedKinaPage['rejected'] = [];

  for (const feature of features) {
    const opening = /<(?:[A-Za-z_][\w.-]*:)?prg-adresy\b[^>]*>/i.exec(feature)?.[0] ?? '';
    const featureKey = /\bgml:id=["']([^"']+)["']/i.exec(opening)?.[1] ?? `feature-${rows.length + rejected.length + 1}`;
    try {
      rows.push(parseKinaFeature(feature, municipalityTerc, kinaTeryt));
    } catch (error) {
      rejected.push({
        featureKey,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { rows, rejected };
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
    pages: pages.map((page) => ({
      startIndex: page.startIndex,
      numberMatchedRaw: page.numberMatchedRaw,
      numberReturned: page.numberReturned,
      nextStartIndex: page.nextStartIndex,
      sha256: page.sha256,
    })),
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
  let expectedTotal: number | null | undefined;
  let startIndex = 0;

  for (;;) {
    const url = buildPrgWfsPageUrl({
      municipalityTerc: input.municipalityTerc,
      startIndex,
      count: pageSize,
    });
    const xml = await input.fetchPage(url);
    const counts = prgWfsCollectionCounts(xml);

    if (expectedTotal === undefined) {
      expectedTotal = counts.numberMatched;
    } else if (expectedTotal === null && counts.numberMatched !== null) {
      // Live KINA can reveal the authoritative numeric total only on the final partial page.
      // Once learned, the total becomes sticky and all subsequent pagination must agree with it.
      expectedTotal = counts.numberMatched;
    } else if (counts.numberMatched !== expectedTotal) {
      throw new Error(
        `PRG WFS numberMatched drifted during pagination: expected ${expectedTotal ?? 'unknown'}, got ${counts.numberMatched ?? 'unknown'} at startIndex ${startIndex}`,
      );
    }

    if (counts.numberReturned > pageSize) {
      throw new Error(`PRG WFS returned ${counts.numberReturned} rows for requested page size ${pageSize}`);
    }
    if (counts.numberReturned === 0 && counts.nextStartIndex !== null) {
      throw new Error(`PRG WFS returned an empty page with next link at startIndex ${startIndex}`);
    }

    const parsed = parseKinaPrgAddressGml(xml, input.municipalityTerc);
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
      numberMatchedRaw: counts.numberMatchedRaw,
      numberReturned: counts.numberReturned,
      nextStartIndex: counts.nextStartIndex,
      parsedRows: parsed.rows.length,
      sha256: sha256(xml),
    });

    const expectedNext = startIndex + counts.numberReturned;
    if (counts.nextStartIndex !== null) {
      if (counts.nextStartIndex !== expectedNext || counts.nextStartIndex <= startIndex) {
        throw new Error(
          `PRG WFS next STARTINDEX is not contiguous: expected ${expectedNext}, got ${counts.nextStartIndex}`,
        );
      }
      if (expectedTotal !== null && expectedNext >= expectedTotal) {
        throw new Error(`PRG WFS exposed next page after numeric numberMatched=${expectedTotal}`);
      }
      startIndex = counts.nextStartIndex;
      continue;
    }

    if (expectedTotal !== null) {
      if (expectedNext !== expectedTotal) {
        throw new Error(`PRG WFS acquisition incomplete: expected ${expectedTotal} rows, captured ${expectedNext}`);
      }
      break;
    }

    // KINA currently reports numberMatched="unknown". If a full page arrives without
    // a server next link, make one sentinel request rather than silently truncate.
    if (counts.numberReturned === pageSize && counts.numberReturned > 0) {
      startIndex = expectedNext;
      continue;
    }
    break;
  }

  if (expectedTotal !== null && expectedTotal !== undefined && rows.length !== expectedTotal) {
    throw new Error(`PRG WFS acquisition incomplete: expected ${expectedTotal} rows, captured ${rows.length}`);
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
