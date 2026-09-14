-- BDFutbol's j5684 is Roberto Rodríguez Aguirre ("Rodri"), a goalkeeper
-- born in 1942. A short-name consolidation incorrectly attached that record
-- to Rodri Hernández Cascante (born 1996). Restore the source identity and
-- move only the rows carrying the exact BDFutbol URL back to it.
BEGIN;

UPDATE entities
SET canonical_name = 'Roberto Rodríguez Aguirre',
    birth_date = DATE '1942-11-14',
    position = 'G',
    is_goalkeeper = TRUE,
    metadata = (metadata - 'identityStatus' - 'canonicalEntityId')
      || jsonb_build_object('identityRepair', 'bdfutbol-j5684-rodri-short-name-collision-2026-09-10'),
    updated_at = NOW()
WHERE id = 'bdfutbol:la-liga:player:959417d1fbcb13bba9cd81cf';

UPDATE entities
SET position = 'M',
    is_goalkeeper = FALSE,
    updated_at = NOW()
WHERE id = 'pl:player:16286';

DELETE FROM entity_identity_links
WHERE source_entity_id = 'bdfutbol:la-liga:player:959417d1fbcb13bba9cd81cf'
  AND canonical_entity_id = 'pl:player:16286';

UPDATE entity_external_ids
SET entity_id = 'bdfutbol:la-liga:player:959417d1fbcb13bba9cd81cf',
    updated_at = NOW()
WHERE source_key = 'bdfutbol-la-liga-records'
  AND entity_type = 'player'
  AND external_id = 'https://www.bdfutbol.com/en/j/j5684.html';

UPDATE ranking_entries
SET entity_id = 'bdfutbol:la-liga:player:959417d1fbcb13bba9cd81cf'
WHERE evidence->>'externalId' = 'https://www.bdfutbol.com/en/j/j5684.html';

-- The Commons file is also a short-name false match: its own description
-- identifies Rodrigo Ríos Lozano, not either of the two Rodri records above.
UPDATE image_assets
SET review_status = 'rejected',
    is_primary = FALSE,
    rights_notes = COALESCE(rights_notes || E'\n', '')
      || 'Identidad incorrecta: la descripción de la fuente identifica a Rodrigo Ríos Lozano, no a Rodri Hernández ni a Roberto Rodríguez Aguirre.',
    metadata = metadata
      || jsonb_build_object(
        'rejectionReason', 'La imagen muestra a Rodrigo Ríos Lozano; no corresponde al Rodri del catálogo',
        'rejectedAt', NOW(),
        'identityMismatch', TRUE,
        'verifiedAgainstBdfutbolEvidence', 'j5684 = Roberto Rodríguez Aguirre (Rodri), nacido en 1942'
      )
WHERE id = 'img_ba059841ecc9824d78a7e3a2'
  AND entity_id = 'pl:player:16286'
  AND review_status = 'approved';

INSERT INTO media_rights_reviews (
  id, image_asset_id, decision, rights_basis, commercial_use,
  attribution_required, attribution_text, trademark_status, evidence_url,
  reviewer, reviewed_at, notes, usage_scope
)
SELECT
  'mrr_049_wrong_rodri',
  'img_ba059841ecc9824d78a7e3a2',
  'rejected',
  'unknown',
  FALSE,
  FALSE,
  NULL,
  'not_applicable',
  'https://commons.wikimedia.org/wiki/File:Rodrigo_Rios_Lozano_6833.jpg',
  'backend-data-audit',
  NOW(),
  'La descripción de Commons identifica a Rodrigo Ríos Lozano; la entidad era Rodri Hernández y el registro BDFutbol j5684 es Roberto Rodríguez Aguirre.',
  '[]'::jsonb
WHERE EXISTS (
  SELECT 1 FROM image_assets
  WHERE id = 'img_ba059841ecc9824d78a7e3a2'
    AND review_status = 'rejected'
)
  AND NOT EXISTS (
    SELECT 1 FROM media_rights_reviews WHERE id = 'mrr_049_wrong_rodri'
  );

COMMIT;
