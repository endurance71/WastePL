-- Migration 0018: Schedule discrepancy feedback table
CREATE TABLE IF NOT EXISTS schedule_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id VARCHAR(64) NOT NULL,
  address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  reported_issue_type VARCHAR(32) NOT NULL,
  details TEXT,
  client_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_feedback_address_id ON schedule_feedback (address_id);
CREATE INDEX IF NOT EXISTS idx_schedule_feedback_created_at ON schedule_feedback (created_at);
