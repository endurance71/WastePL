const POLANOW_BIP_ORIGIN = 'https://bip.polanow.pl';
const POLANOW_H2_DOCUMENT_ID = '2846';
const ATTACHMENT_ID_PATTERN = /^[a-f0-9]{32}$/i;

export class PolanowBipAttachmentResolutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PolanowBipAttachmentResolutionError';
    this.code = code;
  }
}

export interface PolanowBipAttachmentResolution {
  attachmentId: string;
  wrapperUrl: string;
  downloadUrl: string;
}

function fail(code: string, message: string): never {
  throw new PolanowBipAttachmentResolutionError(code, message);
}

function parseH2Wrapper(wrapperUrl: string): { url: URL; attachmentId: string } {
  let url: URL;
  try {
    url = new URL(wrapperUrl);
  } catch {
    return fail('INVALID_WRAPPER_URL', `Invalid Polanów BIP wrapper URL: ${wrapperUrl}`);
  }

  if (
    url.origin !== POLANOW_BIP_ORIGIN ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    return fail('UNTRUSTED_WRAPPER_URL', `Wrapper is outside the canonical Polanów BIP origin: ${wrapperUrl}`);
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (
    segments.length !== 4 ||
    segments[0] !== 'zalacznik' ||
    segments[2] !== '70' ||
    segments[3] !== POLANOW_H2_DOCUMENT_ID
  ) {
    return fail(
      'UNSUPPORTED_WRAPPER_PATH',
      `Wrapper must belong to Polanów H2 document ${POLANOW_H2_DOCUMENT_ID}: ${wrapperUrl}`,
    );
  }

  const attachmentId = segments[1] ?? '';
  if (!ATTACHMENT_ID_PATTERN.test(attachmentId)) {
    return fail('INVALID_ATTACHMENT_ID', `Wrapper attachment id is not a 32-hex identifier: ${attachmentId}`);
  }

  return { url, attachmentId: attachmentId.toLowerCase() };
}

export function resolvePolanowH2AttachmentDownload(
  wrapperUrl: string,
  attachmentHref: string,
): PolanowBipAttachmentResolution {
  const wrapper = parseH2Wrapper(wrapperUrl);

  let candidate: URL;
  try {
    // The Polanów BIP renders `pobierz.php?...` from a deeply nested wrapper page,
    // but the endpoint lives at the site origin. Resolve against origin intentionally.
    candidate = new URL(attachmentHref, `${POLANOW_BIP_ORIGIN}/`);
  } catch {
    return fail('INVALID_DOWNLOAD_HREF', `Invalid Polanów BIP attachment href: ${attachmentHref}`);
  }

  if (candidate.origin !== POLANOW_BIP_ORIGIN || candidate.pathname !== '/pobierz.php' || candidate.hash !== '') {
    return fail('UNTRUSTED_DOWNLOAD_URL', `Attachment download URL is not the canonical Polanów BIP endpoint: ${candidate}`);
  }

  const params = [...candidate.searchParams.entries()];
  if (params.length !== 2 || candidate.searchParams.get('d') !== 'zal') {
    return fail('INVALID_DOWNLOAD_QUERY', `Attachment download query must contain only d=zal and id: ${candidate.search}`);
  }

  const candidateId = candidate.searchParams.get('id')?.toLowerCase() ?? '';
  if (!ATTACHMENT_ID_PATTERN.test(candidateId)) {
    return fail('INVALID_DOWNLOAD_ATTACHMENT_ID', `Download attachment id is not a 32-hex identifier: ${candidateId}`);
  }

  if (candidateId !== wrapper.attachmentId) {
    return fail(
      'ATTACHMENT_ID_MISMATCH',
      `Wrapper id ${wrapper.attachmentId} does not match download id ${candidateId}`,
    );
  }

  const canonical = new URL('/pobierz.php', POLANOW_BIP_ORIGIN);
  canonical.searchParams.set('d', 'zal');
  canonical.searchParams.set('id', wrapper.attachmentId);

  return {
    attachmentId: wrapper.attachmentId,
    wrapperUrl: wrapper.url.toString(),
    downloadUrl: canonical.toString(),
  };
}
