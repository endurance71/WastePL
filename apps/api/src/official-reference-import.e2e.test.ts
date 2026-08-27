import { readFileSync } from 'node:fs';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './main.js';
import { PgServiceAreaResolver } from './service-area/pg-service-area-resolver.js';
import { PgOfficialReferenceImporter } from '../../worker/src/reference/pg-reference-importer.js';
import { parsePrgAddressGml } from '../../worker/src/reference/prg-gml.js';
import { parseSimcXml, parseTercXml, parseUlicXml } from '../../worker/src/reference/teryt-xml.js';
import type { PrgAddressRow } from '../../worker/src/reference/types.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;
const fixture = (name: string) => readFileSync(
  new URL(`../../worker/test/fixtures/reference/${name}`, import.meta.url),
  'utf8',
);

integrationDescribe('official TERYT/PRG reference import', () => {
  let pool: InstanceType<typeof Pool>;
  let app: NestFastifyApplication;
  let importer: PgOfficialReferenceImporter;
  let originalStreetId: string;
  let originalAddress3Id: string;
  let originalAddress8Id: string;
  let originalBonin2Id: string;
  let prgRows: PrgAddressRow[];

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    importer = new PgOfficialReferenceImporter(pool);
    app = await createApp();
    app.useLogger(['error']);
    await app.init();

    const street = await pool.query<{ id: string }>(
      `SELECT s.id FROM streets s JOIN localities l ON l.id=s.locality_id
       WHERE l.simc='0949448' AND s.name='1 Maja' ORDER BY s.id LIMIT 1`,
    );
    const addresses = await pool.query<{ id: string; canonical_text: string }>(
      `SELECT id, canonical_text FROM addresses
       WHERE canonical_text IN ('1 Maja 3, 75-800 Koszalin','1 Maja 8, 75-800 Koszalin','Bonin 2, 76-009 Bonin')`,
    );
    originalStreetId = street.rows[0]!.id;
    originalAddress3Id = addresses.rows.find((row) => row.canonical_text.startsWith('1 Maja 3,'))!.id;
    originalAddress8Id = addresses.rows.find((row) => row.canonical_text.startsWith('1 Maja 8,'))!.id;
    originalBonin2Id = addresses.rows.find((row) => row.canonical_text.startsWith('Bonin 2,'))!.id;

    const parsed = parsePrgAddressGml(fixture('PRG-addresses.gml'));
    expect(parsed.rejected).toEqual([]);
    prgRows = parsed.rows;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  async function importReferenceSet(): Promise<void> {
    await importer.importTerc(parseTercXml(fixture('TERC.xml')), {
      dataset: 'TERYT_TERC', sourceVersion: '2026-01-01', sourceUri: 'fixture://TERC.xml', fullSnapshot: false,
    });
    await importer.importSimc(parseSimcXml(fixture('SIMC.xml')), {
      dataset: 'TERYT_SIMC', sourceVersion: '2026-01-01', sourceUri: 'fixture://SIMC.xml', fullSnapshot: false,
    });
    await importer.importUlic(parseUlicXml(fixture('ULIC.xml')), {
      dataset: 'TERYT_ULIC', sourceVersion: '2026-01-01', sourceUri: 'fixture://ULIC.xml', scopeKey: '3261011', fullSnapshot: false,
    });
  }

  it('enriches existing pilot UUIDs instead of duplicating streets/addresses', async () => {
    await importReferenceSet();
    const result = await importer.importPrgAddresses(prgRows, {
      dataset: 'PRG_ADDRESS', sourceVersion: 'fixture-2026-08-01', sourceUri: 'fixture://PRG-addresses.gml', fullSnapshot: false,
    });

    expect(result.rejected).toBe(1);
    expect(result.rejectedRows[0]).toMatchObject({
      rowKey: 'fixture-pa-invalid-relation',
      reason: expect.stringContaining('missing SIMC 9999999'),
    });

    const street = await pool.query<{ id: string; ulic: string | null }>(
      `SELECT s.id, s.ulic FROM streets s JOIN localities l ON l.id=s.locality_id
       WHERE l.simc='0949448' AND s.name='1 Maja'`,
    );
    expect(street.rows).toHaveLength(1);
    expect(street.rows[0]).toEqual({ id: originalStreetId, ulic: '11926' });

    const enriched = await pool.query<{
      id: string; prg_id: string | null; canonical_text: string; lon: number; lat: number;
    }>(
      `SELECT id, prg_id, canonical_text, ST_X(geom)::double precision AS lon, ST_Y(geom)::double precision AS lat
       FROM addresses WHERE id = ANY($1::uuid[]) ORDER BY canonical_text`,
      [[originalAddress3Id, originalAddress8Id, originalBonin2Id]],
    );
    expect(enriched.rows).toHaveLength(3);
    expect(enriched.rows.find((row) => row.id === originalAddress3Id)?.prg_id).toBe('fixture-pa-1-maja-3');
    expect(enriched.rows.find((row) => row.id === originalAddress8Id)?.prg_id).toBe('fixture-pa-1-maja-8');
    expect(enriched.rows.find((row) => row.id === originalBonin2Id)?.prg_id).toBe('fixture-pa-bonin-2');

    const transformed = enriched.rows.find((row) => row.id === originalAddress3Id)!;
    expect(transformed.lon).toBeCloseTo(16.18, 5);
    expect(transformed.lat).toBeCloseTo(54.19, 5);

    const duplicates = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM addresses WHERE prg_id IN
       ('fixture-pa-1-maja-3','fixture-pa-1-maja-8','fixture-pa-bonin-2')`,
    );
    expect(Number(duplicates.rows[0]!.count)).toBe(3);
  });

  it('is idempotent on replay and keeps service-area rules bound to the same UUID', async () => {
    const terc = await importer.importTerc(parseTercXml(fixture('TERC.xml')), {
      dataset: 'TERYT_TERC', sourceVersion: '2026-01-01-repeat', sourceUri: 'fixture://TERC.xml',
    });
    const simc = await importer.importSimc(parseSimcXml(fixture('SIMC.xml')), {
      dataset: 'TERYT_SIMC', sourceVersion: '2026-01-01-repeat', sourceUri: 'fixture://SIMC.xml',
    });
    const ulic = await importer.importUlic(parseUlicXml(fixture('ULIC.xml')), {
      dataset: 'TERYT_ULIC', sourceVersion: '2026-01-01-repeat', sourceUri: 'fixture://ULIC.xml',
    });
    const prg = await importer.importPrgAddresses(prgRows, {
      dataset: 'PRG_ADDRESS', sourceVersion: 'fixture-2026-08-01-repeat', sourceUri: 'fixture://PRG-addresses.gml',
    });

    expect(terc.inserted).toBe(0);
    expect(simc.inserted).toBe(0);
    expect(ulic.inserted).toBe(0);
    expect(prg.inserted).toBe(0);
    expect(prg.updated).toBe(0);
    expect(prg.unchanged).toBe(3);
    expect(prg.rejected).toBe(1);

    const resolver = new PgServiceAreaResolver(pool);
    const resolution = await resolver.resolveByAddressId(originalAddress3Id, new Date('2026-08-27T12:00:00Z'));
    expect(resolution).toMatchObject({ status: 'MATCHED' });
    if (resolution.status === 'MATCHED') {
      expect(resolution.serviceArea.externalKey).toBe('koszalin-bio-środa');
    }

    const rule = await pool.query<{ address_id: string }>(
      `SELECT address_id FROM service_area_rules WHERE address_id=$1`,
      [originalAddress3Id],
    );
    expect(rule.rows[0]?.address_id).toBe(originalAddress3Id);
  });

  it('updates a changed official row without creating a new address', async () => {
    const bonin = prgRows.find((row) => row.prgId === 'fixture-pa-bonin-2')!;
    const changed: PrgAddressRow = {
      ...bonin,
      x: bonin.x + 0.001,
      sourceUpdatedAt: '2026-08-20T11:00:00Z',
    };
    const result = await importer.importPrgAddresses([changed], {
      dataset: 'PRG_ADDRESS', sourceVersion: 'fixture-change-1', scopeKey: '3209042', fullSnapshot: false,
    });
    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(0);

    const row = await pool.query<{ id: string; prg_id: string }>(
      `SELECT id, prg_id FROM addresses WHERE prg_id='fixture-pa-bonin-2'`,
    );
    expect(row.rows).toEqual([{ id: originalBonin2Id, prg_id: 'fixture-pa-bonin-2' }]);
  });

  it('rejects invalid coordinates and relations with an inspectable import report', async () => {
    const invalidCoordinates: PrgAddressRow = {
      ...prgRows.find((row) => row.prgId === 'fixture-pa-bonin-2')!,
      prgId: 'fixture-pa-invalid-coordinates',
      x: 999,
      y: 999,
      crs: 'EPSG:4326',
    };
    const missingRelation = prgRows.find((row) => row.prgId === 'fixture-pa-invalid-relation')!;
    const result = await importer.importPrgAddresses([invalidCoordinates, missingRelation], {
      dataset: 'PRG_ADDRESS', sourceVersion: 'fixture-invalid', scopeKey: '3209042', fullSnapshot: false,
    });
    expect(result.rejected).toBe(2);
    expect(result.rejectedRows.map((row) => row.rowKey).sort()).toEqual([
      'fixture-pa-invalid-coordinates',
      'fixture-pa-invalid-relation',
    ]);

    const persisted = await pool.query<{ status: string; rejected_count: number; rejected_rows: unknown[] }>(
      `SELECT status, rejected_count, rejected_rows FROM reference_import_runs WHERE id=$1`,
      [result.runId],
    );
    expect(persisted.rows[0]).toMatchObject({ status: 'COMPLETED', rejected_count: 2 });
    expect(persisted.rows[0]!.rejected_rows).toHaveLength(2);
  });

  it('deactivates only PRG-managed missing rows in a scoped full snapshot and can restore them', async () => {
    const koszalin = prgRows.filter((row) => row.municipalityTerc === '3261011' && row.simc !== '9999999');
    const address3 = koszalin.find((row) => row.prgId === 'fixture-pa-1-maja-3')!;
    const address8 = koszalin.find((row) => row.prgId === 'fixture-pa-1-maja-8')!;

    const removal = await importer.importPrgAddresses([address3], {
      dataset: 'PRG_ADDRESS', sourceVersion: 'fixture-snapshot-missing-8', scopeKey: '3261011', fullSnapshot: true,
    });
    expect(removal.deactivated).toBeGreaterThanOrEqual(1);

    const inactive = await pool.query<{ active: boolean }>('SELECT active FROM addresses WHERE id=$1', [originalAddress8Id]);
    expect(inactive.rows[0]?.active).toBe(false);
    const hidden = await app.inject({ method: 'GET', url: '/v1/addresses/resolve?query=1%20Maja%208' });
    expect(hidden.statusCode).toBe(200);
    expect((hidden.json() as { items: unknown[] }).items).toEqual([]);

    const restored = await importer.importPrgAddresses([address3, address8], {
      dataset: 'PRG_ADDRESS', sourceVersion: 'fixture-snapshot-restored', scopeKey: '3261011', fullSnapshot: true,
    });
    expect(restored.updated).toBeGreaterThanOrEqual(1);
    const active = await pool.query<{ active: boolean }>('SELECT active FROM addresses WHERE id=$1', [originalAddress8Id]);
    expect(active.rows[0]?.active).toBe(true);
  });
});
