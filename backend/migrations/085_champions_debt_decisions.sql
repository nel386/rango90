-- BLOQUE 15E: append-only audit trail for historical identity/phase decisions.
-- The original facts remain immutable; revisions are represented as decisions.

CREATE TABLE IF NOT EXISTS champions_debt_decisions (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL,
  debt_type TEXT NOT NULL CHECK (debt_type IN (
    'fact_without_canonical_identity', 'pending_alias', 'duplicate_player',
    'missing_external_id', 'unknown_phase', 'phase_incompatible_with_scope',
    'phase_contrast_required', 'fact_contrast_required'
  )),
  decision TEXT NOT NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  source_key TEXT NOT NULL,
  source_capture_id TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  evidence JSONB NOT NULL,
  content_sha256 TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS champions_debt_decisions_fact_idx
  ON champions_debt_decisions (fact_id);

CREATE OR REPLACE FUNCTION reject_champions_debt_decision_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'champions_debt_decisions is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS champions_debt_decisions_no_update ON champions_debt_decisions;
CREATE TRIGGER champions_debt_decisions_no_update
  BEFORE UPDATE OR DELETE ON champions_debt_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_champions_debt_decision_mutation();
