import {
  PermanentArtifactParseError,
  type ArtifactProcessor,
  type ArtifactProcessorResult,
} from './artifact-processing.js';
import { ArtifactReadError, type ArtifactReader } from './artifact-reader.js';
import type {
  ArtifactProcessingJobInput,
  ArtifactProcessingLookup,
  ArtifactProcessingRecord,
} from './types.js';

export interface ArtifactHandlerInput {
  artifact: ArtifactProcessingRecord;
  body: Buffer;
}

export interface ArtifactHandler {
  parserKey: string;
  process(input: ArtifactHandlerInput): Promise<ArtifactProcessorResult>;
}

export class DispatchingArtifactProcessor implements ArtifactProcessor {
  private readonly handlers: Map<string, ArtifactHandler>;

  constructor(
    private readonly lookup: ArtifactProcessingLookup,
    private readonly reader: ArtifactReader,
    handlers: ArtifactHandler[],
  ) {
    this.handlers = new Map<string, ArtifactHandler>();
    for (const handler of handlers) {
      if (!handler.parserKey.trim()) throw new Error('Artifact handler parserKey cannot be empty');
      if (this.handlers.has(handler.parserKey)) {
        throw new Error(`Duplicate artifact handler for parser key ${handler.parserKey}`);
      }
      this.handlers.set(handler.parserKey, handler);
    }
  }

  async process(input: ArtifactProcessingJobInput): Promise<ArtifactProcessorResult> {
    const artifact = await this.lookup.getArtifactForProcessing(input.artifactId);
    if (!artifact) {
      throw new PermanentArtifactParseError(`Artifact ${input.artifactId} not found`, {
        code: 'ARTIFACT_NOT_FOUND',
      });
    }

    if (artifact.sourceId !== input.sourceId) {
      throw new PermanentArtifactParseError('Queue sourceId does not match persisted artifact source', {
        code: 'ARTIFACT_SOURCE_MISMATCH',
        metadata: { persistedSourceId: artifact.sourceId },
      });
    }

    if (!artifact.parserKey) {
      throw new PermanentArtifactParseError('Persisted artifact has no parser key', {
        code: 'MISSING_PARSER_KEY',
      });
    }

    if (input.parserKey !== artifact.parserKey) {
      throw new PermanentArtifactParseError('Queue parser key does not match persisted artifact parser key', {
        code: 'PARSER_KEY_MISMATCH',
        metadata: {
          queuedParserKey: input.parserKey,
          persistedParserKey: artifact.parserKey,
        },
      });
    }

    if (artifact.status === 'PUBLISHED' || artifact.status === 'REVIEW_REQUIRED') {
      return {
        outcome: artifact.status,
        metadata: {
          replaySkipped: true,
          artifactStatus: artifact.status,
          sha256: artifact.sha256,
        },
      };
    }

    const handler = this.handlers.get(artifact.parserKey);
    if (!handler) {
      throw new PermanentArtifactParseError(
        `No artifact handler registered for parser key ${artifact.parserKey}`,
        {
          code: 'UNKNOWN_PARSER_KEY',
          metadata: { parserKey: artifact.parserKey },
        },
      );
    }

    let body: Buffer;
    try {
      body = await this.reader.readVerified({
        storageUri: artifact.storageUri,
        expectedSha256: artifact.sha256,
      });
    } catch (error) {
      if (error instanceof ArtifactReadError && !error.retryable) {
        throw new PermanentArtifactParseError(error.message, {
          code: error.code,
          metadata: { storageUri: artifact.storageUri, sha256: artifact.sha256 },
          cause: error,
        });
      }
      throw error;
    }

    const result = await handler.process({ artifact, body });
    return {
      outcome: result.outcome,
      metadata: {
        ...(result.metadata ?? {}),
        parserKey: artifact.parserKey,
        sha256: artifact.sha256,
        bytes: body.length,
      },
    };
  }
}
