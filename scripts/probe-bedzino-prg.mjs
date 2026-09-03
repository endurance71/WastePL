import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const WFS = 'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej';
const SOURCE_TERYT = '320901';
const MUNICIPALITY_TERC = '3209012';
const REPORT_PATH = 'test-results/bedzino-prg-report.json';
const RAW_PATH = 'test-results/bedzino-prg.gml';

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
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
    throw new Error('Invalid EPSG:2180 position');
  }
  return { x2180: easting, y2180: northing };
}

function parseMembers(xml) {
  const members = [...xml.matchAll(/<wfs:member>([\s\S]*?)<\/wfs:member>/gi)].map((match) => match[1]);
  if (members.length === 0) {
    members.push(...[...xml.matchAll(/<gml:featureMember>([\s\S]*?)<\/gml:featureMember>/gi)].map((match) => match[1]));
  }

  return members.map((block) => {
    const idMatch = /<ms:prg-adresy[^>]*gml:id="([^"]+)"/i.exec(block);
    if (!idMatch) throw new Error('Missing PRG feature id');

    const sourceTeryt = field(block, 'teryt');
    const locality = field(block, 'miejscowosc');
    const simc = field(block, 'simc');
    const buildingNumber = field(block, 'numer');
    if (sourceTeryt !== SOURCE_TERYT || !locality || !simc || !buildingNumber) {
      throw new Error(
        `Unexpected Będzino PRG member ${idMatch[1]} teryt=${sourceTeryt} locality=${locality} simc=${simc} number=${buildingNumber}`,
      );
    }

    return {
      prgId: idMatch[1],
      municipalityTerc: MUNICIPALITY_TERC,
      sourceTeryt,
      locality,
      simc,
      street: field(block, 'ulica'),
      ulic: field(block, 'ulic'),
      buildingNumber,
      postalCode: field(block, 'kod'),
      ...geometry(block),
    };
  });
}

const ogcFilter = [
  '<ogc:Filter xmlns:ogc="http://www.opengis.net/ogc" xmlns:ms="http://mapserver.gis.umn.edu/mapserver">',
  '<ogc:PropertyIsEqualTo>',
  '<ogc:PropertyName>ms:teryt</ogc:PropertyName>',
  `<ogc:Literal>${SOURCE_TERYT}</ogc:Literal>`,
  '</ogc:PropertyIsEqualTo>',
  '</ogc:Filter>',
].join('');

const url = new URL(WFS);
url.searchParams.set('SERVICE', 'WFS');
url.searchParams.set('VERSION', '1.1.0');
url.searchParams.set('REQUEST', 'GetFeature');
url.searchParams.set('TYPENAME', 'ms:prg-adresy');
url.searchParams.set('SRSNAME', 'EPSG:2180');
url.searchParams.set('MAXFEATURES', '10000');
url.searchParams.set('FILTER', ogcFilter);

const response = await fetch(url, {
  redirect: 'follow',
  signal: AbortSignal.timeout(45_000),
  headers: {
    'user-agent': 'WastePL/0.1 (+https://wastepl.pl)',
    accept: 'application/gml+xml,text/xml,application/xml',
  },
});
if (!response.ok) throw new Error(`GUGiK WFS HTTP ${response.status}`);

const xml = await response.text();
await mkdir('test-results', { recursive: true });
await writeFile(RAW_PATH, xml, 'utf8');
if (/ExceptionReport|ServiceException/i.test(xml)) {
  throw new Error(`GUGiK WFS exception: ${xml.slice(0, 1000)}`);
}

const addresses = parseMembers(xml).sort((a, b) =>
  a.locality.localeCompare(b.locality, 'pl')
  || a.buildingNumber.localeCompare(b.buildingNumber, 'pl', { numeric: true }),
);
if (addresses.length < 1) throw new Error(`No official PRG addresses returned for source TERYT ${SOURCE_TERYT}`);
if (addresses.length >= 10000) throw new Error('PRG result reached MAXFEATURES=10000; snapshot may be truncated');

const ids = new Set(addresses.map((address) => address.prgId));
if (ids.size !== addresses.length) throw new Error('Duplicate PRG feature ids in Będzino snapshot');
if (addresses.some((address) => !/^prg-adresy\.\d+$/.test(address.prgId))) {
  throw new Error('Unexpected PRG feature id shape');
}

const localityMap = new Map();
for (const address of addresses) {
  const key = `${address.simc}\u0000${address.locality}`;
  const current = localityMap.get(key) ?? { locality: address.locality, simc: address.simc, count: 0 };
  current.count += 1;
  localityMap.set(key, current);
}
const localities = [...localityMap.values()].sort((a, b) =>
  a.locality.localeCompare(b.locality, 'pl') || a.simc.localeCompare(b.simc),
);

const report = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  source: {
    provider: 'Główny Urząd Geodezji i Kartografii (GUGiK)',
    dataset: 'Państwowy Rejestr Granic — Krajowa Integracja Numeracji Adresowej',
    wfsUrl: WFS,
    wfsLayer: 'ms:prg-adresy',
    query: 'OGC_FILTER_TERYT_EQUALS',
    queryTeryt: SOURCE_TERYT,
    responseSha256: createHash('sha256').update(xml, 'utf8').digest('hex'),
  },
  municipality: {
    terc: MUNICIPALITY_TERC,
    sourceTeryt: SOURCE_TERYT,
  },
  summary: {
    addresses: addresses.length,
    localities: localities.length,
  },
  localities,
  addresses,
};

await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  summary: report.summary,
  responseSha256: report.source.responseSha256,
  localities,
}, null, 2));
console.log(`Report: ${REPORT_PATH}`);
