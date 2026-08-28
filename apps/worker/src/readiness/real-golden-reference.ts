import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, QueryResultRow } from 'pg';
import type { PrgAddressRow } from '../reference/types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json',
);

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
  street: string | null,
  ulic: string | null,
  buildingNumber: string,
  postalCode: string | null,
  x2180: number,
  y2180: number,
  serviceArea: string,
];

export interface RealGoldenAddress {
  prgId: string;
  municipalityTerc: string;
  locality: string;
  simc: string;
  street: string | null;
  ulic: string | null;
  buildingNumber: string;
  postalCode: string | null;
  x2180: number;
  y2180: number;
  serviceArea: string;
}

interface RawSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: Record<string, unknown>;
  selection: {
    total: number;
    perMunicipality: Record<string, number>;
    policy: string;
    excludedSourceOnlyCase: string;
  };
  fields: string[];
  addresses: SnapshotTuple[];
}

export interface RealGoldenReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: Record<string, unknown>;
  selection: RawSnapshot['selection'];
  addresses: RealGoldenAddress[];
}

export const REAL_GOLDEN_REFERENCE_COUNTS = {
  realAddresses: 100,
  sourceOnlySupportAddresses: 1,
  totalAddressesAfterHydration: 101,
  koszalin: 9,
  manowo: 46,
  tychowo: 45,
} as const;

const EXPECTED_TERC_DISTRIBUTION: Readonly<Record<string, number>> = {
  '3261011': REAL_GOLDEN_REFERENCE_COUNTS.koszalin,
  '3209042': REAL_GOLDEN_REFERENCE_COUNTS.manowo,
  '3201043': REAL_GOLDEN_REFERENCE_COUNTS.tychowo,
};

function isSevenDigits(value: string): boolean {
  return /^\d{7}$/.test(value);
}

function decodeTuple(tuple: SnapshotTuple): RealGoldenAddress {
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

function validateSnapshot(raw: RawSnapshot): RealGoldenReferenceSnapshot {
  if (raw.schemaVersion !== '1.0.0') throw new Error(`Unsupported real golden snapshot ${raw.schemaVersion}`);
  if (raw.snapshotDate !== '2026-08-28') throw new Error(`Unexpected real golden snapshot date ${raw.snapshotDate}`);
  if (JSON.stringify(raw.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error(`Real golden snapshot field contract drifted: ${JSON.stringify(raw.fields)}`);
  }
  if (raw.selection.total !== REAL_GOLDEN_REFERENCE_COUNTS.realAddresses) {
    throw new Error(`Real golden snapshot must contain exactly 100 selected addresses, got ${raw.selection.total}`);
  }
  if (raw.addresses.length !== REAL_GOLDEN_REFERENCE_COUNTS.realAddresses) {
    throw new Error(`Real golden snapshot row count drifted to ${raw.addresses.length}`);
  }

  const addresses = raw.addresses.map(decodeTuple);
  const ids = new Set<string>();
  const distribution = new Map<string, number>();
  for (const address of addresses) {
    if (!/^prg-adresy\.\d+$/.test(address.prgId)) {
      throw new Error(`Golden address ${address.prgId} is not an exact frozen GUGiK WFS feature id`);
    }
    if (ids.has(address.prgId)) throw new Error(`Duplicate real golden PRG id ${address.prgId}`);
    ids.add(address.prgId);
    if (!isSevenDigits(address.municipalityTerc) || !isSevenDigits(address.simc)) {
      throw new Error(`Invalid TERC/SIMC in real golden row ${address.prgId}`);
    }
    if (!address.locality.trim() || !address.buildingNumber.trim() || !address.serviceArea.trim()) {
      throw new Error(`Incomplete real golden row ${address.prgId}`);
    }
    if (!Number.isFinite(address.x2180) || !Number.isFinite(address.y2180)) {
      throw new Error(`Invalid EPSG:2180 geometry in real golden row ${address.prgId}`);
    }
    if ((address.street === null) !== (address.ulic === null)) {
      throw new Error(`Street/ULIC evidence must be both present or both absent for ${address.prgId}`);
    }
    distribution.set(address.municipalityTerc, (distribution.get(address.municipalityTerc) ?? 0) + 1);
  }

  if (distribution.size !== Object.keys(EXPECTED_TERC_DISTRIBUTION).length) {
    throw new Error(`Real golden municipality distribution drifted: ${JSON.stringify(Object.fromEntries(distribution))}`);
  }
  for (const [terc, expected] of Object.entries(EXPECTED_TERC_DISTRIBUTION)) {
    if (distribution.get(terc) !== expected) {
      throw new Error(`Expected ${expected} real golden addresses for ${terc}, got ${distribution.get(terc) ?? 0}`);
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

export async function loadRealGoldenReferenceSnapshot(): Promise<RealGoldenReferenceSnapshot> {
  const raw = JSON.parse(await readFile(snapshotPath, 'utf8')) as RawSnapshot;
  return validateSnapshot(raw);
}

export function realGoldenPrgRows(snapshot: RealGoldenReferenceSnapshot): PrgAddressRow[] {
  return snapshot.addresses.map((address) => ({
    prgId: address.prgId,
    municipalityTerc: address.municipalityTerc,
    simc: address.simc,
    ulic: address.ulic,
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
 * Hydrates only the relational backbone fields that are present in the frozen
 * PRG evidence (SIMC/locality name and ULIC/street name). It deliberately leaves
 * TERYT-only attributes such as locality_type_code NULL instead of fabricating
 * them. Full TERYT importer behavior is covered by its own official-reference
 * tests; this gate is specifically about real address/service-area correctness.
 */
export async function hydrateRealGoldenReferenceBackbone(
  pool: Pool,
  snapshot: RealGoldenReferenceSnapshot,
): Promise<{ localities: number; streets: number }> {
  const localityBySimc = new Map<string, RealGoldenAddress>();
  for (const address of snapshot.addresses) {
    const current = localityBySimc.get(address.simc);
    if (current && (current.locality !== address.locality || current.municipalityTerc !== address.municipalityTerc)) {
      throw new Error(`Conflicting PRG locality evidence for SIMC ${address.simc}`);
    }
    localityBySimc.set(address.simc, address);
  }

  for (const address of localityBySimc.values()) {
    const municipality = await pool.query<IdRow>('SELECT id FROM municipalities WHERE terc=$1 AND active=true', [address.municipalityTerc]);
    const municipalityId = municipality.rows[0]?.id;
    if (!municipalityId) throw new Error(`Missing TERC ${address.municipalityTerc} before real golden locality hydration`);
    await pool.query(
      `INSERT INTO localities (
         simc, municipality_id, name, locality_type_code, parent_simc,
         active, source_updated_at
       ) VALUES ($1,$2,$3,NULL,NULL,true,$4::date)
       ON CONFLICT (simc) DO UPDATE SET
         municipality_id=EXCLUDED.municipality_id,
         name=EXCLUDED.name,
         locality_type_code=NULL,
         parent_simc=NULL,
         active=true,
         source_updated_at=EXCLUDED.source_updated_at,
         updated_at=now()`,
      [address.simc, municipalityId, address.locality, snapshot.snapshotDate],
    );
  }

  const streetKeys = new Set<string>();
  let streetCount = 0;
  for (const address of snapshot.addresses) {
    if (!address.street || !address.ulic) continue;
    const key = `${address.simc}:${address.ulic}`;
    if (streetKeys.has(key)) continue;
    streetKeys.add(key);
    const locality = await pool.query<IdRow>('SELECT id FROM localities WHERE simc=$1 AND active=true', [address.simc]);
    const localityId = locality.rows[0]?.id;
    if (!localityId) throw new Error(`Missing SIMC ${address.simc} before real golden street hydration`);
    await pool.query(
      `INSERT INTO streets (
         ulic, locality_id, name, street_type, name_1, name_2,
         active, source_updated_at
       ) VALUES ($1,$2,$3,NULL,$3,'',true,$4::date)
       ON CONFLICT (locality_id, ulic) DO UPDATE SET
         name=EXCLUDED.name,
         street_type=NULL,
         name_1=EXCLUDED.name_1,
         name_2='',
         active=true,
         source_updated_at=EXCLUDED.source_updated_at,
         updated_at=now()`,
      [address.ulic, localityId, address.street, snapshot.snapshotDate],
    );
    streetCount += 1;
  }

  return { localities: localityBySimc.size, streets: streetCount };
}

/**
 * The PGK source contains `Bogusława II 1-3` as a collection location, but that
 * number range is not one exact PRG point. It is required only so the source can
 * publish its complete schedule; it is intentionally prg_id=NULL and excluded
 * from the 100-real-address metric.
 */
export async function insertKoszalinSourceOnlySupportAddress(pool: Pool): Promise<void> {
  const locality = await pool.query<IdRow>(
    `SELECT l.id
     FROM localities l JOIN municipalities m ON m.id=l.municipality_id
     WHERE m.terc='3261011' AND l.simc='0949448' AND l.active=true`,
  );
  const localityId = locality.rows[0]?.id;
  if (!localityId) throw new Error('Missing Koszalin locality for source-only collection point');

  const existingStreet = await pool.query<IdRow>(
    `SELECT id FROM streets WHERE locality_id=$1 AND name='Bogusława II' AND active=true ORDER BY id LIMIT 1`,
    [localityId],
  );
  let streetId = existingStreet.rows[0]?.id;
  if (!streetId) {
    const inserted = await pool.query<IdRow>(
      `INSERT INTO streets (ulic, locality_id, name, street_type, name_1, name_2, active)
       VALUES (NULL,$1,'Bogusława II',NULL,'Bogusława II','',true)
       RETURNING id`,
      [localityId],
    );
    streetId = inserted.rows[0]!.id;
  }

  const municipality = await pool.query<IdRow>("SELECT id FROM municipalities WHERE terc='3261011' AND active=true");
  const municipalityId = municipality.rows[0]?.id;
  if (!municipalityId) throw new Error('Missing Koszalin municipality for source-only collection point');

  await pool.query(
    `INSERT INTO addresses (
       prg_id, municipality_id, locality_id, street_id, building_number,
       postal_code, canonical_text, geom, source_updated_at, status,
       active, valid_from, valid_to
     )
     SELECT NULL,$1,$2,$3,'1-3',NULL,'Bogusława II 1-3, Koszalin',NULL,NULL,NULL,true,NULL,NULL
     WHERE NOT EXISTS (
       SELECT 1 FROM addresses
       WHERE prg_id IS NULL AND municipality_id=$1 AND locality_id=$2
         AND street_id=$3 AND upper(building_number)='1-3' AND active=true
     )`,
    [municipalityId, localityId, streetId],
  );
}
