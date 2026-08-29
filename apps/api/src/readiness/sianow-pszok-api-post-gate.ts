import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const reportPath = fileURLToPath(
  new URL('../../../worker/test-results/production-pilot-readiness-report.json', import.meta.url),
);
const FACILITY_KEY = 'pl-3209073-pszok-sianow-lubuszan-80';
const SOURCE_KEY = 'sianow-pszok';

interface ApiFacility {
  canonicalKey: string | null;
  kind: string;
  name: string;
  address: string | null;
  location: { lat: number; lon: number } | null;
  acceptedMaterials: string[];
  acceptedContainers: string[];
  openingHours: {
    timezone: string;
    weekly: Array<{ day: string; intervals: Array<{ opens: string; closes: string }> }>;
    exceptions: unknown[];
  } | null;
  access: {
    scope: string;
    requiresProof: boolean | null;
    rules: { quantityLimits?: unknown[] };
  };
  operationalStatus: { state: string; observedAt: string | null };
  quality: { verificationStatus: string; confidence: number; warnings?: string[] };
  provenance: {
    primary: { parserKey: string | null; parserVersion: string | null };
    assertions: Array<{ sourceKey: string }>;
  };
}

function gateDatabaseUrl(): string {
  if (process.env.PRODUCTION_GATE_DATABASE_URL) return process.env.PRODUCTION_GATE_DATABASE_URL;
  const base = new URL(
    process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  );
  base.pathname = '/wastepl_production_gate';
  return base.toString();
}

function intervals(item: ApiFacility, day: string): Array<{ opens: string; closes: string }> {
  return item.openingHours?.weekly.find((entry) => entry.day === day)?.intervals ?? [];
}

async function main(): Promise<void> {
  process.env.DATABASE_URL = gateDatabaseUrl();
  const { createApp } = await import('../main.js');
  const app: NestFastifyApplication = await createApp();
  app.useLogger(['error']);
  await app.init();

  const report = JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>;
  try {
    const workerPostGate = report.sianowPszok2026_4PostCheck as Record<string, unknown> | undefined;
    if (workerPostGate?.status !== 'PASS') {
      throw new Error('Sianów worker post-gate must PASS before public API post-gate');
    }
    const response = await app.inject({
      method: 'GET',
      url: '/v1/facilities?terc=3209073&kind=PSZOK&limit=200',
    });
    if (response.statusCode !== 200) {
      throw new Error(`Sianów /v1/facilities returned HTTP ${response.statusCode}`);
    }
    const body = response.json() as { items?: ApiFacility[] };
    const item = body.items?.find((candidate) => candidate.canonicalKey === FACILITY_KEY);
    if (!item) throw new Error('Sianów PSZOK missing from public /v1/facilities');

    const expectedMaterials = [
      'BATTERIES',
      'BULKY',
      'CONSTRUCTION',
      'ELECTRONICS',
      'GREEN',
      'HAZARDOUS',
      'MEDICINES',
      'TEXTILES',
      'TYRES',
    ];
    const actualMaterials = [...item.acceptedMaterials].sort();
    if (JSON.stringify(actualMaterials) !== JSON.stringify(expectedMaterials)) {
      throw new Error(`Sianów API accepted materials drift: ${JSON.stringify(actualMaterials)}`);
    }
    if (
      item.kind !== 'PSZOK' ||
      item.name !== 'PSZOK Sianów, ul. Łubuszan 80' ||
      item.address !== 'ul. Łubuszan 80, Sianów' ||
      item.location !== null ||
      item.openingHours?.timezone !== 'Europe/Warsaw' ||
      JSON.stringify(intervals(item, 'MONDAY')) !== JSON.stringify([{ opens: '08:00', closes: '16:00' }]) ||
      JSON.stringify(intervals(item, 'THURSDAY')) !== JSON.stringify([{ opens: '08:00', closes: '16:00' }]) ||
      JSON.stringify(intervals(item, 'SATURDAY')) !== JSON.stringify([{ opens: '08:00', closes: '14:00' }]) ||
      item.access.scope !== 'MUNICIPALITY_RESIDENTS' ||
      item.access.requiresProof !== true ||
      (item.access.rules.quantityLimits ?? []).length !== 0 ||
      item.operationalStatus.state !== 'UNKNOWN' ||
      item.quality.verificationStatus !== 'OFFICIAL_SOURCE' ||
      item.provenance.primary.parserKey !== 'municipal-pszok-html' ||
      item.provenance.primary.parserVersion !== '0.3.0' ||
      !item.provenance.assertions.some((assertion) => assertion.sourceKey === SOURCE_KEY)
    ) {
      throw new Error(`Sianów public facility contract drift: ${JSON.stringify(item)}`);
    }

    report.sianowPszok2026_4ApiPostCheck = {
      status: 'PASS',
      endpoint: '/v1/facilities',
      query: 'terc=3209073&kind=PSZOK&limit=200',
      facilityKey: FACILITY_KEY,
      sourceKey: SOURCE_KEY,
      parserKey: item.provenance.primary.parserKey,
      parserVersion: item.provenance.primary.parserVersion,
      geometryIntentionallyNull: true,
      requiresProof: item.access.requiresProof,
      acceptedMaterials: actualMaterials,
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('Sianów PSZOK public API post-gate PASS');
  } catch (error) {
    report.sianowPszok2026_4ApiPostCheck = {
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
