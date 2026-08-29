import { describe, expect, it } from 'vitest';
import {
  extractPolanowH2AttachmentHref,
  PolanowBipAttachmentResolutionError,
  resolvePolanowH2AttachmentDownload,
} from './polanow-bip-attachment.js';

const h2Wrapper =
  'https://bip.polanow.pl/zalacznik/b9dd65849fc6ebcb56cb8e3ce17710d5/70/2846/';

describe('resolvePolanowH2AttachmentDownload', () => {
  it('resolves the BIP relative attachment link against the site origin', () => {
    const result = resolvePolanowH2AttachmentDownload(
      h2Wrapper,
      'pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5',
    );

    expect(result).toEqual({
      attachmentId: 'b9dd65849fc6ebcb56cb8e3ce17710d5',
      wrapperUrl: h2Wrapper,
      downloadUrl:
        'https://bip.polanow.pl/pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5',
    });
  });

  it('accepts the already root-qualified canonical download path', () => {
    const result = resolvePolanowH2AttachmentDownload(
      h2Wrapper,
      '/pobierz.php?id=b9dd65849fc6ebcb56cb8e3ce17710d5&d=zal',
    );

    expect(result.downloadUrl).toBe(
      'https://bip.polanow.pl/pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5',
    );
  });

  it('rejects the old H1 document so it cannot satisfy an H2 acquisition check', () => {
    expect(() =>
      resolvePolanowH2AttachmentDownload(
        'https://bip.polanow.pl/zalacznik/b9dd65849fc6ebcb56cb8e3ce17710d5/70/2660/',
        'pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5',
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PolanowBipAttachmentResolutionError>>({
        code: 'UNSUPPORTED_WRAPPER_PATH',
      }),
    );
  });

  it('rejects a mismatched wrapper and download attachment id', () => {
    expect(() =>
      resolvePolanowH2AttachmentDownload(
        h2Wrapper,
        'pobierz.php?d=zal&id=2ab2d7615a89d857c47d062ae014d941',
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PolanowBipAttachmentResolutionError>>({
        code: 'ATTACHMENT_ID_MISMATCH',
      }),
    );
  });

  it('rejects an external download origin', () => {
    expect(() =>
      resolvePolanowH2AttachmentDownload(
        h2Wrapper,
        'https://example.test/pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5',
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PolanowBipAttachmentResolutionError>>({
        code: 'UNTRUSTED_DOWNLOAD_URL',
      }),
    );
  });

  it('rejects extra query parameters instead of silently widening the acquisition contract', () => {
    expect(() =>
      resolvePolanowH2AttachmentDownload(
        h2Wrapper,
        'pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5&token=unexpected',
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PolanowBipAttachmentResolutionError>>({
        code: 'INVALID_DOWNLOAD_QUERY',
      }),
    );
  });
});

describe('extractPolanowH2AttachmentHref', () => {
  it('extracts and decodes the matching HTML-escaped BIP href', () => {
    const html = `
      <html>
        <a href="/unrelated">other</a>
        <a class="download" href="pobierz.php?d=zal&amp;id=b9dd65849fc6ebcb56cb8e3ce17710d5">PDF</a>
      </html>
    `;

    expect(extractPolanowH2AttachmentHref(h2Wrapper, html)).toBe(
      'pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5',
    );
  });

  it('ignores a download href for a different attachment and fails closed', () => {
    const html = `
      <a href="pobierz.php?d=zal&amp;id=2ab2d7615a89d857c47d062ae014d941">wrong PDF</a>
    `;

    expect(() => extractPolanowH2AttachmentHref(h2Wrapper, html)).toThrowError(
      expect.objectContaining<Partial<PolanowBipAttachmentResolutionError>>({
        code: 'DOWNLOAD_LINK_NOT_FOUND',
      }),
    );
  });
});
