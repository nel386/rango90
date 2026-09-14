-- Close the remaining historical leakage in the game catalogue.
-- Ranking/source facts are intentionally preserved; only the audience catalogue
-- status is changed. Explicitly curated iconic profiles remain active.
BEGIN;

UPDATE entities e
SET catalog_status = 'excluded_from_game',
    updated_at = NOW(),
    metadata = e.metadata || jsonb_build_object(
      'audienceCatalogRepair', 'exclude-all-non-iconic-pre-1960-2026-09-13',
      'excludedReason', 'Jugador anterior a 1960 no marcado como excepción icónica jugable'
    )
WHERE e.entity_type = 'player'
  AND e.birth_date < DATE '1960-01-01'
  AND e.catalog_status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM entity_game_profiles egp
    WHERE egp.entity_id = e.id
      AND egp.playable_default = TRUE
      AND egp.legacy_tier = 'iconic_legacy'
      AND egp.metadata->>'curated' = 'true'
  );

COMMIT;
