import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import YAML from 'yaml';

const workerRequire = createRequire(new URL('../apps/worker/package.json', import.meta.url));
const ajvModule = workerRequire('ajv/dist/2020');
const formatsModule = workerRequire('ajv-formats');
const Ajv2020 = ajvModule.default ?? ajvModule;
const addFormats = formatsModule.default ?? formatsModule;

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}

const [
  schemaV01,
  facilitySchemaV02,
  sourceManifestSchemaV01,
  openApi,
  internalOpenApi,
  compatV01,
  pszokV02,
  rvmV02,
  manualV02,
  pilotSourceManifest,
] = await Promise.all([
  readJson('../schemas/wastepl-v0.1.schema.json'),
  readJson('../schemas/wastepl-facility-v0.2.schema.json'),
  readJson('../schemas/source-manifest-v0.1.schema.json'),
  readFile(new URL('../openapi/wastepl-v0.1.yaml', import.meta.url), 'utf8').then(YAML.parse),
  readFile(new URL('../openapi/wastepl-internal-v0.1.yaml', import.meta.url), 'utf8').then(YAML.parse),
  readJson('../schemas/examples/v0.1-compat.json'),
  readJson('../schemas/examples/v0.2/pszok.json'),
  readJson('../schemas/examples/v0.2/deposit-rvm.json'),
  readJson('../schemas/examples/v0.2/deposit-manual.json'),
  readJson('../manifests/pilot-koszalin-region-2026.1.json'),
]);

if (schemaV01.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
  throw new Error('WastePL JSON Schema v0.1 must use draft 2020-12');
}
if (schemaV01.properties?.schemaVersion?.const !== '0.1.0') {
  throw new Error('WastePL JSON Schema v0.1 version must stay 0.1.0');
}
if (facilitySchemaV02.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
  throw new Error('WastePL facility schema v0.2 must use draft 2020-12');
}
if (facilitySchemaV02.properties?.schemaVersion?.const !== '0.2.0') {
  throw new Error('WastePL facility schema version must be 0.2.0');
}
if (sourceManifestSchemaV01.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
  throw new Error('WastePL source manifest schema v0.1 must use draft 2020-12');
}
if (sourceManifestSchemaV01.properties?.schemaVersion?.const !== '0.1.0') {
  throw new Error('WastePL source manifest schema version must stay 0.1.0');
}
if (openApi.openapi !== '3.1.0') {
  throw new Error('WastePL OpenAPI document must use OpenAPI 3.1.0');
}
for (const path of [
  '/v1/health',
  '/v1/addresses/resolve',
  '/v1/collection',
  '/v1/facilities',
  '/v1/notifications/vapid-public-key',
  '/v1/notifications/subscribe',
  '/v1/notifications/unsubscribe',
  '/v1/feedback/schedule-discrepancy',
  '/v1/telemetry/events',
]) {
  if (!openApi.paths?.[path]) {
    throw new Error(`OpenAPI is missing required path: ${path}`);
  }
}

if (internalOpenApi.openapi !== '3.1.0') {
  throw new Error('WastePL internal OpenAPI document must use OpenAPI 3.1.0');
}
if (!internalOpenApi.components?.securitySchemes?.WastePLAdminKey) {
  throw new Error('Internal OpenAPI must require WastePLAdminKey security');
}
for (const [path, operations] of Object.entries(internalOpenApi.paths ?? {})) {
  if (!path.startsWith('/internal/')) {
    throw new Error(`Internal OpenAPI may not expose a public path: ${path}`);
  }
  for (const operation of Object.values(operations ?? {})) {
    if (typeof operation === 'object' && operation && !operation['x-wastepl-internal']) {
      throw new Error(`Internal operation ${path} must declare x-wastepl-internal: true`);
    }
  }
}
for (const path of [
  '/internal/v1/reviews',
  '/internal/v1/reviews/audit',
  '/internal/v1/reviews/{kind}/{id}',
  '/internal/v1/reviews/{kind}/{id}/decision',
  '/internal/v1/source-ops/sources',
  '/internal/v1/source-ops/coverage',
  '/internal/v1/source-ops/summary',
]) {
  if (!internalOpenApi.paths?.[path]) {
    throw new Error(`Internal OpenAPI is missing required path: ${path}`);
  }
}

const latestArtifactProperties = internalOpenApi.components?.schemas?.LatestArtifact?.properties ?? {};
for (const forbidden of ['storageUri', 'storage_uri', 'bucket', 'credentials']) {
  if (forbidden in latestArtifactProperties) {
    throw new Error(`Internal LatestArtifact must not expose sensitive field ${forbidden}`);
  }
}
const latestProcessingProperties = internalOpenApi.components?.schemas?.LatestProcessing?.properties ?? {};
for (const forbidden of ['errorMessage', 'error_message', 'rawError', 'stack']) {
  if (forbidden in latestProcessingProperties) {
    throw new Error(`Internal LatestProcessing must not expose raw diagnostic field ${forbidden}`);
  }
}
const sourceOpsItemProperties = internalOpenApi.components?.schemas?.SourceOpsItem?.properties ?? {};
if (!sourceOpsItemProperties.latestArtifact || !sourceOpsItemProperties.latestProcessing) {
  throw new Error('SourceOpsItem must expose safe latest artifact and processing provenance');
}

const facilityItemProperties = openApi.components?.schemas?.FacilityItem?.properties ?? {};
if ('openNow' in facilityItemProperties) {
  throw new Error('Facilities API must not expose openNow before timezone/exception semantics are proven');
}
const provenanceRequired = openApi.components?.schemas?.FacilityItem?.properties?.provenance?.required ?? [];
for (const claim of ['primary', 'location', 'openingHours', 'access', 'operationalStatus', 'assertions']) {
  if (!provenanceRequired.includes(claim)) {
    throw new Error(`Facility provenance must explicitly include ${claim}`);
  }
}
const assertionSchema = openApi.components?.schemas?.FacilityAssertionFreshnessRef;
if (!assertionSchema) {
  throw new Error('Facilities API must document source assertion freshness');
}
for (const field of ['staticFreshnessState', 'operationalStatusStale', 'externalIds']) {
  if (!assertionSchema.required?.includes(field)) {
    throw new Error(`FacilityAssertionFreshnessRef must require ${field}`);
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validateV01 = ajv.compile(schemaV01);
const validateFacilityV02 = ajv.compile(facilitySchemaV02);
const validateSourceManifestV01 = ajv.compile(sourceManifestSchemaV01);

function assertValid(validate, value, label) {
  if (validate(value)) return;
  const details = (validate.errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ');
  throw new Error(`${label} must validate: ${details}`);
}

function assertInvalid(validate, value, label) {
  if (!validate(value)) return;
  throw new Error(`${label} must be rejected by the schema`);
}

function findDuplicate(values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function assertPilotManifestSemantics(manifest) {
  if (manifest.manifestId !== 'pilot-koszalin-region' || manifest.version !== '2026.1') {
    throw new Error('Pilot source manifest identity must stay pilot-koszalin-region@2026.1');
  }
  if (manifest.municipalities.length !== 8) {
    throw new Error(`Pilot source manifest must contain exactly 8 municipalities, got ${manifest.municipalities.length}`);
  }

  const expectedTercs = [
    '3201043',
    '3209012',
    '3209033',
    '3209042',
    '3209063',
    '3209073',
    '3209082',
    '3261011',
  ];
  const actualTercs = manifest.municipalities.map((entry) => entry.terc).sort();
  if (JSON.stringify(actualTercs) !== JSON.stringify(expectedTercs)) {
    throw new Error(`Pilot source manifest TERC set changed unexpectedly: ${actualTercs.join(', ')}`);
  }

  const sources = manifest.municipalities.flatMap((municipality) => municipality.sources);
  const duplicateKey = findDuplicate(sources.map((source) => source.key));
  if (duplicateKey) throw new Error(`Duplicate source key in pilot manifest: ${duplicateKey}`);
  const duplicateUrl = findDuplicate(sources.map((source) => source.url));
  if (duplicateUrl) throw new Error(`Duplicate source URL in pilot manifest: ${duplicateUrl}`);

  const supportedParsers = new Map([
    ['pgk-koszalin-pdf-text', 'PDF_TEXT'],
    ['pgk-koszalin-pszok-html', 'HTML'],
  ]);
  for (const source of sources) {
    if (source.activeFrom && source.activeTo && source.activeFrom > source.activeTo) {
      throw new Error(`Pilot source ${source.key} has activeFrom after activeTo`);
    }
    if (source.status === 'PLANNED') {
      if (source.parserKey !== null) {
        throw new Error(`PLANNED pilot source ${source.key} must not claim a parser`);
      }
      continue;
    }
    const supportedFormat = supportedParsers.get(source.parserKey);
    if (!supportedFormat) {
      throw new Error(`ACTIVE pilot source ${source.key} references unsupported parser ${source.parserKey}`);
    }
    if (supportedFormat !== source.format) {
      throw new Error(`ACTIVE pilot source ${source.key} format does not match parser ${source.parserKey}`);
    }
  }
}

assertValid(validateV01, compatV01, 'v0.1 compatibility fixture');
assertValid(validateFacilityV02, pszokV02, 'v0.2 PSZOK fixture');
assertValid(validateFacilityV02, rvmV02, 'v0.2 RVM fixture');
assertValid(validateFacilityV02, manualV02, 'v0.2 manual-return fixture');
assertValid(validateSourceManifestV01, pilotSourceManifest, 'pilot source manifest v0.1');
assertPilotManifestSemantics(pilotSourceManifest);

const operationalWithoutProvenance = structuredClone(rvmV02);
operationalWithoutProvenance.operationalStatus.observedAt = null;
operationalWithoutProvenance.operationalStatus.sourceKey = null;
assertInvalid(validateFacilityV02, operationalWithoutProvenance, 'OPERATIONAL facility without observation/source provenance');

const rvmWithoutContainers = structuredClone(rvmV02);
rvmWithoutContainers.acceptedContainers = [];
assertInvalid(validateFacilityV02, rvmWithoutContainers, 'RVM without accepted container classes');

const pszokWithDepositContainer = structuredClone(pszokV02);
pszokWithDepositContainer.acceptedContainers = ['PET_BOTTLE'];
assertInvalid(validateFacilityV02, pszokWithDepositContainer, 'PSZOK with deposit container capability');

const coordinatesWithoutSource = structuredClone(rvmV02);
coordinatesWithoutSource.locationSourceKey = null;
assertInvalid(validateFacilityV02, coordinatesWithoutSource, 'facility coordinates without explicit source provenance');

const quantityLimitWithoutSource = structuredClone(pszokV02);
quantityLimitWithoutSource.access.quantityLimits = [
  { material: 'TYRES', limit: '8 sztuk', period: 'YEAR' },
];
assertInvalid(validateFacilityV02, quantityLimitWithoutSource, 'facility quantity limit without claim provenance');

const rvmWithIsWorking = structuredClone(rvmV02);
rvmWithIsWorking.isWorking = true;
assertInvalid(validateFacilityV02, rvmWithIsWorking, 'unproven isWorking boolean');

console.log('WastePL contracts OK (public/internal APIs + source-ops safety + dataset/facility schemas + 8-municipality source manifest)');
