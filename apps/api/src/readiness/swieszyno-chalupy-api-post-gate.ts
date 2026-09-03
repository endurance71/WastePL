import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-swieszyno-chalupy-20260903.json',
);
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const SOURCE_URL = 'https://ug.swieszyno.ibip.pl/public/getFile?id=472491';
const SERVICE_AREA_NAME = 'Gmina Świeszyno — Chałupy (Trasa I)';
const SWIESZYNO_TERC = '3209082';

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
      '2026-07-03', '2026-07-17', '2026-07-31',
      '2026-08-14', '2026-08-28',
      '2026-09-11', '2026-09-25',
      '2026-10-09', '2026-10-23',
      '2026-11-06', '2026-11-20',
      '2026-12-04', '2026-12-18', '2026-12-31',
    ]],
    ['OTHER', [
      '2026-07-01', '2026-07-15', '2026-07-29',
      '2026-08-12', '2026-08-26',
      '2026-09-09', '2026-09-23',
      '2026-10-07', '2026-10-21',
      '2026-11-04', '2026-11-18',
      '2026-12-02', '2026-12-16', '2026-12-30',
    ]],
    ['BULKY', [
      '2026-10-01',
    ]],
  ];

  return rows
    .flatMap(([fraction, dates]) => dates.map((date) => ({ date, fraction, status: 'SCHEDULED' as const })))
    .sort((left, right) => left.date.localeCompare(right.date) || left.fraction.localeCompare(right.fraction));
}

function normalizeTuple(entry: AddressEntry | SnapshotTuple): SnapshotTuple {
  if (Array.isArray(entry)) return entry;
  return [
    entry.prgId,
    entry.municipalityTerc,
    entry.locality,
    entry.simc,
    null,
    null,
    entry.buildingNumber,
    entry.postalCode,
    entry.x2180,
    entry.y2180,
    entry.serviceArea,
  ];
}

function addressQuery(tuple: SnapshotTuple): string {
  return `${tuple[2]} ${tuple[6]}`;
}

function canonicalText(tuple: SnapshotTuple): string {
  const [, , locality, , , , buildingNumber, postalCode] = tuple;
  const postal = postalCode ?? '76-024';
  return `${locality} ${buildingNumber}, ${postal} ${locality}`;
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
    const workerPostGate = report.swieszynoChalupy2026_9PostCheck as Record<string, unknown> | undefined;
    if (report.status !== 'PASS' || workerPostGate?.status !== 'PASS') {
      throw new Error('Świeszyno Chałupy worker post-gate must pass before the public API gate');
    }
    const fixtureSha256 = workerPostGate.deterministicFixtureSha256;
    if (typeof fixtureSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(fixtureSha256)) {
      throw new Error('Świeszyno worker post-gate did not expose deterministic artifact SHA-256');
    }

    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as Snapshot;
    if (
      snapshot.schemaVersion !== '1.0.0' ||
      snapshot.snapshotDate !== '2026-09-03' ||
      snapshot.selection.total !== 167 ||
      snapshot.selection.municipalityTerc !== SWIESZYNO_TERC ||
      snapshot.selection.locality !== 'Chałupy' ||
      snapshot.selection.simc !== '0313377' ||
      snapshot.addresses.length !== 167
    ) {
      throw new Error(`Unexpected Świeszyno Chałupy API evidence snapshot: ${JSON.stringify(snapshot.selection)}`);
    }

    const expected = expectedEvents();
    if (expected.length !== 29) throw new Error(`Expected 29 source-backed Chałupy events, got ${expected.length}`);

    const mismatches: Array<Record<string, unknown>> = [];
    let passed = 0;
    let ambiguousResponses = 0;
    let criticalScheduleMismatches = 0;

    for (const rawEntry of snapshot.addresses) {
      const tuple = normalizeTuple(rawEntry);
      const [prgId, municipalityTerc, locality, simc, , , buildingNumber, postalCode, x2180, y2180, serviceArea] = tuple;
      const query = addressQuery(tuple);
      const response = await app.inject({
        method: 'GET',
        url: `/v1/collection?address=${encodeURIComponent(query)}&from=2026-07-01&days=184`,
      });
      const body = response.json() as CollectionBody;
      const actual = response.statusCode === 200
        ? {
            statusCode: 200,
            canonicalText: body.address?.canonicalText,
            municipalityTerc: body.municipality?.terc,
            municipalityName: body.municipality?.name,
            serviceAreaName: body.serviceArea?.name,
            events: body.events,
            sourceUrl: body.source?.url,
            sourceFormat: body.source?.format,
            sourceSha256: body.source?.sha256,
            parserKey: body.source?.parserKey,
            parserVersion: body.source?.parserVersion,
            verificationStatus: body.quality?.verificationStatus,
          }
        : { statusCode: response.statusCode, code: body.code ?? null };
      const wanted = {
        statusCode: 200,
        canonicalText: canonicalText(tuple),
        municipalityTerc: SWIESZYNO_TERC,
        municipalityName: 'Świeszyno',
        serviceAreaName: SERVICE_AREA_NAME,
        events: expected,
        sourceUrl: SOURCE_URL,
        sourceFormat: 'PDF_TEXT',
        sourceSha256: fixtureSha256,
        parserKey: 'municipal-collection-pdf-text',
        parserVersion: '0.2.0',
        verificationStatus: 'OFFICIAL_SOURCE',
      };

      if (isDeepStrictEqual(actual, wanted)) {
        passed += 1;
        continue;
      }

      const eventsEqual = response.statusCode === 200 && isDeepStrictEqual(body.events ?? [], expected);
      if (!eventsEqual) criticalScheduleMismatches += 1;
      if (
        response.statusCode === 409 &&
        (body.code === 'AMBIGUOUS_SERVICE_AREA' || body.code === 'AMBIGUOUS_ADDRESS')
      ) {
        ambiguousResponses += 1;
      }
      mismatches.push({
        prgId,
        addressQuery: query,
        municipalityTerc,
        locality,
        simc,
        buildingNumber,
        postalCode,
        geometry2180: { x: x2180, y: y2180 },
        serviceArea,
        actual,
        wanted,
      });
    }

    report.swieszynoChalupy2026_9ApiPostCheck = {
      status: passed === snapshot.addresses.length ? 'PASS' : 'FAIL',
      verifiedAt: new Date().toISOString(),
      manifestVersion: '2026.9',
      sourceKey: 'swieszyno-collection-trasa-1-safe-h2-2026',
      serviceAreaKey: 'swieszyno-safe-h2-chalupy',
      serviceAreaName: SERVICE_AREA_NAME,
      testedAddresses: snapshot.addresses.length,
      passedAddresses: passed,
      mismatchCount: mismatches.length,
      ambiguousResponses,
      criticalScheduleMismatches,
      expectedEventsCount: expected.length,
      pilotCollectionMunicipalityProgress: '7/8',
      sampleMismatches: mismatches.slice(0, 5),
    };

    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

    if (passed !== snapshot.addresses.length || criticalScheduleMismatches > 0) {
      throw new Error(
        `Świeszyno Chałupy public API verification failed: ${passed}/${snapshot.addresses.length} passed; criticalScheduleMismatches=${criticalScheduleMismatches}`,
      );
    }

    console.log(
      `Świeszyno Chałupy public API post-gate PASS: ${passed}/${snapshot.addresses.length} addresses, 0 critical date mismatches`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[FAIL] Świeszyno Chałupy public API post-gate failed:', err);
  process.exit(1);
});
