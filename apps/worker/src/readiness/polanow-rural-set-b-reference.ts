import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-polanow-rural-set-b-20260906.json',
);

export const POLANOW_TERC = '3209063';
export const POLANOW_RURAL_SET_B_SERVICE_AREA = 'polanow-rural-set-b-single-family';
export const POLANOW_RURAL_SET_B_REAL_ADDRESS_COUNT = 146;
export const POLANOW_RURAL_SET_B_PRG_RESPONSE_SHA256 = '0a2ef77853e38cc55eef44dc40675ed89cb71154fce76d43995d27e231f1f87c';

export const POLANOW_RURAL_SET_B_LOCALITIES: ReadonlyArray<{
  name: string;
  simc: string;
  localityTypeCode: string;
  parentSimc: string | null;
}> = [
  { name: 'Bożenice', simc: '0309186', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Buszyno', simc: '0308710', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Doły', simc: '0308991', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Komorowo', simc: '0309223', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Rochowo', simc: '0309111', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Rzeczyca Mała', simc: '0309134', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Warblewo', simc: '0309306', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Wielin', simc: '0309312', localityTypeCode: 'WIES', parentSimc: null },
];

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
    localities: string[];
    serviceArea: string;
  };
  fields: string[];
  addresses: SnapshotTuple[];
}

export interface PolanowRuralSetBGoldenAddress {
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

export interface PolanowRuralSetBReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: RawSnapshot['source'];
  selection: RawSnapshot['selection'];
  addresses: PolanowRuralSetBGoldenAddress[];
}

function decodeTuple(tuple: SnapshotTuple): PolanowRuralSetBGoldenAddress {
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

function validateSnapshot(raw: RawSnapshot): PolanowRuralSetBReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported Polanów Rural Set B PRG snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-09-06') throw new Error(`Unexpected Polanów Rural Set B PRG snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Polanów Rural Set B PRG snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (
    raw.selection.total !== POLANOW_RURAL_SET_B_REAL_ADDRESS_COUNT ||
    raw.selection.municipalityTerc !== POLANOW_TERC ||
    raw.selection.serviceArea !== POLANOW_RURAL_SET_B_SERVICE_AREA
  ) {
    throw new Error(`Polanów Rural Set B PRG snapshot selection drifted: ${JSON.stringify(raw.selection)}`);
  }
  if (raw.source.responseSha256 !== POLANOW_RURAL_SET_B_PRG_RESPONSE_SHA256) {
    throw new Error('Polanów Rural Set B PRG source evidence drifted');
  }
  if (raw.addresses.length !== POLANOW_RURAL_SET_B_REAL_ADDRESS_COUNT) {
    throw new Error(`Expected ${POLANOW_RURAL_SET_B_REAL_ADDRESS_COUNT} Polanów Rural Set B PRG rows, got ${raw.addresses.length}`);
  }

  const allowedLocalityNames = new Set(POLANOW_RURAL_SET_B_LOCALITIES.map((l) => l.name));
  const allowedSimcs = new Set(POLANOW_RURAL_SET_B_LOCALITIES.map((l) => l.simc));

  const addresses = raw.addresses.map(decodeTuple);
  const ids = new Set<string>();
  const localityNumbers = new Set<string>();

  for (const address of addresses) {
    if (ids.has(address.prgId)) throw new Error(`Duplicate Polanów Rural Set B PRG id ${address.prgId}`);
    ids.add(address.prgId);

    const locNumKey = `${address.simc}:${address.buildingNumber.toLocaleUpperCase('pl-PL')}`;
    if (localityNumbers.has(locNumKey)) {
      throw new Error(`Duplicate Polanów Rural Set B building number ${address.buildingNumber} in SIMC ${address.simc}`);
    }
    localityNumbers.add(locNumKey);

    if (
      address.municipalityTerc !== POLANOW_TERC ||
      !allowedLocalityNames.has(address.locality) ||
      !allowedSimcs.has(address.simc) ||
      address.street !== null ||
      address.ulic !== null ||
      address.serviceArea !== POLANOW_RURAL_SET_B_SERVICE_AREA
    ) {
      throw new Error(`Polanów Rural Set B PRG row scope drifted for ${address.prgId}`);
    }
    if (!address.buildingNumber.trim() || !Number.isFinite(address.x2180) || !Number.isFinite(address.y2180)) {
      throw new Error(`Incomplete Polanów Rural Set B PRG row ${address.prgId}`);
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

export async function loadPolanowRuralSetBReferenceSnapshot(): Promise<PolanowRuralSetBReferenceSnapshot> {
  const raw = JSON.parse(await readFile(snapshotPath, 'utf8')) as RawSnapshot;
  return validateSnapshot(raw);
}

export function polanowRuralSetBPrgRows(snapshot: PolanowRuralSetBReferenceSnapshot): PrgAddressRow[] {
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

export async function hydratePolanowRuralSetBReferenceBackbone(
  pool: Pool,
  snapshot: PolanowRuralSetBReferenceSnapshot,
): Promise<void> {
  const municipality = await pool.query<IdRow>(
    'SELECT id FROM municipalities WHERE terc=$1 AND active=true',
    [POLANOW_TERC],
  );
  const municipalityId = municipality.rows[0]?.id;
  if (!municipalityId) {
    throw new Error(`Missing official municipality TERC ${POLANOW_TERC} before Polanów Rural Set B hydration`);
  }

  for (const locality of POLANOW_RURAL_SET_B_LOCALITIES) {
    await pool.query(
      `INSERT INTO localities (
         simc, municipality_id, name, locality_type_code, parent_simc,
         active, source_updated_at
       ) VALUES ($1,$2,$3,$4,$5,true,$6::date)
       ON CONFLICT (simc) DO UPDATE SET
         municipality_id=EXCLUDED.municipality_id,
         name=EXCLUDED.name,
         locality_type_code=EXCLUDED.locality_type_code,
         parent_simc=EXCLUDED.parent_simc,
         active=true,
         source_updated_at=EXCLUDED.source_updated_at,
         updated_at=now()`,
      [
        locality.simc,
        municipalityId,
        locality.name,
        locality.localityTypeCode,
        locality.parentSimc,
        snapshot.snapshotDate,
      ],
    );
  }
}
