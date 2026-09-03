import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { textFromPdfTextArtifact } from '../adapters/pdf-text/pdf-text-extractor.js';

const USER_AGENT = 'WastePL/0.1 (+https://wastepl.pl)';
const TRUSTED_ORIGIN = 'https://ekosanodpady.pl';
const REPORT_DIR = 'test-results/bedzino-h2-acquisition';
const REPORT_PATH = `${REPORT_DIR}/report.json`;

const CHILDREN = [
  {
    key: 'route-i',
    role: 'STANDARD_ROUTE_I',
    url: `${TRUSTED_ORIGIN}/wp-content/uploads/2026/07/Bedzino-2026-trasa-I.pdf`,
  },
  {
    key: 'route-ii',
    role: 'STANDARD_ROUTE_II',
    url: `${TRUSTED_ORIGIN}/wp-content/uploads/2026/07/Bedzino-2026-trasa-II.pdf`,
  },
  {
    key: 'multifamily',
    role: 'MULTIFAMILY',
    url: `${TRUSTED_ORIGIN}/wp-content/uploads/2026/07/OSLONY-BEDZINO-2026.pdf`,
  },
  {
    key: 'difficult-access',
    role: 'DIFFICULT_ACCESS',
    url: `${TRUSTED_ORIGIN}/wp-content/uploads/2026/07/Bedzino-2026-trudnodostepne.pdf`,
  },
] as const;

type Child = (typeof CHILDREN)[number];

type ProbeValidation = {
  municipality: boolean;
  year: boolean;
  july: boolean;
  december: boolean;
  roleMarker: boolean;
  validH2Evidence: boolean;
};

type ProbeSuccess = {
  key: Child['key'];
  role: Child['role'];
  sourceUrl: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  bytes: number;
  sha256: string;
  textPath: string;
  textChars: number;
  textLines: number;
  textSha256: string;
  validation: ProbeValidation;
  outcome: 'CAPTURED_VALIDATED' | 'CAPTURED_REVIEW';
};

type ProbeFailure = {
  key: Child['key'];
  role: Child['role'];
  sourceUrl: string;
  outcome: 'FAILED';
  error: string;
};

type ProbeResult = ProbeSuccess | ProbeFailure;

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.1',
    },
  });
}

function requireTrustedFinalUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.origin !== TRUSTED_ORIGIN) {
    throw new Error(`Unexpected redirect outside EKOSAN origin: ${url}`);
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pl-PL');
}

function roleMarkerMatches(child: Child, normalized: string): boolean {
  switch (child.role) {
    case 'STANDARD_ROUTE_I':
      return /(?:^|\s)trasa i(?:\s|$)/i.test(normalized);
    case 'STANDARD_ROUTE_II':
      return /(?:^|\s)trasa ii(?:\s|$)/i.test(normalized);
    case 'MULTIFAMILY':
      return /(wielolokal|wielorodzin|osłon)/i.test(normalized);
    case 'DIFFICULT_ACCESS':
      return /(trudno\s*dost|trudnodost)/i.test(normalized);
  }
}

function validateText(child: Child, text: string): ProbeValidation {
  const normalized = normalizeText(text);
  const municipality = normalized.includes('będzino');
  const year = normalized.includes('2026');
  const july = normalized.includes('lipiec');
  const december = normalized.includes('grudzień');
  const roleMarker = roleMarkerMatches(child, normalized);
  return {
    municipality,
    year,
    july,
    december,
    roleMarker,
    validH2Evidence: municipality && year && july && december && roleMarker,
  };
}

async function probeOne(child: Child): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout(child.url);
    requireTrustedFinalUrl(response.url || child.url);
    if (!response.ok) {
      throw new Error(`PDF HTTP ${response.status}`);
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (body.length < 5 || body.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error(`Downloaded body is not a PDF (bytes=${body.length})`);
    }

    const text = await textFromPdfTextArtifact(body);
    const textPath = `${REPORT_DIR}/${child.key}.txt`;
    await writeFile(textPath, `${text.trim()}\n`, 'utf8');

    const validation = validateText(child, text);
    const result: ProbeSuccess = {
      key: child.key,
      role: child.role,
      sourceUrl: child.url,
      finalUrl: response.url || child.url,
      httpStatus: response.status,
      contentType: response.headers.get('content-type'),
      bytes: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
      textPath,
      textChars: text.length,
      textLines: text.split(/\r?\n/).filter(Boolean).length,
      textSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
      validation,
      outcome: validation.validH2Evidence ? 'CAPTURED_VALIDATED' : 'CAPTURED_REVIEW',
    };
    return result;
  } catch (error) {
    return {
      key: child.key,
      role: child.role,
      sourceUrl: child.url,
      outcome: 'FAILED',
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

async function main(): Promise<void> {
  await mkdir(REPORT_DIR, { recursive: true });
  const results: ProbeResult[] = [];

  for (const child of CHILDREN) {
    const result = await probeOne(child);
    results.push(result);
    const detail = result.outcome === 'FAILED'
      ? result.error
      : `${result.sha256} text=${result.textChars} validated=${result.validation.validH2Evidence}`;
    console.log(`${result.outcome.padEnd(18)} ${result.key} ${detail}`);
  }

  const captured = results.filter((result) => result.outcome !== 'FAILED').length;
  const validated = results.filter(
    (result): result is ProbeSuccess => result.outcome !== 'FAILED' && result.validation.validH2Evidence,
  ).length;
  const standardValidated = results
    .filter((result): result is ProbeSuccess => result.outcome !== 'FAILED')
    .filter((result) => result.role === 'STANDARD_ROUTE_I' || result.role === 'STANDARD_ROUTE_II')
    .every((result) => result.validation.validH2Evidence);

  const report = {
    schemaVersion: '0.1.0',
    generatedAt: new Date().toISOString(),
    source: {
      municipality: 'Będzino',
      terc: '3209012',
      operator: 'EKOSAN Sp. z o.o.',
      indexUrl: `${TRUSTED_ORIGIN}/harmonogramy-ekosan/`,
      expectedChildren: CHILDREN.length,
    },
    summary: {
      captured,
      failed: CHILDREN.length - captured,
      validated,
      reviewRequired: captured - validated,
      allCaptured: captured === CHILDREN.length,
      standardValidated,
      readyForOverlapAnalysis: captured === CHILDREN.length && standardValidated,
    },
    results,
  };

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Report: ${REPORT_PATH}`);

  if (!report.summary.readyForOverlapAnalysis) {
    process.exitCode = 1;
  }
}

await main();
