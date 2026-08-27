export const APP_NAME = 'wastepl' as const;
export const INGESTION_QUEUE = 'source-ingestion' as const;

export const PIPELINE_STAGES = [
  'fetch',
  'hash',
  'store',
  'parse',
  'normalize',
  'validate',
  'diff',
  'publish-or-review',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type VerificationStatus =
  | 'VERIFIED'
  | 'OFFICIAL_SOURCE'
  | 'UNVERIFIED'
  | 'REVIEW_REQUIRED';

export type WasteFractionCode =
  | 'MIXED'
  | 'BIO'
  | 'PAPER'
  | 'GLASS'
  | 'METALS_PLASTICS'
  | 'GREEN'
  | 'BULKY'
  | 'ASH'
  | 'TEXTILES'
  | 'OTHER';

export const SERVICE_AREA_SPECIFICITY = [
  'EXPLICIT_ADDRESS',
  'EXPLICIT_NUMBERS',
  'NUMBER_RANGE',
  'STREET',
  'LOCALITY',
  'MUNICIPALITY',
] as const;

export * from './facility.js';
export * from './service-area.js';
