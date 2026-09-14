-- Remove a misleading state from the review queue: an explicit
-- strCreativeCommons=No is a negative rights signal, not a pending lead.
-- The original provider evidence and local file remain available for audit.
BEGIN;

UPDATE image_assets
SET review_status = 'rejected',
    is_primary = FALSE,
    rights_basis = 'unknown',
    commercial_use = FALSE,
    rights_verified_at = NULL,
    rights_verified_by = NULL,
    rights_evidence_url = NULL,
    usage_scope = '[]'::jsonb,
    rights_notes = concat_ws(E'\n', NULLIF(rights_notes, ''),
      'Reconciliación 064: TheSportsDB devolvió strCreativeCommons=No; no es un candidato licenciable.'),
    metadata = metadata || jsonb_build_object(
      'rightsReconciliation', 'thesportsdb-cc-tag-v1',
      'rejectionReason', 'TheSportsDB strCreativeCommons=No',
      'reconciledAt', NOW()
    )
WHERE provider = 'thesportsdb'
  AND asset_kind = 'portrait'
  AND review_status = 'pending'
  AND metadata->>'providerCreativeCommons' = 'No';

INSERT INTO media_rights_reviews (
  id, image_asset_id, decision, rights_basis, commercial_use,
  attribution_required, attribution_text, trademark_status, evidence_url,
  reviewer, notes, usage_scope
)
SELECT 'mrr_064_' || substr(md5(ia.id), 1, 24),
       ia.id, 'rejected', 'unknown', FALSE, FALSE, NULL,
       'not_applicable',
       COALESCE(NULLIF(ia.metadata->>'licenseEvidenceUrl', ''), ia.source_url),
       'automated-rights-reconciliation-064',
       'El proveedor devuelve strCreativeCommons=No.',
       '[]'::jsonb
FROM image_assets ia
WHERE ia.provider = 'thesportsdb'
  AND ia.asset_kind = 'portrait'
  AND ia.review_status = 'rejected'
  AND ia.metadata->>'providerCreativeCommons' = 'No'
  AND ia.metadata->>'rightsReconciliation' = 'thesportsdb-cc-tag-v1'
  AND NOT EXISTS (
    SELECT 1 FROM media_rights_reviews existing
    WHERE existing.image_asset_id = ia.id
      AND existing.decision = 'rejected'
      AND existing.reviewer IN ('automated-rights-reconciliation-062', 'automated-rights-reconciliation-064')
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
