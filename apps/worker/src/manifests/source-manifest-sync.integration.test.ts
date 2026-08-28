import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgSourceManifestSync } from './source-manifest-sync.js';
import type { SourceManifest } from './source-manifest.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

const MUNICIPALITIES = [
  ['3261011', 'Koszalin'],
  ['3209033', 'Bobolice'],
  ['3209073', 'Sianów'],
  ['3209042', 'Manowo'],
  ['3209082', 'Świeszyno'],
  ['3209012', 'Będzino'],
  ['3209063', 'Polanów'],
  ['3201043', 'Tychowo'],
] as const;

integrationDescribe('PgSourceManifestSync', () => {
  let pool: InstanceType<typeof Pool>;
  let sync: PgSourceManifestSync;
  const insertedMunicipalities: string[] = [];
  const manifestId = `test-pilot-${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const sourcePrefix = `https://example.test/wastepl-manifest/${randomUUID()}`;

  const manifest: SourceManifest = {
    schemaVersion: '0.1.0',
    manifestId,
    version: '2026.1',
    generatedAt: '2026-08-27T20:30:00Z',
    municipalities: MUNICIPALITIES.map(([terc, name], index) => ({
      terc,
      name,
      sources: [
        {
          key: `${manifestId}-${terc}-collection`,
          dataType: 'COLLECTION_SCHEDULE',
          url: `${sourcePrefix}/${terc}${index === 0 ? '.pdf' : '.html'}`,
          format: index === 0 ? 'PDF_TEXT' : index === 5 ? 'XLSX' : 'HTML',
          status: index === 0 ? 'ACTIVE' : 'PLANNED',
          parserKey: index === 0 ? 'pgk-koszalin-pdf-text' : null,
          pollIntervalMinutes: 1440,
          ownerType: 'MUNICIPALITY',
          ownerName: `Manifest integration ${name}`,
          reuseNotes: 'Synthetic integration URL; validates registry semantics only.',
          activeFrom: '2026-01-01',
          activeTo: '2026-12-31',
        },
      ],
    })),
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    sync = new PgSourceManifestSync(pool);
    for (const [terc, name] of MUNICIPALITIES) {
      const inserted = await pool.query<{ terc: string }>(
        `INSERT INTO municipalities (terc, name, municipality_type)
         VALUES ($1, $2, 'integration-test')
         ON CONFLICT (terc) DO NOTHING
         RETURNING terc`,
        [terc, name],
      );
      if (inserted.rows[0]) insertedMunicipalities.push(terc);
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM sources WHERE manifest_version LIKE $1', [`${manifestId}%`]);
    if (insertedMunicipalities.length) {
      await pool.query('DELETE FROM municipalities WHERE terc = ANY($1::text[])', [insertedMunicipalities]);
    }
    await pool.end();
  });

  it('syncs the manifest twice without duplicating or changing source ids', async () => {
    const asOf = new Date('2026-08-27T20:30:00Z');
    const first = await sync.sync(manifest, asOf);
    expect(first).toEqual({
      manifestId,
      version: '2026.1',
      municipalityCount: 8,
      sourceCount: 8,
      activeCount: 1,
      plannedCount: 7,
    });

    const before = await pool.query<{ source_key: string; id: string; active: boolean; manifest_status: string }>(
      `SELECT source_key, id, active, manifest_status
       FROM sources WHERE manifest_version=$1 ORDER BY source_key`,
      [`${manifestId}@2026.1`],
    );
    expect(before.rows).toHaveLength(8);
    expect(before.rows.filter((row) => row.active)).toHaveLength(1);
    expect(before.rows.filter((row) => row.manifest_status === 'PLANNED').every((row) => !row.active)).toBe(true);

    await sync.sync(manifest, asOf);
    const after = await pool.query<{ source_key: string; id: string; active: boolean }>(
      `SELECT source_key, id, active
       FROM sources WHERE manifest_version=$1 ORDER BY source_key`,
      [`${manifestId}@2026.1`],
    );
    expect(after.rows.map((row) => [row.source_key, row.id])).toEqual(
      before.rows.map((row) => [row.source_key, row.id]),
    );
  });

  it('persists deterministic multi-artifact bundle metadata', async () => {
    const bundleManifestId = `${manifestId}-bundle`;
    const bundleManifest: SourceManifest = {
      schemaVersion: '0.1.0',
      manifestId: bundleManifestId,
      version: '2026.1',
      generatedAt: '2026-08-27T20:30:00Z',
      municipalities: [
        {
          terc: '3261011',
          name: 'Koszalin',
          sources: [
            {
              key: `${bundleManifestId}-main`,
              dataType: 'PSZOK',
              url: `${sourcePrefix}/bundle-main`,
              format: 'HTML',
              status: 'ACTIVE',
              parserKey: 'pgk-koszalin-pszok-html',
              pollIntervalMinutes: 1440,
              ownerType: 'OTHER_OFFICIAL',
              ownerName: 'Bundle manifest integration',
              reuseNotes: 'Synthetic bundle main source.',
              activeFrom: null,
              activeTo: null,
              bundle: {
                key: `${bundleManifestId}-pszok`,
                role: 'main',
                requiredRoles: ['main', 'faq'],
                freshnessMinutes: 2880,
              },
            },
            {
              key: `${bundleManifestId}-faq`,
              dataType: 'PSZOK',
              url: `${sourcePrefix}/bundle-faq`,
              format: 'HTML',
              status: 'ACTIVE',
              parserKey: 'pgk-koszalin-pszok-html',
              pollIntervalMinutes: 1440,
              ownerType: 'OTHER_OFFICIAL',
              ownerName: 'Bundle manifest integration',
              reuseNotes: 'Synthetic bundle FAQ source.',
              activeFrom: null,
              activeTo: null,
              bundle: {
                key: `${bundleManifestId}-pszok`,
                role: 'faq',
                requiredRoles: ['main', 'faq'],
                freshnessMinutes: 2880,
              },
            },
          ],
        },
      ],
    };

    const result = await sync.sync(bundleManifest, new Date('2026-08-27T20:30:00Z'));
    expect(result).toMatchObject({ municipalityCount: 1, sourceCount: 2, activeCount: 2, plannedCount: 0 });

    const rows = await pool.query<{
      source_key: string;
      bundle_key: string;
      bundle_role: string;
      bundle_required_roles: string[];
      bundle_freshness_minutes: number;
    }>(
      `SELECT source_key, bundle_key, bundle_role, bundle_required_roles, bundle_freshness_minutes
       FROM sources
       WHERE manifest_version = $1
       ORDER BY bundle_role`,
      [`${bundleManifestId}@2026.1`],
    );

    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.map((row) => row.bundle_role)).toEqual(['faq', 'main']);
    expect(rows.rows.every((row) => row.bundle_key === `${bundleManifestId}-pszok`)).toBe(true);
    expect(rows.rows.every((row) => row.bundle_freshness_minutes === 2880)).toBe(true);
    expect(rows.rows.every((row) => [...row.bundle_required_roles].sort().join(',') === 'faq,main')).toBe(true);
  });

  it('reports municipality/data-type coverage for one manifest version and never schedules unsupported PLANNED formats', async () => {
    const coverage = await sync.coverage(manifestId, '2026.1');
    expect(coverage).toHaveLength(8);
    expect(new Set(coverage.map((row) => row.terc)).size).toBe(8);
    expect(coverage.every((row) => row.dataType === 'COLLECTION_SCHEDULE')).toBe(true);
    expect(coverage.reduce((sum, row) => sum + row.schedulableEntries, 0)).toBe(1);

    const xlsx = await pool.query<{ active: boolean; parser_key: string | null; manifest_status: string }>(
      `SELECT active, parser_key, manifest_status
       FROM sources WHERE source_key=$1`,
      [`${manifestId}-3209012-collection`],
    );
    expect(xlsx.rows[0]).toEqual({ active: false, parser_key: null, manifest_status: 'PLANNED' });
  });

  it('fails before writing if the official municipality backbone is missing a TERC', async () => {
    const invalid = structuredClone(manifest);
    invalid.municipalities[0]!.terc = '3299999';
    invalid.municipalities[0]!.sources[0]!.key = `${manifestId}-missing-terc`;
    invalid.municipalities[0]!.sources[0]!.url = `${sourcePrefix}/missing-terc.pdf`;

    await expect(sync.sync(invalid, new Date('2026-08-27T20:30:00Z'))).rejects.toThrow(/missing from official TERYT backbone/);
    const missingWrites = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM sources WHERE source_key=$1`,
      [`${manifestId}-missing-terc`],
    );
    expect(missingWrites.rows[0]?.count).toBe('0');
  });
});
