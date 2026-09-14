-- Remove the two remaining 1920s players from the default game audience.
-- Their historical ranking facts and source snapshots remain available for
-- audit and future historical modes; only game eligibility is changed.
BEGIN;

UPDATE entity_game_profiles egp
SET legacy_tier = 'classic_legacy',
    playable_default = FALSE,
    reason = 'Jugador nacido antes de 1930; fuera del catálogo jugable actual',
    reviewed_at = NOW(),
    metadata = (egp.metadata - 'curated') || jsonb_build_object(
      'policy', 'modern-audience-v1',
      'historicalExclusion', TRUE,
      'exclusionBasis', 'pre_1930_audience_policy',
      'audienceCatalogRepair', 'remove-pre1930-game-exceptions-2026-09-13'
    )
FROM entities e
WHERE egp.entity_id = e.id
  AND e.entity_type = 'player'
  AND e.birth_date < DATE '1930-01-01'
  AND egp.playable_default = TRUE;

UPDATE entities e
SET catalog_status = 'excluded_from_game',
    updated_at = NOW(),
    metadata = e.metadata || jsonb_build_object(
      'audienceCatalogRepair', 'remove-pre1930-game-exceptions-2026-09-13',
      'excludedReason', 'Jugador nacido antes de 1930; fuera del catálogo jugable actual'
    )
WHERE e.entity_type = 'player'
  AND e.birth_date < DATE '1930-01-01'
  AND e.catalog_status = 'active';

COMMIT;
