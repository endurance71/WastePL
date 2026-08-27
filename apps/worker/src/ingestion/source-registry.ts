import type { Pool, QueryResultRow } from 'pg';
import type {
  ArtifactParseUpdate,
  InsertSourceArtifactInput,
  SourceArtifactRecord,
  SourceCheckUpdate,
  SourceFetchAttemptInput,
  SourceRecord,
  SourceRegistry,
} from './types.js';

interface SourceRow extends QueryResultRow {
  id: string;
  source_url: string;
  source_format: string;
  parser_key: string | null;
  etag: string | null;
  last_modified: string | null;
  active: boolean;
}

interface ArtifactRow extends QueryResultRow {
  id: string;
  source_id: string;
  sha256: string;
  storage_uri: string;
  retrieved_at: Date;
}

function mapSource(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    sourceFormat: row.source_format,
    parserKey: row.parser_key,
    etag: row.etag,
    lastModified: row.last_modified,
    active: row.active,
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

export class PgSourceRegistry implements SourceRegistry {
  constructor(private readonly pool: Pool) {}

  async getSourceById(sourceId: string): Promise<SourceRecord | null> {
    const result = await this.pool.query<SourceRow>(
      `SELECT id, source_url, source_format, parser_key, etag, last_modified, active
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

  async insertArtifact(input: InsertSourceArtifactInput): Promise<SourceArtifactRecord> {
    const inserted = await this.pool.query<ArtifactRow>(
      `INSERT INTO source_artifacts (
         source_id, retrieved_at, sha256, storage_uri, parser_key, status
       ) VALUES ($1, $2, $3, $4, $5, 'FETCHED')
       ON CONFLICT (source_id, sha256) DO NOTHING
       RETURNING id, source_id, sha256, storage_uri, retrieved_at`,
      [input.sourceId, input.retrievedAt, input.sha256, input.storageUri, input.parserKey],
    );

    if (inserted.rows[0]) return mapArtifact(inserted.rows[0]);

    const existing = await this.findArtifactByHash(input.sourceId, input.sha256);
    if (!existing) throw new Error('Artifact insert conflicted but existing artifact was not found');
    return existing;
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
    await this.pool.query(
      `UPDATE sources
       SET etag = $2,
           last_modified = $3,
           last_sha256 = COALESCE($4, last_sha256),
           last_checked_at = $5::timestamptz,
           next_check_at = $5::timestamptz + (poll_interval_minutes * interval '1 minute')
       WHERE id = $1`,
      [sourceId, update.etag, update.lastModified, update.sha256, update.checkedAt],
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
}
