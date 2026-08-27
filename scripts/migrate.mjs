import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl';
const sql = await readFile(new URL('../db/migrations/0001_init.sql', import.meta.url), 'utf8');

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Applied db/migrations/0001_init.sql');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
