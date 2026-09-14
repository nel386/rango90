-- A missing birth date is a provisional audience exclusion, not a manual
-- decision. Once a modern player has a verified date and remains in an active
-- top-200 player ranking, allow the game-audience seed to admit that player.
-- Historical/manual exclusions remain untouched.
BEGIN;

WITH active_top200_modern AS (
  SELECT DISTINCT COALESCE(link.canonical_entity_id, re.entity_id) AS entity_id
  FROM ranking_entries re
  JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
  JOIN category_definitions c ON c.id = rs.category_id AND c.status <> 'retired'
  LEFT JOIN entity_identity_links link ON link.source_entity_id = re.entity_id
  JOIN entities e ON e.id = COALESCE(link.canonical_entity_id, re.entity_id)
  WHERE re.rank <= 200
    AND e.entity_type = 'player'
    AND e.catalog_status = 'active'
    AND e.birth_date >= DATE '1960-01-01'
)
UPDATE entity_game_profiles egp
SET legacy_tier = 'modern',
    playable_default = TRUE,
    reason = 'Jugador moderno presente en el top-200 de una categoría activa; fecha verificada',
    reviewed_at = NOW(),
    metadata = egp.metadata || jsonb_build_object(
      'automaticExclusionCleared', 'missing_birth_date',
      'modernTop200Admission', TRUE,
      'policy', 'modern-audience-v1'
    )
FROM entities e
JOIN active_top200_modern modern ON modern.entity_id = e.id
WHERE egp.entity_id = e.id
  AND e.entity_type = 'player'
  AND e.catalog_status = 'active'
  AND e.birth_date >= DATE '1960-01-01'
  AND egp.playable_default = FALSE
  AND egp.metadata->>'exclusionBasis' = 'missing_birth_date';

COMMIT;
