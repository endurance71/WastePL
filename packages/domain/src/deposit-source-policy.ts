import type {
  DepositContainerClass,
  FacilityKind,
  FacilityOperationalState,
} from './facility.js';

export type DepositFacilityKind = Extract<FacilityKind, 'DEPOSIT_RVM' | 'DEPOSIT_MANUAL'>;

export const DEPOSIT_SOURCE_TIERS = {
  OPERATOR_TELEMETRY_OR_FEED: 500,
  OPERATOR_OR_RETAILER_VERIFIED_FEED: 400,
  VERIFIED_PUBLISHED_LIST: 300,
  PUBLIC_SECTOR_OFFICIAL: 200,
  REVIEWED_FALLBACK: 100,
} as const;

export type DepositSourceTier = keyof typeof DEPOSIT_SOURCE_TIERS;
export type DepositIdentityRole = 'POINT' | 'VENUE' | 'MACHINE';

export interface DepositExternalIdentity {
  namespace: string;
  id: string;
  role: DepositIdentityRole;
}

export interface DepositOperationalAssertion {
  state: FacilityOperationalState;
  observedAt: string | null;
  sourceKey: string | null;
}

export interface DepositPointAssertion {
  sourceKey: string;
  sourceTier: DepositSourceTier;
  retrievedAt: string;
  staticFreshnessSeconds: number;
  statusFreshnessSeconds: number;
  kind: DepositFacilityKind;
  acceptedContainers: DepositContainerClass[];
  externalIdentities: DepositExternalIdentity[];
  operationalStatus: DepositOperationalAssertion;
}

export interface ResolvedDepositPointAssertion {
  selectedSourceKey: string;
  kind: DepositFacilityKind;
  acceptedContainers: DepositContainerClass[];
  canonicalIdentity: string | null;
  operationalStatus: DepositOperationalAssertion;
  warnings: string[];
  reviewRequired: boolean;
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISO timestamp: ${value}`);
  return parsed;
}

function assertTtl(seconds: number, label: string): void {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`${label} must be a positive number of seconds`);
  }
}

function tierScore(tier: DepositSourceTier): number {
  return DEPOSIT_SOURCE_TIERS[tier];
}

function freshAt(value: string, ttlSeconds: number, now: Date): boolean {
  assertTtl(ttlSeconds, 'freshness TTL');
  const ageMs = now.getTime() - timestamp(value);
  return ageMs >= 0 && ageMs <= ttlSeconds * 1000;
}

function sortedContainers(values: DepositContainerClass[]): DepositContainerClass[] {
  return [...new Set(values)].sort();
}

function staticSignature(assertion: DepositPointAssertion): string {
  return JSON.stringify({
    kind: assertion.kind,
    acceptedContainers: sortedContainers(assertion.acceptedContainers),
  });
}

function sortStatic(assertions: DepositPointAssertion[]): DepositPointAssertion[] {
  return [...assertions].sort((a, b) => {
    const tier = tierScore(b.sourceTier) - tierScore(a.sourceTier);
    if (tier !== 0) return tier;
    const time = timestamp(b.retrievedAt) - timestamp(a.retrievedAt);
    if (time !== 0) return time;
    return a.sourceKey.localeCompare(b.sourceKey);
  });
}

function sortOperational(assertions: DepositPointAssertion[]): DepositPointAssertion[] {
  return [...assertions].sort((a, b) => {
    const tier = tierScore(b.sourceTier) - tierScore(a.sourceTier);
    if (tier !== 0) return tier;
    const aObserved = a.operationalStatus.observedAt ? timestamp(a.operationalStatus.observedAt) : 0;
    const bObserved = b.operationalStatus.observedAt ? timestamp(b.operationalStatus.observedAt) : 0;
    if (aObserved !== bObserved) return bObserved - aObserved;
    return a.sourceKey.localeCompare(b.sourceKey);
  });
}

function normalizedIdentity(identity: DepositExternalIdentity): string {
  const namespace = identity.namespace.trim().toLowerCase();
  const id = identity.id.trim().toLowerCase();
  if (!namespace || !id) throw new Error('Deposit external identity requires namespace and id');
  return `${namespace}:${identity.role.toLowerCase()}:${id}`;
}

export function canonicalDepositIdentity(assertion: DepositPointAssertion): string | null {
  const point = assertion.externalIdentities.find((identity) => identity.role === 'POINT');
  if (point) return normalizedIdentity(point);

  const venue = assertion.externalIdentities.find((identity) => identity.role === 'VENUE');
  if (venue) return `${normalizedIdentity(venue)}:${assertion.kind.toLowerCase()}`;

  return null;
}

export function sameCanonicalDepositPoint(
  left: DepositPointAssertion,
  right: DepositPointAssertion,
): boolean {
  const leftKey = canonicalDepositIdentity(left);
  const rightKey = canonicalDepositIdentity(right);
  return leftKey !== null && leftKey === rightKey;
}

export function resolveDepositAssertions(
  assertions: DepositPointAssertion[],
  now = new Date(),
): ResolvedDepositPointAssertion {
  if (assertions.length === 0) throw new Error('At least one deposit assertion is required');

  for (const assertion of assertions) {
    assertTtl(assertion.staticFreshnessSeconds, 'staticFreshnessSeconds');
    assertTtl(assertion.statusFreshnessSeconds, 'statusFreshnessSeconds');
    timestamp(assertion.retrievedAt);
  }

  const warnings: string[] = [];
  const freshStatic = assertions.filter((assertion) =>
    freshAt(assertion.retrievedAt, assertion.staticFreshnessSeconds, now),
  );
  const staticCandidates = freshStatic.length > 0 ? freshStatic : assertions;
  const selected = sortStatic(staticCandidates)[0]!;

  if (freshStatic.length === 0) warnings.push('STATIC_ASSERTION_STALE');

  const selectedTier = tierScore(selected.sourceTier);
  const peerSignatures = new Set(
    staticCandidates
      .filter((assertion) => tierScore(assertion.sourceTier) === selectedTier)
      .map(staticSignature),
  );
  if (peerSignatures.size > 1) warnings.push('STATIC_CONFLICT_REVIEW_REQUIRED');

  const canonicalIdentity = canonicalDepositIdentity(selected);
  if (!canonicalIdentity) warnings.push('IDENTITY_MISSING_REVIEW_REQUIRED');

  const knownStatuses = assertions.filter((assertion) => {
    const status = assertion.operationalStatus;
    if (status.state === 'UNKNOWN' || !status.observedAt || !status.sourceKey) return false;
    return freshAt(status.observedAt, assertion.statusFreshnessSeconds, now);
  });

  const hadKnownButStale = assertions.some((assertion) => {
    const status = assertion.operationalStatus;
    if (status.state === 'UNKNOWN' || !status.observedAt || !status.sourceKey) return false;
    return !freshAt(status.observedAt, assertion.statusFreshnessSeconds, now);
  });
  if (hadKnownButStale) warnings.push('OPERATIONAL_STATUS_STALE_IGNORED');

  const operationalStatus = knownStatuses.length > 0
    ? sortOperational(knownStatuses)[0]!.operationalStatus
    : { state: 'UNKNOWN' as const, observedAt: null, sourceKey: null };

  return {
    selectedSourceKey: selected.sourceKey,
    kind: selected.kind,
    acceptedContainers: sortedContainers(selected.acceptedContainers),
    canonicalIdentity,
    operationalStatus,
    warnings,
    reviewRequired: warnings.some((warning) => warning.endsWith('REVIEW_REQUIRED')),
  };
}
