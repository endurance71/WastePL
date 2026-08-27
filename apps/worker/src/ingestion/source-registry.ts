import type { Pool, QueryResultRow } from 'pg';
import type {
  ArtifactOutboxClaim,
  ArtifactOutboxRegistry,
  ArtifactParseUpdate,
  ClaimArtifactOutboxInput,
  ClaimDueSourcesInput,
  InsertSourceArtifactInput,
  InsertSourceArtifactResult,
  SourceArtifactRecord,
  SourceCheckUpdate,
  SourceFailureUpdate,
  SourceFetchAttemptInput,
  SourceHealthStatus,
  SourcePollClaim,
  SourceProcessingAttemptInput,
  SourceProcessingStateUpdate,
  SourceRecord,
  SourceRegistry,
  SourceSchedulerRegistry,
} from './types.js';

interface SourceRow extends QueryResultRow {
  id: string;
  source_url: string;
  source_format: string;
  parser_key: string | null;
  etag: string | null;
  last_modified: string | null;
  last_sha256: string | null;
  active: boolean;
  poll_interval_minutes: number;
  next_check_at: Date | null;
  health_status: SourceHealthStatus;
  consecutive_failures: number;
  poll_claim_token: string | null;
  poll_claim_expires_at: Date | null;
}

interface ArtifactRow extends QueryResultRow {
  id: string;
  source_id: string;
  sha256: string;
  storage_uri: string;
  retrieved_at: Date;
}

interface PollClaimRow extends QueryResultRow {
  source_id: string;
  claim_token: string;
  source_url: string;
  parser_key: string | null;
  claimed_at: Date;
  claim_expires_at: Date;
}

interface ArtifactOutboxClaimRow extends QueryResultRow {
  source_id: string;
  artifact_id: string;
  parser_key: string | null;
  claim_token: string;
  claim_expires_at: Date;
  enqueue_attempts: number;
}

const SOURCE_SELECT = `
  id, source_url, source_format, parser_key, etag, last_modified, last_sha256,
  active, poll_interval_minutes, next_check_at, health_status, consecutive_failures,
  poll_claim_token, poll_claim_expires_at
`;

function mapSource(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    sourceFormat: row.source_format,
    parserKey: row.parser_key,
    etag: row.etag,
    lastModified: row.last_modified,
    lastSha256: row.last_sha256,
    active: row.active,
    pollIntervalMinutes: Number(row.poll_interval_minutes),
    nextCheckAt: row.next_check_at,
    healthStatus: row.health_status,
    consecutiveFailures: Number(row.consecutive_failures),
    pollClaimToken: row.poll_claim_token,
    pollClaimExpiresAt: row.poll_claim_expires_at,
  };
}

function mapArtifact(row: ArtifactRow): SourceArtifactRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    sha256: row.sha256,
    storageUri: row.storage_uri,
    retrievedAt: row.retrieved_at,
  };
}

export class PgSourceRegistry
  implements SourceRegistry, SourceSchedulerRegistry, ArtifactOutboxRegistry
{
  constructor(private readonly pool: Pool) {}

  async getSourceById(sourceId: string): Promise<SourceRecord | null> {
    const result = await this.pool.query<SourceRow>(
      `SELECT ${SOURCE_SELECT}
       FROM sources
       WHERE id = $1`,
      [sourceId],
    );
    return result.rows[0] ? mapSource(result.rows[0]) : null;
  }

  async findArtifactByHash(sourceId: string, sha256: string): Promise<SourceArtifactRecord | null> {
    const result = await this.pool.query<ArtifactRow>(
      `SELECT id, source_id, sha256, storage_uri, retrieved_at
       FROM source_artifacts
       WHERE source_id = $1 AND sha256 = $2`,
      [sourceId, sha256],
    );
    return result.rows[0] ? mapArtifact(result.rows[0]) : null;
  }

  async insertArtifact(input: InsertSourceArtifactInput): Promise<InsertSourceArtifactResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<ArtifactRow>(
        `INSERT INTO source_artifacts (
           source_id, retrieved_at, sha256, storage_uri, parser_key, status
         ) VALUES ($1, $2, $3, $4, $5, 'FETCHED')
         ON CONFLICT (source_id, sha256) DO NOTHING
         RETURNING id, source_id, sha256, storage_uri, retrieved_at`,
        [input.sourceId, input.retrievedAt, input.sha256, input.storageUri, input.parserKey],
      );

      const insertedRow = inserted.rows[0];
      if (insertedRow) {
        const artifact = mapArtifact(insertedRow);
        await client.query(
          `INSERT INTO artifact_processing_outbox (artifact_id, source_id, parser_key)
           VALUES ($1, $2, $3)
           ON CONFLICT (artifact_id) DO NOTHING`,
          [artifact.id, input.sourceId, input.parserKey],
        );
        await client.query('COMMIT');
        return { artifact, created: true };
      }

      const existing = await client.query<ArtifactRow>(
        `SELECT id, source_id, sha256, storage_uri, retrieved_at
         FROM source_artifacts
         WHERE source_id = $1 AND sha256 = $2`,
        [input.sourceId, input.sha256],
      );
      const existingRow = existing.rows[0];
      if (!existingRow) {
        throw new Error('Artifact insert conflicted but existing artifact was not found');
      }
      await client.query('COMMIT');
      return { artifact: mapArtifact(existingRow), created: false };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markArtifactParsed(update: ArtifactParseUpdate): Promise<void> {
    if (update.extractionConfidence < 0 || update.extractionConfidence > 1) {
      throw new Error('extractionConfidence must be between 0 and 1');
    }

    const result = await this.pool.query(
      `UPDATE source_artifacts
       SET parser_key = $2,
           parser_version = $3,
           extraction_confidence = $4,
           status = $5,
           parse_report = $6::jsonb
       WHERE id = $1`,
      [
        update.artifactId,
        update.parserKey,
        update.parserVersion,
        update.extractionConfidence,
        update.status,
        JSON.stringify(update.parseReport),
      ],
    );

    if (result.rowCount !== 1) throw new Error(`Source artifact ${update.artifactId} not found`);
  }

  async markSourceChecked(sourceId: string, update: SourceCheckUpdate): Promise<void> {
    const healthStatus = update.healthStatus ?? (update.sha256 ? 'FETCHED' : 'UNCHANGED');
    const claimToken = update.claimToken ?? null;

    await this.pool.query(
      `UPDATE sources
       SET etag = $2,
           last_modified = $3,
           last_sha256 = COALESCE($4, last_sha256),
           last_checked_at = $5::timestamptz,
           next_check_at = $5::timestamptz + (poll_interval_minutes * interval '1 minute'),
           health_status = CASE
             WHEN $6 = 'UNCHANGED' AND health_status IN ('PARSE_FAILED','REVIEW_REQUIRED')
               THEN health_status
             ELSE $6
           END,
           consecutive_failures = CASE
             WHEN $6 = 'UNCHANGED' AND health_status IN ('PARSE_FAILED','REVIEW_REQUIRED')
               THEN consecutive_failures
             ELSE 0
           END,
           last_success_at = $5::timestamptz,
           last_error_code = CASE
             WHEN $6 = 'UNCHANGED' AND health_status IN ('PARSE_FAILED','REVIEW_REQUIRED')
               THEN last_error_code
             ELSE NULL
           END,
           last_error_message = CASE
             WHEN $6 = 'UNCHANGED' AND health_status IN ('PARSE_FAILED','REVIEW_REQUIRED')
               THEN last_error_message
             ELSE NULL
           END,
           poll_claim_token = CASE WHEN $7::uuid IS NULL THEN poll_claim_token ELSE NULL END,
           poll_claimed_at = CASE WHEN $7::uuid IS NULL THEN poll_claimed_at ELSE NULL END,
           poll_claim_expires_at = CASE WHEN $7::uuid IS NULL THEN poll_claim_expires_at ELSE NULL END
       WHERE id = $1
         AND ($7::uuid IS NULL OR poll_claim_token = $7::uuid)`,
      [
        sourceId,
        update.etag,
        update.lastModified,
        update.sha256,
        update.checkedAt,
        healthStatus,
        claimToken,
      ],
    );
  }

  async markSourceFailed(sourceId: string, update: SourceFailureUpdate): Promise<void> {
    const claimToken = update.claimToken ?? null;
    await this.pool.query(
      `UPDATE sources
       SET health_status = 'FETCH_FAILED',
           consecutive_failures = consecutive_failures + 1,
           last_failure_at = $2::timestamptz,
           last_error_code = $3,
           last_error_message = $4,
           next_check_at = CASE
             WHEN $5::boolean THEN
               $2::timestamptz + (
                 LEAST(360::numeric, 5::numeric * power(2::numeric, LEAST(consecutive_failures, 6)))
                 * interval '1 minute'
               )
             ELSE $2::timestamptz + (poll_interval_minutes * interval '1 minute')
           END,
           poll_claim_token = CASE WHEN $6::uuid IS NULL THEN poll_claim_token ELSE NULL END,
           poll_claimed_at = CASE WHEN $6::uuid IS NULL THEN poll_claimed_at ELSE NULL END,
           poll_claim_expires_at = CASE WHEN $6::uuid IS NULL THEN poll_claim_expires_at ELSE NULL END
       WHERE id = $1
         AND ($6::uuid IS NULL OR poll_claim_token = $6::uuid)`,
      [
        sourceId,
        update.failedAt,
        update.errorCode,
        update.errorMessage.slice(0, 4000),
        update.retryable,
        claimToken,
      ],
    );
  }

  async markSourceProcessingState(update: SourceProcessingStateUpdate): Promise<void> {
    const metadata = update.metadata ?? {};
    await this.recordProcessingAttempt({
      sourceId: update.sourceId,
      artifactId: update.artifactId,
      startedAt: update.completedAt,
      completedAt: update.completedAt,
      outcome: update.outcome,
      parserKey: update.parserKey,
      errorCode: update.errorCode,
      errorMessage: update.errorMessage,
      metadata,
    });

    if (update.outcome === 'PUBLISHED') {
      await this.pool.query(
        `UPDATE sources
         SET health_status = 'HEALTHY',
             consecutive_failures = 0,
             last_success_at = $2,
             last_error_code = NULL,
             last_error_message = NULL
         WHERE id = $1`,
        [update.sourceId, update.completedAt],
      );
      return;
    }

    if (update.outcome === 'REVIEW_REQUIRED') {
      await this.pool.query(
        `UPDATE sources
         SET health_status = 'REVIEW_REQUIRED',
             last_success_at = $2,
             last_error_code = NULL,
             last_error_message = NULL
         WHERE id = $1`,
        [update.sourceId, update.completedAt],
      );
      return;
    }

    await this.pool.query(
      `UPDATE sources
       SET health_status = 'PARSE_FAILED',
           consecutive_failures = consecutive_failures + 1,
           last_failure_at = $2,
           last_error_code = $3,
           last_error_message = $4
       WHERE id = $1`,
      [
        update.sourceId,
        update.completedAt,
        update.errorCode ?? 'PARSE_FAILED',
        (update.errorMessage ?? 'Artifact parsing failed').slice(0, 4000),
      ],
    );
  }

  async recordFetchAttempt(input: SourceFetchAttemptInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO source_fetch_attempts (
         source_id, started_at, completed_at, outcome, attempts, http_status,
         etag, last_modified, sha256, bytes_received, content_type,
         error_code, error_message, metadata
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14::jsonb
       )`,
      [
        input.sourceId,
        input.startedAt,
        input.completedAt,
        input.outcome,
        input.attempts,
        input.httpStatus,
        input.etag,
        input.lastModified,
        input.sha256,
        input.bytesReceived,
        input.contentType,
        input.errorCode,
        input.errorMessage,
        JSON.stringify(input.metadata),
      ],
    );
  }

  async recordProcessingAttempt(input: SourceProcessingAttemptInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO source_processing_attempts (
         source_id, artifact_id, started_at, completed_at, outcome,
         parser_key, error_code, error_message, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        input.sourceId,
        input.artifactId,
        input.startedAt,
        input.completedAt,
        input.outcome,
        input.parserKey,
        input.errorCode,
        input.errorMessage,
        JSON.stringify(input.metadata),
      ],
    );
  }

  async claimDueSources(input: ClaimDueSourcesInput): Promise<SourcePollClaim[]> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 1000) {
      throw new Error('claim limit must be an integer between 1 and 1000');
    }
    if (!Number.isFinite(input.leaseMs) || input.leaseMs < 1000) {
      throw new Error('leaseMs must be at least 1000');
    }

    const result = await this.pool.query<PollClaimRow>(
      `WITH due AS (
         SELECT id
         FROM sources
         WHERE active = true
           AND COALESCE(next_check_at, '-infinity'::timestamptz) <= $1::timestamptz
           AND (poll_claim_expires_at IS NULL OR poll_claim_expires_at <= $1::timestamptz)
         ORDER BY COALESCE(next_check_at, '-infinity'::timestamptz), id
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       ), claimed AS (
         UPDATE sources s
         SET poll_claim_token = gen_random_uuid(),
             poll_claimed_at = $1::timestamptz,
             poll_claim_expires_at = $1::timestamptz + ($3::double precision * interval '1 millisecond')
         FROM due
         WHERE s.id = due.id
         RETURNING
           s.id AS source_id,
           s.poll_claim_token AS claim_token,
           s.source_url,
           s.parser_key,
           s.poll_claimed_at AS claimed_at,
           s.poll_claim_expires_at AS claim_expires_at
       )
       SELECT * FROM claimed ORDER BY source_id`,
      [input.now, input.limit, input.leaseMs],
    );

    return result.rows.map((row) => ({
      sourceId: row.source_id,
      claimToken: row.claim_token,
      sourceUrl: row.source_url,
      parserKey: row.parser_key,
      claimedAt: row.claimed_at,
      claimExpiresAt: row.claim_expires_at,
    }));
  }

  async releasePollClaim(sourceId: string, claimToken: string, nextCheckAt: Date): Promise<void> {
    await this.pool.query(
      `UPDATE sources
       SET poll_claim_token = NULL,
           poll_claimed_at = NULL,
           poll_claim_expires_at = NULL,
           next_check_at = $3
       WHERE id = $1 AND poll_claim_token = $2::uuid`,
      [sourceId, claimToken, nextCheckAt],
    );
  }

  async claimPendingArtifactWork(input: ClaimArtifactOutboxInput): Promise<ArtifactOutboxClaim[]> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 1000) {
      throw new Error('outbox claim limit must be an integer between 1 and 1000');
    }
    if (!Number.isFinite(input.leaseMs) || input.leaseMs < 1000) {
      throw new Error('outbox leaseMs must be at least 1000');
    }

    const result = await this.pool.query<ArtifactOutboxClaimRow>(
      `WITH due AS (
         SELECT artifact_id
         FROM artifact_processing_outbox
         WHERE enqueued_at IS NULL
           AND next_attempt_at <= $1::timestamptz
           AND (claim_expires_at IS NULL OR claim_expires_at <= $1::timestamptz)
         ORDER BY next_attempt_at, artifact_id
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       ), claimed AS (
         UPDATE artifact_processing_outbox o
         SET claim_token = gen_random_uuid(),
             claim_expires_at = $1::timestamptz + ($3::double precision * interval '1 millisecond')
         FROM due
         WHERE o.artifact_id = due.artifact_id
         RETURNING
           o.source_id,
           o.artifact_id,
           o.parser_key,
           o.claim_token,
           o.claim_expires_at,
           o.enqueue_attempts
       )
       SELECT * FROM claimed ORDER BY artifact_id`,
      [input.now, input.limit, input.leaseMs],
    );

    return result.rows.map((row) => ({
      sourceId: row.source_id,
      artifactId: row.artifact_id,
      parserKey: row.parser_key,
      claimToken: row.claim_token,
      claimExpiresAt: row.claim_expires_at,
      enqueueAttempts: Number(row.enqueue_attempts),
    }));
  }

  async markArtifactWorkEnqueued(
    artifactId: string,
    claimToken: string,
    enqueuedAt: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE artifact_processing_outbox
       SET enqueued_at = $3,
           enqueue_attempts = enqueue_attempts + 1,
           claim_token = NULL,
           claim_expires_at = NULL,
           last_error = NULL
       WHERE artifact_id = $1 AND claim_token = $2::uuid`,
      [artifactId, claimToken, enqueuedAt],
    );
  }

  async releaseArtifactWorkClaim(
    artifactId: string,
    claimToken: string,
    nextAttemptAt: Date,
    errorMessage: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE artifact_processing_outbox
       SET enqueue_attempts = enqueue_attempts + 1,
           next_attempt_at = $3,
           claim_token = NULL,
           claim_expires_at = NULL,
           last_error = $4
       WHERE artifact_id = $1 AND claim_token = $2::uuid`,
      [artifactId, claimToken, nextAttemptAt, errorMessage.slice(0, 4000)],
    );
  }
}
