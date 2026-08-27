import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePrgAddressGml } from './prg-gml.js';
import { parseSimcXml, parseTercXml, parseUlicXml, streetDisplayName } from './teryt-xml.js';

const fixture = (name: string) => readFileSync(
  new URL(`../../test/fixtures/reference/${name}`, import.meta.url),
  'utf8',
);

describe('official reference parsers', () => {
  it('parses municipality-level TERC rows and ignores higher administrative levels', () => {
    const xml = fixture('TERC.xml').replace(
      '<row>\n    <col name="WOJ">32</col><col name="POW">61</col>',
      '<row><col name="WOJ">32</col><col name="NAZWA">Zachodniopomorskie</col><col name="NAZDOD">województwo</col><col name="STAN_NA">2026-01-01</col></row>\n  <row>\n    <col name="WOJ">32</col><col name="POW">61</col>',
    );
    const rows = parseTercXml(xml);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => `${row.woj}${row.pow}${row.gmi}${row.rodz}`)).toEqual(['3261011', '3209042']);
  });

  it('parses SIMC and treats ULIC as locality-scoped identity', () => {
    const simc = parseSimcXml(fixture('SIMC.xml'));
    const ulic = parseUlicXml(fixture('ULIC.xml'));
    expect(simc.find((row) => row.simc === '0308040')?.name).toBe('Bonin');
    expect(ulic).toHaveLength(1);
    expect(ulic[0]).toMatchObject({ simc: '0949448', ulic: '11926', streetType: 'ul.' });
    expect(streetDisplayName(ulic[0]!)).toBe('1 Maja');
  });

  it('parses PRG-like address features without guessing CRS', () => {
    const parsed = parsePrgAddressGml(fixture('PRG-addresses.gml'));
    expect(parsed.rejected).toEqual([]);
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows[0]).toMatchObject({
      prgId: 'fixture-pa-1-maja-3',
      municipalityTerc: '3261011',
      simc: '0949448',
      ulic: '11926',
      buildingNumber: '3',
      crs: 'EPSG:2180',
    });
    expect(parsed.rows[2]).toMatchObject({
      prgId: 'fixture-pa-bonin-2',
      simc: '0308040',
      ulic: null,
      crs: 'EPSG:4326',
    });
  });

  it('rejects an unknown PRG CRS instead of interpreting coordinates heuristically', () => {
    const broken = fixture('PRG-addresses.gml').replace(
      'urn:ogc:def:crs:EPSG::2180',
      'urn:ogc:def:crs:EPSG::9999',
    );
    const parsed = parsePrgAddressGml(broken);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rejected).toEqual([
      expect.objectContaining({ featureKey: 'fixture-pa-1-maja-3', reason: expect.stringContaining('Unsupported PRG CRS') }),
    ]);
  });
});
