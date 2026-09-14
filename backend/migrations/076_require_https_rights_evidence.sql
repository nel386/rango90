-- Rights evidence is a legal/security control, not a navigational hint.
-- Require HTTPS consistently in both the source record and its review ledger.
ALTER TABLE sources
  DROP CONSTRAINT IF EXISTS sources_rights_evidence_url_https_check;

ALTER TABLE sources
  ADD CONSTRAINT sources_rights_evidence_url_https_check
  CHECK (rights_evidence_url IS NULL OR rights_evidence_url ~* '^https://');

ALTER TABLE source_rights_reviews
  DROP CONSTRAINT IF EXISTS source_rights_reviews_evidence_url_check;

ALTER TABLE source_rights_reviews
  ADD CONSTRAINT source_rights_reviews_evidence_url_check
  CHECK (evidence_url ~* '^https://');

CREATE OR REPLACE FUNCTION rango90_validate_approved_source_rights()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.rights_status = 'approved' THEN
    IF NEW.rights_basis IN ('unknown', 'not_applicable')
       OR NEW.commercial_use IS DISTINCT FROM TRUE
       OR NULLIF(NEW.rights_evidence_url, '') IS NULL
       OR NEW.rights_evidence_url !~* '^https://'
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
      RAISE EXCEPTION 'La fuente % no puede aprobarse sin evidencia comercial HTTPS y revisión registrada', NEW.key;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
