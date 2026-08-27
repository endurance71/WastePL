export type VerificationStatus =
  | 'VERIFIED'
  | 'OFFICIAL_SOURCE'
  | 'UNVERIFIED'
  | 'REVIEW_REQUIRED';

export type WasteFractionCode =
  | 'MIXED' | 'BIO' | 'PAPER' | 'GLASS' | 'METALS_PLASTICS'
  | 'GREEN' | 'BULKY' | 'ASH' | 'TEXTILES' | 'OTHER';

export const SERVICE_AREA_SPECIFICITY = [
  'EXPLICIT_ADDRESS', 'EXPLICIT_NUMBERS', 'NUMBER_RANGE',
  'STREET', 'LOCALITY', 'MUNICIPALITY'
] as const;
