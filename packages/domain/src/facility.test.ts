import { describe, expect, it } from 'vitest';
import { facilitySemanticViolations } from './facility.js';

describe('facility v0.2 semantics', () => {
  it('allows UNKNOWN operational status without pretending the point is unavailable', () => {
    expect(
      facilitySemanticViolations({
        kind: 'PSZOK',
        acceptedMaterials: ['TEXTILES', 'BULKY'],
        acceptedContainers: [],
        openingHoursPresent: false,
        openingHoursSourceKey: null,
        access: { scope: 'UNKNOWN', sourceKey: null },
        operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
      }),
    ).toEqual([]);
  });

  it('requires source and observation time for a positive operational claim', () => {
    expect(
      facilitySemanticViolations({
        kind: 'DEPOSIT_RVM',
        acceptedMaterials: [],
        acceptedContainers: ['PET_BOTTLE'],
        openingHoursPresent: false,
        openingHoursSourceKey: null,
        access: { scope: 'UNKNOWN', sourceKey: null },
        operationalStatus: { state: 'OPERATIONAL', observedAt: null, sourceKey: null },
      }),
    ).toContain('OPERATIONAL_STATUS_REQUIRES_OBSERVATION_AND_SOURCE');
  });

  it('requires accepted container classes for deposit points', () => {
    expect(
      facilitySemanticViolations({
        kind: 'DEPOSIT_MANUAL',
        acceptedMaterials: [],
        acceptedContainers: [],
        openingHoursPresent: false,
        openingHoursSourceKey: null,
        access: { scope: 'UNKNOWN', sourceKey: null },
        operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
      }),
    ).toContain('DEPOSIT_POINT_REQUIRES_ACCEPTED_CONTAINER');
  });

  it('keeps PSZOK material capabilities separate from deposit containers', () => {
    expect(
      facilitySemanticViolations({
        kind: 'PSZOK',
        acceptedMaterials: ['ELECTRONICS'],
        acceptedContainers: ['PET_BOTTLE'],
        openingHoursPresent: false,
        openingHoursSourceKey: null,
        access: { scope: 'UNKNOWN', sourceKey: null },
        operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
      }),
    ).toContain('PSZOK_MUST_NOT_DECLARE_DEPOSIT_CONTAINERS');
  });

  it('requires provenance for structured hours and non-unknown access claims', () => {
    expect(
      facilitySemanticViolations({
        kind: 'PSZOK',
        acceptedMaterials: ['BULKY'],
        acceptedContainers: [],
        openingHoursPresent: true,
        openingHoursSourceKey: null,
        access: { scope: 'MUNICIPALITY_RESIDENTS', sourceKey: null },
        operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
      }),
    ).toEqual(['OPENING_HOURS_REQUIRE_SOURCE', 'ACCESS_CLAIM_REQUIRES_SOURCE']);
  });
});
