import { describe, expect, it } from 'vitest';
import {
  canonicalDepositIdentity,
  resolveDepositAssertions,
  sameCanonicalDepositPoint,
  type DepositPointAssertion,
} from './deposit-source-policy.js';

function assertion(overrides: Partial<DepositPointAssertion> = {}): DepositPointAssertion {
  return {
    sourceKey: 'operator-feed',
    sourceTier: 'OPERATOR_OR_RETAILER_VERIFIED_FEED',
    retrievedAt: '2026-08-27T18:00:00Z',
    staticFreshnessSeconds: 86400,
    statusFreshnessSeconds: 900,
    kind: 'DEPOSIT_RVM',
    acceptedContainers: ['PET_BOTTLE', 'METAL_CAN'],
    externalIdentities: [
      { namespace: 'retailer-x', id: 'store-42', role: 'VENUE' },
      { namespace: 'operator-a', id: 'machine-7', role: 'MACHINE' },
    ],
    operationalStatus: {
      state: 'UNKNOWN',
      observedAt: null,
      sourceKey: null,
    },
    ...overrides,
  };
}

describe('deposit source strategy', () => {
  it('prefers the higher-authority fresh static source', () => {
    const result = resolveDepositAssertions([
      assertion({
        sourceKey: 'municipality',
        sourceTier: 'PUBLIC_SECTOR_OFFICIAL',
        retrievedAt: '2026-08-27T18:05:00Z',
        acceptedContainers: ['PET_BOTTLE'],
      }),
      assertion({ sourceKey: 'operator' }),
    ], new Date('2026-08-27T18:10:00Z'));

    expect(result.selectedSourceKey).toBe('operator');
    expect(result.acceptedContainers).toEqual(['METAL_CAN', 'PET_BOTTLE']);
  });

  it('ignores stale operational telemetry and falls back to UNKNOWN', () => {
    const result = resolveDepositAssertions([
      assertion({
        operationalStatus: {
          state: 'OPERATIONAL',
          observedAt: '2026-08-27T17:00:00Z',
          sourceKey: 'operator-feed',
        },
        statusFreshnessSeconds: 900,
      }),
    ], new Date('2026-08-27T18:10:00Z'));

    expect(result.operationalStatus).toEqual({ state: 'UNKNOWN', observedAt: null, sourceKey: null });
    expect(result.warnings).toContain('OPERATIONAL_STATUS_STALE_IGNORED');
  });

  it('can use fresh lower-tier status when a higher-tier status is stale', () => {
    const result = resolveDepositAssertions([
      assertion({
        sourceKey: 'operator-stale',
        sourceTier: 'OPERATOR_TELEMETRY_OR_FEED',
        operationalStatus: {
          state: 'TEMPORARILY_UNAVAILABLE',
          observedAt: '2026-08-27T17:00:00Z',
          sourceKey: 'operator-stale',
        },
        statusFreshnessSeconds: 900,
      }),
      assertion({
        sourceKey: 'retailer-fresh',
        sourceTier: 'OPERATOR_OR_RETAILER_VERIFIED_FEED',
        operationalStatus: {
          state: 'OPERATIONAL',
          observedAt: '2026-08-27T18:08:00Z',
          sourceKey: 'retailer-fresh',
        },
      }),
    ], new Date('2026-08-27T18:10:00Z'));

    expect(result.operationalStatus.state).toBe('OPERATIONAL');
    expect(result.operationalStatus.sourceKey).toBe('retailer-fresh');
  });

  it('deduplicates exact shared venue identity while preserving RVM/manual distinction', () => {
    const first = assertion({
      sourceKey: 'operator-a',
      externalIdentities: [
        { namespace: 'retailer-x', id: 'store-42', role: 'VENUE' },
        { namespace: 'operator-a', id: 'machine-1', role: 'MACHINE' },
      ],
    });
    const second = assertion({
      sourceKey: 'retailer-x',
      externalIdentities: [
        { namespace: 'retailer-x', id: 'store-42', role: 'VENUE' },
        { namespace: 'operator-a', id: 'machine-2', role: 'MACHINE' },
      ],
    });
    const manual = assertion({
      kind: 'DEPOSIT_MANUAL',
      externalIdentities: [{ namespace: 'retailer-x', id: 'store-42', role: 'VENUE' }],
    });

    expect(sameCanonicalDepositPoint(first, second)).toBe(true);
    expect(canonicalDepositIdentity(first)).toBe('retailer-x:venue:store-42:deposit_rvm');
    expect(sameCanonicalDepositPoint(first, manual)).toBe(false);
  });

  it('does not auto-merge a point without stable point/venue identity', () => {
    const result = resolveDepositAssertions([
      assertion({
        externalIdentities: [{ namespace: 'operator-a', id: 'machine-7', role: 'MACHINE' }],
      }),
    ], new Date('2026-08-27T18:10:00Z'));

    expect(result.canonicalIdentity).toBeNull();
    expect(result.reviewRequired).toBe(true);
    expect(result.warnings).toContain('IDENTITY_MISSING_REVIEW_REQUIRED');
  });

  it('flags same-tier static conflicts instead of silently merging capabilities', () => {
    const result = resolveDepositAssertions([
      assertion({ sourceKey: 'feed-a', acceptedContainers: ['PET_BOTTLE'] }),
      assertion({ sourceKey: 'feed-b', acceptedContainers: ['PET_BOTTLE', 'METAL_CAN'] }),
    ], new Date('2026-08-27T18:10:00Z'));

    expect(result.warnings).toContain('STATIC_CONFLICT_REVIEW_REQUIRED');
    expect(result.reviewRequired).toBe(true);
  });
});
