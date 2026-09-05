import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-sianow-dabrowa-rural-20260906.json',
);

export const SIANOW_TERC = '3209073';
export const DABROWA_SIMC = '0310835';
export const DABROWA_SERVICE_AREA = 'sianow-safe-h2-dabrowa';
export const DABROWA_REAL_ADDRESS_COUNT = 93;
export const DABROWA_PRG_RESPONSE_SHA256 = '9b1f27ecb8b6474158224fe040bc9c9c3c6acd10170654a6d33f5509874f50d2';

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
  street: null,
  ulic: null,
  buildingNumber: string,
  postalCode: string | null,
  x2180: number,
  y2180: number,
  serviceArea: string,
];

export interface SianowDabrowaGoldenAddress {
  prgId: string;
  municipalityTerc: string;
  locality: string;
  simc: string;
  street: null;
  ulic: null;
  buildingNumber: string;
  postalCode: string | null;
  x2180: number;
  y2180: number;
  serviceArea: string;
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

export interface SianowDabrowaReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: RawSnapshot['source'];
  selection: RawSnapshot['selection'];
  addresses: SianowDabrowaGoldenAddress[];
}

function decodeTuple(tuple: SnapshotTuple): SianowDabrowaGoldenAddress {
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
  };
}

function validateSnapshot(raw: RawSnapshot): SianowDabrowaReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported Dąbrowa PRG snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-09-06') throw new Error(`Unexpected Dąbrowa PRG snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Dąbrowa PRG snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (
    raw.selection.total !== DABROWA_REAL_ADDRESS_COUNT ||
    raw.selection.municipalityTerc !== SIANOW_TERC ||
    raw.selection.locality !== 'Dąbrowa' ||
    raw.selection.simc !== DABROWA_SIMC ||
    raw.selection.serviceArea !== DABROWA_SERVICE_AREA
  ) {
    throw new Error(`Dąbrowa PRG snapshot selection drifted: ${JSON.stringify(raw.selection)}`);
  }
  if (raw.source.responseSha256 !== DABROWA_PRG_RESPONSE_SHA256) {
    throw new Error('Dąbrowa PRG source evidence drifted');
  }
  if (raw.addresses.length !== DABROWA_REAL_ADDRESS_COUNT) {
    throw new Error(`Expected ${DABROWA_REAL_ADDRESS_COUNT} Dąbrowa PRG rows, got ${raw.addresses.length}`);
  }

  const addresses = raw.addresses.map(decodeTuple);
  const seenPrgIds = new Set<string>();
  const seenNumbers = new Set<string>();

  for (const address of addresses) {
    if (seenPrgIds.has(address.prgId)) {
      throw new Error(`Duplicate PRG ID in Dąbrowa reference: ${address.prgId}`);
    }
    seenPrgIds.add(address.prgId);

    if (seenNumbers.has(address.buildingNumber)) {
      throw new Error(`Duplicate building number in Dąbrowa reference: ${address.buildingNumber}`);
    }
    seenNumbers.add(address.buildingNumber);

    if (address.municipalityTerc !== SIANOW_TERC || address.simc !== DABROWA_SIMC) {
      throw new Error(`Inconsistent TERC/SIMC in Dąbrowa row ${address.prgId}`);
    }
  }

  return {
    schemaVersion: raw.schemaVersion,
    snapshotDate: raw.snapshotDate,
    source: raw.source,
    selection: raw.selection,
    addresses,
  };
}

export async function loadSianowDabrowaReferenceSnapshot(): Promise<SianowDabrowaReferenceSnapshot> {
  const content = await readFile(snapshotPath, 'utf8');
  return validateSnapshot(JSON.parse(content) as RawSnapshot);
}

export interface LocalitySeed {
  simc: string;
  name: string;
  localityTypeCode: string;
  parentSimc: string | null;
}

export const DABROWA_LOCALITY: LocalitySeed = {
  simc: '0310835',
  name: 'Dąbrowa',
  localityTypeCode: 'WIES',
  parentSimc: null,
};

export async function hydrateSianowDabrowaReferenceBackbone(pool: Pool): Promise<{
  municipalityId: string;
  localityId: string;
  addressIds: string[];
}> {
  const snapshot = await loadSianowDabrowaReferenceSnapshot();

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
      DABROWA_LOCALITY.simc,
      DABROWA_LOCALITY.name,
      DABROWA_LOCALITY.localityTypeCode,
      DABROWA_LOCALITY.parentSimc,
    ],
  );
  const localityId = locResult.rows[0]!.id;

  const addressIds: string[] = [];

  for (const address of snapshot.addresses) {
    const canonicalText = `Dąbrowa ${address.buildingNumber}, ${address.postalCode ?? '76-004'} Dąbrowa`;

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

export function sianowDabrowaPrgRows(snapshot: SianowDabrowaReferenceSnapshot): PrgAddressRow[] {
  return snapshot.addresses.map((address) => ({
    prgId: address.prgId,
    municipalityTerc: address.municipalityTerc,
    simc: address.simc,
    ulic: null,
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
