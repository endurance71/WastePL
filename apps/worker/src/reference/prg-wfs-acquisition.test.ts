import { describe, expect, it } from 'vitest';
import {
  acquirePrgMunicipality,
  buildPrgWfsPageUrl,
  municipalityKinaTeryt,
  prgWfsCollectionCounts,
} from './prg-wfs-acquisition.js';

function feature(index: number, municipalityTerc = '3261011'): string {
  const prgId = `prg-${String(index).padStart(6, '0')}`;
  return `<wfs:member><prg:AD_PunktAdresowy gml:id="${prgId}"><prg:terc>${municipalityTerc}</prg:terc><prg:simc>0949448</prg:simc><prg:numerPorzadkowy>${index}</prg:numerPorzadkowy><gml:Point srsName="EPSG:2180"><gml:pos>${300000 + index} ${700000 + index}</gml:pos></gml:Point></prg:AD_PunktAdresowy></wfs:member>`;
}

function page(total: number, startIndex: number, count: number, options?: { municipalityTerc?: string }): string {
  const numberReturned = Math.max(0, Math.min(count, total - startIndex));
  const members = Array.from({ length: numberReturned }, (_, offset) =>
    feature(startIndex + offset + 1, options?.municipalityTerc),
  ).join('');
  return `<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:prg="urn:test:prg" numberMatched="${total}" numberReturned="${numberReturned}">${members}</wfs:FeatureCollection>`;
}

function requestWindow(url: string): { startIndex: number; count: number } {
  const parsed = new URL(url);
  return {
    startIndex: Number.parseInt(parsed.searchParams.get('startIndex') ?? '-1', 10),
    count: Number.parseInt(parsed.searchParams.get('count') ?? '-1', 10),
  };
}

describe('PRG full-population WFS acquisition', () => {
  it('derives six-digit KINA municipality query code from authoritative seven-digit TERC', () => {
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

  it('requires numeric WFS collection counters', () => {
    expect(prgWfsCollectionCounts(page(3, 0, 2))).toEqual({
      numberMatched: 3,
      numberReturned: 2,
    });
    expect(() => prgWfsCollectionCounts('<wfs:FeatureCollection numberMatched="unknown" numberReturned="0"/>'))
      .toThrow('missing numeric numberMatched');
  });

  it('captures more than 2000 official addresses through deterministic pagination', async () => {
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
    expect(acquisition.rows).toHaveLength(2001);
    expect(new Set(acquisition.rows.map((row) => row.prgId)).size).toBe(2001);
    expect(acquisition.rows.every((row) => row.municipalityTerc === '3261011')).toBe(true);
    expect(acquisition.aggregateSha256).toMatch(/^[a-f0-9]{64}$/);
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

  it('fails closed when numberMatched changes between pages', async () => {
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        pageSize: 2,
        fetchPage: async (url) => {
          const window = requestWindow(url);
          return window.startIndex === 0 ? page(3, 0, 2) : page(4, 2, 2);
        },
      }),
    ).rejects.toThrow('numberMatched drifted during pagination');
  });

  it('fails closed when a page contains an address from another municipality', async () => {
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        fetchPage: async () => page(1, 0, 1, { municipalityTerc: '3209042' }),
      }),
    ).rejects.toThrow('escaped municipality scope');
  });

  it('fails closed when WFS returns a duplicate PRG id across pages', async () => {
    const duplicateSecondPage = `<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:prg="urn:test:prg" numberMatched="3" numberReturned="1">${feature(2)}</wfs:FeatureCollection>`;
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        pageSize: 2,
        fetchPage: async (url) => {
          const window = requestWindow(url);
          return window.startIndex === 0 ? page(3, 0, 2) : duplicateSecondPage;
        },
      }),
    ).rejects.toThrow('Duplicate PRG id across WFS pages');
  });

  it('fails closed when a returned feature cannot be parsed as an official PRG address', async () => {
    const malformed = '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:prg="urn:test:prg" numberMatched="1" numberReturned="1"><wfs:member><prg:AD_PunktAdresowy gml:id="broken"><prg:terc>3261011</prg:terc></prg:AD_PunktAdresowy></wfs:member></wfs:FeatureCollection>';
    await expect(
      acquirePrgMunicipality({
        municipalityTerc: '3261011',
        fetchPage: async () => malformed,
      }),
    ).rejects.toThrow('rejected address features');
  });
});
