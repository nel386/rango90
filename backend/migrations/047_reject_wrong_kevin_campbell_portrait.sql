-- The Commons file used for Kevin Campbell was later verified to depict
-- Kevin Jeffrey. Keep the original approval for audit, but remove it from
-- publication and record the identity correction as a new rights review.
UPDATE image_assets
SET review_status = 'rejected',
    is_primary = FALSE,
    rights_notes = COALESCE(rights_notes, '') || CASE
      WHEN COALESCE(rights_notes, '') = '' THEN '' ELSE E'\n' END ||
      'Corrección 047: la página de Commons identifica al sujeto como Kevin Jeffrey, no Kevin Campbell.',
    metadata = metadata
      || jsonb_build_object(
        'rejectionReason', 'Identidad incorrecta: Kevin Jeffrey, no Kevin Campbell',
        'rejectedAt', NOW(),
        'identityCorrection', TRUE
      )
WHERE id = 'img_3f9b72f02c6fe2d66bde9db1'
  AND entity_id = 'pl:player:25';

INSERT INTO media_rights_reviews
  (id, image_asset_id, decision, rights_basis, commercial_use,
   attribution_required, attribution_text, trademark_status, evidence_url,
   reviewer, notes, usage_scope)
VALUES
  ('mrr_047_wrong_kevin_campbell', 'img_3f9b72f02c6fe2d66bde9db1',
   'rejected', 'open_license', FALSE, FALSE, NULL, 'not_applicable',
   'https://www.wikidata.org/wiki/Q6396608', 'backend-identity-correction',
   'La evidencia identifica el archivo como Kevin Jeffrey; no corresponde a Kevin Campbell.',
   '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
