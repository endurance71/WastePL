import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const snapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-polanow-garbno-20260829.json',
);
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');
const SOURCE_URL = 'https://bip.polanow.pl/pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5';
const SERVICE_AREA_NAME = 'Gmina Polanów — Garbno, zabudowa jednorodzinna';
const POLANOW_TERC = '3209063';

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
    ['MIXED', ['2026-07-09','2026-07-23','2026-08-06','2026-08-20','2026-09-03','2026-09-17','2026-10-01','2026-10-15','2026-10-29','2026-11-13','2026-11-26','2026-12-10','2026-12-22']],
    ['BIO', ['2026-07-03','2026-07-17','2026-07-31','2026-08-14','2026-08-28','2026-09-11','2026-09-25','2026-10-09','2026-10-23','2026-11-20','2026-12-17']],
    ['OTHER', ['2026-07-03','2026-07-31','2026-08-28','2026-09-25','2026-10-23','2026-11-20','2026-12-18']],
    ['BULKY', ['2026-10-24']],
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
  app.useLogger(['error']);
  await app.init();

  const report = JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>;
  try {
    const workerPostGate = report.polanowGarbno2026_6PostCheck as Record<string, unknown> | undefined;
    if (report.status !== 'PASS' || workerPostGate?.status !== 'PASS') {
      throw new Error('Polanów Garbno worker post-gate must pass before the public API gate');
    }
    const fixtureSha256 = workerPostGate.deterministicFixtureSha256;
    if (typeof fixtureSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(fixtureSha256)) {
      throw new Error('Polanów worker post-gate did not expose deterministic artifact SHA-256');
    }

    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as Snapshot;
    if (
      snapshot.schemaVersion !== '1.0.0' ||
      snapshot.snapshotDate !== '2026-08-29' ||
      snapshot.selection.total !== 39 ||
      snapshot.selection.municipalityTerc !== POLANOW_TERC ||
      snapshot.selection.locality !== 'Garbno' ||
      snapshot.selection.simc !== '0308749' ||
      snapshot.addresses.length !== 39
    ) {
      throw new Error(`Unexpected Polanów Garbno API evidence snapshot: ${JSON.stringify(snapshot.selection)}`);
    }

    const expected = expectedEvents();
    if (expected.length !== 32) throw new Error(`Expected 32 source-backed Garbno events, got ${expected.length}`);

    const mismatches: Array<Record<string, unknown>> = [];
    let passed = 0;
    let ambiguousResponses = 0;
    let criticalScheduleMismatches = 0;

    for (const tuple of snapshot.addresses) {
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
        municipalityTerc: POLANOW_TERC,
        municipalityName: 'Polanów',
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
        expected: wanted,
        actual,
        criticalScheduleMismatch: !eventsEqual,
      });
    }

    const correctness = passed / snapshot.addresses.length;
    if (passed !== 39 || correctness !== 1 || criticalScheduleMismatches !== 0 || ambiguousResponses !== 0) {
      report.polanowGarbnoApi2026_6PostCheck = {
        status: 'FAIL',
        total: snapshot.addresses.length,
        passed,
        correctness,
        criticalScheduleMismatches,
        ambiguousResponses,
        mismatches,
      };
      report.status = 'FAIL';
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      throw new Error(
        `Polanów Garbno API gate failed: passed=${passed}/39, critical=${criticalScheduleMismatches}, ambiguous=${ambiguousResponses}`,
      );
    }

    report.polanowGarbnoApi2026_6PostCheck = {
      status: 'PASS',
      realPrgAddresses: snapshot.addresses.length,
      passed,
      correctness,
      criticalWrongDateTolerance: 0,
      criticalScheduleMismatches: 0,
      ambiguousResponses: 0,
      eventCountPerAddress: expected.length,
      sourceUrl: SOURCE_URL,
      parserKey: 'municipal-collection-pdf-text',
      parserVersion: '0.2.0',
      deterministicArtifactSha256: fixtureSha256,
      prgResponseSha256: snapshot.source.responseSha256,
    };
    report.status = 'PASS';
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('Polanów Garbno public API post-gate PASS: 39/39 addresses, 0 critical date mismatches');
  } catch (error) {
    if (!report.polanowGarbnoApi2026_6PostCheck || (report.polanowGarbnoApi2026_6PostCheck as Record<string, unknown>).status !== 'FAIL') {
      report.polanowGarbnoApi2026_6PostCheck = {
        status: 'FAIL',
        error: error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
      };
    }
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
