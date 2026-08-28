import { Inject, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';

export type SourceDataType = 'COLLECTION_SCHEDULE' | 'PSZOK' | 'ALERTS' | 'OTHER';
export type SourceManifestStatus = 'ACTIVE' | 'PLANNED';
export type SourceHealthStatus =
  | 'UNKNOWN'
  | 'FETCHED'
  | 'HEALTHY'
  | 'UNCHANGED'
  | 'FETCH_FAILED'
  | 'PARSE_FAILED'
  | 'REVIEW_REQUIRED'
  | 'WAITING_FOR_COMPANION';

export interface SourceOpsFilters {
  terc: string | null;
  dataType: SourceDataType | null;
  manifestStatus: SourceManifestStatus | null;
  healthStatus: SourceHealthStatus | null;
  sourceKey: string | null;
  stale: boolean | null;
  limit: number;
  offset: number;
}

interface SourceOpsRow extends QueryResultRow {
  id: string;
  source_key: string | null;
  source_url: string;
  source_format: string;
  data_type: SourceDataType | null;
  manifest_status: SourceManifestStatus | null;
  manifest_version: string | null;
  active: boolean;
  owner_type: string;
  owner_name: string | null;
  parser_key: string | null;
  poll_interval_minutes: number;
  health_status: SourceHealthStatus;
  consecutive_failures: number;
  last_checked_at: Date | null;
  next_check_at: Date | null;
  last_success_at: Date | null;
  last_failure_at: Date | null;
  last_error_code: string | null;
  active_from: string | Date | null;
  active_to: string | Date | null;
  bundle_key: string | null;
  bundle_role: string | null;
  bundle_required_roles: string[] | null;
  bundle_freshness_minutes: number | null;
  source_shape: string | null;
  evidence_status: string | null;
  activation_blocker: string | null;
  assessed_at: Date | null;
  terc: string | null;
  municipality_name: string | null;
  stale: boolean;
  latest_artifact_id: string | null;
  latest_artifact_sha256: string | null;
  latest_artifact_status: string | null;
  latest_artifact_parser_key: string | null;
  latest_artifact_parser_version: string | null;
  latest_artifact_retrieved_at: Date | null;
  latest_artifact_published_at: Date | null;
  latest_processing_outcome: string | null;
  latest_processing_parser_key: string | null;
  latest_processing_error_code: string | null;
  latest_processing_completed_at: Date | null;
  total_count: string;
}

interface CoverageRow extends QueryResultRow {
  terc: string;
  municipality_name: string;
  data_type: SourceDataType;
  active_entries: string;
  planned_entries: string;
  schedulable_entries: string;
  healthy_entries: string;
  failing_entries: string;
  stale_entries: string;
}

interface SummaryRow extends QueryResultRow {
  total_sources: string;
  active_sources: string;
  planned_sources: string;
  healthy_sources: string;
  failing_sources: string;
  review_required_sources: string;
  waiting_sources: string;
  stale_sources: string;
}

interface QueueSummaryRow extends QueryResultRow {
  pending_outbox: string;
  enqueued_unprocessed: string;
}

interface ReviewSummaryRow extends QueryResultRow {
  reconciliation_pending: string;
  data_quality_pending: string;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function dbDate(value: string | Date | null): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return value.toISOString().slice(0, 10);
}

function mapSource(row: SourceOpsRow) {
  return {
    id: row.id,
    sourceKey: row.source_key,
    municipality: row.terc === null ? null : { terc: row.terc, name: row.municipality_name },
    dataType: row.data_type,
    manifest: {
      status: row.manifest_status,
      version: row.manifest_version,
      activeFrom: dbDate(row.active_from),
      activeTo: dbDate(row.active_to),
      schedulable: row.active,
    },
    source: {
      url: row.source_url,
      format: row.source_format,
      ownerType: row.owner_type,
      ownerName: row.owner_name,
      parserKey: row.parser_key,
      pollIntervalMinutes: row.poll_interval_minutes,
      assessment: {
        shape: row.source_shape,
        evidenceStatus: row.evidence_status,
        activationBlocker: row.activation_blocker,
        assessedAt: iso(row.assessed_at),
      },
      bundle: row.bundle_key === null
        ? null
        : {
            key: row.bundle_key,
            role: row.bundle_role,
            requiredRoles: row.bundle_required_roles ?? [],
            freshnessMinutes: row.bundle_freshness_minutes,
          },
    },
    health: {
      status: row.health_status,
      stale: row.stale,
      consecutiveFailures: row.consecutive_failures,
      lastCheckedAt: iso(row.last_checked_at),
      nextPollAt: iso(row.next_check_at),
      lastSuccessAt: iso(row.last_success_at),
      lastFailureAt: iso(row.last_failure_at),
      lastErrorCode: row.last_error_code,
    },
    latestArtifact: row.latest_artifact_id === null
      ? null
      : {
          id: row.latest_artifact_id,
          sha256: row.latest_artifact_sha256,
          status: row.latest_artifact_status,
          parserKey: row.latest_artifact_parser_key,
          parserVersion: row.latest_artifact_parser_version,
          retrievedAt: iso(row.latest_artifact_retrieved_at),
          publishedAt: iso(row.latest_artifact_published_at),
        },
    latestProcessing: row.latest_processing_outcome === null
      ? null
      : {
          outcome: row.latest_processing_outcome,
          parserKey: row.latest_processing_parser_key,
          errorCode: row.latest_processing_error_code,
          completedAt: iso(row.latest_processing_completed_at),
        },
  };
}

const STALE_SQL = `(s.active = true AND (
  s.last_checked_at IS NULL
  OR s.last_checked_at + (s.poll_interval_minutes * interval '1 minute') < now()
))`;

@Injectable()
export class InternalSourceOpsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async listSources(filters: SourceOpsFilters) {
    const params: unknown[] = [];
    const where: string[] = [];
    const add = (sql: string, value: unknown): void => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };

    if (filters.terc) add('m.terc = ?', filters.terc);
    if (filters.dataType) add('s.data_type = ?', filters.dataType);
    if (filters.manifestStatus) add('s.manifest_status = ?', filters.manifestStatus);
    if (filters.healthStatus) add('s.health_status = ?', filters.healthStatus);
    if (filters.sourceKey) add('s.source_key = ?', filters.sourceKey);
    if (filters.stale !== null) where.push(`${STALE_SQL} = ${filters.stale ? 'true' : 'false'}`);

    params.push(filters.limit, filters.offset);
    const result = await this.db.pool.query<SourceOpsRow>(
      `SELECT
         s.id, s.source_key, s.source_url, s.source_format, s.data_type,
         s.manifest_status, s.manifest_version, s.active, s.owner_type, s.owner_name,
         s.parser_key, s.poll_interval_minutes, s.health_status, s.consecutive_failures,
         s.last_checked_at, s.next_check_at, s.last_success_at, s.last_failure_at,
         s.last_error_code, s.active_from, s.active_to,
         s.bundle_key, s.bundle_role, s.bundle_required_roles, s.bundle_freshness_minutes,
         s.source_shape, s.evidence_status, s.activation_blocker, s.assessed_at,
         m.terc, m.name AS municipality_name,
         ${STALE_SQL} AS stale,
         artifact.id AS latest_artifact_id,
         artifact.sha256 AS latest_artifact_sha256,
         artifact.status AS latest_artifact_status,
         artifact.parser_key AS latest_artifact_parser_key,
         artifact.parser_version AS latest_artifact_parser_version,
         artifact.retrieved_at AS latest_artifact_retrieved_at,
         artifact.published_at AS latest_artifact_published_at,
         processing.outcome AS latest_processing_outcome,
         processing.parser_key AS latest_processing_parser_key,
         processing.error_code AS latest_processing_error_code,
         processing.completed_at AS latest_processing_completed_at,
         count(*) OVER()::text AS total_count
       FROM sources s
       LEFT JOIN municipalities m ON m.id = s.municipality_id
       LEFT JOIN LATERAL (
         SELECT a.id, a.sha256, a.status, a.parser_key, a.parser_version, a.retrieved_at, a.published_at
         FROM source_artifacts a
         WHERE a.source_id = s.id
         ORDER BY a.retrieved_at DESC, a.id DESC
         LIMIT 1
       ) artifact ON true
       LEFT JOIN LATERAL (
         SELECT p.outcome, p.parser_key, p.error_code, p.completed_at
         FROM source_processing_attempts p
         WHERE p.source_id = s.id
         ORDER BY p.completed_at DESC, p.id DESC
         LIMIT 1
       ) processing ON true
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY m.terc NULLS LAST, s.data_type NULLS LAST, s.source_key NULLS LAST, s.id
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      items: result.rows.map(mapSource),
      total: Number(result.rows[0]?.total_count ?? 0),
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async coverage(manifestVersion: string | null) {
    const params: unknown[] = [];
    let manifestWhere = `s.manifest_version IS NOT NULL`;
    if (manifestVersion) {
      params.push(manifestVersion);
      manifestWhere = `s.manifest_version = $1`;
    }

    const result = await this.db.pool.query<CoverageRow>(
      `SELECT
         m.terc,
         m.name AS municipality_name,
         s.data_type,
         count(*) FILTER (WHERE s.manifest_status = 'ACTIVE')::text AS active_entries,
         count(*) FILTER (WHERE s.manifest_status = 'PLANNED')::text AS planned_entries,
         count(*) FILTER (WHERE s.active = true)::text AS schedulable_entries,
         count(*) FILTER (WHERE s.active = true AND s.health_status IN ('HEALTHY','FETCHED','UNCHANGED'))::text AS healthy_entries,
         count(*) FILTER (WHERE s.active = true AND s.health_status IN ('FETCH_FAILED','PARSE_FAILED'))::text AS failing_entries,
         count(*) FILTER (WHERE ${STALE_SQL})::text AS stale_entries
       FROM sources s
       JOIN municipalities m ON m.id = s.municipality_id
       WHERE ${manifestWhere}
         AND s.data_type IS NOT NULL
       GROUP BY m.terc, m.name, s.data_type
       ORDER BY m.terc, s.data_type`,
      params,
    );

    const latestVersion = manifestVersion ?? await this.latestManifestVersion();
    return {
      manifestVersion: latestVersion,
      rows: result.rows.map((row) => ({
        terc: row.terc,
        municipalityName: row.municipality_name,
        dataType: row.data_type,
        activeEntries: Number(row.active_entries),
        plannedEntries: Number(row.planned_entries),
        schedulableEntries: Number(row.schedulable_entries),
        healthyEntries: Number(row.healthy_entries),
        failingEntries: Number(row.failing_entries),
        staleEntries: Number(row.stale_entries),
      })),
    };
  }

  async summary() {
    const [sources, queue, reviews] = await Promise.all([
      this.db.pool.query<SummaryRow>(
        `SELECT
           count(*)::text AS total_sources,
           count(*) FILTER (WHERE active = true)::text AS active_sources,
           count(*) FILTER (WHERE manifest_status = 'PLANNED')::text AS planned_sources,
           count(*) FILTER (WHERE active = true AND health_status IN ('HEALTHY','FETCHED','UNCHANGED'))::text AS healthy_sources,
           count(*) FILTER (WHERE active = true AND health_status IN ('FETCH_FAILED','PARSE_FAILED'))::text AS failing_sources,
           count(*) FILTER (WHERE active = true AND health_status = 'REVIEW_REQUIRED')::text AS review_required_sources,
           count(*) FILTER (WHERE active = true AND health_status = 'WAITING_FOR_COMPANION')::text AS waiting_sources,
           count(*) FILTER (WHERE ${STALE_SQL})::text AS stale_sources
         FROM sources s`,
      ),
      this.db.pool.query<QueueSummaryRow>(
        `SELECT
           count(*) FILTER (WHERE enqueued_at IS NULL)::text AS pending_outbox,
           count(*) FILTER (
             WHERE enqueued_at IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM source_processing_attempts p
                 WHERE p.artifact_id = artifact_processing_outbox.artifact_id
               )
           )::text AS enqueued_unprocessed
         FROM artifact_processing_outbox`,
      ),
      this.db.pool.query<ReviewSummaryRow>(
        `SELECT
           (SELECT count(*)::text FROM facility_reconciliation_reviews WHERE state = 'PENDING') AS reconciliation_pending,
           (SELECT count(*)::text FROM facility_data_quality_reviews WHERE state = 'PENDING') AS data_quality_pending`,
      ),
    ]);

    const source = sources.rows[0]!;
    const outbox = queue.rows[0]!;
    const review = reviews.rows[0]!;
    return {
      generatedAt: new Date().toISOString(),
      sources: {
        total: Number(source.total_sources),
        active: Number(source.active_sources),
        planned: Number(source.planned_sources),
        healthy: Number(source.healthy_sources),
        failing: Number(source.failing_sources),
        reviewRequired: Number(source.review_required_sources),
        waitingForCompanion: Number(source.waiting_sources),
        stale: Number(source.stale_sources),
      },
      processing: {
        pendingOutbox: Number(outbox.pending_outbox),
        enqueuedWithoutTerminalAttempt: Number(outbox.enqueued_unprocessed),
      },
      reviews: {
        reconciliationPending: Number(review.reconciliation_pending),
        dataQualityPending: Number(review.data_quality_pending),
      },
    };
  }

  private async latestManifestVersion(): Promise<string | null> {
    const result = await this.db.pool.query<{ manifest_version: string } & QueryResultRow>(
      `SELECT manifest_version
       FROM sources
       WHERE manifest_version IS NOT NULL
       ORDER BY assessed_at DESC NULLS LAST, manifest_version DESC
       LIMIT 1`,
    );
    return result.rows[0]?.manifest_version ?? null;
  }
}
