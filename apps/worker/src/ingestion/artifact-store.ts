import { Client as MinioClient } from 'minio';
import { artifactObjectKey } from './hash.js';
import type { ArtifactPutInput, ArtifactPutResult, ArtifactStore } from './types.js';

export interface MinioArtifactStoreOptions {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function endpointFromEnvironment(): URL {
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) return new URL(endpoint);

  const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
  const host = process.env.MINIO_ENDPOINT ?? 'localhost';
  const port = process.env.MINIO_PORT ?? '9000';
  return new URL(`${protocol}://${host}:${port}`);
}

export class MinioArtifactStore implements ArtifactStore {
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly region: string;
  private bucketReady: Promise<void> | null = null;

  constructor(options: Partial<MinioArtifactStoreOptions> = {}) {
    const endpoint = endpointFromEnvironment();
    const resolved: MinioArtifactStoreOptions = {
      endPoint: options.endPoint ?? endpoint.hostname,
      port: options.port ?? Number.parseInt(endpoint.port || (endpoint.protocol === 'https:' ? '443' : '80'), 10),
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
      region:
        options.region ?? process.env.MINIO_REGION ?? process.env.S3_REGION ?? 'eu-central-1',
    };

    this.client = new MinioClient({
      endPoint: resolved.endPoint,
      port: resolved.port,
      useSSL: resolved.useSSL,
      accessKey: resolved.accessKey,
      secretKey: resolved.secretKey,
    });
    this.bucket = resolved.bucket;
    this.region = resolved.region;
  }

  private async ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) await this.client.makeBucket(this.bucket, this.region);
      })();
    }
    await this.bucketReady;
  }

  async putIfAbsent(input: ArtifactPutInput): Promise<ArtifactPutResult> {
    await this.ensureBucket();
    const key = artifactObjectKey(input.sourceId, input.sha256);

    try {
      await this.client.statObject(this.bucket, key);
      return { uri: `s3://${this.bucket}/${key}`, created: false };
    } catch (error) {
      const code = errorCode(error);
      if (code !== 'NoSuchKey' && code !== 'NotFound' && code !== 'NoSuchObject') throw error;
    }

    await this.client.putObject(this.bucket, key, input.body, input.body.length, {
      'Content-Type': input.contentType ?? 'application/octet-stream',
      'x-amz-meta-sha256': input.sha256,
    });

    return { uri: `s3://${this.bucket}/${key}`, created: true };
  }
}
