-- Keep the licence of the normalized derivative explicit for share-alike assets.
-- This does not approve new media; it only records the obligation on assets
-- already approved by the rights ledger.
UPDATE image_assets
SET metadata = metadata || jsonb_build_object(
  'derivedLicenseName', license_name,
  'derivedLicenseUrl', license_url
)
WHERE provider = 'wikimedia-commons'
  AND asset_kind = 'portrait'
  AND review_status = 'approved'
  AND rights_basis = 'open_license'
  AND license_name ILIKE 'CC BY-SA%';
