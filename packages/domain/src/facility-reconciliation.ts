import type { FacilityKind, FacilityOperationalState } from './facility.js';

export type FacilityIdentityRole = 'POINT' | 'VENUE' | 'MACHINE';

export interface FacilityExternalIdentityAssertion {
  namespace: string;
  id: string;
  role: FacilityIdentityRole;
}

export interface FacilityLocation {
  lat: number;
  lon: number;
}

export interface FacilityOperationalAssertion {
  state: FacilityOperationalState;
  observedAt: string | null;
  sourceKey: string | null;
}

export interface FacilityIdentityAssertion {
  assertionId?: string;
  sourceKey: string;
  sourceArtifactId: string;
  sourceAuthority: number;
  retrievedAt: string;
  staticFreshnessSeconds: number;
  statusFreshnessSeconds: number;
  kind: FacilityKind;
  municipalityTerc: string | null;
  name: string;
  address: string | null;
  location: FacilityLocation | null;
  externalIdentities: FacilityExternalIdentityAssertion[];
  operationalStatus: FacilityOperationalAssertion;
}

export type FacilityMatchDecision = 'AUTO_MERGE' | 'REVIEW_REQUIRED' | 'NO_MATCH';

export interface FacilityMatchResult {
  decision: FacilityMatchDecision;
  score: number;
  reasons: string[];
  exactIdentity: string | null;
}

export interface FacilityFreshnessResult {
  staticState: 'CURRENT' | 'STALE';
  effectiveOperationalStatus: FacilityOperationalAssertion;
  warnings: string[];
}

const AUTO_MERGE_THRESHOLD = 0.86;
const REVIEW_THRESHOLD = 0.65;

function parseTime(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISO timestamp: ${value}`);
  return parsed;
}

function assertPositiveTtl(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be > 0`);
}

export function normalizeFacilityText(value: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\b(?:ulica|ul|aleja|al|plac|pl)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizedIdentity(identity: FacilityExternalIdentityAssertion): string {
  const namespace = normalizeFacilityText(identity.namespace).replace(/ /g, '-');
  const id = normalizeFacilityText(identity.id).replace(/ /g, '-');
  if (!namespace || !id) throw new Error('External identity requires namespace and id');
  return `${namespace}:${identity.role.toLowerCase()}:${id}`;
}

export function exactStableFacilityIdentity(assertion: FacilityIdentityAssertion): string | null {
  const point = assertion.externalIdentities.find((identity) => identity.role === 'POINT');
  if (point) return normalizedIdentity(point);

  const venue = assertion.externalIdentities.find((identity) => identity.role === 'VENUE');
  if (venue) return `${normalizedIdentity(venue)}:${assertion.kind.toLowerCase()}`;

  return null;
}

function sameExactIdentity(left: FacilityIdentityAssertion, right: FacilityIdentityAssertion): string | null {
  const leftIds = new Set(
    left.externalIdentities
      .filter((identity) => identity.role === 'POINT')
      .map(normalizedIdentity),
  );
  for (const identity of right.externalIdentities.filter((item) => item.role === 'POINT')) {
    const normalized = normalizedIdentity(identity);
    if (leftIds.has(normalized)) return normalized;
  }

  if (left.kind !== right.kind) return null;
  const leftVenues = new Set(
    left.externalIdentities
      .filter((identity) => identity.role === 'VENUE')
      .map(normalizedIdentity),
  );
  for (const identity of right.externalIdentities.filter((item) => item.role === 'VENUE')) {
    const normalized = normalizedIdentity(identity);
    if (leftVenues.has(normalized)) return `${normalized}:${left.kind.toLowerCase()}`;
  }

  return null;
}

function tokenSimilarity(left: string, right: string): number {
  const a = new Set(normalizeFacilityText(left).split(' ').filter(Boolean));
  const b = new Set(normalizeFacilityText(right).split(' ').filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return (2 * intersection) / (a.size + b.size);
}

function distanceMeters(left: FacilityLocation, right: FacilityLocation): number {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(right.lat - left.lat);
  const dLon = toRad(right.lon - left.lon);
  const lat1 = toRad(left.lat);
  const lat2 = toRad(right.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function facilityFingerprint(assertion: FacilityIdentityAssertion): string {
  const location = assertion.location
    ? `${assertion.location.lat.toFixed(4)},${assertion.location.lon.toFixed(4)}`
    : 'no-location';
  return [
    assertion.kind,
    assertion.municipalityTerc ?? 'no-terc',
    normalizeFacilityText(assertion.address),
    location,
    normalizeFacilityText(assertion.name),
  ].join('|');
}

export function compareFacilityAssertions(
  left: FacilityIdentityAssertion,
  right: FacilityIdentityAssertion,
): FacilityMatchResult {
  const exactIdentity = sameExactIdentity(left, right);
  if (exactIdentity) {
    return { decision: 'AUTO_MERGE', score: 1, reasons: ['EXACT_STABLE_EXTERNAL_ID'], exactIdentity };
  }

  if (left.municipalityTerc && right.municipalityTerc && left.municipalityTerc !== right.municipalityTerc) {
    return { decision: 'NO_MATCH', score: 0, reasons: ['DIFFERENT_MUNICIPALITY'], exactIdentity: null };
  }

  const reasons: string[] = [];
  let score = 0;
  const sameKind = left.kind === right.kind;
  if (sameKind) {
    score += 0.1;
    reasons.push('SAME_KIND');
  } else {
    reasons.push('DIFFERENT_KIND');
  }

  const leftAddress = normalizeFacilityText(left.address);
  const rightAddress = normalizeFacilityText(right.address);
  if (leftAddress && leftAddress === rightAddress) {
    score += 0.4;
    reasons.push('EXACT_NORMALIZED_ADDRESS');
  }

  const nameScore = tokenSimilarity(left.name, right.name);
  score += nameScore * 0.25;
  if (nameScore >= 0.8) reasons.push('HIGH_NAME_SIMILARITY');
  else if (nameScore >= 0.5) reasons.push('MEDIUM_NAME_SIMILARITY');

  if (left.location && right.location) {
    const distance = distanceMeters(left.location, right.location);
    if (distance <= 15) {
      score += 0.3;
      reasons.push('WITHIN_15M');
    } else if (distance <= 40) {
      score += 0.22;
      reasons.push('WITHIN_40M');
    } else if (distance <= 100) {
      score += 0.12;
      reasons.push('WITHIN_100M');
    }
  }

  score = Math.min(1, Number(score.toFixed(4)));

  if (!sameKind) {
    return {
      decision: score >= REVIEW_THRESHOLD ? 'REVIEW_REQUIRED' : 'NO_MATCH',
      score,
      reasons: [...reasons, 'KIND_CONFLICT_BLOCKS_AUTO_MERGE'],
      exactIdentity: null,
    };
  }

  if (score >= AUTO_MERGE_THRESHOLD) {
    return { decision: 'AUTO_MERGE', score, reasons, exactIdentity: null };
  }
  if (score >= REVIEW_THRESHOLD) {
    return { decision: 'REVIEW_REQUIRED', score, reasons, exactIdentity: null };
  }
  return { decision: 'NO_MATCH', score, reasons, exactIdentity: null };
}

export function evaluateFacilityFreshness(
  assertion: FacilityIdentityAssertion,
  now = new Date(),
): FacilityFreshnessResult {
  assertPositiveTtl(assertion.staticFreshnessSeconds, 'staticFreshnessSeconds');
  assertPositiveTtl(assertion.statusFreshnessSeconds, 'statusFreshnessSeconds');

  const nowMs = now.getTime();
  const retrievedMs = parseTime(assertion.retrievedAt);
  const staticFresh = nowMs >= retrievedMs && nowMs - retrievedMs <= assertion.staticFreshnessSeconds * 1000;
  const warnings: string[] = [];
  if (!staticFresh) warnings.push('STATIC_ASSERTION_STALE');

  const status = assertion.operationalStatus;
  if (status.state === 'UNKNOWN') {
    return {
      staticState: staticFresh ? 'CURRENT' : 'STALE',
      effectiveOperationalStatus: status,
      warnings,
    };
  }

  if (!status.observedAt || !status.sourceKey) {
    warnings.push('OPERATIONAL_STATUS_MISSING_PROVENANCE_IGNORED');
    return {
      staticState: staticFresh ? 'CURRENT' : 'STALE',
      effectiveOperationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
      warnings,
    };
  }

  const observedMs = parseTime(status.observedAt);
  const statusFresh = nowMs >= observedMs && nowMs - observedMs <= assertion.statusFreshnessSeconds * 1000;
  if (!statusFresh) {
    warnings.push('OPERATIONAL_STATUS_STALE_IGNORED');
    return {
      staticState: staticFresh ? 'CURRENT' : 'STALE',
      effectiveOperationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
      warnings,
    };
  }

  return {
    staticState: staticFresh ? 'CURRENT' : 'STALE',
    effectiveOperationalStatus: status,
    warnings,
  };
}
