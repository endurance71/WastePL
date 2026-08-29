import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { textFromPdfTextArtifact } from '../adapters/pdf-text/pdf-text-extractor.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const outputDir = resolve(repoRoot, 'tmp/polanow-h2-runtime-text');

const sources = [
  ['01-garbno', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289119_Polanow-1.pdf'],
  ['03-bukowo-group', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289185_Polanow-3.pdf'],
  ['04-bozenice-group', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289243_Polanow-4.pdf'],
  ['05-bagnica-group', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289323_Polanow-5.pdf'],
  ['08-chocimino-group', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289517_Polanow-8a.pdf'],
  ['09-dalimierz-group', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289596_Polanow-8b.pdf'],
  ['10-kania-group', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289627_Polanow-9.pdf'],
  ['11-difficult-a', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289693_Polanow-utrudnione-PN.pdf'],
  ['12-difficult-b', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289759_Polanow-utrudnione-WT.pdf'],
  ['13-multifamily-polanow', 'https://bip.polanow.pl/upload/zal/2026/2026-06-24/1782289798_Polanow-W1.pdf'],
];

await mkdir(outputDir, { recursive: true });
const report: Array<{ label: string; url: string; bytes: number; chars: number; lines: number }> = [];
for (const [label, url] of sources) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${label} fetch HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  const text = await textFromPdfTextArtifact(body);
  await writeFile(resolve(outputDir, `${label}.txt`), `${text}\n`, 'utf8');
  report.push({ label, url, bytes: body.length, chars: text.length, lines: text.split('\n').length });
  console.log(`${label}: bytes=${body.length} chars=${text.length} lines=${text.split('\n').length}`);
}
await writeFile(resolve(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
