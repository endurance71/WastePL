import { describe, expect, it } from 'vitest';
import {
  evaluateAddressResolution,
  runAddressCoverageCensus,
  formatCensusMarkdown,
  PILOT_MUNICIPALITIES,
} from './address-coverage-census.js';
import type { CanonicalAddressRef, ServiceAreaDefinition, ServiceAreaRule } from '@wastepl/domain';

describe('Address Coverage Census v2', () => {
  it('correctly maps resolveServiceArea status to AddressResolutionStatus', () => {
    const address: CanonicalAddressRef = {
      id: 'addr-1',
      municipalityId: 'm-1',
      localityId: 'loc-1',
      streetId: null,
      buildingNumber: '1',
      canonicalText: 'Dworek 1',
    };

    const matchedRule: ServiceAreaRule = {
      id: 'r-1',
      serviceAreaId: 'sa-1',
      kind: 'INCLUDE',
      priority: 50,
      selector: {
        type: 'LOCALITY',
        localityId: 'loc-1',
        streetId: null,
        numberFrom: null,
        numberTo: null,
        parity: null,
        explicitNumbers: null,
        addressId: null,
      },
    };

    const matchedArea: ServiceAreaDefinition = {
      id: 'sa-1',
      municipalityId: 'm-1',
      externalKey: 'bedzino-trasa-1-safe-dworek',
      name: 'Dworek',
      rules: [matchedRule],
    };

    expect(evaluateAddressResolution(address, [matchedArea])).toBe('SUPPORTED');

    const unrelatedRule: ServiceAreaRule = {
      id: 'r-2',
      serviceAreaId: 'sa-2',
      kind: 'INCLUDE',
      priority: 50,
      selector: {
        type: 'LOCALITY',
        localityId: 'loc-999',
        streetId: null,
        numberFrom: null,
        numberTo: null,
        parity: null,
        explicitNumbers: null,
        addressId: null,
      },
    };

    const unrelatedArea: ServiceAreaDefinition = {
      id: 'sa-2',
      municipalityId: 'm-1',
      externalKey: 'other-area',
      name: 'Other',
      rules: [unrelatedRule],
    };

    expect(evaluateAddressResolution(address, [unrelatedArea])).toBe('UNSUPPORTED');

    const ambiguousRule1: ServiceAreaRule = {
      id: 'r-a1',
      serviceAreaId: 'sa-a1',
      kind: 'INCLUDE',
      priority: 50,
      selector: {
        type: 'LOCALITY',
        localityId: 'loc-1',
        streetId: null,
        numberFrom: null,
        numberTo: null,
        parity: null,
        explicitNumbers: null,
        addressId: null,
      },
    };

    const ambiguousRule2: ServiceAreaRule = {
      id: 'r-a2',
      serviceAreaId: 'sa-a2',
      kind: 'INCLUDE',
      priority: 50,
      selector: {
        type: 'LOCALITY',
        localityId: 'loc-1',
        streetId: null,
        numberFrom: null,
        numberTo: null,
        parity: null,
        explicitNumbers: null,
        addressId: null,
      },
    };

    const ambiguousArea1: ServiceAreaDefinition = {
      id: 'sa-a1',
      municipalityId: 'm-1',
      externalKey: 'area-a1',
      name: 'Area A1',
      rules: [ambiguousRule1],
    };

    const ambiguousArea2: ServiceAreaDefinition = {
      id: 'sa-a2',
      municipalityId: 'm-1',
      externalKey: 'area-a2',
      name: 'Area A2',
      rules: [ambiguousRule2],
    };

    expect(evaluateAddressResolution(address, [ambiguousArea1, ambiguousArea2])).toBe('AMBIGUOUS');
  });

  it('runs address coverage census across all 8 pilot municipalities deterministically', async () => {
    const report = await runAddressCoverageCensus();

    expect(report.censusEngineVersion).toBe('2.0.0');
    expect(report.totalPilotAddresses).toBe(25030);
    expect(report.totalSupported).toBe(11303);
    expect(report.totalUnsupported).toBe(13727);
    expect(report.totalAmbiguous).toBe(0);
    expect(report.totalErrors).toBe(0);
    expect(report.overallCoveragePercent).toBe(45.16);

    expect(report.municipalities).toHaveLength(8);
    for (const item of report.municipalities) {
      expect(item.totalPrgAddresses).toBeGreaterThan(0);
      expect(item.supportedAddresses).toBeGreaterThan(0);
      expect(item.unsupportedAddresses).toBe(item.totalPrgAddresses - item.supportedAddresses);
      expect(item.coveragePercent).toBeGreaterThan(0);
      expect(item.backlogBlockers.length).toBeGreaterThan(0);
    }

    const markdown = formatCensusMarkdown(report);
    expect(markdown).toContain('Address Coverage Census — Raport Pokrycia Adresowego');
    expect(markdown).toContain('45.16%');
    expect(markdown).toContain('Koszalin');
    expect(markdown).toContain('Będzino');
  });

  it('preserves all 8 pilot municipalities with official TERC codes', () => {
    expect(PILOT_MUNICIPALITIES).toHaveLength(8);
    const tercs = PILOT_MUNICIPALITIES.map((m) => m.terc);
    expect(tercs).toEqual([
      '3261011', // Koszalin
      '3209052', // Manowo
      '3209033', // Bobolice
      '3209082', // Świeszyno
      '3201053', // Tychowo
      '3209073', // Sianów
      '3209063', // Polanów
      '3209012', // Będzino
    ]);
  });
});
