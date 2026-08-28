import type { Pool, QueryResultRow } from 'pg';
import { MunicipalPszokHtmlAdapter } from '../adapters/html/municipal-pszok-adapter.js';
import {
  PermanentArtifactParseError,
  type ArtifactProcessorResult,
} from '../ingestion/artifact-processing.js';
import type {
  ArtifactHandler,
  ArtifactHandlerInput,
} from '../ingestion/dispatching-artifact-processor.js';
import { PgSourceRegistry } from '../ingestion/source-registry.js';
import { validateFacilityV02 } from '../normalization/validate-facility-v02.js';
import {
  PgFacilityBundlePublisher,
  type FacilityClaim,
} from './facility-bundle-publisher.js';

interface SourceRow extends QueryResultRow {
  source_key: string | null;
  source_url: string;
  terc: string | null;
}

const EXPECTED_TERC = new Map<string, string>([
  ['bobolice-pszok', '3209033'],
  ['swieszyno-pszok', '3209082'],
]);

export class MunicipalPszokArtifactHandler implements ArtifactHandler {
  readonly parserKey = 'municipal-pszok-html';
  private readonly adapter = new MunicipalPszokHtmlAdapter();
  private readonly registry: PgSourceRegistry;
  private readonly publisher: PgFacilityBundlePublisher;

  constructor(private readonly pool: Pool) {
    this.registry = new PgSourceRegistry(pool);
    this.publisher = new PgFacilityBundlePublisher(pool);
  }

  async process(input: ArtifactHandlerInput): Promise<ArtifactProcessorResult> {
    const sourceResult = await this.pool.query<SourceRow>(
      `SELECT s.source_key, s.source_url, m.terc
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
      throw new PermanentArtifactParseError('Municipal PSZOK source has no stable source_key', {
        code: 'SOURCE_KEY_MISSING',
      });
    }
    if (!this.adapter.supportsSourceKey(source.source_key)) {
      throw new PermanentArtifactParseError(`Unsupported municipal PSZOK source ${source.source_key}`, {
        code: 'UNSUPPORTED_SOURCE_IDENTITY',
      });
    }

    const expectedTerc = EXPECTED_TERC.get(source.source_key);
    if (!expectedTerc || source.terc !== expectedTerc) {
      throw new PermanentArtifactParseError('Municipal PSZOK source is assigned to the wrong municipality', {
        code: 'SOURCE_MUNICIPALITY_MISMATCH',
        metadata: {
          sourceKey: source.source_key,
          expectedTerc: expectedTerc ?? null,
          actualTerc: source.terc,
        },
      });
    }

    try {
      const facility = this.adapter.parse({
        html: input.body.toString('utf8'),
        sourceKey: source.source_key,
        url: source.source_url,
        sha256: input.artifact.sha256,
        retrievedAt: input.artifact.retrievedAt.toISOString(),
        storageUri: input.artifact.storageUri,
      });
      await validateFacilityV02(facility);

      await this.registry.markArtifactParsed({
        artifactId: input.artifact.id,
        parserKey: this.adapter.parserKey,
        parserVersion: this.adapter.parserVersion,
        extractionConfidence: facility.quality.confidence,
        status: 'NORMALIZED',
        parseReport: {
          facilityKey: facility.key,
          sourceKey: source.source_key,
          assertions: [
            'identity',
            'address',
            'openingHours',
            'access',
            'acceptedMaterials',
            ...(facility.location ? ['location'] : []),
          ],
          warnings: facility.quality.warnings,
        },
      });

      const claims: FacilityClaim[] = ['identity', 'address', 'openingHours', 'access', 'acceptedMaterials'];
      if (facility.location) claims.push('location');
      if (facility.operationalStatus.state !== 'UNKNOWN') claims.push('operationalStatus');

      const outcomes = await this.publisher.publish({
        municipalityTerc: expectedTerc,
        artifacts: [{
          artifactId: input.artifact.id,
          sourceKey: source.source_key,
          retrievedAt: input.artifact.retrievedAt.toISOString(),
        }],
        entities: [{
          facility,
          assertions: [{
            sourceKey: source.source_key,
            claims,
            sourceAuthority: 190,
            verificationStatus: facility.quality.verificationStatus,
            confidence: facility.quality.confidence,
          }],
        }],
      });

      return {
        outcome: 'PUBLISHED',
        metadata: {
          municipalityTerc: expectedTerc,
          facilityKey: facility.key,
          warnings: facility.quality.warnings,
          outcomes: outcomes.map((outcome) => ({
            facilityKey: outcome.facilityKey,
            state: outcome.state,
            facilityId: outcome.facilityId,
          })),
        },
      };
    } catch (error) {
      if (error instanceof PermanentArtifactParseError) throw error;
      if (error instanceof Error && error.message.startsWith('Municipal PSZOK adapter')) {
        throw new PermanentArtifactParseError(error.message, {
          code: 'UNSUPPORTED_TEMPLATE',
          metadata: { sourceKey: source.source_key },
          cause: error,
        });
      }
      if (error instanceof Error && error.message.includes('JSON Schema validation failed')) {
        throw new PermanentArtifactParseError(error.message, {
          code: 'SCHEMA_VALIDATION_FAILED',
          metadata: { sourceKey: source.source_key },
          cause: error,
        });
      }
      throw error;
    }
  }
}
