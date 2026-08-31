import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-polanow-garbno-20260829.json',
);

export const POLANOW_TERC = '3209063';
export const GARBNO_SIMC = '0308749';
export const GARBNO_SERVICE_AREA = 'polanow-garbno-single-family';
export const GARBNO_REAL_ADDRESS_COUNT = 39;
export const GARBNO_PRG_RESPONSE_SHA256 = '046744234ebfe444a5327af87450b463f19ea9dc72132f3452cf3d38ed48419a';

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

export interface PolanowGarbnoGoldenAddress {
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
    wfsUrl: string;
    wfsLayer: string;
    query: string;
    querySimc: string;
    responseSha256: string;
    workflowRun: number;
    artifactId: number;
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

export interface PolanowGarbnoReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: RawSnapshot['source'];
  selection: RawSnapshot['selection'];
  addresses: PolanowGarbnoGoldenAddress[];
}

function decodeTuple(tuple: SnapshotTuple): PolanowGarbnoGoldenAddress {
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

function validateSnapshot(raw: RawSnapshot): PolanowGarbnoReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported Garbno PRG snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-08-29') throw new Error(`Unexpected Garbno PRG snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Garbno PRG snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (
    raw.selection.total !== GARBNO_REAL_ADDRESS_COUNT ||
    raw.selection.municipalityTerc !== POLANOW_TERC ||
    raw.selection.locality !== 'Garbno' ||
    raw.selection.simc !== GARBNO_SIMC ||
    raw.selection.serviceArea !== GARBNO_SERVICE_AREA
  ) {
    throw new Error(`Garbno PRG snapshot selection drifted: ${JSON.stringify(raw.selection)}`);
  }
  if (raw.source.querySimc !== GARBNO_SIMC || raw.source.responseSha256 !== GARBNO_PRG_RESPONSE_SHA256) {
    throw new Error('Garbno PRG source evidence drifted');
  }
  if (raw.addresses.length !== GARBNO_REAL_ADDRESS_COUNT) {
    throw new Error(`Expected ${GARBNO_REAL_ADDRESS_COUNT} Garbno PRG rows, got ${raw.addresses.length}`);
  }

  const addresses = raw.addresses.map(decodeTuple);
  const ids = new Set<string>();
  const canonicalNumbers = new Set<string>();
  for (const address of addresses) {
    if (!/^prg-adresy\.\d+$/.test(address.prgId)) {
      throw new Error(`Garbno address ${address.prgId} is not an exact GUGiK WFS feature id`);
    }
    if (ids.has(address.prgId)) throw new Error(`Duplicate Garbno PRG id ${address.prgId}`);
    ids.add(address.prgId);
    const numberKey = address.buildingNumber.toLocaleUpperCase('pl-PL');
    if (canonicalNumbers.has(numberKey)) throw new Error(`Duplicate Garbno building number ${address.buildingNumber}`);
    canonicalNumbers.add(numberKey);
    if (
      address.municipalityTerc !== POLANOW_TERC ||
      address.locality !== 'Garbno' ||
      address.simc !== GARBNO_SIMC ||
      address.street !== null ||
      address.ulic !== null ||
      address.serviceArea !== GARBNO_SERVICE_AREA
    ) {
      throw new Error(`Garbno PRG row scope drifted for ${address.prgId}`);
    }
    if (!address.buildingNumber.trim() || !Number.isFinite(address.x2180) || !Number.isFinite(address.y2180)) {
      throw new Error(`Incomplete Garbno PRG row ${address.prgId}`);
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

export async function loadPolanowGarbnoReferenceSnapshot(): Promise<PolanowGarbnoReferenceSnapshot> {
  const raw = JSON.parse(await readFile(snapshotPath, 'utf8')) as RawSnapshot;
  return validateSnapshot(raw);
}

export function polanowGarbnoPrgRows(snapshot: PolanowGarbnoReferenceSnapshot): PrgAddressRow[] {
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

interface IdRow extends QueryResultRow { id: string }

/**
 * The frozen PRG evidence contains the authoritative locality identity needed by
 * these address rows. It deliberately hydrates only that evidence and leaves
 * TERYT-only attributes NULL rather than inventing them.
 */
export async function hydratePolanowGarbnoReferenceBackbone(
  pool: Pool,
  snapshot: PolanowGarbnoReferenceSnapshot,
): Promise<void> {
  const municipality = await pool.query<IdRow>(
    'SELECT id FROM municipalities WHERE terc=$1 AND active=true',
    [POLANOW_TERC],
  );
  const municipalityId = municipality.rows[0]?.id;
  if (!municipalityId) throw new Error(`Missing official municipality TERC ${POLANOW_TERC} before Garbno hydration`);

  await pool.query(
    `INSERT INTO localities (
       simc, municipality_id, name, locality_type_code, parent_simc,
       active, source_updated_at
     ) VALUES ($1,$2,'Garbno',NULL,NULL,true,$3::date)
     ON CONFLICT (simc) DO UPDATE SET
       municipality_id=EXCLUDED.municipality_id,
       name='Garbno',
       active=true,
       source_updated_at=EXCLUDED.source_updated_at,
       updated_at=now()`,
    [GARBNO_SIMC, municipalityId, snapshot.snapshotDate],
  );
}
