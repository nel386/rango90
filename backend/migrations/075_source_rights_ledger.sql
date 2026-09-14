-- A source must carry explicit commercial-use evidence before it can be
-- marked approved. This prevents a status-only update from being treated as
-- a licence decision and keeps the decision auditable.
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS rights_basis TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS commercial_use BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rights_evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS rights_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rights_verified_by TEXT,
  ADD COLUMN IF NOT EXISTS rights_usage_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rights_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE sources
  DROP CONSTRAINT IF EXISTS sources_rights_basis_check;

ALTER TABLE sources
  ADD CONSTRAINT sources_rights_basis_check
  CHECK (rights_basis IN (
    'unknown', 'public_domain', 'open_license', 'direct_license',
    'provider_license', 'written_permission', 'not_applicable'
  ));

ALTER TABLE sources
  DROP CONSTRAINT IF EXISTS sources_rights_usage_scope_check;

ALTER TABLE sources
  ADD CONSTRAINT sources_rights_usage_scope_check
  CHECK (jsonb_typeof(rights_usage_scope) = 'array');

CREATE TABLE IF NOT EXISTS source_rights_reviews (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL REFERENCES sources(key) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  rights_basis TEXT NOT NULL CHECK (rights_basis IN (
    'public_domain', 'open_license', 'direct_license',
    'provider_license', 'written_permission'
  )),
  commercial_use BOOLEAN NOT NULL,
  evidence_url TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  usage_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT source_rights_reviews_usage_scope_check CHECK (jsonb_typeof(usage_scope) = 'array'),
  CONSTRAINT source_rights_reviews_evidence_url_check CHECK (evidence_url ~* '^https?://'),
  CONSTRAINT source_rights_reviews_reviewer_check CHECK (NULLIF(BTRIM(reviewer), '') IS NOT NULL)
);

ALTER TABLE source_rights_reviews
  DROP CONSTRAINT IF EXISTS source_rights_reviews_usage_scope_check,
  DROP CONSTRAINT IF EXISTS source_rights_reviews_evidence_url_check,
  DROP CONSTRAINT IF EXISTS source_rights_reviews_reviewer_check;

ALTER TABLE source_rights_reviews
  ADD CONSTRAINT source_rights_reviews_usage_scope_check
    CHECK (jsonb_typeof(usage_scope) = 'array'),
  ADD CONSTRAINT source_rights_reviews_evidence_url_check
    CHECK (evidence_url ~* '^https?://'),
  ADD CONSTRAINT source_rights_reviews_reviewer_check
    CHECK (NULLIF(BTRIM(reviewer), '') IS NOT NULL);

CREATE INDEX IF NOT EXISTS source_rights_reviews_source_idx
  ON source_rights_reviews(source_key, reviewed_at DESC);

-- Any historical status-only approval is downgraded before the trigger is
-- installed. Existing projects therefore need to re-record the evidence.
UPDATE sources
   SET rights_status = 'review_required'
 WHERE rights_status = 'approved'
   AND (
     rights_basis = 'unknown'
     OR commercial_use = FALSE
     OR rights_evidence_url IS NULL
     OR rights_verified_at IS NULL
     OR rights_verified_by IS NULL
     OR jsonb_array_length(rights_usage_scope) = 0
   );

CREATE OR REPLACE FUNCTION rango90_validate_approved_source_rights()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.rights_status = 'approved' THEN
    IF NEW.rights_basis IN ('unknown', 'not_applicable')
       OR NEW.commercial_use IS DISTINCT FROM TRUE
       OR NULLIF(NEW.rights_evidence_url, '') IS NULL
       OR NEW.rights_evidence_url !~* '^https?://'
       OR NEW.rights_verified_at IS NULL
       OR NULLIF(BTRIM(NEW.rights_verified_by), '') IS NULL
       OR NULLIF(BTRIM(NEW.rights_notes), '') IS NULL
       OR jsonb_typeof(NEW.rights_usage_scope) <> 'array'
       OR NOT (NEW.rights_usage_scope @> '["web", "pwa", "android", "local_storage"]'::jsonb)
       OR NOT EXISTS (
         SELECT 1
           FROM source_rights_reviews review
          WHERE review.source_key = NEW.key
            AND review.decision = 'approved'
            AND review.rights_basis = NEW.rights_basis
            AND review.commercial_use = TRUE
            AND review.evidence_url = NEW.rights_evidence_url
            AND review.reviewer = NEW.rights_verified_by
            AND review.usage_scope @> '["web", "pwa", "android", "local_storage"]'::jsonb
       )
    THEN
      RAISE EXCEPTION 'La fuente % no puede aprobarse sin evidencia comercial y revisión registrada', NEW.key;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rango90_sources_rights_approval_guard ON sources;
CREATE TRIGGER rango90_sources_rights_approval_guard
BEFORE INSERT OR UPDATE OF rights_status, rights_basis, commercial_use,
  rights_evidence_url, rights_verified_at, rights_verified_by, rights_usage_scope
ON sources
FOR EACH ROW
EXECUTE FUNCTION rango90_validate_approved_source_rights();
