-- Sprint 04 / Issue #47: source-owned canonical collection publications.
-- A service area must be attributable to the source that is allowed to replace it.

ALTER TABLE service_areas
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_from_artifact_id uuid REFERENCES source_artifacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_areas_source
  ON service_areas(source_id, active);

-- Backfill the existing pilot materialization from the newest artifact already
-- attached to each service area's collection events. This makes the transition
-- from fixture SQL to the runtime publisher explicit and reversible.
WITH latest AS (
  SELECT DISTINCT ON (ce.service_area_id)
    ce.service_area_id,
    art.source_id,
    art.id AS artifact_id
  FROM collection_events ce
  JOIN source_artifacts art ON art.id = ce.source_artifact_id
  ORDER BY ce.service_area_id, art.retrieved_at DESC, art.id DESC
)
UPDATE service_areas sa
SET source_id = latest.source_id,
    published_from_artifact_id = latest.artifact_id
FROM latest
WHERE sa.id = latest.service_area_id
  AND sa.source_id IS NULL;

-- Complete the authoritative-shaped Manowo pilot locality slice used by the
-- official 2AB schedule coverage. These SIMC identifiers are reference data,
-- not parser-generated identifiers.
INSERT INTO localities (simc, municipality_id, name)
SELECT seed.simc, m.id, seed.name
FROM municipalities m
CROSS JOIN (VALUES
  ('0308212', 'Dęborogi'),
  ('0308229', 'Policko')
) AS seed(simc, name)
WHERE m.terc = '3209042'
ON CONFLICT (simc) DO UPDATE
SET municipality_id = EXCLUDED.municipality_id,
    name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS collection_publications (
  id bigserial PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  source_artifact_id uuid NOT NULL REFERENCES source_artifacts(id) ON DELETE CASCADE,
  municipality_id uuid NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  published_at timestamptz NOT NULL DEFAULT now(),
  service_areas_added integer NOT NULL CHECK (service_areas_added >= 0),
  service_areas_removed integer NOT NULL CHECK (service_areas_removed >= 0),
  service_areas_unchanged integer NOT NULL CHECK (service_areas_unchanged >= 0),
  events_added integer NOT NULL CHECK (events_added >= 0),
  events_removed integer NOT NULL CHECK (events_removed >= 0),
  events_unchanged integer NOT NULL CHECK (events_unchanged >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  UNIQUE(source_artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_publications_source_published
  ON collection_publications(source_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_events_current_area_date
  ON collection_events(service_area_id, collection_date)
  WHERE valid_to IS NULL;

COMMENT ON COLUMN service_areas.source_id IS
  'Source that owns runtime replacement of this canonical collection service area.';
COMMENT ON COLUMN service_areas.published_from_artifact_id IS
  'Newest successfully published source artifact that defined this service area.';
COMMENT ON TABLE collection_publications IS
  'Immutable audit row for each successful canonical collection publication and its logical diff.';
