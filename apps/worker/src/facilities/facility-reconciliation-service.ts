import {
  compareFacilityAssertions,
  type FacilityIdentityAssertion,
  type FacilityMatchResult,
} from '@wastepl/domain';

export interface ReconciliationCandidate {
  facilityId: string;
  assertion: FacilityIdentityAssertion;
}

export interface FacilityReconciliationRepository {
  findExactIdentityCandidates(assertion: FacilityIdentityAssertion): Promise<ReconciliationCandidate[]>;
  findFuzzyCandidates(assertion: FacilityIdentityAssertion): Promise<ReconciliationCandidate[]>;
  attachAssertion(assertionId: string, facilityId: string): Promise<void>;
  createCanonicalFacility(assertionId: string): Promise<string>;
  queueReview(
    assertionId: string,
    candidateFacilityId: string,
    result: FacilityMatchResult,
  ): Promise<void>;
}

export interface FacilityReconciliationOutcome {
  state: 'ATTACHED' | 'CREATED' | 'REVIEW_REQUIRED';
  facilityId: string | null;
  reviewCandidateIds: string[];
}

interface ScoredCandidate extends ReconciliationCandidate {
  result: FacilityMatchResult;
}

function scoreCandidates(
  assertion: FacilityIdentityAssertion,
  candidates: ReconciliationCandidate[],
): ScoredCandidate[] {
  return candidates
    .map((candidate) => ({ ...candidate, result: compareFacilityAssertions(assertion, candidate.assertion) }))
    .filter((candidate) => candidate.result.decision !== 'NO_MATCH')
    .sort((a, b) => {
      if (b.result.score !== a.result.score) return b.result.score - a.result.score;
      return a.facilityId.localeCompare(b.facilityId);
    });
}

export class FacilityReconciliationService {
  constructor(private readonly repository: FacilityReconciliationRepository) {}

  async reconcile(
    assertionId: string,
    assertion: FacilityIdentityAssertion,
  ): Promise<FacilityReconciliationOutcome> {
    const exact = scoreCandidates(
      assertion,
      await this.repository.findExactIdentityCandidates(assertion),
    ).filter((candidate) => candidate.result.decision === 'AUTO_MERGE');

    if (exact.length === 1) {
      await this.repository.attachAssertion(assertionId, exact[0]!.facilityId);
      return { state: 'ATTACHED', facilityId: exact[0]!.facilityId, reviewCandidateIds: [] };
    }

    if (exact.length > 1) {
      for (const candidate of exact) {
        await this.repository.queueReview(assertionId, candidate.facilityId, {
          ...candidate.result,
          decision: 'REVIEW_REQUIRED',
          reasons: [...candidate.result.reasons, 'EXACT_ID_POINTS_TO_MULTIPLE_CANONICAL_FACILITIES'],
        });
      }
      return {
        state: 'REVIEW_REQUIRED',
        facilityId: null,
        reviewCandidateIds: exact.map((candidate) => candidate.facilityId),
      };
    }

    const fuzzy = scoreCandidates(assertion, await this.repository.findFuzzyCandidates(assertion));
    const auto = fuzzy.filter((candidate) => candidate.result.decision === 'AUTO_MERGE');
    const review = fuzzy.filter((candidate) => candidate.result.decision === 'REVIEW_REQUIRED');

    if (auto.length === 1 && review.length === 0) {
      await this.repository.attachAssertion(assertionId, auto[0]!.facilityId);
      return { state: 'ATTACHED', facilityId: auto[0]!.facilityId, reviewCandidateIds: [] };
    }

    if (auto.length > 0 || review.length > 0) {
      const ambiguous = [...auto, ...review]
        .sort((a, b) => b.result.score - a.result.score || a.facilityId.localeCompare(b.facilityId));
      for (const candidate of ambiguous) {
        await this.repository.queueReview(assertionId, candidate.facilityId, {
          ...candidate.result,
          decision: 'REVIEW_REQUIRED',
          reasons: candidate.result.decision === 'AUTO_MERGE'
            ? [...candidate.result.reasons, 'MULTIPLE_PLAUSIBLE_CANONICAL_FACILITIES']
            : candidate.result.reasons,
        });
      }
      return {
        state: 'REVIEW_REQUIRED',
        facilityId: null,
        reviewCandidateIds: ambiguous.map((candidate) => candidate.facilityId),
      };
    }

    const facilityId = await this.repository.createCanonicalFacility(assertionId);
    return { state: 'CREATED', facilityId, reviewCandidateIds: [] };
  }
}
