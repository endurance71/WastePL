-- Migration 0019: Privacy-preserving resident telemetry funnel
-- Raw installation identifiers are never stored; the API persists SHA-256 hashes only.
-- Payload is server-sanitized per event type before insertion.
CREATE TABLE IF NOT EXISTS resident_telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(80) NOT NULL UNIQUE,
  installation_hash CHAR(64) NOT NULL,
  event_type VARCHAR(32) NOT NULL CHECK (
    event_type IN (
      'APP_OPEN',
      'RETURN_VISIT',
      'ADDRESS_SEARCH',
      'ADDRESS_SELECTED',
      'SCHEDULE_SHOWN',
      'REMINDER_ICS_EXPORT',
      'REMINDER_PUSH_OPT_IN',
      'FEEDBACK_MODAL_OPEN',
      'FEEDBACK_SUBMITTED'
    )
  ),
  client_timestamp TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX IF NOT EXISTS idx_resident_telemetry_event_type_received_at
  ON resident_telemetry_events (event_type, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_resident_telemetry_installation_received_at
  ON resident_telemetry_events (installation_hash, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_resident_telemetry_expires_at
  ON resident_telemetry_events (expires_at);
