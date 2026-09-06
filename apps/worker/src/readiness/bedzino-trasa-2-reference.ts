import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-bedzino-trasa-2-rural-20260906.json',
);

export const BEDZINO_TERC = '3209012';
export const BEDZINO_TRASA_2_SERVICE_AREA = 'bedzino-trasa-2-safe';
export const BEDZINO_TRASA_2_REAL_ADDRESS_COUNT = 298;
export const BEDZINO_TRASA_2_PRG_RESPONSE_SHA256 = '00996a807e107a012bf536df686a374a4ad68b5fd8982a95ebe04f7b8997e341';

export const BEDZINO_TRASA_2_LOCALITIES: ReadonlyArray<{
  name: string;
  simc: string;
  localityTypeCode: string;
  parentSimc: string | null;
}> = [
  { name: 'Barninek', simc: '0302296', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Dobiesławiec', simc: '0302280', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Dobre', simc: '0302327', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Dobre Małe', simc: '0302333', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Kazimierz Pomorski', simc: '0302468', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Łekno', simc: '0302451', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Podamirowo', simc: '0302304', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Ziębrze', simc: '0302534', localityTypeCode: 'OSADA', parentSimc: null },
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

export interface BedzinoTrasa2GoldenAddress {
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

export interface BedzinoTrasa2ReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: RawSnapshot['source'];
  selection: RawSnapshot['selection'];
  addresses: BedzinoTrasa2GoldenAddress[];
}

function decodeTuple(tuple: SnapshotTuple): BedzinoTrasa2GoldenAddress {
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

function validateSnapshot(raw: RawSnapshot): BedzinoTrasa2ReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported Będzino Trasa 2 PRG snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-09-06') throw new Error(`Unexpected Będzino Trasa 2 PRG snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Będzino Trasa 2 PRG snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (
    raw.selection.total !== BEDZINO_TRASA_2_REAL_ADDRESS_COUNT ||
    raw.selection.municipalityTerc !== BEDZINO_TERC ||
    raw.selection.serviceArea !== BEDZINO_TRASA_2_SERVICE_AREA
  ) {
    throw new Error(`Będzino Trasa 2 PRG snapshot selection drifted: ${JSON.stringify(raw.selection)}`);
  }
  if (raw.source.responseSha256 !== BEDZINO_TRASA_2_PRG_RESPONSE_SHA256) {
    throw new Error('Będzino Trasa 2 PRG source evidence drifted');
  }
  if (raw.addresses.length !== BEDZINO_TRASA_2_REAL_ADDRESS_COUNT) {
    throw new Error(`Expected ${BEDZINO_TRASA_2_REAL_ADDRESS_COUNT} Będzino Trasa 2 PRG rows, got ${raw.addresses.length}`);
  }

  const allowedLocalityNames = new Set(BEDZINO_TRASA_2_LOCALITIES.map((l) => l.name));
  const allowedSimcs = new Set(BEDZINO_TRASA_2_LOCALITIES.map((l) => l.simc));

  const addresses = raw.addresses.map(decodeTuple);
  const ids = new Set<string>();
  const localityNumbers = new Set<string>();

  for (const address of addresses) {
    if (ids.has(address.prgId)) throw new Error(`Duplicate Będzino Trasa 2 PRG id ${address.prgId}`);
    ids.add(address.prgId);

    const locNumKey = `${address.simc}:${address.buildingNumber.toLocaleUpperCase('pl-PL')}`;
    if (localityNumbers.has(locNumKey)) {
      throw new Error(`Duplicate Będzino Trasa 2 building number ${address.buildingNumber} in SIMC ${address.simc}`);
    }
    localityNumbers.add(locNumKey);

    if (
      address.municipalityTerc !== BEDZINO_TERC ||
      !allowedLocalityNames.has(address.locality) ||
      !allowedSimcs.has(address.simc) ||
      address.street !== null ||
      address.ulic !== null ||
      address.serviceArea !== BEDZINO_TRASA_2_SERVICE_AREA
    ) {
      throw new Error(`Będzino Trasa 2 PRG row scope drifted for ${address.prgId}`);
    }
    if (!address.buildingNumber.trim() || !Number.isFinite(address.x2180) || !Number.isFinite(address.y2180)) {
      throw new Error(`Incomplete Będzino Trasa 2 PRG row ${address.prgId}`);
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

export async function loadBedzinoTrasa2ReferenceSnapshot(): Promise<BedzinoTrasa2ReferenceSnapshot> {
  const raw = JSON.parse(await readFile(snapshotPath, 'utf8')) as RawSnapshot;
  return validateSnapshot(raw);
}

export function bedzinoTrasa2PrgRows(snapshot: BedzinoTrasa2ReferenceSnapshot): PrgAddressRow[] {
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

export async function hydrateBedzinoTrasa2ReferenceBackbone(
  pool: Pool,
  snapshot: BedzinoTrasa2ReferenceSnapshot,
): Promise<void> {
  const municipality = await pool.query<IdRow>(
    'SELECT id FROM municipalities WHERE terc=$1 AND active=true',
    [BEDZINO_TERC],
  );
  const municipalityId = municipality.rows[0]?.id;
  if (!municipalityId) {
    throw new Error(`Missing official municipality TERC ${BEDZINO_TERC} before Będzino Trasa 2 hydration`);
  }

  for (const locality of BEDZINO_TRASA_2_LOCALITIES) {
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
