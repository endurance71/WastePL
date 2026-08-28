-- Sprint 04 / Issue #49: persist machine-readable source assessment metadata.

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS source_shape text,
  ADD COLUMN IF NOT EXISTS evidence_status text,
  ADD COLUMN IF NOT EXISTS activation_blocker text,
  ADD COLUMN IF NOT EXISTS assessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS child_artifact_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE sources
  ADD CONSTRAINT sources_source_shape_check CHECK (
    source_shape IS NULL OR source_shape IN (
      'DIRECT_CONTENT',
      'ATTACHMENT_INDEX',
      'MULTI_ROUTE_PDF_SET',
      'IMAGE_ONLY_OR_OCR_REQUIRED',
      'MIXED_MEDIA',
      'UNSUPPORTED_OR_AMBIGUOUS'
    )
  ),
  ADD CONSTRAINT sources_evidence_status_check CHECK (
    evidence_status IS NULL OR evidence_status IN ('VERIFIED','PARTIAL','MISSING')
  ),
  ADD CONSTRAINT sources_child_artifact_urls_array_check CHECK (
    jsonb_typeof(child_artifact_urls) = 'array'
  );

CREATE INDEX IF NOT EXISTS idx_sources_assessment
  ON sources(manifest_status, source_shape, evidence_status)
  WHERE manifest_status IS NOT NULL;

COMMENT ON COLUMN sources.source_shape IS
  'Observed publication shape used to choose a deterministic adapter strategy.';
COMMENT ON COLUMN sources.evidence_status IS
  'Whether exact official parent/child source evidence has been verified for this manifest entry.';
COMMENT ON COLUMN sources.activation_blocker IS
  'Machine-readable reason a PLANNED source is not ACTIVE; null means no known assessment blocker.';
COMMENT ON COLUMN sources.child_artifact_urls IS
  'Exact official child artifact URLs discovered from an index/attachment source; never inferred by filename similarity.';
