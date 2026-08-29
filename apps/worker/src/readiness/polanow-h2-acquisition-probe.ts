import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { textFromPdfTextArtifact } from '../adapters/pdf-text/pdf-text-extractor.js';
import { extractPolanowH2AttachmentHref, resolvePolanowH2AttachmentDownload } from '../ingestion/polanow-bip-attachment.js';

const USER_AGENT = 'WastePL/0.1 (+https://wastepl.pl)';
const POLANOW_ORIGIN = 'https://bip.polanow.pl';
const REPORT_PATH = 'test-results/polanow-h2-acquisition-report.json';
const TEXT_SAMPLE_KEYS = new Set([
  '01-garbno',
  '06-polanow-route-a',
  '11-difficult-access-a',
  '12-difficult-access-b',
  '13-multifamily-polanow',
]);

const H2_WRAPPERS = [
  ['01-garbno', 'b9dd65849fc6ebcb56cb8e3ce17710d5'],
  ['02-kosciernica', '9f0e8b36296c7a6b81235ac1e4be7f3d'],
  ['03-rural-set-a', '2ab2d7615a89d857c47d062ae014d941'],
  ['04-rural-set-b', '9a984d281708c4c9d9fe024fac0a9239'],
  ['05-rural-set-c', '968f3890565a70325ab530f2bc0ba475'],
  ['06-polanow-route-a', '5918114e4f59bc84e1ee2ad0d3b70691'],
  ['07-polanow-route-b', '739219b35502eab379a558a2abbea937'],
  ['08-rural-set-d', '4e5fd68092b90c967e3d82c68792834b'],
  ['09-rural-set-e', 'd5e1d06dcff13dbd33f682e757935b2f'],
  ['10-rural-set-f', 'fed8ae9e9000fa15c8c4cf0e685a5706'],
  ['11-difficult-access-a', '49d6930b8ca21e09c479347689eee6b0'],
  ['12-difficult-access-b', '024df25d6be612cb1573eb6f0f2e213d'],
  ['13-multifamily-polanow', '46c336882c6fb4a6588505d7e72de3df'],
  ['14-multifamily-naclaw-zydowo', 'c587315871df63c17b42d0df02bdfe11'],
  ['15-multifamily-krag-rzeczyca', '9420a0f8990601e55eda78db3074ac22'],
] as const;

type ProbeSuccess = {
  key: string;
  wrapperUrl: string;
  downloadUrl: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  bytes: number;
  sha256: string;
  textSha256: string | null;
  textLength: number | null;
  outcome: 'CAPTURED';
};

type ProbeFailure = {
  key: string;
  wrapperUrl: string;
  outcome: 'FAILED';
  error: string;
};

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'user-agent': USER_AGENT,
      accept,
    },
  });
}

function requireTrustedFinalUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.origin !== POLANOW_ORIGIN) {
    throw new Error(`Unexpected redirect outside Polanów BIP: ${url}`);
  }
}

function printTextSample(key: string, text: string): void {
  const sample = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 45)
    .join('\n')
    .slice(0, 2600);
  console.log(`TEXT_SAMPLE_BEGIN ${key}\n${sample}\nTEXT_SAMPLE_END ${key}`);
}

async function probeOne(key: string, attachmentId: string): Promise<ProbeSuccess | ProbeFailure> {
  const wrapperUrl = `${POLANOW_ORIGIN}/zalacznik/${attachmentId}/70/2846/`;

  try {
    const wrapperResponse = await fetchWithTimeout(wrapperUrl, 'text/html,application/xhtml+xml');
    requireTrustedFinalUrl(wrapperResponse.url || wrapperUrl);
    if (!wrapperResponse.ok) {
      throw new Error(`Wrapper HTTP ${wrapperResponse.status}`);
    }

    const html = await wrapperResponse.text();
    const href = extractPolanowH2AttachmentHref(wrapperUrl, html);
    const resolution = resolvePolanowH2AttachmentDownload(wrapperUrl, href);

    const pdfResponse = await fetchWithTimeout(resolution.downloadUrl, 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.1');
    requireTrustedFinalUrl(pdfResponse.url || resolution.downloadUrl);
    if (!pdfResponse.ok) {
      throw new Error(`PDF HTTP ${pdfResponse.status}`);
    }

    const body = Buffer.from(await pdfResponse.arrayBuffer());
    if (body.length < 5 || body.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error(`Downloaded body is not a PDF (bytes=${body.length})`);
    }

    let textSha256: string | null = null;
    let textLength: number | null = null;
    if (TEXT_SAMPLE_KEYS.has(key)) {
      const text = await textFromPdfTextArtifact(body);
      textSha256 = createHash('sha256').update(text, 'utf8').digest('hex');
      textLength = text.length;
      printTextSample(key, text);
    }

    return {
      key,
      wrapperUrl,
      downloadUrl: resolution.downloadUrl,
      finalUrl: pdfResponse.url || resolution.downloadUrl,
      httpStatus: pdfResponse.status,
      contentType: pdfResponse.headers.get('content-type'),
      bytes: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
      textSha256,
      textLength,
      outcome: 'CAPTURED',
    };
  } catch (error) {
    return {
      key,
      wrapperUrl,
      outcome: 'FAILED',
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

async function main(): Promise<void> {
  const results: Array<ProbeSuccess | ProbeFailure> = [];

  for (const [key, attachmentId] of H2_WRAPPERS) {
    const result = await probeOne(key, attachmentId);
    results.push(result);
    console.log(`${result.outcome.padEnd(8)} ${key}${result.outcome === 'CAPTURED' ? ` ${result.sha256}` : ` ${result.error}`}`);
  }

  const captured = results.filter((result): result is ProbeSuccess => result.outcome === 'CAPTURED').length;
  const report = {
    schemaVersion: '0.1.0',
    generatedAt: new Date().toISOString(),
    source: {
      parentUrl: `${POLANOW_ORIGIN}/harmonogram-odbioru-odpadow-komunalnych---ii-polrocze-2026/d/70/2846/`,
      documentId: '2846',
      expectedChildren: H2_WRAPPERS.length,
    },
    summary: {
      captured,
      failed: H2_WRAPPERS.length - captured,
      complete: captured === H2_WRAPPERS.length,
    },
    results,
  };

  await mkdir('test-results', { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Report: ${REPORT_PATH}`);

  if (!report.summary.complete) {
    process.exitCode = 1;
  }
}

await main();
