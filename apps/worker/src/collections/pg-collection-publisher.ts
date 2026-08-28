import { createHash } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  CoverageRule,
  NormalizedCollectionEvent,
  NormalizedDataset,
  NormalizedServiceArea,
} from '../adapters/pdf-text/types.js';

interface IdRow extends QueryResultRow { id: string }
interface SourceRow extends QueryResultRow {
  id: string;
  municipality_id: string | null;
  terc: string | null;
  source_key: string | null;
  source_url: string;
}
interface ArtifactRow extends QueryResultRow {
  id: string;
  source_id: string;
  sha256: string;
  parser_key: string | null;
  parser_version: string | null;
  status: string;
}
interface AreaRow extends QueryResultRow {
  id: string;
  external_key: string;
  source_id: string | null;
}
interface EventLogicalRow extends QueryResultRow {
  external_key: string;
  fraction_code: string;
  collection_date: string;
  status: string;
  note: string | null;
}
interface PublicationRow extends QueryResultRow {
  service_areas_added: number;
  service_areas_removed: number;
  service_areas_unchanged: number;
  events_added: number;
  events_removed: number;
  events_unchanged: number;
}
interface TimestampRow extends QueryResultRow {
  publication_time: Date;
}

export interface CollectionPublicationDiff {
  serviceAreasAdded: number;
  serviceAreasRemoved: number;
  serviceAreasUnchanged: number;
  eventsAdded: number;
  eventsRemoved: number;
  eventsUnchanged: number;
  replayed: boolean;
}

export class CollectionPublicationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'SOURCE_NOT_FOUND'
      | 'SOURCE_MUNICIPALITY_MISMATCH'
      | 'ARTIFACT_NOT_FOUND'
      | 'ARTIFACT_SOURCE_MISMATCH'
      | 'ARTIFACT_DATASET_MISMATCH'
      | 'SERVICE_AREA_OWNERSHIP_CONFLICT'
      | 'UNSUPPORTED_COVERAGE_RULE'
      | 'LOCALITY_NOT_FOUND'
      | 'ADDRESS_NOT_FOUND'
      | 'ADDRESS_AMBIGUOUS'
      | 'EVENT_SERVICE_AREA_MISSING',
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'CollectionPublicationError';
  }
}

function normalizedLabel(value: string): string {
  return value
    .split(',')[0]!
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pl-PL');
}

function eventKey(
  event: Pick<NormalizedCollectionEvent, 'serviceAreaKey' | 'fraction' | 'date' | 'status' | 'note'>,
): string {
  return [event.serviceAreaKey, event.fraction, event.date, event.status, event.note ?? ''].join('|');
}

function rowEventKey(row: EventLogicalRow): string {
  return [row.external_key, row.fraction_code, row.collection_date, row.status, row.note ?? ''].join('|');
}

function countDiff(
  oldValues: Set<string>,
  newValues: Set<string>,
): { added: number; removed: number; unchanged: number } {
  let unchanged = 0;
  for (const value of newValues) if (oldValues.has(value)) unchanged += 1;
  return {
    added: newValues.size - unchanged,
    removed: oldValues.size - unchanged,
    unchanged,
  };
}

function fingerprint(areaKey: string, event: NormalizedCollectionEvent): string {
  return createHash('sha256')
    .update([areaKey, event.fraction, event.date, event.status, event.note ?? ''].join('|'))
    .digest('hex');
}

function mapPublication(row: PublicationRow, replayed: boolean): CollectionPublicationDiff {
  return {
    serviceAreasAdded: Number(row.service_areas_added),
    serviceAreasRemoved: Number(row.service_areas_removed),
    serviceAreasUnchanged: Number(row.service_areas_unchanged),
    eventsAdded: Number(row.events_added),
    eventsRemoved: Number(row.events_removed),
    eventsUnchanged: Number(row.events_unchanged),
    replayed,
  };
}

export class PgCollectionPublisher {
  constructor(private readonly pool: Pool) {}

  async publish(
    sourceId: string,
    artifactId: string,
    dataset: NormalizedDataset,
  ): Promise<CollectionPublicationDiff> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.publishWithClient(client, sourceId, artifactId, dataset);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async publishWithClient(
    client: PoolClient,
    sourceId: string,
    artifactId: string,
    dataset: NormalizedDataset,
  ): Promise<CollectionPublicationDiff> {
    const replay = await client.query<PublicationRow>(
      `SELECT service_areas_added, service_areas_removed, service_areas_unchanged,
              events_added, events_removed, events_unchanged
       FROM collection_publications
       WHERE source_artifact_id = $1`,
      [artifactId],
    );
    if (replay.rows[0]) return mapPublication(replay.rows[0], true);

    const sourceResult = await client.query<SourceRow>(
      `SELECT s.id, s.municipality_id, m.terc, s.source_key, s.source_url
       FROM sources s
       LEFT JOIN municipalities m ON m.id = s.municipality_id
       WHERE s.id = $1
       FOR UPDATE OF s`,
      [sourceId],
    );
    const source = sourceResult.rows[0];
    if (!source) {
      throw new CollectionPublicationError(`Source ${sourceId} not found`, 'SOURCE_NOT_FOUND');
    }
    if (!source.municipality_id || source.terc !== dataset.municipality.terc) {
      throw new CollectionPublicationError(
        'Normalized municipality does not match persisted source municipality',
        'SOURCE_MUNICIPALITY_MISMATCH',
        { persistedTerc: source.terc, datasetTerc: dataset.municipality.terc },
      );
    }

    const artifactResult = await client.query<ArtifactRow>(
      `SELECT id, source_id, sha256, parser_key, parser_version, status
       FROM source_artifacts
       WHERE id = $1
       FOR UPDATE`,
      [artifactId],
    );
    const artifact = artifactResult.rows[0];
    if (!artifact) {
      throw new CollectionPublicationError(`Artifact ${artifactId} not found`, 'ARTIFACT_NOT_FOUND');
    }
    if (artifact.source_id !== sourceId) {
      throw new CollectionPublicationError('Artifact belongs to another source', 'ARTIFACT_SOURCE_MISMATCH');
    }

    const normalizedSource = dataset.sources[0];
    if (
      !normalizedSource ||
      normalizedSource.artifact.sha256 !== artifact.sha256 ||
      normalizedSource.artifact.parserKey !== artifact.parser_key ||
      normalizedSource.url !== source.source_url
    ) {
      throw new CollectionPublicationError(
        'Normalized dataset provenance does not match the persisted source artifact',
        'ARTIFACT_DATASET_MISMATCH',
        {
          artifactSha256: artifact.sha256,
          datasetSha256: normalizedSource?.artifact.sha256 ?? null,
          artifactParserKey: artifact.parser_key,
          datasetParserKey: normalizedSource?.artifact.parserKey ?? null,
          persistedUrl: source.source_url,
          datasetUrl: normalizedSource?.url ?? null,
        },
      );
    }

    await this.validateCoverage(client, source.municipality_id, dataset.serviceAreas);

    const existingAreas = await client.query<AreaRow>(
      `SELECT id, external_key, source_id
       FROM service_areas
       WHERE municipality_id = $1
         AND source_id = $2
         AND active = true
       ORDER BY external_key`,
      [source.municipality_id, sourceId],
    );
    const existingAreaKeys = new Set(existingAreas.rows.map((row) => row.external_key));
    const newAreaKeys = new Set(dataset.serviceAreas.map((area) => area.key));
    const areaDiff = countDiff(existingAreaKeys, newAreaKeys);

    const oldEventsResult = await client.query<EventLogicalRow>(
      `SELECT sa.external_key,
              ce.fraction_code,
              to_char(ce.collection_date, 'YYYY-MM-DD') AS collection_date,
              ce.status,
              ce.note
       FROM service_areas sa
       JOIN collection_events ce ON ce.service_area_id = sa.id
       WHERE sa.source_id = $1
         AND sa.municipality_id = $2
         AND ce.valid_to IS NULL`,
      [sourceId, source.municipality_id],
    );
    const oldEventKeys = new Set(oldEventsResult.rows.map(rowEventKey));
    const newEventKeys = new Set(dataset.collectionEvents.map(eventKey));
    const eventDiff = countDiff(oldEventKeys, newEventKeys);

    const timestamp = await client.query<TimestampRow>(
      'SELECT transaction_timestamp() AS publication_time',
    );
    const publicationTime = timestamp.rows[0]!.publication_time;

    const areaIdByKey = new Map<string, string>();
    for (const area of dataset.serviceAreas) {
      const conflict = await client.query<AreaRow>(
        `SELECT id, external_key, source_id
         FROM service_areas
         WHERE municipality_id = $1 AND external_key = $2
         FOR UPDATE`,
        [source.municipality_id, area.key],
      );
      const current = conflict.rows[0];
      if (current?.source_id && current.source_id !== sourceId) {
        throw new CollectionPublicationError(
          `Service area ${area.key} belongs to another source`,
          'SERVICE_AREA_OWNERSHIP_CONFLICT',
          {
            serviceAreaKey: area.key,
            currentSourceId: current.source_id,
            publishingSourceId: sourceId,
          },
        );
      }

      const upsert = await client.query<IdRow>(
        `INSERT INTO service_areas (
           municipality_id, external_key, name, building_type, active,
           source_id, published_from_artifact_id
         ) VALUES ($1,$2,$3,$4,true,$5,$6)
         ON CONFLICT (municipality_id, external_key) DO UPDATE
         SET name = EXCLUDED.name,
             building_type = EXCLUDED.building_type,
             active = true,
             source_id = EXCLUDED.source_id,
             published_from_artifact_id = EXCLUDED.published_from_artifact_id
         RETURNING id`,
        [source.municipality_id, area.key, area.name, area.buildingType, sourceId, artifactId],
      );
      const areaId = upsert.rows[0]?.id;
      if (!areaId) throw new Error(`Failed to upsert service area ${area.key}`);
      areaIdByKey.set(area.key, areaId);

      await client.query('DELETE FROM service_area_rules WHERE service_area_id = $1', [areaId]);
      for (const rule of area.coverage) {
        await this.insertCoverageRule(client, source.municipality_id, areaId, rule);
      }
    }

    const removedAreaIds = existingAreas.rows
      .filter((area) => !newAreaKeys.has(area.external_key))
      .map((area) => area.id);
    if (removedAreaIds.length > 0) {
      await client.query(
        `UPDATE service_areas
         SET active = false, published_from_artifact_id = $2
         WHERE id = ANY($1::uuid[])`,
        [removedAreaIds, artifactId],
      );
    }

    const allSourceAreaIds = await client.query<IdRow>(
      `SELECT id FROM service_areas WHERE source_id = $1 AND municipality_id = $2`,
      [sourceId, source.municipality_id],
    );
    const ids = allSourceAreaIds.rows.map((row) => row.id);
    if (ids.length > 0) {
      await client.query(
        `UPDATE collection_events
         SET valid_to = $2
         WHERE service_area_id = ANY($1::uuid[])
           AND valid_to IS NULL`,
        [ids, publicationTime],
      );
    }

    for (const event of dataset.collectionEvents) {
      const areaId = areaIdByKey.get(event.serviceAreaKey);
      if (!areaId) {
        throw new CollectionPublicationError(
          `Event references missing service area ${event.serviceAreaKey}`,
          'EVENT_SERVICE_AREA_MISSING',
          { serviceAreaKey: event.serviceAreaKey },
        );
      }
      await client.query(
        `INSERT INTO collection_events (
           service_area_id, fraction_code, collection_date, status, note,
           source_artifact_id, verification_status, confidence, fingerprint,
           valid_from, valid_to
         ) VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,NULL)`,
        [
          areaId,
          event.fraction,
          event.date,
          event.status,
          event.note,
          artifactId,
          event.quality.verificationStatus,
          event.quality.confidence,
          fingerprint(event.serviceAreaKey, event),
          publicationTime,
        ],
      );
    }

    await client.query(
      `UPDATE source_artifacts
       SET parser_key = $2,
           parser_version = $3,
           extraction_confidence = $4,
           status = 'PUBLISHED',
           parse_report = $5::jsonb,
           published_at = $6
       WHERE id = $1`,
      [
        artifactId,
        normalizedSource.artifact.parserKey,
        normalizedSource.artifact.parserVersion,
        normalizedSource.artifact.extractionConfidence,
        JSON.stringify({
          schemaVersion: dataset.schemaVersion,
          municipalityTerc: dataset.municipality.terc,
          serviceAreaCount: dataset.serviceAreas.length,
          eventCount: dataset.collectionEvents.length,
          diff: { serviceAreas: areaDiff, events: eventDiff },
        }),
        publicationTime,
      ],
    );

    const publication = await client.query<PublicationRow>(
      `INSERT INTO collection_publications (
         source_id, source_artifact_id, municipality_id, published_at,
         service_areas_added, service_areas_removed, service_areas_unchanged,
         events_added, events_removed, events_unchanged, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       RETURNING service_areas_added, service_areas_removed, service_areas_unchanged,
                 events_added, events_removed, events_unchanged`,
      [
        sourceId,
        artifactId,
        source.municipality_id,
        publicationTime,
        areaDiff.added,
        areaDiff.removed,
        areaDiff.unchanged,
        eventDiff.added,
        eventDiff.removed,
        eventDiff.unchanged,
        JSON.stringify({
          sourceKey: source.source_key,
          parserKey: normalizedSource.artifact.parserKey,
          parserVersion: normalizedSource.artifact.parserVersion,
        }),
      ],
    );

    await client.query(
      `INSERT INTO data_change_log (
         entity_type, entity_id, change_type, before_data, after_data,
         source_artifact_id, actor_type
       ) VALUES ('COLLECTION_PUBLICATION', $1, 'REPLACE', $2::jsonb, $3::jsonb, $4, 'SYSTEM')`,
      [
        source.municipality_id,
        JSON.stringify({ serviceAreaKeys: [...existingAreaKeys].sort(), eventCount: oldEventKeys.size }),
        JSON.stringify({ serviceAreaKeys: [...newAreaKeys].sort(), eventCount: newEventKeys.size }),
        artifactId,
      ],
    );

    return mapPublication(publication.rows[0]!, false);
  }

  private async validateCoverage(
    client: PoolClient,
    municipalityId: string,
    areas: NormalizedServiceArea[],
  ): Promise<void> {
    for (const area of areas) {
      for (const rule of area.coverage) {
        if (rule.type === 'LOCALITY') {
          if (!rule.simc) {
            throw new CollectionPublicationError(
              `LOCALITY rule in ${area.key} has no SIMC`,
              'LOCALITY_NOT_FOUND',
              { serviceAreaKey: area.key },
            );
          }
          const result = await client.query<IdRow>(
            'SELECT id FROM localities WHERE municipality_id = $1 AND simc = $2 AND active = true',
            [municipalityId, rule.simc],
          );
          if (result.rows.length !== 1) {
            throw new CollectionPublicationError(
              `Locality ${rule.simc} not found in source municipality`,
              'LOCALITY_NOT_FOUND',
              { serviceAreaKey: area.key, simc: rule.simc },
            );
          }
          continue;
        }
        if (rule.type === 'EXPLICIT_ADDRESS') {
          if (!rule.explicitAddress) {
            throw new CollectionPublicationError(
              `EXPLICIT_ADDRESS rule in ${area.key} has no address`,
              'ADDRESS_NOT_FOUND',
            );
          }
          await this.resolveExplicitAddress(
            client,
            municipalityId,
            area.key,
            rule.explicitAddress,
          );
          continue;
        }
        throw new CollectionPublicationError(
          `Coverage rule ${rule.type} is not supported by the collection publisher yet`,
          'UNSUPPORTED_COVERAGE_RULE',
          { serviceAreaKey: area.key, ruleType: rule.type },
        );
      }
    }
  }

  private async insertCoverageRule(
    client: PoolClient,
    municipalityId: string,
    serviceAreaId: string,
    rule: CoverageRule,
  ): Promise<void> {
    if (rule.type === 'LOCALITY') {
      const locality = await client.query<IdRow>(
        'SELECT id FROM localities WHERE municipality_id = $1 AND simc = $2 AND active = true',
        [municipalityId, rule.simc],
      );
      await client.query(
        `INSERT INTO service_area_rules (service_area_id, rule_type, locality_id, priority)
         VALUES ($1, 'LOCALITY', $2, $3)`,
        [serviceAreaId, locality.rows[0]!.id, rule.priority],
      );
      return;
    }
    if (rule.type === 'EXPLICIT_ADDRESS') {
      const addressId = await this.resolveExplicitAddress(
        client,
        municipalityId,
        'unknown',
        rule.explicitAddress!,
      );
      await client.query(
        `INSERT INTO service_area_rules (service_area_id, rule_type, address_id, priority)
         VALUES ($1, 'EXPLICIT_ADDRESS', $2, $3)`,
        [serviceAreaId, addressId, rule.priority],
      );
      return;
    }
    throw new CollectionPublicationError(
      `Unsupported coverage rule ${rule.type}`,
      'UNSUPPORTED_COVERAGE_RULE',
    );
  }

  private async resolveExplicitAddress(
    client: PoolClient,
    municipalityId: string,
    serviceAreaKey: string,
    explicitAddress: string,
  ): Promise<string> {
    const candidates = await client.query<{ id: string; canonical_text: string } & QueryResultRow>(
      `SELECT id, canonical_text
       FROM addresses
       WHERE municipality_id = $1 AND active = true`,
      [municipalityId],
    );
    const target = normalizedLabel(explicitAddress);
    const matches = candidates.rows.filter(
      (row) => normalizedLabel(row.canonical_text) === target,
    );
    if (matches.length === 0) {
      throw new CollectionPublicationError(
        `Address ${explicitAddress} was not found in authoritative address data`,
        'ADDRESS_NOT_FOUND',
        { serviceAreaKey, explicitAddress },
      );
    }
    if (matches.length > 1) {
      throw new CollectionPublicationError(
        `Address ${explicitAddress} resolved ambiguously`,
        'ADDRESS_AMBIGUOUS',
        {
          serviceAreaKey,
          explicitAddress,
          candidateIds: matches.map((row) => row.id),
        },
      );
    }
    return matches[0]!.id;
  }
}
