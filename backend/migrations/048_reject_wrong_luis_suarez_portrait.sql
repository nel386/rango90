-- The World Cup ranking entity is Luis Alberto Suárez (Uruguay, 2010–2018),
-- but this Commons file explicitly depicts Luis Suárez Miramontes (Spain,
-- Sampdoria, early 1970s). Keep the provenance and reject the false match.
UPDATE image_assets
SET review_status = 'rejected',
    is_primary = FALSE,
    rights_notes = COALESCE(rights_notes || E'\n', '')
      || 'Identidad incorrecta: la descripción de la fuente identifica a Luis Suárez Miramontes, no al jugador uruguayo del ranking mundialista.',
    metadata = metadata
      || jsonb_build_object(
        'rejectionReason', 'La imagen muestra a Luis Suárez Miramontes; el ranking corresponde a Luis Alberto Suárez de Uruguay',
        'rejectedAt', NOW(),
        'identityMismatch', TRUE,
        'verifiedAgainstRankingEvidence', 'rsssf-world-cup: Luis Alberto SUÁREZ | Uruguay'
      )
WHERE id = 'img_d2b8ade69ea44ea84bc6c040'
  AND entity_id = 'rsssf:world-cup:player:b763c36599d311b5b8cebf90'
  AND review_status = 'approved';

INSERT INTO media_rights_reviews (
  id, image_asset_id, decision, rights_basis, commercial_use,
  attribution_required, attribution_text, trademark_status, evidence_url,
  reviewer, reviewed_at, notes, usage_scope
)
SELECT
  'mrr_048_wrong_luis_suarez',
  'img_d2b8ade69ea44ea84bc6c040',
  'rejected',
  'unknown',
  FALSE,
  FALSE,
  NULL,
  'not_applicable',
  'https://commons.wikimedia.org/wiki/File:Luis_Su%C3%A1rez_Miramontes_-_UC_Sampdoria.jpg',
  'backend-data-audit',
  NOW(),
  'La descripción de Commons identifica a Luis Suárez Miramontes (España), no a Luis Alberto Suárez (Uruguay) del ranking del Mundial.',
  '[]'::jsonb
WHERE EXISTS (
  SELECT 1 FROM image_assets
  WHERE id = 'img_d2b8ade69ea44ea84bc6c040'
    AND review_status = 'rejected'
)
  AND NOT EXISTS (
    SELECT 1 FROM media_rights_reviews WHERE id = 'mrr_048_wrong_luis_suarez'
  );
