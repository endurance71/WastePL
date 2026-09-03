import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-bobolice-klanino-20260903.json',
);

export const BOBOLICE_TERC = '3209033';
export const KLANINO_SIMC = '0304214';
export const KLANINO_SERVICE_AREA = 'bobolice-safe-h2-klanino';
export const KLANINO_REAL_ADDRESS_COUNT = 65;
export const KLANINO_PRG_RESPONSE_SHA256 =
  '3625a882b1e07d4b305d165569edfd2c6efad703624012b95a308b8814632bca';

export interface BoboliceKlaninoGoldenAddress {
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
  addresses: Array<BoboliceKlaninoGoldenAddress | SnapshotTuple>;
}

export interface BoboliceKlaninoSnapshot {
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
  addresses: BoboliceKlaninoGoldenAddress[];
}

function normalizeAddress(
  entry: BoboliceKlaninoGoldenAddress | SnapshotTuple,
): BoboliceKlaninoGoldenAddress {
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
  return {
    prgId: entry.prgId,
    municipalityTerc: entry.municipalityTerc ?? BOBOLICE_TERC,
    locality: entry.locality ?? 'Kłanino',
    simc: entry.simc ?? KLANINO_SIMC,
    street: null,
    ulic: null,
    buildingNumber: entry.buildingNumber,
    postalCode: entry.postalCode ?? '76-020',
    x2180: entry.x2180,
    y2180: entry.y2180,
    serviceArea: entry.serviceArea ?? KLANINO_SERVICE_AREA,
  };
}

export async function loadBoboliceKlaninoReferenceSnapshot(): Promise<BoboliceKlaninoSnapshot> {
  const content = await readFile(snapshotPath, 'utf8');
  const parsed = JSON.parse(content) as RawSnapshot;

  if (parsed.schemaVersion !== '1.0.0') {
    throw new Error(`Unexpected schemaVersion in Bobolice snapshot: ${parsed.schemaVersion}`);
  }
  if (parsed.selection.municipalityTerc !== BOBOLICE_TERC) {
    throw new Error(`Unexpected municipality TERC: ${parsed.selection.municipalityTerc}`);
  }
  if (parsed.selection.simc !== KLANINO_SIMC) {
    throw new Error(`Unexpected locality SIMC: ${parsed.selection.simc}`);
  }
  if (parsed.selection.serviceArea !== KLANINO_SERVICE_AREA) {
    throw new Error(`Unexpected serviceArea: ${parsed.selection.serviceArea}`);
  }

  const addresses = parsed.addresses.map(normalizeAddress);
  if (addresses.length !== KLANINO_REAL_ADDRESS_COUNT) {
    throw new Error(
      `Expected exactly ${KLANINO_REAL_ADDRESS_COUNT} Kłanino addresses, got ${addresses.length}`,
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

export const BOBOLICE_LOCALITIES: LocalitySeed[] = [
  { simc: '0304214', name: 'Kłanino', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0304102', name: 'Przydargiń', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0304510', name: 'Różewko', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0304480', name: 'Ubiedrze', localityTypeCode: 'WIES', parentSimc: null },
  { simc: '0304250', name: 'Wilczogóra', localityTypeCode: 'WIES', parentSimc: null },
];

export async function hydrateBoboliceKlaninoReferenceBackbone(pool: Pool): Promise<{
  municipalityId: string;
  localityIds: Record<string, string>;
  addressIds: string[];
}> {
  const snapshot = await loadBoboliceKlaninoReferenceSnapshot();

  const municipalityResult = await pool.query<QueryResultRow & { id: string }>(
    `SELECT id FROM municipalities WHERE terc = $1 LIMIT 1`,
    [BOBOLICE_TERC],
  );
  const municipalityId = municipalityResult.rows[0]?.id;
  if (!municipalityId) {
    throw new Error(`Bobolice municipality (TERC ${BOBOLICE_TERC}) missing in database`);
  }

  const localityIds: Record<string, string> = {};

  for (const locality of BOBOLICE_LOCALITIES) {
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

  const klaninoLocalityId = localityIds[KLANINO_SIMC];
  if (!klaninoLocalityId) throw new Error('Kłanino locality ID missing after hydration');

  const addressIds: string[] = [];

  for (const address of snapshot.addresses) {
    const postal = address.postalCode ?? '76-020';
    const canonicalText = `Kłanino ${address.buildingNumber}, ${postal} Kłanino`;

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
        klaninoLocalityId,
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

export function boboliceKlaninoPrgRows(snapshot: BoboliceKlaninoSnapshot): PrgAddressRow[] {
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
