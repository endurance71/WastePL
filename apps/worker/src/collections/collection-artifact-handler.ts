import type { Pool, QueryResultRow } from 'pg';
import { PgkKoszalinPdfTextAdapter } from '../adapters/pdf-text/pgk-koszalin-adapter.js';
import {
  PdfTextExtractionError,
  textFromPdfTextArtifact,
} from '../adapters/pdf-text/pdf-text-extractor.js';
import {
  PdfTextParseError,
  type PdfTextAdapter,
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
}

interface CollectionPublisher {
  publish(sourceId: string, artifactId: string, dataset: Parameters<PgCollectionPublisher['publish']>[2]): Promise<Awaited<ReturnType<PgCollectionPublisher['publish']>>>;
}

export class PgkKoszalinCollectionArtifactHandler implements ArtifactHandler {
  readonly parserKey = 'pgk-koszalin-pdf-text';

  constructor(
    private readonly pool: Pool,
    private readonly adapter: PdfTextAdapter = new PgkKoszalinPdfTextAdapter(),
    private readonly publisher: CollectionPublisher = new PgCollectionPublisher(pool),
  ) {}

  async process(input: ArtifactHandlerInput): Promise<ArtifactProcessorResult> {
    const sourceResult = await this.pool.query<SourceRow>(
      `SELECT source_key, source_url
       FROM sources
       WHERE id = $1`,
      [input.artifact.sourceId],
    );
    const source = sourceResult.rows[0];
    if (!source) {
      throw new PermanentArtifactParseError(`Source ${input.artifact.sourceId} not found`, {
        code: 'SOURCE_NOT_FOUND',
      });
    }
    if (!source.source_key) {
      throw new PermanentArtifactParseError('Collection source has no stable source_key', {
        code: 'SOURCE_KEY_MISSING',
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

    if (!this.adapter.supports(text)) {
      throw new PermanentArtifactParseError('Artifact does not match the registered PDF_TEXT adapter', {
        code: 'UNSUPPORTED_TEMPLATE',
        metadata: { sourceKey: source.source_key },
      });
    }

    try {
      const dataset = this.adapter.parse({
        text,
        sourceKey: source.source_key,
        url: source.source_url,
        sha256: input.artifact.sha256,
        retrievedAt: input.artifact.retrievedAt.toISOString(),
        storageUri: input.artifact.storageUri,
      });
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
