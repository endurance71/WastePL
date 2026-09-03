import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-bobolice-klanino-20260903.json',
);
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const SOURCE_URL =
  'https://cms-v2-files.idcom-jst.pl/sites/52/cms/szablony/5169/zdjecia/orign/2a2130e07b8640d995b493f4bca53e20ej2pjkevuej9bq1k-6.jpg';
const SERVICE_AREA_NAME = 'Gmina Bobolice — Kłanino (Trasa Kłanino/Ubiedrze)';
const BOBOLICE_TERC = '3209033';

interface ExpectedEvent {
  date: string;
  fraction: string;
  status: 'SCHEDULED';
}

interface AddressEntry {
  prgId: string;
  municipalityTerc: string;
  locality: string;
  simc: string;
  street: null;
  ulic: null;
  buildingNumber: string;
  postalCode: string | null;
  x2180: number;
  y2180: number;
  serviceArea: string;
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
  selection: { total: number; municipalityTerc: string; locality: string; simc: string; serviceArea: string };
  addresses: Array<AddressEntry | SnapshotTuple>;
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
      '2026-07-09', '2026-07-17', '2026-07-31',
      '2026-08-14', '2026-08-28',
      '2026-09-11', '2026-09-25',
      '2026-10-09', '2026-10-23',
      '2026-11-06', '2026-11-20',
      '2026-12-04', '2026-12-17',
    ]],
    ['METALS_PLASTICS', [
      '2026-07-10', '2026-07-24',
      '2026-08-07', '2026-08-21',
      '2026-09-04', '2026-09-18',
      '2026-10-02', '2026-10-16', '2026-10-30',
      '2026-11-14', '2026-11-27',
      '2026-12-11', '2026-12-23',
    ]],
    ['GLASS', [
      '2026-07-10', '2026-07-24',
      '2026-08-07', '2026-08-21',
      '2026-09-04', '2026-09-18',
      '2026-10-02', '2026-10-16', '2026-10-30',
      '2026-11-14', '2026-11-27',
      '2026-12-11', '2026-12-23',
    ]],
    ['PAPER', [
      '2026-07-17', '2026-07-31',
      '2026-08-14', '2026-08-28',
      '2026-09-11', '2026-09-25',
      '2026-10-09', '2026-10-23',
      '2026-11-06', '2026-11-20',
      '2026-12-04', '2026-12-17',
    ]],
    ['BIO', [
      '2026-07-17', '2026-07-31',
      '2026-08-14', '2026-08-28',
      '2026-09-11', '2026-09-25',
      '2026-10-09', '2026-10-23',
      '2026-11-06', '2026-11-20',
      '2026-12-04', '2026-12-17',
    ]],
  ];

  const list: ExpectedEvent[] = [];
  for (const [fraction, dates] of rows) {
    for (const date of dates) {
      list.push({ date, fraction, status: 'SCHEDULED' });
    }
  }
  list.sort((a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction));
  return list;
}

function normalizeAddress(entry: AddressEntry | SnapshotTuple): AddressEntry {
  if (Array.isArray(entry)) {
    return {
      prgId: entry[0],
      municipalityTerc: entry[1],
      locality: entry[2],
      simc: entry[3],
      street: null,
      ulic: null,
      buildingNumber: entry[6],
      postalCode: entry[7],
      x2180: entry[8],
      y2180: entry[9],
      serviceArea: entry[10],
    };
  }
  return {
    prgId: entry.prgId,
    municipalityTerc: entry.municipalityTerc ?? BOBOLICE_TERC,
    locality: entry.locality ?? 'Kłanino',
    simc: entry.simc ?? '0304214',
    street: null,
    ulic: null,
    buildingNumber: entry.buildingNumber,
    postalCode: entry.postalCode ?? '76-020',
    x2180: entry.x2180,
    y2180: entry.y2180,
    serviceArea: entry.serviceArea ?? 'bobolice-safe-h2-klanino',
  };
}

async function main(): Promise<void> {
  const gateUrl = gateDatabaseUrl();
  process.env.DATABASE_URL = gateUrl;
  const { createApp } = await import('../main.js');
  const app: NestFastifyApplication = await createApp();
  app.useLogger(['error']);
  await app.init();

  const report = JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>;
  try {
    const workerPostGate = report.boboliceKlanino2026_10PostCheck as Record<string, unknown> | undefined;
    if (report.status !== 'PASS' || workerPostGate?.status !== 'PASS') {
      throw new Error('Bobolice Kłanino worker post-gate must pass before the public API gate');
    }
    const fixtureSha256 = workerPostGate.deterministicFixtureSha256;
    if (typeof fixtureSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(fixtureSha256)) {
      throw new Error('Bobolice worker post-gate did not expose deterministic artifact SHA-256');
    }

    const rawSnapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as Snapshot;
    const addresses = rawSnapshot.addresses.map(normalizeAddress);

    const expected = expectedEvents();
    let verifiedCount = 0;

    for (const address of addresses) {
      const query = `Kłanino ${address.buildingNumber}, ${address.postalCode ?? '76-020'} Kłanino`;
      const response = await app.inject({
        method: 'GET',
        url: `/v1/collection?address=${encodeURIComponent(query)}&from=2026-07-01&days=184`,
      });

      if (response.statusCode !== 200) {
        throw new Error(
          `Expected 200 for ${query}, got ${response.statusCode}: ${response.body}`,
        );
      }

      const body = JSON.parse(response.body) as CollectionBody;
      if (body.municipality?.terc !== BOBOLICE_TERC) {
        throw new Error(`Unexpected TERC for ${query}: ${body.municipality?.terc}`);
      }
      if (body.serviceArea?.name !== SERVICE_AREA_NAME) {
        throw new Error(`Unexpected service area for ${query}: ${body.serviceArea?.name}`);
      }
      if (body.source?.url !== SOURCE_URL) {
        throw new Error(`Unexpected source url for ${query}: ${body.source?.url}`);
      }
      if (body.source?.format !== 'PDF_TEXT') {
        throw new Error(`Unexpected source format for ${query}: ${body.source?.format}`);
      }
      if (body.quality?.verificationStatus !== 'OFFICIAL_SOURCE') {
        throw new Error(`Unexpected verificationStatus for ${query}: ${body.quality?.verificationStatus}`);
      }

      const events = (body.events ?? []).map((e) => ({
        date: e.date,
        fraction: e.fraction,
        status: e.status,
      }));
      events.sort((a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction));

      if (events.length !== 63 || !isDeepStrictEqual(events, expected)) {
        throw new Error(
          `Event list mismatch for ${query}: got ${events.length}, expected 63. Events: ${JSON.stringify(events)}`,
        );
      }

      verifiedCount += 1;
    }

    report.boboliceKlaninoApiPostGate = {
      status: 'PASS',
      verifiedAt: new Date().toISOString(),
      manifestVersion: '2026.10',
      serviceAreaName: SERVICE_AREA_NAME,
      testedAddresses: verifiedCount,
      totalGoldenAddresses: addresses.length,
      eventsPerAddress: 63,
      httpStatus: 200,
      verificationStatus: 'OFFICIAL_SOURCE',
      coverageMilestone: '8/8 MUNICIPALITIES VERIFIED ON PUBLIC API',
    };

    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(
      `[PASS] Bobolice Kłanino API post-gate passed: ${verifiedCount}/${addresses.length} addresses verified with 63 events on /v1/collection (8/8 pilot municipalities active).`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[FAIL] Bobolice Kłanino API post-gate failed:', err);
  process.exit(1);
});
