CREATE TABLE source_fetch_attempts (
  id bigserial PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('FETCHED','NOT_MODIFIED','DEDUPLICATED','FAILED')),
  attempts integer NOT NULL CHECK (attempts >= 1),
  http_status integer,
  etag text,
  last_modified text,
  sha256 text,
  bytes_received bigint,
  content_type text,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_source_fetch_attempts_source_started
  ON source_fetch_attempts(source_id, started_at DESC);

ALTER TABLE sources
  ADD COLUMN next_check_at timestamptz;

CREATE INDEX idx_sources_polling
  ON sources(active, next_check_at, last_checked_at);
