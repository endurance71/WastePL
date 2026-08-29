import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DOC_ID = '2846';
const ROOT = 'https://bip.polanow.pl';
const outputDir = path.resolve('tmp/polanow-h2-capture');

const children = [
  ['01-garbno', 'b9dd65849fc6ebcb56cb8e3ce17710d5'],
  ['02-kosciernica', '9f0e8b36296c7a6b81235ac1e4be7f3d'],
  ['03-bukowo-group', '2ab2d7615a89d857c47d062ae014d941'],
  ['04-bozenice-group', '9a984d281708c4c9d9fe024fac0a9239'],
  ['05-bagnica-group', '968f3890565a70325ab530f2bc0ba475'],
  ['06-polanow-city-a', '5918114e4f59bc84e1ee2ad0d3b70691'],
  ['07-polanow-city-b', '739219b35502eab379a558a2abbea937'],
  ['08-chocimino-group', '4e5fd68092b90c967e3d82c68792834b'],
  ['09-dalimierz-group', 'd5e1d06dcff13dbd33f682e757935b2f'],
  ['10-kania-group', 'fed8ae9e9000fa15c8c4cf0e685a5706'],
  ['11-difficult-a', '49d6930b8ca21e09c479347689eee6b0'],
  ['12-difficult-b', '024df25d6be612cb1573eb6f0f2e213d'],
  ['13-multifamily-polanow', '46c336882c6fb4a6588505d7e72de3df'],
  ['14-multifamily-naclaw-zydowo', 'c587315871df63c17b42d0df02bdfe11'],
  ['15-multifamily-krag-rzeczyca', '9420a0f8990601e55eda78db3074ac22'],
];

const headers = {
  'user-agent': 'WastePL research probe/1.0 (+https://github.com/endurance71/WastePL)',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function printablePrefix(bytes) {
  return Buffer.from(bytes.subarray(0, 24)).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
}

async function fetchEvidence(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      requestedUrl: url,
      status: response.status,
      ok: response.ok,
      finalUrl: response.url,
      contentType: response.headers.get('content-type'),
      contentLengthHeader: response.headers.get('content-length'),
      bytes: buffer.length,
      sha256: sha256(buffer),
      pdfMagic: buffer.subarray(0, 5).toString('ascii') === '%PDF-',
      prefix: printablePrefix(buffer),
      durationMs: Date.now() - started,
      body: buffer,
    };
  } catch (error) {
    return {
      requestedUrl: url,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      durationMs: Date.now() - started,
      body: null,
    };
  }
}

await mkdir(outputDir, { recursive: true });
const report = {
  schemaVersion: '0.1.0',
  documentId: DOC_ID,
  parentUrl: `${ROOT}/harmonogram-odbioru-odpadow-komunalnych---ii-polrocze-2026/d/70/${DOC_ID}/`,
  capturedAt: new Date().toISOString(),
  children: [],
};

for (const [label, hash] of children) {
  const wrapperUrl = `${ROOT}/zalacznik/${hash}/70/${DOC_ID}/`;
  const rootDownloadUrl = `${ROOT}/pobierz.php?d=zal&id=${hash}`;
  const wrapperRelativeDownloadUrl = `${wrapperUrl}pobierz.php?d=zal&id=${hash}`;

  const wrapper = await fetchEvidence(wrapperUrl);
  const direct = await fetchEvidence(rootDownloadUrl);
  const relative = direct.pdfMagic ? null : await fetchEvidence(wrapperRelativeDownloadUrl);
  const chosen = direct.pdfMagic ? direct : relative?.pdfMagic ? relative : null;

  if (chosen?.body) {
    await writeFile(path.join(outputDir, `${label}-${hash}.pdf`), chosen.body);
  }

  const simplify = (entry) => entry ? Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'body')) : null;
  const item = {
    label,
    hash,
    wrapperUrl,
    rootDownloadUrl,
    wrapperRelativeDownloadUrl,
    wrapper: simplify(wrapper),
    direct: simplify(direct),
    relative: simplify(relative),
    capturedPdf: Boolean(chosen),
    capturedVia: chosen === direct ? 'ROOT_DOWNLOAD' : chosen === relative ? 'WRAPPER_RELATIVE_DOWNLOAD' : null,
    pdfSha256: chosen?.sha256 ?? null,
    pdfBytes: chosen?.bytes ?? null,
    pdfFinalUrl: chosen?.finalUrl ?? null,
  };
  report.children.push(item);
  console.log(`${label}: wrapper=${wrapper.status ?? wrapper.error ?? 'n/a'} direct=${direct.status ?? direct.error ?? 'n/a'} relative=${relative?.status ?? relative?.error ?? 'skipped'} pdf=${item.capturedPdf}`);
}

report.summary = {
  expectedChildren: children.length,
  wrappersHttpOk: report.children.filter((item) => item.wrapper?.ok).length,
  pdfsCaptured: report.children.filter((item) => item.capturedPdf).length,
  allPdfsCaptured: report.children.every((item) => item.capturedPdf),
  uniquePdfHashes: new Set(report.children.map((item) => item.pdfSha256).filter(Boolean)).size,
};

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary));
