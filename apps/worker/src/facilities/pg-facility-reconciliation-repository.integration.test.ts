import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FacilityIdentityAssertion } from '@wastepl/domain';
import { FacilityReconciliationService } from './facility-reconciliation-service.js';
import { PgFacilityReconciliationRepository } from './pg-facility-reconciliation-repository.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('PgFacilityReconciliationRepository', () => {
  let pool: InstanceType<typeof Pool>;
  let municipalityId: string;
  const sourceIds: string[] = [];
  const artifactIds: string[] = [];
  const facilityIds: string[] = [];
  const assertionIds: string[] = [];
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const municipality = await pool.query<{ id: string }>(
      `SELECT id FROM municipalities WHERE terc = '3261011' LIMIT 1`,
    );
    municipalityId = municipality.rows[0]?.id ?? '';
    if (!municipalityId) throw new Error('Expected Koszalin pilot municipality');

    for (const marker of ['c', 'd', 'e']) {
      const source = await pool.query<{ id: string }>(
        `INSERT INTO sources (municipality_id, owner_type, owner_name, source_url, source_format, parser_key)
         VALUES ($1, 'TEST', 'PG reconciliation test', $2, 'JSON', 'pg-reconcile-v1') RETURNING id`,
        [municipalityId, `https://example.test/pg-reconcile/${suffix}/${marker}`],
      );
      sourceIds.push(source.rows[0]!.id);
      const artifact = await pool.query<{ id: string }>(
        `INSERT INTO source_artifacts (
           source_id, sha256, storage_uri, parser_key, parser_version,
           extraction_confidence, status, parse_report
         ) VALUES ($1, $2, $3, 'pg-reconcile-v1', '1.0.0', 1, 'NORMALIZED', '{}'::jsonb)
         RETURNING id`,
        [source.rows[0]!.id, marker.repeat(64), `s3://test/pg-reconcile/${suffix}/${marker}`],
      );
      artifactIds.push(artifact.rows[0]!.id);
    }
  });

  afterAll(async () => {
    if (assertionIds.length) {
      await pool.query('DELETE FROM facility_source_assertions WHERE id = ANY($1::uuid[])', [assertionIds]);
    }
    if (facilityIds.length) {
      await pool.query('DELETE FROM facilities WHERE id = ANY($1::uuid[])', [facilityIds]);
    }
    if (sourceIds.length) await pool.query('DELETE FROM sources WHERE id = ANY($1::uuid[])', [sourceIds]);
    await pool.end();
  });

  async function insertCanonicalAssertion(input: {
    kind: 'PSZOK' | 'DEPOSIT_MANUAL';
    name: string;
    address: string;
    lon: number;
    lat: number;
    artifactId: string;
    fingerprint: string;
    externalIds: unknown[];
    containers?: string[];
  }): Promise<{ facilityId: string; assertionId: string }> {
    const facility = await pool.query<{ id: string }>(
      `INSERT INTO facilities (
         municipality_id, canonical_key, kind, name, address_text, geom, external_ids,
         accepted_containers, verification_status, confidence, source_artifact_id,
         location_source_artifact_id
       ) VALUES (
         $1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6,$7),4326), $8::jsonb,
         $9::text[], 'OFFICIAL_SOURCE', 1, $10, $10
       ) RETURNING id`,
      [
        municipalityId,
        `pg-reconcile-${suffix}-${input.fingerprint}`,
        input.kind,
        input.name,
        input.address,
        input.lon,
        input.lat,
        JSON.stringify(input.externalIds),
        input.containers ?? [],
        input.artifactId,
      ],
    );
    facilityIds.push(facility.rows[0]!.id);

    const assertion = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         facility_id, source_artifact_id, source_key, source_authority, retrieved_at,
         static_freshness_seconds, status_freshness_seconds, kind, municipality_id,
         name, normalized_name, address_text, normalized_address, geom, external_ids,
         accepted_containers, fingerprint, reconciliation_state
       ) VALUES (
         $1,$2,$3,400,now(),604800,3600,$4,$5,$6,$7,$8,$9,
         ST_SetSRID(ST_MakePoint($10,$11),4326),$12::jsonb,$13::text[],$14,'CANONICAL'
       ) RETURNING id`,
      [
        facility.rows[0]!.id,
        input.artifactId,
        `existing-${input.fingerprint}`,
        input.kind,
        municipalityId,
        input.name,
        input.name.toLowerCase(),
        input.address,
        input.address.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
        input.lon,
        input.lat,
        JSON.stringify(input.externalIds),
        input.containers ?? [],
        input.fingerprint,
      ],
    );
    assertionIds.push(assertion.rows[0]!.id);
    return { facilityId: facility.rows[0]!.id, assertionId: assertion.rows[0]!.id };
  }

  it('finds an exact POINT identity and attaches the incoming assertion', async () => {
    const existing = await insertCanonicalAssertion({
      kind: 'PSZOK',
      name: 'PG Exact PSZOK',
      address: 'Komunalna 20, Koszalin',
      lon: 16.181,
      lat: 54.211,
      artifactId: artifactIds[0]!,
      fingerprint: `exact-existing-${suffix}`,
      externalIds: [{ namespace: 'operator-x', id: 'point-777', role: 'POINT' }],
    });

    const incomingRow = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         source_artifact_id, source_key, source_authority, retrieved_at,
         static_freshness_seconds, status_freshness_seconds, kind, municipality_id,
         name, normalized_name, address_text, normalized_address, geom, external_ids,
         fingerprint, reconciliation_state
       ) VALUES (
         $1,'incoming-exact',500,now(),604800,3600,'PSZOK',$2,
         'Other label','other label','Komunalna 20, Koszalin','komunalna 20 koszalin',
         ST_SetSRID(ST_MakePoint(16.181,54.211),4326),$3::jsonb,$4,'UNMATCHED'
       ) RETURNING id`,
      [
        artifactIds[1],
        municipalityId,
        JSON.stringify([{ namespace: 'operator-x', id: 'point-777', role: 'POINT' }]),
        `exact-incoming-${suffix}`,
      ],
    );
    assertionIds.push(incomingRow.rows[0]!.id);

    const incoming: FacilityIdentityAssertion = {
      sourceKey: 'incoming-exact',
      sourceArtifactId: artifactIds[1]!,
      sourceAuthority: 500,
      retrievedAt: new Date().toISOString(),
      staticFreshnessSeconds: 604800,
      statusFreshnessSeconds: 3600,
      kind: 'PSZOK',
      municipalityTerc: '3261011',
      name: 'Other label',
      address: 'Komunalna 20, Koszalin',
      location: { lat: 54.211, lon: 16.181 },
      externalIdentities: [{ namespace: 'operator-x', id: 'point-777', role: 'POINT' }],
      operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
    };

    const service = new FacilityReconciliationService(new PgFacilityReconciliationRepository(pool));
    const outcome = await service.reconcile(incomingRow.rows[0]!.id, incoming);
    expect(outcome).toMatchObject({ state: 'ATTACHED', facilityId: existing.facilityId });

    const persisted = await pool.query<{ facility_id: string; reconciliation_state: string }>(
      `SELECT facility_id, reconciliation_state FROM facility_source_assertions WHERE id = $1`,
      [incomingRow.rows[0]!.id],
    );
    expect(persisted.rows[0]).toEqual({ facility_id: existing.facilityId, reconciliation_state: 'CANONICAL' });
  });

  it('queues a same-location RVM/manual kind conflict for review', async () => {
    const existing = await insertCanonicalAssertion({
      kind: 'DEPOSIT_MANUAL',
      name: 'Sklep Review Point',
      address: 'Zwycięstwa 40, Koszalin',
      lon: 16.19,
      lat: 54.2,
      artifactId: artifactIds[0]!,
      fingerprint: `review-existing-${suffix}`,
      externalIds: [],
      containers: ['PET_BOTTLE'],
    });

    const incomingRow = await pool.query<{ id: string }>(
      `INSERT INTO facility_source_assertions (
         source_artifact_id, source_key, source_authority, retrieved_at,
         static_freshness_seconds, status_freshness_seconds, kind, municipality_id,
         name, normalized_name, address_text, normalized_address, geom, external_ids,
         accepted_containers, fingerprint, reconciliation_state
       ) VALUES (
         $1,'incoming-rvm',400,now(),604800,3600,'DEPOSIT_RVM',$2,
         'Sklep Review Automat','sklep review automat','Zwycięstwa 40, Koszalin',
         'zwyciestwa 40 koszalin',ST_SetSRID(ST_MakePoint(16.19,54.2),4326),'[]'::jsonb,
         ARRAY['PET_BOTTLE']::text[],$3,'UNMATCHED'
       ) RETURNING id`,
      [artifactIds[2], municipalityId, `review-incoming-${suffix}`],
    );
    assertionIds.push(incomingRow.rows[0]!.id);

    const incoming: FacilityIdentityAssertion = {
      sourceKey: 'incoming-rvm',
      sourceArtifactId: artifactIds[2]!,
      sourceAuthority: 400,
      retrievedAt: new Date().toISOString(),
      staticFreshnessSeconds: 604800,
      statusFreshnessSeconds: 3600,
      kind: 'DEPOSIT_RVM',
      municipalityTerc: '3261011',
      name: 'Sklep Review Automat',
      address: 'Zwycięstwa 40, Koszalin',
      location: { lat: 54.2, lon: 16.19 },
      externalIdentities: [],
      operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
    };

    const service = new FacilityReconciliationService(new PgFacilityReconciliationRepository(pool));
    const outcome = await service.reconcile(incomingRow.rows[0]!.id, incoming);
    expect(outcome.state).toBe('REVIEW_REQUIRED');
    expect(outcome.reviewCandidateIds).toContain(existing.facilityId);

    const review = await pool.query<{ state: string }>(
      `SELECT state FROM facility_reconciliation_reviews
       WHERE assertion_id = $1 AND candidate_facility_id = $2`,
      [incomingRow.rows[0]!.id, existing.facilityId],
    );
    expect(review.rows[0]?.state).toBe('PENDING');
  });
});
