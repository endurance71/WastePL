import type { PrgAddressRow, PrgCrs } from './types.js';

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function tagText(xml: string, names: string[]): string | null {
  for (const name of names) {
    const pattern = new RegExp(`<(?:(?:[A-Za-z0-9_-]+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`, 'i');
    const match = pattern.exec(xml);
    if (match?.[1] !== undefined) {
      const withoutTags = match[1].replace(/<[^>]+>/g, ' ');
      const value = decodeXml(withoutTags).replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }
  return null;
}

function attrValue(xml: string, tagLocalName: string, attrLocalName: string): string | null {
  const tag = new RegExp(`<(?:(?:[A-Za-z0-9_-]+):)?${tagLocalName}\\b([^>]*)>`, 'i').exec(xml);
  if (!tag?.[1]) return null;
  const attr = new RegExp(`(?:(?:[A-Za-z0-9_-]+):)?${attrLocalName}=["']([^"']+)["']`, 'i').exec(tag[1]);
  return attr?.[1] ? decodeXml(attr[1]) : null;
}

function normalizeCrs(value: string | null): PrgCrs {
  if (!value) throw new Error('PRG point missing srsName');
  if (/EPSG(?::|::|\/0\/)?4326/i.test(value)) return 'EPSG:4326';
  if (/EPSG(?::|::|\/0\/)?2180/i.test(value)) return 'EPSG:2180';
  throw new Error(`Unsupported PRG CRS: ${value}`);
}

function parsePosition(feature: string): { x: number; y: number; crs: PrgCrs } {
  const pointMatch = /<(?:(?:[A-Za-z0-9_-]+):)?Point\b([^>]*)>([\s\S]*?)<\/(?:(?:[A-Za-z0-9_-]+):)?Point>/i.exec(feature);
  if (!pointMatch) throw new Error('PRG address missing gml:Point');
  const srs = /srsName=["']([^"']+)["']/i.exec(pointMatch[1] ?? '')?.[1] ?? null;
  const crs = normalizeCrs(srs);
  const pos = tagText(pointMatch[2] ?? '', ['pos']);
  if (!pos) throw new Error('PRG address missing gml:pos');
  const numbers = pos.split(/[\s,]+/).filter(Boolean).map(Number);
  if (numbers.length !== 2 || numbers.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid PRG gml:pos: ${pos}`);
  }
  return { x: numbers[0]!, y: numbers[1]!, crs };
}

function required(feature: string, names: string[], label: string): string {
  const value = tagText(feature, names);
  if (!value) throw new Error(`PRG address missing ${label}`);
  return value;
}

function nullableDate(value: string | null, label: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) throw new Error(`Invalid PRG ${label}: ${value}`);
  return value;
}

export interface PrgParseResult {
  rows: PrgAddressRow[];
  rejected: Array<{ featureKey: string; reason: string }>;
}

export function parsePrgAddressGml(gml: string): PrgParseResult {
  const rows: PrgAddressRow[] = [];
  const rejected: Array<{ featureKey: string; reason: string }> = [];
  const featurePattern = /<(?:(?:[A-Za-z0-9_-]+):)?AD_PunktAdresowy\b[^>]*>([\s\S]*?)<\/(?:(?:[A-Za-z0-9_-]+):)?AD_PunktAdresowy>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = featurePattern.exec(gml)) !== null) {
    index += 1;
    const feature = match[0];
    let featureKey = `feature-${index}`;
    try {
      const nestedLocalId = tagText(feature, ['lokalnyId', 'localId']);
      const gmlId = attrValue(feature, 'AD_PunktAdresowy', 'id');
      const prgId = nestedLocalId ?? gmlId;
      if (!prgId) throw new Error('PRG address missing idIIP/local identifier');
      featureKey = prgId;

      const municipalityTerc = required(feature, ['terc', 'TERC'], 'TERC');
      const simc = required(feature, ['simc', 'SIMC', 'idMiejscowosci'], 'SIMC');
      const ulic = tagText(feature, ['ulic', 'ULIC', 'idUlicy']);
      const buildingNumber = required(feature, ['numerPorzadkowy', 'numer', 'buildingNumber'], 'building number');
      const postalCode = tagText(feature, ['kodPocztowy', 'postalCode']);
      const status = tagText(feature, ['status']);
      const validFrom = nullableDate(tagText(feature, ['waznyOd', 'validFrom']), 'validFrom');
      const validTo = nullableDate(tagText(feature, ['waznyDo', 'validTo']), 'validTo');
      const sourceUpdatedAt = nullableDate(
        tagText(feature, ['aktualnyOd', 'wersjaObiektu', 'sourceUpdatedAt']),
        'sourceUpdatedAt',
      );
      const position = parsePosition(feature);

      if (!/^\d{7}$/.test(municipalityTerc)) throw new Error(`Invalid PRG TERC: ${municipalityTerc}`);
      if (!/^\d{7}$/.test(simc)) throw new Error(`Invalid PRG SIMC: ${simc}`);
      if (ulic && !/^\d{5}$/.test(ulic)) throw new Error(`Invalid PRG ULIC: ${ulic}`);
      if (!buildingNumber.trim()) throw new Error('Empty PRG building number');

      rows.push({
        prgId,
        municipalityTerc,
        simc,
        ulic,
        buildingNumber: buildingNumber.trim().toUpperCase(),
        postalCode,
        status,
        validFrom: validFrom?.slice(0, 10) ?? null,
        validTo: validTo?.slice(0, 10) ?? null,
        sourceUpdatedAt,
        x: position.x,
        y: position.y,
        crs: position.crs,
      });
    } catch (error) {
      rejected.push({
        featureKey,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { rows, rejected };
}
