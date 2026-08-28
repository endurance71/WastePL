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

const [schema, previous, rollout] = await Promise.all([
  readJson('../schemas/source-manifest-v0.1.schema.json'),
  readJson('../manifests/pilot-koszalin-region-2026.1.json'),
  readJson('../manifests/pilot-koszalin-region-2026.2.json'),
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

assertValid(previous, 'pilot source manifest 2026.1');
assertValid(rollout, 'pilot source manifest 2026.2');

if (previous.manifestId !== 'pilot-koszalin-region' || previous.version !== '2026.1') {
  throw new Error('Historical pilot manifest identity must remain pilot-koszalin-region@2026.1');
}
if (rollout.manifestId !== previous.manifestId || rollout.version !== '2026.2') {
  throw new Error('Rollout manifest must be pilot-koszalin-region@2026.2');
}

const previousMunicipalities = new Map(previous.municipalities.map((item) => [item.terc, item]));
const rolloutMunicipalities = new Map(rollout.municipalities.map((item) => [item.terc, item]));
if (previousMunicipalities.size !== 8 || rolloutMunicipalities.size !== 8) {
  throw new Error('Both pilot manifests must contain exactly 8 municipalities');
}
if ([...previousMunicipalities.keys()].sort().join('|') !== [...rolloutMunicipalities.keys()].sort().join('|')) {
  throw new Error('Manifest 2026.2 must preserve the pilot municipality TERC set');
}

const previousSources = new Map(
  previous.municipalities.flatMap((municipality) =>
    municipality.sources.map((source) => [source.key, { ...source, terc: municipality.terc }]),
  ),
);
const rolloutSources = new Map(
  rollout.municipalities.flatMap((municipality) =>
    municipality.sources.map((source) => [source.key, { ...source, terc: municipality.terc }]),
  ),
);
if (previousSources.size !== rolloutSources.size) {
  throw new Error('Manifest 2026.2 must not silently add/remove registry identities in this rollout');
}
for (const key of previousSources.keys()) {
  if (!rolloutSources.has(key)) throw new Error(`Manifest 2026.2 lost source identity ${key}`);
}

const supportedParsers = new Map([
  ['pgk-koszalin-pdf-text', 'PDF_TEXT'],
  ['pgk-koszalin-pszok-html', 'HTML'],
  ['municipal-pszok-html', 'HTML'],
]);

for (const source of rolloutSources.values()) {
  if (source.status === 'PLANNED') {
    if (source.parserKey !== null) {
      throw new Error(`PLANNED rollout source ${source.key} must not claim a parser`);
    }
    if (source.assessment && !source.assessment.activationBlocker) {
      throw new Error(`PLANNED assessed source ${source.key} must expose an activation blocker`);
    }
    continue;
  }

  const expectedFormat = supportedParsers.get(source.parserKey);
  if (!expectedFormat) {
    throw new Error(`ACTIVE rollout source ${source.key} references unsupported parser ${source.parserKey}`);
  }
  if (source.format !== expectedFormat) {
    throw new Error(`ACTIVE rollout source ${source.key} format ${source.format} mismatches ${source.parserKey}`);
  }
  if (source.assessment) {
    if (source.assessment.evidenceStatus !== 'VERIFIED') {
      throw new Error(`ACTIVE assessed source ${source.key} must have VERIFIED evidence`);
    }
    if (source.assessment.activationBlocker !== null) {
      throw new Error(`ACTIVE assessed source ${source.key} must not retain an activation blocker`);
    }
  }
}

const previouslyActive = new Set(
  [...previousSources.values()].filter((source) => source.status === 'ACTIVE').map((source) => source.key),
);
const rolloutActive = new Set(
  [...rolloutSources.values()].filter((source) => source.status === 'ACTIVE').map((source) => source.key),
);
const newlyActive = [...rolloutActive].filter((key) => !previouslyActive.has(key)).sort();
const expectedNewlyActive = ['bobolice-pszok', 'swieszyno-pszok'];
if (JSON.stringify(newlyActive) !== JSON.stringify(expectedNewlyActive)) {
  throw new Error(`2026.2 may promote only verified wave-2 sources; got: ${newlyActive.join(', ')}`);
}
if (rolloutActive.size !== previouslyActive.size + 2) {
  throw new Error(`Expected exactly two new ACTIVE source identities, got ${rolloutActive.size - previouslyActive.size}`);
}

const requiredAssessedPlanned = [
  'bobolice-collection-2026',
  'sianow-collection-2026-h2',
  'swieszyno-collection-2026',
  'bedzino-collection-2026-h2',
  'polanow-collection-2026',
  'tychowo-collection-2026',
];
for (const key of requiredAssessedPlanned) {
  const source = rolloutSources.get(key);
  if (!source || source.status !== 'PLANNED') throw new Error(`${key} must remain PLANNED in 2026.2`);
  if (!source.assessment?.activationBlocker) throw new Error(`${key} must have a machine-readable blocker`);
  if (!source.assessment?.notes) throw new Error(`${key} must have assessment notes`);
}

const sianow = rolloutSources.get('sianow-collection-2026-h2');
if (sianow.assessment?.shape !== 'MULTI_ROUTE_PDF_SET' || sianow.assessment.childArtifactUrls.length < 20) {
  throw new Error('Sianów H2 must retain the verified multi-route child artifact inventory');
}
const tychowo = rolloutSources.get('tychowo-collection-2026');
if (tychowo.assessment?.shape !== 'ATTACHMENT_INDEX' || tychowo.assessment.childArtifactUrls.length !== 2) {
  throw new Error('Tychowo 2026 must retain the two exact official child PDF identities');
}

for (const key of expectedNewlyActive) {
  const source = rolloutSources.get(key);
  if (source.parserKey !== 'municipal-pszok-html') {
    throw new Error(`${key} must reach the registered municipal-pszok-html handler`);
  }
  if (source.assessment?.shape !== 'DIRECT_CONTENT' || source.assessment.evidenceStatus !== 'VERIFIED') {
    throw new Error(`${key} must be backed by VERIFIED direct-content evidence`);
  }
}

console.log(
  `WastePL manifest rollout OK: 2026.1 historical + 2026.2 with ${rolloutActive.size} ACTIVE sources (${newlyActive.join(', ')})`,
);
