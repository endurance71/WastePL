import type { SourceRegistry } from '../../ingestion/types.js';
import { validateFacilityV02 } from '../../normalization/validate-facility-v02.js';
import {
  PgkKoszalinPszokHtmlAdapter,
  type HtmlArtifactInput,
  type NormalizedFacilityV02,
} from './pgk-koszalin-pszok-adapter.js';

export interface HtmlArtifactWithId extends HtmlArtifactInput {
  artifactId: string;
}

export interface PgkKoszalinPszokNormalizationInput {
  main: HtmlArtifactWithId;
  faq: HtmlArtifactWithId;
}

export class PgkKoszalinPszokNormalizationService {
  constructor(
    private readonly registry: SourceRegistry,
    private readonly adapter = new PgkKoszalinPszokHtmlAdapter(),
  ) {}

  async normalize(input: PgkKoszalinPszokNormalizationInput): Promise<NormalizedFacilityV02> {
    return (await this.normalizeAll(input))[0]!;
  }

  async normalizeAll(input: PgkKoszalinPszokNormalizationInput): Promise<NormalizedFacilityV02[]> {
    const facilities = this.adapter.parseAll({ main: input.main, faq: input.faq });
    for (const facility of facilities) await validateFacilityV02(facility);

    const facilityKeys = facilities.map((facility) => facility.key);

    await this.registry.markArtifactParsed({
      artifactId: input.main.artifactId,
      parserKey: this.adapter.parserKey,
      parserVersion: this.adapter.parserVersion,
      extractionConfidence: 0.99,
      status: 'NORMALIZED',
      parseReport: {
        facilityKey: facilities[0]!.key,
        facilityKeys,
        assertions: [
          'identity',
          'address',
          'location',
          'openingHours',
          'accessScope',
          'requiresProof',
          'reviewCandidateWithoutTrustedGeometry',
        ],
      },
    });

    await this.registry.markArtifactParsed({
      artifactId: input.faq.artifactId,
      parserKey: this.adapter.parserKey,
      parserVersion: this.adapter.parserVersion,
      extractionConfidence: 0.99,
      status: 'NORMALIZED',
      parseReport: {
        facilityKey: facilities[0]!.key,
        facilityKeys: [facilities[0]!.key],
        assertions: ['acceptedMaterials', 'quantityLimits'],
      },
    });

    return facilities;
  }
}
