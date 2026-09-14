-- Make the legal status of an image explicit instead of inferring it from
-- provider/review_status. Existing assets remain usable as candidates, but
-- they must be reviewed again before a future snapshot can be published.
ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS rights_basis TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS commercial_use BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attribution_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attribution_text TEXT,
  ADD COLUMN IF NOT EXISTS rights_evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS rights_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rights_verified_by TEXT,
  ADD COLUMN IF NOT EXISTS rights_notes TEXT,
  ADD COLUMN IF NOT EXISTS trademark_status TEXT NOT NULL DEFAULT 'not_applicable';

ALTER TABLE image_assets
  DROP CONSTRAINT IF EXISTS image_assets_rights_basis_check;

ALTER TABLE image_assets
  ADD CONSTRAINT image_assets_rights_basis_check
  CHECK (rights_basis IN (
    'unknown', 'public_domain', 'open_license', 'direct_license',
    'provider_license', 'written_permission', 'not_applicable'
  ));

ALTER TABLE image_assets
  DROP CONSTRAINT IF EXISTS image_assets_trademark_status_check;

ALTER TABLE image_assets
  ADD CONSTRAINT image_assets_trademark_status_check
  CHECK (trademark_status IN ('not_applicable', 'review_required', 'cleared', 'rejected'));

CREATE TABLE IF NOT EXISTS media_rights_reviews (
  id TEXT PRIMARY KEY,
  image_asset_id TEXT NOT NULL REFERENCES image_assets(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  rights_basis TEXT NOT NULL,
  commercial_use BOOLEAN NOT NULL,
  attribution_required BOOLEAN NOT NULL,
  attribution_text TEXT,
  trademark_status TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS media_rights_reviews_asset_idx
  ON media_rights_reviews(image_asset_id, reviewed_at DESC);

-- These are club marks found on a reference repository. Copyright metadata
-- alone does not clear the club's trademark/design rights, so they return to
-- the review queue. National-team flags are intentionally left untouched.
UPDATE image_assets ia
SET review_status = 'pending',
    is_primary = FALSE,
    trademark_status = 'review_required',
    rights_notes = COALESCE(rights_notes, '') || CASE
      WHEN COALESCE(rights_notes, '') = '' THEN '' ELSE E'\n' END ||
      'Revisión 026: un escudo de club de Commons no se considera autorizado solo por su licencia de archivo.'
FROM entities e
WHERE ia.entity_id = e.id
  AND ia.asset_kind = 'badge'
  AND ia.provider = 'wikimedia-commons'
  AND e.entity_type = 'club'
  AND ia.review_status = 'approved';
