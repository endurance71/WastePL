-- Sprint 04 / Issue #48: explicit multi-artifact source bundles and waiting state.

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS bundle_key text,
  ADD COLUMN IF NOT EXISTS bundle_role text,
  ADD COLUMN IF NOT EXISTS bundle_required_roles jsonb,
  ADD COLUMN IF NOT EXISTS bundle_freshness_minutes integer;

ALTER TABLE sources
  ADD CONSTRAINT sources_bundle_metadata_complete_check CHECK (
    (bundle_key IS NULL AND bundle_role IS NULL AND bundle_required_roles IS NULL AND bundle_freshness_minutes IS NULL)
    OR
    (
      bundle_key IS NOT NULL
      AND bundle_role IS NOT NULL
      AND bundle_required_roles IS NOT NULL
      AND jsonb_typeof(bundle_required_roles) = 'array'
      AND jsonb_array_length(bundle_required_roles) >= 2
      AND bundle_freshness_minutes IS NOT NULL
      AND bundle_freshness_minutes BETWEEN 60 AND 10080
    )
  );

CREATE INDEX IF NOT EXISTS idx_sources_bundle_key_role
  ON sources(municipality_id, bundle_key, bundle_role)
  WHERE bundle_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_sources_bundle_role
  ON sources(municipality_id, bundle_key, bundle_role)
  WHERE bundle_key IS NOT NULL;

-- Backfill stable manifest identities for the two known PGK Koszalin PSZOK sources.
-- This keeps a clean migration-only database usable before the manifest sync runs,
-- while the manifest remains the canonical declaration of the bundle relationship.
UPDATE sources
SET source_key = COALESCE(source_key, 'koszalin-pszok-main'),
    bundle_key = 'koszalin-pszok',
    bundle_role = 'main',
    bundle_required_roles = '["main","faq"]'::jsonb,
    bundle_freshness_minutes = 2880
WHERE source_url = 'https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-koszalin/';

UPDATE sources
SET source_key = COALESCE(source_key, 'koszalin-pszok-faq'),
    bundle_key = 'koszalin-pszok',
    bundle_role = 'faq',
    bundle_required_roles = '["main","faq"]'::jsonb,
    bundle_freshness_minutes = 2880
WHERE source_url = 'https://www.pgkkoszalin.pl/najczesciej-zadawane-pytania-f-a-q/';

ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_health_status_check;
ALTER TABLE sources
  ADD CONSTRAINT sources_health_status_check CHECK (health_status IN (
    'UNKNOWN','FETCHED','HEALTHY','UNCHANGED','FETCH_FAILED','PARSE_FAILED',
    'REVIEW_REQUIRED','WAITING_FOR_COMPANION'
  ));

ALTER TABLE source_processing_attempts DROP CONSTRAINT IF EXISTS source_processing_attempts_outcome_check;
ALTER TABLE source_processing_attempts
  ADD CONSTRAINT source_processing_attempts_outcome_check CHECK (outcome IN (
    'PUBLISHED','REVIEW_REQUIRED','WAITING_FOR_COMPANION','PARSE_FAILED'
  ));

COMMENT ON COLUMN sources.bundle_key IS
  'Stable logical bundle identity for parsers that require multiple independently fetched sources.';
COMMENT ON COLUMN sources.bundle_role IS
  'Role of this source inside bundle_key, e.g. main or faq.';
COMMENT ON COLUMN sources.bundle_required_roles IS
  'Required role set that must have compatible immutable artifacts before bundle processing.';
COMMENT ON COLUMN sources.bundle_freshness_minutes IS
  'Maximum retrieval-time distance between artifacts allowed in one deterministic bundle evaluation.';
