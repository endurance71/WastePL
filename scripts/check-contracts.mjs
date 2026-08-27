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

const [schemaV01, facilitySchemaV02, openApi, compatV01, pszokV02, rvmV02, manualV02] =
  await Promise.all([
    readJson('../schemas/wastepl-v0.1.schema.json'),
    readJson('../schemas/wastepl-facility-v0.2.schema.json'),
    readFile(new URL('../openapi/wastepl-v0.1.yaml', import.meta.url), 'utf8').then(YAML.parse),
    readJson('../schemas/examples/v0.1-compat.json'),
    readJson('../schemas/examples/v0.2/pszok.json'),
    readJson('../schemas/examples/v0.2/deposit-rvm.json'),
    readJson('../schemas/examples/v0.2/deposit-manual.json'),
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
if (openApi.openapi !== '3.1.0') {
  throw new Error('WastePL OpenAPI document must use OpenAPI 3.1.0');
}
for (const path of ['/v1/health', '/v1/addresses/resolve', '/v1/collection']) {
  if (!openApi.paths?.[path]) {
    throw new Error(`OpenAPI is missing required path: ${path}`);
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validateV01 = ajv.compile(schemaV01);
const validateFacilityV02 = ajv.compile(facilitySchemaV02);

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

assertValid(validateV01, compatV01, 'v0.1 compatibility fixture');
assertValid(validateFacilityV02, pszokV02, 'v0.2 PSZOK fixture');
assertValid(validateFacilityV02, rvmV02, 'v0.2 RVM fixture');
assertValid(validateFacilityV02, manualV02, 'v0.2 manual-return fixture');

const operationalWithoutProvenance = structuredClone(rvmV02);
operationalWithoutProvenance.operationalStatus.observedAt = null;
operationalWithoutProvenance.operationalStatus.sourceKey = null;
assertInvalid(
  validateFacilityV02,
  operationalWithoutProvenance,
  'OPERATIONAL facility without observation/source provenance',
);

const rvmWithoutContainers = structuredClone(rvmV02);
rvmWithoutContainers.acceptedContainers = [];
assertInvalid(validateFacilityV02, rvmWithoutContainers, 'RVM without accepted container classes');

const pszokWithDepositContainer = structuredClone(pszokV02);
pszokWithDepositContainer.acceptedContainers = ['PET_BOTTLE'];
assertInvalid(
  validateFacilityV02,
  pszokWithDepositContainer,
  'PSZOK with deposit container capability',
);

const coordinatesWithoutSource = structuredClone(rvmV02);
coordinatesWithoutSource.locationSourceKey = null;
assertInvalid(
  validateFacilityV02,
  coordinatesWithoutSource,
  'facility coordinates without explicit source provenance',
);

console.log('WastePL contracts OK (dataset v0.1 + facility v0.2)');
