import { Client as MinioClient } from 'minio';
import { sha256Hex } from './hash.js';

export interface ArtifactReadInput {
  storageUri: string;
  expectedSha256: string;
}

export interface ArtifactReader {
  readVerified(input: ArtifactReadInput): Promise<Buffer>;
}

export interface MinioArtifactReaderOptions {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  maxBytes: number;
}

export class ArtifactReadError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(input: {
    message: string;
    code: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = 'ArtifactReadError';
    this.code = input.code;
    this.retryable = input.retryable;
  }
}

function endpointFromEnvironment(): URL {
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) return new URL(endpoint);

  const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
  const host = process.env.MINIO_ENDPOINT ?? 'localhost';
  const port = process.env.MINIO_PORT ?? '9000';
  return new URL(`${protocol}://${host}:${port}`);
}

function parseStorageUri(storageUri: string, expectedBucket: string): { bucket: string; key: string } {
  let parsed: URL;
  try {
    parsed = new URL(storageUri);
  } catch (error) {
    throw new ArtifactReadError({
      message: `Invalid artifact storage URI: ${storageUri}`,
      code: 'INVALID_ARTIFACT_STORAGE_URI',
      retryable: false,
      cause: error,
    });
  }

  if (parsed.protocol !== 's3:') {
    throw new ArtifactReadError({
      message: `Unsupported artifact storage protocol: ${parsed.protocol}`,
      code: 'UNSUPPORTED_ARTIFACT_STORAGE_URI',
      retryable: false,
    });
  }

  const bucket = parsed.hostname;
  const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!bucket || !key) {
    throw new ArtifactReadError({
      message: `Artifact storage URI must contain bucket and key: ${storageUri}`,
      code: 'INVALID_ARTIFACT_STORAGE_URI',
      retryable: false,
    });
  }
  if (bucket !== expectedBucket) {
    throw new ArtifactReadError({
      message: `Artifact bucket ${bucket} does not match configured bucket ${expectedBucket}`,
      code: 'ARTIFACT_BUCKET_MISMATCH',
      retryable: false,
    });
  }
  return { bucket, key };
}

export class MinioArtifactReader implements ArtifactReader {
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly maxBytes: number;

  constructor(options: Partial<MinioArtifactReaderOptions> = {}) {
    const endpoint = endpointFromEnvironment();
    const resolved: MinioArtifactReaderOptions = {
      endPoint: options.endPoint ?? endpoint.hostname,
      port:
        options.port ??
        Number.parseInt(endpoint.port || (endpoint.protocol === 'https:' ? '443' : '80'), 10),
      useSSL: options.useSSL ?? endpoint.protocol === 'https:',
      accessKey:
        options.accessKey ?? process.env.MINIO_ACCESS_KEY ?? process.env.S3_ACCESS_KEY ?? 'minio',
      secretKey:
        options.secretKey ??
        process.env.MINIO_SECRET_KEY ??
        process.env.S3_SECRET_KEY ??
        'change-me-now',
      bucket:
        options.bucket ?? process.env.MINIO_BUCKET ?? process.env.S3_BUCKET ?? 'wastepl-artifacts',
      maxBytes: options.maxBytes ?? 100 * 1024 * 1024,
    };

    if (!Number.isSafeInteger(resolved.maxBytes) || resolved.maxBytes <= 0) {
      throw new Error('Artifact reader maxBytes must be a positive safe integer');
    }

    this.client = new MinioClient({
      endPoint: resolved.endPoint,
      port: resolved.port,
      useSSL: resolved.useSSL,
      accessKey: resolved.accessKey,
      secretKey: resolved.secretKey,
    });
    this.bucket = resolved.bucket;
    this.maxBytes = resolved.maxBytes;
  }

  async readVerified(input: ArtifactReadInput): Promise<Buffer> {
    const { bucket, key } = parseStorageUri(input.storageUri, this.bucket);

    try {
      const stream = await this.client.getObject(bucket, key);
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > this.maxBytes) {
          stream.destroy();
          throw new ArtifactReadError({
            message: `Artifact exceeds configured ${this.maxBytes} byte read limit`,
            code: 'ARTIFACT_TOO_LARGE',
            retryable: false,
          });
        }
        chunks.push(buffer);
      }

      const body = Buffer.concat(chunks, totalBytes);
      const actualSha256 = sha256Hex(body);
      if (actualSha256 !== input.expectedSha256) {
        throw new ArtifactReadError({
          message: `Artifact SHA-256 mismatch: expected ${input.expectedSha256}, got ${actualSha256}`,
          code: 'ARTIFACT_SHA256_MISMATCH',
          retryable: false,
        });
      }
      return body;
    } catch (error) {
      if (error instanceof ArtifactReadError) throw error;
      throw new ArtifactReadError({
        message: `Failed to read immutable artifact ${input.storageUri}`,
        code: 'ARTIFACT_STORAGE_READ_FAILED',
        retryable: true,
        cause: error,
      });
    }
  }
}
