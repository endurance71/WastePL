import { describe, expect, it } from 'vitest';
import {
  evaluateAddressResolution,
  runAddressCoverageCensus,
  formatCensusMarkdown,
  PILOT_MUNICIPALITIES,
} from './address-coverage-census.js';
import type { CanonicalAddressRef, ServiceAreaDefinition, ServiceAreaRule } from '@wastepl/domain';

function localityRule(id: string, serviceAreaId: string, localityId: string): ServiceAreaRule {
  return {
    id,
    serviceAreaId,
    kind: 'INCLUDE',
    priority: 50,
    selector: {
      type: 'LOCALITY',
      localityId,
      streetId: null,
      numberFrom: null,
      numberTo: null,
      parity: null,
      explicitNumbers: null,
      addressId: null,
    },
  };
}

function area(id: string, externalKey: string, localityId: string): ServiceAreaDefinition {
  return {
    id,
    municipalityId: 'm-1',
    externalKey,
    name: externalKey,
    rules: [localityRule(`rule-${id}`, id, localityId)],
  };
}

describe('Address Coverage Audit v2.1', () => {
  it('maps resolver outcomes for individual canonical addresses', () => {
    const address: CanonicalAddressRef = {
      id: 'addr-1',
      municipalityId: 'm-1',
      localityId: 'loc-1',
      streetId: null,
      buildingNumber: '1',
      canonicalText: 'Dworek 1',
    };

    expect(evaluateAddressResolution(address, [area('sa-1', 'matched', 'loc-1')])).toBe('SUPPORTED');
    expect(evaluateAddressResolution(address, [area('sa-2', 'other', 'loc-999')])).toBe('UNSUPPORTED');
    expect(
      evaluateAddressResolution(address, [
        area('sa-a1', 'ambiguous-a', 'loc-1'),
        area('sa-a2', 'ambiguous-b', 'loc-1'),
      ]),
    ).toBe('AMBIGUOUS');
  });

  it('reports audited reference-pack coverage without claiming a full-population resolver census', async () => {
    const report = await runAddressCoverageCensus();

    expect(report.censusEngineVersion).toBe('2.1.0');
    expect(report.measurementMode).toBe('AUDITED_REFERENCE_PACKS');
    expect(report.qualityScope).toBe('AUDITED_REFERENCE_PACKS_ONLY');
    expect(report.fullPopulationResolutionVerified).toBe(false);

    expect(report.totalPilotAddresses).toBe(25030);
    expect(report.totalAuditedAddresses).toBe(12816);
    expect(report.totalSupported).toBe(12816);
    expect(report.totalRemainingUnaudited).toBe(12214);
    expect(report.totalUnsupported).toBe(12214);
    expect(report.totalAmbiguous).toBe(0);
    expect(report.totalErrors).toBe(0);
    expect(report.overallCoveragePercent).toBe(51.2);

    expect(report.municipalities).toHaveLength(8);
    for (const item of report.municipalities) {
      expect(item.totalPrgAddresses).toBeGreaterThan(0);
      expect(item.auditedAddresses).toBe(item.supportedAddresses);
      expect(item.remainingUnauditedAddresses).toBe(
        item.totalPrgAddresses - item.supportedAddresses,
      );
      expect(item.unsupportedAddresses).toBe(item.remainingUnauditedAddresses);
      expect(item.coveragePercent).toBeGreaterThan(0);
      expect(item.backlogBlockers.length).toBeGreaterThan(0);
    }
  });

  it('makes audit scope and P0 full-census limitation explicit in generated Markdown', async () => {
    const report = await runAddressCoverageCensus();
    const markdown = formatCensusMarkdown(report);

    expect(markdown).toContain('Address Coverage Audit');
    expect(markdown).toContain('AUDITED_REFERENCE_PACKS');
    expect(markdown).toContain('Full-population resolution verified: `false`');
    expect(markdown).toContain('P0 #144');
    expect(markdown).toContain('12 816');
    expect(markdown).toContain('51.2%');
    expect(markdown).toContain('Sianów');
    expect(markdown).toContain('odpady segregowane');
    expect(markdown).toContain('`OTHER`');
    expect(markdown).not.toContain('Census obejmuje całą populację');
    expect(markdown).not.toContain('gwarantuje 100% poprawności');
    expect(markdown).not.toContain('rozbicie odpadów segregowanych na 3 frakcje');
  });

  it('preserves all 8 pilot municipalities with authoritative current TERC codes', () => {
    expect(PILOT_MUNICIPALITIES).toHaveLength(8);
    expect(PILOT_MUNICIPALITIES.map((municipality) => municipality.terc)).toEqual([
      '3261011', // Koszalin
      '3209042', // Manowo
      '3209033', // Bobolice
      '3209082', // Świeszyno
      '3201043', // Tychowo (gmina miejsko-wiejska)
      '3209073', // Sianów
      '3209063', // Polanów
      '3209012', // Będzino
    ]);
  });
});
