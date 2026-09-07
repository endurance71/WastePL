import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runAddressCoverageCensus,
  formatCensusMarkdown,
} from './address-coverage-census.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const markdownPath = resolve(repoRoot, 'docs/reports/address-coverage-census.md');
const jsonPath = resolve(
  repoRoot,
  'apps/worker/test-results/address-coverage-census-report.json',
);

async function main() {
  console.log('Calculating WastePL audited supported coverage against the 8-municipality PRG denominator...');
  const report = await runAddressCoverageCensus();
  const markdown = formatCensusMarkdown(report);

  await writeFile(markdownPath, markdown, 'utf8');
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('\n--- Address Coverage Audit Summary ---');
  console.table(
    report.municipalities.map((municipality) => ({
      Gmina: municipality.name,
      'Baseline PRG': municipality.totalPrgAddresses,
      'Audited supported': municipality.supportedAddresses,
      'Remaining unaudited': municipality.remainingUnauditedAddresses,
      'Audited ambiguity': municipality.ambiguousAddresses,
      'Audited coverage %': `${municipality.coveragePercent}%`,
    })),
  );

  console.log(
    `\nAudited supported coverage: ${report.overallCoveragePercent}% (${report.totalSupported} / ${report.totalPilotAddresses} addresses)`,
  );
  console.log(`Measurement mode: ${report.measurementMode}`);
  console.log(`Full-population resolver verified: ${report.fullPopulationResolutionVerified}`);
  console.log('P0 #144 tracks the full 25,030-address resolver audit.');
  console.log(`Saved report: ${markdownPath}`);
  console.log(`Saved JSON: ${jsonPath}`);
}

main().catch((error) => {
  console.error('Failed to run address coverage audit:', error);
  process.exit(1);
});
