ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS usage_scope JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE image_assets
  DROP CONSTRAINT IF EXISTS image_assets_usage_scope_array_check;

ALTER TABLE image_assets
  ADD CONSTRAINT image_assets_usage_scope_array_check
  CHECK (jsonb_typeof(usage_scope) = 'array');

ALTER TABLE media_rights_reviews
  ADD COLUMN IF NOT EXISTS usage_scope JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE media_rights_reviews
  DROP CONSTRAINT IF EXISTS media_rights_reviews_usage_scope_array_check;

ALTER TABLE media_rights_reviews
  ADD CONSTRAINT media_rights_reviews_usage_scope_array_check
  CHECK (jsonb_typeof(usage_scope) = 'array');
