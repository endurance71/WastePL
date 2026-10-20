#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

/**
 * WastePL P1-C.1 Source Prioritization Model
 *
 * Implements the official formula:
 * PriorityScore = unblockedAddresses / (estimatedHours + (maintenanceRisk * 10))
 *
 * Evaluates candidate sources across:
 * - unblockedAddresses: PRG address denominator unlocked
 * - estimatedHours: implementation and test effort
 * - maintenanceRisk: score 1 (low) to 5 (extreme OCR/ambiguous)
 * - adapterReuse: REUSED_UNCHANGED | EXTENDED_EXISTING | NEW_ADAPTER
 * - upstreamStability: HIGH | MEDIUM | LOW
 */

const CANDIDATES = [
  {
    key: 'sianow-segregated-split-and-town',
    municipality: 'Sianów',
    terc: '3209073',
    unblockedAddresses: 2961,
    estimatedHours: 16,
    maintenanceRisk: 3,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'MEDIUM',
    rationale: 'Largest remaining unlocked address volume (2,961 PRG). Town center and difficult-access routes remain.',
  },
  {
    key: 'bedzino-trasa-2-ekosan',
    municipality: 'Będzino',
    terc: '3209012',
    unblockedAddresses: 1505,
    estimatedHours: 12,
    maintenanceRisk: 2,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'MEDIUM',
    rationale: 'Remaining Ekosan Trasa II settlements and remaining Trasa I rural addresses without complex shelter rules.',
  },
  {
    key: 'swieszyno-trasa-2-3',
    municipality: 'Świeszyno',
    terc: '3209082',
    unblockedAddresses: 1784,
    estimatedHours: 14,
    maintenanceRisk: 3,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'MEDIUM',
    rationale: 'Remaining Trasa II settlements with multi-family shelters, Konikowo and Niekłonice (Trasa I).',
  },
  {
    key: 'bobolice-h2-rural-and-town',
    municipality: 'Bobolice',
    terc: '3209033',
    unblockedAddresses: 2015,
    estimatedHours: 20,
    maintenanceRisk: 4,
    adapterReuse: 'NEW_ADAPTER',
    upstreamStability: 'MEDIUM',
    rationale: 'Mixed media attachments and images require multi-format parser handling.',
  },
  {
    key: 'polanow-h2-rural-and-town',
    municipality: 'Polanów',
    terc: '3209063',
    unblockedAddresses: 1234,
    estimatedHours: 12,
    maintenanceRisk: 2,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'HIGH',
    rationale: 'PGK H2 rural schedules follow the proven tabular format used in Garbno.',
  },
  {
    key: 'tychowo-town-and-dense',
    municipality: 'Tychowo',
    terc: '3201053',
    unblockedAddresses: 1405,
    estimatedHours: 10,
    maintenanceRisk: 2,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'HIGH',
    rationale: 'Tychowo town center and dense areas. High stability upstream.',
  },
  {
    key: 'manowo-trasa-1',
    municipality: 'Manowo',
    terc: '3209052',
    unblockedAddresses: 1164,
    estimatedHours: 10,
    maintenanceRisk: 2,
    adapterReuse: 'EXTENDED_EXISTING',
    upstreamStability: 'HIGH',
    rationale: 'Route 1 completing Manowo municipality via existing PGK PDF text adapter.',
  },
];

export function calculatePriorityScore(candidate) {
  const effectiveCost = candidate.estimatedHours + candidate.maintenanceRisk * 10;
  return Number((candidate.unblockedAddresses / effectiveCost).toFixed(2));
}

export function rankCandidates(candidates = CANDIDATES) {
  return candidates
    .map((c) => ({
      ...c,
      priorityScore: calculatePriorityScore(c),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

if (process.argv[1] && process.argv[1].endsWith('prioritize-coverage-sources.mjs')) {
  const ranked = rankCandidates();
  console.log('[WastePL P1-C.1 Source Prioritization Ranking]');
  console.table(
    ranked.map((r, idx) => ({
      Rank: idx + 1,
      Municipality: r.municipality,
      'PRG Unlocked': r.unblockedAddresses,
      'Est Hours': r.estimatedHours,
      Risk: r.maintenanceRisk,
      'ROI Score': r.priorityScore,
    })),
  );
}
