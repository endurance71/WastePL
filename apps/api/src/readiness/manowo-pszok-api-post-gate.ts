import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const reportPath = fileURLToPath(
  new URL('../../../worker/test-results/production-pilot-readiness-report.json', import.meta.url),
);
const FACILITY_KEY = 'pl-3209042-pszok-manowo-komunalna-5';
const SOURCE_KEY = 'manowo-pszok';
const MANOWO_TERC = '3209042';

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
    const workerPostGate = report.manowoPszok2026_13PostCheck as Record<string, unknown> | undefined;
    if (workerPostGate?.status !== 'PASS') {
      throw new Error('Manowo PSZOK worker post-gate must PASS before public API post-gate');
    }
    const response = await app.inject({
      method: 'GET',
      url: `/v1/facilities?terc=${MANOWO_TERC}&kind=PSZOK&limit=200`,
    });
    if (response.statusCode !== 200) {
      throw new Error(`Manowo /v1/facilities returned HTTP ${response.statusCode}`);
    }
    const body = response.json() as { items?: ApiFacility[] };
    const item = body.items?.find((candidate) => candidate.canonicalKey === FACILITY_KEY);
    if (!item) throw new Error('Manowo PSZOK missing from public /v1/facilities');

    const expectedMaterials = [
      'BATTERIES',
      'BULKY',
      'CONSTRUCTION',
      'ELECTRONICS',
      'GLASS',
      'GREEN',
      'HAZARDOUS',
      'MEDICINES',
      'METALS_PLASTICS',
      'PAPER',
      'TEXTILES',
      'TYRES',
    ];
    const actualMaterials = [...item.acceptedMaterials].sort();
    if (JSON.stringify(actualMaterials) !== JSON.stringify(expectedMaterials)) {
      throw new Error(`Manowo API accepted materials drift: ${JSON.stringify(actualMaterials)}`);
    }
    if (
      item.kind !== 'PSZOK' ||
      item.name !== 'PSZOK Manowo (PGK Koszalin), ul. Komunalna 5' ||
      item.address !== 'ul. Komunalna 5, 75-724 Koszalin' ||
      item.location !== null ||
      item.openingHours?.timezone !== 'Europe/Warsaw' ||
      JSON.stringify(intervals(item, 'TUESDAY')) !== JSON.stringify([{ opens: '08:00', closes: '16:00' }]) ||
      JSON.stringify(intervals(item, 'THURSDAY')) !== JSON.stringify([{ opens: '08:00', closes: '16:00' }]) ||
      item.access.scope !== 'MUNICIPALITY_RESIDENTS' ||
      item.operationalStatus.state !== 'UNKNOWN' ||
      item.quality.verificationStatus !== 'OFFICIAL_SOURCE' ||
      item.provenance.primary.parserKey !== 'municipal-pszok-html' ||
      item.provenance.primary.parserVersion !== '0.3.0' ||
      !item.provenance.assertions.some((assertion) => assertion.sourceKey === SOURCE_KEY)
    ) {
      throw new Error(`Manowo public facility contract drift: ${JSON.stringify(item)}`);
    }

    report.manowoPszok2026_13ApiPostCheck = {
      status: 'PASS',
      endpoint: '/v1/facilities',
      query: `terc=${MANOWO_TERC}&kind=PSZOK&limit=200`,
      facilityKey: FACILITY_KEY,
      sourceKey: SOURCE_KEY,
      parserKey: item.provenance.primary.parserKey,
      parserVersion: item.provenance.primary.parserVersion,
      geometryIntentionallyNull: true,
      requiresProof: item.access.requiresProof,
      acceptedMaterials: actualMaterials,
      coverageMilestone: '8/8 MUNICIPALITIES VERIFIED WITH ACTIVE PSZOK ON PUBLIC API (100% COVERAGE)',
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('Manowo PSZOK public API post-gate PASS (8/8 PSZOK coverage - 100% COVERAGE)');
  } catch (error) {
    report.manowoPszok2026_13ApiPostCheck = {
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
