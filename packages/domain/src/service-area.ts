export type IncludeRuleType =
  | 'EXPLICIT_ADDRESS'
  | 'EXPLICIT_NUMBERS'
  | 'NUMBER_RANGE'
  | 'STREET'
  | 'LOCALITY'
  | 'MUNICIPALITY';

export type NumberParity = 'ALL' | 'ODD' | 'EVEN';

export interface CanonicalAddressRef {
  id: string;
  municipalityId: string;
  localityId: string;
  streetId: string | null;
  buildingNumber: string;
  canonicalText: string;
}

export interface ServiceAreaRuleSelector {
  type: IncludeRuleType;
  localityId: string | null;
  streetId: string | null;
  numberFrom: number | null;
  numberTo: number | null;
  parity: NumberParity | null;
  explicitNumbers: readonly string[] | null;
  addressId: string | null;
}

export interface ServiceAreaRule {
  id: string;
  serviceAreaId: string;
  kind: 'INCLUDE' | 'EXCLUDE';
  priority: number;
  selector: ServiceAreaRuleSelector;
}

export interface ServiceAreaDefinition {
  id: string;
  municipalityId: string;
  externalKey: string | null;
  name: string;
  rules: readonly ServiceAreaRule[];
}

export interface ServiceAreaMatchExplanation {
  ruleId: string;
  ruleType: IncludeRuleType;
  priority: number;
  specificity: number;
}

export interface ResolvedServiceArea {
  id: string;
  externalKey: string | null;
  name: string;
}

export type ServiceAreaResolution =
  | {
      status: 'MATCHED';
      address: CanonicalAddressRef;
      serviceArea: ResolvedServiceArea;
      matchedBy: ServiceAreaMatchExplanation;
    }
  | {
      status: 'AMBIGUOUS';
      address: CanonicalAddressRef;
      candidates: ReadonlyArray<{
        serviceArea: ResolvedServiceArea;
        matchedBy: ServiceAreaMatchExplanation;
      }>;
    }
  | {
      status: 'NOT_FOUND';
      address: CanonicalAddressRef;
    };

const SPECIFICITY: Record<IncludeRuleType, number> = {
  EXPLICIT_ADDRESS: 600,
  EXPLICIT_NUMBERS: 500,
  NUMBER_RANGE: 400,
  STREET: 300,
  LOCALITY: 200,
  MUNICIPALITY: 100,
};

function normalizeBuildingNumber(value: string): string {
  return value.trim().toLocaleUpperCase('pl-PL').replace(/\s+/g, '');
}

function numericBuildingNumber(value: string): number | null {
  const match = /^(\d+)/.exec(normalizeBuildingNumber(value));
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function matchesScope(address: CanonicalAddressRef, selector: ServiceAreaRuleSelector): boolean {
  if (selector.localityId !== null && selector.localityId !== address.localityId) return false;
  if (selector.streetId !== null && selector.streetId !== address.streetId) return false;
  return true;
}

function matchesParity(number: number, parity: NumberParity | null): boolean {
  if (parity === null || parity === 'ALL') return true;
  return parity === 'ODD' ? number % 2 === 1 : number % 2 === 0;
}

export function selectorMatchesAddress(
  address: CanonicalAddressRef,
  area: Pick<ServiceAreaDefinition, 'municipalityId'>,
  selector: ServiceAreaRuleSelector,
): boolean {
  switch (selector.type) {
    case 'MUNICIPALITY':
      return address.municipalityId === area.municipalityId;
    case 'LOCALITY':
      return selector.localityId !== null && selector.localityId === address.localityId;
    case 'STREET':
      return (
        selector.streetId !== null &&
        selector.streetId === address.streetId &&
        matchesScope(address, selector)
      );
    case 'NUMBER_RANGE': {
      if (!matchesScope(address, selector)) return false;
      if (selector.numberFrom === null || selector.numberTo === null) return false;
      const number = numericBuildingNumber(address.buildingNumber);
      if (number === null) return false;
      return (
        number >= selector.numberFrom &&
        number <= selector.numberTo &&
        matchesParity(number, selector.parity)
      );
    }
    case 'EXPLICIT_NUMBERS': {
      if (!matchesScope(address, selector) || selector.explicitNumbers === null) return false;
      const target = normalizeBuildingNumber(address.buildingNumber);
      return selector.explicitNumbers.some(
        (value) => normalizeBuildingNumber(value) === target,
      );
    }
    case 'EXPLICIT_ADDRESS':
      return selector.addressId !== null && selector.addressId === address.id;
  }
}

interface RankedCandidate {
  area: ServiceAreaDefinition;
  rule: ServiceAreaRule;
  specificity: number;
}

function compareRules(a: RankedCandidate, b: RankedCandidate): number {
  return (
    b.specificity - a.specificity ||
    b.rule.priority - a.rule.priority ||
    a.rule.id.localeCompare(b.rule.id)
  );
}

function explanation(candidate: RankedCandidate): ServiceAreaMatchExplanation {
  return {
    ruleId: candidate.rule.id,
    ruleType: candidate.rule.selector.type,
    priority: candidate.rule.priority,
    specificity: candidate.specificity,
  };
}

function resolvedArea(area: ServiceAreaDefinition): ResolvedServiceArea {
  return { id: area.id, externalKey: area.externalKey, name: area.name };
}

export function resolveServiceArea(
  address: CanonicalAddressRef,
  areas: readonly ServiceAreaDefinition[],
): ServiceAreaResolution {
  const candidates: RankedCandidate[] = [];

  for (const area of areas) {
    if (area.municipalityId !== address.municipalityId) continue;

    const excluded = area.rules.some(
      (rule) =>
        rule.kind === 'EXCLUDE' && selectorMatchesAddress(address, area, rule.selector),
    );
    if (excluded) continue;

    const matchingIncludes = area.rules
      .filter(
        (rule) =>
          rule.kind === 'INCLUDE' && selectorMatchesAddress(address, area, rule.selector),
      )
      .map((rule) => ({
        area,
        rule,
        specificity: SPECIFICITY[rule.selector.type],
      }))
      .sort(compareRules);

    const top = matchingIncludes[0];
    if (top) candidates.push(top);
  }

  candidates.sort((a, b) => {
    const byRank = compareRules(a, b);
    return byRank || a.area.id.localeCompare(b.area.id);
  });

  const top = candidates[0];
  if (!top) return { status: 'NOT_FOUND', address };

  const tied = candidates.filter(
    (candidate) =>
      candidate.specificity === top.specificity &&
      candidate.rule.priority === top.rule.priority,
  );

  if (tied.length > 1) {
    return {
      status: 'AMBIGUOUS',
      address,
      candidates: tied.map((candidate) => ({
        serviceArea: resolvedArea(candidate.area),
        matchedBy: explanation(candidate),
      })),
    };
  }

  return {
    status: 'MATCHED',
    address,
    serviceArea: resolvedArea(top.area),
    matchedBy: explanation(top),
  };
}
