import { Inject, Injectable } from '@nestjs/common';
import type {
  DepositContainerClass,
  FacilityKind,
  FacilityMaterial,
} from '@wastepl/domain';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';

export interface FacilityBbox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface FacilityNear {
  lat: number;
  lon: number;
  radiusMeters: number;
}

export interface FacilitiesQuery {
  kind: FacilityKind | null;
  terc: string | null;
  material: FacilityMaterial | null;
  container: DepositContainerClass | null;
  bbox: FacilityBbox | null;
  near: FacilityNear | null;
  limit: number;
  offset: number;
}

export interface FacilitySourceRef {
  artifactId: string;
  url: string;
  format: string;
  retrievedAt: string;
  parserKey: string | null;
  parserVersion: string | null;
}

export interface FacilityApiItem {
  id: string;
  canonicalKey: string | null;
  kind: FacilityKind;
  name: string;
  address: string | null;
  location: { lat: number; lon: number } | null;
  distanceMeters: number | null;
  externalIds: unknown[];
  acceptedMaterials: FacilityMaterial[];
  acceptedContainers: DepositContainerClass[];
  openingHours: unknown | null;
  access: {
    scope: string;
    requiresProof: boolean | null;
    rules: Record<string, unknown>;
  };
  operationalStatus: {
    state: string;
    observedAt: string | null;
  };
  operatorName: string | null;
  rulesUrl: string | null;
  quality: {
    verificationStatus: string;
    confidence: number;
    retrievedAt: string;
    warnings: string[];
  };
  provenance: {
    primary: FacilitySourceRef;
    location: FacilitySourceRef | null;
    openingHours: FacilitySourceRef | null;
    access: FacilitySourceRef | null;
    operationalStatus: FacilitySourceRef | null;
  };
}

export interface FacilitiesResponse {
  items: FacilityApiItem[];
  page: {
    limit: number;
    offset: number;
    nextOffset: number | null;
  };
}

interface FacilityRow extends QueryResultRow {
  id: string;
  canonical_key: string | null;
  kind: FacilityKind;
  name: string;
  address_text: string | null;
  lat: number | null;
  lon: number | null;
  distance_m: number | null;
  external_ids: unknown[];
  accepted_materials: FacilityMaterial[];
  accepted_containers: DepositContainerClass[];
  opening_hours: unknown | null;
  access_scope: string;
  access_requires_proof: boolean | null;
  access_rules: Record<string, unknown>;
  operational_status: string;
  operational_status_observed_at: Date | null;
  operator_name: string | null;
  rules_url: string | null;
  verification_status: string;
  confidence: string | number;
  primary_artifact_id: string;
  primary_url: string;
  primary_format: string;
  primary_retrieved_at: Date;
  primary_parser_key: string | null;
  primary_parser_version: string | null;
  location_artifact_id: string | null;
  location_url: string | null;
  location_format: string | null;
  location_retrieved_at: Date | null;
  location_parser_key: string | null;
  location_parser_version: string | null;
  hours_artifact_id: string | null;
  hours_url: string | null;
  hours_format: string | null;
  hours_retrieved_at: Date | null;
  hours_parser_key: string | null;
  hours_parser_version: string | null;
  access_artifact_id: string | null;
  access_url: string | null;
  access_format: string | null;
  access_retrieved_at: Date | null;
  access_parser_key: string | null;
  access_parser_version: string | null;
  status_artifact_id: string | null;
  status_url: string | null;
  status_format: string | null;
  status_retrieved_at: Date | null;
  status_parser_key: string | null;
  status_parser_version: string | null;
}

function sourceRef(
  artifactId: string | null,
  url: string | null,
  format: string | null,
  retrievedAt: Date | null,
  parserKey: string | null,
  parserVersion: string | null,
): FacilitySourceRef | null {
  if (!artifactId || !url || !format || !retrievedAt) return null;
  return {
    artifactId,
    url,
    format,
    retrievedAt: retrievedAt.toISOString(),
    parserKey,
    parserVersion,
  };
}

@Injectable()
export class FacilitiesService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async list(query: FacilitiesQuery): Promise<FacilitiesResponse> {
    const params: unknown[] = [];
    const where: string[] = ['f.active = true', 'f.source_artifact_id IS NOT NULL'];
    const bind = (value: unknown): number => {
      params.push(value);
      return params.length;
    };

    if (query.kind) where.push(`f.kind = $${bind(query.kind)}`);
    if (query.terc) where.push(`m.terc = $${bind(query.terc)}`);
    if (query.material) where.push(`$${bind(query.material)} = ANY(f.accepted_materials)`);
    if (query.container) where.push(`$${bind(query.container)} = ANY(f.accepted_containers)`);

    let distanceExpression = 'NULL::double precision';
    let orderExpression = `COALESCE(f.canonical_key, f.id::text) ASC, f.id ASC`;

    if (query.bbox) {
      const minLon = bind(query.bbox.minLon);
      const minLat = bind(query.bbox.minLat);
      const maxLon = bind(query.bbox.maxLon);
      const maxLat = bind(query.bbox.maxLat);
      where.push('f.geom IS NOT NULL');
      where.push(`f.geom && ST_MakeEnvelope($${minLon}, $${minLat}, $${maxLon}, $${maxLat}, 4326)`);
    }

    if (query.near) {
      const lon = bind(query.near.lon);
      const lat = bind(query.near.lat);
      const radius = bind(query.near.radiusMeters);
      const point = `ST_SetSRID(ST_MakePoint($${lon}, $${lat}), 4326)::geography`;
      where.push('f.geom IS NOT NULL');
      where.push(`ST_DWithin(f.geom::geography, ${point}, $${radius})`);
      distanceExpression = `ST_Distance(f.geom::geography, ${point})`;
      orderExpression = `distance_m ASC, COALESCE(f.canonical_key, f.id::text) ASC, f.id ASC`;
    }

    const limitParam = bind(query.limit + 1);
    const offsetParam = bind(query.offset);

    const sql = `
      SELECT
        f.id,
        f.canonical_key,
        f.kind,
        f.name,
        f.address_text,
        CASE WHEN f.geom IS NULL THEN NULL ELSE ST_Y(f.geom) END AS lat,
        CASE WHEN f.geom IS NULL THEN NULL ELSE ST_X(f.geom) END AS lon,
        ${distanceExpression} AS distance_m,
        f.external_ids,
        f.accepted_materials,
        f.accepted_containers,
        f.opening_hours,
        f.access_scope,
        f.access_requires_proof,
        f.access_rules,
        f.operational_status,
        f.operational_status_observed_at,
        f.operator_name,
        f.rules_url,
        f.verification_status,
        f.confidence,
        pa.id AS primary_artifact_id,
        ps.source_url AS primary_url,
        ps.source_format AS primary_format,
        pa.retrieved_at AS primary_retrieved_at,
        pa.parser_key AS primary_parser_key,
        pa.parser_version AS primary_parser_version,
        la.id AS location_artifact_id,
        ls.source_url AS location_url,
        ls.source_format AS location_format,
        la.retrieved_at AS location_retrieved_at,
        la.parser_key AS location_parser_key,
        la.parser_version AS location_parser_version,
        ha.id AS hours_artifact_id,
        hs.source_url AS hours_url,
        hs.source_format AS hours_format,
        ha.retrieved_at AS hours_retrieved_at,
        ha.parser_key AS hours_parser_key,
        ha.parser_version AS hours_parser_version,
        aa.id AS access_artifact_id,
        a_s.source_url AS access_url,
        a_s.source_format AS access_format,
        aa.retrieved_at AS access_retrieved_at,
        aa.parser_key AS access_parser_key,
        aa.parser_version AS access_parser_version,
        oa.id AS status_artifact_id,
        os.source_url AS status_url,
        os.source_format AS status_format,
        oa.retrieved_at AS status_retrieved_at,
        oa.parser_key AS status_parser_key,
        oa.parser_version AS status_parser_version
      FROM facilities f
      LEFT JOIN municipalities m ON m.id = f.municipality_id
      JOIN source_artifacts pa ON pa.id = f.source_artifact_id
      JOIN sources ps ON ps.id = pa.source_id
      LEFT JOIN source_artifacts la ON la.id = f.location_source_artifact_id
      LEFT JOIN sources ls ON ls.id = la.source_id
      LEFT JOIN source_artifacts ha ON ha.id = f.hours_source_artifact_id
      LEFT JOIN sources hs ON hs.id = ha.source_id
      LEFT JOIN source_artifacts aa ON aa.id = f.access_source_artifact_id
      LEFT JOIN sources a_s ON a_s.id = aa.source_id
      LEFT JOIN source_artifacts oa ON oa.id = f.operational_status_source_artifact_id
      LEFT JOIN sources os ON os.id = oa.source_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderExpression}
      LIMIT $${limitParam}
      OFFSET $${offsetParam}`;

    const result = await this.db.pool.query<FacilityRow>(sql, params);
    const hasMore = result.rows.length > query.limit;
    const rows = hasMore ? result.rows.slice(0, query.limit) : result.rows;

    return {
      items: rows.map((row) => {
        const warnings: string[] = [];
        if (row.lat === null || row.lon === null) warnings.push('COORDINATES_UNKNOWN');
        if (row.opening_hours === null) warnings.push('OPENING_HOURS_UNKNOWN');

        return {
          id: row.id,
          canonicalKey: row.canonical_key,
          kind: row.kind,
          name: row.name,
          address: row.address_text,
          location: row.lat === null || row.lon === null ? null : { lat: Number(row.lat), lon: Number(row.lon) },
          distanceMeters: row.distance_m === null ? null : Number(row.distance_m),
          externalIds: row.external_ids ?? [],
          acceptedMaterials: row.accepted_materials ?? [],
          acceptedContainers: row.accepted_containers ?? [],
          openingHours: row.opening_hours,
          access: {
            scope: row.access_scope,
            requiresProof: row.access_requires_proof,
            rules: row.access_rules ?? {},
          },
          operationalStatus: {
            state: row.operational_status,
            observedAt: row.operational_status_observed_at?.toISOString() ?? null,
          },
          operatorName: row.operator_name,
          rulesUrl: row.rules_url,
          quality: {
            verificationStatus: row.verification_status,
            confidence: Number(row.confidence),
            retrievedAt: row.primary_retrieved_at.toISOString(),
            warnings,
          },
          provenance: {
            primary: sourceRef(
              row.primary_artifact_id,
              row.primary_url,
              row.primary_format,
              row.primary_retrieved_at,
              row.primary_parser_key,
              row.primary_parser_version,
            )!,
            location: sourceRef(row.location_artifact_id, row.location_url, row.location_format, row.location_retrieved_at, row.location_parser_key, row.location_parser_version),
            openingHours: sourceRef(row.hours_artifact_id, row.hours_url, row.hours_format, row.hours_retrieved_at, row.hours_parser_key, row.hours_parser_version),
            access: sourceRef(row.access_artifact_id, row.access_url, row.access_format, row.access_retrieved_at, row.access_parser_key, row.access_parser_version),
            operationalStatus: sourceRef(row.status_artifact_id, row.status_url, row.status_format, row.status_retrieved_at, row.status_parser_key, row.status_parser_version),
          },
        };
      }),
      page: {
        limit: query.limit,
        offset: query.offset,
        nextOffset: hasMore ? query.offset + query.limit : null,
      },
    };
  }
}
