import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const WFS = 'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej';
const SIMC = '0308749';
const EXPECTED_LOCALITY = 'Garbno';
const REPORT_PATH = 'test-results/polanow-garbno-prg-report.json';
const RAW_PATH = 'test-results/polanow-garbno-prg.gml';

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function field(block, name) {
  const match = new RegExp(`<ms:${name}>([\\s\\S]*?)<\\/ms:${name}>`, 'i').exec(block);
  return match ? decodeXml(match[1].trim()) : null;
}

function geometry(block) {
  const match = /<gml:pos>([-+0-9.]+)\s+([-+0-9.]+)<\/gml:pos>/i.exec(block);
  if (!match) throw new Error('Missing gml:pos');
  const northing = Number(match[1]);
  const easting = Number(match[2]);
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) throw new Error('Invalid EPSG:2180 position');
  return { x2180: easting, y2180: northing };
}

function parseMembers(xml) {
  const members = [...xml.matchAll(/<wfs:member>([\s\S]*?)<\/wfs:member>/gi)].map((match) => match[1]);
  if (members.length === 0) {
    // Older GeoServer encodings sometimes use gml:featureMember.
    members.push(...[...xml.matchAll(/<gml:featureMember>([\s\S]*?)<\/gml:featureMember>/gi)].map((match) => match[1]));
  }
  return members.map((block) => {
    const idMatch = /<ms:prg-adresy[^>]*gml:id="([^"]+)"/i.exec(block);
    if (!idMatch) throw new Error('Missing PRG feature id');
    const simc = field(block, 'simc');
    const locality = field(block, 'miejscowosc');
    const buildingNumber = field(block, 'numer');
    if (simc !== SIMC || locality !== EXPECTED_LOCALITY || !buildingNumber) {
      throw new Error(`Unexpected Garbno PRG member ${idMatch[1]} simc=${simc} locality=${locality} number=${buildingNumber}`);
    }
    return {
      prgId: idMatch[1],
      locality,
      simc,
      street: field(block, 'ulica'),
      ulic: field(block, 'ulic'),
      buildingNumber,
      postalCode: field(block, 'kod'),
      sourceTeryt: field(block, 'teryt'),
      ...geometry(block),
    };
  });
}

const url = new URL(WFS);
url.searchParams.set('SERVICE', 'WFS');
url.searchParams.set('VERSION', '1.1.0');
url.searchParams.set('REQUEST', 'GetFeature');
url.searchParams.set('TYPENAME', 'ms:prg-adresy');
url.searchParams.set('SRSNAME', 'EPSG:2180');
url.searchParams.set('MAXFEATURES', '200');
url.searchParams.set('CQL_FILTER', `simc='${SIMC}'`);

const response = await fetch(url, {
  redirect: 'follow',
  signal: AbortSignal.timeout(30_000),
  headers: { 'user-agent': 'WastePL/0.1 (+https://wastepl.pl)', accept: 'application/gml+xml,text/xml,application/xml' },
});
if (!response.ok) throw new Error(`GUGiK WFS HTTP ${response.status}`);
const xml = await response.text();
if (/ExceptionReport|ServiceException/i.test(xml)) throw new Error(`GUGiK WFS exception: ${xml.slice(0, 1000)}`);
const addresses = parseMembers(xml).sort((a, b) => a.buildingNumber.localeCompare(b.buildingNumber, 'pl', { numeric: true }));
if (addresses.length < 1) throw new Error('No official PRG addresses returned for Garbno SIMC 0308749');
const ids = new Set(addresses.map((address) => address.prgId));
if (ids.size !== addresses.length) throw new Error('Duplicate PRG feature ids in Garbno snapshot');
if (addresses.some((address) => !/^prg-adresy\.\d+$/.test(address.prgId))) throw new Error('Unexpected PRG feature id shape');

const report = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  source: {
    provider: 'Główny Urząd Geodezji i Kartografii (GUGiK)',
    dataset: 'Państwowy Rejestr Granic — Krajowa Integracja Numeracji Adresowej',
    wfsUrl: WFS,
    wfsLayer: 'ms:prg-adresy',
    querySimc: SIMC,
    responseSha256: createHash('sha256').update(xml, 'utf8').digest('hex'),
  },
  locality: { name: EXPECTED_LOCALITY, simc: SIMC, municipalityTerc: '3209063' },
  count: addresses.length,
  addresses,
};

await mkdir('test-results', { recursive: true });
await writeFile(RAW_PATH, xml, 'utf8');
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ count: addresses.length, first: addresses[0], last: addresses.at(-1), responseSha256: report.source.responseSha256 }, null, 2));
console.log(`Report: ${REPORT_PATH}`);
