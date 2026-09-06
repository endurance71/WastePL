import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-swieszyno-trasa-2-rural-20260906.json',
);

export const SWIESZYNO_TERC = '3209082';
export const SWIESZYNO_TRASA_2_SERVICE_AREA = 'swieszyno-safe-h2-trasa-2';
export const SWIESZYNO_TRASA_2_REAL_ADDRESS_COUNT = 479;
export const SWIESZYNO_TRASA_2_PRG_RESPONSE_SHA256 = '6729d11dd786cd6ff9b99949e185c4bcc43fead8c571634e2fbf7b45db046670';

export const SWIESZYNO_TRASA_2_LOCALITIES: ReadonlyArray<{
  name: string;
  simc: string;
  localityTypeCode: string;
  parentSimc: string | null;
}> = [
  { name: 'Czacz', simc: '0313271', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Zegrzyn', simc: '0313472', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Kurozwęcz', simc: '0313450', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Sieranie', simc: '0313466', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Czaple', simc: '0313443', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Kępa Świeszyńska', simc: '0313390', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Olszak', simc: '0313414', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Włoki', simc: '0313420', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Bagno', simc: '0313348', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Chłopska Kępa', simc: '0313383', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Brzeźniki', simc: '0313360', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Golica', simc: '0313288', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Biała Kępa', simc: '0313354', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Krokowo', simc: '0313408', localityTypeCode: 'WIES', parentSimc: null },
  { name: 'Jarzyce', simc: '0313207', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Czersk Koszaliński', simc: '0313236', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Kłokęcin', simc: '0313213', localityTypeCode: 'OSADA', parentSimc: null },
  { name: 'Węgorki', simc: '0313302', localityTypeCode: 'OSADA', parentSimc: null },
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

export interface SwieszynoTrasa2GoldenAddress {
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

export interface SwieszynoTrasa2ReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: RawSnapshot['source'];
  selection: RawSnapshot['selection'];
  addresses: SwieszynoTrasa2GoldenAddress[];
}

function decodeTuple(tuple: SnapshotTuple): SwieszynoTrasa2GoldenAddress {
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

function validateSnapshot(raw: RawSnapshot): SwieszynoTrasa2ReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported Świeszyno Trasa 2 PRG snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-09-06') throw new Error(`Unexpected Świeszyno Trasa 2 PRG snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Świeszyno Trasa 2 PRG snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (
    raw.selection.total !== SWIESZYNO_TRASA_2_REAL_ADDRESS_COUNT ||
    raw.selection.municipalityTerc !== SWIESZYNO_TERC ||
    raw.selection.serviceArea !== SWIESZYNO_TRASA_2_SERVICE_AREA
  ) {
    throw new Error(`Świeszyno Trasa 2 PRG snapshot selection drifted: ${JSON.stringify(raw.selection)}`);
  }
  if (raw.source.responseSha256 !== SWIESZYNO_TRASA_2_PRG_RESPONSE_SHA256) {
    throw new Error('Świeszyno Trasa 2 PRG source evidence drifted');
  }
  if (raw.addresses.length !== SWIESZYNO_TRASA_2_REAL_ADDRESS_COUNT) {
    throw new Error(`Expected ${SWIESZYNO_TRASA_2_REAL_ADDRESS_COUNT} Świeszyno Trasa 2 PRG rows, got ${raw.addresses.length}`);
  }

  const allowedLocalityNames = new Set(SWIESZYNO_TRASA_2_LOCALITIES.map((l) => l.name));
  const allowedSimcs = new Set(SWIESZYNO_TRASA_2_LOCALITIES.map((l) => l.simc));

  const addresses = raw.addresses.map(decodeTuple);
  const ids = new Set<string>();
  const localityNumbers = new Set<string>();

  for (const address of addresses) {
    if (ids.has(address.prgId)) throw new Error(`Duplicate Świeszyno Trasa 2 PRG id ${address.prgId}`);
    ids.add(address.prgId);

    const locNumKey = `${address.simc}:${address.buildingNumber.toLocaleUpperCase('pl-PL')}`;
    if (localityNumbers.has(locNumKey)) {
      throw new Error(`Duplicate Świeszyno Trasa 2 building number ${address.buildingNumber} in SIMC ${address.simc}`);
    }
    localityNumbers.add(locNumKey);

    if (
      address.municipalityTerc !== SWIESZYNO_TERC ||
      !allowedLocalityNames.has(address.locality) ||
      !allowedSimcs.has(address.simc) ||
      address.street !== null ||
      address.ulic !== null ||
      address.serviceArea !== SWIESZYNO_TRASA_2_SERVICE_AREA
    ) {
      throw new Error(`Świeszyno Trasa 2 PRG row scope drifted for ${address.prgId}`);
    }
    if (!address.buildingNumber.trim() || !Number.isFinite(address.x2180) || !Number.isFinite(address.y2180)) {
      throw new Error(`Incomplete Świeszyno Trasa 2 PRG row ${address.prgId}`);
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

export async function loadSwieszynoTrasa2ReferenceSnapshot(): Promise<SwieszynoTrasa2ReferenceSnapshot> {
  const raw = JSON.parse(await readFile(snapshotPath, 'utf8')) as RawSnapshot;
  return validateSnapshot(raw);
}

export function swieszynoTrasa2PrgRows(snapshot: SwieszynoTrasa2ReferenceSnapshot): PrgAddressRow[] {
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

export async function hydrateSwieszynoTrasa2ReferenceBackbone(
  pool: Pool,
  snapshot: SwieszynoTrasa2ReferenceSnapshot,
): Promise<void> {
  const municipality = await pool.query<IdRow>(
    'SELECT id FROM municipalities WHERE terc=$1 AND active=true',
    [SWIESZYNO_TERC],
  );
  const municipalityId = municipality.rows[0]?.id;
  if (!municipalityId) {
    throw new Error(`Missing official municipality TERC ${SWIESZYNO_TERC} before Świeszyno Trasa 2 hydration`);
  }

  for (const locality of SWIESZYNO_TRASA_2_LOCALITIES) {
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
