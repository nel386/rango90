-- Pending provider candidates are not useful once the entity already has a
-- legally publishable primary portrait. Keep the rows and their source
-- metadata for audit, but remove them from operational review queues.
WITH covered AS (
  SELECT DISTINCT entity_id, asset_kind
  FROM image_assets
  WHERE asset_kind = 'portrait'
    AND is_primary = TRUE
    AND review_status = 'approved'
    AND rights_basis <> 'unknown'
    AND commercial_use = TRUE
    AND rights_verified_at IS NOT NULL
    AND rights_evidence_url IS NOT NULL
    AND jsonb_array_length(usage_scope) > 0
    AND (asset_kind <> 'badge' OR trademark_status = 'cleared')
    AND (attribution_required = FALSE OR NULLIF(attribution_text, '') IS NOT NULL)
)
UPDATE image_assets ia
SET review_status = 'rejected',
    is_primary = FALSE,
    metadata = ia.metadata
      || jsonb_build_object(
        'rejectionReason', 'Candidato redundante: la entidad ya tiene un activo principal publicable',
        'rejectedAt', NOW(),
        'supersededByPublishableAsset', TRUE
      )
FROM covered
WHERE ia.entity_id = covered.entity_id
  AND ia.asset_kind = covered.asset_kind
  AND ia.asset_kind = 'portrait'
  AND ia.review_status = 'pending';
