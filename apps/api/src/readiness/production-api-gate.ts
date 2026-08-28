import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const collectionGoldenPath = fileURLToPath(new URL('../../test/golden/pilot-2026.json', import.meta.url));
const facilityGoldenPath = fileURLToPath(new URL('../../test/golden/facilities-pilot-2026.json', import.meta.url));
const reportPath = fileURLToPath(
  new URL('../../../worker/test-results/production-pilot-readiness-report.json', import.meta.url),
);

interface GoldenEvent {
  date: string;
  fraction: string;
  status: string;
}

interface GoldenCollectionCase {
  id: string;
  addressQuery: string;
  expectedCanonicalText: string;
  municipalityTerc: string;
  serviceArea: string;
  eventProfile: string;
}

interface CollectionGoldenPack {
  threshold: number;
  sources: Record<string, string>;
  serviceAreas: Record<string, { name: string; source: string }>;
  eventProfiles: Record<string, { from: string; days: number; events: GoldenEvent[] }>;
  cases: GoldenCollectionCase[];
}

interface GoldenFacilityExpected {
  canonicalKey: string;
  kind: string;
  name: string;
  address: string;
  location: { lat: number; lon: number } | null;
  acceptedMaterials?: string[];
  acceptedContainers?: string[];
  openingHours?: unknown;
  access?: { scope: string; requiresProof: boolean; quantityLimits: unknown[] };
  operationalStatus?: { state: string; observedAt: string | null };
  verificationStatus?: string;
  confidence?: number;
  assertionSourceKeys?: string[];
}

interface GoldenFacilityEntity {
  id: string;
  expectedDisposition: 'PUBLISHED_PIN' | 'REVIEW_REQUIRED';
  expected: GoldenFacilityExpected;
}

interface FacilityGoldenPack {
  threshold: number;
  entities: GoldenFacilityEntity[];
  completeCases: Array<{ id: string; entityId: string; query: string }>;
}

interface ApiFacility {
  canonicalKey: string | null;
  kind: string;
  name: string;
  address: string | null;
  location: { lat: number; lon: number } | null;
  acceptedMaterials: string[];
  acceptedContainers: string[];
  openingHours: unknown | null;
  access: { scope: string; requiresProof: boolean | null; rules: Record<string, unknown> };
  operationalStatus: { state: string; observedAt: string | null };
  quality: { verificationStatus: string; confidence: number };
  provenance: { assertions: Array<{ sourceKey: string }> };
}

const LEGACY_SOURCE_KEY_ALIASES: Record<string, string> = {
  'pgk-koszalin-pszok-main': 'koszalin-pszok-main',
  'pgk-koszalin-pszok-faq': 'koszalin-pszok-faq',
};

function gateDatabaseUrl(): string {
  if (process.env.PRODUCTION_GATE_DATABASE_URL) return process.env.PRODUCTION_GATE_DATABASE_URL;
  const base = new URL(
    process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  );
  base.pathname = '/wastepl_production_gate';
  return base.toString();
}

function canonicalSourceKey(value: string): string {
  return LEGACY_SOURCE_KEY_ALIASES[value] ?? value;
}

function sorted(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}

function canonicalSourceSet(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(canonicalSourceKey))].sort();
}

function normalizeClaimSourceKeys(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const record = entry as Record<string, unknown>;
    return {
      ...record,
      ...(typeof record.sourceKey === 'string'
        ? { sourceKey: canonicalSourceKey(record.sourceKey) }
        : {}),
    };
  });
}

function normalizeFacility(item: ApiFacility): unknown {
  return {
    canonicalKey: item.canonicalKey,
    kind: item.kind,
    name: item.name,
    address: item.address,
    location: item.location,
    acceptedMaterials: sorted(item.acceptedMaterials),
    acceptedContainers: sorted(item.acceptedContainers),
    openingHours: item.openingHours,
    access: {
      scope: item.access.scope,
      requiresProof: item.access.requiresProof,
      quantityLimits: normalizeClaimSourceKeys(item.access.rules.quantityLimits ?? []),
    },
    operationalStatus: item.operationalStatus,
    verificationStatus: item.quality.verificationStatus,
    confidence: item.quality.confidence,
    // The API intentionally exposes immutable assertion history. For golden
    // correctness we compare current source identities, not the number of
    // historical artifacts carrying the same source claim.
    assertionSourceKeys: canonicalSourceSet(
      item.provenance.assertions.map((assertion) => assertion.sourceKey),
    ),
  };
}

function normalizeExpectedFacility(expected: GoldenFacilityExpected): unknown {
  return {
    canonicalKey: expected.canonicalKey,
    kind: expected.kind,
    name: expected.name,
    address: expected.address,
    location: expected.location,
    acceptedMaterials: sorted(expected.acceptedMaterials),
    acceptedContainers: sorted(expected.acceptedContainers),
    openingHours: expected.openingHours ?? null,
    access: expected.access
      ? {
          scope: expected.access.scope,
          requiresProof: expected.access.requiresProof,
          quantityLimits: normalizeClaimSourceKeys(expected.access.quantityLimits),
        }
      : { scope: 'UNKNOWN', requiresProof: null, quantityLimits: [] },
    operationalStatus: expected.operationalStatus ?? { state: 'UNKNOWN', observedAt: null },
    verificationStatus: expected.verificationStatus ?? 'REVIEW_REQUIRED',
    confidence: expected.confidence ?? 0.8,
    assertionSourceKeys: canonicalSourceSet(expected.assertionSourceKeys),
  };
}

async function loadReport(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const gateUrl = gateDatabaseUrl();
  process.env.DATABASE_URL = gateUrl;
  const { createApp } = await import('../main.js');
  const app: NestFastifyApplication = await createApp();
  app.useLogger(['error']);
  await app.init();

  const report = await loadReport();
  try {
    const collectionGolden = JSON.parse(
      await readFile(collectionGoldenPath, 'utf8'),
    ) as CollectionGoldenPack;
    const collectionMismatches: Array<Record<string, unknown>> = [];
    let collectionPassed = 0;

    for (const testCase of collectionGolden.cases) {
      const profile = collectionGolden.eventProfiles[testCase.eventProfile];
      const area = collectionGolden.serviceAreas[testCase.serviceArea];
      if (!profile || !area) throw new Error(`Invalid collection golden case ${testCase.id}`);
      const sourceUrl = collectionGolden.sources[area.source];
      if (!sourceUrl) throw new Error(`Missing collection golden source ${area.source}`);

      const response = await app.inject({
        method: 'GET',
        url:
          `/v1/collection?address=${encodeURIComponent(testCase.addressQuery)}` +
          `&from=${profile.from}&days=${profile.days}`,
      });
      const body = response.statusCode === 200 ? response.json() as Record<string, any> : null;
      const actual = response.statusCode === 200
        ? {
            statusCode: response.statusCode,
            canonicalText: body?.address?.canonicalText,
            municipalityTerc: body?.municipality?.terc,
            serviceAreaName: body?.serviceArea?.name,
            events: body?.events,
            sourceUrl: body?.source?.url,
            verificationStatus: body?.quality?.verificationStatus,
          }
        : { statusCode: response.statusCode, body: response.json() };
      const expected = {
        statusCode: 200,
        canonicalText: testCase.expectedCanonicalText,
        municipalityTerc: testCase.municipalityTerc,
        serviceAreaName: area.name,
        events: profile.events,
        sourceUrl,
        verificationStatus: 'OFFICIAL_SOURCE',
      };
      if (isDeepStrictEqual(actual, expected)) collectionPassed += 1;
      else collectionMismatches.push({ id: testCase.id, expected, actual });
    }

    const collectionCorrectness = collectionPassed / collectionGolden.cases.length;
    if (collectionCorrectness < collectionGolden.threshold) {
      throw new Error(
        `Production API collection correctness ${(collectionCorrectness * 100).toFixed(3)}% is below ${collectionGolden.threshold * 100}%`,
      );
    }

    const facilityGolden = JSON.parse(
      await readFile(facilityGoldenPath, 'utf8'),
    ) as FacilityGoldenPack;
    const facilityMismatches: Array<Record<string, unknown>> = [];
    let facilityPassed = 0;

    for (const testCase of facilityGolden.completeCases) {
      const goldenEntity = facilityGolden.entities.find((entity) => entity.id === testCase.entityId);
      if (!goldenEntity || goldenEntity.expectedDisposition !== 'PUBLISHED_PIN') {
        throw new Error(`Invalid facility golden case ${testCase.id}`);
      }
      const response = await app.inject({ method: 'GET', url: `/v1/facilities?${testCase.query}` });
      if (response.statusCode !== 200) {
        facilityMismatches.push({ id: testCase.id, statusCode: response.statusCode, body: response.json() });
        continue;
      }
      const body = response.json() as { items?: ApiFacility[] };
      const item = body.items?.find(
        (candidate) => candidate.canonicalKey === goldenEntity.expected.canonicalKey,
      );
      const actual = item ? normalizeFacility(item) : null;
      const expected = normalizeExpectedFacility(goldenEntity.expected);
      if (isDeepStrictEqual(actual, expected)) facilityPassed += 1;
      else facilityMismatches.push({ id: testCase.id, expected, actual });
    }

    const facilityCorrectness = facilityPassed / facilityGolden.completeCases.length;
    if (facilityCorrectness < facilityGolden.threshold) {
      throw new Error(
        `Production API facility correctness ${(facilityCorrectness * 100).toFixed(3)}% is below ${facilityGolden.threshold * 100}%`,
      );
    }

    report.api = {
      status: 'PASS',
      sourceIdentityNormalization: LEGACY_SOURCE_KEY_ALIASES,
      collection: {
        total: collectionGolden.cases.length,
        passed: collectionPassed,
        correctness: collectionCorrectness,
        mismatches: collectionMismatches,
      },
      facilities: {
        total: facilityGolden.completeCases.length,
        passed: facilityPassed,
        correctness: facilityCorrectness,
        mismatches: facilityMismatches,
      },
    };
    report.status = 'PASS';
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      `Production consumer API gate PASS: collection=${collectionPassed}/${collectionGolden.cases.length}, facilities=${facilityPassed}/${facilityGolden.completeCases.length}`,
    );
  } catch (error) {
    report.api = {
      status: 'FAIL',
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
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
