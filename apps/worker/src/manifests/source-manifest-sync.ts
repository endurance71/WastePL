import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  isManifestSourceActiveOn,
  validateSourceManifest,
  type ManifestDataType,
  type SourceManifest,
  type SourceManifestSource,
} from './source-manifest.js';

interface MunicipalityRow extends QueryResultRow {
  id: string;
  terc: string;
  name: string;
}

interface SourceIdentityRow extends QueryResultRow {
  id: string;
  source_key: string | null;
  source_url: string;
}

export interface ManifestSyncResult {
  manifestId: string;
  version: string;
  municipalityCount: number;
  sourceCount: number;
  activeCount: number;
  plannedCount: number;
}

export interface SourceCoverageRow {
  terc: string;
  municipalityName: string;
  dataType: ManifestDataType;
  activeEntries: number;
  plannedEntries: number;
  schedulableEntries: number;
}

export class ManifestMunicipalityMissingError extends Error {
  constructor(readonly missingTercs: string[]) {
    super(`Manifest references municipalities missing from official TERYT backbone: ${missingTercs.join(', ')}`);
    this.name = 'ManifestMunicipalityMissingError';
  }
}

export class ManifestSourceIdentityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestSourceIdentityConflictError';
  }
}

function asDbDate(value: string | null): string | null {
  return value;
}

export class PgSourceManifestSync {
  constructor(private readonly pool: Pool) {}

  async sync(manifestValue: unknown, asOf = new Date()): Promise<ManifestSyncResult> {
    validateSourceManifest(manifestValue);
    const manifest = manifestValue as SourceManifest;
    const municipalityRows = await this.pool.query<MunicipalityRow>(
      `SELECT id, terc, name
       FROM municipalities
       WHERE terc = ANY($1::text[])`,
      [manifest.municipalities.map((municipality) => municipality.terc)],
    );
    const municipalities = new Map(municipalityRows.rows.map((row) => [row.terc, row]));
    const missing = manifest.municipalities
      .map((municipality) => municipality.terc)
      .filter((terc) => !municipalities.has(terc));
    if (missing.length) throw new ManifestMunicipalityMissingError(missing);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let sourceCount = 0;
      let activeCount = 0;
      let plannedCount = 0;

      for (const municipality of manifest.municipalities) {
        const municipalityId = municipalities.get(municipality.terc)!.id;
        for (const source of municipality.sources) {
          await this.upsertSource(client, manifest, municipalityId, source, asOf);
          sourceCount += 1;
          if (source.status === 'ACTIVE') activeCount += 1;
          else plannedCount += 1;
        }
      }

      await client.query('COMMIT');
      return {
        manifestId: manifest.manifestId,
        version: manifest.version,
        municipalityCount: manifest.municipalities.length,
        sourceCount,
        activeCount,
        plannedCount,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertSource(
    client: PoolClient,
    manifest: SourceManifest,
    municipalityId: string,
    source: SourceManifestSource,
    asOf: Date,
  ): Promise<void> {
    const existing = await client.query<SourceIdentityRow>(
      `SELECT id, source_key, source_url
       FROM sources
       WHERE source_key = $1 OR source_url = $2
       ORDER BY CASE WHEN source_key = $1 THEN 0 ELSE 1 END, id`,
      [source.key, source.url],
    );

    const distinctIds = new Set(existing.rows.map((row) => row.id));
    if (distinctIds.size > 1) {
      throw new ManifestSourceIdentityConflictError(
        `Manifest source ${source.key} collides with separate registry rows for key and URL`,
      );
    }

    const active = isManifestSourceActiveOn(source, asOf);
    const bundle = source.bundle ?? null;
    const assessment = source.assessment ?? null;
    const values = [
      municipalityId,
      source.ownerType,
      source.ownerName,
      source.url,
      source.format,
      source.reuseNotes,
      source.parserKey,
      source.pollIntervalMinutes,
      active,
      source.key,
      source.dataType,
      source.status,
      `${manifest.manifestId}@${manifest.version}`,
      asDbDate(source.activeFrom),
      asDbDate(source.activeTo),
      bundle?.key ?? null,
      bundle?.role ?? null,
      bundle ? JSON.stringify(bundle.requiredRoles) : null,
      bundle?.freshnessMinutes ?? null,
      assessment?.shape ?? null,
      assessment?.evidenceStatus ?? null,
      assessment?.activationBlocker ?? null,
      assessment?.assessedAt ?? null,
      JSON.stringify(assessment?.childArtifactUrls ?? []),
    ];

    const current = existing.rows[0];
    if (!current) {
      await client.query(
        `INSERT INTO sources (
           municipality_id, owner_type, owner_name, source_url, source_format,
           reuse_basis, parser_key, poll_interval_minutes, active,
           source_key, data_type, manifest_status, manifest_version, active_from, active_to,
           bundle_key, bundle_role, bundle_required_roles, bundle_freshness_minutes,
           source_shape, evidence_status, activation_blocker, assessed_at, child_artifact_urls,
           next_check_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
           $16,$17,$18::jsonb,$19,$20,$21,$22,$23::timestamptz,$24::jsonb,
           CASE WHEN $9::boolean THEN now() ELSE NULL END
         )`,
        values,
      );
      return;
    }

    if (current.source_key && current.source_key !== source.key) {
      throw new ManifestSourceIdentityConflictError(
        `Manifest URL ${source.url} is already owned by source key ${current.source_key}`,
      );
    }

    await client.query(
      `UPDATE sources
       SET municipality_id = $1,
           owner_type = $2,
           owner_name = $3,
           source_url = $4,
           source_format = $5,
           reuse_basis = $6,
           parser_key = $7,
           poll_interval_minutes = $8,
           active = $9,
           source_key = $10,
           data_type = $11,
           manifest_status = $12,
           manifest_version = $13,
           active_from = $14,
           active_to = $15,
           bundle_key = $16,
           bundle_role = $17,
           bundle_required_roles = $18::jsonb,
           bundle_freshness_minutes = $19,
           source_shape = $20,
           evidence_status = $21,
           activation_blocker = $22,
           assessed_at = $23::timestamptz,
           child_artifact_urls = $24::jsonb,
           next_check_at = CASE
             WHEN $9::boolean AND active = false THEN now()
             WHEN $9::boolean THEN next_check_at
             ELSE NULL
           END
       WHERE id = $25`,
      [...values, current.id],
    );
  }

  async coverage(manifestId: string, version: string): Promise<SourceCoverageRow[]> {
    const result = await this.pool.query<{
      terc: string;
      municipality_name: string;
      data_type: ManifestDataType;
      active_entries: string;
      planned_entries: string;
      schedulable_entries: string;
    }>(
      `SELECT
         m.terc,
         m.name AS municipality_name,
         s.data_type,
         count(*) FILTER (WHERE s.manifest_status = 'ACTIVE')::text AS active_entries,
         count(*) FILTER (WHERE s.manifest_status = 'PLANNED')::text AS planned_entries,
         count(*) FILTER (WHERE s.active = true)::text AS schedulable_entries
       FROM sources s
       JOIN municipalities m ON m.id = s.municipality_id
       WHERE s.manifest_version = $1
         AND s.data_type IS NOT NULL
       GROUP BY m.terc, m.name, s.data_type
       ORDER BY m.terc, s.data_type`,
      [`${manifestId}@${version}`],
    );

    return result.rows.map((row) => ({
      terc: row.terc,
      municipalityName: row.municipality_name,
      dataType: row.data_type,
      activeEntries: Number(row.active_entries),
      plannedEntries: Number(row.planned_entries),
      schedulableEntries: Number(row.schedulable_entries),
    }));
  }
}
