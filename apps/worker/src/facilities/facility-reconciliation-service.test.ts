import { describe, expect, it } from 'vitest';
import type { FacilityIdentityAssertion } from '@wastepl/domain';
import {
  FacilityReconciliationService,
  type FacilityReconciliationRepository,
  type ReconciliationCandidate,
} from './facility-reconciliation-service.js';

function assertion(overrides: Partial<FacilityIdentityAssertion> = {}): FacilityIdentityAssertion {
  return {
    sourceKey: 'incoming',
    sourceArtifactId: 'artifact-incoming',
    sourceAuthority: 400,
    retrievedAt: '2026-08-27T18:00:00Z',
    staticFreshnessSeconds: 86400,
    statusFreshnessSeconds: 3600,
    kind: 'PSZOK',
    municipalityTerc: '3261011',
    name: 'PSZOK Koszalin Komunalna 5',
    address: 'Komunalna 5, Koszalin',
    location: { lat: 54.212266, lon: 16.183616 },
    externalIdentities: [],
    operationalStatus: { state: 'UNKNOWN', observedAt: null, sourceKey: null },
    ...overrides,
  };
}

class FakeRepository implements FacilityReconciliationRepository {
  exact: ReconciliationCandidate[] = [];
  fuzzy: ReconciliationCandidate[] = [];
  attached: Array<{ assertionId: string; facilityId: string }> = [];
  reviews: Array<{ assertionId: string; facilityId: string }> = [];
  created = 0;

  async findExactIdentityCandidates(): Promise<ReconciliationCandidate[]> { return this.exact; }
  async findFuzzyCandidates(): Promise<ReconciliationCandidate[]> { return this.fuzzy; }
  async attachAssertion(assertionId: string, facilityId: string): Promise<void> {
    this.attached.push({ assertionId, facilityId });
  }
  async createCanonicalFacility(): Promise<string> {
    this.created += 1;
    return `new-${this.created}`;
  }
  async queueReview(assertionId: string, facilityId: string): Promise<void> {
    this.reviews.push({ assertionId, facilityId });
  }
}

describe('FacilityReconciliationService', () => {
  it('attaches immediately on one exact stable identity', async () => {
    const repo = new FakeRepository();
    const incoming = assertion({
      externalIdentities: [{ namespace: 'operator', id: 'point-1', role: 'POINT' }],
    });
    repo.exact = [{
      facilityId: 'facility-1',
      assertion: assertion({
        sourceKey: 'existing',
        sourceArtifactId: 'artifact-existing',
        externalIdentities: [{ namespace: 'operator', id: 'point-1', role: 'POINT' }],
      }),
    }];

    const outcome = await new FacilityReconciliationService(repo).reconcile('assertion-1', incoming);
    expect(outcome).toEqual({ state: 'ATTACHED', facilityId: 'facility-1', reviewCandidateIds: [] });
    expect(repo.reviews).toHaveLength(0);
  });

  it('queues review when one exact identity points to multiple canonicals', async () => {
    const repo = new FakeRepository();
    const incoming = assertion({
      externalIdentities: [{ namespace: 'operator', id: 'point-1', role: 'POINT' }],
    });
    const existing = assertion({
      sourceKey: 'existing',
      sourceArtifactId: 'artifact-existing',
      externalIdentities: [{ namespace: 'operator', id: 'point-1', role: 'POINT' }],
    });
    repo.exact = [
      { facilityId: 'facility-a', assertion: existing },
      { facilityId: 'facility-b', assertion: { ...existing, sourceArtifactId: 'artifact-existing-b' } },
    ];

    const outcome = await new FacilityReconciliationService(repo).reconcile('assertion-1', incoming);
    expect(outcome.state).toBe('REVIEW_REQUIRED');
    expect(repo.attached).toHaveLength(0);
    expect(repo.reviews.map((review) => review.facilityId)).toEqual(['facility-a', 'facility-b']);
  });

  it('attaches one unique high-confidence fuzzy candidate', async () => {
    const repo = new FakeRepository();
    repo.fuzzy = [{
      facilityId: 'facility-1',
      assertion: assertion({
        sourceKey: 'existing',
        sourceArtifactId: 'artifact-existing',
        name: 'PSZOK Koszalin — Komunalna 5',
        address: 'ul. Komunalna 5, Koszalin',
        location: { lat: 54.21231, lon: 16.18367 },
      }),
    }];

    const outcome = await new FacilityReconciliationService(repo).reconcile('assertion-1', assertion());
    expect(outcome.state).toBe('ATTACHED');
    expect(outcome.facilityId).toBe('facility-1');
  });

  it('queues review instead of merging a plausible kind conflict', async () => {
    const repo = new FakeRepository();
    const incoming = assertion({
      kind: 'DEPOSIT_RVM',
      name: 'Sklep X automat',
      address: 'Zwycięstwa 10, Koszalin',
      location: { lat: 54.19, lon: 16.18 },
    });
    repo.fuzzy = [{
      facilityId: 'facility-manual',
      assertion: assertion({
        sourceKey: 'manual',
        sourceArtifactId: 'artifact-manual',
        kind: 'DEPOSIT_MANUAL',
        name: 'Sklep X punkt zwrotu',
        address: 'Zwycięstwa 10, Koszalin',
        location: { lat: 54.19, lon: 16.18 },
      }),
    }];

    const outcome = await new FacilityReconciliationService(repo).reconcile('assertion-1', incoming);
    expect(outcome.state).toBe('REVIEW_REQUIRED');
    expect(repo.attached).toHaveLength(0);
    expect(repo.reviews).toHaveLength(1);
  });

  it('creates a new canonical when no credible candidate exists', async () => {
    const repo = new FakeRepository();
    repo.fuzzy = [{
      facilityId: 'far-away',
      assertion: assertion({
        name: 'Unrelated point',
        address: 'Szczecińska 99, Koszalin',
        location: { lat: 54.21, lon: 16.1 },
      }),
    }];

    const outcome = await new FacilityReconciliationService(repo).reconcile('assertion-1', assertion());
    expect(outcome).toEqual({ state: 'CREATED', facilityId: 'new-1', reviewCandidateIds: [] });
  });
});
