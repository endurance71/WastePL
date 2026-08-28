import type { Pool, QueryResultRow } from 'pg';
import {
  PgkKoszalinPszokIngestionOrchestrator,
} from '../adapters/html/pgk-koszalin-pszok-ingestion-orchestrator.js';
import {
  PermanentArtifactParseError,
  type ArtifactProcessorResult,
} from '../ingestion/artifact-processing.js';
import {
  ArtifactReadError,
  type ArtifactReader,
} from '../ingestion/artifact-reader.js';
import type {
  ArtifactHandler,
  ArtifactHandlerInput,
} from '../ingestion/dispatching-artifact-processor.js';
import { PgBundleAwareSourceRegistry } from '../ingestion/bundle-aware-source-registry.js';

interface BundleSourceRow extends QueryResultRow {
  id: string;
  municipality_id: string;
  source_key: string | null;
  source_url: string;
  parser_key: string | null;
  bundle_key: string | null;
  bundle_role: string | null;
  bundle_required_roles: unknown;
  bundle_freshness_minutes: number | null;
}

interface BundleArtifactRow extends QueryResultRow {
  id: string;
  source_id: string;
  sha256: string;
  storage_uri: string;
  retrieved_at: Date;
  status: string;
}

interface BundleMember {
  source: BundleSourceRow;
  artifact: BundleArtifactRow;
  body: Buffer;
}

function requiredRoles(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((role) => typeof role === 'string' && role.length > 0)) {
    throw new PermanentArtifactParseError('Bundle required roles are invalid', {
      code: 'BUNDLE_CONFIGURATION_INVALID',
    });
  }
  const unique = [...new Set(value)];
  if (unique.length !== value.length || unique.length < 2) {
    throw new PermanentArtifactParseError('Bundle required roles must contain at least two unique roles', {
      code: 'BUNDLE_CONFIGURATION_INVALID',
    });
  }
  return unique.sort();
}

function artifactRow(input: ArtifactHandlerInput): BundleArtifactRow {
  return {
    id: input.artifact.id,
    source_id: input.artifact.sourceId,
    sha256: input.artifact.sha256,
    storage_uri: input.artifact.storageUri,
    retrieved_at: input.artifact.retrievedAt,
    status: input.artifact.status,
  };
}

export class PgkKoszalinPszokBundleArtifactHandler implements ArtifactHandler {
  readonly parserKey = 'pgk-koszalin-pszok-html';
  private readonly registry: PgBundleAwareSourceRegistry;
  private readonly orchestrator: PgkKoszalinPszokIngestionOrchestrator;

  constructor(
    private readonly pool: Pool,
    private readonly reader: ArtifactReader,
  ) {
    this.registry = new PgBundleAwareSourceRegistry(pool);
    this.orchestrator = new PgkKoszalinPszokIngestionOrchestrator(pool);
  }

  async process(input: ArtifactHandlerInput): Promise<ArtifactProcessorResult> {
    const currentSource = await this.sourceFor(input.artifact.sourceId);
    if (!currentSource) {
      throw new PermanentArtifactParseError(`Source ${input.artifact.sourceId} not found`, {
        code: 'SOURCE_NOT_FOUND',
      });
    }
    if (!currentSource.source_key || !currentSource.bundle_key || !currentSource.bundle_role) {
      throw new PermanentArtifactParseError('PGK PSZOK source is missing stable bundle metadata', {
        code: 'BUNDLE_CONFIGURATION_INVALID',
      });
    }
    if (!currentSource.bundle_freshness_minutes) {
      throw new PermanentArtifactParseError('PGK PSZOK bundle has no freshness window', {
        code: 'BUNDLE_CONFIGURATION_INVALID',
      });
    }

    const roles = requiredRoles(currentSource.bundle_required_roles);
    if (!roles.includes(currentSource.bundle_role)) {
      throw new PermanentArtifactParseError('Current source role is not part of its required bundle roles', {
        code: 'BUNDLE_CONFIGURATION_INVALID',
        metadata: { bundleKey: currentSource.bundle_key, role: currentSource.bundle_role },
      });
    }
    if (roles.join(',') !== 'faq,main') {
      throw new PermanentArtifactParseError('PGK PSZOK handler supports exactly main + faq roles', {
        code: 'BUNDLE_CONFIGURATION_INVALID',
        metadata: { bundleKey: currentSource.bundle_key, roles },
      });
    }

    const sourceRows = await this.pool.query<BundleSourceRow>(
      `SELECT
         id, municipality_id, source_key, source_url, parser_key,
         bundle_key, bundle_role, bundle_required_roles, bundle_freshness_minutes
       FROM sources
       WHERE municipality_id = $1
         AND bundle_key = $2
       ORDER BY bundle_role, id`,
      [currentSource.municipality_id, currentSource.bundle_key],
    );

    const sourcesByRole = new Map<string, BundleSourceRow>();
    for (const source of sourceRows.rows) {
      if (!source.bundle_role || !roles.includes(source.bundle_role)) continue;
      if (sourcesByRole.has(source.bundle_role)) {
        throw new PermanentArtifactParseError('Bundle contains duplicate source roles', {
          code: 'BUNDLE_CONFIGURATION_INVALID',
          metadata: { bundleKey: currentSource.bundle_key, role: source.bundle_role },
        });
      }
      if (source.parser_key !== this.parserKey) {
        throw new PermanentArtifactParseError('Bundle member parser key does not match PGK PSZOK handler', {
          code: 'BUNDLE_CONFIGURATION_INVALID',
          metadata: { bundleKey: currentSource.bundle_key, role: source.bundle_role },
        });
      }
      if (!source.source_key) {
        throw new PermanentArtifactParseError('Bundle member has no stable source_key', {
          code: 'SOURCE_KEY_MISSING',
          metadata: { bundleKey: currentSource.bundle_key, role: source.bundle_role },
        });
      }
      sourcesByRole.set(source.bundle_role, source);
    }

    const missingSourceRoles = roles.filter((role) => !sourcesByRole.has(role));
    if (missingSourceRoles.length > 0) {
      throw new PermanentArtifactParseError('Bundle is missing required source definitions', {
        code: 'BUNDLE_CONFIGURATION_INVALID',
        metadata: { bundleKey: currentSource.bundle_key, missingSourceRoles },
      });
    }

    const members = new Map<string, BundleMember>();
    members.set(currentSource.bundle_role, {
      source: currentSource,
      artifact: artifactRow(input),
      body: input.body,
    });

    const missingArtifactRoles: string[] = [];
    const staleArtifactRoles: string[] = [];

    for (const role of roles) {
      if (role === currentSource.bundle_role) continue;
      const source = sourcesByRole.get(role)!;
      const compatible = await this.latestCompatibleArtifact(
        source.id,
        input.artifact.retrievedAt,
        currentSource.bundle_freshness_minutes,
      );
      if (!compatible) {
        const latest = await this.latestArtifact(source.id);
        if (latest) staleArtifactRoles.push(role);
        else missingArtifactRoles.push(role);
        continue;
      }

      let body: Buffer;
      try {
        body = await this.reader.readVerified({
          storageUri: compatible.storage_uri,
          expectedSha256: compatible.sha256,
        });
      } catch (error) {
        if (error instanceof ArtifactReadError && !error.retryable) {
          throw new PermanentArtifactParseError(error.message, {
            code: error.code,
            metadata: {
              bundleKey: currentSource.bundle_key,
              role,
              artifactId: compatible.id,
              sha256: compatible.sha256,
            },
            cause: error,
          });
        }
        throw error;
      }

      members.set(role, { source, artifact: compatible, body });
    }

    if (missingArtifactRoles.length > 0 || staleArtifactRoles.length > 0) {
      return {
        outcome: 'WAITING_FOR_COMPANION',
        metadata: {
          bundleKey: currentSource.bundle_key,
          currentRole: currentSource.bundle_role,
          requiredRoles: roles,
          missingArtifactRoles,
          staleArtifactRoles,
          freshnessMinutes: currentSource.bundle_freshness_minutes,
          retainedLastKnownGood: true,
        },
      };
    }

    const main = members.get('main')!;
    const faq = members.get('faq')!;

    try {
      const outcomes = await this.orchestrator.ingest({
        main: {
          artifactId: main.artifact.id,
          html: main.body.toString('utf8'),
          sourceKey: main.source.source_key!,
          url: main.source.source_url,
          sha256: main.artifact.sha256,
          retrievedAt: main.artifact.retrieved_at.toISOString(),
          storageUri: main.artifact.storage_uri,
        },
        faq: {
          artifactId: faq.artifact.id,
          html: faq.body.toString('utf8'),
          sourceKey: faq.source.source_key!,
          url: faq.source.source_url,
          sha256: faq.artifact.sha256,
          retrievedAt: faq.artifact.retrieved_at.toISOString(),
          storageUri: faq.artifact.storage_uri,
        },
      });

      const completedAt = new Date();
      for (const member of members.values()) {
        if (member.source.id === currentSource.id) continue;
        await this.registry.markSourceProcessingState({
          sourceId: member.source.id,
          artifactId: member.artifact.id,
          startedAt: completedAt,
          completedAt,
          outcome: 'PUBLISHED',
          parserKey: this.parserKey,
          errorCode: null,
          errorMessage: null,
          metadata: {
            bundleKey: currentSource.bundle_key,
            completedByArtifactId: input.artifact.id,
            companionCompletion: true,
          },
        });
      }

      return {
        outcome: 'PUBLISHED',
        metadata: {
          bundleKey: currentSource.bundle_key,
          requiredRoles: roles,
          freshnessMinutes: currentSource.bundle_freshness_minutes,
          members: roles.map((role) => {
            const member = members.get(role)!;
            return {
              role,
              sourceKey: member.source.source_key,
              artifactId: member.artifact.id,
              sha256: member.artifact.sha256,
              retrievedAt: member.artifact.retrieved_at.toISOString(),
            };
          }),
          outcomes: outcomes.map((outcome) => ({
            facilityKey: outcome.facilityKey,
            state: outcome.state,
            facilityId: outcome.facilityId,
          })),
        },
      };
    } catch (error) {
      if (error instanceof PermanentArtifactParseError) throw error;
      if (error instanceof Error && error.message.startsWith('PGK PSZOK adapter:')) {
        throw new PermanentArtifactParseError(error.message, {
          code: 'UNSUPPORTED_TEMPLATE',
          metadata: { bundleKey: currentSource.bundle_key },
          cause: error,
        });
      }
      if (error instanceof Error && error.message.includes('JSON Schema validation failed')) {
        throw new PermanentArtifactParseError(error.message, {
          code: 'SCHEMA_VALIDATION_FAILED',
          metadata: { bundleKey: currentSource.bundle_key },
          cause: error,
        });
      }
      throw error;
    }
  }

  private async sourceFor(sourceId: string): Promise<BundleSourceRow | null> {
    const result = await this.pool.query<BundleSourceRow>(
      `SELECT
         id, municipality_id, source_key, source_url, parser_key,
         bundle_key, bundle_role, bundle_required_roles, bundle_freshness_minutes
       FROM sources
       WHERE id = $1`,
      [sourceId],
    );
    return result.rows[0] ?? null;
  }

  private async latestCompatibleArtifact(
    sourceId: string,
    anchor: Date,
    freshnessMinutes: number,
  ): Promise<BundleArtifactRow | null> {
    const result = await this.pool.query<BundleArtifactRow>(
      `SELECT id, source_id, sha256, storage_uri, retrieved_at, status
       FROM source_artifacts
       WHERE source_id = $1
         AND status <> 'REJECTED'
         AND abs(extract(epoch FROM (retrieved_at - $2::timestamptz))) <= $3::double precision * 60
       ORDER BY retrieved_at DESC, id DESC
       LIMIT 1`,
      [sourceId, anchor, freshnessMinutes],
    );
    return result.rows[0] ?? null;
  }

  private async latestArtifact(sourceId: string): Promise<BundleArtifactRow | null> {
    const result = await this.pool.query<BundleArtifactRow>(
      `SELECT id, source_id, sha256, storage_uri, retrieved_at, status
       FROM source_artifacts
       WHERE source_id = $1
         AND status <> 'REJECTED'
       ORDER BY retrieved_at DESC, id DESC
       LIMIT 1`,
      [sourceId],
    );
    return result.rows[0] ?? null;
  }
}
