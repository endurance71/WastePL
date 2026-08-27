export const FACILITY_KINDS = [
  'PSZOK',
  'DEPOSIT_RVM',
  'DEPOSIT_MANUAL',
  'ELECTRONICS',
  'TEXTILES',
  'BATTERIES',
  'MEDICINES',
  'OTHER',
] as const;

export type FacilityKind = (typeof FACILITY_KINDS)[number];

export const FACILITY_MATERIALS = [
  'MIXED',
  'BIO',
  'PAPER',
  'GLASS',
  'METALS_PLASTICS',
  'GREEN',
  'BULKY',
  'ASH',
  'TEXTILES',
  'ELECTRONICS',
  'BATTERIES',
  'MEDICINES',
  'CONSTRUCTION',
  'RUBBLE',
  'TYRES',
  'HAZARDOUS',
  'OTHER',
] as const;

export type FacilityMaterial = (typeof FACILITY_MATERIALS)[number];

export const DEPOSIT_CONTAINER_CLASSES = [
  'PET_BOTTLE',
  'METAL_CAN',
  'REUSABLE_GLASS_BOTTLE',
] as const;

export type DepositContainerClass = (typeof DEPOSIT_CONTAINER_CLASSES)[number];

export const FACILITY_OPERATIONAL_STATES = [
  'OPERATIONAL',
  'TEMPORARILY_UNAVAILABLE',
  'UNKNOWN',
] as const;

export type FacilityOperationalState = (typeof FACILITY_OPERATIONAL_STATES)[number];

export const FACILITY_ACCESS_SCOPES = [
  'OPEN_TO_ALL',
  'MUNICIPALITY_RESIDENTS',
  'MUNICIPALITY_PROPERTY_OWNERS',
  'OTHER',
  'UNKNOWN',
] as const;

export type FacilityAccessScope = (typeof FACILITY_ACCESS_SCOPES)[number];

export interface FacilityOperationalStatus {
  state: FacilityOperationalState;
  observedAt: string | null;
  sourceKey: string | null;
}

export interface FacilityAccess {
  scope: FacilityAccessScope;
  sourceKey: string | null;
}

export interface FacilitySemanticInput {
  kind: FacilityKind;
  acceptedMaterials: FacilityMaterial[];
  acceptedContainers: DepositContainerClass[];
  openingHoursPresent: boolean;
  openingHoursSourceKey: string | null;
  access: FacilityAccess;
  operationalStatus: FacilityOperationalStatus;
}

export function facilitySemanticViolations(input: FacilitySemanticInput): string[] {
  const violations: string[] = [];

  if (
    (input.kind === 'DEPOSIT_RVM' || input.kind === 'DEPOSIT_MANUAL') &&
    input.acceptedContainers.length === 0
  ) {
    violations.push('DEPOSIT_POINT_REQUIRES_ACCEPTED_CONTAINER');
  }

  if (input.kind === 'PSZOK' && input.acceptedContainers.length > 0) {
    violations.push('PSZOK_MUST_NOT_DECLARE_DEPOSIT_CONTAINERS');
  }

  if (input.openingHoursPresent && !input.openingHoursSourceKey) {
    violations.push('OPENING_HOURS_REQUIRE_SOURCE');
  }

  if (input.access.scope !== 'UNKNOWN' && !input.access.sourceKey) {
    violations.push('ACCESS_CLAIM_REQUIRES_SOURCE');
  }

  if (
    input.operationalStatus.state !== 'UNKNOWN' &&
    (!input.operationalStatus.observedAt || !input.operationalStatus.sourceKey)
  ) {
    violations.push('OPERATIONAL_STATUS_REQUIRES_OBSERVATION_AND_SOURCE');
  }

  return violations;
}
