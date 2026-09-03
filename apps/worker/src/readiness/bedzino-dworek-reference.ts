import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-bedzino-dworek-20260903.json',
);

export const BEDZINO_TERC = '3209012';
export const DWOREK_SIMC = '0302400';
export const DWOREK_SERVICE_AREA = 'bedzino-trasa-1-safe-dworek';
export const DWOREK_REAL_ADDRESS_COUNT = 13;
export const DWOREK_PRG_RESPONSE_SHA256 = 'b9d03829ad4148e6583907c14e1a069e4f58bc12a6730702d41a7d65b6f12ab5';

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

export interface BedzinoDworekGoldenAddress {
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
    querySimc: string;
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

export interface BedzinoDworekReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: RawSnapshot['source'];
  selection: RawSnapshot['selection'];
  addresses: BedzinoDworekGoldenAddress[];
}

function decodeTuple(tuple: SnapshotTuple): BedzinoDworekGoldenAddress {
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

function validateSnapshot(raw: RawSnapshot): BedzinoDworekReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported Dworek PRG snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-09-03') throw new Error(`Unexpected Dworek PRG snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Dworek PRG snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (
    raw.selection.total !== DWOREK_REAL_ADDRESS_COUNT ||
    raw.selection.municipalityTerc !== BEDZINO_TERC ||
    raw.selection.locality !== 'Dworek' ||
    raw.selection.simc !== DWOREK_SIMC ||
    raw.selection.serviceArea !== DWOREK_SERVICE_AREA
  ) {
    throw new Error(`Dworek PRG snapshot selection drifted: ${JSON.stringify(raw.selection)}`);
  }
  if (raw.source.querySimc !== DWOREK_SIMC || raw.source.responseSha256 !== DWOREK_PRG_RESPONSE_SHA256) {
    throw new Error('Dworek PRG source evidence drifted');
  }
  if (raw.addresses.length !== DWOREK_REAL_ADDRESS_COUNT) {
    throw new Error(`Expected ${DWOREK_REAL_ADDRESS_COUNT} Dworek PRG rows, got ${raw.addresses.length}`);
  }

  const addresses = raw.addresses.map(decodeTuple);
  const ids = new Set<string>();
  const canonicalNumbers = new Set<string>();
  for (const address of addresses) {
    if (ids.has(address.prgId)) throw new Error(`Duplicate Dworek PRG id ${address.prgId}`);
    ids.add(address.prgId);
    const numberKey = address.buildingNumber.toLocaleUpperCase('pl-PL');
    if (canonicalNumbers.has(numberKey)) throw new Error(`Duplicate Dworek building number ${address.buildingNumber}`);
    canonicalNumbers.add(numberKey);
    if (
      address.municipalityTerc !== BEDZINO_TERC ||
      address.locality !== 'Dworek' ||
      address.simc !== DWOREK_SIMC ||
      address.street !== null ||
      address.ulic !== null ||
      address.serviceArea !== DWOREK_SERVICE_AREA
    ) {
      throw new Error(`Dworek PRG row scope drifted for ${address.prgId}`);
    }
    if (!address.buildingNumber.trim() || !Number.isFinite(address.x2180) || !Number.isFinite(address.y2180)) {
      throw new Error(`Incomplete Dworek PRG row ${address.prgId}`);
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

export async function loadBedzinoDworekReferenceSnapshot(): Promise<BedzinoDworekReferenceSnapshot> {
  const raw = JSON.parse(await readFile(snapshotPath, 'utf8')) as RawSnapshot;
  return validateSnapshot(raw);
}

export function bedzinoDworekPrgRows(snapshot: BedzinoDworekReferenceSnapshot): PrgAddressRow[] {
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

export async function hydrateBedzinoDworekReferenceBackbone(
  pool: Pool,
  snapshot: BedzinoDworekReferenceSnapshot,
): Promise<void> {
  const municipality = await pool.query<IdRow>(
    'SELECT id FROM municipalities WHERE terc=$1 AND active=true',
    [BEDZINO_TERC],
  );
  const municipalityId = municipality.rows[0]?.id;
  if (!municipalityId) throw new Error(`Missing official municipality TERC ${BEDZINO_TERC} before Dworek hydration`);

  await pool.query(
    `INSERT INTO localities (
       simc, municipality_id, name, locality_type_code, parent_simc,
       active, source_updated_at
     ) VALUES ($1,$2,'Dworek',NULL,NULL,true,$3::date)
     ON CONFLICT (simc) DO UPDATE SET
       municipality_id=EXCLUDED.municipality_id,
       name='Dworek',
       active=true,
       source_updated_at=EXCLUDED.source_updated_at,
       updated_at=now()`,
    [DWOREK_SIMC, municipalityId, snapshot.snapshotDate],
  );
}
