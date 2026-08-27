-- Sprint 03 / Issue #29: official TERYT + PRG reference backbone import metadata.
-- Importers keep WastePL UUIDs stable while preserving authoritative external identifiers.

CREATE TABLE reference_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset text NOT NULL CHECK (dataset IN ('TERYT_TERC','TERYT_SIMC','TERYT_ULIC','PRG_ADDRESS')),
  source_version text NOT NULL,
  source_uri text,
  source_sha256 text,
  scope_key text,
  full_snapshot boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  inserted_count integer NOT NULL DEFAULT 0 CHECK (inserted_count >= 0),
  updated_count integer NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
  unchanged_count integer NOT NULL DEFAULT 0 CHECK (unchanged_count >= 0),
  deactivated_count integer NOT NULL DEFAULT 0 CHECK (deactivated_count >= 0),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  rejected_rows jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rejected_rows) = 'array'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_reference_import_runs_dataset_started
  ON reference_import_runs(dataset, started_at DESC);
CREATE INDEX idx_reference_import_runs_scope
  ON reference_import_runs(dataset, scope_key, started_at DESC);

ALTER TABLE municipalities
  ADD COLUMN IF NOT EXISTS teryt_kind_code text,
  ADD COLUMN IF NOT EXISTS teryt_kind_name text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_updated_at date,
  ADD COLUMN IF NOT EXISTS last_seen_import_id uuid REFERENCES reference_import_runs(id) ON DELETE SET NULL;

ALTER TABLE localities
  ADD COLUMN IF NOT EXISTS locality_type_code text,
  ADD COLUMN IF NOT EXISTS parent_simc text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_updated_at date,
  ADD COLUMN IF NOT EXISTS last_seen_import_id uuid REFERENCES reference_import_runs(id) ON DELETE SET NULL;

ALTER TABLE streets
  ADD COLUMN IF NOT EXISTS street_type text,
  ADD COLUMN IF NOT EXISTS name_1 text,
  ADD COLUMN IF NOT EXISTS name_2 text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_updated_at date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_import_id uuid REFERENCES reference_import_runs(id) ON DELETE SET NULL;

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to date,
  ADD COLUMN IF NOT EXISTS last_seen_import_id uuid REFERENCES reference_import_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_municipalities_reference_active
  ON municipalities(active, terc);
CREATE INDEX IF NOT EXISTS idx_localities_reference_active
  ON localities(active, simc);
CREATE INDEX IF NOT EXISTS idx_streets_reference_active
  ON streets(locality_id, active, ulic);
CREATE INDEX IF NOT EXISTS idx_addresses_reference_active
  ON addresses(municipality_id, active, prg_id);

COMMENT ON TABLE reference_import_runs IS
  'Auditable full/incremental imports from official TERYT and PRG datasets.';
COMMENT ON COLUMN reference_import_runs.scope_key IS
  'Optional import scope, e.g. municipality TERC for a PRG municipal package.';
COMMENT ON COLUMN municipalities.teryt_kind_code IS
  'Official TERYT RODZ code. Kept separate from WastePL product-level municipality_type.';
COMMENT ON COLUMN addresses.prg_id IS
  'Authoritative PRG/idIIP-derived source identifier. WastePL must never synthesize it.';
COMMENT ON COLUMN streets.ulic IS
  'Authoritative TERYT SYM_UL identifier for a street name within the locality relation; not globally unique by itself.';
