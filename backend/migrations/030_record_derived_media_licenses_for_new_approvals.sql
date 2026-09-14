-- Keep the licence of every approved CC BY-SA derivative explicit.
-- New approvals record this in the CLI; this idempotent migration repairs
-- assets approved before that metadata was added.
UPDATE image_assets
SET metadata = metadata || jsonb_build_object(
  'shareAlikeAccepted', TRUE,
  'derivedLicenseName', license_name,
  'derivedLicenseUrl', license_url
)
WHERE provider = 'wikimedia-commons'
  AND asset_kind = 'portrait'
  AND review_status = 'approved'
  AND rights_basis = 'open_license'
  AND license_name ILIKE 'CC BY-SA%'
  AND (metadata->>'derivedLicenseName' IS NULL OR metadata->>'derivedLicenseUrl' IS NULL);
