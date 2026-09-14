-- Keep one record for the same source file attached to the same entity.
-- Repeated imports used to create the same Commons asset more than once
-- (for example Sergio Ramos' 2021 interview file). Preserve the primary
-- approved row when there is one; otherwise keep the first deterministic row
-- and mark the rest as historical duplicates instead of deleting audit data.
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY entity_id, asset_kind, source_url
           ORDER BY is_primary DESC,
                    (review_status = 'approved') DESC,
                    id
         ) AS duplicate_rank
  FROM image_assets
)
UPDATE image_assets ia
SET review_status = 'rejected',
    is_primary = FALSE,
    metadata = ia.metadata
      || jsonb_build_object(
        'rejectionReason', 'Duplicado exacto: misma fuente ya registrada para la entidad',
        'rejectedAt', NOW(),
        'duplicateSource', TRUE
      )
FROM duplicates d
WHERE ia.id = d.id
  AND d.duplicate_rank > 1;
