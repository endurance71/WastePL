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

const [schema, historical, wave2, wave3, wave4, wave5, wave6, wave7] = await Promise.all([
  readJson('../schemas/source-manifest-v0.1.schema.json'),
  readJson('../manifests/pilot-koszalin-region-2026.1.json'),
  readJson('../manifests/pilot-koszalin-region-2026.2.json'),
  readJson('../manifests/pilot-koszalin-region-2026.3.json'),
  readJson('../manifests/pilot-koszalin-region-2026.4.json'),
  readJson('../manifests/pilot-koszalin-region-2026.5.json'),
  readJson('../manifests/pilot-koszalin-region-2026.6.json'),
  readJson('../manifests/pilot-koszalin-region-2026.7.json'),
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
  ['pilot source manifest 2026.5', wave5],
  ['pilot source manifest 2026.6', wave6],
  ['pilot source manifest 2026.7', wave7],
]) assertValid(value, label);

if (historical.manifestId !== 'pilot-koszalin-region' || historical.version !== '2026.1') {
  throw new Error('Historical pilot manifest identity must remain pilot-koszalin-region@2026.1');
}
for (const [manifest, version] of [
  [wave2, '2026.2'],
  [wave3, '2026.3'],
  [wave4, '2026.4'],
  [wave5, '2026.5'],
  [wave6, '2026.6'],
  [wave7, '2026.7'],
]) {
  if (manifest.manifestId !== historical.manifestId || manifest.version !== version) {
    throw new Error(`Manifest must remain pilot-koszalin-region@${version}`);
  }
}

function municipalities(manifest) {
  return new Map(manifest.municipalities.map((item) => [item.terc, item]));
}
function sources(manifest) {
  return new Map(manifest.municipalities.flatMap((municipality) =>
    municipality.sources.map((source) => [source.key, { ...source, terc: municipality.terc }]),
  ));
}

const manifestMaps = [
  ['2026.1', municipalities(historical)],
  ['2026.2', municipalities(wave2)],
  ['2026.3', municipalities(wave3)],
  ['2026.4', municipalities(wave4)],
  ['2026.5', municipalities(wave5)],
  ['2026.6', municipalities(wave6)],
  ['2026.7', municipalities(wave7)],
];
for (const [label, map] of manifestMaps) {
  if (map.size !== 8) throw new Error(`${label} must contain exactly 8 municipalities`);
}
const tercSet = [...manifestMaps[0][1].keys()].sort().join('|');
for (const [label, map] of manifestMaps.slice(1)) {
  if ([...map.keys()].sort().join('|') !== tercSet) {
    throw new Error(`${label} must preserve the 8-municipality TERC set`);
  }
}

const s1 = sources(historical);
const s2 = sources(wave2);
const s3 = sources(wave3);
const s4 = sources(wave4);
const s5 = sources(wave5);
const s6 = sources(wave6);
const s7 = sources(wave7);
for (const key of s1.keys()) if (!s2.has(key)) throw new Error(`2026.2 lost historical source ${key}`);
for (const key of s2.keys()) if (!s3.has(key)) throw new Error(`2026.3 lost wave-2 source ${key}`);
for (const key of s3.keys()) if (!s4.has(key)) throw new Error(`2026.4 lost wave-3 source ${key}`);
for (const key of s4.keys()) if (!s5.has(key)) throw new Error(`2026.5 lost wave-4 source ${key}`);
for (const key of s5.keys()) if (!s6.has(key)) throw new Error(`2026.6 lost wave-5 source ${key}`);
for (const key of s6.keys()) if (!s7.has(key)) throw new Error(`2026.7 lost wave-6 source ${key}`);

const wave3NewKeys = [...s3.keys()].filter((key) => !s2.has(key)).sort();
if (JSON.stringify(wave3NewKeys) !== JSON.stringify([
  'tychowo-collection-difficult-2026',
  'tychowo-collection-standard-2026',
])) {
  throw new Error(`2026.3 may add only exact Tychowo child identities; got ${wave3NewKeys.join(', ')}`);
}
const wave4NewKeys = [...s4.keys()].filter((key) => !s3.has(key)).sort();
if (JSON.stringify(wave4NewKeys) !== JSON.stringify(['sianow-pszok'])) {
  throw new Error(`2026.4 may add only sianow-pszok; got ${wave4NewKeys.join(', ')}`);
}
const wave5NewKeys = [...s5.keys()].filter((key) => !s4.has(key)).sort();
if (JSON.stringify(wave5NewKeys) !== JSON.stringify(['tychowo-pszok'])) {
  throw new Error(`2026.5 may add only tychowo-pszok; got ${wave5NewKeys.join(', ')}`);
}
const wave6NewKeys = [...s6.keys()].filter((key) => !s5.has(key)).sort();
if (JSON.stringify(wave6NewKeys) !== JSON.stringify(['polanow-collection-garbno-h2-2026'])) {
  throw new Error(`2026.6 may add only polanow-collection-garbno-h2-2026; got ${wave6NewKeys.join(', ')}`);
}
const wave7NewKeys = [...s7.keys()].filter((key) => !s6.has(key)).sort();
if (JSON.stringify(wave7NewKeys) !== JSON.stringify(['bedzino-collection-trasa-1-safe-h2-2026'])) {
  throw new Error(`2026.7 may add only bedzino-collection-trasa-1-safe-h2-2026; got ${wave7NewKeys.join(', ')}`);
}

const supportedParsers = new Map([
  ['pgk-koszalin-pdf-text', 'PDF_TEXT'],
  ['municipal-collection-pdf-text', 'PDF_TEXT'],
  ['pgk-koszalin-pszok-html', 'HTML'],
  ['municipal-pszok-html', 'HTML'],
]);

for (const source of s7.values()) {
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

function activeKeys(sourceMap) {
  return new Set([...sourceMap.values()].filter((source) => source.status === 'ACTIVE').map((source) => source.key));
}
const active2 = activeKeys(s2);
const active3 = activeKeys(s3);
const active4 = activeKeys(s4);
const active5 = activeKeys(s5);
const active6 = activeKeys(s6);
const active7 = activeKeys(s7);
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
const newlyActive5 = [...active5].filter((key) => !active4.has(key)).sort();
if (JSON.stringify(newlyActive5) !== JSON.stringify(['tychowo-pszok'])) {
  throw new Error(`2026.5 may activate only Tychowo PSZOK; got ${newlyActive5.join(', ')}`);
}
if (active5.size !== 9) throw new Error(`2026.5 must contain exactly 9 ACTIVE source identities, got ${active5.size}`);
const newlyActive6 = [...active6].filter((key) => !active5.has(key)).sort();
if (JSON.stringify(newlyActive6) !== JSON.stringify(['polanow-collection-garbno-h2-2026'])) {
  throw new Error(`2026.6 may activate only Polanów Garbno H2; got ${newlyActive6.join(', ')}`);
}
if (active6.size !== 10) throw new Error(`2026.6 must contain exactly 10 ACTIVE source identities, got ${active6.size}`);
const newlyActive7 = [...active7].filter((key) => !active6.has(key)).sort();
if (JSON.stringify(newlyActive7) !== JSON.stringify(['bedzino-collection-trasa-1-safe-h2-2026'])) {
  throw new Error(`2026.7 may activate only Będzino Trasa I safe H2; got ${newlyActive7.join(', ')}`);
}
if (active7.size !== 11) throw new Error(`2026.7 must contain exactly 11 ACTIVE source identities, got ${active7.size}`);

const sianowCollection = s7.get('sianow-collection-2026-h2');
const sianowPszok = s7.get('sianow-pszok');
if (!sianowCollection || sianowCollection.status !== 'PLANNED' || sianowCollection.assessment?.activationBlocker !== 'GENERIC_SEGREGATED_COLUMN_NOT_CANONICALLY_MAPPED') {
  throw new Error('Sianów collection must remain PLANNED with its existing fraction-semantics blocker');
}
if (!sianowPszok || sianowPszok.status !== 'ACTIVE' || sianowPszok.terc !== '3209073' || sianowPszok.parserKey !== 'municipal-pszok-html') {
  throw new Error('Sianów PSZOK must remain ACTIVE in 2026.7');
}

const tychowoParent = s7.get('tychowo-collection-2026');
const tychowoStandard = s7.get('tychowo-collection-standard-2026');
const tychowoDifficult = s7.get('tychowo-collection-difficult-2026');
const tychowoPszok = s7.get('tychowo-pszok');
const expectedTychowoChildren = [
  'https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2151/pliki/zmiana2harmonogram_tychowo_2026.pdf',
  'https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2151/pliki/zmianakopia_harmonogram_tychowo_2026_%E2%80%94_kolonijne.pdf',
];
if (!tychowoParent || tychowoParent.url !== 'https://tychowo.pl/cms/2151/harmonogram-odbioru-odpadow-komunalnych-') {
  throw new Error('2026.7 must preserve the current Tychowo CMS discovery parent');
}
if (JSON.stringify(tychowoParent.assessment?.childArtifactUrls) !== JSON.stringify(expectedTychowoChildren)) {
  throw new Error('Tychowo discovery source must preserve the two exact revised child PDFs');
}
if (!tychowoStandard || tychowoStandard.status !== 'ACTIVE' || tychowoStandard.url !== expectedTychowoChildren[0] || tychowoStandard.parserKey !== 'municipal-collection-pdf-text') {
  throw new Error('Tychowo standard collection child must remain ACTIVE');
}
if (!tychowoDifficult || tychowoDifficult.status !== 'PLANNED' || tychowoDifficult.url !== expectedTychowoChildren[1] || tychowoDifficult.assessment?.activationBlocker !== 'EXPLICIT_ADDRESS_REFERENCE_GATE_NOT_YET_COMPLETE') {
  throw new Error('Tychowo difficult collection child must remain explicitly blocked');
}
if (
  !tychowoPszok ||
  tychowoPszok.status !== 'ACTIVE' ||
  tychowoPszok.terc !== '3201043' ||
  tychowoPszok.url !== 'https://bip.tychowo.pl/artykul/646/9305/oplata-za-gospodarowanie-odpadami-komunalnymi' ||
  tychowoPszok.parserKey !== 'municipal-pszok-html' ||
  tychowoPszok.assessment?.shape !== 'DIRECT_CONTENT' ||
  tychowoPszok.assessment?.evidenceStatus !== 'VERIFIED' ||
  tychowoPszok.assessment?.activationBlocker !== null
) {
  throw new Error('Tychowo PSZOK must remain verified and ACTIVE in 2026.7');
}

const bedzino = s7.get('bedzino-collection-2026-h2');
if (!bedzino || bedzino.status !== 'PLANNED') throw new Error('Będzino H2 must remain PLANNED');
if (bedzino.assessment?.evidenceStatus !== 'VERIFIED' || bedzino.assessment?.childArtifactUrls?.length !== 14) {
  throw new Error('Będzino H2 must preserve all 14 exact current BIP attachments as evidence');
}
if (bedzino.assessment.activationBlocker !== 'H2_ROUTE_I_II_OSLONY_AND_DIFFICULT_COVERAGE_NOT_YET_ADDRESS_DETERMINISTIC') {
  throw new Error('Będzino H2 must expose the address-deterministic route blocker');
}

const bedzinoTrasa1 = s7.get('bedzino-collection-trasa-1-safe-h2-2026');
const expectedBedzinoTrasa1Url = 'https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-I.pdf';
if (
  !bedzinoTrasa1 ||
  bedzinoTrasa1.status !== 'ACTIVE' ||
  bedzinoTrasa1.terc !== '3209012' ||
  bedzinoTrasa1.url !== expectedBedzinoTrasa1Url ||
  bedzinoTrasa1.format !== 'PDF_TEXT' ||
  bedzinoTrasa1.parserKey !== 'municipal-collection-pdf-text' ||
  bedzinoTrasa1.assessment?.shape !== 'DIRECT_CONTENT' ||
  bedzinoTrasa1.assessment?.evidenceStatus !== 'VERIFIED' ||
  bedzinoTrasa1.assessment?.activationBlocker !== null
) {
  throw new Error('Będzino Trasa I must be the new verified ACTIVE source in 2026.7');
}

const polanowParent = s7.get('polanow-collection-2026');
const polanowGarbno = s7.get('polanow-collection-garbno-h2-2026');
const expectedPolanowParentUrl = 'https://bip.polanow.pl/harmonogram-odbioru-odpadow-komunalnych---ii-polrocze-2026/d/70/2846/';
const expectedPolanowGarbnoUrl = 'https://bip.polanow.pl/pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5';
if (
  !polanowParent ||
  polanowParent.status !== 'PLANNED' ||
  polanowParent.terc !== '3209063' ||
  polanowParent.url !== expectedPolanowParentUrl ||
  polanowParent.parserKey !== null ||
  polanowParent.assessment?.shape !== 'ATTACHMENT_INDEX' ||
  polanowParent.assessment?.evidenceStatus !== 'VERIFIED' ||
  polanowParent.assessment?.activationBlocker !== 'DISCOVERY_ONLY_SAFE_CHILDREN_VERSIONED_AS_DIRECT_SOURCES' ||
  polanowParent.assessment?.childArtifactUrls?.length !== 15
) {
  throw new Error('Polanów H2 parent must remain a verified, discovery-only 15-child index in 2026.7');
}
if (
  !polanowGarbno ||
  polanowGarbno.status !== 'ACTIVE' ||
  polanowGarbno.terc !== '3209063' ||
  polanowGarbno.url !== expectedPolanowGarbnoUrl ||
  polanowGarbno.format !== 'PDF_TEXT' ||
  polanowGarbno.parserKey !== 'municipal-collection-pdf-text' ||
  polanowGarbno.assessment?.shape !== 'DIRECT_CONTENT' ||
  polanowGarbno.assessment?.evidenceStatus !== 'VERIFIED' ||
  polanowGarbno.assessment?.activationBlocker !== null
) {
  throw new Error('Polanów Garbno must remain ACTIVE in 2026.7');
}
if (!polanowParent.assessment.childArtifactUrls.includes(expectedPolanowGarbnoUrl)) {
  throw new Error('Polanów H2 discovery parent must enumerate the activated Garbno child');
}

console.log(
  `WastePL manifest rollout OK: through 2026.7 with ${active7.size} ACTIVE sources; newly active=${newlyActive7.join(', ')}`,
);
