import type { VerificationStatus, WasteFractionCode } from '@wastepl/domain';

export type NormalizedSourceOwnerType =
  | 'MUNICIPALITY'
  | 'MUNICIPAL_COMPANY'
  | 'WASTE_OPERATOR'
  | 'DEPOSIT_OPERATOR'
  | 'OTHER_PUBLIC'
  | 'OTHER';

export type NormalizedMunicipalityType =
  | 'URBAN'
  | 'RURAL'
  | 'URBAN_RURAL'
  | 'DISTRICT_CITY'
  | 'OTHER';

export interface PdfTextArtifactInput {
  text: string;
  sourceKey: string;
  url: string;
  sha256: string;
  retrievedAt: string;
  storageUri: string | null;
  ownerType?: NormalizedSourceOwnerType;
}

export interface NormalizedQuality {
  verificationStatus: VerificationStatus;
  confidence: number;
  retrievedAt: string;
  warnings: string[];
}

export interface CoverageRule {
  type: 'MUNICIPALITY' | 'LOCALITY' | 'STREET' | 'NUMBER_RANGE' | 'EXPLICIT_NUMBERS' | 'EXPLICIT_ADDRESS' | 'EXCLUDE';
  priority: number;
  simc?: string | null;
  explicitAddress?: string;
}

export interface NormalizedServiceArea {
  key: string;
  name: string;
  buildingType: 'SINGLE_FAMILY' | 'MULTI_FAMILY' | 'MIXED' | 'OTHER' | null;
  coverage: CoverageRule[];
}

export interface NormalizedCollectionEvent {
  serviceAreaKey: string;
  fraction: WasteFractionCode;
  date: string;
  status: 'SCHEDULED';
  note: string | null;
  sourceKey: string;
  quality: NormalizedQuality;
}

export interface NormalizedSource {
  sourceKey: string;
  url: string;
  ownerType: NormalizedSourceOwnerType;
  format: 'PDF_TEXT';
  reuseBasis: string | null;
  artifact: {
    sha256: string;
    retrievedAt: string;
    parserKey: string;
    parserVersion: string;
    extractionConfidence: number;
    storageUri: string | null;
  };
}

export interface NormalizedDataset {
  schemaVersion: '0.1.0';
  municipality: {
    terc: string;
    name: string;
    municipalityType: NormalizedMunicipalityType;
  };
  serviceAreas: NormalizedServiceArea[];
  collectionEvents: NormalizedCollectionEvent[];
  facilities: [];
  alerts: [];
  sources: NormalizedSource[];
}

export interface PdfTextAdapter {
  readonly parserKey: string;
  readonly parserVersion: string;
  supports(text: string): boolean;
  parse(input: PdfTextArtifactInput): NormalizedDataset;
}

export class PdfTextParseError extends Error {
  constructor(
    message: string,
    readonly code: 'UNSUPPORTED_TEMPLATE' | 'AMBIGUOUS_FRACTION' | 'INVALID_ROW' | 'MISSING_METADATA',
    readonly line: string | null = null,
  ) {
    super(message);
    this.name = 'PdfTextParseError';
  }
}
