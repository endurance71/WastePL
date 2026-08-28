import { createRequire } from 'node:module';
import manifestSchema from '../../../../schemas/source-manifest-v0.1.schema.json' with { type: 'json' };

export type ManifestDataType = 'COLLECTION_SCHEDULE' | 'PSZOK' | 'ALERTS' | 'OTHER';
export type ManifestSourceStatus = 'ACTIVE' | 'PLANNED';
export type ManifestSourceFormat = 'PDF_TEXT' | 'HTML' | 'PDF' | 'JSON' | 'CSV' | 'XLSX' | 'GML' | 'OTHER';
export type ManifestSourceShape =
  | 'DIRECT_CONTENT'
  | 'ATTACHMENT_INDEX'
  | 'MULTI_ROUTE_PDF_SET'
  | 'IMAGE_ONLY_OR_OCR_REQUIRED'
  | 'MIXED_MEDIA'
  | 'UNSUPPORTED_OR_AMBIGUOUS';
export type ManifestEvidenceStatus = 'VERIFIED' | 'PARTIAL' | 'MISSING';

export interface SourceManifestBundle {
  key: string;
  role: string;
  requiredRoles: string[];
  freshnessMinutes: number;
}

export interface SourceManifestAssessment {
  shape: ManifestSourceShape;
  evidenceStatus: ManifestEvidenceStatus;
  activationBlocker: string | null;
  assessedAt: string;
  childArtifactUrls: string[];
  notes: string;
}

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
  bundle?: SourceManifestBundle | null;
  assessment?: SourceManifestAssessment | null;
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

const require = createRequire(import.meta.url);
const ajvModule = require('ajv/dist/2020');
const formatsModule = require('ajv-formats');
const Ajv2020 = ajvModule.default ?? ajvModule;
const addFormats = formatsModule.default ?? formatsModule;
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

function assertAssessmentSemantics(source: SourceManifestSource): void {
  const assessment = source.assessment ?? null;
  if (!assessment) return;

  const duplicateChildUrl = duplicate(assessment.childArtifactUrls);
  if (duplicateChildUrl) {
    throw new Error(`Manifest source ${source.key} has duplicate child artifact URL ${duplicateChildUrl}`);
  }

  if (source.status === 'PLANNED' && !assessment.activationBlocker) {
    throw new Error(`PLANNED source ${source.key} assessment requires activationBlocker`);
  }
  if (source.status === 'ACTIVE') {
    if (assessment.activationBlocker !== null) {
      throw new Error(`ACTIVE source ${source.key} assessment must not contain activationBlocker`);
    }
    if (assessment.evidenceStatus !== 'VERIFIED') {
      throw new Error(`ACTIVE source ${source.key} assessment requires VERIFIED evidence`);
    }
  }

  if (
    ['ATTACHMENT_INDEX', 'MULTI_ROUTE_PDF_SET', 'MIXED_MEDIA'].includes(assessment.shape)
    && assessment.evidenceStatus === 'VERIFIED'
    && assessment.childArtifactUrls.length === 0
  ) {
    throw new Error(`Manifest source ${source.key} verified ${assessment.shape} assessment requires childArtifactUrls`);
  }
}

function assertBundleSemantics(manifest: SourceManifest): void {
  for (const municipality of manifest.municipalities) {
    const groups = new Map<string, SourceManifestSource[]>();
    for (const source of municipality.sources) {
      if (!source.bundle) continue;
      const list = groups.get(source.bundle.key) ?? [];
      list.push(source);
      groups.set(source.bundle.key, list);
    }

    for (const [bundleKey, members] of groups) {
      const first = members[0]!.bundle!;
      const requiredRoles = [...first.requiredRoles].sort();
      if (new Set(requiredRoles).size !== requiredRoles.length || requiredRoles.length < 2) {
        throw new Error(`Manifest bundle ${bundleKey} must define at least two unique requiredRoles`);
      }

      const duplicateRole = duplicate(members.map((member) => member.bundle!.role));
      if (duplicateRole) {
        throw new Error(`Manifest bundle ${bundleKey} has duplicate role ${duplicateRole}`);
      }

      for (const member of members) {
        const bundle = member.bundle!;
        if (bundle.freshnessMinutes !== first.freshnessMinutes) {
          throw new Error(`Manifest bundle ${bundleKey} has inconsistent freshnessMinutes`);
        }
        if ([...bundle.requiredRoles].sort().join('|') !== requiredRoles.join('|')) {
          throw new Error(`Manifest bundle ${bundleKey} has inconsistent requiredRoles`);
        }
        if (!requiredRoles.includes(bundle.role)) {
          throw new Error(`Manifest bundle ${bundleKey} role ${bundle.role} is not required`);
        }
      }

      const presentRoles = new Set(members.map((member) => member.bundle!.role));
      const missingRoles = requiredRoles.filter((role) => !presentRoles.has(role));
      if (missingRoles.length > 0) {
        throw new Error(`Manifest bundle ${bundleKey} is missing source roles: ${missingRoles.join(', ')}`);
      }
    }
  }
}

export function validateSourceManifest(value: unknown): asserts value is SourceManifest {
  if (!validateSchema(value)) {
    const details = (validateSchema.errors ?? [])
      .map((error: { instancePath?: string; message?: string }) =>
        `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
      )
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
    assertAssessmentSemantics(source);
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

  assertBundleSemantics(manifest);
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
