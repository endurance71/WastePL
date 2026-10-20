import { describe, expect, it } from 'vitest';
import { acquirePrgMunicipality } from './prg-wfs-acquisition.js';

function feature(index: number): string {
  const id = 5_900_000 + index;
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
      <ms:teryt>326101</ms:teryt>
      <ms:simc>0949448</ms:simc>
      <ms:ulic>00001</ms:ulic>
      <ms:kod>75-001</ms:kod>
    </ms:prg-adresy>
  </wfs:member>`;
}

function nextUrl(startIndex: number, count: number): string {
  const url = new URL('https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej');
  url.searchParams.set('STARTINDEX', String(startIndex));
  url.searchParams.set('count', String(count));
  return url.toString().replace(/&/g, '&amp;');
}

function page(input: {
  total: number;
  startIndex: number;
  count: number;
  numberMatchedRaw: string;
}): string {
  const numberReturned = Math.max(0, Math.min(input.count, input.total - input.startIndex));
  const members = Array.from(
    { length: numberReturned },
    (_, offset) => feature(input.startIndex + offset + 1),
  ).join('');
  const nextIndex = input.startIndex + numberReturned;
  const next = nextIndex < input.total
    ? ` next="${nextUrl(nextIndex, input.count)}"`
    : '';
  return `<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ms="http://mapserver.gis.umn.edu/mapserver" numberMatched="${input.numberMatchedRaw}" numberReturned="${numberReturned}"${next}>${members}</wfs:FeatureCollection>`;
}

function requestStartIndex(url: string): number {
  return Number.parseInt(new URL(url).searchParams.get('startIndex') ?? '-1', 10);
}

describe('KINA final numeric numberMatched contract', () => {
  it('accepts unknown intermediate pages followed by a consistent numeric final total', async () => {
    const windows: number[] = [];
    const acquisition = await acquirePrgMunicipality({
      municipalityTerc: '3261011',
      pageSize: 2,
      fetchPage: async (url) => {
        const startIndex = requestStartIndex(url);
        windows.push(startIndex);
        return page({
          total: 5,
          startIndex,
          count: 2,
          numberMatchedRaw: startIndex === 4 ? '5' : 'unknown',
        });
      },
    });

    expect(windows).toEqual([0, 2, 4]);
    expect(acquisition.totalRows).toBe(5);
    expect(acquisition.pages.map((item) => item.numberMatchedRaw)).toEqual(['unknown', 'unknown', '5']);
    expect(acquisition.pages.map((item) => item.numberReturned)).toEqual([2, 2, 1]);
  });

  it('fails closed when numeric numberMatched falls back to unknown', async () => {
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        pageSize: 2,
        fetchPage: async (url) => {
          const startIndex = requestStartIndex(url);
          return page({
            total: 3,
            startIndex,
            count: 2,
            numberMatchedRaw: startIndex === 0 ? '3' : 'unknown',
          });
        },
      }),
    ).rejects.toThrow('numberMatched drifted during pagination');
  });

  it('fails closed when a newly revealed numeric final total is inconsistent with captured rows', async () => {
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        pageSize: 2,
        fetchPage: async (url) => {
          const startIndex = requestStartIndex(url);
          return page({
            total: 3,
            startIndex,
            count: 2,
            numberMatchedRaw: startIndex === 0 ? 'unknown' : '4',
          });
        },
      }),
    ).rejects.toThrow('acquisition incomplete: expected 4 rows, captured 3');
  });
});
