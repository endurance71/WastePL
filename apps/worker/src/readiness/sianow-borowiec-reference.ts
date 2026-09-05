import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-sianow-borowiec-rural-20260905.json',
);

export const SIANOW_TERC = '3209073';
export const BOROWIEC_RURAL_SERVICE_AREA = 'sianow-safe-h2-borowiec-rural';
export const BOROWIEC_RURAL_REAL_ADDRESS_COUNT = 90;
export const BOROWIEC_RURAL_PRG_RESPONSE_SHA256 = '7942e80928aac62b0a029639264b3fcc82904b0c5cdbf2a4b9d602e5b1652aaa';

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

export interface SianowBorowiecGoldenAddress {
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

export interface SianowBorowiecReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: RawSnapshot['source'];
  selection: RawSnapshot['selection'];
  addresses: SianowBorowiecGoldenAddress[];
}

function decodeTuple(tuple: SnapshotTuple): SianowBorowiecGoldenAddress {
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

function validateSnapshot(raw: RawSnapshot): SianowBorowiecReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported Borowiec rural PRG snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-09-05') throw new Error(`Unexpected Borowiec rural PRG snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Borowiec rural PRG snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (
    raw.selection.total !== BOROWIEC_RURAL_REAL_ADDRESS_COUNT ||
    raw.selection.municipalityTerc !== SIANOW_TERC ||
    raw.selection.serviceArea !== BOROWIEC_RURAL_SERVICE_AREA
  ) {
    throw new Error(`Borowiec rural PRG snapshot selection drifted: ${JSON.stringify(raw.selection)}`);
  }
  if (raw.source.responseSha256 !== BOROWIEC_RURAL_PRG_RESPONSE_SHA256) {
    throw new Error('Borowiec rural PRG source evidence drifted');
  }
  if (raw.addresses.length !== BOROWIEC_RURAL_REAL_ADDRESS_COUNT) {
    throw new Error(`Expected ${BOROWIEC_RURAL_REAL_ADDRESS_COUNT} Borowiec rural PRG rows, got ${raw.addresses.length}`);
  }

  const addresses = raw.addresses.map(decodeTuple);
  const seenPrgIds = new Set<string>();

  for (const address of addresses) {
    if (seenPrgIds.has(address.prgId)) {
      throw new Error(`Duplicate PRG ID in Borowiec rural reference: ${address.prgId}`);
    }
    seenPrgIds.add(address.prgId);

    if (address.municipalityTerc !== SIANOW_TERC) {
      throw new Error(`Inconsistent TERC in Borowiec rural row ${address.prgId}`);
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

export async function loadSianowBorowiecReferenceSnapshot(): Promise<SianowBorowiecReferenceSnapshot> {
  const content = await readFile(snapshotPath, 'utf8');
  return validateSnapshot(JSON.parse(content) as RawSnapshot);
}

export interface LocalitySeed {
  simc: string;
  name: string;
  localityTypeCode: string;
  parentSimc: string | null;
}

export const BOROWIEC_RURAL_LOCALITIES: LocalitySeed[] = [
  { simc: '0310999', name: 'Borowiec', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0311183', name: 'Szczeglino Nowe', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0311036', name: 'Przytok', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0310982', name: 'Ratajki', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0311088', name: 'Sowno', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0311094', name: 'Suszka', localityTypeCode: 'OSADA', parentSimc: null },
  { simc: '0311071', name: 'Sowieński Młyn', localityTypeCode: 'OSADA', parentSimc: null },
];

export async function hydrateSianowBorowiecReferenceBackbone(pool: Pool): Promise<{
  municipalityId: string;
  localityIds: Record<string, string>;
  addressIds: string[];
}> {
  const snapshot = await loadSianowBorowiecReferenceSnapshot();

  const municipalityResult = await pool.query<QueryResultRow & { id: string }>(
    `SELECT id FROM municipalities WHERE terc = $1 LIMIT 1`,
    [SIANOW_TERC],
  );
  const municipalityId = municipalityResult.rows[0]?.id;
  if (!municipalityId) {
    throw new Error(`Sianów municipality (TERC ${SIANOW_TERC}) missing in database`);
  }

  const localityIds: Record<string, string> = {};

  for (const locality of BOROWIEC_RURAL_LOCALITIES) {
    const locResult = await pool.query<QueryResultRow & { id: string }>(
      `INSERT INTO localities (
         municipality_id, simc, name, locality_type_code, parent_simc, active
       ) VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (simc) DO UPDATE SET
         name = EXCLUDED.name,
         locality_type_code = EXCLUDED.locality_type_code,
         active = true
       RETURNING id`,
      [municipalityId, locality.simc, locality.name, locality.localityTypeCode, locality.parentSimc],
    );
    localityIds[locality.simc] = locResult.rows[0]!.id;
  }

  const addressIds: string[] = [];

  for (const address of snapshot.addresses) {
    const locId = localityIds[address.simc];
    if (!locId) {
      throw new Error(`Locality ID missing for SIMC ${address.simc} (${address.locality})`);
    }

    const canonicalText = `${address.locality} ${address.buildingNumber}, ${address.postalCode ?? '76-004'} ${address.locality}`;

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
        locId,
        address.buildingNumber,
        address.postalCode,
        canonicalText,
        address.x2180,
        address.y2180,
      ],
    );
    addressIds.push(addrResult.rows[0]!.id);
  }

  return { municipalityId, localityIds, addressIds };
}

export function sianowBorowiecPrgRows(snapshot: SianowBorowiecReferenceSnapshot): PrgAddressRow[] {
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
