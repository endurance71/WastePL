import { readFile } from 'node:fs/promises';
import type { ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { NormalizedDataset } from '../adapters/pdf-text/types.js';

let validatorPromise: Promise<ValidateFunction> | null = null;

async function loadValidator(): Promise<ValidateFunction> {
  if (!validatorPromise) {
    validatorPromise = (async () => {
      const schemaUrl = new URL('../../../../schemas/wastepl-v0.1.schema.json', import.meta.url);
      const schema = JSON.parse(await readFile(schemaUrl, 'utf8')) as object;
      const ajv = new Ajv2020({ allErrors: true, strict: false });
      addFormats(ajv);
      return ajv.compile(schema);
    })();
  }
  return validatorPromise;
}

export async function validateWastePlDataset(dataset: NormalizedDataset): Promise<void> {
  const validate = await loadValidator();
  if (validate(dataset)) return;
  const details = (validate.errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ');
  throw new Error(`WastePL JSON Schema validation failed: ${details}`);
}
