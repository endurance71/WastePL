-- Sprint 03 / Issue #30: persistent scheduling, leases and source-health state.
-- A failed/stale source must never overwrite the last known good artifact/hash.

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health_status IN (
      'UNKNOWN','FETCHED','HEALTHY','UNCHANGED','FETCH_FAILED','PARSE_FAILED','REVIEW_REQUIRED'
    )),
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0
    CHECK (consecutive_failures >= 0),
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS poll_claim_token uuid,
  ADD COLUMN IF NOT EXISTS poll_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS poll_claim_expires_at timestamptz;

-- Existing active sources become schedulable without discarding their previous
-- last_checked_at timestamp. Sources never checked before are due immediately.
UPDATE sources
SET next_check_at = COALESCE(
  next_check_at,
  last_checked_at + (poll_interval_minutes * interval '1 minute'),
  now()
)
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_sources_due_poll_claim
  ON sources(active, next_check_at, poll_claim_expires_at);

CREATE TABLE source_processing_attempts (
  id bigserial PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  artifact_id uuid NOT NULL REFERENCES source_artifacts(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('PUBLISHED','REVIEW_REQUIRED','PARSE_FAILED')),
  parser_key text,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_source_processing_attempts_source_completed
  ON source_processing_attempts(source_id, completed_at DESC);
CREATE INDEX idx_source_processing_attempts_artifact
  ON source_processing_attempts(artifact_id, completed_at DESC);

-- Durable handoff between immutable artifact creation and Redis/BullMQ. Only a
-- newly inserted source_artifact receives a row here. A deterministic queue job
-- id based on artifact_id makes re-dispatch after a crash safe.
CREATE TABLE artifact_processing_outbox (
  artifact_id uuid PRIMARY KEY REFERENCES source_artifacts(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  parser_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  enqueue_attempts integer NOT NULL DEFAULT 0 CHECK (enqueue_attempts >= 0),
  enqueued_at timestamptz,
  claim_token uuid,
  claim_expires_at timestamptz,
  last_error text
);

CREATE INDEX idx_artifact_processing_outbox_pending
  ON artifact_processing_outbox(enqueued_at, next_attempt_at, claim_expires_at);

COMMENT ON COLUMN sources.poll_claim_token IS
  'Opaque claim token created atomically by a scheduler. Cleared when the poll finishes or the enqueue fails.';
COMMENT ON COLUMN sources.poll_claim_expires_at IS
  'Crash-safety lease deadline. Expired claims can be reclaimed by another scheduler.';
COMMENT ON COLUMN sources.health_status IS
  'Operational source state; independent from last_sha256/last published canonical data.';
COMMENT ON TABLE artifact_processing_outbox IS
  'Transactional durable handoff: exactly one pending parse/normalize item per newly created immutable artifact.';
