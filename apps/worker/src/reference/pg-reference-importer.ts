import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { streetDisplayName } from './teryt-xml.js';
import {
  municipalityTercCode,
  simcMunicipalityTerc,
  ulicMunicipalityTerc,
  type PrgAddressRow,
  type ReferenceImportMetadata,
  type ReferenceImportStats,
  type ReferenceRejectedRow,
  type SimcRow,
  type TercRow,
  type UlicRow,
} from './types.js';

interface IdRow extends QueryResultRow { id: string }
interface MunicipalityRow extends IdRow {
  terc: string;
  name: string;
  teryt_kind_code: string | null;
  teryt_kind_name: string | null;
  source_updated_at: string | Date | null;
  active: boolean;
}
interface LocalityRow extends IdRow {
  simc: string;
  municipality_id: string;
  name: string;
  locality_type_code: string | null;
  parent_simc: string | null;
  source_updated_at: string | Date | null;
  active: boolean;
}
interface StreetRow extends IdRow {
  locality_id: string;
  ulic: string | null;
  name: string;
  street_type: string | null;
  name_1: string | null;
  name_2: string | null;
  source_updated_at: string | Date | null;
  active: boolean;
}
interface AddressRow extends IdRow {
  prg_id: string | null;
  municipality_id: string;
  locality_id: string;
  street_id: string | null;
  building_number: string;
  postal_code: string | null;
  canonical_text: string;
  status: string | null;
  valid_from: string | Date | null;
  valid_to: string | Date | null;
  source_updated_at: string | Date | null;
  active: boolean;
  lon: number | null;
  lat: number | null;
}

interface MutableStats {
  inserted: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  rejectedRows: ReferenceRejectedRow[];
}

function isoDate(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isoDateTime(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function reject(stats: MutableStats, rowKey: string, reason: string, details?: Record<string, unknown>): void {
  stats.rejectedRows.push({ rowKey, reason, ...(details ? { details } : {}) });
}

function sameText(left: string | null, right: string | null): boolean {
  return (left ?? '') === (right ?? '');
}

export class PgOfficialReferenceImporter {
  constructor(private readonly pool: Pool) {}

  async importTerc(rows: Iterable<TercRow>, metadata: ReferenceImportMetadata): Promise<ReferenceImportStats> {
    return this.run(metadata, async (client, runId, stats) => {
      for (const row of rows) {
        const terc = municipalityTercCode(row);
        try {
          const existing = await client.query<MunicipalityRow>(
            `SELECT id, terc, name, teryt_kind_code, teryt_kind_name, source_updated_at, active
             FROM municipalities WHERE terc = $1`,
            [terc],
          );
          const current = existing.rows[0];
          if (!current) {
            await client.query(
              `INSERT INTO municipalities (
                 terc, name, teryt_kind_code, teryt_kind_name, active,
                 source_updated_at, last_seen_import_id
               ) VALUES ($1,$2,$3,$4,true,$5,$6)`,
              [terc, row.name, row.rodz, row.nameAdditional, row.stateDate, runId],
            );
            stats.inserted += 1;
            continue;
          }
          const changed = current.name !== row.name
            || current.teryt_kind_code !== row.rodz
            || current.teryt_kind_name !== row.nameAdditional
            || isoDate(current.source_updated_at) !== row.stateDate
            || !current.active;
          await client.query(
            `UPDATE municipalities SET
               name=$2, teryt_kind_code=$3, teryt_kind_name=$4, active=true,
               source_updated_at=$5, last_seen_import_id=$6, updated_at=now()
             WHERE id=$1`,
            [current.id, row.name, row.rodz, row.nameAdditional, row.stateDate, runId],
          );
          changed ? stats.updated += 1 : stats.unchanged += 1;
        } catch (error) {
          reject(stats, terc, error instanceof Error ? error.message : String(error));
        }
      }
    });
  }

  async importSimc(rows: Iterable<SimcRow>, metadata: ReferenceImportMetadata): Promise<ReferenceImportStats> {
    return this.run(metadata, async (client, runId, stats) => {
      for (const row of rows) {
        try {
          const terc = simcMunicipalityTerc(row);
          const municipality = await client.query<IdRow>('SELECT id FROM municipalities WHERE terc=$1 AND active=true', [terc]);
          const municipalityId = municipality.rows[0]?.id;
          if (!municipalityId) {
            reject(stats, row.simc, `SIMC references missing municipality ${terc}`);
            continue;
          }
          const existing = await client.query<LocalityRow>(
            `SELECT id, simc, municipality_id, name, locality_type_code, parent_simc, source_updated_at, active
             FROM localities WHERE simc=$1`,
            [row.simc],
          );
          const current = existing.rows[0];
          if (!current) {
            await client.query(
              `INSERT INTO localities (
                 simc, municipality_id, name, locality_type_code, parent_simc,
                 active, source_updated_at, last_seen_import_id
               ) VALUES ($1,$2,$3,$4,$5,true,$6,$7)`,
              [row.simc, municipalityId, row.name, row.localityTypeCode, row.parentSimc, row.stateDate, runId],
            );
            stats.inserted += 1;
            continue;
          }
          const changed = current.municipality_id !== municipalityId
            || current.name !== row.name
            || current.locality_type_code !== row.localityTypeCode
            || !sameText(current.parent_simc, row.parentSimc)
            || isoDate(current.source_updated_at) !== row.stateDate
            || !current.active;
          await client.query(
            `UPDATE localities SET
               municipality_id=$2, name=$3, locality_type_code=$4, parent_simc=$5,
               active=true, source_updated_at=$6, last_seen_import_id=$7, updated_at=now()
             WHERE id=$1`,
            [current.id, municipalityId, row.name, row.localityTypeCode, row.parentSimc, row.stateDate, runId],
          );
          changed ? stats.updated += 1 : stats.unchanged += 1;
        } catch (error) {
          reject(stats, row.simc, error instanceof Error ? error.message : String(error));
        }
      }
    });
  }

  async importUlic(rows: Iterable<UlicRow>, metadata: ReferenceImportMetadata): Promise<ReferenceImportStats> {
    return this.run(metadata, async (client, runId, stats) => {
      for (const row of rows) {
        const displayName = streetDisplayName(row);
        try {
          const terc = ulicMunicipalityTerc(row);
          const locality = await client.query<IdRow>(
            `SELECT l.id FROM localities l
             JOIN municipalities m ON m.id=l.municipality_id
             WHERE l.simc=$1 AND m.terc=$2 AND l.active=true AND m.active=true`,
            [row.simc, terc],
          );
          const localityId = locality.rows[0]?.id;
          if (!localityId) {
            reject(stats, `${row.simc}:${row.ulic}`, `ULIC references missing SIMC ${row.simc} in municipality ${terc}`);
            continue;
          }

          const official = await client.query<StreetRow>(
            `SELECT id, locality_id, ulic, name, street_type, name_1, name_2, source_updated_at, active
             FROM streets WHERE locality_id=$1 AND ulic=$2`,
            [localityId, row.ulic],
          );
          let current = official.rows[0];

          if (!current) {
            const legacy = await client.query<StreetRow>(
              `SELECT id, locality_id, ulic, name, street_type, name_1, name_2, source_updated_at, active
               FROM streets
               WHERE locality_id=$1 AND ulic IS NULL AND lower(name)=lower($2)
               ORDER BY id`,
              [localityId, displayName],
            );
            if (legacy.rows.length > 1) {
              reject(stats, `${row.simc}:${row.ulic}`, `Ambiguous legacy street match for ${displayName}`, { candidateIds: legacy.rows.map((item) => item.id) });
              continue;
            }
            current = legacy.rows[0];
          }

          if (!current) {
            await client.query(
              `INSERT INTO streets (
                 ulic, locality_id, name, street_type, name_1, name_2,
                 active, source_updated_at, last_seen_import_id
               ) VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8)`,
              [row.ulic, localityId, displayName, row.streetType, row.name1, row.name2, row.stateDate, runId],
            );
            stats.inserted += 1;
            continue;
          }

          const changed = current.ulic !== row.ulic
            || current.name !== displayName
            || current.street_type !== row.streetType
            || current.name_1 !== row.name1
            || (current.name_2 ?? '') !== row.name2
            || isoDate(current.source_updated_at) !== row.stateDate
            || !current.active;
          await client.query(
            `UPDATE streets SET
               ulic=$2, name=$3, street_type=$4, name_1=$5, name_2=$6,
               active=true, source_updated_at=$7, last_seen_import_id=$8, updated_at=now()
             WHERE id=$1`,
            [current.id, row.ulic, displayName, row.streetType, row.name1, row.name2, row.stateDate, runId],
          );
          changed ? stats.updated += 1 : stats.unchanged += 1;
        } catch (error) {
          reject(stats, `${row.simc}:${row.ulic}`, error instanceof Error ? error.message : String(error));
        }
      }
    });
  }

  async importPrgAddresses(rows: Iterable<PrgAddressRow>, metadata: ReferenceImportMetadata): Promise<ReferenceImportStats> {
    if (metadata.fullSnapshot && !metadata.scopeKey) {
      throw new Error('PRG fullSnapshot requires scopeKey municipality TERC');
    }
    return this.run(metadata, async (client, runId, stats) => {
      for (const row of rows) await this.importPrgRow(client, runId, stats, row);

      if (metadata.fullSnapshot && metadata.scopeKey) {
        const deactivated = await client.query(
          `UPDATE addresses a SET active=false, updated_at=now()
           FROM municipalities m
           WHERE a.municipality_id=m.id
             AND m.terc=$1
             AND a.prg_id IS NOT NULL
             AND a.active=true
             AND a.last_seen_import_id IS DISTINCT FROM $2
           RETURNING a.id`,
          [metadata.scopeKey, runId],
        );
        stats.deactivated += deactivated.rowCount ?? 0;
      }
    });
  }

  private async importPrgRow(
    client: PoolClient,
    runId: string,
    stats: MutableStats,
    row: PrgAddressRow,
  ): Promise<void> {
    try {
      const municipality = await client.query<IdRow>('SELECT id FROM municipalities WHERE terc=$1 AND active=true', [row.municipalityTerc]);
      const municipalityId = municipality.rows[0]?.id;
      if (!municipalityId) {
        reject(stats, row.prgId, `PRG references missing municipality ${row.municipalityTerc}`);
        return;
      }
      const locality = await client.query<{ id: string; name: string } & QueryResultRow>(
        `SELECT id, name FROM localities WHERE simc=$1 AND municipality_id=$2 AND active=true`,
        [row.simc, municipalityId],
      );
      const localityRow = locality.rows[0];
      if (!localityRow) {
        reject(stats, row.prgId, `PRG references missing SIMC ${row.simc}`);
        return;
      }

      let streetId: string | null = null;
      let streetName: string | null = null;
      if (row.ulic) {
        const street = await client.query<{ id: string; name: string } & QueryResultRow>(
          `SELECT id, name FROM streets WHERE locality_id=$1 AND ulic=$2 AND active=true`,
          [localityRow.id, row.ulic],
        );
        const streetRow = street.rows[0];
        if (!streetRow) {
          reject(stats, row.prgId, `PRG references missing ULIC ${row.ulic} for SIMC ${row.simc}`);
          return;
        }
        streetId = streetRow.id;
        streetName = streetRow.name;
      }

      const geometry = await this.normalizeGeometry(client, row);
      if (!geometry) {
        reject(stats, row.prgId, `PRG geometry is outside EPSG:4326 bounds after transform`, { crs: row.crs, x: row.x, y: row.y });
        return;
      }
      const canonicalText = this.canonicalAddress(localityRow.name, streetName, row.buildingNumber, row.postalCode);

      const byOfficialId = await client.query<AddressRow>(
        `SELECT a.id, a.prg_id, a.municipality_id, a.locality_id, a.street_id,
                a.building_number, a.postal_code, a.canonical_text, a.status,
                a.valid_from, a.valid_to, a.source_updated_at, a.active,
                CASE WHEN a.geom IS NULL THEN NULL ELSE ST_X(a.geom) END AS lon,
                CASE WHEN a.geom IS NULL THEN NULL ELSE ST_Y(a.geom) END AS lat
         FROM addresses a WHERE a.prg_id=$1`,
        [row.prgId],
      );
      let current = byOfficialId.rows[0];

      if (!current) {
        const legacy = await client.query<AddressRow>(
          `SELECT a.id, a.prg_id, a.municipality_id, a.locality_id, a.street_id,
                  a.building_number, a.postal_code, a.canonical_text, a.status,
                  a.valid_from, a.valid_to, a.source_updated_at, a.active,
                  CASE WHEN a.geom IS NULL THEN NULL ELSE ST_X(a.geom) END AS lon,
                  CASE WHEN a.geom IS NULL THEN NULL ELSE ST_Y(a.geom) END AS lat
           FROM addresses a
           WHERE a.prg_id IS NULL
             AND a.municipality_id=$1
             AND a.locality_id=$2
             AND a.street_id IS NOT DISTINCT FROM $3::uuid
             AND upper(a.building_number)=upper($4)
           ORDER BY a.id`,
          [municipalityId, localityRow.id, streetId, row.buildingNumber],
        );
        if (legacy.rows.length > 1) {
          reject(stats, row.prgId, 'Ambiguous legacy address match', { candidateIds: legacy.rows.map((item) => item.id) });
          return;
        }
        current = legacy.rows[0];
      }

      if (!current) {
        await client.query(
          `INSERT INTO addresses (
             prg_id, municipality_id, locality_id, street_id, building_number,
             postal_code, canonical_text, geom, source_updated_at, status,
             active, valid_from, valid_to, last_seen_import_id
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_MakePoint($8,$9),4326),$10,$11,
             true,$12,$13,$14
           )`,
          [row.prgId, municipalityId, localityRow.id, streetId, row.buildingNumber, row.postalCode,
            canonicalText, geometry.lon, geometry.lat, row.sourceUpdatedAt, row.status,
            row.validFrom, row.validTo, runId],
        );
        stats.inserted += 1;
        return;
      }

      const changed = current.prg_id !== row.prgId
        || current.municipality_id !== municipalityId
        || current.locality_id !== localityRow.id
        || current.street_id !== streetId
        || current.building_number !== row.buildingNumber
        || !sameText(current.postal_code, row.postalCode)
        || current.canonical_text !== canonicalText
        || !sameText(current.status, row.status)
        || isoDate(current.valid_from) !== row.validFrom
        || isoDate(current.valid_to) !== row.validTo
        || isoDateTime(current.source_updated_at) !== (row.sourceUpdatedAt ? new Date(row.sourceUpdatedAt).toISOString() : null)
        || current.lon === null || current.lat === null
        || Math.abs(Number(current.lon) - geometry.lon) > 1e-8
        || Math.abs(Number(current.lat) - geometry.lat) > 1e-8
        || !current.active;

      await client.query(
        `UPDATE addresses SET
           prg_id=$2, municipality_id=$3, locality_id=$4, street_id=$5,
           building_number=$6, postal_code=$7, canonical_text=$8,
           geom=ST_SetSRID(ST_MakePoint($9,$10),4326), source_updated_at=$11,
           status=$12, active=true, valid_from=$13, valid_to=$14,
           last_seen_import_id=$15, updated_at=now()
         WHERE id=$1`,
        [current.id, row.prgId, municipalityId, localityRow.id, streetId, row.buildingNumber,
          row.postalCode, canonicalText, geometry.lon, geometry.lat, row.sourceUpdatedAt,
          row.status, row.validFrom, row.validTo, runId],
      );
      changed ? stats.updated += 1 : stats.unchanged += 1;
    } catch (error) {
      reject(stats, row.prgId, error instanceof Error ? error.message : String(error));
    }
  }

  private async normalizeGeometry(client: PoolClient, row: PrgAddressRow): Promise<{ lon: number; lat: number } | null> {
    if (row.crs === 'EPSG:4326' && (row.x < -180 || row.x > 180 || row.y < -90 || row.y > 90)) return null;
    const srid = row.crs === 'EPSG:4326' ? 4326 : 2180;
    const result = await client.query<{ lon: number; lat: number } & QueryResultRow>(
      `SELECT ST_X(g)::double precision AS lon, ST_Y(g)::double precision AS lat
       FROM (
         SELECT ST_Transform(ST_SetSRID(ST_MakePoint($1,$2),$3),4326) AS g
       ) transformed`,
      [row.x, row.y, srid],
    );
    const point = result.rows[0];
    if (!point || !Number.isFinite(Number(point.lon)) || !Number.isFinite(Number(point.lat))) return null;
    const lon = Number(point.lon);
    const lat = Number(point.lat);
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    return { lon, lat };
  }

  private canonicalAddress(localityName: string, streetName: string | null, building: string, postal: string | null): string {
    const addressPart = streetName ? `${streetName} ${building}` : `${localityName} ${building}`;
    return postal ? `${addressPart}, ${postal} ${localityName}` : `${addressPart}, ${localityName}`;
  }

  private async run(
    metadata: ReferenceImportMetadata,
    operation: (client: PoolClient, runId: string, stats: MutableStats) => Promise<void>,
  ): Promise<ReferenceImportStats> {
    const run = await this.pool.query<{ id: string } & QueryResultRow>(
      `INSERT INTO reference_import_runs (
         dataset, source_version, source_uri, source_sha256, scope_key, full_snapshot, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
      [metadata.dataset, metadata.sourceVersion, metadata.sourceUri ?? null, metadata.sourceSha256 ?? null,
        metadata.scopeKey ?? null, metadata.fullSnapshot ?? false, JSON.stringify(metadata.metadata ?? {})],
    );
    const runId = run.rows[0]!.id;
    const stats: MutableStats = { inserted: 0, updated: 0, unchanged: 0, deactivated: 0, rejectedRows: [] };
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await operation(client, runId, stats);
      await client.query('COMMIT');
      await this.completeRun(runId, 'COMPLETED', stats);
      return {
        runId,
        inserted: stats.inserted,
        updated: stats.updated,
        unchanged: stats.unchanged,
        deactivated: stats.deactivated,
        rejected: stats.rejectedRows.length,
        rejectedRows: stats.rejectedRows,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      reject(stats, 'IMPORT', error instanceof Error ? error.message : String(error));
      await this.completeRun(runId, 'FAILED', stats);
      throw error;
    } finally {
      client.release();
    }
  }

  private async completeRun(runId: string, status: 'COMPLETED' | 'FAILED', stats: MutableStats): Promise<void> {
    await this.pool.query(
      `UPDATE reference_import_runs SET
         completed_at=now(), status=$2,
         inserted_count=$3, updated_count=$4, unchanged_count=$5,
         deactivated_count=$6, rejected_count=$7, rejected_rows=$8::jsonb
       WHERE id=$1`,
      [runId, status, stats.inserted, stats.updated, stats.unchanged, stats.deactivated,
        stats.rejectedRows.length, JSON.stringify(stats.rejectedRows)],
    );
  }
}
