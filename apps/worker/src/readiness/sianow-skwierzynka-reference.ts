import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-sianow-skwierzynka-20260906.json',
);

export const SIANOW_TERC = '3209073';
export const SKWIERZYNKA_SIMC = '0311125';
export const SKWIERZYNKA_SERVICE_AREA = 'sianow-skwierzynka-single-family';
export const SKWIERZYNKA_TOTAL_ADDRESS_COUNT = 357;
export const SKWIERZYNKA_SAFE_ADDRESS_COUNT = 345;
export const SKWIERZYNKA_PRG_RESPONSE_SHA256 = 'd4f580744bd3c74a9b07441c9fccf7895b3c256de73c93761cac3d93a8712358';

// Excluded from standard single-family route due to 15-utrudnione.pdf
export const SKWIERZYNKA_EXCLUDED_STREETS = new Set(['Brylantowa', 'Sudecka']);
export const SKWIERZYNKA_EXCLUDED_ADDRESSES = new Set([
  'Diamentowa:2',
  'Karkonoska:9',
  'Kryształowa:5',
  'Kwarcowa:1',
  'Marmurowa:52',
]);

export function isSkwierzynkaSafeAddress(street: string | null, buildingNumber: string): boolean {
  if (street && SKWIERZYNKA_EXCLUDED_STREETS.has(street)) {
    return false;
  }
  const key = `${street ?? ''}:${buildingNumber}`;
  if (SKWIERZYNKA_EXCLUDED_ADDRESSES.has(key)) {
    return false;
  }
  return true;
}

const EXPECTED_FIELDS = [
  'prgId',
  'municipalityTerc',
  'locality',
  'simc',
  'street',
  'ulic',
  'buildingNumber',
  'postalCode',
  'x2180',
  'y2180',
  'serviceArea',
] as const;

type SnapshotTuple = [
  prgId: string,
  municipalityTerc: string,
  locality: string,
  simc: string,
  street: string | null,
  ulic: string | null,
  buildingNumber: string,
  postalCode: string | null,
  x2180: number,
  y2180: number,
  serviceArea: string,
];

export interface SianowSkwierzynkaGoldenAddress {
  prgId: string;
  municipalityTerc: string;
  locality: string;
  simc: string;
  street: string | null;
  ulic: string | null;
  buildingNumber: string;
  postalCode: string | null;
  x2180: number;
  y2180: number;
  serviceArea: string;
  isSafeSubset: boolean;
}

interface RawSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: {
    provider: string;
    dataset: string;
    uugUrl: string;
    query: string;
    responseSha256: string;
    coordinateNote: string;
  };
  selection: {
    total: number;
    municipalityTerc: string;
    locality: string;
    simc: string;
    serviceArea: string;
  };
  fields: string[];
  addresses: SnapshotTuple[];
}

export interface SianowSkwierzynkaReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: RawSnapshot['source'];
  selection: RawSnapshot['selection'];
  addresses: SianowSkwierzynkaGoldenAddress[];
  safeAddresses: SianowSkwierzynkaGoldenAddress[];
}

function decodeTuple(tuple: SnapshotTuple): SianowSkwierzynkaGoldenAddress {
  const [
    prgId,
    municipalityTerc,
    locality,
    simc,
    street,
    ulic,
    buildingNumber,
    postalCode,
    x2180,
    y2180,
    serviceArea,
  ] = tuple;
  const isSafe = isSkwierzynkaSafeAddress(street, buildingNumber);
  return {
    prgId,
    municipalityTerc,
    locality,
    simc,
    street,
    ulic,
    buildingNumber,
    postalCode,
    x2180,
    y2180,
    serviceArea,
    isSafeSubset: isSafe,
  };
}

function validateSnapshot(raw: RawSnapshot): SianowSkwierzynkaReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported Skwierzynka PRG snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-09-06') throw new Error(`Unexpected Skwierzynka PRG snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Skwierzynka PRG snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (
    raw.selection.total !== SKWIERZYNKA_TOTAL_ADDRESS_COUNT ||
    raw.selection.municipalityTerc !== SIANOW_TERC ||
    raw.selection.locality !== 'Skwierzynka' ||
    raw.selection.simc !== SKWIERZYNKA_SIMC ||
    raw.selection.serviceArea !== SKWIERZYNKA_SERVICE_AREA
  ) {
    throw new Error(`Skwierzynka PRG snapshot selection drifted: ${JSON.stringify(raw.selection)}`);
  }
  if (raw.source.responseSha256 !== SKWIERZYNKA_PRG_RESPONSE_SHA256) {
    throw new Error('Skwierzynka PRG source evidence drifted');
  }
  if (raw.addresses.length !== SKWIERZYNKA_TOTAL_ADDRESS_COUNT) {
    throw new Error(`Expected ${SKWIERZYNKA_TOTAL_ADDRESS_COUNT} Skwierzynka PRG rows, got ${raw.addresses.length}`);
  }

  const addresses = raw.addresses.map(decodeTuple);
  const seenPrgIds = new Set<string>();

  for (const address of addresses) {
    if (seenPrgIds.has(address.prgId)) {
      throw new Error(`Duplicate PRG ID in Skwierzynka reference: ${address.prgId}`);
    }
    seenPrgIds.add(address.prgId);

    if (address.municipalityTerc !== SIANOW_TERC || address.simc !== SKWIERZYNKA_SIMC) {
      throw new Error(`Inconsistent TERC/SIMC in Skwierzynka row ${address.prgId}`);
    }
  }

  const safeAddresses = addresses.filter((a) => a.isSafeSubset);
  if (safeAddresses.length !== SKWIERZYNKA_SAFE_ADDRESS_COUNT) {
    throw new Error(`Expected ${SKWIERZYNKA_SAFE_ADDRESS_COUNT} safe addresses, got ${safeAddresses.length}`);
  }

  return {
    schemaVersion: raw.schemaVersion,
    snapshotDate: raw.snapshotDate,
    source: raw.source,
    selection: raw.selection,
    addresses,
    safeAddresses,
  };
}

export async function loadSianowSkwierzynkaReferenceSnapshot(): Promise<SianowSkwierzynkaReferenceSnapshot> {
  const content = await readFile(snapshotPath, 'utf8');
  return validateSnapshot(JSON.parse(content) as RawSnapshot);
}

export interface LocalitySeed {
  simc: string;
  name: string;
  localityTypeCode: string;
  parentSimc: string | null;
}

export const SKWIERZYNKA_LOCALITY: LocalitySeed = {
  simc: '0311125',
  name: 'Skwierzynka',
  localityTypeCode: 'WIES',
  parentSimc: null,
};

export async function hydrateSianowSkwierzynkaReferenceBackbone(pool: Pool): Promise<{
  municipalityId: string;
  localityId: string;
  addressIds: string[];
}> {
  const snapshot = await loadSianowSkwierzynkaReferenceSnapshot();

  const municipalityResult = await pool.query<QueryResultRow & { id: string }>(
    `SELECT id FROM municipalities WHERE terc = $1 LIMIT 1`,
    [SIANOW_TERC],
  );
  const municipalityId = municipalityResult.rows[0]?.id;
  if (!municipalityId) {
    throw new Error(`Sianów municipality (TERC ${SIANOW_TERC}) missing in database`);
  }

  const locResult = await pool.query<QueryResultRow & { id: string }>(
    `INSERT INTO localities (
       municipality_id, simc, name, locality_type_code, parent_simc, active
     ) VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (simc) DO UPDATE SET
       name = EXCLUDED.name,
       locality_type_code = EXCLUDED.locality_type_code,
       active = true
     RETURNING id`,
    [
      municipalityId,
      SKWIERZYNKA_LOCALITY.simc,
      SKWIERZYNKA_LOCALITY.name,
      SKWIERZYNKA_LOCALITY.localityTypeCode,
      SKWIERZYNKA_LOCALITY.parentSimc,
    ],
  );
  const localityId = locResult.rows[0]!.id;

  const addressIds: string[] = [];

  for (const address of snapshot.safeAddresses) {
    const streetPart = address.street ? `ul. ${address.street} ` : '';
    const canonicalText = `Skwierzynka, ${streetPart}${address.buildingNumber}, ${address.postalCode ?? '75-016'} Skwierzynka`;

    const addrResult = await pool.query<QueryResultRow & { id: string }>(
      `INSERT INTO addresses (
         prg_id, municipality_id, locality_id, street_id, building_number,
         postal_code, canonical_text, geom, active
       ) VALUES (
         $1, $2, $3, NULL, $4,
         $5, $6, ST_Transform(ST_SetSRID(ST_MakePoint($7, $8), 2180), 4326), true
       )
       ON CONFLICT (prg_id) DO UPDATE SET
         building_number = EXCLUDED.building_number,
         postal_code = EXCLUDED.postal_code,
         canonical_text = EXCLUDED.canonical_text,
         geom = EXCLUDED.geom,
         active = true
       RETURNING id`,
      [
        address.prgId,
        municipalityId,
        localityId,
        address.buildingNumber,
        address.postalCode,
        canonicalText,
        address.x2180,
        address.y2180,
      ],
    );
    addressIds.push(addrResult.rows[0]!.id);
  }

  return { municipalityId, localityId, addressIds };
}

export function sianowSkwierzynkaPrgRows(snapshot: SianowSkwierzynkaReferenceSnapshot): PrgAddressRow[] {
  return snapshot.safeAddresses.map((address) => ({
    prgId: address.prgId,
    municipalityTerc: address.municipalityTerc,
    simc: address.simc,
    ulic: address.ulic,
    buildingNumber: address.buildingNumber,
    postalCode: address.postalCode,
    status: null,
    validFrom: null,
    validTo: null,
    sourceUpdatedAt: null,
    x: address.x2180,
    y: address.y2180,
    crs: 'EPSG:2180',
  }));
}
