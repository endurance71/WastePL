-- Sprint 03 / Issue #32: versioned municipal source manifests.

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS source_key text,
  ADD COLUMN IF NOT EXISTS data_type text
    CHECK (data_type IS NULL OR data_type IN ('COLLECTION_SCHEDULE','PSZOK','ALERTS','OTHER')),
  ADD COLUMN IF NOT EXISTS manifest_status text
    CHECK (manifest_status IS NULL OR manifest_status IN ('ACTIVE','PLANNED')),
  ADD COLUMN IF NOT EXISTS manifest_version text,
  ADD COLUMN IF NOT EXISTS active_from date,
  ADD COLUMN IF NOT EXISTS active_to date;

CREATE UNIQUE INDEX IF NOT EXISTS ux_sources_source_key
  ON sources(source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sources_manifest_coverage
  ON sources(municipality_id, data_type, manifest_status, active);

ALTER TABLE sources
  ADD CONSTRAINT sources_manifest_active_check CHECK (
    manifest_status IS NULL
    OR manifest_status = 'ACTIVE'
    OR active = false
  );

COMMENT ON COLUMN sources.source_key IS
  'Stable source identity from a versioned WastePL source manifest.';
COMMENT ON COLUMN sources.manifest_status IS
  'ACTIVE means ingestion support is implemented; PLANNED entries must remain inactive.';
