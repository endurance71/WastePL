import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import pg, { type QueryResultRow } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './main.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;
const goldenPath = fileURLToPath(new URL('../test/golden/pilot-2026.json', import.meta.url));
const reportPath = fileURLToPath(
  new URL('../test-results/golden-mismatch-report.json', import.meta.url),
);

interface GoldenEvent {
  date: string;
  fraction: string;
  status: string;
}

interface GoldenCase {
  id: string;
  addressQuery: string;
  expectedCanonicalText: string;
  municipalityTerc: string;
  serviceArea: string;
  eventProfile: string;
  evidence: string;
}

interface GoldenPack {
  version: string;
  threshold: number;
  sources: Record<string, string>;
  addressEvidence: Record<string, unknown>;
  serviceAreas: Record<string, { name: string; source: string }>;
  eventProfiles: Record<string, { from: string; days: number; events: GoldenEvent[] }>;
  cases: GoldenCase[];
}

interface ProvenanceRow extends QueryResultRow {
  source_url: string | null;
  sha256: string | null;
  parser_key: string | null;
  parser_version: string | null;
  retrieved_at: Date | null;
  artifact_status: string | null;
}

interface CollectionResponseBody {
  address?: { canonicalText?: string };
  municipality?: { terc?: string };
  serviceArea?: { name?: string };
  events?: GoldenEvent[];
  source?: { url?: string };
  quality?: { verificationStatus?: string };
}

interface GoldenMismatch {
  id: string;
  addressQuery: string;
  expected: unknown;
  actual: unknown;
  evidence: unknown;
  provenance: unknown;
}

const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as GoldenPack;

integrationDescribe('WastePL golden pilot dataset', () => {
  let app: NestFastifyApplication;
  let pool: InstanceType<typeof Pool>;

  beforeAll(async () => {
    app = await createApp();
    app.useLogger(['error']);
    await app.init();
    pool = new Pool({ connectionString: databaseUrl });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  async function provenanceFor(serviceAreaKey: string, terc: string): Promise<unknown> {
    const result = await pool.query<ProvenanceRow>(
      `SELECT
         s.source_url,
         art.sha256,
         COALESCE(art.parser_key, s.parser_key) AS parser_key,
         art.parser_version,
         art.retrieved_at,
         art.status AS artifact_status
       FROM service_areas sa
       JOIN municipalities m ON m.id = sa.municipality_id
       LEFT JOIN collection_events ce ON ce.service_area_id = sa.id
       LEFT JOIN source_artifacts art ON art.id = ce.source_artifact_id
       LEFT JOIN sources s ON s.id = art.source_id
       WHERE sa.external_key = $1
         AND m.terc = $2
       ORDER BY art.retrieved_at DESC NULLS LAST, ce.collection_date DESC NULLS LAST
       LIMIT 1`,
      [serviceAreaKey, terc],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      sourceUrl: row.source_url,
      artifactSha256: row.sha256,
      parserKey: row.parser_key,
      parserVersion: row.parser_version,
      retrievedAt: row.retrieved_at?.toISOString() ?? null,
      artifactStatus: row.artifact_status,
    };
  }

  it('keeps end-to-end schedule correctness at or above 99%', async () => {
    const mismatches: GoldenMismatch[] = [];
    let passed = 0;

    expect(golden.cases.length).toBeGreaterThanOrEqual(30);
    expect(new Set(golden.cases.map((testCase) => testCase.id)).size).toBe(golden.cases.length);
    expect(new Set(golden.cases.map((testCase) => testCase.municipalityTerc))).toEqual(
      new Set(['3261011', '3209042']),
    );

    for (const testCase of golden.cases) {
      const profile = golden.eventProfiles[testCase.eventProfile];
      const area = golden.serviceAreas[testCase.serviceArea];
      if (!profile) throw new Error(`Missing event profile ${testCase.eventProfile}`);
      if (!area) throw new Error(`Missing service area ${testCase.serviceArea}`);
      const sourceUrl = golden.sources[area.source];
      if (!sourceUrl) throw new Error(`Missing source ${area.source}`);

      const response = await app.inject({
        method: 'GET',
        url:
          `/v1/collection?address=${encodeURIComponent(testCase.addressQuery)}` +
          `&from=${profile.from}&days=${profile.days}`,
      });

      const expected = {
        statusCode: 200,
        canonicalText: testCase.expectedCanonicalText,
        municipalityTerc: testCase.municipalityTerc,
        serviceAreaName: area.name,
        events: profile.events,
        sourceUrl,
        verificationStatus: 'OFFICIAL_SOURCE',
      };

      let actual: unknown;
      if (response.statusCode === 200) {
        const body = response.json() as CollectionResponseBody;
        actual = {
          statusCode: response.statusCode,
          canonicalText: body.address?.canonicalText,
          municipalityTerc: body.municipality?.terc,
          serviceAreaName: body.serviceArea?.name,
          events: body.events,
          sourceUrl: body.source?.url,
          verificationStatus: body.quality?.verificationStatus,
        };
      } else {
        actual = {
          statusCode: response.statusCode,
          body: response.json(),
        };
      }

      if (isDeepStrictEqual(actual, expected)) {
        passed += 1;
        continue;
      }

      mismatches.push({
        id: testCase.id,
        addressQuery: testCase.addressQuery,
        expected,
        actual,
        evidence: golden.addressEvidence[testCase.evidence] ?? null,
        provenance: await provenanceFor(testCase.serviceArea, testCase.municipalityTerc),
      });
    }

    const correctness = passed / golden.cases.length;
    const report = {
      datasetVersion: golden.version,
      threshold: golden.threshold,
      total: golden.cases.length,
      passed,
      failed: mismatches.length,
      correctness,
      correctnessPercent: Number((correctness * 100).toFixed(3)),
      mismatches,
    };

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (mismatches.length > 0) {
      console.error(`Golden mismatch report:\n${JSON.stringify(report, null, 2)}`);
    }

    expect(
      correctness,
      `Golden correctness ${report.correctnessPercent}% is below ${golden.threshold * 100}%`,
    ).toBeGreaterThanOrEqual(golden.threshold);
  });
});
