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

type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

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
      day: Weekday;
      intervals: Array<{ opens: string; closes: string }>;
    }>;
    exceptions: [];
    sourceKey: string;
  };
  access: {
    scope: 'OPEN_TO_ALL' | 'MUNICIPALITY_RESIDENTS' | 'MUNICIPALITY_PROPERTY_OWNERS' | 'OTHER' | 'UNKNOWN';
    requiresProof: boolean | null;
    quantityLimits: Array<{ material: string; limit: string; period: string | null; sourceKey: string }>;
    notes: string[];
    sourceKey: string | null;
  };
  operationalStatus: {
    state: 'UNKNOWN';
    observedAt: null;
    sourceKey: null;
    note: string | null;
  };
  operatorName: string | null;
  rulesUrl: string | null;
  sourceKey: string;
  quality: {
    verificationStatus: 'OFFICIAL_SOURCE' | 'REVIEW_REQUIRED';
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

const COORDINATE_PAIR = String.raw`(-?\d{2}\.\d{4,})\s*,\s*(-?\d{2}\.\d{4,})`;

// The live page publishes the Komunalna 5 pin only inside its Google Maps embed
// (title/aria-label attributes), which textFromHtml strips with the tag.
function publishedCoordinates(html: string, text: string): RegExpExecArray | null {
  const inText = new RegExp(COORDINATE_PAIR).exec(text);
  if (inText) return inText;
  const embed = /<iframe\b[^>]*\bsrc="https:\/\/maps\.google\.com\/maps\?[^"]*"[^>]*>/i.exec(html);
  if (!embed) return null;
  return new RegExp(String.raw`\btitle="${COORDINATE_PAIR}"`).exec(embed[0]);
}

function latestRetrievedAt(...values: string[]): string {
  return values
    .map((value) => new Date(value))
    .sort((a, b) => b.getTime() - a.getTime())[0]!
    .toISOString();
}

interface HoursInterval {
  opens: string;
  closes: string;
}

interface PublishedWeeklyHours {
  weekdays: HoursInterval;
  wednesday: HoursInterval;
  saturday: HoursInterval;
}

// PGK publishes times as "8:00", "8.00" and occasionally "8 :00", so whitespace
// around the separator is tolerated.
const TIME = String.raw`(\d{1,2})\s*[:.]\s*(\d{2})`;
const TIME_RANGE = String.raw`${TIME}\s*[–—-]\s*${TIME}`;

function clockTime(hours: string, minutes: string, message: string): string {
  const h = Number(hours);
  const m = Number(minutes);
  if (h > 23 || m > 59) throw new Error(`PGK PSZOK adapter: ${message}`);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function publishedInterval(text: string, label: string, message: string): HoursInterval {
  const match = new RegExp(`${label}\\s*:\\s*${TIME_RANGE}`, 'iu').exec(text);
  if (!match) throw new Error(`PGK PSZOK adapter: ${message}`);
  const opens = clockTime(match[1]!, match[2]!, message);
  const closes = clockTime(match[3]!, match[4]!, message);
  if (opens >= closes) throw new Error(`PGK PSZOK adapter: ${message}`);
  return { opens, closes };
}

function publishedWeeklyHours(mainText: string): PublishedWeeklyHours {
  return {
    weekdays: publishedInterval(
      mainText,
      String.raw`Poniedziałek\s*,\s*wtorek\s*,\s*czwartek\s*,\s*piątek`,
      'weekday hours missing',
    ),
    wednesday: publishedInterval(mainText, 'Środa', 'Wednesday hours missing'),
    saturday: publishedInterval(mainText, 'Sobota', 'Saturday hours missing'),
  };
}

function openingHours(
  hours: PublishedWeeklyHours,
  sourceKey: string,
): NormalizedFacilityV02['openingHours'] {
  return {
    timezone: 'Europe/Warsaw',
    weekly: [
      { day: 'MONDAY', intervals: [{ ...hours.weekdays }] },
      { day: 'TUESDAY', intervals: [{ ...hours.weekdays }] },
      { day: 'WEDNESDAY', intervals: [{ ...hours.wednesday }] },
      { day: 'THURSDAY', intervals: [{ ...hours.weekdays }] },
      { day: 'FRIDAY', intervals: [{ ...hours.weekdays }] },
      { day: 'SATURDAY', intervals: [{ ...hours.saturday }] },
      { day: 'SUNDAY', intervals: [] },
    ],
    exceptions: [],
    sourceKey,
  };
}

function accessRules(
  mainSourceKey: string,
  faqSourceKey: string,
  includePublishedLimits: boolean,
): NormalizedFacilityV02['access'] {
  return {
    scope: 'MUNICIPALITY_RESIDENTS',
    requiresProof: true,
    quantityLimits: includePublishedLimits
      ? [
          {
            material: 'TYRES',
            limit: '8 sztuk na gospodarstwo domowe',
            period: 'YEAR',
            sourceKey: faqSourceKey,
          },
          {
            material: 'CONSTRUCTION',
            limit: '100 kg łącznie na gospodarstwo domowe',
            period: 'YEAR',
            sourceKey: faqSourceKey,
          },
        ]
      : [],
    notes: [
      'Dokument potwierdzający uprawnienie do korzystania z PSZOK jest wymagany zgodnie z typem zabudowy.',
    ],
    sourceKey: mainSourceKey,
  };
}

function unknownOperationalStatus(): NormalizedFacilityV02['operationalStatus'] {
  return {
    state: 'UNKNOWN',
    observedAt: null,
    sourceKey: null,
    note: 'Opublikowane godziny nie są źródłem bieżącego statusu operacyjnego.',
  };
}

export class PgkKoszalinPszokHtmlAdapter {
  readonly parserKey = 'pgk-koszalin-pszok-html';
  readonly parserVersion = '1.2.0';

  parse(input: PgkKoszalinPszokInput): NormalizedFacilityV02 {
    return this.parseAll(input)[0]!;
  }

  parseAll(input: PgkKoszalinPszokInput): NormalizedFacilityV02[] {
    const mainText = textFromHtml(input.main.html);
    const faqText = textFromHtml(input.faq.html);

    requireText(mainText, /PSZOK\s*[–—-]\s*ul\.\s*Komunalna\s*5/i, 'Komunalna 5 location missing');
    requireText(mainText, /PSZOK\s*[–—-]\s*ul\.\s*Na\s*Skwierzynkę\s*2/i, 'Na Skwierzynkę 2 location missing');
    // ADR-0007: the main page owns opening hours; the FAQ only contributes materials and limits.
    const hours = publishedWeeklyHours(mainText);
    requireText(mainText, /potwierdzenie.*opłat|dokument.*zamieszkan/i, 'resident proof rule missing');
    requireText(faqText, /8\s*sztuk.*rocznie.*gospodarstwo/i, 'tyre limit missing');
    requireText(faqText, /100\s*kg.*rocznie.*gospodarstwo/i, 'construction limit missing');

    const coordinates = publishedCoordinates(input.main.html, mainText);
    const location = coordinates
      ? { lat: Number(coordinates[1]), lon: Number(coordinates[2]) }
      : null;
    const locationSourceKey = coordinates ? input.main.sourceKey : null;
    const warnings = coordinates ? [] : ['TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE'];

    const acceptedMaterials = materialSet(faqText);
    if (acceptedMaterials.length < 5) {
      throw new Error('PGK PSZOK adapter: accepted-material extraction unexpectedly sparse');
    }

    const retrievedAt = latestRetrievedAt(input.main.retrievedAt, input.faq.retrievedAt);
    const operatorName = 'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie';

    const komunalna: NormalizedFacilityV02 = {
      schemaVersion: '0.2.0',
      key: 'pl-3261011-pszok-komunalna-5',
      kind: 'PSZOK',
      name: 'PSZOK – ul. Komunalna 5',
      address: 'ul. Komunalna 5, Koszalin',
      location,
      locationSourceKey,
      externalIds: [],
      acceptedMaterials,
      acceptedContainers: [],
      openingHours: openingHours(hours, input.main.sourceKey),
      access: accessRules(input.main.sourceKey, input.faq.sourceKey, true),
      operationalStatus: unknownOperationalStatus(),
      operatorName,
      rulesUrl: 'https://www.pgkkoszalin.pl/wp-content/uploads/2025/06/PSZOK-Komunalna-5.pdf',
      sourceKey: input.main.sourceKey,
      quality: {
        verificationStatus: 'OFFICIAL_SOURCE',
        confidence: coordinates ? 0.99 : 0.9,
        retrievedAt,
        warnings,
      },
    };

    const skwierzynke: NormalizedFacilityV02 = {
      schemaVersion: '0.2.0',
      key: 'pl-3261011-pszok-na-skwierzynke-2',
      kind: 'PSZOK',
      name: 'PSZOK – ul. Na Skwierzynkę 2',
      address: 'ul. Na Skwierzynkę 2, Koszalin',
      location: null,
      locationSourceKey: null,
      externalIds: [],
      acceptedMaterials: [],
      acceptedContainers: [],
      openingHours: openingHours(hours, input.main.sourceKey),
      access: accessRules(input.main.sourceKey, input.faq.sourceKey, false),
      operationalStatus: unknownOperationalStatus(),
      operatorName,
      rulesUrl: input.main.url,
      sourceKey: input.main.sourceKey,
      quality: {
        verificationStatus: 'REVIEW_REQUIRED',
        confidence: 0.8,
        retrievedAt,
        warnings: ['TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE'],
      },
    };

    return [komunalna, skwierzynke];
  }
}
