-- Sprint 02 / facility contract v0.2.
-- Preserve v0.1 data while adding source-backed semantics for PSZOK and deposit-return points.

ALTER TABLE facilities
  ALTER COLUMN geom DROP NOT NULL;

ALTER TABLE facilities
  ADD COLUMN canonical_key text,
  ADD COLUMN external_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN accepted_materials text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN accepted_containers text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN opening_hours_timezone text,
  ADD COLUMN hours_source_artifact_id uuid REFERENCES source_artifacts(id),
  ADD COLUMN access_scope text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN access_requires_proof boolean,
  ADD COLUMN access_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN access_source_artifact_id uuid REFERENCES source_artifacts(id),
  ADD COLUMN operational_status text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN operational_status_observed_at timestamptz,
  ADD COLUMN operational_status_source_artifact_id uuid REFERENCES source_artifacts(id),
  ADD COLUMN location_source_artifact_id uuid REFERENCES source_artifacts(id);

ALTER TABLE facilities
  ADD CONSTRAINT facilities_kind_v02_check
    CHECK (kind IN (
      'PSZOK', 'DEPOSIT_RVM', 'DEPOSIT_MANUAL',
      'ELECTRONICS', 'TEXTILES', 'BATTERIES', 'MEDICINES', 'OTHER'
    )),
  ADD CONSTRAINT facilities_external_ids_array_check
    CHECK (jsonb_typeof(external_ids) = 'array'),
  ADD CONSTRAINT facilities_accepted_materials_check
    CHECK (accepted_materials <@ ARRAY[
      'MIXED','BIO','PAPER','GLASS','METALS_PLASTICS','GREEN','BULKY','ASH',
      'TEXTILES','ELECTRONICS','BATTERIES','MEDICINES','CONSTRUCTION','RUBBLE',
      'TYRES','HAZARDOUS','OTHER'
    ]::text[]),
  ADD CONSTRAINT facilities_accepted_containers_check
    CHECK (accepted_containers <@ ARRAY[
      'PET_BOTTLE','METAL_CAN','REUSABLE_GLASS_BOTTLE'
    ]::text[]),
  ADD CONSTRAINT facilities_deposit_requires_container_check
    CHECK (
      kind NOT IN ('DEPOSIT_RVM','DEPOSIT_MANUAL')
      OR cardinality(accepted_containers) > 0
    ),
  ADD CONSTRAINT facilities_pszok_no_deposit_containers_check
    CHECK (
      kind <> 'PSZOK'
      OR cardinality(accepted_containers) = 0
    ),
  ADD CONSTRAINT facilities_opening_hours_provenance_check
    CHECK (
      opening_hours IS NULL
      OR (opening_hours_timezone IS NOT NULL AND hours_source_artifact_id IS NOT NULL)
    ),
  ADD CONSTRAINT facilities_access_scope_check
    CHECK (access_scope IN (
      'OPEN_TO_ALL','MUNICIPALITY_RESIDENTS','MUNICIPALITY_PROPERTY_OWNERS','OTHER','UNKNOWN'
    )),
  ADD CONSTRAINT facilities_access_provenance_check
    CHECK (
      access_scope = 'UNKNOWN'
      OR access_source_artifact_id IS NOT NULL
    ),
  ADD CONSTRAINT facilities_operational_status_check
    CHECK (operational_status IN ('OPERATIONAL','TEMPORARILY_UNAVAILABLE','UNKNOWN')),
  ADD CONSTRAINT facilities_operational_status_provenance_check
    CHECK (
      operational_status = 'UNKNOWN'
      OR (
        operational_status_observed_at IS NOT NULL
        AND operational_status_source_artifact_id IS NOT NULL
      )
    ),
  ADD CONSTRAINT facilities_location_provenance_check
    CHECK (
      geom IS NULL
      OR location_source_artifact_id IS NOT NULL
      OR source_artifact_id IS NOT NULL
    );

CREATE UNIQUE INDEX idx_facilities_canonical_key
  ON facilities(canonical_key)
  WHERE canonical_key IS NOT NULL;

CREATE UNIQUE INDEX idx_facilities_source_external_key
  ON facilities(source_artifact_id, external_key)
  WHERE source_artifact_id IS NOT NULL AND external_key IS NOT NULL;

CREATE INDEX idx_facilities_operational_status
  ON facilities(operational_status);

CREATE INDEX idx_facilities_accepted_materials
  ON facilities USING gin(accepted_materials);

CREATE INDEX idx_facilities_accepted_containers
  ON facilities USING gin(accepted_containers);

COMMENT ON COLUMN facilities.canonical_key IS
  'WastePL stable canonical identity. Never derive from mutable operational state.';
COMMENT ON COLUMN facilities.external_ids IS
  'Source/provider external identifiers preserved as structured assertions.';
COMMENT ON COLUMN facilities.operational_status IS
  'UNKNOWN means no current source-backed operational assertion; it is not equivalent to unavailable.';
COMMENT ON COLUMN facilities.operational_status_observed_at IS
  'Observation timestamp required for OPERATIONAL/TEMPORARILY_UNAVAILABLE.';
