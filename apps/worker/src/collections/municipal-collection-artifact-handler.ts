import type { Pool, QueryResultRow } from 'pg';
import {
  MunicipalCollectionPdfTextAdapter,
  type MunicipalCollectionReferenceContext,
} from '../adapters/pdf-text/municipal-collection-adapter.js';
import {
  PdfTextExtractionError,
  textFromPdfTextArtifact,
} from '../adapters/pdf-text/pdf-text-extractor.js';
import {
  PdfTextParseError,
  type NormalizedMunicipalityType,
  type NormalizedSourceOwnerType,
} from '../adapters/pdf-text/types.js';
import {
  PermanentArtifactParseError,
  type ArtifactProcessorResult,
} from '../ingestion/artifact-processing.js';
import type {
  ArtifactHandler,
  ArtifactHandlerInput,
} from '../ingestion/dispatching-artifact-processor.js';
import { validateWastePlDataset } from '../normalization/validate-wastepl-dataset.js';
import {
  CollectionPublicationError,
  PgCollectionPublisher,
} from './pg-collection-publisher.js';

interface SourceRow extends QueryResultRow {
  source_key: string | null;
  source_url: string;
  owner_type: string;
  terc: string | null;
  municipality_name: string | null;
  municipality_type: string | null;
  municipality_id: string | null;
}

interface LocalityRow extends QueryResultRow {
  simc: string;
  name: string;
}

const PUBLICATION_PROFILE_VERSIONS: Readonly<Record<string, string>> = {
  'tychowo-collection-standard-2026': '0.1.1',
  'polanow-collection-garbno-h2-2026': '0.2.0',
};

function municipalityType(value: string | null): NormalizedMunicipalityType {
  if (
    value === 'URBAN' ||
    value === 'RURAL' ||
    value === 'URBAN_RURAL' ||
    value === 'DISTRICT_CITY' ||
    value === 'OTHER'
  ) {
    return value;
  }
  return 'OTHER';
}

function ownerType(value: string): NormalizedSourceOwnerType {
  if (
    value === 'MUNICIPALITY' ||
    value === 'MUNICIPAL_COMPANY' ||
    value === 'WASTE_OPERATOR' ||
    value === 'DEPOSIT_OPERATOR' ||
    value === 'OTHER_PUBLIC' ||
    value === 'OTHER'
  ) {
    return value;
  }
  return 'OTHER_PUBLIC';
}

function applyPublicationProfileVersion(
  sourceKey: string,
  fallbackVersion: string,
  dataset: ReturnType<MunicipalCollectionPdfTextAdapter['parse']>,
): void {
  const matchingSources = dataset.sources.filter((entry) => entry.sourceKey === sourceKey);
  if (matchingSources.length !== 1 || !matchingSources[0]) {
    throw new PermanentArtifactParseError(
      `Municipal collection dataset must contain exactly one provenance record for ${sourceKey}`,
      {
        code: 'DATASET_SOURCE_PROVENANCE_MISMATCH',
        metadata: { sourceKey, matchingSources: matchingSources.length },
      },
    );
  }
  matchingSources[0].artifact.parserVersion = PUBLICATION_PROFILE_VERSIONS[sourceKey] ?? fallbackVersion;
}

export class MunicipalCollectionArtifactHandler implements ArtifactHandler {
  readonly parserKey = 'municipal-collection-pdf-text';

  constructor(
    private readonly pool: Pool,
    private readonly publisher = new PgCollectionPublisher(pool),
  ) {}

  async process(input: ArtifactHandlerInput): Promise<ArtifactProcessorResult> {
    const sourceResult = await this.pool.query<SourceRow>(
      `SELECT s.source_key,
              s.source_url,
              s.owner_type,
              s.municipality_id,
              m.terc,
              m.name AS municipality_name,
              m.municipality_type
       FROM sources s
       LEFT JOIN municipalities m ON m.id = s.municipality_id
       WHERE s.id = $1`,
      [input.artifact.sourceId],
    );
    const source = sourceResult.rows[0];
    if (!source) {
      throw new PermanentArtifactParseError(`Source ${input.artifact.sourceId} not found`, {
        code: 'SOURCE_NOT_FOUND',
      });
    }
    if (!source.source_key) {
      throw new PermanentArtifactParseError('Municipal collection source has no stable source_key', {
        code: 'SOURCE_KEY_MISSING',
      });
    }
    if (!source.municipality_id || !source.terc || !source.municipality_name) {
      throw new PermanentArtifactParseError('Municipal collection source has no municipality reference', {
        code: 'SOURCE_MUNICIPALITY_MISSING',
        metadata: { sourceKey: source.source_key },
      });
    }

    let text: string;
    try {
      text = await textFromPdfTextArtifact(input.body);
    } catch (error) {
      if (error instanceof PdfTextExtractionError) {
        throw new PermanentArtifactParseError(error.message, {
          code: error.code,
          metadata: { sourceKey: source.source_key },
          cause: error,
        });
      }
      throw error;
    }

    const localityResult = await this.pool.query<LocalityRow>(
      `SELECT simc, name
       FROM localities
       WHERE municipality_id = $1 AND active = true
       ORDER BY simc`,
      [source.municipality_id],
    );
    const context: MunicipalCollectionReferenceContext = {
      municipality: {
        terc: source.terc,
        name: source.municipality_name,
        municipalityType: municipalityType(source.municipality_type),
      },
      localities: localityResult.rows.map((row) => ({ simc: row.simc, name: row.name })),
    };
    const adapter = new MunicipalCollectionPdfTextAdapter(context);

    if (!adapter.supports(text)) {
      throw new PermanentArtifactParseError('Artifact does not match the municipal PDF_TEXT adapter', {
        code: 'UNSUPPORTED_TEMPLATE',
        metadata: { sourceKey: source.source_key },
      });
    }

    try {
      const dataset = adapter.parse({
        text,
        sourceKey: source.source_key,
        url: source.source_url,
        sha256: input.artifact.sha256,
        retrievedAt: input.artifact.retrievedAt.toISOString(),
        storageUri: input.artifact.storageUri,
        ownerType: ownerType(source.owner_type),
      });
      applyPublicationProfileVersion(source.source_key, adapter.parserVersion, dataset);
      await validateWastePlDataset(dataset);
      const diff = await this.publisher.publish(
        input.artifact.sourceId,
        input.artifact.id,
        dataset,
      );

      return {
        outcome: 'PUBLISHED',
        metadata: {
          municipalityTerc: dataset.municipality.terc,
          serviceAreasAdded: diff.serviceAreasAdded,
          serviceAreasRemoved: diff.serviceAreasRemoved,
          serviceAreasUnchanged: diff.serviceAreasUnchanged,
          eventsAdded: diff.eventsAdded,
          eventsRemoved: diff.eventsRemoved,
          eventsUnchanged: diff.eventsUnchanged,
          replayed: diff.replayed,
        },
      };
    } catch (error) {
      if (error instanceof PdfTextParseError) {
        throw new PermanentArtifactParseError(error.message, {
          code: error.code,
          metadata: error.line ? { line: error.line } : {},
          cause: error,
        });
      }
      if (error instanceof CollectionPublicationError) {
        throw new PermanentArtifactParseError(error.message, {
          code: error.code,
          metadata: error.details,
          cause: error,
        });
      }
      if (
        error instanceof Error &&
        error.message.startsWith('WastePL JSON Schema validation failed:')
      ) {
        throw new PermanentArtifactParseError(error.message, {
          code: 'SCHEMA_VALIDATION_FAILED',
          cause: error,
        });
      }
      throw error;
    }
  }
}
