BEGIN;

-- TheSportsDB's terms require the per-artwork strCreativeCommons tag to be
-- checked. Earlier approvals could carry a copied CC BY-SA label even when
-- the provider returned `No` or omitted the tag. Do not count those assets as
-- publishable until a human supplies independent rights evidence.

UPDATE image_assets
SET review_status = 'rejected',
    is_primary = FALSE,
    rights_basis = 'unknown',
    commercial_use = FALSE,
    rights_verified_at = NULL,
    rights_verified_by = NULL,
    rights_evidence_url = NULL,
    usage_scope = '[]'::jsonb,
    rights_notes = concat_ws(E'\n', NULLIF(rights_notes, ''), 'Reconciliación 062: TheSportsDB devolvió strCreativeCommons=No; el activo no puede tratarse como CC.') ,
    metadata = metadata || jsonb_build_object(
      'rightsReconciliation', 'thesportsdb-cc-tag-v1',
      'rejectionReason', 'TheSportsDB strCreativeCommons=No',
      'reconciledAt', NOW()
    )
WHERE provider = 'thesportsdb'
  AND asset_kind = 'portrait'
  AND review_status = 'approved'
  AND metadata->>'providerCreativeCommons' = 'No';

UPDATE image_assets
SET review_status = 'pending',
    is_primary = FALSE,
    rights_basis = 'unknown',
    commercial_use = FALSE,
    rights_verified_at = NULL,
    rights_verified_by = NULL,
    rights_evidence_url = NULL,
    usage_scope = '[]'::jsonb,
    rights_notes = concat_ws(E'\n', NULLIF(rights_notes, ''), 'Reconciliación 062: falta el tag strCreativeCommons de TheSportsDB; requiere revisión independiente.') ,
    metadata = metadata || jsonb_build_object(
      'rightsReconciliation', 'thesportsdb-cc-tag-v1',
      'reconciliationReason', 'TheSportsDB strCreativeCommons ausente',
      'reconciledAt', NOW()
    )
WHERE provider = 'thesportsdb'
  AND asset_kind = 'portrait'
  AND review_status = 'approved'
  AND (metadata->>'providerCreativeCommons' IS NULL OR metadata->>'providerCreativeCommons' = '');

INSERT INTO media_rights_reviews (
  id, image_asset_id, decision, rights_basis, commercial_use,
  attribution_required, attribution_text, trademark_status, evidence_url,
  reviewer, notes, usage_scope
)
SELECT 'mrr_062_' || substr(md5(ia.id), 1, 24),
       ia.id, 'rejected', 'unknown', FALSE, FALSE, NULL,
       'not_applicable',
       COALESCE(NULLIF(ia.metadata->>'licenseEvidenceUrl', ''), 'https://www.thesportsdb.com/docs_terms_of_use.php'),
       'automated-rights-reconciliation-062',
       'El tag strCreativeCommons de TheSportsDB no acredita una licencia CC compatible.',
       '[]'::jsonb
FROM image_assets ia
WHERE ia.provider = 'thesportsdb'
  AND ia.asset_kind = 'portrait'
  AND ia.metadata->>'providerCreativeCommons' = 'No'
ON CONFLICT (id) DO NOTHING;

COMMIT;
