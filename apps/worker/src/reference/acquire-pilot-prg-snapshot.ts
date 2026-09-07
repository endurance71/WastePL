import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const outputDir = resolve(repoRoot, 'tmp', 'prg-full-population');
const rawDir = resolve(outputDir, 'raw');
const previousBaselineRows = 25_030;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl-PL')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function requestStartIndex(url: string): number {
  const parsed = new URL(url);
  const entry = [...parsed.searchParams.entries()].find(
    ([key]) => key.toLocaleLowerCase('en-US') === 'startindex',
  );
  const raw = entry?.[1];
  if (!raw || !/^\d+$/.test(raw)) throw new Error(`Acquisition request missing numeric startIndex: ${url}`);
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid acquisition startIndex: ${raw}`);
  return value;
}

async function fetchTextWithRetry(url: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/gml+xml, text/xml, application/xml',
          'user-agent': 'WastePL/0.1 full PRG pilot acquisition (+https://github.com/endurance71/WastePL)',
        },
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 2 ** attempt * 1000));
      }
    }
  }
  throw new Error(
    `PRG WFS fetch failed after retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function main(): Promise<void> {
  await mkdir(rawDir, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const municipalities: Array<{
    name: string;
    terc: string;
    kinaTeryt: string;
    totalRows: number;
    pages: number;
    aggregateSha256: string;
  }> = [];

  for (const municipality of PILOT_MUNICIPALITIES) {
    console.log(`[PRG acquisition] ${municipality.name} (${municipality.terc})`);
    const slug = `${municipality.terc}-${safeName(municipality.name)}`;

    const acquisition = await acquirePrgMunicipality({
      municipalityTerc: municipality.terc,
      retrievedAt,
      fetchPage: async (url) => {
        const startIndex = requestStartIndex(url);
        const body = await fetchTextWithRetry(url);
        const rawPath = resolve(rawDir, `${slug}-start-${String(startIndex).padStart(6, '0')}.gml`);
        await writeFile(rawPath, body, 'utf8');
        console.log(`  raw startIndex=${startIndex}, bytes=${Buffer.byteLength(body, 'utf8')}, sha=${sha256(body)}`);
        return body;
      },
    });

    if (acquisition.rows.length !== acquisition.totalRows) {
      throw new Error(`${municipality.name}: normalized row count mismatch`);
    }
    if (acquisition.rows.some((row) => !row.prgId.startsWith('prg-adresy.'))) {
      throw new Error(`${municipality.name}: non-canonical PRG id found in normalized snapshot`);
    }
    if (acquisition.rows.some((row) => row.municipalityTerc !== municipality.terc)) {
      throw new Error(`${municipality.name}: row escaped municipality TERC`);
    }

    const normalized = {
      schemaVersion: '1.0.0',
      dataset: 'GUGiK Krajowa Integracja Numeracji Adresowej WFS — full municipality snapshot',
      municipality: municipality.name,
      ...acquisition,
    };
    await writeFile(resolve(outputDir, `${slug}.json`), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');

    municipalities.push({
      name: municipality.name,
      terc: municipality.terc,
      kinaTeryt: acquisition.kinaTeryt,
      totalRows: acquisition.totalRows,
      pages: acquisition.pages.length,
      aggregateSha256: acquisition.aggregateSha256,
    });
    console.log(
      `  captured ${acquisition.totalRows} rows in ${acquisition.pages.length} page(s), aggregate=${acquisition.aggregateSha256}`,
    );
  }

  const totalRows = municipalities.reduce((sum, item) => sum + item.totalRows, 0);
  const aggregateSha256 = sha256(
    JSON.stringify(
      municipalities.map(({ terc, totalRows: rows, aggregateSha256: municipalitySha }) => ({
        terc,
        rows,
        aggregateSha256: municipalitySha,
      })),
    ),
  );
  const summary = {
    schemaVersion: '1.0.0',
    dataset: 'WastePL pilot — complete GUGiK KINA PRG acquisition',
    source: 'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej',
    retrievedAt,
    totalMunicipalities: municipalities.length,
    totalRows,
    previousBaselineRows,
    baselineDelta: totalRows - previousBaselineRows,
    aggregateSha256,
    municipalities,
  };

  if (summary.totalMunicipalities !== PILOT_MUNICIPALITIES.length) {
    throw new Error(`Expected ${PILOT_MUNICIPALITIES.length} municipalities, got ${summary.totalMunicipalities}`);
  }

  await writeFile(resolve(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(
    resolve(outputDir, 'summary.md'),
    `# WastePL full PRG pilot acquisition\n\n- Retrieved: ${retrievedAt}\n- Municipalities: **${summary.totalMunicipalities}**\n- Captured rows: **${totalRows.toLocaleString('en-US')}**\n- Previous territorial baseline: **${previousBaselineRows.toLocaleString('en-US')}**\n- Delta: **${summary.baselineDelta >= 0 ? '+' : ''}${summary.baselineDelta.toLocaleString('en-US')}**\n- Aggregate SHA-256: \`${aggregateSha256}\`\n\n| Municipality | TERC | KINA TERYT | Rows | Pages | Aggregate SHA-256 |\n| --- | --- | --- | ---: | ---: | --- |\n${municipalities.map((item) => `| ${item.name} | \`${item.terc}\` | \`${item.kinaTeryt}\` | ${item.totalRows} | ${item.pages} | \`${item.aggregateSha256}\` |`).join('\n')}\n`,
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[PRG acquisition] FAILED', error);
  process.exitCode = 1;
});
