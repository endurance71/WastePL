import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-polanow-rural-set-a-20260906.json',
);

export const POLANOW_TERC = '3209063';
export const POLANOW_RURAL_SET_A_SERVICE_AREA = 'polanow-rural-set-a-single-family';
export const POLANOW_RURAL_SET_A_REAL_ADDRESS_COUNT = 391;
export const POLANOW_RURAL_SET_A_PRG_RESPONSE_SHA256 = '8c6584e68763766dd2d77e5cb9c898a8507d8f4b623e527655c3e3fa20a70567';

export const POLANOW_RURAL_SET_A_LOCALITIES: ReadonlyArray<{
  name: string;
  simc: string;
  localityTypeCode: string;
  parentSimc: string | null;
}> = [
  { name: 'Bukowo', simc: '0309192', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Dadzewo', simc: '0308904', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Domachowo', simc: '0309200', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Jacinki', simc: '0308896', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Krytno', simc: '0309000', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Karsina', simc: '0308933', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Karsinka', simc: '0308910', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Nacław', simc: '0309080', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Nadbór', simc: '0309097', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Osetno', simc: '0309105', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Powidz', simc: '0309051', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Puławy', simc: '0309230', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Rekowo', simc: '0309074', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Rzyszczewko', simc: '0309170', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Sowinko', simc: '0309269', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Stołpie', simc: '0309068', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Świerczyna', simc: '0309246', localityTypeCode: 'WIES', parentSimc: null },
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

export interface BedzinoTrasa1GoldenAddress {
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
    localities: string[];
    simcs: string[];
    serviceArea: string;
  };
  fields: string[];
  addresses: SnapshotTuple[];
}

export interface PolanowRuralSetAReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: RawSnapshot['source'];
  selection: RawSnapshot['selection'];
  addresses: PolanowRuralSetAGoldenAddress[];
}

export interface PolanowRuralSetAGoldenAddress {
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

function decodeTuple(tuple: SnapshotTuple): PolanowRuralSetAGoldenAddress {
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

function validateSnapshot(raw: RawSnapshot): PolanowRuralSetAReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported Polanów Rural Set A PRG snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-09-06') throw new Error(`Unexpected Polanów Rural Set A PRG snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Polanów Rural Set A PRG snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (
    raw.selection.total !== POLANOW_RURAL_SET_A_REAL_ADDRESS_COUNT ||
    raw.selection.municipalityTerc !== POLANOW_TERC ||
    raw.selection.serviceArea !== POLANOW_RURAL_SET_A_SERVICE_AREA
  ) {
    throw new Error(`Polanów Rural Set A PRG snapshot selection drifted: ${JSON.stringify(raw.selection)}`);
  }
  if (raw.source.responseSha256 !== POLANOW_RURAL_SET_A_PRG_RESPONSE_SHA256) {
    throw new Error('Polanów Rural Set A PRG source evidence drifted');
  }
  if (raw.addresses.length !== POLANOW_RURAL_SET_A_REAL_ADDRESS_COUNT) {
    throw new Error(`Expected ${POLANOW_RURAL_SET_A_REAL_ADDRESS_COUNT} Polanów Rural Set A PRG rows, got ${raw.addresses.length}`);
  }

  const allowedLocalityNames = new Set(POLANOW_RURAL_SET_A_LOCALITIES.map((l) => l.name));
  const allowedSimcs = new Set(POLANOW_RURAL_SET_A_LOCALITIES.map((l) => l.simc));

  const addresses = raw.addresses.map(decodeTuple);
  const ids = new Set<string>();
  const localityNumbers = new Set<string>();

  for (const address of addresses) {
    if (ids.has(address.prgId)) throw new Error(`Duplicate Polanów Rural Set A PRG id ${address.prgId}`);
    ids.add(address.prgId);

    const locNumKey = `${address.simc}:${address.buildingNumber.toLocaleUpperCase('pl-PL')}`;
    if (localityNumbers.has(locNumKey)) {
      throw new Error(`Duplicate Polanów Rural Set A building number ${address.buildingNumber} in SIMC ${address.simc}`);
    }
    localityNumbers.add(locNumKey);

    if (
      address.municipalityTerc !== POLANOW_TERC ||
      !allowedLocalityNames.has(address.locality) ||
      !allowedSimcs.has(address.simc) ||
      address.street !== null ||
      address.ulic !== null ||
      address.serviceArea !== POLANOW_RURAL_SET_A_SERVICE_AREA
    ) {
      throw new Error(`Polanów Rural Set A PRG row scope drifted for ${address.prgId}`);
    }
    if (!address.buildingNumber.trim() || !Number.isFinite(address.x2180) || !Number.isFinite(address.y2180)) {
      throw new Error(`Incomplete Polanów Rural Set A PRG row ${address.prgId}`);
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

export async function loadPolanowRuralSetAReferenceSnapshot(): Promise<PolanowRuralSetAReferenceSnapshot> {
  const raw = JSON.parse(await readFile(snapshotPath, 'utf8')) as RawSnapshot;
  return validateSnapshot(raw);
}

export function polanowRuralSetAPrgRows(snapshot: PolanowRuralSetAReferenceSnapshot): PrgAddressRow[] {
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

export async function hydratePolanowRuralSetAReferenceBackbone(
  pool: Pool,
  snapshot: PolanowRuralSetAReferenceSnapshot,
): Promise<void> {
  const municipality = await pool.query<IdRow>(
    'SELECT id FROM municipalities WHERE terc=$1 AND active=true',
    [POLANOW_TERC],
  );
  const municipalityId = municipality.rows[0]?.id;
  if (!municipalityId) {
    throw new Error(`Missing official municipality TERC ${POLANOW_TERC} before Polanów Rural Set A hydration`);
  }

  for (const locality of POLANOW_RURAL_SET_A_LOCALITIES) {
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
