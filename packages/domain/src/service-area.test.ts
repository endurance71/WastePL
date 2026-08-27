import { describe, expect, it } from 'vitest';
import {
  resolveServiceArea,
  type CanonicalAddressRef,
  type IncludeRuleType,
  type ServiceAreaDefinition,
  type ServiceAreaRule,
  type ServiceAreaRuleSelector,
} from './service-area.js';

const address: CanonicalAddressRef = {
  id: 'address-1',
  municipalityId: 'municipality-1',
  localityId: 'locality-1',
  streetId: 'street-1',
  buildingNumber: '12A',
  canonicalText: 'Testowa 12A, Testowo',
};

function selector(
  type: IncludeRuleType,
  overrides: Partial<ServiceAreaRuleSelector> = {},
): ServiceAreaRuleSelector {
  return {
    type,
    localityId: null,
    streetId: null,
    numberFrom: null,
    numberTo: null,
    parity: null,
    explicitNumbers: null,
    addressId: null,
    ...overrides,
  };
}

function rule(
  id: string,
  serviceAreaId: string,
  ruleSelector: ServiceAreaRuleSelector,
  priority = 100,
  kind: ServiceAreaRule['kind'] = 'INCLUDE',
): ServiceAreaRule {
  return { id, serviceAreaId, selector: ruleSelector, priority, kind };
}

function area(
  id: string,
  rules: ServiceAreaRule[],
  municipalityId = address.municipalityId,
): ServiceAreaDefinition {
  return {
    id,
    municipalityId,
    externalKey: id,
    name: id,
    rules,
  };
}

describe('resolveServiceArea', () => {
  it('prefers the most specific matching rule over broader coverage', () => {
    const localityArea = area('locality-area', [
      rule(
        'rule-locality',
        'locality-area',
        selector('LOCALITY', { localityId: address.localityId }),
        999,
      ),
    ]);
    const exactArea = area('exact-area', [
      rule(
        'rule-exact',
        'exact-area',
        selector('EXPLICIT_ADDRESS', { addressId: address.id }),
        1,
      ),
    ]);

    const result = resolveServiceArea(address, [localityArea, exactArea]);

    expect(result.status).toBe('MATCHED');
    if (result.status !== 'MATCHED') return;
    expect(result.serviceArea.id).toBe('exact-area');
    expect(result.matchedBy.ruleType).toBe('EXPLICIT_ADDRESS');
  });

  it('supports odd/even number ranges using the numeric part of a building number', () => {
    const evenArea = area('even-area', [
      rule(
        'rule-even',
        'even-area',
        selector('NUMBER_RANGE', {
          localityId: address.localityId,
          streetId: address.streetId,
          numberFrom: 2,
          numberTo: 20,
          parity: 'EVEN',
        }),
      ),
    ]);

    expect(resolveServiceArea(address, [evenArea]).status).toBe('MATCHED');

    const oddAddress = { ...address, id: 'address-odd', buildingNumber: '13B' };
    expect(resolveServiceArea(oddAddress, [evenArea]).status).toBe('NOT_FOUND');
  });

  it('normalizes explicit building numbers before matching', () => {
    const explicitArea = area('explicit-area', [
      rule(
        'rule-explicit',
        'explicit-area',
        selector('EXPLICIT_NUMBERS', {
          localityId: address.localityId,
          streetId: address.streetId,
          explicitNumbers: ['12 a', '14'],
        }),
      ),
    ]);

    expect(resolveServiceArea(address, [explicitArea]).status).toBe('MATCHED');
  });

  it('subtracts matching EXCLUDE rules from otherwise matching coverage', () => {
    const excludedArea = area('excluded-area', [
      rule(
        'include-street',
        'excluded-area',
        selector('STREET', {
          localityId: address.localityId,
          streetId: address.streetId,
        }),
      ),
      rule(
        'exclude-exact',
        'excluded-area',
        selector('EXPLICIT_ADDRESS', { addressId: address.id }),
        100,
        'EXCLUDE',
      ),
    ]);

    expect(resolveServiceArea(address, [excludedArea]).status).toBe('NOT_FOUND');
  });

  it('returns an explicit ambiguity for equally ranked conflicting service areas', () => {
    const left = area('area-a', [
      rule(
        'rule-a',
        'area-a',
        selector('STREET', {
          localityId: address.localityId,
          streetId: address.streetId,
        }),
        100,
      ),
    ]);
    const right = area('area-b', [
      rule(
        'rule-b',
        'area-b',
        selector('STREET', {
          localityId: address.localityId,
          streetId: address.streetId,
        }),
        100,
      ),
    ]);

    const result = resolveServiceArea(address, [right, left]);

    expect(result.status).toBe('AMBIGUOUS');
    if (result.status !== 'AMBIGUOUS') return;
    expect(result.candidates.map((candidate) => candidate.serviceArea.id)).toEqual([
      'area-a',
      'area-b',
    ]);
    expect(result.candidates.every((candidate) => candidate.matchedBy.ruleType === 'STREET')).toBe(true);
  });

  it('uses priority only after specificity and resolves a non-tied top rule', () => {
    const low = area('low', [
      rule(
        'low-rule',
        'low',
        selector('LOCALITY', { localityId: address.localityId }),
        10,
      ),
    ]);
    const high = area('high', [
      rule(
        'high-rule',
        'high',
        selector('LOCALITY', { localityId: address.localityId }),
        20,
      ),
    ]);

    const result = resolveServiceArea(address, [low, high]);
    expect(result.status).toBe('MATCHED');
    if (result.status !== 'MATCHED') return;
    expect(result.serviceArea.id).toBe('high');
    expect(result.matchedBy.priority).toBe(20);
  });
});
