import { describe, expect, it } from 'vitest';
import { facilitySemanticViolations } from './facility.js';

describe('facility claim provenance', () => {
  it('rejects a quantity limit without its own source', () => {
    expect(
      facilitySemanticViolations({
        kind: 'PSZOK',
        acceptedMaterials: ['TYRES'],
        acceptedContainers: [],
        openingHoursPresent: true,
        openingHoursSourceKey: 'main-source',
        access: {
          scope: 'MUNICIPALITY_RESIDENTS',
          sourceKey: 'main-source',
          quantityLimits: [
            { material: 'TYRES', limit: '8 sztuk', period: 'YEAR', sourceKey: null },
          ],
        },
        operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
      }),
    ).toContain('QUANTITY_LIMIT_REQUIRES_SOURCE');
  });
});
