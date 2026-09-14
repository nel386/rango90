-- Repair the historical BDFutbol homonym collision between Dieter Müller
-- (born 1954) and Thomas Müller (born 1989).
--
-- The old consolidation used BDFutbol's short display label ("Müller") as
-- an identity key. This migration restores the two people before any new
-- ranking import is run. It is intentionally narrow and idempotent.

BEGIN;

-- Remove the incorrect redirect and restore the source entity as Dieter.
DELETE FROM entity_identity_links
WHERE source_entity_id = 'bdfutbol:bundesliga:player:4f6ee3079c9bba0390a2dc90'
  AND canonical_entity_id = 'dfb:bundesliga:player:c50065a141a513c2431d1c08';

UPDATE entities
SET canonical_name = 'Dieter Müller',
    birth_date = DATE '1954-04-01',
    metadata = metadata - 'identityStatus' - 'canonicalEntityId',
    updated_at = NOW()
WHERE id = 'bdfutbol:bundesliga:player:4f6ee3079c9bba0390a2dc90';

UPDATE entity_external_ids
SET entity_id = 'bdfutbol:bundesliga:player:4f6ee3079c9bba0390a2dc90',
    updated_at = NOW()
WHERE source_key = 'bdfutbol-bundesliga-records'
  AND entity_type = 'player'
  AND external_id = 'https://www.bdfutbol.com/en/j/j91922.html';

UPDATE ranking_entries
SET entity_id = 'bdfutbol:bundesliga:player:4f6ee3079c9bba0390a2dc90'
WHERE snapshot_id = 'rs_4b8040fef2153d2b3d5b8600'
  AND entity_id = 'dfb:bundesliga:player:c50065a141a513c2431d1c08'
  AND evidence->>'externalId' = 'https://www.bdfutbol.com/en/j/j91922.html';

UPDATE fact_assertions
SET subject_entity_id = 'bdfutbol:bundesliga:player:4f6ee3079c9bba0390a2dc90'
WHERE subject_entity_id = 'dfb:bundesliga:player:c50065a141a513c2431d1c08'
  AND source_snapshot_id = 'src_583885b4eeb9b1701f7d62a1'
  AND value->>'categorySlug' = 'bundesliga-goals'
  AND value->>'rawValue' = '177'
  AND metadata->>'sourceRank' = '9';

-- Keep the DFB entity as Thomas Müller and attach the modern BDFutbol ID.
UPDATE entities
SET canonical_name = 'Thomas Müller',
    birth_date = DATE '1989-09-13',
    metadata = metadata - 'identityStatus' - 'canonicalEntityId',
    updated_at = NOW()
WHERE id = 'dfb:bundesliga:player:c50065a141a513c2431d1c08';

-- The same evidence also supplies the missing date on the existing canonical
-- Dieter record created by the DFB catalog.
UPDATE entities
SET birth_date = COALESCE(birth_date, DATE '1954-04-01'),
    updated_at = NOW()
WHERE id = 'dfb:bundesliga:player:bf9d5a35d31276ebbee40842'
  AND canonical_name = 'Dieter Müller';

UPDATE entity_external_ids
SET entity_id = 'dfb:bundesliga:player:c50065a141a513c2431d1c08',
    updated_at = NOW()
WHERE source_key = 'bdfutbol-bundesliga-records'
  AND entity_type = 'player'
  AND external_id = 'https://www.bdfutbol.com/en/j/j92886.html';

UPDATE ranking_entries
SET entity_id = 'dfb:bundesliga:player:c50065a141a513c2431d1c08'
WHERE snapshot_id = 'rs_4b8040fef2153d2b3d5b8600'
  AND entity_id = 'bdfutbol:bundesliga:player:768e0081d1cc2231f35a3b3e'
  AND evidence->>'externalId' = 'https://www.bdfutbol.com/en/j/j92886.html';

UPDATE fact_assertions
SET subject_entity_id = 'dfb:bundesliga:player:c50065a141a513c2431d1c08'
WHERE subject_entity_id = 'bdfutbol:bundesliga:player:768e0081d1cc2231f35a3b3e'
  AND source_snapshot_id = 'src_583885b4eeb9b1701f7d62a1'
  AND value->>'categorySlug' = 'bundesliga-goals'
  AND value->>'rawValue' = '150'
  AND metadata->>'sourceRank' = '17';

INSERT INTO entity_identity_links
  (source_entity_id, canonical_entity_id, confidence, reason, source_key, source_snapshot_id)
VALUES
  (
    'bdfutbol:bundesliga:player:768e0081d1cc2231f35a3b3e',
    'dfb:bundesliga:player:c50065a141a513c2431d1c08',
    'high',
    'Coincidencia revisada por nombre completo, fecha de nacimiento 13/09/1989 e identificador BDFutbol',
    'bdfutbol-bundesliga-records',
    'src_583885b4eeb9b1701f7d62a1'
  )
ON CONFLICT (source_entity_id) DO UPDATE SET
  canonical_entity_id = EXCLUDED.canonical_entity_id,
  confidence = EXCLUDED.confidence,
  reason = EXCLUDED.reason,
  source_key = EXCLUDED.source_key,
  source_snapshot_id = EXCLUDED.source_snapshot_id,
  updated_at = NOW();

UPDATE entities
SET metadata = metadata || jsonb_build_object(
      'identityStatus', 'redirect',
      'canonicalEntityId', 'dfb:bundesliga:player:c50065a141a513c2431d1c08'
    ),
    updated_at = NOW()
WHERE id = 'bdfutbol:bundesliga:player:768e0081d1cc2231f35a3b3e';

COMMIT;
