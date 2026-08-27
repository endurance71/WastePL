export type SourceHealthStatus =
  | 'UNKNOWN'
  | 'FETCHED'
  | 'HEALTHY'
  | 'UNCHANGED'
  | 'FETCH_FAILED'
  | 'PARSE_FAILED'
  | 'REVIEW_REQUIRED';

export interface SourceRecord {
  id: string;
  sourceUrl: string;
  sourceFormat: string;
  parserKey: string | null;
  etag: string | null;
  lastModified: string | null;
  lastSha256: string | null;
  active: boolean;
  pollIntervalMinutes: number;
  nextCheckAt: Date | null;
  healthStatus: SourceHealthStatus;
  consecutiveFailures: number;
  pollClaimToken: string | null;
  pollClaimExpiresAt: Date | null;
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
  healthStatus?: Extract<SourceHealthStatus, 'FETCHED' | 'HEALTHY' | 'UNCHANGED'>;
  claimToken?: string | null;
}

export interface SourceFailureUpdate {
  failedAt: Date;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  claimToken?: string | null;
}

export interface SourceProcessingAttemptInput {
  sourceId: string;
  artifactId: string;
  startedAt: Date;
  completedAt: Date;
  outcome: 'PUBLISHED' | 'REVIEW_REQUIRED' | 'PARSE_FAILED';
  parserKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

export interface SourceProcessingStateUpdate {
  sourceId: string;
  artifactId: string;
  completedAt: Date;
  outcome: 'PUBLISHED' | 'REVIEW_REQUIRED' | 'PARSE_FAILED';
  parserKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata?: Record<string, unknown>;
}

export interface SourceRegistry {
  getSourceById(sourceId: string): Promise<SourceRecord | null>;
  findArtifactByHash(sourceId: string, sha256: string): Promise<SourceArtifactRecord | null>;
  insertArtifact(input: InsertSourceArtifactInput): Promise<SourceArtifactRecord>;
  markArtifactParsed(update: ArtifactParseUpdate): Promise<void>;
  markSourceChecked(sourceId: string, update: SourceCheckUpdate): Promise<void>;
  markSourceFailed(sourceId: string, update: SourceFailureUpdate): Promise<void>;
  markSourceProcessingState(update: SourceProcessingStateUpdate): Promise<void>;
  recordFetchAttempt(input: SourceFetchAttemptInput): Promise<void>;
  recordProcessingAttempt(input: SourceProcessingAttemptInput): Promise<void>;
}

export interface SourcePollClaim {
  sourceId: string;
  claimToken: string;
  sourceUrl: string;
  parserKey: string | null;
  claimedAt: Date;
  claimExpiresAt: Date;
}

export interface ClaimDueSourcesInput {
  now: Date;
  limit: number;
  leaseMs: number;
}

export interface SourceSchedulerRegistry {
  claimDueSources(input: ClaimDueSourcesInput): Promise<SourcePollClaim[]>;
  releasePollClaim(sourceId: string, claimToken: string, nextCheckAt: Date): Promise<void>;
}

export interface SourcePollJobInput {
  sourceId: string;
  claimToken: string;
}

export interface SourcePollJobQueue {
  enqueue(input: SourcePollJobInput): Promise<void>;
}

export interface ArtifactProcessingJobInput {
  sourceId: string;
  artifactId: string;
  parserKey: string | null;
}

export interface ArtifactProcessingQueue {
  enqueue(input: ArtifactProcessingJobInput): Promise<void>;
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
