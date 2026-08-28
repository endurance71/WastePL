import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgSourceManifestSync } from './source-manifest-sync.js';
import { parseSourceManifest } from './source-manifest.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

const manifest20261 = parseSourceManifest(JSON.parse(readFileSync(
  new URL('../../../../manifests/pilot-koszalin-region-2026.1.json', import.meta.url),
  'utf8',
)));
const manifest20262 = parseSourceManifest(JSON.parse(readFileSync(
  new URL('../../../../manifests/pilot-koszalin-region-2026.2.json', import.meta.url),
  'utf8',
)));

const MUNICIPALITIES = manifest20262.municipalities.map((entry) => [entry.terc, entry.name] as const);

integrationDescribe('pilot manifest 2026.1 -> 2026.2 rollout', () => {
  let pool: InstanceType<typeof Pool>;
  let sync: PgSourceManifestSync;
  const insertedMunicipalities: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    sync = new PgSourceManifestSync(pool);
    for (const [terc, name] of MUNICIPALITIES) {
      const inserted = await pool.query<{ terc: string }>(
        `INSERT INTO municipalities (terc, name, municipality_type)
         VALUES ($1, $2, 'rollout-integration-test')
         ON CONFLICT (terc) DO NOTHING
         RETURNING terc`,
        [terc, name],
      );
      if (inserted.rows[0]) insertedMunicipalities.push(terc);
    }
  });

  afterAll(async () => {
    if (insertedMunicipalities.length) {
      await pool.query('DELETE FROM municipalities WHERE terc = ANY($1::text[])', [insertedMunicipalities]);
    }
    await pool.end();
  });

  it('preserves stable source UUIDs while promoting only the two verified PSZOK sources', async () => {
    const asOf = new Date('2026-08-28T10:30:00.000Z');
    const v1 = await sync.sync(manifest20261, asOf);
    expect(v1).toMatchObject({
      manifestId: 'pilot-koszalin-region',
      version: '2026.1',
      municipalityCount: 8,
      sourceCount: 13,
      activeCount: 4,
      plannedCount: 9,
    });

    const before = await pool.query<{
      id: string;
      source_key: string;
      source_url: string;
      manifest_status: string;
    }>(
      `SELECT id, source_key, source_url, manifest_status
       FROM sources
       WHERE source_key = ANY($1::text[])
       ORDER BY source_key`,
      [[...manifest20261.municipalities.flatMap((entry) => entry.sources.map((source) => source.key))]],
    );
    const idsBefore = new Map(before.rows.map((row) => [row.source_key, row.id]));

    const v2 = await sync.sync(manifest20262, asOf);
    expect(v2).toMatchObject({
      manifestId: 'pilot-koszalin-region',
      version: '2026.2',
      municipalityCount: 8,
      sourceCount: 13,
      activeCount: 6,
      plannedCount: 7,
    });

    const after = await pool.query<{
      id: string;
      source_key: string;
      source_url: string;
      parser_key: string | null;
      active: boolean;
      manifest_status: string;
      source_shape: string | null;
      evidence_status: string | null;
      activation_blocker: string | null;
      child_artifact_urls: string[];
    }>(
      `SELECT id, source_key, source_url, parser_key, active, manifest_status,
              source_shape, evidence_status, activation_blocker, child_artifact_urls
       FROM sources
       WHERE manifest_version = 'pilot-koszalin-region@2026.2'
       ORDER BY source_key`,
    );
    expect(after.rows).toHaveLength(13);

    for (const row of after.rows) {
      expect(row.id, `source UUID changed for ${row.source_key}`).toBe(idsBefore.get(row.source_key));
    }

    const bobolice = after.rows.find((row) => row.source_key === 'bobolice-pszok');
    const swieszyno = after.rows.find((row) => row.source_key === 'swieszyno-pszok');
    for (const row of [bobolice, swieszyno]) {
      expect(row).toMatchObject({
        parser_key: 'municipal-pszok-html',
        active: true,
        manifest_status: 'ACTIVE',
        source_shape: 'DIRECT_CONTENT',
        evidence_status: 'VERIFIED',
        activation_blocker: null,
      });
    }

    const plannedAssessed = after.rows.filter((row) => [
      'bobolice-collection-2026',
      'sianow-collection-2026-h2',
      'swieszyno-collection-2026',
      'bedzino-collection-2026-h2',
      'polanow-collection-2026',
      'tychowo-collection-2026',
    ].includes(row.source_key));
    expect(plannedAssessed).toHaveLength(6);
    expect(plannedAssessed.every((row) =>
      row.manifest_status === 'PLANNED'
      && row.active === false
      && row.parser_key === null
      && Boolean(row.activation_blocker),
    )).toBe(true);

    const sianow = after.rows.find((row) => row.source_key === 'sianow-collection-2026-h2');
    expect(sianow?.child_artifact_urls.length).toBeGreaterThanOrEqual(20);

    const tychowo = after.rows.find((row) => row.source_key === 'tychowo-collection-2026');
    expect(tychowo?.child_artifact_urls).toHaveLength(2);
    expect(tychowo?.source_url).toBe(
      'https://tychowo.pl/wiadomosci/128301/harmomogram-odbioru-odpadow-komunalnych-na-2026-r-',
    );
  });

  it('syncs 2026.2 idempotently without changing source identities or assessment metadata', async () => {
    const asOf = new Date('2026-08-28T10:30:00.000Z');
    await sync.sync(manifest20262, asOf);
    const before = await pool.query<{
      source_key: string;
      id: string;
      source_shape: string | null;
      evidence_status: string | null;
      activation_blocker: string | null;
      child_artifact_urls: unknown;
    }>(
      `SELECT source_key, id, source_shape, evidence_status, activation_blocker, child_artifact_urls
       FROM sources WHERE manifest_version='pilot-koszalin-region@2026.2'
       ORDER BY source_key`,
    );

    await sync.sync(manifest20262, asOf);
    const after = await pool.query(
      `SELECT source_key, id, source_shape, evidence_status, activation_blocker, child_artifact_urls
       FROM sources WHERE manifest_version='pilot-koszalin-region@2026.2'
       ORDER BY source_key`,
    );
    expect(after.rows).toEqual(before.rows);
  });
});
