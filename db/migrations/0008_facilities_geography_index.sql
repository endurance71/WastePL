-- Sprint 02 / Issue #19: support meter-based radius queries on WGS84 facilities.
-- Existing idx_facilities_geom remains the bbox index for geometry operators.

CREATE INDEX IF NOT EXISTS idx_facilities_geog
  ON facilities USING gist ((geom::geography))
  WHERE geom IS NOT NULL;

COMMENT ON INDEX idx_facilities_geog IS
  'Expression GiST index used by ST_DWithin(geom::geography, point::geography, radius_meters).';
