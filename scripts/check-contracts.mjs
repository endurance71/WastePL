import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

const schemaText = await readFile(new URL('../schemas/wastepl-v0.1.schema.json', import.meta.url), 'utf8');
const openApiText = await readFile(new URL('../openapi/wastepl-v0.1.yaml', import.meta.url), 'utf8');

const schema = JSON.parse(schemaText);
const openApi = YAML.parse(openApiText);

if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
  throw new Error('WastePL JSON Schema must use draft 2020-12');
}

if (schema.properties?.schemaVersion?.const !== '0.1.0') {
  throw new Error('WastePL JSON Schema version must be 0.1.0');
}

if (openApi.openapi !== '3.1.0') {
  throw new Error('WastePL OpenAPI document must use OpenAPI 3.1.0');
}

for (const path of ['/v1/health', '/v1/addresses/resolve', '/v1/collection']) {
  if (!openApi.paths?.[path]) {
    throw new Error(`OpenAPI is missing required path: ${path}`);
  }
}

console.log('WastePL contracts OK');
