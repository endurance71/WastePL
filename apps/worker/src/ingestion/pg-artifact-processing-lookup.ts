import type { Pool, QueryResultRow } from 'pg';
import type { ArtifactProcessingLookup, ArtifactProcessingRecord } from './types.js';

interface ArtifactProcessingRow extends QueryResultRow {
  id: string;
  source_id: string;
  sha256: string;
  storage_uri: string;
  retrieved_at: Date;
  parser_key: string | null;
  status: string;
}

export class PgArtifactProcessingLookup implements ArtifactProcessingLookup {
  constructor(private readonly pool: Pool) {}

  async getArtifactForProcessing(artifactId: string): Promise<ArtifactProcessingRecord | null> {
    const result = await this.pool.query<ArtifactProcessingRow>(
      `SELECT id, source_id, sha256, storage_uri, retrieved_at, parser_key, status
       FROM source_artifacts
       WHERE id = $1`,
      [artifactId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      sourceId: row.source_id,
      sha256: row.sha256,
      storageUri: row.storage_uri,
      retrievedAt: row.retrieved_at,
      parserKey: row.parser_key,
      status: row.status,
    };
  }
}
