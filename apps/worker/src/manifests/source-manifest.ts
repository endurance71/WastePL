import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import manifestSchema from '../../../../schemas/source-manifest-v0.1.schema.json' with { type: 'json' };

export type ManifestDataType = 'COLLECTION_SCHEDULE' | 'PSZOK' | 'ALERTS' | 'OTHER';
export type ManifestSourceStatus = 'ACTIVE' | 'PLANNED';
export type ManifestSourceFormat = 'PDF_TEXT' | 'HTML' | 'PDF' | 'JSON' | 'CSV' | 'XLSX' | 'GML' | 'OTHER';

export interface SourceManifestSource {
  key: string;
  dataType: ManifestDataType;
  url: string;
  format: ManifestSourceFormat;
  status: ManifestSourceStatus;
  parserKey: string | null;
  pollIntervalMinutes: number;
  ownerType: 'MUNICIPALITY' | 'MUNICIPAL_COMPANY' | 'BIP' | 'OTHER_OFFICIAL';
  ownerName: string;
  reuseNotes: string;
  activeFrom: string | null;
  activeTo: string | null;
}

export interface SourceManifestMunicipality {
  terc: string;
  name: string;
  sources: SourceManifestSource[];
}

export interface SourceManifest {
  schemaVersion: '0.1.0';
  manifestId: string;
  version: string;
  generatedAt: string;
  municipalities: SourceManifestMunicipality[];
}

const SUPPORTED_PARSERS = new Map<string, ManifestSourceFormat>([
  ['pgk-koszalin-pdf-text', 'PDF_TEXT'],
  ['pgk-koszalin-pszok-html', 'HTML'],
]);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(manifestSchema);

function duplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function assertDateRange(source: SourceManifestSource): void {
  if (!source.activeFrom || !source.activeTo) return;
  if (source.activeFrom > source.activeTo) {
    throw new Error(`Manifest source ${source.key} has activeFrom after activeTo`);
  }
}

export function validateSourceManifest(value: unknown): asserts value is SourceManifest {
  if (!validateSchema(value)) {
    const details = (validateSchema.errors ?? [])
      .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
      .join('; ');
    throw new Error(`Invalid source manifest schema: ${details}`);
  }

  const manifest = value as SourceManifest;
  const duplicateTerc = duplicate(manifest.municipalities.map((municipality) => municipality.terc));
  if (duplicateTerc) throw new Error(`Duplicate municipality TERC in manifest: ${duplicateTerc}`);

  const sources = manifest.municipalities.flatMap((municipality) => municipality.sources);
  const duplicateKey = duplicate(sources.map((source) => source.key));
  if (duplicateKey) throw new Error(`Duplicate source key in manifest: ${duplicateKey}`);
  const duplicateUrl = duplicate(sources.map((source) => source.url));
  if (duplicateUrl) throw new Error(`Duplicate source URL in manifest: ${duplicateUrl}`);

  for (const source of sources) {
    assertDateRange(source);
    if (source.status === 'PLANNED') {
      if (source.parserKey !== null) {
        throw new Error(`PLANNED source ${source.key} must not claim a parser key`);
      }
      continue;
    }

    if (!source.parserKey) {
      throw new Error(`ACTIVE source ${source.key} requires a parser key`);
    }
    const supportedFormat = SUPPORTED_PARSERS.get(source.parserKey);
    if (!supportedFormat) {
      throw new Error(`ACTIVE source ${source.key} references unsupported parser ${source.parserKey}`);
    }
    if (supportedFormat !== source.format) {
      throw new Error(
        `ACTIVE source ${source.key} format ${source.format} does not match parser ${source.parserKey} format ${supportedFormat}`,
      );
    }
  }
}

export function parseSourceManifest(value: unknown): SourceManifest {
  validateSourceManifest(value);
  return value;
}

export function isManifestSourceActiveOn(source: SourceManifestSource, asOf: Date): boolean {
  if (source.status !== 'ACTIVE') return false;
  const day = asOf.toISOString().slice(0, 10);
  if (source.activeFrom && day < source.activeFrom) return false;
  if (source.activeTo && day > source.activeTo) return false;
  return true;
}
