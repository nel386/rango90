-- Candidates added after migration 033 can become redundant when a
-- publishable portrait is approved later. Keep their provenance for audit,
-- but remove them from the operational review queue.
UPDATE image_assets ia
SET review_status = 'rejected',
    is_primary = FALSE,
    metadata = ia.metadata
      || jsonb_build_object(
        'rejectionReason', 'Candidato redundante: la entidad ya tiene un retrato principal publicable',
        'rejectedAt', NOW(),
        'supersededByPublishableAsset', TRUE
      )
WHERE ia.asset_kind = 'portrait'
  AND ia.review_status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM image_assets covered
    WHERE covered.entity_id = COALESCE(
            (SELECT eil.canonical_entity_id
             FROM entity_identity_links eil
             WHERE eil.source_entity_id = ia.entity_id),
            ia.entity_id
          )
      AND covered.asset_kind = 'portrait'
      AND covered.is_primary = TRUE
      AND covered.review_status = 'approved'
      AND covered.rights_basis <> 'unknown'
      AND covered.commercial_use = TRUE
      AND covered.rights_verified_at IS NOT NULL
      AND covered.rights_evidence_url IS NOT NULL
      AND jsonb_array_length(covered.usage_scope) > 0
      AND (covered.attribution_required = FALSE OR NULLIF(covered.attribution_text, '') IS NOT NULL)
  );
