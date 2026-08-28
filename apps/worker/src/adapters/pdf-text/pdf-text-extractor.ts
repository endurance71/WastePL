export class PdfTextExtractionError extends Error {
  constructor(
    message: string,
    readonly code: 'PDF_EXTRACTION_FAILED' | 'EMPTY_PDF_TEXT',
    options: { cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'PdfTextExtractionError';
  }
}

function isPdf(body: Buffer): boolean {
  return body.subarray(0, 5).toString('ascii') === '%PDF-';
}

function lineBreak(previousY: number | null, nextY: number | null): boolean {
  if (previousY === null || nextY === null) return false;
  return Math.abs(previousY - nextY) > 1.5;
}

/**
 * PDF_TEXT means the source is a text-bearing PDF, not that SourceIngestionService
 * stores pre-extracted text. Immutable artifacts preserve the raw upstream bytes;
 * text extraction therefore belongs at parser dispatch time.
 *
 * Plain UTF-8 fallback is retained for deterministic historical fixtures and for
 * explicitly pre-extracted test artifacts. A real PDF is always parsed as PDF bytes.
 */
export async function textFromPdfTextArtifact(body: Buffer): Promise<string> {
  if (!isPdf(body)) return body.toString('utf8');

  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = getDocument({
      data: new Uint8Array(body),
      isEvalSupported: false,
      useWorkerFetch: false,
    });
    const document = await loadingTask.promise;
    const pages: string[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const lines: string[] = [];
        let current = '';
        let previousY: number | null = null;

        const flush = () => {
          const line = current.replace(/\s+/g, ' ').trim();
          if (line) lines.push(line);
          current = '';
        };

        for (const item of content.items) {
          if (!('str' in item)) continue;
          const transform = 'transform' in item && Array.isArray(item.transform)
            ? item.transform
            : null;
          const y = transform && Number.isFinite(Number(transform[5]))
            ? Number(transform[5])
            : null;

          if (lineBreak(previousY, y)) flush();
          const value = item.str.replace(/\s+/g, ' ').trim();
          if (value) current += `${current ? ' ' : ''}${value}`;
          if ('hasEOL' in item && item.hasEOL) flush();
          previousY = y;
        }
        flush();
        if (lines.length > 0) pages.push(lines.join('\n'));
      }
    } finally {
      await document.destroy();
    }

    const text = pages.join('\n').trim();
    if (!text) {
      throw new PdfTextExtractionError('PDF contains no extractable text', 'EMPTY_PDF_TEXT');
    }
    return text;
  } catch (error) {
    if (error instanceof PdfTextExtractionError) throw error;
    throw new PdfTextExtractionError(
      `Failed to extract text from PDF artifact: ${error instanceof Error ? error.message : String(error)}`,
      'PDF_EXTRACTION_FAILED',
      { cause: error },
    );
  }
}
