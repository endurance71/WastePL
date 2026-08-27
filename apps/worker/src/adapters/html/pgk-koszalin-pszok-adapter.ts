import type { FacilityMaterial } from '@wastepl/domain';

export interface HtmlArtifactInput {
  html: string;
  sourceKey: string;
  url: string;
  sha256: string;
  retrievedAt: string;
  storageUri: string | null;
}

export interface PgkKoszalinPszokInput {
  main: HtmlArtifactInput;
  faq: HtmlArtifactInput;
}

export interface NormalizedFacilityV02 {
  schemaVersion: '0.2.0';
  key: string;
  kind: 'PSZOK';
  name: string;
  address: string;
  location: { lat: number; lon: number } | null;
  locationSourceKey: string | null;
  externalIds: Array<{ provider: string; id: string }>;
  acceptedMaterials: FacilityMaterial[];
  acceptedContainers: [];
  openingHours: {
    timezone: 'Europe/Warsaw';
    weekly: Array<{
      day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
      intervals: Array<{ opens: string; closes: string }>;
    }>;
    exceptions: [];
    sourceKey: string;
  };
  access: {
    scope: 'MUNICIPALITY_RESIDENTS';
    requiresProof: true;
    quantityLimits: Array<{ material: string; limit: string; period: string | null; sourceKey: string }>;
    notes: string[];
    sourceKey: string;
  };
  operationalStatus: {
    state: 'UNKNOWN';
    observedAt: null;
    sourceKey: null;
    note: string;
  };
  operatorName: string;
  rulesUrl: string;
  sourceKey: string;
  quality: {
    verificationStatus: 'OFFICIAL_SOURCE';
    confidence: number;
    retrievedAt: string;
    warnings: string[];
  };
}

function textFromHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function materialSet(faqText: string): FacilityMaterial[] {
  const mappings: Array<[FacilityMaterial, RegExp]> = [
    ['PAPER', /papier|tektur/i],
    ['GLASS', /szkł/i],
    ['METALS_PLASTICS', /tworzyw(?:a| sztuczn)|metale/i],
    ['BIO', /biodegrad|bioodpad/i],
    ['BULKY', /wielkogabaryt/i],
    ['TEXTILES', /tekstyl|odzież/i],
    ['ELECTRONICS', /elektrycz|elektronicz/i],
    ['BATTERIES', /bateri|akumulator/i],
    ['MEDICINES', /lek(?:i|ów)/i],
    ['TYRES', /opon/i],
    ['CONSTRUCTION', /budowlan|remont|demontaż/i],
    ['RUBBLE', /gruz/i],
    ['HAZARDOUS', /niebezpiecz|farb|rtę/i],
  ];

  return mappings.filter(([, pattern]) => pattern.test(faqText)).map(([material]) => material);
}

function requireText(text: string, pattern: RegExp, message: string): void {
  if (!pattern.test(text)) throw new Error(`PGK PSZOK adapter: ${message}`);
}

function latestRetrievedAt(...values: string[]): string {
  return values
    .map((value) => new Date(value))
    .sort((a, b) => b.getTime() - a.getTime())[0]!
    .toISOString();
}

export class PgkKoszalinPszokHtmlAdapter {
  readonly parserKey = 'pgk-koszalin-pszok-html';
  readonly parserVersion = '1.0.0';

  parse(input: PgkKoszalinPszokInput): NormalizedFacilityV02 {
    const mainText = textFromHtml(input.main.html);
    const faqText = textFromHtml(input.faq.html);

    requireText(mainText, /PSZOK\s*[–—-]\s*ul\.\s*Komunalna\s*5/i, 'Komunalna 5 location missing');
    requireText(mainText, /Poniedziałek.*wtorek.*czwartek.*piątek.*8[:.]?00.*16[:.]?00/i, 'weekday hours missing');
    requireText(mainText, /Środa.*10[:.]?00.*18[:.]?00/i, 'Wednesday hours missing');
    requireText(mainText, /Sobota.*8[:.]?00.*13[:.]?00/i, 'Saturday hours missing');
    requireText(mainText, /potwierdzenie.*opłat|dokument.*zamieszkan/i, 'resident proof rule missing');
    requireText(faqText, /8\s*sztuk.*rocznie.*gospodarstwo/i, 'tyre limit missing');
    requireText(faqText, /100\s*kg.*rocznie.*gospodarstwo/i, 'construction limit missing');

    const coordinates = /(-?\d{2}\.\d{4,})\s*,\s*(-?\d{2}\.\d{4,})/.exec(mainText);
    if (!coordinates) throw new Error('PGK PSZOK adapter: published coordinates missing');

    const acceptedMaterials = materialSet(faqText);
    if (acceptedMaterials.length < 5) {
      throw new Error('PGK PSZOK adapter: accepted-material extraction unexpectedly sparse');
    }

    return {
      schemaVersion: '0.2.0',
      key: 'pl-3261011-pszok-komunalna-5',
      kind: 'PSZOK',
      name: 'PSZOK – ul. Komunalna 5',
      address: 'ul. Komunalna 5, Koszalin',
      location: { lat: Number(coordinates[1]), lon: Number(coordinates[2]) },
      locationSourceKey: input.main.sourceKey,
      externalIds: [],
      acceptedMaterials,
      acceptedContainers: [],
      openingHours: {
        timezone: 'Europe/Warsaw',
        weekly: [
          { day: 'MONDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
          { day: 'TUESDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
          { day: 'WEDNESDAY', intervals: [{ opens: '10:00', closes: '18:00' }] },
          { day: 'THURSDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
          { day: 'FRIDAY', intervals: [{ opens: '08:00', closes: '16:00' }] },
          { day: 'SATURDAY', intervals: [{ opens: '08:00', closes: '13:00' }] },
          { day: 'SUNDAY', intervals: [] },
        ],
        exceptions: [],
        sourceKey: input.main.sourceKey,
      },
      access: {
        scope: 'MUNICIPALITY_RESIDENTS',
        requiresProof: true,
        quantityLimits: [
          { material: 'TYRES', limit: '8 sztuk na gospodarstwo domowe', period: 'YEAR', sourceKey: input.faq.sourceKey },
          { material: 'CONSTRUCTION', limit: '100 kg łącznie na gospodarstwo domowe', period: 'YEAR', sourceKey: input.faq.sourceKey },
        ],
        notes: [
          'Dokument potwierdzający uprawnienie do korzystania z PSZOK jest wymagany zgodnie z typem zabudowy.',
        ],
        sourceKey: input.main.sourceKey,
      },
      operationalStatus: {
        state: 'UNKNOWN',
        observedAt: null,
        sourceKey: null,
        note: 'Opublikowane godziny nie są źródłem bieżącego statusu operacyjnego.',
      },
      operatorName: 'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie',
      rulesUrl: 'https://www.pgkkoszalin.pl/wp-content/uploads/2025/06/PSZOK-Komunalna-5.pdf',
      sourceKey: input.main.sourceKey,
      quality: {
        verificationStatus: 'OFFICIAL_SOURCE',
        confidence: 0.99,
        retrievedAt: latestRetrievedAt(input.main.retrievedAt, input.faq.retrievedAt),
        warnings: [],
      },
    };
  }
}
