import {
  normalizeFacilityText,
  type FacilityIdentityAssertion,
  type FacilityMatchResult,
  type FacilityOperationalState,
  type FacilityKind,
} from '@wastepl/domain';
import type { Pool, QueryResultRow } from 'pg';
import type {
  FacilityReconciliationRepository,
  ReconciliationCandidate,
} from './facility-reconciliation-service.js';

interface AssertionRow extends QueryResultRow {
  facility_id: string;
  source_artifact_id: string;
  source_key: string;
  source_authority: number;
  retrieved_at: Date;
  static_freshness_seconds: number;
  status_freshness_seconds: number;
  kind: FacilityKind;
  municipality_terc: string | null;
  name: string;
  address_text: string | null;
  lat: number | null;
  lon: number | null;
  external_ids: Array<{ namespace: string; id: string; role: 'POINT' | 'VENUE' | 'MACHINE' }>;
  operational_status: FacilityOperationalState;
  operational_status_observed_at: Date | null;
  operational_status_source_key: string | null;
}

function mapCandidate(row: AssertionRow): ReconciliationCandidate {
  return {
    facilityId: row.facility_id,
    assertion: {
      sourceKey: row.source_key,
      sourceArtifactId: row.source_artifact_id,
      sourceAuthority: Number(row.source_authority),
      retrievedAt: row.retrieved_at.toISOString(),
      staticFreshnessSeconds: Number(row.static_freshness_seconds),
      statusFreshnessSeconds: Number(row.status_freshness_seconds),
      kind: row.kind,
      municipalityTerc: row.municipality_terc,
      name: row.name,
      address: row.address_text,
      location: row.lat === null || row.lon === null
        ? null
        : { lat: Number(row.lat), lon: Number(row.lon) },
      externalIdentities: row.external_ids ?? [],
      operationalStatus: {
        state: row.operational_status,
        observedAt: row.operational_status_observed_at?.toISOString() ?? null,
        sourceKey: row.operational_status_source_key,
      },
    },
  };
}

const assertionSelect = `
  SELECT DISTINCT ON (a.facility_id)
    a.facility_id,
    a.source_artifact_id,
    a.source_key,
    a.source_authority,
    a.retrieved_at,
    a.static_freshness_seconds,
    a.status_freshness_seconds,
    a.kind,
    m.terc AS municipality_terc,
    a.name,
    a.address_text,
    CASE WHEN a.geom IS NULL THEN NULL ELSE ST_Y(a.geom) END AS lat,
    CASE WHEN a.geom IS NULL THEN NULL ELSE ST_X(a.geom) END AS lon,
    a.external_ids,
    a.operational_status,
    a.operational_status_observed_at,
    a.operational_status_source_key
  FROM facility_source_assertions a
  LEFT JOIN municipalities m ON m.id = a.municipality_id
`;

export class PgFacilityReconciliationRepository implements FacilityReconciliationRepository {
  constructor(private readonly pool: Pool) {}

  async findExactIdentityCandidates(assertion: FacilityIdentityAssertion): Promise<ReconciliationCandidate[]> {
    if (assertion.externalIdentities.length === 0) return [];

    const result = await this.pool.query<AssertionRow>(
      `${assertionSelect}
       WHERE a.facility_id IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM jsonb_array_elements(a.external_ids) existing
           CROSS JOIN jsonb_array_elements($1::jsonb) incoming
           WHERE lower(existing->>'namespace') = lower(incoming->>'namespace')
             AND lower(existing->>'id') = lower(incoming->>'id')
             AND (
               (existing->>'role' = 'POINT' AND incoming->>'role' = 'POINT')
               OR (
                 existing->>'role' = 'VENUE'
                 AND incoming->>'role' = 'VENUE'
                 AND a.kind = $2
               )
             )
         )
       ORDER BY a.facility_id, a.source_authority DESC, a.retrieved_at DESC, a.id ASC`,
      [JSON.stringify(assertion.externalIdentities), assertion.kind],
    );
    return result.rows.map(mapCandidate);
  }

  async findFuzzyCandidates(assertion: FacilityIdentityAssertion): Promise<ReconciliationCandidate[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const bind = (value: unknown): number => {
      params.push(value);
      return params.length;
    };

    const normalizedAddress = normalizeFacilityText(assertion.address);
    if (normalizedAddress) conditions.push(`a.normalized_address = $${bind(normalizedAddress)}`);

    const normalizedName = normalizeFacilityText(assertion.name);
    if (normalizedName) conditions.push(`a.normalized_name = $${bind(normalizedName)}`);

    if (assertion.location) {
      const lon = bind(assertion.location.lon);
      const lat = bind(assertion.location.lat);
      conditions.push(`(
        a.geom IS NOT NULL AND ST_DWithin(
          a.geom::geography,
          ST_SetSRID(ST_MakePoint($${lon}, $${lat}), 4326)::geography,
          150
        )
      )`);
    }

    if (conditions.length === 0) return [];

    let municipalityClause = '';
    if (assertion.municipalityTerc) {
      municipalityClause = `AND m.terc = $${bind(assertion.municipalityTerc)}`;
    }

    const result = await this.pool.query<AssertionRow>(
      `${assertionSelect}
       WHERE a.facility_id IS NOT NULL
         ${municipalityClause}
         AND (${conditions.join(' OR ')})
       ORDER BY a.facility_id, a.source_authority DESC, a.retrieved_at DESC, a.id ASC
       LIMIT 100`,
      params,
    );
    return result.rows.map(mapCandidate);
  }

  async attachAssertion(assertionId: string, facilityId: string): Promise<void> {
    await this.pool.query(
      `UPDATE facility_source_assertions
       SET facility_id = $2, reconciliation_state = 'CANONICAL'
       WHERE id = $1`,
      [assertionId, facilityId],
    );
  }

  async createCanonicalFacility(assertionId: string): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO facilities (
           municipality_id, canonical_key, kind, name, address_text, geom,
           external_ids, accepted_materials, accepted_containers,
           operational_status, operational_status_observed_at,
           operational_status_source_artifact_id, location_source_artifact_id,
           verification_status, confidence, source_artifact_id
         )
         SELECT
           af.municipality_id,
           'assertion:' || af.id::text,
           af.kind,
           af.name,
           af.address_text,
           af.geom,
           af.external_ids,
           af.accepted_materials,
           af.accepted_containers,
           af.effective_operational_status,
           CASE WHEN af.effective_operational_status = 'UNKNOWN'
             THEN NULL ELSE af.operational_status_observed_at END,
           CASE WHEN af.effective_operational_status = 'UNKNOWN'
             THEN NULL ELSE af.source_artifact_id END,
           CASE WHEN af.geom IS NULL THEN NULL ELSE af.source_artifact_id END,
           af.verification_status,
           af.confidence,
           af.source_artifact_id
         FROM facility_source_assertion_freshness af
         WHERE af.id = $1
         RETURNING id`,
        [assertionId],
      );
      const facilityId = inserted.rows[0]?.id;
      if (!facilityId) throw new Error(`Facility assertion ${assertionId} not found`);

      await client.query(
        `UPDATE facility_source_assertions
         SET facility_id = $2, reconciliation_state = 'CANONICAL'
         WHERE id = $1`,
        [assertionId, facilityId],
      );
      await client.query('COMMIT');
      return facilityId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async queueReview(
    assertionId: string,
    candidateFacilityId: string,
    result: FacilityMatchResult,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO facility_reconciliation_reviews (
           assertion_id, candidate_facility_id, score, reasons, state
         ) VALUES ($1, $2, $3, $4::jsonb, 'PENDING')
         ON CONFLICT (assertion_id, candidate_facility_id)
         DO UPDATE SET score = EXCLUDED.score,
                       reasons = EXCLUDED.reasons,
                       state = 'PENDING',
                       resolved_at = NULL,
                       resolution_note = NULL`,
        [assertionId, candidateFacilityId, result.score, JSON.stringify(result.reasons)],
      );
      await client.query(
        `UPDATE facility_source_assertions
         SET facility_id = NULL, reconciliation_state = 'REVIEW_REQUIRED'
         WHERE id = $1`,
        [assertionId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
