import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { compareFacilityAssertions, type FacilityIdentityAssertion } from '@wastepl/domain';
import pg, { type QueryResultRow } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './main.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;
const goldenPath = fileURLToPath(new URL('../test/golden/facilities-pilot-2026.json', import.meta.url));
const reportPath = fileURLToPath(
  new URL('../test-results/golden-facility-mismatch-report.json', import.meta.url),
);

interface GoldenSource {
  url: string;
  fixture: string;
  parserKey: string;
  parserVersion: string;
}

interface GoldenExpectedEntity {
  canonicalKey: string;
  kind: string;
  name: string;
  address: string;
  location: { lat: number; lon: number } | null;
  acceptedMaterials?: string[];
  acceptedContainers?: string[];
  openingHours?: unknown;
  access?: {
    scope: string;
    requiresProof: boolean;
    quantityLimits: unknown[];
  };
  operationalStatus?: { state: string; observedAt: string | null };
  verificationStatus?: string;
  confidence?: number;
  assertionSourceKeys?: string[];
  reason?: string;
}

interface GoldenEntity {
  id: string;
  expectedDisposition: 'PUBLISHED_PIN' | 'REVIEW_REQUIRED';
  evidenceSources: string[];
  expected: GoldenExpectedEntity;
}

interface GoldenCase {
  id: string;
  entityId: string;
  query: string;
}

interface GoldenPack {
  version: string;
  threshold: number;
  researchCheckpoint: string;
  coverage: Record<string, unknown>;
  sources: Record<string, GoldenSource>;
  entities: GoldenEntity[];
  completeCases: GoldenCase[];
  regressionScenarios: Array<Record<string, unknown>>;
}

interface ArtifactRow extends QueryResultRow {
  id: string;
  sha256: string;
  source_url: string;
  parser_key: string | null;
  parser_version: string | null;
  retrieved_at: Date;
}

interface FacilityProvenanceRow extends QueryResultRow {
  canonical_key: string | null;
  primary_artifact_id: string;
  primary_sha256: string;
  primary_parser_key: string | null;
  primary_parser_version: string | null;
  assertion_id: string | null;
  assertion_source_key: string | null;
  assertion_artifact_id: string | null;
  assertion_sha256: string | null;
  assertion_parser_key: string | null;
  assertion_parser_version: string | null;
}

interface GoldenMismatch {
  caseId: string;
  entityId: string;
  query: string;
  expected: unknown;
  actual: unknown;
  provenance: unknown;
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
  access: {
    scope: string;
    requiresProof: boolean | null;
    rules: Record<string, unknown>;
  };
  operationalStatus: { state: string; observedAt: string | null };
  quality: {
    verificationStatus: string;
    confidence: number;
    warnings: string[];
  };
  provenance: {
    primary: { artifactId: string; parserKey: string | null; parserVersion: string | null };
    assertions: Array<{ sourceKey: string; sourceArtifactId: string }>;
  };
}

const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as GoldenPack;

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function sorted(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}

function entity(id: string): GoldenEntity {
  const found = golden.entities.find((item) => item.id === id);
  if (!found) throw new Error(`Golden facility entity missing: ${id}`);
  return found;
}

function normalizeApiItem(item: ApiFacility): unknown {
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
      quantityLimits: item.access.rules.quantityLimits ?? [],
    },
    operationalStatus: item.operationalStatus,
    verificationStatus: item.quality.verificationStatus,
    confidence: item.quality.confidence,
    assertionSourceKeys: sorted(item.provenance.assertions.map((assertion) => assertion.sourceKey)),
  };
}

function normalizeExpected(expected: GoldenExpectedEntity): unknown {
  return {
    canonicalKey: expected.canonicalKey,
    kind: expected.kind,
    name: expected.name,
    address: expected.address,
    location: expected.location,
    acceptedMaterials: sorted(expected.acceptedMaterials),
    acceptedContainers: sorted(expected.acceptedContainers),
    openingHours: expected.openingHours ?? null,
    access: expected.access ?? { scope: 'UNKNOWN', requiresProof: null, quantityLimits: [] },
    operationalStatus: expected.operationalStatus ?? { state: 'UNKNOWN', observedAt: null },
    verificationStatus: expected.verificationStatus ?? 'REVIEW_REQUIRED',
    confidence: expected.confidence ?? 0.8,
    assertionSourceKeys: sorted(expected.assertionSourceKeys),
  };
}

integrationDescribe('WastePL golden facility dataset', () => {
  let app: NestFastifyApplication;
  let pool: InstanceType<typeof Pool>;
  let municipalityId = '';
  const artifactIds: string[] = [];
  const facilityIds: string[] = [];
  const assertionIds: string[] = [];
  const artifacts = new Map<string, ArtifactRow>();
  const fixtureText = new Map<string, string>();

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const municipality = await pool.query<{ id: string }>(
      `SELECT id FROM municipalities WHERE terc = '3261011' LIMIT 1`,
    );
    municipalityId = municipality.rows[0]?.id ?? '';
    if (!municipalityId) throw new Error('Koszalin pilot municipality missing');

    for (const [sourceAlias, source] of Object.entries(golden.sources)) {
      const sourceResult = await pool.query<{ id: string }>(
        `SELECT id FROM sources WHERE source_url = $1 LIMIT 1`,
        [source.url],
      );
      const sourceId = sourceResult.rows[0]?.id;
      if (!sourceId) throw new Error(`Golden source registry entry missing: ${source.url}`);

      const fixtureUrl = new URL(`../test/golden/${source.fixture}`, import.meta.url);
      const text = readFileSync(fixtureUrl, 'utf8');
      fixtureText.set(sourceAlias, text);
      const digest = sha256(text);
      const artifact = await pool.query<ArtifactRow>(
        `INSERT INTO source_artifacts (
           source_id, retrieved_at, sha256, storage_uri, parser_key, parser_version,
           extraction_confidence, status, parse_report
         ) VALUES (
           $1, now(), $2, $3, $4, $5, 0.99, 'NORMALIZED', $6::jsonb
         )
         ON CONFLICT (source_id, sha256) DO UPDATE SET
           retrieved_at = EXCLUDED.retrieved_at,
           parser_key = EXCLUDED.parser_key,
           parser_version = EXCLUDED.parser_version,
           extraction_confidence = EXCLUDED.extraction_confidence,
           status = EXCLUDED.status,
           parse_report = EXCLUDED.parse_report
         RETURNING id, sha256, $7::text AS source_url, parser_key, parser_version, retrieved_at`,
        [
          sourceId,
          digest,
          `fixture://golden-facilities/${sourceAlias}/${digest}`,
          source.parserKey,
          source.parserVersion,
          JSON.stringify({ goldenDataset: golden.version, sourceAlias }),
          source.url,
        ],
      );
      const row = artifact.rows[0]!;
      artifactIds.push(row.id);
      artifacts.set(sourceAlias, row);
    }

    const mainArtifact = artifacts.get('pgkMain');
    const faqArtifact = artifacts.get('pgkFaq');
    if (!mainArtifact || !faqArtifact) throw new Error('Golden PGK artifacts missing');

    const published = entity('pszok-komunalna-5').expected;
    const publishedInsert = await pool.query<{ id: string }>(
      `INSERT INTO facilities (
         municipality_id, canonical_key, kind, name, address_text, geom,
         accepted_materials, accepted_containers, opening_hours, opening_hours_timezone,
         hours_source_artifact_id, access_scope, access_requires_proof, access_rules,
         access_source_artifact_id, operational_status, operator_name, rules_url,
         verification_status, confidence, source_artifact_id, location_source_artifact_id
       ) VALUES (
         $1, $2, 'PSZOK', $3, $4,
         ST_SetSRID(ST_MakePoint($5, $6), 4326),
         $7::text[], ARRAY[]::text[], $8::jsonb, 'Europe/Warsaw',
         $9, 'MUNICIPALITY_RESIDENTS', true, $10::jsonb,
         $9, 'UNKNOWN', 'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie',
         'https://www.pgkkoszalin.pl/wp-content/uploads/2025/06/PSZOK-Komunalna-5.pdf',
         'OFFICIAL_SOURCE', 0.99, $9, $9
       ) RETURNING id`,
      [
        municipalityId,
        published.canonicalKey,
        published.name,
        published.address,
        published.location!.lon,
        published.location!.lat,
        published.acceptedMaterials ?? [],
        JSON.stringify(published.openingHours),
        mainArtifact.id,
        JSON.stringify({ quantityLimits: published.access?.quantityLimits ?? [] }),
      ],
    );
    const publishedFacilityId = publishedInsert.rows[0]!.id;
    facilityIds.push(publishedFacilityId);

    const assertionSpecs = [
      {
        artifact: mainArtifact,
        sourceKey: 'pgk-koszalin-pszok-main',
        materials: [] as string[],
        fingerprint: 'golden-pszok-komunalna-5-main',
      },
      {
        artifact: faqArtifact,
        sourceKey: 'pgk-koszalin-pszok-faq',
        materials: published.acceptedMaterials ?? [],
        fingerprint: 'golden-pszok-komunalna-5-faq',
      },
    ];

    for (const spec of assertionSpecs) {
      const assertion = await pool.query<{ id: string }>(
        `INSERT INTO facility_source_assertions (
           facility_id, source_artifact_id, source_key, source_authority,
           verification_status, confidence, retrieved_at, static_freshness_seconds,
           status_freshness_seconds, kind, municipality_id, name, normalized_name,
           address_text, normalized_address, geom, external_ids, accepted_materials,
           accepted_containers, operational_status, fingerprint, reconciliation_state
         ) VALUES (
           $1, $2, $3, 200, 'OFFICIAL_SOURCE', 0.99, now(), 604800, 3600,
           'PSZOK', $4, $5, 'pszok komunalna 5', $6, 'komunalna 5 koszalin',
           ST_SetSRID(ST_MakePoint(16.183616, 54.212266), 4326),
           '[]'::jsonb, $7::text[], ARRAY[]::text[], 'UNKNOWN', $8, 'CANONICAL'
         ) RETURNING id`,
        [
          publishedFacilityId,
          spec.artifact.id,
          spec.sourceKey,
          municipalityId,
          published.name,
          published.address,
          spec.materials,
          spec.fingerprint,
        ],
      );
      assertionIds.push(assertion.rows[0]!.id);
    }

    const review = entity('pszok-na-skwierzynke-2').expected;
    const reviewInsert = await pool.query<{ id: string }>(
      `INSERT INTO facilities (
         municipality_id, canonical_key, kind, name, address_text, geom,
         accepted_materials, accepted_containers, opening_hours, opening_hours_timezone,
         hours_source_artifact_id, access_scope, access_requires_proof, access_rules,
         access_source_artifact_id, operational_status, operator_name,
         verification_status, confidence, source_artifact_id, location_source_artifact_id
       ) VALUES (
         $1, $2, 'PSZOK', $3, $4, NULL,
         ARRAY[]::text[], ARRAY[]::text[], $5::jsonb, 'Europe/Warsaw',
         $6, 'MUNICIPALITY_RESIDENTS', true, '{}'::jsonb,
         $6, 'UNKNOWN', 'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie',
         'REVIEW_REQUIRED', 0.8, $6, NULL
       ) RETURNING id`,
      [
        municipalityId,
        review.canonicalKey,
        review.name,
        review.address,
        JSON.stringify(published.openingHours),
        mainArtifact.id,
      ],
    );
    const reviewFacilityId = reviewInsert.rows[0]!.id;
    facilityIds.push(reviewFacilityId);

    const reviewAssertion = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         facility_id, source_artifact_id, source_key, source_authority,
         verification_status, confidence, retrieved_at, static_freshness_seconds,
         status_freshness_seconds, kind, municipality_id, name, normalized_name,
         address_text, normalized_address, geom, external_ids, accepted_materials,
         accepted_containers, operational_status, fingerprint, reconciliation_state
       ) VALUES (
         $1, $2, 'pgk-koszalin-pszok-main', 200, 'REVIEW_REQUIRED', 0.8,
         now(), 604800, 3600, 'PSZOK', $3, $4, 'pszok na skwierzynke 2',
         $5, 'na skwierzynke 2 koszalin', NULL, '[]'::jsonb,
         ARRAY[]::text[], ARRAY[]::text[], 'UNKNOWN',
         'golden-pszok-na-skwierzynke-2-main', 'REVIEW_REQUIRED'
       ) RETURNING id`,
      [reviewFacilityId, mainArtifact.id, municipalityId, review.name, review.address],
    );
    assertionIds.push(reviewAssertion.rows[0]!.id);

    app = await createApp();
    app.useLogger(['error']);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (assertionIds.length > 0) {
      await pool.query('DELETE FROM facility_source_assertions WHERE id = ANY($1::uuid[])', [assertionIds]);
    }
    if (facilityIds.length > 0) {
      await pool.query('DELETE FROM facilities WHERE id = ANY($1::uuid[])', [facilityIds]);
    }
    if (artifactIds.length > 0) {
      await pool.query('DELETE FROM source_artifacts WHERE id = ANY($1::uuid[])', [artifactIds]);
    }
    await pool.end();
  });

  async function provenanceFor(canonicalKey: string): Promise<unknown> {
    const result = await pool.query<FacilityProvenanceRow>(
      `SELECT
         f.canonical_key,
         pa.id AS primary_artifact_id,
         pa.sha256 AS primary_sha256,
         pa.parser_key AS primary_parser_key,
         pa.parser_version AS primary_parser_version,
         a.id AS assertion_id,
         a.source_key AS assertion_source_key,
         aa.id AS assertion_artifact_id,
         aa.sha256 AS assertion_sha256,
         aa.parser_key AS assertion_parser_key,
         aa.parser_version AS assertion_parser_version
       FROM facilities f
       JOIN source_artifacts pa ON pa.id = f.source_artifact_id
       LEFT JOIN facility_source_assertions a ON a.facility_id = f.id
       LEFT JOIN source_artifacts aa ON aa.id = a.source_artifact_id
       WHERE f.canonical_key = $1
       ORDER BY a.source_key NULLS LAST`,
      [canonicalKey],
    );
    return result.rows.map((row) => ({
      canonicalKey: row.canonical_key,
      primary: {
        artifactId: row.primary_artifact_id,
        sha256: row.primary_sha256,
        parserKey: row.primary_parser_key,
        parserVersion: row.primary_parser_version,
      },
      assertion: row.assertion_id
        ? {
            assertionId: row.assertion_id,
            sourceKey: row.assertion_source_key,
            artifactId: row.assertion_artifact_id,
            sha256: row.assertion_sha256,
            parserKey: row.assertion_parser_key,
            parserVersion: row.assertion_parser_version,
          }
        : null,
    }));
  }

  it('keeps complete-case map-data correctness at or above 99%', async () => {
    const mismatches: GoldenMismatch[] = [];
    let passed = 0;

    expect(golden.completeCases.length).toBeGreaterThanOrEqual(8);
    expect(new Set(golden.completeCases.map((item) => item.id)).size).toBe(golden.completeCases.length);
    expect(golden.threshold).toBe(0.99);

    for (const testCase of golden.completeCases) {
      const target = entity(testCase.entityId);
      if (target.expectedDisposition !== 'PUBLISHED_PIN') {
        throw new Error(`Complete case ${testCase.id} must target a published pin`);
      }

      const response = await app.inject({
        method: 'GET',
        url: `/v1/facilities?${testCase.query}`,
      });
      const body = response.statusCode === 200 ? response.json() : null;
      const item = body?.items?.find(
        (candidate: ApiFacility) => candidate.canonicalKey === target.expected.canonicalKey,
      ) as ApiFacility | undefined;

      const expected = normalizeExpected(target.expected);
      const actual = response.statusCode === 200 && item
        ? normalizeApiItem(item)
        : { statusCode: response.statusCode, body };

      if (isDeepStrictEqual(actual, expected)) {
        passed += 1;
        continue;
      }

      mismatches.push({
        caseId: testCase.id,
        entityId: testCase.entityId,
        query: testCase.query,
        expected,
        actual,
        provenance: await provenanceFor(target.expected.canonicalKey),
      });
    }

    const correctness = passed / golden.completeCases.length;
    const report = {
      datasetVersion: golden.version,
      researchCheckpoint: golden.researchCheckpoint,
      coverage: golden.coverage,
      threshold: golden.threshold,
      total: golden.completeCases.length,
      passed,
      failed: mismatches.length,
      correctness,
      correctnessPercent: Number((correctness * 100).toFixed(3)),
      sourceArtifacts: Object.fromEntries(
        [...artifacts.entries()].map(([alias, artifact]) => [
          alias,
          {
            url: golden.sources[alias]!.url,
            sha256: artifact.sha256,
            parserKey: artifact.parser_key,
            parserVersion: artifact.parser_version,
            fixtureSha256: sha256(fixtureText.get(alias) ?? ''),
          },
        ]),
      ),
      mismatches,
    };

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (mismatches.length > 0) {
      console.error(`Golden facility mismatch report:\n${JSON.stringify(report, null, 2)}`);
    }

    expect(
      correctness,
      `Golden facility correctness ${report.correctnessPercent}% is below ${golden.threshold * 100}%`,
    ).toBeGreaterThanOrEqual(golden.threshold);
  });

  it('keeps a source-backed locationless PSZOK explicitly review-required', async () => {
    const target = entity('pszok-na-skwierzynke-2');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/facilities?terc=3261011&kind=PSZOK&limit=200',
    });
    expect(response.statusCode, response.body).toBe(200);
    const item = response.json().items.find(
      (candidate: ApiFacility) => candidate.canonicalKey === target.expected.canonicalKey,
    ) as ApiFacility | undefined;
    expect(item).toBeTruthy();
    expect(item!.location).toBeNull();
    expect(item!.quality.verificationStatus).toBe('REVIEW_REQUIRED');
    expect(item!.quality.warnings).toContain('COORDINATES_UNKNOWN');
    expect(item!.operationalStatus).toEqual({ state: 'UNKNOWN', observedAt: null });
  });

  it('returns one canonical map pin despite two independent official source assertions', async () => {
    const target = entity('pszok-komunalna-5');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/facilities?lat=54.212266&lon=16.183616&radiusMeters=30&kind=PSZOK&limit=200',
    });
    expect(response.statusCode, response.body).toBe(200);
    const matches = response.json().items.filter(
      (candidate: ApiFacility) => candidate.canonicalKey === target.expected.canonicalKey,
    ) as ApiFacility[];
    expect(matches).toHaveLength(1);
    expect(sorted(matches[0]!.provenance.assertions.map((assertion) => assertion.sourceKey))).toEqual(
      ['pgk-koszalin-pszok-faq', 'pgk-koszalin-pszok-main'],
    );
  });

  it('keeps same-venue RVM and manual return as review-required instead of silently merging', () => {
    const base = {
      sourceArtifactId: '11111111-1111-1111-1111-111111111111',
      sourceAuthority: 400,
      retrievedAt: new Date().toISOString(),
      staticFreshnessSeconds: 86400,
      statusFreshnessSeconds: 3600,
      municipalityTerc: '3261011',
      name: 'Sklep testowy Koszalin',
      address: 'Testowa 1, Koszalin',
      location: { lat: 54.2, lon: 16.18 },
      externalIdentities: [{ namespace: 'retailer', id: 'venue-1', role: 'VENUE' as const }],
      operationalStatus: { state: 'UNKNOWN' as const, observedAt: null, sourceKey: null },
    };
    const rvm: FacilityIdentityAssertion = {
      ...base,
      sourceKey: 'operator-rvm',
      kind: 'DEPOSIT_RVM',
    };
    const manual: FacilityIdentityAssertion = {
      ...base,
      sourceKey: 'retailer-manual',
      kind: 'DEPOSIT_MANUAL',
    };

    const result = compareFacilityAssertions(rvm, manual);
    expect(result.decision).toBe('REVIEW_REQUIRED');
    expect(result.reasons).toContain('KIND_CONFLICT_BLOCKS_AUTO_MERGE');
  });
});
