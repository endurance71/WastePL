import { describe, expect, it } from 'vitest';
import {
  compareFacilityAssertions,
  evaluateFacilityFreshness,
  facilityFingerprint,
  type FacilityIdentityAssertion,
} from './facility-reconciliation.js';

function assertion(overrides: Partial<FacilityIdentityAssertion> = {}): FacilityIdentityAssertion {
  return {
    sourceKey: 'source-a',
    sourceArtifactId: 'artifact-a',
    sourceAuthority: 400,
    retrievedAt: '2026-08-27T12:00:00Z',
    staticFreshnessSeconds: 7 * 24 * 60 * 60,
    statusFreshnessSeconds: 60 * 60,
    kind: 'PSZOK',
    municipalityTerc: '3261011',
    name: 'PSZOK Koszalin — Komunalna 5',
    address: 'ul. Komunalna 5, Koszalin',
    location: { lat: 54.212266, lon: 16.183616 },
    externalIdentities: [],
    operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
    ...overrides,
  };
}

describe('facility reconciliation', () => {
  it('auto-merges the same stable point id regardless of cosmetic text differences', () => {
    const left = assertion({
      externalIdentities: [{ namespace: 'pgk-koszalin', id: 'pszok-komunalna-5', role: 'POINT' }],
    });
    const right = assertion({
      sourceKey: 'source-b',
      sourceArtifactId: 'artifact-b',
      name: 'Punkt Selektywnej Zbiórki Odpadów Komunalnych',
      address: 'Komunalna 5',
      externalIdentities: [{ namespace: 'PGK Koszalin', id: 'PSZOK Komunalna 5', role: 'POINT' }],
    });

    expect(compareFacilityAssertions(left, right)).toMatchObject({
      decision: 'AUTO_MERGE',
      score: 1,
      reasons: ['EXACT_STABLE_EXTERNAL_ID'],
    });
  });

  it('auto-merges a high-confidence near duplicate without external ids', () => {
    const left = assertion();
    const right = assertion({
      sourceKey: 'source-b',
      sourceArtifactId: 'artifact-b',
      name: 'PSZOK Koszalin Komunalna 5',
      address: 'Komunalna 5, Koszalin',
      location: { lat: 54.21231, lon: 16.18367 },
    });

    const result = compareFacilityAssertions(left, right);
    expect(result.decision).toBe('AUTO_MERGE');
    expect(result.score).toBeGreaterThanOrEqual(0.86);
    expect(result.reasons).toContain('EXACT_NORMALIZED_ADDRESS');
    expect(result.reasons).toContain('WITHIN_15M');
  });

  it('never silently merges RVM and manual return at the same venue', () => {
    const rvm = assertion({
      kind: 'DEPOSIT_RVM',
      name: 'Sklep XYZ automat kaucyjny',
      address: 'Zwycięstwa 10, Koszalin',
      location: { lat: 54.1901, lon: 16.1801 },
      externalIdentities: [{ namespace: 'retailer-x', id: 'store-10', role: 'VENUE' }],
    });
    const manual = assertion({
      sourceKey: 'source-b',
      sourceArtifactId: 'artifact-b',
      kind: 'DEPOSIT_MANUAL',
      name: 'Sklep XYZ punkt zwrotu',
      address: 'Zwycięstwa 10, Koszalin',
      location: { lat: 54.1901, lon: 16.1801 },
      externalIdentities: [{ namespace: 'retailer-x', id: 'store-10', role: 'VENUE' }],
    });

    const result = compareFacilityAssertions(rvm, manual);
    expect(result.decision).toBe('REVIEW_REQUIRED');
    expect(result.reasons).toContain('KIND_CONFLICT_BLOCKS_AUTO_MERGE');
  });

  it('does not merge low-confidence candidates', () => {
    const result = compareFacilityAssertions(
      assertion(),
      assertion({
        sourceKey: 'source-b',
        sourceArtifactId: 'artifact-b',
        name: 'Inny punkt',
        address: 'Szczecińska 99, Koszalin',
        location: { lat: 54.205, lon: 16.13 },
      }),
    );
    expect(result.decision).toBe('NO_MATCH');
  });

  it('creates a deterministic candidate fingerprint from normalized inputs', () => {
    const first = facilityFingerprint(assertion());
    const second = facilityFingerprint(assertion({
      name: 'pszok koszalin komunalna 5',
      address: 'Komunalna 5, KOSZALIN',
      location: { lat: 54.212269, lon: 16.183619 },
    }));
    expect(first).toBe(second);
  });
});

describe('facility freshness', () => {
  it('marks stale static data but preserves UNKNOWN semantics', () => {
    const result = evaluateFacilityFreshness(
      assertion({ retrievedAt: '2026-08-01T12:00:00Z' }),
      new Date('2026-08-27T18:00:00Z'),
    );
    expect(result.staticState).toBe('STALE');
    expect(result.warnings).toContain('STATIC_ASSERTION_STALE');
    expect(result.effectiveOperationalStatus.state).toBe('UNKNOWN');
  });

  it('degrades stale OPERATIONAL telemetry to UNKNOWN', () => {
    const result = evaluateFacilityFreshness(
      assertion({
        operationalStatus: {
          state: 'OPERATIONAL',
          observedAt: '2026-08-27T14:00:00Z',
          sourceKey: 'telemetry-a',
        },
      }),
      new Date('2026-08-27T18:00:00Z'),
    );
    expect(result.effectiveOperationalStatus).toEqual({
      state: 'UNKNOWN',
      observedAt: null,
      sourceKey: null,
    });
    expect(result.warnings).toContain('OPERATIONAL_STATUS_STALE_IGNORED');
  });

  it('keeps fresh source-backed status', () => {
    const result = evaluateFacilityFreshness(
      assertion({
        operationalStatus: {
          state: 'TEMPORARILY_UNAVAILABLE',
          observedAt: '2026-08-27T17:30:00Z',
          sourceKey: 'telemetry-a',
        },
      }),
      new Date('2026-08-27T18:00:00Z'),
    );
    expect(result.effectiveOperationalStatus.state).toBe('TEMPORARILY_UNAVAILABLE');
    expect(result.warnings).not.toContain('OPERATIONAL_STATUS_STALE_IGNORED');
  });
});
