-- Sprint 02 / facility identity, deduplication and freshness engine.
-- Canonical facilities remain separate from source assertions. Reconciliation never destroys provenance.

CREATE TABLE facility_source_assertions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  source_artifact_id uuid NOT NULL REFERENCES source_artifacts(id) ON DELETE RESTRICT,
  source_key text NOT NULL,
  source_authority integer NOT NULL CHECK (source_authority BETWEEN 0 AND 1000),
  retrieved_at timestamptz NOT NULL,
  static_freshness_seconds integer NOT NULL CHECK (static_freshness_seconds > 0),
  status_freshness_seconds integer NOT NULL CHECK (status_freshness_seconds > 0),
  kind text NOT NULL CHECK (kind IN (
    'PSZOK', 'DEPOSIT_RVM', 'DEPOSIT_MANUAL',
    'ELECTRONICS', 'TEXTILES', 'BATTERIES', 'MEDICINES', 'OTHER'
  )),
  municipality_id uuid REFERENCES municipalities(id) ON DELETE SET NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  address_text text,
  normalized_address text NOT NULL DEFAULT '',
  geom geometry(Point, 4326),
  external_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(external_ids) = 'array'),
  accepted_materials text[] NOT NULL DEFAULT ARRAY[]::text[],
  accepted_containers text[] NOT NULL DEFAULT ARRAY[]::text[],
  operational_status text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (operational_status IN ('OPERATIONAL','TEMPORARILY_UNAVAILABLE','UNKNOWN')),
  operational_status_observed_at timestamptz,
  operational_status_source_key text,
  fingerprint text NOT NULL,
  reconciliation_state text NOT NULL DEFAULT 'UNMATCHED'
    CHECK (reconciliation_state IN ('UNMATCHED','CANONICAL','REVIEW_REQUIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facility_source_assertions_status_provenance_check CHECK (
    operational_status = 'UNKNOWN'
    OR (operational_status_observed_at IS NOT NULL AND operational_status_source_key IS NOT NULL)
  ),
  UNIQUE (source_artifact_id, fingerprint)
);

CREATE INDEX idx_facility_source_assertions_facility
  ON facility_source_assertions(facility_id);
CREATE INDEX idx_facility_source_assertions_fingerprint
  ON facility_source_assertions(fingerprint);
CREATE INDEX idx_facility_source_assertions_normalized_address
  ON facility_source_assertions(normalized_address);
CREATE INDEX idx_facility_source_assertions_normalized_name
  ON facility_source_assertions(normalized_name);
CREATE INDEX idx_facility_source_assertions_external_ids
  ON facility_source_assertions USING gin(external_ids);
CREATE INDEX idx_facility_source_assertions_geom
  ON facility_source_assertions USING gist(geom);
CREATE INDEX idx_facility_source_assertions_freshness
  ON facility_source_assertions(retrieved_at, static_freshness_seconds);

CREATE VIEW facility_source_assertion_freshness AS
SELECT
  a.*,
  CASE
    WHEN a.retrieved_at + (a.static_freshness_seconds * interval '1 second') >= now()
      THEN 'CURRENT'
    ELSE 'STALE'
  END AS static_freshness_state,
  CASE
    WHEN a.operational_status = 'UNKNOWN' THEN 'UNKNOWN'
    WHEN a.operational_status_observed_at IS NULL OR a.operational_status_source_key IS NULL THEN 'UNKNOWN'
    WHEN a.operational_status_observed_at + (a.status_freshness_seconds * interval '1 second') >= now()
      THEN a.operational_status
    ELSE 'UNKNOWN'
  END AS effective_operational_status,
  (
    a.operational_status <> 'UNKNOWN'
    AND a.operational_status_observed_at IS NOT NULL
    AND a.operational_status_observed_at + (a.status_freshness_seconds * interval '1 second') < now()
  ) AS operational_status_stale
FROM facility_source_assertions a;

CREATE TABLE facility_reconciliation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assertion_id uuid NOT NULL REFERENCES facility_source_assertions(id) ON DELETE CASCADE,
  candidate_facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  score numeric(5,4) NOT NULL CHECK (score BETWEEN 0 AND 1),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reasons) = 'array'),
  state text NOT NULL DEFAULT 'PENDING'
    CHECK (state IN ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text,
  UNIQUE (assertion_id, candidate_facility_id)
);

CREATE INDEX idx_facility_reconciliation_reviews_pending
  ON facility_reconciliation_reviews(state, created_at)
  WHERE state = 'PENDING';

COMMENT ON TABLE facility_source_assertions IS
  'Source-specific facility claims retained independently of canonical WastePL facility identity.';
COMMENT ON COLUMN facility_source_assertions.fingerprint IS
  'Deterministic candidate fingerprint only; it is not a substitute for stable provider identity.';
COMMENT ON COLUMN facility_source_assertions.reconciliation_state IS
  'UNMATCHED assertions may create a new canonical facility; REVIEW_REQUIRED must never be silently attached.';
COMMENT ON VIEW facility_source_assertion_freshness IS
  'Dynamic freshness projection. Stale source-backed operational assertions degrade to UNKNOWN.';
COMMENT ON TABLE facility_reconciliation_reviews IS
  'Auditable queue for low-confidence or conflicting cross-source facility matches.';
