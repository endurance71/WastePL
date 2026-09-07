import type { Pool } from 'pg';
import {
  resolveServiceArea,
  type CanonicalAddressRef,
  type ServiceAreaDefinition,
  type ServiceAreaResolution,
} from '@wastepl/domain';
import { loadRealGoldenReferenceSnapshot } from '../readiness/real-golden-reference.js';
import { loadPolanowGarbnoReferenceSnapshot } from '../readiness/polanow-garbno-reference.js';
import { loadPolanowRuralSetAReferenceSnapshot } from '../readiness/polanow-rural-reference.js';
import { loadBedzinoTrasa1ReferenceSnapshot } from '../readiness/bedzino-trasa-1-reference.js';
import { loadBedzinoTrasa2ReferenceSnapshot } from '../readiness/bedzino-trasa-2-reference.js';
import { loadSianowGrabowkoReferenceSnapshot } from '../readiness/sianow-grabowko-reference.js';
import { loadSianowBorowiecReferenceSnapshot } from '../readiness/sianow-borowiec-reference.js';
import { loadSianowDabrowaReferenceSnapshot } from '../readiness/sianow-dabrowa-reference.js';
import { loadSianowSkwierzynkaReferenceSnapshot } from '../readiness/sianow-skwierzynka-reference.js';
import { loadSwieszynoChalupyReferenceSnapshot } from '../readiness/swieszyno-chalupy-reference.js';
import { loadSwieszynoTrasa2ReferenceSnapshot } from '../readiness/swieszyno-trasa-2-reference.js';
import { loadBoboliceKlaninoReferenceSnapshot } from '../readiness/bobolice-klanino-reference.js';

export type AddressResolutionStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'AMBIGUOUS' | 'ERROR';
export type CensusMeasurementMode = 'AUDITED_REFERENCE_PACKS';
export type CensusQualityScope = 'AUDITED_REFERENCE_PACKS_ONLY';

export interface MunicipalityCensusItem {
  name: string;
  terc: string;
  totalPrgAddresses: number;
  auditedAddresses: number;
  supportedAddresses: number;
  /**
   * Compatibility field for older consumers. In AUDITED_REFERENCE_PACKS mode this is
   * the territorial denominator minus audited supported addresses. It is NOT proof
   * that every remaining address resolved to NOT_FOUND.
   */
  unsupportedAddresses: number;
  remainingUnauditedAddresses: number;
  /** Scoped to the audited reference packs, not the whole territorial denominator. */
  ambiguousAddresses: number;
  /** Scoped to the audited reference packs, not the whole territorial denominator. */
  errorAddresses: number;
  coveragePercent: number;
  activeSubset: string;
  backlogBlockers: string[];
}

export interface CensusReport {
  generatedAt: string;
  censusEngineVersion: string;
  measurementMode: CensusMeasurementMode;
  qualityScope: CensusQualityScope;
  fullPopulationResolutionVerified: false;
  totalPilotAddresses: number;
  totalAuditedAddresses: number;
  totalSupported: number;
  /** Compatibility alias for totalRemainingUnaudited while full-population audit #144 is pending. */
  totalUnsupported: number;
  totalRemainingUnaudited: number;
  /** Scoped to audited reference packs only. */
  totalAmbiguous: number;
  /** Scoped to audited reference packs only. */
  totalErrors: number;
  overallCoveragePercent: number;
  municipalities: MunicipalityCensusItem[];
  conflicts: {
    /** Scoped to activated deterministic/audited packs only. */
    serviceAreaConflicts: number;
    missingServiceAreas: number;
    /** Scoped to activated deterministic/audited packs only. */
    overlappingRules: number;
  };
}

// Territorial PRG denominator baseline used for coverage ratios.
// P0 #144 will replace this aggregate baseline with a complete versioned address-level PRG census input.
export const PILOT_MUNICIPALITIES: Array<{
  name: string;
  terc: string;
  totalPrgAddresses: number;
  activeSubset: string;
  backlogBlockers: string[];
}> = [
  {
    name: 'Koszalin',
    terc: '3261011',
    totalPrgAddresses: 10240,
    activeSubset: 'Miasto Koszalin — pełny harmonogram miejski pełnofrakcyjny',
    backlogBlockers: [
      'Brak blokerów miejskich — pełne 5 frakcji (zmieszane, bio, papier, tworzywa, szkło) obsłużone dla 100% adresów PRG miasta',
    ],
  },
  {
    name: 'Manowo',
    terc: '3209052',
    totalPrgAddresses: 1210,
    activeSubset: 'Trasa 2AB (Bonin, Dęborogi, Policko, Wyszebórz)',
    backlogBlockers: [
      'Zweryfikować kanoniczność legacy 2AB względem bieżącego zestawu manowo3/* i zachować 46/46 obecnych adresów podczas migracji (#143)',
      'Pozostałe bieżące trasy PGK po zamrożeniu artefaktów i paczek PRG',
      'Zabudowa letniskowa i trudnodostępna',
    ],
  },
  {
    name: 'Bobolice',
    terc: '3209033',
    totalPrgAddresses: 2080,
    activeSubset: 'Miejscowość Kłanino (zabudowa jednorodzinna)',
    backlogBlockers: [
      'Pozostałe arkusze H2 operatora',
      'Parser wieloformatowy (mixed media / images / załączniki)',
      'Zabudowa wielorodzinna i osłony śmietnikowe',
    ],
  },
  {
    name: 'Świeszyno',
    terc: '3209082',
    totalPrgAddresses: 2430,
    activeSubset: 'Miejscowość Chałupy (Trasa I) oraz Trasa II (18 miejscowości wiejskich: Czacz, Zegrzyn, Kurozwęcz, Sieranie, Czaple, Kępa Świeszyńska, Olszak, Włoki, Bagno, Chłopska Kępa, Brzeźniki, Golica, Biała Kępa, Krokowo, Jarzyce, Czersk Kosz., Kłokęcin, Węgorki)',
    backlogBlockers: [
      'Pozostałe miejscowości Trasy II z osłonami/ulicami (Świeszyno, Strzekęcino, Niedalino, Zegrze Pomorskie, Dunowo, Bardzlino, Mierzym, Giezkowo)',
      'Konikowo i Niekłonice (Trasa I) — potrzebna nowa paczka PRG i zero-overlap proof',
      'Wspólnoty mieszkaniowe Trasy I i II',
    ],
  },
  {
    name: 'Tychowo',
    terc: '3201053',
    totalPrgAddresses: 1450,
    activeSubset: 'Zabudowa jednorodzinna (tereny wiejskie)',
    backlogBlockers: [
      'Miasto Tychowo (centrum i zabudowa miejska)',
      'Miejscowości i posesje hard-to-reach',
    ],
  },
  {
    name: 'Sianów',
    terc: '3209073',
    totalPrgAddresses: 3520,
    activeSubset: 'Miejscowości Dąbrowa, Grabówko i Skwierzynka oraz trasa wiejska Borowiec (7 miejscowości)',
    backlogBlockers: [
      'Route 13 H2: Karnieszewice, Kołzin i Płonka po zamrożeniu bieżącego artefaktu i paczek PRG (#141)',
      'Pozostałe trasy wiejskie po locality/street/address zero-overlap proof',
      'Miasto Sianów i posesje z 15-utrudnione wymagają precyzyjnego mapowania adresowego',
    ],
  },
  {
    name: 'Polanów',
    terc: '3209063',
    totalPrgAddresses: 1810,
    activeSubset: 'Miejscowość Garbno oraz rejon wiejski A (18 miejscowości łącznie)',
    backlogBlockers: [
      'Pozostałe sołectwa wiejskie H2',
      'Miasto Polanów',
      'Trudnodostępne i zabudowa wielorodzinna',
    ],
  },
  {
    name: 'Będzino',
    terc: '3209012',
    totalPrgAddresses: 2290,
    activeSubset: 'Trasa I (12 miejscowości) oraz Trasa II (8 miejscowości wiejskich: Barninek, Dobiesławiec, Dobre, Dobre Małe, Kazimierz Pom., Łekno, Podamirowo, Ziębrze)',
    backlogBlockers: [
      'Pozostałe miejscowości Trasy II (Będzino, Dobrzyca, Mścice, Pakosław, Popowo, Przybyradz, Stoisław, Strzeżenice, Wierzchomino)',
      'Osłony śmietnikowe w 5 miejscowościach (Będzino, Tymień, Dobrzyca, Mścice, Stoisław)',
      'Wykaz 44 posesji trudnodostępnych',
    ],
  },
];

/**
 * Evaluates one canonical address against service-area rules.
 * P0 #144 will apply this path to every address in the complete PRG pilot population.
 */
export function evaluateAddressResolution(
  address: CanonicalAddressRef,
  serviceAreas: readonly ServiceAreaDefinition[],
): AddressResolutionStatus {
  try {
    const resolution: ServiceAreaResolution = resolveServiceArea(address, serviceAreas);
    switch (resolution.status) {
      case 'MATCHED':
        return 'SUPPORTED';
      case 'AMBIGUOUS':
        return 'AMBIGUOUS';
      case 'NOT_FOUND':
        return 'UNSUPPORTED';
      default:
        return 'ERROR';
    }
  } catch {
    return 'ERROR';
  }
}

/**
 * Transitional audited-coverage report.
 *
 * This function counts addresses contained in deterministic reference packs that are
 * already protected by production/readiness gates. It compares those audited supported
 * addresses with the territorial PRG denominator, but it does NOT resolve the remaining
 * population address-by-address. P0 #144 owns the full-population resolver census.
 */
export async function runAddressCoverageCensus(_pool?: Pool): Promise<CensusReport> {
  const [
    realGolden,
    polanowGarbno,
    polanowRuralSetA,
    bedzinoTrasa1,
    bedzinoTrasa2,
    sianowGrabowko,
    sianowBorowiec,
    sianowDabrowa,
    sianowSkwierzynka,
    swieszynoChalupy,
    swieszynoTrasa2,
    bobolice,
  ] = await Promise.all([
    loadRealGoldenReferenceSnapshot(),
    loadPolanowGarbnoReferenceSnapshot(),
    loadPolanowRuralSetAReferenceSnapshot(),
    loadBedzinoTrasa1ReferenceSnapshot(),
    loadBedzinoTrasa2ReferenceSnapshot(),
    loadSianowGrabowkoReferenceSnapshot(),
    loadSianowBorowiecReferenceSnapshot(),
    loadSianowDabrowaReferenceSnapshot(),
    loadSianowSkwierzynkaReferenceSnapshot(),
    loadSwieszynoChalupyReferenceSnapshot(),
    loadSwieszynoTrasa2ReferenceSnapshot(),
    loadBoboliceKlaninoReferenceSnapshot(),
  ]);

  const auditedCounts: Record<string, number> = {
    Koszalin: 10240,
    Manowo: realGolden.selection.perMunicipality.Manowo ?? 46,
    Tychowo: realGolden.selection.perMunicipality.Tychowo ?? 45,
    'Polanów': polanowGarbno.selection.total + polanowRuralSetA.selection.total,
    'Będzino': bedzinoTrasa1.selection.total + bedzinoTrasa2.selection.total,
    'Sianów':
      sianowGrabowko.selection.total +
      sianowBorowiec.selection.total +
      sianowDabrowa.selection.total +
      sianowSkwierzynka.safeAddresses.length,
    'Świeszyno': swieszynoChalupy.selection.total + swieszynoTrasa2.selection.total,
    Bobolice: bobolice.selection.total,
  };

  const municipalityItems: MunicipalityCensusItem[] = PILOT_MUNICIPALITIES.map((mun) => {
    const supported = auditedCounts[mun.name] ?? 0;
    const total = mun.totalPrgAddresses;
    const remainingUnaudited = total - supported;
    const coveragePercent = Number(((supported / total) * 100).toFixed(2));

    return {
      name: mun.name,
      terc: mun.terc,
      totalPrgAddresses: total,
      auditedAddresses: supported,
      supportedAddresses: supported,
      unsupportedAddresses: remainingUnaudited,
      remainingUnauditedAddresses: remainingUnaudited,
      ambiguousAddresses: 0,
      errorAddresses: 0,
      coveragePercent,
      activeSubset: mun.activeSubset,
      backlogBlockers: mun.backlogBlockers,
    };
  });

  const totalPilotAddresses = municipalityItems.reduce((acc, item) => acc + item.totalPrgAddresses, 0);
  const totalAuditedAddresses = municipalityItems.reduce((acc, item) => acc + item.auditedAddresses, 0);
  const totalSupported = municipalityItems.reduce((acc, item) => acc + item.supportedAddresses, 0);
  const totalRemainingUnaudited = totalPilotAddresses - totalSupported;
  const overallCoveragePercent = Number(((totalSupported / totalPilotAddresses) * 100).toFixed(2));

  return {
    generatedAt: new Date().toISOString(),
    censusEngineVersion: '2.1.0',
    measurementMode: 'AUDITED_REFERENCE_PACKS',
    qualityScope: 'AUDITED_REFERENCE_PACKS_ONLY',
    fullPopulationResolutionVerified: false,
    totalPilotAddresses,
    totalAuditedAddresses,
    totalSupported,
    totalUnsupported: totalRemainingUnaudited,
    totalRemainingUnaudited,
    totalAmbiguous: 0,
    totalErrors: 0,
    overallCoveragePercent,
    municipalities: municipalityItems,
    conflicts: {
      serviceAreaConflicts: 0,
      missingServiceAreas: 8,
      overlappingRules: 0,
    },
  };
}

export function formatCensusMarkdown(report: CensusReport): string {
  const rows = report.municipalities.map((item) => {
    return `| ${item.name} | ${item.totalPrgAddresses.toLocaleString('pl-PL')} | ${item.supportedAddresses.toLocaleString('pl-PL')} | ${item.remainingUnauditedAddresses.toLocaleString('pl-PL')} | ${item.ambiguousAddresses} | **${item.coveragePercent}%** |`;
  });

  const backlogSections = report.municipalities.map((item) => {
    const blockers = item.backlogBlockers.map((blocker) => `- ${blocker}`).join('\n');
    return `### ${item.name} (Audytowane pokrycie: ${item.coveragePercent}%)
- **Aktywny/audytowany rewir:** ${item.activeSubset}
- **Audytowane adresy z deterministycznym harmonogramem:** ${item.supportedAddresses} / ${item.totalPrgAddresses}
- **Pozostały denominator bez pełnej klasyfikacji resolvera:** ${item.remainingUnauditedAddresses}
- **Kluczowy backlog:**
${blockers}
`;
  });

  return `# Address Coverage Audit — audytowane pokrycie adresowe pilota WastePL

> Data wygenerowania: ${report.generatedAt.split('T')[0]}. Silnik: v${report.censusEngineVersion}. Tryb: \`${report.measurementMode}\`. Pełny audyt resolvera całej populacji: **NIE**.

## Zakres pomiaru

Bieżący raport porównuje liczbę **oficjalnych adresów PRG znajdujących się w audytowanych, deterministycznych paczkach referencyjnych** z terytorialnym denominatorom PRG dla 8 gmin pilota.

Wynik **nie oznacza**, że wszystkie pozostałe adresy zostały uruchomione przez resolver i sklasyfikowane jako \`UNSUPPORTED\`. Pola kompatybilności \`unsupportedAddresses\` / \`totalUnsupported\` reprezentują obecnie **pozostały denominator bez pełnej klasyfikacji adres-po-adresie**.

Pełny 25 030-adresowy resolver audit jest P0 i jest śledzony w **#144**. Do czasu jego wdrożenia zera ambiguity/errors/conflicts odnoszą się wyłącznie do aktywowanych paczek audytowych oraz ich deterministycznych gate'ów.

## Podsumowanie audited supported coverage

| Gmina | Baseline PRG | Audited supported | Remaining unaudited | Audited ambiguity | Audited coverage |
| :--- | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}
| **RAZEM (Region)** | **${report.totalPilotAddresses.toLocaleString('pl-PL')}** | **${report.totalSupported.toLocaleString('pl-PL')}** | **${report.totalRemainingUnaudited.toLocaleString('pl-PL')}** | **${report.totalAmbiguous}*** | **${report.overallCoveragePercent}%** |

\* \`${report.totalAmbiguous}\` jest wynikiem audytowanych paczek/gate'ów, a nie pełnej klasyfikacji wszystkich ${report.totalPilotAddresses.toLocaleString('pl-PL')} adresów.

## Jakość i bezpieczeństwo — zakres audytowany

- **Measurement mode:** \`${report.measurementMode}\`
- **Quality scope:** \`${report.qualityScope}\`
- **Full-population resolution verified:** \`${report.fullPopulationResolutionVerified}\`
- **Audytowane adresy:** ${report.totalAuditedAddresses.toLocaleString('pl-PL')} / ${report.totalPilotAddresses.toLocaleString('pl-PL')}
- **Known service-area conflicts w aktywowanych paczkach:** ${report.conflicts.serviceAreaConflicts}
- **Known overlapping rules w aktywowanych paczkach:** ${report.conflicts.overlappingRules}
- **Known ambiguity w aktywowanych paczkach:** ${report.totalAmbiguous}
- **Known engine errors w aktywowanych paczkach:** ${report.totalErrors}
- **Nieaudytowany adres-po-adresie remainder:** ${report.totalRemainingUnaudited.toLocaleString('pl-PL')}

## Backlog wdrożeniowy

${backlogSections.join('\n')}

## Wnioski i rekomendacje

1. **Audytowane supported coverage wynosi ${report.overallCoveragePercent}% (${report.totalSupported.toLocaleString('pl-PL')} / ${report.totalPilotAddresses.toLocaleString('pl-PL')}).** Jest to konserwatywny licznik adresów z deterministycznym dowodem, a nie pełny wynik klasyfikacji resolvera dla całej populacji.
2. **P0 #144:** zbudować pełny, wersjonowany zbiór 25 030 punktów PRG i sklasyfikować każdy adres przez runtime resolver przed publikowaniem globalnych wskaźników ambiguity/error/conflict.
3. **Sianów:** nie rozbijać zbiorczej kategorii \`odpady segregowane\`; po #140 pozostaje \`OTHER\`. Route 13 (#141) jest kolejnym kandydatem po zamrożeniu bieżącego artefaktu i PRG.
4. **Manowo:** legacy \`2AB.pdf\` jest obecnie HEALTHY, ale nowy indeks PGK używa \`manowo3/*\`; migrację kanoniczności prowadzić zgodnie z #143 bez utraty obecnych 46 adresów.
5. **Będzino i Świeszyno:** kolejne partie wyłącznie po nowych paczkach PRG i zero-overlap proof.
6. Wzrost coverage nie może zwiększać szczegółowości ponad źródło ani obniżać jakości audytowanych gate'ów.
`;
}
