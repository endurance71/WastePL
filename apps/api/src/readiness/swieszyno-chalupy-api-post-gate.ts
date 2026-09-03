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
  status: string;
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
  source: { provider: string };
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
  };
}

interface SearchItem {
  id: string;
  displayName: string;
  municipalityName: string;
  locality: string;
  buildingNumber: string;
}

const EXPECTED_EVENTS: ExpectedEvent[] = [
  // MIXED (14 events)
  { date: '2026-07-03', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-07-17', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-07-31', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-08-14', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-08-28', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-09-11', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-09-25', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-10-09', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-10-23', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-11-06', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-11-20', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-12-04', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-12-18', fraction: 'MIXED', status: 'SCHEDULED' },
  { date: '2026-12-31', fraction: 'MIXED', status: 'SCHEDULED' },

  // OTHER (14 events)
  { date: '2026-07-01', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-07-15', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-07-29', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-08-12', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-08-26', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-09-09', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-09-23', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-10-07', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-10-21', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-11-04', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-11-18', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-12-02', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-12-16', fraction: 'OTHER', status: 'SCHEDULED' },
  { date: '2026-12-30', fraction: 'OTHER', status: 'SCHEDULED' },

  // BULKY (1 event)
  { date: '2026-10-01', fraction: 'BULKY', status: 'SCHEDULED' },
].sort((a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction));

function gateDatabaseUrl(): string {
  if (process.env.PRODUCTION_GATE_DATABASE_URL) return process.env.PRODUCTION_GATE_DATABASE_URL;
  const base = new URL(
    process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  );
  base.pathname = '/wastepl_production_gate';
  return base.toString();
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
      snapshot.selection.serviceArea !== 'swieszyno-safe-h2-chalupy'
    ) {
      throw new Error(`Invalid Świeszyno Chałupy snapshot metadata: ${JSON.stringify(snapshot.selection)}`);
    }

    let checkedAddresses = 0;
    for (const rawEntry of snapshot.addresses) {
      const prgId = Array.isArray(rawEntry) ? rawEntry[0] : rawEntry.prgId;
      const buildingNumber = Array.isArray(rawEntry) ? rawEntry[6] : rawEntry.buildingNumber;

      const searchRes = await app.inject({
        method: 'GET',
        url: `/v1/addresses/search?q=${encodeURIComponent(`Chałupy ${buildingNumber}`)}&limit=10`,
      });
      if (searchRes.statusCode !== 200) {
        throw new Error(`Search failed for Chałupy ${buildingNumber}: status=${searchRes.statusCode}`);
      }
      const searchItems = searchRes.json() as SearchItem[];
      const match = searchItems.find((item) => item.id === prgId);
      if (!match) {
        throw new Error(`Address search for Chałupy ${buildingNumber} did not return expected PRG id ${prgId}`);
      }

      const collectionRes = await app.inject({
        method: 'GET',
        url: `/v1/collection?addressId=${encodeURIComponent(prgId)}`,
      });
      if (collectionRes.statusCode !== 200) {
        throw new Error(`Collection query failed for ${prgId}: status=${collectionRes.statusCode}`);
      }
      const body = collectionRes.json() as CollectionBody;

      if (body.municipality?.terc !== SWIESZYNO_TERC || body.municipality?.name !== 'Świeszyno') {
        throw new Error(`Incompatible municipality in response for ${prgId}: ${JSON.stringify(body.municipality)}`);
      }
      if (body.serviceArea?.name !== SERVICE_AREA_NAME) {
        throw new Error(`Incompatible service area for ${prgId}: expected ${SERVICE_AREA_NAME}, got ${body.serviceArea?.name}`);
      }
      if (body.source?.url !== SOURCE_URL || body.source?.format !== 'PDF_TEXT') {
        throw new Error(`Incompatible source metadata for ${prgId}: ${JSON.stringify(body.source)}`);
      }
      if (body.source?.sha256 !== fixtureSha256) {
        throw new Error(`Source SHA mismatch for ${prgId}: expected ${fixtureSha256}, got ${body.source?.sha256}`);
      }
      if (body.source?.parserKey !== 'municipal-collection-pdf-text' || body.source?.parserVersion !== '0.2.0') {
        throw new Error(`Unexpected parser identity for ${prgId}: ${body.source?.parserKey}@${body.source?.parserVersion}`);
      }

      const receivedEvents = (body.events ?? [])
        .map((ev) => ({ date: ev.date, fraction: ev.fraction, status: ev.status }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.fraction.localeCompare(b.fraction));

      if (!isDeepStrictEqual(receivedEvents, EXPECTED_EVENTS)) {
        throw new Error(`Event schedule mismatch for Chałupy address ${prgId}`);
      }

      checkedAddresses++;
    }

    report.swieszynoChalupy2026_9ApiPostCheck = {
      status: 'PASS',
      verifiedAt: new Date().toISOString(),
      testedAddresses: checkedAddresses,
      targetAddresses: snapshot.addresses.length,
      expectedEventCount: EXPECTED_EVENTS.length,
      serviceAreaName: SERVICE_AREA_NAME,
      deterministicFixtureSha256: fixtureSha256,
      publicApiSearchVerified: true,
      publicApiCollectionVerified: true,
      pilotCollectionCoverage: '7/8',
    };

    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`[PASS] Świeszyno Chałupy public API post-gate passed: ${checkedAddresses}/${snapshot.addresses.length} addresses verified with 29 events.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
