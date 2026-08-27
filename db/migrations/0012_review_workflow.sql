-- Sprint 03 / Issue #31: internal data-ops review workflow.
-- Reconciliation candidates stay in facility_reconciliation_reviews; data-quality
-- issues that do not have a canonical candidate (for example missing trusted
-- geometry) get their own queue. Decisions are append-only in review_decision_audit.

CREATE TABLE facility_data_quality_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assertion_id uuid NOT NULL REFERENCES facility_source_assertions(id) ON DELETE CASCADE,
  review_type text NOT NULL CHECK (review_type IN (
    'MISSING_TRUSTED_GEOMETRY', 'LOW_CONFIDENCE', 'PARSE_DATA_QUALITY'
  )),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  state text NOT NULL DEFAULT 'PENDING'
    CHECK (state IN ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text,
  UNIQUE (assertion_id, review_type)
);

CREATE INDEX idx_facility_data_quality_reviews_pending
  ON facility_data_quality_reviews(state, created_at)
  WHERE state = 'PENDING';

CREATE TABLE review_decision_audit (
  id bigserial PRIMARY KEY,
  review_kind text NOT NULL CHECK (review_kind IN ('RECONCILIATION','DATA_QUALITY')),
  review_id uuid NOT NULL,
  actor text NOT NULL CHECK (length(trim(actor)) > 0),
  decision text NOT NULL CHECK (decision IN ('APPROVE','REJECT')),
  note text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE INDEX idx_review_decision_audit_review
  ON review_decision_audit(review_kind, review_id, decided_at DESC);
CREATE INDEX idx_review_decision_audit_actor
  ON review_decision_audit(actor, decided_at DESC);

COMMENT ON TABLE facility_data_quality_reviews IS
  'Internal review queue for source-backed facility quality problems that are not candidate identity matches.';
COMMENT ON TABLE review_decision_audit IS
  'Append-only audit trail for all explicit data-ops review decisions.';
