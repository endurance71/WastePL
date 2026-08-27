import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { ValidateFunction } from 'ajv';
import type { NormalizedDataset } from '../adapters/pdf-text/types.js';

interface AjvLike {
  compile(schema: object): ValidateFunction;
}

type AjvConstructor = new (options?: Record<string, unknown>) => AjvLike;
type AddFormats = (ajv: AjvLike) => unknown;

const require = createRequire(import.meta.url);
const ajvModule = require('ajv/dist/2020');
const formatsModule = require('ajv-formats');
const Ajv2020 = (ajvModule.default ?? ajvModule) as AjvConstructor;
const addFormats = (formatsModule.default ?? formatsModule) as AddFormats;

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
