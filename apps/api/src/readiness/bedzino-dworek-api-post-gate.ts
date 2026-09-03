import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-bedzino-dworek-20260903.json',
);
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const SOURCE_URL = 'https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-I.pdf';
const SERVICE_AREA_NAME = 'Gmina Będzino — Dworek (Trasa I)';
const BEDZINO_TERC = '3209012';

interface ExpectedEvent {
  date: string;
  fraction: string;
  status: 'SCHEDULED';
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

interface Snapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: { responseSha256: string };
  selection: { total: number; municipalityTerc: string; locality: string; simc: string; serviceArea: string };
  addresses: SnapshotTuple[];
}

interface CollectionBody {
  address?: { canonicalText?: string };
  municipality?: { terc?: string; name?: string };
  serviceArea?: { name?: string };
  events?: ExpectedEvent[];
  source?: {
    url?: string;
    format?: string;
    artifactId?: string;
    sha256?: string;
    parserKey?: string | null;
    parserVersion?: string | null;
  };
  quality?: {
    verificationStatus?: string;
    confidence?: number;
    warnings?: string[];
  };
  code?: string;
}

function gateDatabaseUrl(): string {
  if (process.env.PRODUCTION_GATE_DATABASE_URL) return process.env.PRODUCTION_GATE_DATABASE_URL;
  const base = new URL(
    process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  );
  base.pathname = '/wastepl_production_gate';
  return base.toString();
}

function expectedEvents(): ExpectedEvent[] {
  const rows: Array<[string, string[]]> = [
    ['MIXED', [
      '2026-07-14', '2026-07-28',
      '2026-08-11', '2026-08-25',
      '2026-09-08', '2026-09-22',
      '2026-10-06', '2026-10-20',
      '2026-11-03', '2026-11-17',
      '2026-12-01', '2026-12-15', '2026-12-29',
    ]],
    ['BIO', [
      '2026-07-03', '2026-07-17', '2026-07-31',
      '2026-08-14', '2026-08-28',
      '2026-09-11', '2026-09-25',
      '2026-10-09', '2026-10-23',
      '2026-11-06',
      '2026-12-04',
    ]],
    ['OTHER', [
      '2026-07-02', '2026-07-02', '2026-07-16', '2026-07-16', '2026-07-30', '2026-07-30',
      '2026-08-13', '2026-08-13', '2026-08-27', '2026-08-27',
      '2026-09-10', '2026-09-10', '2026-09-24', '2026-09-24',
      '2026-10-08', '2026-10-08', '2026-10-22',
      '2026-11-05', '2026-11-05',
      '2026-12-03', '2026-12-03',
    ]],
  ];
  return rows
    .flatMap(([fraction, dates]) => dates.map((date) => ({ date, fraction, status: 'SCHEDULED' as const })))
    .sort((left, right) => left.date.localeCompare(right.date) || left.fraction.localeCompare(right.fraction));
}

function addressQuery(tuple: SnapshotTuple): string {
  return `${tuple[2]} ${tuple[6]}`;
}

function canonicalText(tuple: SnapshotTuple): string {
  const [, , locality, , , , buildingNumber, postalCode] = tuple;
  return postalCode ? `${locality} ${buildingNumber}, ${postalCode} ${locality}` : `${locality} ${buildingNumber}, ${locality}`;
}

async function main(): Promise<void> {
  const gateUrl = gateDatabaseUrl();
  process.env.DATABASE_URL = gateUrl;
  const { createApp } = await import('../main.js');
  const app: NestFastifyApplication = await createApp();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const report = JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>;
  try {
    const rawSnapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as Snapshot;
    const expected = expectedEvents();
    let validated = 0;

    for (const tuple of rawSnapshot.addresses) {
      const query = addressQuery(tuple);
      const resolveResponse = await app.inject({
        method: 'GET',
        url: `/v1/addresses/resolve?query=${encodeURIComponent(query)}&terc=${BEDZINO_TERC}`,
      });
      if (resolveResponse.statusCode !== 200) {
        throw new Error(`Resolve failed for ${query}: HTTP ${resolveResponse.statusCode} ${resolveResponse.body}`);
      }
      const resolveBody = JSON.parse(resolveResponse.body) as {
        status: string;
        candidateCount: number;
        exactMatch: { prgId: string; canonicalText: string } | null;
      };
      if (
        resolveBody.status !== 'RESOLVED' ||
        resolveBody.candidateCount !== 1 ||
        resolveBody.exactMatch?.prgId !== tuple[0]
      ) {
        throw new Error(`Resolve mismatch for ${query}: ${resolveResponse.body}`);
      }
      const expectedCanonical = canonicalText(tuple);
      if (resolveBody.exactMatch.canonicalText !== expectedCanonical) {
        throw new Error(`Canonical text mismatch for ${query}: expected ${expectedCanonical}, got ${resolveBody.exactMatch.canonicalText}`);
      }

      const collectionResponse = await app.inject({
        method: 'GET',
        url: `/v1/collection?addressId=${encodeURIComponent(tuple[0])}`,
      });
      if (collectionResponse.statusCode !== 200) {
        throw new Error(`Collection failed for ${tuple[0]}: HTTP ${collectionResponse.statusCode} ${collectionResponse.body}`);
      }
      const collectionBody = JSON.parse(collectionResponse.body) as CollectionBody;
      if (
        collectionBody.municipality?.terc !== BEDZINO_TERC ||
        collectionBody.municipality?.name !== 'Będzino' ||
        collectionBody.serviceArea?.name !== SERVICE_AREA_NAME ||
        collectionBody.source?.url !== SOURCE_URL ||
        collectionBody.source?.format !== 'PDF_TEXT' ||
        collectionBody.source?.parserKey !== 'municipal-collection-pdf-text' ||
        collectionBody.source?.parserVersion !== '0.2.0' ||
        collectionBody.quality?.verificationStatus !== 'OFFICIAL_SOURCE'
      ) {
        throw new Error(`Collection metadata mismatch for ${tuple[0]}: ${collectionResponse.body}`);
      }
      if (!isDeepStrictEqual(collectionBody.events, expected)) {
        throw new Error(`Collection events mismatch for ${tuple[0]}: ${JSON.stringify(collectionBody.events)}`);
      }

      validated += 1;
    }

    report.bedzinoDworek2026_7ApiPostCheck = {
      status: 'PASS',
      endpoint: '/v1/collection',
      sourceUrl: SOURCE_URL,
      realAddressesTested: rawSnapshot.addresses.length,
      realAddressesPassed: validated,
      serviceAreaName: SERVICE_AREA_NAME,
      eventsPerAddress: expected.length,
      criticalWrongDateMismatches: 0,
      ambiguousResponses: 0,
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Będzino Dworek 2026.7 API post-gate PASS: ${validated}/${rawSnapshot.addresses.length} PRG addresses verified against live API`);
  } catch (error) {
    report.bedzinoDworek2026_7ApiPostCheck = {
      status: 'FAIL',
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
    };
    report.status = 'FAIL';
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    throw error;
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
