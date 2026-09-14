ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS asset_kind TEXT NOT NULL DEFAULT 'portrait';

DO $$
BEGIN
  ALTER TABLE image_assets
    ADD CONSTRAINT image_assets_asset_kind_check CHECK (asset_kind IN ('portrait', 'badge'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
