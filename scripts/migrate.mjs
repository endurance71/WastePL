import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl';
const migrationsDir = fileURLToPath(new URL('../db/migrations/', import.meta.url));
const migrationProfile = process.env.WASTEPL_MIGRATION_PROFILE ?? 'all';

if (!['all', 'structural'].includes(migrationProfile)) {
  throw new Error(`Unsupported WASTEPL_MIGRATION_PROFILE=${migrationProfile}`);
}

// These historical migrations deliberately materialize deterministic pilot fixtures.
// They remain part of the default local/test history for backwards compatibility,
// but a production-like bootstrap must prove that canonical data can be produced by
// reference import + manifest + ingestion/runtime instead of by SQL fixture seeds.
const fixtureSeedMigrations = new Set([
  '0003_pilot_address_slice.sql',
  '0004_pilot_schedule_slice.sql',
  '0005_golden_pilot_addresses.sql',
  '0007_pgk_koszalin_pszok_sources.sql',
]);

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const legacy = await client.query("SELECT to_regclass('public.municipalities') AS table_name");
  const firstMigration = '0001_init.sql';
  if (legacy.rows[0]?.table_name) {
    await client.query(
      'INSERT INTO schema_migrations(name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [firstMigration],
    );
  }

  const files = (await readdir(migrationsDir))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .filter((name) => migrationProfile !== 'structural' || !fixtureSeedMigrations.has(name))
    .sort();

  if (migrationProfile === 'structural') {
    console.log(`Structural migration profile: excluding fixture seed migrations ${[...fixtureSeedMigrations].join(', ')}`);
  }

  const applied = await client.query('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.rows.map((row) => row.name));

  for (const file of files) {
    if (appliedNames.has(file)) continue;

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied db/migrations/${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.end();
}
