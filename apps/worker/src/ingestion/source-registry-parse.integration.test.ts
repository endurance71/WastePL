import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgSourceRegistry } from './source-registry.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('PgSourceRegistry parser audit metadata', () => {
  let pool: InstanceType<typeof Pool>;
  let sourceId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const source = await pool.query<{ id: string }>(
      `INSERT INTO sources (owner_type, owner_name, source_url, source_format, parser_key)
       VALUES ('MUNICIPAL_COMPANY', 'PGK test', 'https://example.test/wastepl/pszok-parser-audit', 'HTML', 'pgk-koszalin-pszok-html')
       ON CONFLICT (source_url) DO UPDATE SET parser_key = EXCLUDED.parser_key
       RETURNING id`,
    );
    sourceId = source.rows[0]!.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM sources WHERE id = $1', [sourceId]);
    await pool.end();
  });

  it('persists parser version, confidence and parse report on the exact artifact', async () => {
    const registry = new PgSourceRegistry(pool);
    const artifact = await registry.insertArtifact({
      sourceId,
      retrievedAt: new Date('2026-08-27T17:41:00Z'),
      sha256: 'a'.repeat(64),
      storageUri: 'fixture://pgk-pszok-audit.html',
      parserKey: 'pgk-koszalin-pszok-html',
    });

    await registry.markArtifactParsed({
      artifactId: artifact.id,
      parserKey: 'pgk-koszalin-pszok-html',
      parserVersion: '1.0.0',
      extractionConfidence: 0.99,
      status: 'NORMALIZED',
      parseReport: {
        facilityKey: 'pl-3261011-pszok-komunalna-5',
        sourceAssertions: ['location', 'hours', 'access'],
      },
    });

    const result = await pool.query<{
      parser_key: string;
      parser_version: string;
      extraction_confidence: string;
      status: string;
      parse_report: { facilityKey: string };
    }>(
      `SELECT parser_key, parser_version, extraction_confidence, status, parse_report
       FROM source_artifacts WHERE id = $1`,
      [artifact.id],
    );

    expect(result.rows[0]).toMatchObject({
      parser_key: 'pgk-koszalin-pszok-html',
      parser_version: '1.0.0',
      status: 'NORMALIZED',
      parse_report: { facilityKey: 'pl-3261011-pszok-komunalna-5' },
    });
    expect(Number(result.rows[0]?.extraction_confidence)).toBeCloseTo(0.99);
  });
});
