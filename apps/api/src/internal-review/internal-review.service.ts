import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';

export type ReviewKind = 'RECONCILIATION' | 'DATA_QUALITY';
export type ReviewDecision = 'APPROVE' | 'REJECT';

export interface ReviewDecisionInput {
  decision: ReviewDecision;
  actor: string;
  note: string | null;
  geometry: { lat: number; lon: number; sourceArtifactId: string } | null;
}

interface ReviewRow extends QueryResultRow {
  review_kind: ReviewKind;
  review_id: string;
  state: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: Date;
  score: string | null;
  reasons: unknown[] | null;
  review_type: string | null;
  details: Record<string, unknown> | null;
  assertion_id: string;
  source_key: string;
  name: string;
  address_text: string | null;
  kind: string;
  verification_status: string;
  confidence: string;
  assertion_lat: number | null;
  assertion_lon: number | null;
  source_url: string;
  artifact_sha: string;
  parser_version: string | null;
  artifact_status: string;
  retrieved_at: Date;
  candidate_facility_id: string | null;
  candidate_canonical_key: string | null;
  candidate_name: string | null;
  candidate_address: string | null;
  candidate_kind: string | null;
  candidate_lat: number | null;
  candidate_lon: number | null;
}

const REVIEW_SELECT = `
  SELECT
    'RECONCILIATION'::text AS review_kind,
    r.id AS review_id,
    r.state,
    r.created_at,
    r.score::text AS score,
    r.reasons,
    NULL::text AS review_type,
    NULL::jsonb AS details,
    a.id AS assertion_id,
    a.source_key,
    a.name,
    a.address_text,
    a.kind,
    a.verification_status,
    a.confidence::text AS confidence,
    CASE WHEN a.geom IS NULL THEN NULL ELSE ST_Y(a.geom) END AS assertion_lat,
    CASE WHEN a.geom IS NULL THEN NULL ELSE ST_X(a.geom) END AS assertion_lon,
    s.source_url,
    sa.sha256 AS artifact_sha,
    sa.parser_version,
    sa.status AS artifact_status,
    a.retrieved_at,
    f.id AS candidate_facility_id,
    f.canonical_key AS candidate_canonical_key,
    f.name AS candidate_name,
    f.address_text AS candidate_address,
    f.kind AS candidate_kind,
    CASE WHEN f.geom IS NULL THEN NULL ELSE ST_Y(f.geom) END AS candidate_lat,
    CASE WHEN f.geom IS NULL THEN NULL ELSE ST_X(f.geom) END AS candidate_lon
  FROM facility_reconciliation_reviews r
  JOIN facility_source_assertions a ON a.id = r.assertion_id
  JOIN source_artifacts sa ON sa.id = a.source_artifact_id
  JOIN sources s ON s.id = sa.source_id
  JOIN facilities f ON f.id = r.candidate_facility_id
  UNION ALL
  SELECT
    'DATA_QUALITY'::text AS review_kind,
    q.id AS review_id,
    q.state,
    q.created_at,
    NULL::text AS score,
    NULL::jsonb AS reasons,
    q.review_type,
    q.details,
    a.id AS assertion_id,
    a.source_key,
    a.name,
    a.address_text,
    a.kind,
    a.verification_status,
    a.confidence::text AS confidence,
    CASE WHEN a.geom IS NULL THEN NULL ELSE ST_Y(a.geom) END AS assertion_lat,
    CASE WHEN a.geom IS NULL THEN NULL ELSE ST_X(a.geom) END AS assertion_lon,
    s.source_url,
    sa.sha256 AS artifact_sha,
    sa.parser_version,
    sa.status AS artifact_status,
    a.retrieved_at,
    NULL::uuid AS candidate_facility_id,
    NULL::text AS candidate_canonical_key,
    NULL::text AS candidate_name,
    NULL::text AS candidate_address,
    NULL::text AS candidate_kind,
    NULL::double precision AS candidate_lat,
    NULL::double precision AS candidate_lon
  FROM facility_data_quality_reviews q
  JOIN facility_source_assertions a ON a.id = q.assertion_id
  JOIN source_artifacts sa ON sa.id = a.source_artifact_id
  JOIN sources s ON s.id = sa.source_id
`;

function mapReview(row: ReviewRow) {
  return {
    kind: row.review_kind,
    id: row.review_id,
    state: row.state,
    createdAt: row.created_at.toISOString(),
    score: row.score === null ? null : Number(row.score),
    reasons: row.reasons ?? [],
    reviewType: row.review_type,
    details: row.details ?? {},
    assertion: {
      id: row.assertion_id,
      sourceKey: row.source_key,
      name: row.name,
      address: row.address_text,
      kind: row.kind,
      verificationStatus: row.verification_status,
      confidence: Number(row.confidence),
      location:
        row.assertion_lat === null || row.assertion_lon === null
          ? null
          : { lat: Number(row.assertion_lat), lon: Number(row.assertion_lon) },
      source: {
        url: row.source_url,
        artifactSha256: row.artifact_sha,
        parserVersion: row.parser_version,
        artifactStatus: row.artifact_status,
        retrievedAt: row.retrieved_at.toISOString(),
      },
    },
    candidate:
      row.candidate_facility_id === null
        ? null
        : {
            facilityId: row.candidate_facility_id,
            canonicalKey: row.candidate_canonical_key,
            name: row.candidate_name,
            address: row.candidate_address,
            kind: row.candidate_kind,
            location:
              row.candidate_lat === null || row.candidate_lon === null
                ? null
                : { lat: Number(row.candidate_lat), lon: Number(row.candidate_lon) },
          },
  };
}

@Injectable()
export class InternalReviewService {
  constructor(private readonly db: DatabaseService) {}

  async list(state: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL', limit: number, offset: number) {
    const params: unknown[] = [];
    const where = state === 'ALL' ? '' : `WHERE x.state = $${params.push(state)}`;
    params.push(limit, offset);
    const result = await this.db.pool.query<ReviewRow>(
      `SELECT * FROM (${REVIEW_SELECT}) x
       ${where}
       ORDER BY x.created_at ASC, x.review_kind ASC, x.review_id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: result.rows.map(mapReview), limit, offset };
  }

  async get(kind: ReviewKind, id: string) {
    const result = await this.db.pool.query<ReviewRow>(
      `SELECT * FROM (${REVIEW_SELECT}) x WHERE x.review_kind = $1 AND x.review_id = $2::uuid`,
      [kind, id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Review not found' });
    return mapReview(row);
  }

  async decide(kind: ReviewKind, id: string, input: ReviewDecisionInput) {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      const result =
        kind === 'RECONCILIATION'
          ? await this.decideReconciliation(client, id, input)
          : await this.decideDataQuality(client, id, input);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async decideReconciliation(client: PoolClient, id: string, input: ReviewDecisionInput) {
    const locked = await client.query<{
      id: string;
      assertion_id: string;
      candidate_facility_id: string;
      state: 'PENDING' | 'APPROVED' | 'REJECTED';
      score: string;
      reasons: unknown[];
    }>(
      `SELECT id, assertion_id, candidate_facility_id, state, score::text, reasons
       FROM facility_reconciliation_reviews
       WHERE id = $1::uuid
       FOR UPDATE`,
      [id],
    );
    const review = locked.rows[0];
    if (!review) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Review not found' });
    this.requirePending(review.state);

    if (input.decision === 'APPROVE') {
      const candidate = await client.query('SELECT id FROM facilities WHERE id = $1 FOR UPDATE', [review.candidate_facility_id]);
      if (candidate.rowCount !== 1) throw new ConflictException({ code: 'CANDIDATE_MISSING', message: 'Candidate facility no longer exists' });

      await client.query(
        `UPDATE facility_source_assertions
         SET facility_id = $2, reconciliation_state = 'CANONICAL'
         WHERE id = $1`,
        [review.assertion_id, review.candidate_facility_id],
      );
      await client.query(
        `UPDATE facility_reconciliation_reviews
         SET state = CASE WHEN id = $2::uuid THEN 'APPROVED' ELSE 'REJECTED' END,
             resolved_at = now(),
             resolution_note = CASE
               WHEN id = $2::uuid THEN $3
               ELSE 'Automatically rejected after another candidate was approved'
             END
         WHERE assertion_id = $1 AND state = 'PENDING'`,
        [review.assertion_id, id, input.note],
      );
    } else {
      await client.query(
        `UPDATE facility_reconciliation_reviews
         SET state = 'REJECTED', resolved_at = now(), resolution_note = $2
         WHERE id = $1`,
        [id, input.note],
      );
    }

    await this.audit(client, 'RECONCILIATION', id, input, {
      assertionId: review.assertion_id,
      candidateFacilityId: review.candidate_facility_id,
      score: Number(review.score),
      reasons: review.reasons,
    });

    return { kind: 'RECONCILIATION' as const, id, state: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED' };
  }

  private async decideDataQuality(client: PoolClient, id: string, input: ReviewDecisionInput) {
    const locked = await client.query<{
      id: string;
      assertion_id: string;
      review_type: string;
      state: 'PENDING' | 'APPROVED' | 'REJECTED';
      details: Record<string, unknown>;
    }>(
      `SELECT id, assertion_id, review_type, state, details
       FROM facility_data_quality_reviews
       WHERE id = $1::uuid
       FOR UPDATE`,
      [id],
    );
    const review = locked.rows[0];
    if (!review) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Review not found' });
    this.requirePending(review.state);

    if (input.decision === 'APPROVE' && review.review_type === 'MISSING_TRUSTED_GEOMETRY') {
      if (!input.geometry) {
        throw new BadRequestException({ code: 'GEOMETRY_EVIDENCE_REQUIRED', message: 'Geometry approval requires lat, lon and sourceArtifactId' });
      }
      const evidence = await client.query<{ id: string }>(
        'SELECT id FROM source_artifacts WHERE id = $1::uuid',
        [input.geometry.sourceArtifactId],
      );
      if (!evidence.rows[0]) {
        throw new BadRequestException({ code: 'INVALID_GEOMETRY_EVIDENCE', message: 'Geometry evidence source artifact does not exist' });
      }
      await client.query(
        `UPDATE facility_source_assertions
         SET geom = ST_SetSRID(ST_MakePoint($2, $3), 4326),
             verification_status = 'VERIFIED',
             reconciliation_state = 'UNMATCHED'
         WHERE id = $1`,
        [review.assertion_id, input.geometry.lon, input.geometry.lat],
      );
      await client.query(
        `UPDATE facility_data_quality_reviews
         SET details = details || jsonb_build_object('geometryEvidenceArtifactId', $2::text),
             state = 'APPROVED', resolved_at = now(), resolution_note = $3
         WHERE id = $1`,
        [id, input.geometry.sourceArtifactId, input.note],
      );
    } else {
      await client.query(
        `UPDATE facility_data_quality_reviews
         SET state = $2, resolved_at = now(), resolution_note = $3
         WHERE id = $1`,
        [id, input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', input.note],
      );
    }

    await this.audit(client, 'DATA_QUALITY', id, input, {
      assertionId: review.assertion_id,
      reviewType: review.review_type,
      details: review.details,
      geometry: input.geometry,
    });

    return { kind: 'DATA_QUALITY' as const, id, state: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED' };
  }

  private requirePending(state: string): void {
    if (state !== 'PENDING') {
      throw new ConflictException({ code: 'REVIEW_ALREADY_RESOLVED', message: `Review is already ${state}` });
    }
  }

  private async audit(
    client: PoolClient,
    kind: ReviewKind,
    id: string,
    input: ReviewDecisionInput,
    snapshot: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO review_decision_audit (
         review_kind, review_id, actor, decision, note, snapshot
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb)`,
      [kind, id, input.actor, input.decision, input.note, JSON.stringify(snapshot)],
    );
  }

  async auditTrail(kind: ReviewKind | null, reviewId: string | null, limit: number) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (kind) conditions.push(`review_kind = $${params.push(kind)}`);
    if (reviewId) conditions.push(`review_id = $${params.push(reviewId)}::uuid`);
    params.push(limit);
    const result = await this.db.pool.query<{
      id: string;
      review_kind: ReviewKind;
      review_id: string;
      actor: string;
      decision: ReviewDecision;
      note: string | null;
      decided_at: Date;
      snapshot: Record<string, unknown>;
    }>(
      `SELECT id::text, review_kind, review_id, actor, decision, note, decided_at, snapshot
       FROM review_decision_audit
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY decided_at DESC, id DESC
       LIMIT $${params.length}`,
      params,
    );
    return {
      items: result.rows.map((row) => ({
        id: row.id,
        kind: row.review_kind,
        reviewId: row.review_id,
        actor: row.actor,
        decision: row.decision,
        note: row.note,
        decidedAt: row.decided_at.toISOString(),
        snapshot: row.snapshot,
      })),
    };
  }
}
