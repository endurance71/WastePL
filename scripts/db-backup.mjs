#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const backupDir = path.join(root, 'backups');

if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

const isDryRun = process.argv.includes('--dry-run');
const isVerifyOnly = process.argv.includes('--verify-only');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dumpFilename = `wastepl-db-backup-${timestamp}.sql`;
const dumpPath = path.join(backupDir, dumpFilename);
const metaPath = path.join(backupDir, `${dumpFilename}.json`);

const databaseUrl = process.env.DATABASE_URL || 'postgresql://wastepl:wastepl@localhost:5432/wastepl';

console.log(`[Backup Manager] Target DB: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}`);

if (isDryRun) {
  console.log('[Backup Manager] Dry-run mode enabled. Simulating backup creation...');
  const simulatedMetadata = {
    timestamp: new Date().toISOString(),
    filename: dumpFilename,
    sha256: 'simulated-checksum-dry-run-00000000000000000000000000000000',
    mode: 'dry-run',
    status: 'SUCCESS',
    offsite: process.env.OFFSITE_BACKUP_S3_BUCKET ? {
      target: `s3://${process.env.OFFSITE_BACKUP_S3_BUCKET}/backups/${dumpFilename}`,
      status: 'SIMULATED_OFFSITE_UPLOAD_SUCCESS',
    } : null,
  };
  console.log('[Backup Manager] Simulated backup metadata:\n', JSON.stringify(simulatedMetadata, null, 2));
  process.exit(0);
}

try {
  // Prefer docker compose exec to guarantee exact server version match (PostgreSQL 16)
  let dumped = false;
  try {
    const dockerCheck = spawnSync('docker', ['compose', 'ps', '-q', 'postgres'], { encoding: 'utf8' });
    if (dockerCheck.status === 0 && dockerCheck.stdout.trim().length > 0) {
      console.log('[Backup Manager] Using docker compose exec postgres pg_dump (matching server version)...');
      const dockerDump = execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'wastepl', '-d', 'wastepl', '--clean', '--if-exists', '--no-owner', '--no-privileges'], {
        maxBuffer: 100 * 1024 * 1024,
      });
      writeFileSync(dumpPath, dockerDump);
      dumped = true;
    }
  } catch (e) {
    console.log('[Backup Manager] Docker exec failed, trying host pg_dump...');
  }

  if (!dumped) {
    execFileSync('pg_dump', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '-d', databaseUrl, '-f', dumpPath], {
      stdio: 'inherit',
    });
  }

  // Calculate SHA-256
  const fileBytes = readFileSync(dumpPath);
  const sha256 = createHash('sha256').update(fileBytes).digest('hex');

  const metadata = {
    timestamp: new Date().toISOString(),
    filename: dumpFilename,
    sizeBytes: fileBytes.length,
    sha256,
    status: 'SUCCESS',
  };

  writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`[Backup Manager] Backup saved: ${dumpPath} (${(fileBytes.length / 1024).toFixed(1)} KB)`);
  console.log(`[Backup Manager] SHA-256: ${sha256}`);
  console.log(`[Backup Manager] Metadata saved: ${metaPath}`);

} catch (error) {
  console.error('[Backup Manager] Backup failed:', error.message);
  process.exit(1);
}
