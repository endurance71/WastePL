import pg from 'pg';
import { describe, expect, it } from 'vitest';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('PGK Koszalin PSZOK source registry migration', () => {
  it('registers both official HTML sources with the deterministic parser key', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const result = await pool.query<{
        source_url: string;
        source_format: string;
        parser_key: string;
        terc: string | null;
      }>(
        `SELECT s.source_url, s.source_format, s.parser_key, m.terc
         FROM sources s
         LEFT JOIN municipalities m ON m.id = s.municipality_id
         WHERE s.source_url = ANY($1::text[])
         ORDER BY s.source_url`,
        [[
          'https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-koszalin/',
          'https://www.pgkkoszalin.pl/najczesciej-zadawane-pytania-f-a-q/',
        ]],
      );

      expect(result.rows).toHaveLength(2);
      for (const row of result.rows) {
        expect(row.source_format).toBe('HTML');
        expect(row.parser_key).toBe('pgk-koszalin-pszok-html');
        expect(row.terc).toBe('3261011');
      }
    } finally {
      await pool.end();
    }
  });
});
