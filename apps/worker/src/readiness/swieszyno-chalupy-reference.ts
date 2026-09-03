import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-swieszyno-chalupy-20260903.json',
);

export const SWIESZYNO_TERC = '3209082';
export const CHALUPY_SIMC = '0313377';
export const CHALUPY_SERVICE_AREA = 'swieszyno-safe-h2-chalupy';
export const CHALUPY_REAL_ADDRESS_COUNT = 167;
export const CHALUPY_PRG_RESPONSE_SHA256 = 'a6737779ddd428f86c3d4b715c703c1151792cbeb37b82b21b3fb67daf1fc3ec';

export interface SwieszynoChalupyGoldenAddress {
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
    filter: {
      municipalityTerc: string;
      locality: string;
      simc: string;
    };
  };
  selection: {
    municipalityTerc: string;
    locality: string;
    simc: string;
    serviceArea: string;
    total: number;
  };
  addresses: Array<SwieszynoChalupyGoldenAddress | SnapshotTuple>;
}

export interface SwieszynoChalupySnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: {
    provider: string;
    dataset: string;
    filter: {
      municipalityTerc: string;
      locality: string;
      simc: string;
    };
  };
  selection: {
    municipalityTerc: string;
    locality: string;
    simc: string;
    serviceArea: string;
    total: number;
  };
  addresses: SwieszynoChalupyGoldenAddress[];
}

function normalizeAddress(
  entry: SwieszynoChalupyGoldenAddress | SnapshotTuple,
): SwieszynoChalupyGoldenAddress {
  if (Array.isArray(entry)) {
    return {
      prgId: entry[0],
      municipalityTerc: entry[1],
      locality: entry[2],
      simc: entry[3],
      street: null,
      ulic: null,
      buildingNumber: entry[6],
      postalCode: entry[7],
      x2180: entry[8],
      y2180: entry[9],
      serviceArea: entry[10],
    };
  }
  return entry;
}

export async function loadSwieszynoChalupyReferenceSnapshot(): Promise<SwieszynoChalupySnapshot> {
  const content = await readFile(snapshotPath, 'utf8');
  const parsed = JSON.parse(content) as RawSnapshot;

  if (parsed.schemaVersion !== '1.0.0') {
    throw new Error(`Unexpected schemaVersion in Świeszyno snapshot: ${parsed.schemaVersion}`);
  }
  if (parsed.selection.municipalityTerc !== SWIESZYNO_TERC) {
    throw new Error(`Unexpected municipality TERC: ${parsed.selection.municipalityTerc}`);
  }
  if (parsed.selection.simc !== CHALUPY_SIMC) {
    throw new Error(`Unexpected locality SIMC: ${parsed.selection.simc}`);
  }
  if (parsed.selection.serviceArea !== CHALUPY_SERVICE_AREA) {
    throw new Error(`Unexpected serviceArea: ${parsed.selection.serviceArea}`);
  }

  const addresses = parsed.addresses.map(normalizeAddress);
  if (addresses.length !== CHALUPY_REAL_ADDRESS_COUNT) {
    throw new Error(
      `Expected exactly ${CHALUPY_REAL_ADDRESS_COUNT} Chałupy addresses, got ${addresses.length}`,
    );
  }

  return {
    schemaVersion: parsed.schemaVersion,
    snapshotDate: parsed.snapshotDate,
    source: parsed.source,
    selection: parsed.selection,
    addresses,
  };
}

export interface LocalitySeed {
  simc: string;
  name: string;
  localityTypeCode: string;
  parentSimc: string | null;
}

export const SWIESZYNO_LOCALITIES: LocalitySeed[] = [
  { simc: '0313377', name: 'Chałupy', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0313414', name: 'Konikowo', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0313443', name: 'Niekłonice', localityTypeCode: 'WIES', parentSimc: null },
];

export async function hydrateSwieszynoChalupyReferenceBackbone(pool: Pool): Promise<{
  municipalityId: string;
  localityIds: Record<string, string>;
  addressIds: string[];
}> {
  const snapshot = await loadSwieszynoChalupyReferenceSnapshot();

  const municipalityResult = await pool.query<QueryResultRow & { id: string }>(
    `SELECT id FROM municipalities WHERE terc = $1 LIMIT 1`,
    [SWIESZYNO_TERC],
  );
  const municipalityId = municipalityResult.rows[0]?.id;
  if (!municipalityId) {
    throw new Error(`Świeszyno municipality (TERC ${SWIESZYNO_TERC}) missing in database`);
  }

  const localityIds: Record<string, string> = {};

  for (const locality of SWIESZYNO_LOCALITIES) {
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

  const chalupyLocalityId = localityIds[CHALUPY_SIMC];
  if (!chalupyLocalityId) throw new Error('Chałupy locality ID missing after hydration');

  const addressIds: string[] = [];

  for (const address of snapshot.addresses) {
    const postal = address.postalCode ?? '76-024';
    const canonicalText = `Chałupy ${address.buildingNumber}, ${postal} Chałupy`;

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
        chalupyLocalityId,
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

export function swieszynoChalupyPrgRows(snapshot: SwieszynoChalupySnapshot): PrgAddressRow[] {
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
