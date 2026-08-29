import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const collectionGoldenPath = resolve(repoRoot, 'apps/api/test/golden/pilot-real-100-2026.json');
const referenceSnapshotPath = resolve(
  repoRoot,
  'apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json',
);
const facilityGoldenPath = resolve(repoRoot, 'apps/api/test/golden/facilities-pilot-2026.json');
const reportPath = resolve(repoRoot, 'apps/worker/test-results/production-pilot-readiness-report.json');

interface GoldenEvent {
  date: string;
  fraction: string;
  status: string;
}

interface GoldenSource {
  key: string;
  url: string;
  fixture: string;
}

interface GoldenServiceArea {
  name: string;
  source: string;
  eventProfile: string;
}

interface GoldenProfile {
  from: string;
  days: number;
  events: GoldenEvent[];
}

interface CollectionGoldenConfig {
  version: string;
  threshold: number;
  criticalWrongDateTolerance: number;
  addressSnapshot: string;
  sources: Record<string, GoldenSource>;
  serviceAreas: Record<string, GoldenServiceArea>;
  eventProfiles: Record<string, GoldenProfile>;
}

type SnapshotTuple = [
  prgId: string,
  municipalityTerc: string,
  locality: string,
  simc: string,
  street: string | null,
  ulic: string | null,
  buildingNumber: string,
  postalCode: string | null,
  x2180: number,
  y2180: number,
  serviceArea: string,
];

interface ReferenceSnapshot {
  schemaVersion: string;
  snapshotDate: string;
  source: Record<string, unknown>;
  selection: {
    total: number;
    perMunicipality: Record<string, number>;
    policy: string;
    excludedSourceOnlyCase: string;
  };
  fields: string[];
  addresses: SnapshotTuple[];
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

interface CollectionApiBody {
  address?: { canonicalText?: string };
  municipality?: { terc?: string; name?: string };
  serviceArea?: { name?: string };
  events?: GoldenEvent[];
  source?: {
    url?: string;
    format?: string;
    artifactId?: string;
    sha256?: string;
    parserKey?: string | null;
    parserVersion?: string | null;
  };
  quality?: { verificationStatus?: string };
  code?: string;
}

const LEGACY_SOURCE_KEY_ALIASES: Record<string, string> = {
  'pgk-koszalin-pszok-main': 'koszalin-pszok-main',
  'pgk-koszalin-pszok-faq': 'koszalin-pszok-faq',
};

const EXPECTED_DISTRIBUTION: Readonly<Record<string, number>> = {
  '3261011': 9,
  '3209042': 46,
  '3201043': 45,
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

function canonicalText(tuple: SnapshotTuple): string {
  const [, , locality, , street, , buildingNumber, postalCode] = tuple;
  const addressPart = street ? `${street} ${buildingNumber}` : `${locality} ${buildingNumber}`;
  return postalCode ? `${addressPart}, ${postalCode} ${locality}` : `${addressPart}, ${locality}`;
}

function addressQuery(tuple: SnapshotTuple): string {
  const [, , locality, , street, , buildingNumber] = tuple;
  return street ? `${street} ${buildingNumber}` : `${locality} ${buildingNumber}`;
}

function parserForSource(sourceKey: string): string {
  if (sourceKey === 'tychowo-collection-standard-2026') return 'municipal-collection-pdf-text';
  return 'pgk-koszalin-pdf-text';
}

async function loadReport(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>;
}

async function validateGoldenInputs(
  golden: CollectionGoldenConfig,
  snapshot: ReferenceSnapshot,
): Promise<void> {
  if (golden.version !== '2026-08-29') throw new Error(`Unexpected 100-address golden version ${golden.version}`);
  if (golden.threshold < 0.99) throw new Error(`Golden threshold regressed to ${golden.threshold}`);
  if (golden.criticalWrongDateTolerance !== 0) {
    throw new Error('Critical wrong-date tolerance must remain zero');
  }
  if (golden.addressSnapshot !== 'apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json') {
    throw new Error(`Unexpected address snapshot ${golden.addressSnapshot}`);
  }
  if (snapshot.schemaVersion !== '1.0.0' || snapshot.snapshotDate !== '2026-08-28') {
    throw new Error(`Unexpected PRG snapshot ${snapshot.schemaVersion}/${snapshot.snapshotDate}`);
  }
  if (snapshot.selection.total !== 100 || snapshot.addresses.length !== 100) {
    throw new Error(`Golden PRG pack must contain exactly 100 addresses, got ${snapshot.addresses.length}`);
  }

  const ids = new Set<string>();
  const distribution = new Map<string, number>();
  for (const tuple of snapshot.addresses) {
    const [prgId, terc, locality, simc, street, ulic, buildingNumber, , x, y, serviceArea] = tuple;
    if (!/^prg-adresy\.\d+$/.test(prgId)) throw new Error(`Synthetic/non-PRG address id ${prgId}`);
    if (ids.has(prgId)) throw new Error(`Duplicate PRG id ${prgId}`);
    ids.add(prgId);
    if (!/^\d{7}$/.test(terc) || !/^\d{7}$/.test(simc)) throw new Error(`Invalid TERC/SIMC for ${prgId}`);
    if (!locality || !buildingNumber || !serviceArea) throw new Error(`Incomplete PRG golden row ${prgId}`);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Invalid PRG geometry ${prgId}`);
    if ((street === null) !== (ulic === null)) throw new Error(`Street/ULIC mismatch ${prgId}`);
    if (!golden.serviceAreas[serviceArea]) throw new Error(`No expected service-area mapping for ${serviceArea}`);
    distribution.set(terc, (distribution.get(terc) ?? 0) + 1);
  }
  for (const [terc, expected] of Object.entries(EXPECTED_DISTRIBUTION)) {
    if (distribution.get(terc) !== expected) {
      throw new Error(`Expected ${expected} addresses for ${terc}, got ${distribution.get(terc) ?? 0}`);
    }
  }
  if (distribution.size !== Object.keys(EXPECTED_DISTRIBUTION).length) {
    throw new Error(`Unexpected municipality distribution ${JSON.stringify(Object.fromEntries(distribution))}`);
  }

  for (const [sourceAlias, source] of Object.entries(golden.sources)) {
    if (!source.key || !source.url || !source.fixture) throw new Error(`Incomplete source evidence ${sourceAlias}`);
    const fixture = await readFile(resolve(repoRoot, source.fixture));
    if (fixture.length === 0) throw new Error(`Empty source evidence fixture ${source.fixture}`);
  }

  for (const [serviceAreaKey, area] of Object.entries(golden.serviceAreas)) {
    if (!golden.sources[area.source]) throw new Error(`Unknown source alias ${area.source} for ${serviceAreaKey}`);
    const profile = golden.eventProfiles[area.eventProfile];
    if (!profile || profile.events.length === 0) throw new Error(`Missing source-backed event profile for ${serviceAreaKey}`);
  }
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
    ) as CollectionGoldenConfig;
    const referenceSnapshot = JSON.parse(
      await readFile(referenceSnapshotPath, 'utf8'),
    ) as ReferenceSnapshot;
    await validateGoldenInputs(collectionGolden, referenceSnapshot);

    const mismatches: Array<Record<string, unknown>> = [];
    const municipalityStats = new Map<string, { total: number; passed: number; failed: number }>();
    let passed = 0;
    let criticalScheduleMismatches = 0;
    let ambiguousResponses = 0;

    for (const tuple of referenceSnapshot.addresses) {
      const [prgId, municipalityTerc, locality, simc, street, ulic, buildingNumber, postalCode, x2180, y2180, serviceAreaKey] = tuple;
      const area = collectionGolden.serviceAreas[serviceAreaKey];
      if (!area) throw new Error(`Missing expected area ${serviceAreaKey}`);
      const profile = collectionGolden.eventProfiles[area.eventProfile];
      if (!profile) throw new Error(`Missing profile ${area.eventProfile}`);
      const source = collectionGolden.sources[area.source];
      if (!source) throw new Error(`Missing source ${area.source}`);
      const query = addressQuery(tuple);

      const response = await app.inject({
        method: 'GET',
        url:
          `/v1/collection?address=${encodeURIComponent(query)}` +
          `&from=${profile.from}&days=${profile.days}`,
      });
      const body = response.json() as CollectionApiBody;
      const expected = {
        statusCode: 200,
        canonicalText: canonicalText(tuple),
        municipalityTerc,
        serviceAreaName: area.name,
        events: profile.events,
        sourceUrl: source.url,
        parserKey: parserForSource(source.key),
        verificationStatus: 'OFFICIAL_SOURCE',
      };
      const actual = response.statusCode === 200
        ? {
            statusCode: response.statusCode,
            canonicalText: body.address?.canonicalText,
            municipalityTerc: body.municipality?.terc,
            serviceAreaName: body.serviceArea?.name,
            events: body.events,
            sourceUrl: body.source?.url,
            parserKey: body.source?.parserKey,
            verificationStatus: body.quality?.verificationStatus,
          }
        : {
            statusCode: response.statusCode,
            code: body.code ?? null,
          };

      const stat = municipalityStats.get(municipalityTerc) ?? { total: 0, passed: 0, failed: 0 };
      stat.total += 1;
      const matches = isDeepStrictEqual(actual, expected);
      if (matches) {
        passed += 1;
        stat.passed += 1;
      } else {
        stat.failed += 1;
        const eventsEqual = response.statusCode === 200 && isDeepStrictEqual(body.events ?? [], profile.events);
        const criticalScheduleMismatch = !eventsEqual;
        if (criticalScheduleMismatch) criticalScheduleMismatches += 1;
        if (
          response.statusCode === 409
          && (body.code === 'AMBIGUOUS_SERVICE_AREA' || body.code === 'AMBIGUOUS_ADDRESS')
        ) {
          ambiguousResponses += 1;
        }
        mismatches.push({
          prgId,
          addressQuery: query,
          municipalityTerc,
          locality,
          simc,
          street,
          ulic,
          buildingNumber,
          postalCode,
          geometry2180: { x: x2180, y: y2180 },
          expected,
          actual,
          criticalScheduleMismatch,
          evidence: {
            addressSnapshot: {
              snapshotDate: referenceSnapshot.snapshotDate,
              source: referenceSnapshot.source,
              prgId,
              simc,
              ulic,
            },
            schedule: {
              sourceKey: source.key,
              sourceUrl: source.url,
              fixture: source.fixture,
              eventProfile: area.eventProfile,
            },
            publishedArtifact: body.source ?? null,
          },
        });
      }
      municipalityStats.set(municipalityTerc, stat);
    }

    const collectionCorrectness = passed / referenceSnapshot.addresses.length;
    const perMunicipality = Object.fromEntries(
      [...municipalityStats.entries()].map(([terc, stat]) => [
        terc,
        {
          ...stat,
          correctness: stat.total === 0 ? 0 : stat.passed / stat.total,
        },
      ]),
    );

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
    report.api = {
      status: 'PASS',
      sourceIdentityNormalization: LEGACY_SOURCE_KEY_ALIASES,
      collection: {
        datasetVersion: collectionGolden.version,
        addressEvidenceSnapshot: referenceSnapshotPath.replace(`${repoRoot}/`, ''),
        total: referenceSnapshot.addresses.length,
        passed,
        failed: mismatches.length,
        correctness: collectionCorrectness,
        threshold: collectionGolden.threshold,
        criticalScheduleMismatches,
        criticalWrongDateTolerance: collectionGolden.criticalWrongDateTolerance,
        ambiguousResponses,
        perMunicipality,
        mismatches,
      },
      facilities: {
        total: facilityGolden.completeCases.length,
        passed: facilityPassed,
        correctness: facilityCorrectness,
        mismatches: facilityMismatches,
      },
    };

    const failures: string[] = [];
    if (referenceSnapshot.addresses.length < 100) failures.push('REAL_ADDRESS_COUNT_BELOW_100');
    if (collectionCorrectness < collectionGolden.threshold) {
      failures.push(`COLLECTION_CORRECTNESS_${(collectionCorrectness * 100).toFixed(3)}_BELOW_${collectionGolden.threshold * 100}`);
    }
    if (criticalScheduleMismatches > collectionGolden.criticalWrongDateTolerance) {
      failures.push(`CRITICAL_SCHEDULE_MISMATCHES_${criticalScheduleMismatches}`);
    }
    if (ambiguousResponses > 0) failures.push(`AMBIGUOUS_RESPONSES_${ambiguousResponses}`);
    if (facilityCorrectness < facilityGolden.threshold) {
      failures.push(`FACILITY_CORRECTNESS_${(facilityCorrectness * 100).toFixed(3)}_BELOW_${facilityGolden.threshold * 100}`);
    }

    if (failures.length > 0) {
      (report.api as Record<string, unknown>).status = 'FAIL';
      report.status = 'FAIL';
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      throw new Error(`Production consumer API gate failed: ${failures.join(', ')}`);
    }

    report.status = 'PASS';
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      `Production consumer API gate PASS: collection=${passed}/${referenceSnapshot.addresses.length}, criticalScheduleMismatches=${criticalScheduleMismatches}, facilities=${facilityPassed}/${facilityGolden.completeCases.length}`,
    );
  } catch (error) {
    if (!report.api || (report.api as Record<string, unknown>).status !== 'FAIL') {
      report.api = {
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
