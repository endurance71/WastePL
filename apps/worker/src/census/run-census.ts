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
  console.log('Calculating WastePL Address Coverage Census across 8 pilot municipalities...');
  const report = await runAddressCoverageCensus();
  const markdown = formatCensusMarkdown(report);

  await writeFile(markdownPath, markdown, 'utf8');
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n--- Address Coverage Census Summary ---');
  console.table(
    report.municipalities.map((m) => ({
      Gmina: m.name,
      'Adresy PRG': m.totalPrgAddresses,
      Supported: m.supportedAddresses,
      Unsupported: m.unsupportedAddresses,
      Ambiguous: m.ambiguousAddresses,
      'Coverage %': `${m.coveragePercent}%`,
    })),
  );

  console.log(`\nOverall pilot address coverage: ${report.overallCoveragePercent}% (${report.totalSupported} / ${report.totalPilotAddresses} addresses)`);
  console.log(`Saved report: ${markdownPath}`);
  console.log(`Saved JSON: ${jsonPath}`);
}

main().catch((error) => {
  console.error('Failed to run address coverage census:', error);
  process.exit(1);
});
