-- Keep historical ranking evidence, but remove non-iconic pre-1960 players from
-- the active game catalogue. The default audience policy allows only explicit
-- iconic exceptions from this generation (for example Pelé, Di Stéfano,
-- Puskás, Eusébio, Cruyff and Gerd Müller).
--
-- This is intentionally limited to profiles already reviewed as non-playable;
-- it does not infer new playable exceptions and it does not delete source or
-- ranking rows.
BEGIN;

UPDATE entities e
SET catalog_status = 'excluded_from_game',
    updated_at = NOW(),
    metadata = e.metadata || jsonb_build_object(
      'audienceCatalogRepair', 'exclude-non-iconic-pre-1960-2026-09-13',
      'excludedReason', 'Jugador histórico no icónico; se conserva solo como evidencia histórica'
    )
FROM entity_game_profiles egp
WHERE egp.entity_id = e.id
  AND e.entity_type = 'player'
  AND e.birth_date < DATE '1960-01-01'
  AND egp.playable_default = FALSE
  AND e.catalog_status = 'active';

COMMIT;
