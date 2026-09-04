-- Migration 0017: Push Subscriptions for scheduled waste collection reminders

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id VARCHAR(64) NOT NULL,
  address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  reminder_timing VARCHAR(32) NOT NULL DEFAULT 'EVENING_BEFORE_20',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_address ON push_subscriptions(address_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_timing ON push_subscriptions(reminder_timing);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_installation ON push_subscriptions(installation_id);

COMMENT ON TABLE push_subscriptions IS
  'Active Web Push subscriptions linked to canonical addresses for scheduled collection reminders.';
