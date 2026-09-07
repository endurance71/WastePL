import { describe, expect, it } from 'vitest';
import {
  acquirePrgMunicipality,
  buildPrgWfsPageUrl,
  municipalityKinaTeryt,
  parseKinaPrgAddressGml,
  prgWfsCollectionCounts,
} from './prg-wfs-acquisition.js';

function feature(index: number, kinaTeryt = '326101'): string {
  const id = 5_700_000 + index;
  return `<wfs:member>
    <ms:prg-adresy gml:id="prg-adresy.${id}">
      <ms:msGeometry>
        <gml:Point gml:id="prg-adresy.${id}.1" srsName="urn:ogc:def:crs:EPSG::2180">
          <gml:pos>${700000 + index}.25 ${300000 + index}.75</gml:pos>
        </gml:Point>
      </ms:msGeometry>
      <ms:miejscowosc>Koszalin</ms:miejscowosc>
      <ms:ulica>Testowa</ms:ulica>
      <ms:numer>${index}</ms:numer>
      <ms:teryt>${kinaTeryt}</ms:teryt>
      <ms:simc>0949448</ms:simc>
      <ms:ulic>00001</ms:ulic>
      <ms:kod>75-001</ms:kod>
    </ms:prg-adresy>
  </wfs:member>`;
}

function nextUrl(startIndex: number, count: number): string {
  const url = new URL('https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej');
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '2.0.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typenames', 'ms:prg-adresy');
  url.searchParams.set('count', String(count));
  url.searchParams.set('STARTINDEX', String(startIndex));
  return url.toString().replace(/&/g, '&amp;');
}

function page(
  total: number,
  startIndex: number,
  count: number,
  options?: {
    kinaTeryt?: string;
    numberMatchedRaw?: string;
    forceNextStartIndex?: number | null;
    featureIndexes?: number[];
  },
): string {
  const numberReturned = Math.max(0, Math.min(count, total - startIndex));
  const indexes = options?.featureIndexes ?? Array.from(
    { length: numberReturned },
    (_, offset) => startIndex + offset + 1,
  );
  const members = indexes.map((index) => feature(index, options?.kinaTeryt)).join('');
  const defaultNext = startIndex + numberReturned < total ? startIndex + numberReturned : null;
  const nextStart = options?.forceNextStartIndex === undefined
    ? defaultNext
    : options.forceNextStartIndex;
  const next = nextStart === null ? '' : ` next="${nextUrl(nextStart, count)}"`;
  const matched = options?.numberMatchedRaw ?? 'unknown';
  return `<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ms="http://mapserver.gis.umn.edu/mapserver" numberMatched="${matched}" numberReturned="${indexes.length}"${next}>${members}</wfs:FeatureCollection>`;
}

function requestWindow(url: string): { startIndex: number; count: number } {
  const parsed = new URL(url);
  return {
    startIndex: Number.parseInt(parsed.searchParams.get('startIndex') ?? '-1', 10),
    count: Number.parseInt(parsed.searchParams.get('count') ?? '-1', 10),
  };
}

describe('PRG full-population WFS acquisition', () => {
  it('derives six-digit KINA query scope from authoritative seven-digit municipality TERC', () => {
    expect(municipalityKinaTeryt('3261011')).toBe('326101');
    expect(municipalityKinaTeryt('3209042')).toBe('320904');
    expect(municipalityKinaTeryt('3201043')).toBe('320104');
    expect(() => municipalityKinaTeryt('320904')).toThrow('Invalid municipality TERC');
  });

  it('builds a bounded WFS 2.0 page request with the municipality filter', () => {
    const url = buildPrgWfsPageUrl({
      municipalityTerc: '3209042',
      startIndex: 2000,
      count: 2000,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('service')).toBe('WFS');
    expect(parsed.searchParams.get('version')).toBe('2.0.0');
    expect(parsed.searchParams.get('request')).toBe('GetFeature');
    expect(parsed.searchParams.get('typenames')).toBe('ms:prg-adresy');
    expect(parsed.searchParams.get('startIndex')).toBe('2000');
    expect(parsed.searchParams.get('count')).toBe('2000');
    expect(parsed.searchParams.get('filter')).toContain('<fes:Literal>320904</fes:Literal>');
  });

  it('accepts the live KINA WFS contract numberMatched=unknown and follows server next', () => {
    expect(prgWfsCollectionCounts(page(3, 0, 2))).toEqual({
      numberMatched: null,
      numberMatchedRaw: 'unknown',
      numberReturned: 2,
      nextStartIndex: 2,
    });
  });

  it('still validates numeric numberMatched when an upstream provides it', () => {
    expect(prgWfsCollectionCounts(page(3, 0, 2, { numberMatchedRaw: '3' }))).toEqual({
      numberMatched: 3,
      numberMatchedRaw: '3',
      numberReturned: 2,
      nextStartIndex: 2,
    });
    expect(() => prgWfsCollectionCounts('<wfs:FeatureCollection numberMatched="broken" numberReturned="0"/>'))
      .toThrow('invalid numberMatched');
  });

  it('parses the real KINA feature shape, preserves canonical prg-adresy id, and swaps EPSG:2180 axes', () => {
    const parsed = parseKinaPrgAddressGml(page(1, 0, 1), '3261011');
    expect(parsed.rejected).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      prgId: 'prg-adresy.5700001',
      municipalityTerc: '3261011',
      simc: '0949448',
      ulic: '00001',
      buildingNumber: '1',
      postalCode: '75-001',
      x: 300001.75,
      y: 700001.25,
      crs: 'EPSG:2180',
    });
  });

  it('captures more than 2000 official addresses through server-linked deterministic pagination', async () => {
    const windows: Array<{ startIndex: number; count: number }> = [];
    const acquisition = await acquirePrgMunicipality({
      municipalityTerc: '3261011',
      retrievedAt: '2026-09-07T10:00:00.000Z',
      fetchPage: async (url) => {
        const window = requestWindow(url);
        windows.push(window);
        return page(2001, window.startIndex, window.count);
      },
    });

    expect(windows).toEqual([
      { startIndex: 0, count: 2000 },
      { startIndex: 2000, count: 2000 },
    ]);
    expect(acquisition.totalRows).toBe(2001);
    expect(acquisition.pages).toHaveLength(2);
    expect(acquisition.pages.map((item) => item.numberReturned)).toEqual([2000, 1]);
    expect(acquisition.pages.map((item) => item.numberMatchedRaw)).toEqual(['unknown', 'unknown']);
    expect(acquisition.rows).toHaveLength(2001);
    expect(new Set(acquisition.rows.map((row) => row.prgId)).size).toBe(2001);
    expect(acquisition.rows.every((row) => row.prgId.startsWith('prg-adresy.'))).toBe(true);
    expect(acquisition.rows.every((row) => row.municipalityTerc === '3261011')).toBe(true);
    expect(acquisition.aggregateSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uses a sentinel page when numberMatched is unknown, the page is full, and next is absent', async () => {
    const windows: number[] = [];
    const acquisition = await acquirePrgMunicipality({
      municipalityTerc: '3261011',
      pageSize: 2,
      fetchPage: async (url) => {
        const { startIndex } = requestWindow(url);
        windows.push(startIndex);
        if (startIndex === 0) return page(2, 0, 2, { forceNextStartIndex: null });
        return page(2, 2, 2, { forceNextStartIndex: null });
      },
    });
    expect(windows).toEqual([0, 2]);
    expect(acquisition.totalRows).toBe(2);
    expect(acquisition.pages.map((item) => item.numberReturned)).toEqual([2, 0]);
  });

  it('is deterministic for the same frozen pages regardless of retrieval timestamp', async () => {
    const fetchPage = async (url: string) => {
      const window = requestWindow(url);
      return page(3, window.startIndex, window.count);
    };
    const first = await acquirePrgMunicipality({
      municipalityTerc: '3261011',
      pageSize: 2,
      retrievedAt: '2026-09-07T10:00:00.000Z',
      fetchPage,
    });
    const second = await acquirePrgMunicipality({
      municipalityTerc: '3261011',
      pageSize: 2,
      retrievedAt: '2026-09-07T11:00:00.000Z',
      fetchPage,
    });
    expect(second.aggregateSha256).toBe(first.aggregateSha256);
    expect(second.rows).toEqual(first.rows);
  });

  it('fails closed when numeric numberMatched changes between pages', async () => {
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        pageSize: 2,
        fetchPage: async (url) => {
          const window = requestWindow(url);
          return window.startIndex === 0
            ? page(3, 0, 2, { numberMatchedRaw: '3' })
            : page(4, 2, 2, { numberMatchedRaw: '4' });
        },
      }),
    ).rejects.toThrow('numberMatched drifted during pagination');
  });

  it('fails closed when server next STARTINDEX is not contiguous', async () => {
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        pageSize: 2,
        fetchPage: async () => page(3, 0, 2, { forceNextStartIndex: 99 }),
      }),
    ).rejects.toThrow('next STARTINDEX is not contiguous');
  });

  it('fails closed when a KINA feature escapes the requested six-digit municipality scope', async () => {
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        fetchPage: async () => page(1, 0, 1, { kinaTeryt: '320904' }),
      }),
    ).rejects.toThrow('rejected address features');
  });

  it('fails closed when WFS returns a duplicate PRG id across pages', async () => {
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        pageSize: 2,
        fetchPage: async (url) => {
          const window = requestWindow(url);
          return window.startIndex === 0
            ? page(3, 0, 2)
            : page(3, 2, 2, { featureIndexes: [2] });
        },
      }),
    ).rejects.toThrow('Duplicate PRG id across WFS pages');
  });

  it('fails closed when a returned KINA feature cannot be normalized', async () => {
    const malformed = '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ms="http://mapserver.gis.umn.edu/mapserver" numberMatched="unknown" numberReturned="1"><wfs:member><ms:prg-adresy gml:id="prg-adresy.1"><ms:teryt>326101</ms:teryt><ms:simc>0949448</ms:simc><ms:numer>1</ms:numer></ms:prg-adresy></wfs:member></wfs:FeatureCollection>';
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        fetchPage: async () => malformed,
      }),
    ).rejects.toThrow('rejected address features');
  });
});
