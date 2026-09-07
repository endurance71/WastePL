import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { acquirePrgMunicipality } from './prg-wfs-acquisition.js';

const PILOT_MUNICIPALITIES = [
  { name: 'Koszalin', terc: '3261011' },
  { name: 'Manowo', terc: '3209042' },
  { name: 'Bobolice', terc: '3209033' },
  { name: 'Świeszyno', terc: '3209082' },
  { name: 'Tychowo', terc: '3201043' },
  { name: 'Sianów', terc: '3209073' },
  { name: 'Polanów', terc: '3209063' },
  { name: 'Będzino', terc: '3209012' },
] as const;

const outputDir = resolve(process.cwd(), 'tmp', 'prg-full-population');

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function fetchWithRetry(url: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/gml+xml, text/xml, application/xml',
          'user-agent': 'WastePL/0.1 full PRG pilot acquisition',
        },
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 2 ** attempt * 1000));
      }
    }
  }
  throw new Error(`PRG WFS fetch failed after retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const municipalitySummaries: Array<{
    name: string;
    terc: string;
    kinaTeryt: string;
    totalRows: number;
    pages: number;
    aggregateSha256: string;
    rejectedRows: 0;
  }> = [];

  for (const municipality of PILOT_MUNICIPALITIES) {
    console.log(`[PRG acquisition] ${municipality.name} (${municipality.terc})`);
    const acquisition = await acquirePrgMunicipality({
      municipalityTerc: municipality.terc,
      fetchPage: fetchWithRetry,
      retrievedAt,
    });

    const filename = `${municipality.terc}-${municipality.name.toLocaleLowerCase('pl-PL').replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-')}.json`;
    await writeFile(
      resolve(outputDir, filename),
      `${JSON.stringify({ schemaVersion: '1.0.0', name: municipality.name, ...acquisition }, null, 2)}\n`,
      'utf8',
    );

    municipalitySummaries.push({
      name: municipality.name,
      terc: municipality.terc,
      kinaTeryt: acquisition.kinaTeryt,
      totalRows: acquisition.totalRows,
      pages: acquisition.pages.length,
      aggregateSha256: acquisition.aggregateSha256,
      rejectedRows: 0,
    });
    console.log(`  captured ${acquisition.totalRows} rows in ${acquisition.pages.length} page(s), sha=${acquisition.aggregateSha256}`);
  }

  const totalRows = municipalitySummaries.reduce((sum, municipality) => sum + municipality.totalRows, 0);
  const aggregateInput = JSON.stringify(
    municipalitySummaries.map(({ terc, totalRows: rows, aggregateSha256 }) => ({
      terc,
      totalRows: rows,
      aggregateSha256,
    })),
  );
  const summary = {
    schemaVersion: '1.0.0',
    dataset: 'GUGiK Krajowa Integracja Numeracji Adresowej WFS — WastePL pilot full population',
    retrievedAt,
    totalMunicipalities: municipalitySummaries.length,
    totalRows,
    previousBaselineRows: 25030,
    baselineDelta: totalRows - 25030,
    aggregateSha256: sha256(aggregateInput),
    municipalities: municipalitySummaries,
  };

  await writeFile(resolve(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(
    resolve(outputDir, 'summary.md'),
    `# WastePL full PRG pilot acquisition\n\n- Retrieved: ${retrievedAt}\n- Municipalities: ${summary.totalMunicipalities}\n- Captured rows: **${totalRows}**\n- Previous baseline: **25,030**\n- Delta: **${summary.baselineDelta >= 0 ? '+' : ''}${summary.baselineDelta}**\n- Aggregate SHA-256: \`${summary.aggregateSha256}\`\n\n| Municipality | TERC | Rows | Pages | SHA-256 |\n| --- | --- | ---: | ---: | --- |\n${municipalitySummaries.map((item) => `| ${item.name} | \`${item.terc}\` | ${item.totalRows} | ${item.pages} | \`${item.aggregateSha256}\` |`).join('\n')}\n`,
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[PRG acquisition] FAILED', error);
  process.exitCode = 1;
});
