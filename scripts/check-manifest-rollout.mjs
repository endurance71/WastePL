import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const workerRequire = createRequire(new URL('../apps/worker/package.json', import.meta.url));
const ajvModule = workerRequire('ajv/dist/2020');
const formatsModule = workerRequire('ajv-formats');
const Ajv2020 = ajvModule.default ?? ajvModule;
const addFormats = formatsModule.default ?? formatsModule;

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}

const [schema, historical, wave2, wave3, wave4] = await Promise.all([
  readJson('../schemas/source-manifest-v0.1.schema.json'),
  readJson('../manifests/pilot-koszalin-region-2026.1.json'),
  readJson('../manifests/pilot-koszalin-region-2026.2.json'),
  readJson('../manifests/pilot-koszalin-region-2026.3.json'),
  readJson('../manifests/pilot-koszalin-region-2026.4.json'),
]);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function assertValid(value, label) {
  if (validate(value)) return;
  const details = (validate.errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ');
  throw new Error(`${label} must validate: ${details}`);
}

for (const [label, value] of [
  ['pilot source manifest 2026.1', historical],
  ['pilot source manifest 2026.2', wave2],
  ['pilot source manifest 2026.3', wave3],
  ['pilot source manifest 2026.4', wave4],
]) assertValid(value, label);

if (historical.manifestId !== 'pilot-koszalin-region' || historical.version !== '2026.1') {
  throw new Error('Historical pilot manifest identity must remain pilot-koszalin-region@2026.1');
}
if (wave2.manifestId !== historical.manifestId || wave2.version !== '2026.2') {
  throw new Error('Wave-2 manifest must remain pilot-koszalin-region@2026.2');
}
if (wave3.manifestId !== historical.manifestId || wave3.version !== '2026.3') {
  throw new Error('Wave-3 manifest must be pilot-koszalin-region@2026.3');
}
if (wave4.manifestId !== historical.manifestId || wave4.version !== '2026.4') {
  throw new Error('Wave-4 manifest must be pilot-koszalin-region@2026.4');
}

function municipalities(manifest) {
  return new Map(manifest.municipalities.map((item) => [item.terc, item]));
}
function sources(manifest) {
  return new Map(manifest.municipalities.flatMap((municipality) =>
    municipality.sources.map((source) => [source.key, { ...source, terc: municipality.terc }]),
  ));
}

const m1 = municipalities(historical);
const m2 = municipalities(wave2);
const m3 = municipalities(wave3);
const m4 = municipalities(wave4);
for (const [label, map] of [['2026.1', m1], ['2026.2', m2], ['2026.3', m3], ['2026.4', m4]]) {
  if (map.size !== 8) throw new Error(`${label} must contain exactly 8 municipalities`);
}
const tercSet = [...m1.keys()].sort().join('|');
for (const [label, map] of [['2026.2', m2], ['2026.3', m3], ['2026.4', m4]]) {
  if ([...map.keys()].sort().join('|') !== tercSet) {
    throw new Error(`${label} must preserve the 8-municipality TERC set`);
  }
}

const s1 = sources(historical);
const s2 = sources(wave2);
const s3 = sources(wave3);
const s4 = sources(wave4);
for (const key of s1.keys()) if (!s2.has(key)) throw new Error(`2026.2 lost historical source ${key}`);
for (const key of s2.keys()) if (!s3.has(key)) throw new Error(`2026.3 lost wave-2 source ${key}`);
for (const key of s3.keys()) if (!s4.has(key)) throw new Error(`2026.4 lost wave-3 source ${key}`);

const wave3NewKeys = [...s3.keys()].filter((key) => !s2.has(key)).sort();
const expectedWave3NewKeys = [
  'tychowo-collection-difficult-2026',
  'tychowo-collection-standard-2026',
];
if (JSON.stringify(wave3NewKeys) !== JSON.stringify(expectedWave3NewKeys)) {
  throw new Error(`2026.3 may add only exact Tychowo child identities; got ${wave3NewKeys.join(', ')}`);
}

const wave4NewKeys = [...s4.keys()].filter((key) => !s3.has(key)).sort();
if (JSON.stringify(wave4NewKeys) !== JSON.stringify(['sianow-pszok'])) {
  throw new Error(`2026.4 may add only sianow-pszok; got ${wave4NewKeys.join(', ')}`);
}

const supportedParsers = new Map([
  ['pgk-koszalin-pdf-text', 'PDF_TEXT'],
  ['municipal-collection-pdf-text', 'PDF_TEXT'],
  ['pgk-koszalin-pszok-html', 'HTML'],
  ['municipal-pszok-html', 'HTML'],
]);

for (const source of s4.values()) {
  if (source.status === 'PLANNED') {
    if (source.parserKey !== null) throw new Error(`PLANNED source ${source.key} must not claim a parser`);
    if (source.assessment && !source.assessment.activationBlocker) {
      throw new Error(`PLANNED assessed source ${source.key} requires an activation blocker`);
    }
    continue;
  }
  const expectedFormat = supportedParsers.get(source.parserKey);
  if (!expectedFormat) throw new Error(`ACTIVE source ${source.key} uses unsupported parser ${source.parserKey}`);
  if (source.format !== expectedFormat) throw new Error(`ACTIVE source ${source.key} parser/format mismatch`);
  if (source.assessment) {
    if (source.assessment.evidenceStatus !== 'VERIFIED' || source.assessment.activationBlocker !== null) {
      throw new Error(`ACTIVE assessed source ${source.key} must be VERIFIED and unblocked`);
    }
  }
}

const active2 = new Set([...s2.values()].filter((source) => source.status === 'ACTIVE').map((source) => source.key));
const active3 = new Set([...s3.values()].filter((source) => source.status === 'ACTIVE').map((source) => source.key));
const active4 = new Set([...s4.values()].filter((source) => source.status === 'ACTIVE').map((source) => source.key));
const newlyActive3 = [...active3].filter((key) => !active2.has(key)).sort();
if (JSON.stringify(newlyActive3) !== JSON.stringify(['tychowo-collection-standard-2026'])) {
  throw new Error(`2026.3 may activate only safe Tychowo standard child; got ${newlyActive3.join(', ')}`);
}
if (active3.size !== 7) throw new Error(`2026.3 must contain exactly 7 ACTIVE source identities, got ${active3.size}`);
const newlyActive4 = [...active4].filter((key) => !active3.has(key)).sort();
if (JSON.stringify(newlyActive4) !== JSON.stringify(['sianow-pszok'])) {
  throw new Error(`2026.4 may activate only Sianów PSZOK; got ${newlyActive4.join(', ')}`);
}
if (active4.size !== 8) throw new Error(`2026.4 must contain exactly 8 ACTIVE source identities, got ${active4.size}`);

const sianowCollection = s4.get('sianow-collection-2026-h2');
const sianowPszok = s4.get('sianow-pszok');
if (!sianowCollection || sianowCollection.status !== 'PLANNED' || sianowCollection.assessment?.activationBlocker !== 'GENERIC_SEGREGATED_COLUMN_NOT_CANONICALLY_MAPPED') {
  throw new Error('Sianów collection must remain PLANNED with its existing fraction-semantics blocker');
}
if (
  !sianowPszok ||
  sianowPszok.status !== 'ACTIVE' ||
  sianowPszok.terc !== '3209073' ||
  sianowPszok.url !== 'https://sianow.pl/dla-mieszkanca/odpady-komunalne/nieruchomosci-zamieszkale/punkt-selektywnej-zbiorki-odpadow-komunalnych/' ||
  sianowPszok.parserKey !== 'municipal-pszok-html' ||
  sianowPszok.assessment?.shape !== 'DIRECT_CONTENT' ||
  sianowPszok.assessment?.evidenceStatus !== 'VERIFIED' ||
  sianowPszok.assessment?.activationBlocker !== null
) {
  throw new Error('Sianów PSZOK must be the only new verified ACTIVE source in 2026.4');
}

const tychowoParent = s4.get('tychowo-collection-2026');
const tychowoStandard = s4.get('tychowo-collection-standard-2026');
const tychowoDifficult = s4.get('tychowo-collection-difficult-2026');
const expectedTychowoChildren = [
  'https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2151/pliki/zmianaharmonogram_tychowo_20261.pdf',
  'https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2151/pliki/zmianakopia_harmonogram_tychowo_2026_%E2%80%94_kolonijne.pdf',
];
if (!tychowoParent || tychowoParent.url !== 'https://tychowo.pl/cms/2151/harmonogram-odbioru-odpadow-komunalnych-') {
  throw new Error('2026.4 must preserve the current Tychowo CMS discovery parent');
}
if (JSON.stringify(tychowoParent.assessment?.childArtifactUrls) !== JSON.stringify(expectedTychowoChildren)) {
  throw new Error('Tychowo discovery source must preserve the two exact revised child PDFs');
}
if (!tychowoStandard || tychowoStandard.status !== 'ACTIVE' || tychowoStandard.url !== expectedTychowoChildren[0] || tychowoStandard.parserKey !== 'municipal-collection-pdf-text') {
  throw new Error('Tychowo standard child must remain ACTIVE');
}
if (!tychowoDifficult || tychowoDifficult.status !== 'PLANNED' || tychowoDifficult.url !== expectedTychowoChildren[1] || tychowoDifficult.assessment?.activationBlocker !== 'EXPLICIT_ADDRESS_REFERENCE_GATE_NOT_YET_COMPLETE') {
  throw new Error('Tychowo difficult child must remain explicitly blocked');
}

const bedzino = s4.get('bedzino-collection-2026-h2');
if (!bedzino || bedzino.status !== 'PLANNED') throw new Error('Będzino H2 must remain PLANNED');
if (bedzino.assessment?.evidenceStatus !== 'VERIFIED' || bedzino.assessment?.childArtifactUrls?.length !== 14) {
  throw new Error('Będzino H2 must preserve all 14 exact current BIP attachments as evidence');
}
if (bedzino.assessment.activationBlocker !== 'H2_ROUTE_I_II_OSLONY_AND_DIFFICULT_COVERAGE_NOT_YET_ADDRESS_DETERMINISTIC') {
  throw new Error('Będzino H2 must expose the address-deterministic route blocker');
}

console.log(
  `WastePL manifest rollout OK: through 2026.4 with ${active4.size} ACTIVE sources; newly active=${newlyActive4.join(', ')}`,
);