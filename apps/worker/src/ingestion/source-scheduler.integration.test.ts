import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgSourceRegistry } from './source-registry.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('source scheduler persistence', () => {
  let pool: InstanceType<typeof Pool>;
  let registry: PgSourceRegistry;
  let sourceId: string;
  const claimedSourceTokens = new Set<string>();
  const claimedOutboxTokens = new Set<string>();

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    registry = new PgSourceRegistry(pool);
    const source = await pool.query<{ id: string }>(
      `INSERT INTO sources (
         owner_type, owner_name, source_url, source_format, parser_key,
         poll_interval_minutes, next_check_at, last_sha256
       ) VALUES (
         'MUNICIPALITY', 'Scheduler integration', $1, 'HTML', 'scheduler-test-parser',
         60, '2026-08-27T10:00:00Z', $2
       ) RETURNING id`,
      [`https://example.test/wastepl/scheduler/${randomUUID()}`, 'f'.repeat(64)],
    );
    sourceId = source.rows[0]!.id;
  });

  afterAll(async () => {
    for (const token of claimedSourceTokens) {
      await pool.query(
        `UPDATE sources
         SET poll_claim_token=NULL, poll_claimed_at=NULL, poll_claim_expires_at=NULL
         WHERE poll_claim_token=$1::uuid`,
        [token],
      );
    }
    for (const token of claimedOutboxTokens) {
      await pool.query(
        `UPDATE artifact_processing_outbox
         SET claim_token=NULL, claim_expires_at=NULL
         WHERE claim_token=$1::uuid`,
        [token],
      );
    }
    await pool.query('DELETE FROM sources WHERE id=$1', [sourceId]);
    await pool.end();
  });

  it('allows only one concurrent claim per due source and reclaims an expired lease', async () => {
    const now = new Date('2026-08-27T12:00:00Z');
    const [first, second] = await Promise.all([
      registry.claimDueSources({ now, limit: 1000, leaseMs: 2_000 }),
      registry.claimDueSources({ now, limit: 1000, leaseMs: 2_000 }),
    ]);
    for (const claim of [...first, ...second]) claimedSourceTokens.add(claim.claimToken);

    const matching = [...first, ...second].filter((claim) => claim.sourceId === sourceId);
    expect(matching).toHaveLength(1);
    const originalClaim = matching[0]!;

    const beforeExpiry = await registry.claimDueSources({
      now: new Date('2026-08-27T12:00:01Z'),
      limit: 1000,
      leaseMs: 2_000,
    });
    for (const claim of beforeExpiry) claimedSourceTokens.add(claim.claimToken);
    expect(beforeExpiry.some((claim) => claim.sourceId === sourceId)).toBe(false);

    const afterExpiry = await registry.claimDueSources({
      now: new Date('2026-08-27T12:00:02.001Z'),
      limit: 1000,
      leaseMs: 2_000,
    });
    for (const claim of afterExpiry) claimedSourceTokens.add(claim.claimToken);
    const reclaimed = afterExpiry.find((claim) => claim.sourceId === sourceId);
    expect(reclaimed).toBeDefined();
    expect(reclaimed!.claimToken).not.toBe(originalClaim.claimToken);
  });

  it('creates and concurrently claims exactly one durable outbox item for a new artifact', async () => {
    const inserted = await registry.insertArtifact({
      sourceId,
      retrievedAt: new Date('2026-08-27T12:10:00Z'),
      sha256: 'a'.repeat(64),
      storageUri: `s3://test/${sourceId}/${'a'.repeat(64)}`,
      parserKey: 'scheduler-test-parser',
    });
    expect(inserted.created).toBe(true);

    const replay = await registry.insertArtifact({
      sourceId,
      retrievedAt: new Date('2026-08-27T12:11:00Z'),
      sha256: 'a'.repeat(64),
      storageUri: `s3://test/${sourceId}/${'a'.repeat(64)}`,
      parserKey: 'scheduler-test-parser',
    });
    expect(replay.created).toBe(false);
    expect(replay.artifact.id).toBe(inserted.artifact.id);

    await pool.query(
      `UPDATE artifact_processing_outbox
       SET next_attempt_at='2026-08-27T12:11:00Z'
       WHERE artifact_id=$1`,
      [inserted.artifact.id],
    );

    const now = new Date('2026-08-27T12:12:00Z');
    const [first, second] = await Promise.all([
      registry.claimPendingArtifactWork({ now, limit: 1000, leaseMs: 2_000 }),
      registry.claimPendingArtifactWork({ now, limit: 1000, leaseMs: 2_000 }),
    ]);
    for (const claim of [...first, ...second]) claimedOutboxTokens.add(claim.claimToken);

    const matching = [...first, ...second].filter(
      (claim) => claim.artifactId === inserted.artifact.id,
    );
    expect(matching).toHaveLength(1);
    const claim = matching[0]!;

    await registry.markArtifactWorkEnqueued(
      inserted.artifact.id,
      claim.claimToken,
      new Date('2026-08-27T12:12:01Z'),
    );

    const outbox = await pool.query<{
      count: string;
      enqueued_at: Date | null;
      enqueue_attempts: number;
    }>(
      `SELECT count(*)::text AS count, max(enqueued_at) AS enqueued_at,
              max(enqueue_attempts)::integer AS enqueue_attempts
       FROM artifact_processing_outbox
       WHERE artifact_id=$1`,
      [inserted.artifact.id],
    );
    expect(outbox.rows[0]?.count).toBe('1');
    expect(outbox.rows[0]?.enqueued_at).not.toBeNull();
    expect(outbox.rows[0]?.enqueue_attempts).toBe(1);
  });

  it('backs off fetch failures without overwriting last known good SHA', async () => {
    const firstFailureAt = new Date('2026-08-27T13:00:00Z');
    await registry.markSourceFailed(sourceId, {
      failedAt: firstFailureAt,
      errorCode: 'HTTP_503',
      errorMessage: 'upstream unavailable',
      retryable: true,
    });

    let state = await registry.getSourceById(sourceId);
    expect(state).toMatchObject({
      healthStatus: 'FETCH_FAILED',
      consecutiveFailures: 1,
      lastSha256: 'f'.repeat(64),
    });
    expect(state!.nextCheckAt?.toISOString()).toBe('2026-08-27T13:05:00.000Z');

    const secondFailureAt = new Date('2026-08-27T14:00:00Z');
    await registry.markSourceFailed(sourceId, {
      failedAt: secondFailureAt,
      errorCode: 'HTTP_503',
      errorMessage: 'still unavailable',
      retryable: true,
    });
    state = await registry.getSourceById(sourceId);
    expect(state).toMatchObject({
      healthStatus: 'FETCH_FAILED',
      consecutiveFailures: 2,
      lastSha256: 'f'.repeat(64),
    });
    expect(state!.nextCheckAt?.toISOString()).toBe('2026-08-27T14:10:00.000Z');
  });

  it('keeps a permanent parse failure visible across unchanged fetches, then recovers on publish', async () => {
    const artifact = await registry.findArtifactByHash(sourceId, 'a'.repeat(64));
    expect(artifact).not.toBeNull();

    await registry.markSourceProcessingState({
      sourceId,
      artifactId: artifact!.id,
      startedAt: new Date('2026-08-27T15:00:00Z'),
      completedAt: new Date('2026-08-27T15:00:01Z'),
      outcome: 'PARSE_FAILED',
      parserKey: 'scheduler-test-parser',
      errorCode: 'UNSUPPORTED_LAYOUT',
      errorMessage: 'deterministic parser failure',
      metadata: { fixture: true },
    });

    await registry.markSourceChecked(sourceId, {
      checkedAt: new Date('2026-08-27T16:00:00Z'),
      etag: '"same"',
      lastModified: null,
      sha256: null,
      healthStatus: 'UNCHANGED',
    });

    let state = await registry.getSourceById(sourceId);
    expect(state?.healthStatus).toBe('PARSE_FAILED');
    const persistedError = await pool.query<{ last_error_code: string | null }>(
      'SELECT last_error_code FROM sources WHERE id=$1',
      [sourceId],
    );
    expect(persistedError.rows[0]?.last_error_code).toBe('UNSUPPORTED_LAYOUT');

    await registry.markSourceProcessingState({
      sourceId,
      artifactId: artifact!.id,
      startedAt: new Date('2026-08-27T16:10:00Z'),
      completedAt: new Date('2026-08-27T16:10:01Z'),
      outcome: 'PUBLISHED',
      parserKey: 'scheduler-test-parser',
      errorCode: null,
      errorMessage: null,
      metadata: { recovered: true },
    });
    state = await registry.getSourceById(sourceId);
    expect(state).toMatchObject({ healthStatus: 'HEALTHY', consecutiveFailures: 0 });

    const attempts = await pool.query<{
      outcome: string;
      started_at: Date;
      completed_at: Date;
    }>(
      `SELECT outcome, started_at, completed_at
       FROM source_processing_attempts
       WHERE source_id=$1
       ORDER BY id`,
      [sourceId],
    );
    expect(attempts.rows.map((row) => row.outcome)).toEqual(['PARSE_FAILED', 'PUBLISHED']);
    expect(attempts.rows[0]?.started_at.toISOString()).toBe('2026-08-27T15:00:00.000Z');
    expect(attempts.rows[0]?.completed_at.toISOString()).toBe('2026-08-27T15:00:01.000Z');
  });
});
