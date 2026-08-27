export interface SourceRecord {
  id: string;
  sourceUrl: string;
  sourceFormat: string;
  parserKey: string | null;
  etag: string | null;
  lastModified: string | null;
  active: boolean;
}

export interface SourceArtifactRecord {
  id: string;
  sourceId: string;
  sha256: string;
  storageUri: string;
  retrievedAt: Date;
}

export type FetchOutcome = 'FETCHED' | 'NOT_MODIFIED' | 'DEDUPLICATED' | 'FAILED';

export interface SourceFetchAttemptInput {
  sourceId: string;
  startedAt: Date;
  completedAt: Date;
  outcome: FetchOutcome;
  attempts: number;
  httpStatus: number | null;
  etag: string | null;
  lastModified: string | null;
  sha256: string | null;
  bytesReceived: number | null;
  contentType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

export interface InsertSourceArtifactInput {
  sourceId: string;
  retrievedAt: Date;
  sha256: string;
  storageUri: string;
  parserKey: string | null;
}

export interface ArtifactParseUpdate {
  artifactId: string;
  parserKey: string;
  parserVersion: string;
  extractionConfidence: number;
  status: 'PARSED' | 'NORMALIZED' | 'PUBLISHED' | 'REVIEW_REQUIRED' | 'REJECTED';
  parseReport: Record<string, unknown>;
}

export interface SourceCheckUpdate {
  checkedAt: Date;
  etag: string | null;
  lastModified: string | null;
  sha256: string | null;
}

export interface SourceRegistry {
  getSourceById(sourceId: string): Promise<SourceRecord | null>;
  findArtifactByHash(sourceId: string, sha256: string): Promise<SourceArtifactRecord | null>;
  insertArtifact(input: InsertSourceArtifactInput): Promise<SourceArtifactRecord>;
  markArtifactParsed(update: ArtifactParseUpdate): Promise<void>;
  markSourceChecked(sourceId: string, update: SourceCheckUpdate): Promise<void>;
  recordFetchAttempt(input: SourceFetchAttemptInput): Promise<void>;
}

export interface ArtifactPutInput {
  sourceId: string;
  sha256: string;
  body: Buffer;
  contentType: string | null;
}

export interface ArtifactPutResult {
  uri: string;
  created: boolean;
}

export interface ArtifactStore {
  putIfAbsent(input: ArtifactPutInput): Promise<ArtifactPutResult>;
}

export interface FetchedSource {
  status: number;
  notModified: boolean;
  body: Buffer | null;
  etag: string | null;
  lastModified: string | null;
  contentType: string | null;
  finalUrl: string;
  attempts: number;
  retrievedAt: Date;
}

export interface SourceFetcher {
  fetch(source: SourceRecord): Promise<FetchedSource>;
}

export interface StructuredLogger {
  info(event: string, metadata: Record<string, unknown>): void;
  error(event: string, metadata: Record<string, unknown>): void;
}
