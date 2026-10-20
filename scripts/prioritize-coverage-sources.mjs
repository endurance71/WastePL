#!/usr/bin/env node

/**
 * WastePL audited-coverage source prioritization model.
 *
 * PriorityScore = potentialAddresses / (estimatedHours + maintenanceRisk * 10)
 *
 * IMPORTANT:
 * `potentialAddresses` is currently the territorial PRG denominator remainder after
 * subtracting audited supported reference packs. It is NOT a count of addresses that
 * have already been run through the full resolver and classified as UNSUPPORTED.
 * Full-population classification is tracked by P0 #144.
 */

const CANDIDATES = [
  {
    key: 'sianow-route-13-and-safe-rural',
    municipality: 'Sianów',
    terc: '3209073',
    potentialAddresses: 2961,
    estimatedHours: 16,
    maintenanceRisk: 3,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'MEDIUM',
    blocker: 'Route 13 exact H2 artifact + PRG packs; broad multi-route address mapping remains incomplete (#141)',
    rationale: 'Largest audited-coverage remainder. Start with source-backed zero-overlap rural batches; generic segregated remains OTHER after #140.',
  },
  {
    key: 'bobolice-h2-rural-and-town',
    municipality: 'Bobolice',
    terc: '3209033',
    potentialAddresses: 2015,
    estimatedHours: 20,
    maintenanceRisk: 4,
    adapterReuse: 'NEW_ADAPTER',
    upstreamStability: 'MEDIUM',
    blocker: 'Current H2 mixed-media child artifacts require deterministic capture.',
    rationale: 'Large denominator remainder but higher parser/maintenance cost from mixed media.',
  },
  {
    key: 'swieszyno-next-safe-batches',
    municipality: 'Świeszyno',
    terc: '3209082',
    potentialAddresses: 1784,
    estimatedHours: 14,
    maintenanceRisk: 3,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'MEDIUM',
    blocker: 'New PRG packs and zero-overlap proof for Konikowo/Niekłonice and remaining Trasa II scopes.',
    rationale: 'Source fixtures already exist; next gain depends mainly on precise PRG/address overlap work.',
  },
  {
    key: 'bedzino-next-trasa-2-safe-batches',
    municipality: 'Będzino',
    terc: '3209012',
    potentialAddresses: 1505,
    estimatedHours: 12,
    maintenanceRisk: 2,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'MEDIUM',
    blocker: 'Remaining Trasa II localities overlap shelters and 44 difficult-access properties in parts of the municipality.',
    rationale: 'Existing parser and frozen H2 fixture are reusable; activate only newly proven PRG subsets.',
  },
  {
    key: 'tychowo-town-and-dense',
    municipality: 'Tychowo',
    terc: '3201043',
    potentialAddresses: 1405,
    estimatedHours: 10,
    maintenanceRisk: 2,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'HIGH',
    blocker: 'Town-center/dense-address mapping and hard-to-reach exceptions need explicit evidence.',
    rationale: 'Stable upstream and low adapter cost, but broad address mapping still needs proof.',
  },
  {
    key: 'polanow-next-h2-batches',
    municipality: 'Polanów',
    terc: '3209063',
    potentialAddresses: 1234,
    estimatedHours: 12,
    maintenanceRisk: 2,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'HIGH',
    blocker: 'Remaining rural/town scopes need new PRG packs and overlap proof.',
    rationale: 'PGK H2 rural schedules follow the proven tabular family already used in Garbno/rural sets A and B.',
  },
  {
    key: 'manowo-current-route-migration-and-expansion',
    municipality: 'Manowo',
    terc: '3209042',
    potentialAddresses: 1164,
    estimatedHours: 14,
    maintenanceRisk: 3,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'MEDIUM',
    blocker: 'Legacy 2AB is HEALTHY, but current PGK index is split into manowo3/*; canonical migration must preserve 46/46 addresses (#143).',
    rationale: 'Do source-identity migration first, then expand through current route children with fresh PRG packs.',
  },
];

export function calculatePriorityScore(candidate) {
  const effectiveCost = candidate.estimatedHours + candidate.maintenanceRisk * 10;
  return Number((candidate.potentialAddresses / effectiveCost).toFixed(2));
}

export function rankCandidates(candidates = CANDIDATES) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      priorityScore: calculatePriorityScore(candidate),
    }))
    .sort((left, right) => right.priorityScore - left.priorityScore);
}

if (process.argv[1] && process.argv[1].endsWith('prioritize-coverage-sources.mjs')) {
  const ranked = rankCandidates();
  console.log('[WastePL audited-coverage source prioritization]');
  console.log('NOTE: PRG remainder is potential coverage, not full-resolver UNSUPPORTED classification. P0 #144 owns that audit.');
  console.table(
    ranked.map((row, index) => ({
      Rank: index + 1,
      Municipality: row.municipality,
      'PRG Potential': row.potentialAddresses,
      'Est Hours': row.estimatedHours,
      Risk: row.maintenanceRisk,
      'ROI Score': row.priorityScore,
    })),
  );
}
