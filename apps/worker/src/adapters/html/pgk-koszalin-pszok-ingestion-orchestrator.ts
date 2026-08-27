import type { Pool } from 'pg';
import { PgFacilityBundlePublisher, type FacilityBundleEntity } from '../../facilities/facility-bundle-publisher.js';
import { PgSourceRegistry } from '../../ingestion/source-registry.js';
import {
  PgkKoszalinPszokNormalizationService,
  type PgkKoszalinPszokNormalizationInput,
} from './pgk-koszalin-pszok-normalization-service.js';
import type { NormalizedFacilityV02 } from './pgk-koszalin-pszok-adapter.js';

function assertionPlan(
  facility: NormalizedFacilityV02,
  input: PgkKoszalinPszokNormalizationInput,
): FacilityBundleEntity {
  if (facility.key === 'pl-3261011-pszok-komunalna-5') {
    return {
      facility,
      assertions: [
        {
          sourceKey: input.main.sourceKey,
          claims: ['identity', 'address', 'location', 'openingHours', 'access'],
          sourceAuthority: 200,
          verificationStatus: 'OFFICIAL_SOURCE',
          confidence: 0.99,
        },
        {
          sourceKey: input.faq.sourceKey,
          claims: ['identity', 'address', 'acceptedMaterials', 'access'],
          sourceAuthority: 200,
          verificationStatus: 'OFFICIAL_SOURCE',
          confidence: 0.99,
        },
      ],
    };
  }

  if (facility.key === 'pl-3261011-pszok-na-skwierzynke-2') {
    return {
      facility,
      assertions: [
        {
          sourceKey: input.main.sourceKey,
          claims: ['identity', 'address', 'openingHours', 'access'],
          sourceAuthority: 200,
          verificationStatus: 'REVIEW_REQUIRED',
          confidence: facility.quality.confidence,
        },
      ],
    };
  }

  throw new Error(`Unsupported PGK Koszalin PSZOK facility key: ${facility.key}`);
}

export class PgkKoszalinPszokIngestionOrchestrator {
  private readonly normalization: PgkKoszalinPszokNormalizationService;
  private readonly publisher: PgFacilityBundlePublisher;

  constructor(private readonly pool: Pool) {
    const registry = new PgSourceRegistry(pool);
    this.normalization = new PgkKoszalinPszokNormalizationService(registry);
    this.publisher = new PgFacilityBundlePublisher(pool);
  }

  async ingest(input: PgkKoszalinPszokNormalizationInput) {
    const facilities = await this.normalization.normalizeAll(input);
    return this.publisher.publish({
      municipalityTerc: '3261011',
      artifacts: [
        {
          artifactId: input.main.artifactId,
          sourceKey: input.main.sourceKey,
          retrievedAt: input.main.retrievedAt,
        },
        {
          artifactId: input.faq.artifactId,
          sourceKey: input.faq.sourceKey,
          retrievedAt: input.faq.retrievedAt,
        },
      ],
      entities: facilities.map((facility) => assertionPlan(facility, input)),
    });
  }
}
