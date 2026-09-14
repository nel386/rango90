-- The selected daily matrix contains all-time player categories. Admit only
-- canonical player entities present in those five top-200 snapshots to the
-- game audience, including historical players that the modern-audience policy
-- would otherwise exclude. This does not approve statistical rights or media.
BEGIN;

WITH selected_entities AS (
  SELECT DISTINCT COALESCE(identity_link.canonical_entity_id, re.entity_id) AS entity_id
  FROM ranking_entries re
  JOIN ranking_snapshots rs
    ON rs.id = re.snapshot_id
   AND rs.status <> 'superseded'
  JOIN category_definitions c
    ON c.id = rs.category_id
   AND c.entity_type = 'player'
   AND c.status <> 'retired'
   AND c.slug IN (
     'club-career-yellow-cards',
     'club-career-red-cards',
     'club-career-titles',
     'world-cup-goals',
     'player-career-goals'
   )
  LEFT JOIN entity_identity_links identity_link
    ON identity_link.source_entity_id = re.entity_id
  JOIN entities e
    ON e.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
   AND e.entity_type = 'player'
  WHERE re.rank <= 200
)
UPDATE entities e
   SET catalog_status = 'active',
       metadata = e.metadata || jsonb_build_object(
         'selectedHistoricalMatrix', TRUE,
         'selectedHistoricalMatrixMigration', '078'
       ),
       updated_at = NOW()
  FROM selected_entities selected
 WHERE e.id = selected.entity_id
   AND e.catalog_status <> 'active';

WITH selected_entities AS (
  SELECT COALESCE(identity_link.canonical_entity_id, re.entity_id) AS entity_id,
         ARRAY_AGG(DISTINCT c.slug ORDER BY c.slug) AS category_slugs
  FROM ranking_entries re
  JOIN ranking_snapshots rs
    ON rs.id = re.snapshot_id
   AND rs.status <> 'superseded'
  JOIN category_definitions c
    ON c.id = rs.category_id
   AND c.entity_type = 'player'
   AND c.status <> 'retired'
   AND c.slug IN (
     'club-career-yellow-cards',
     'club-career-red-cards',
     'club-career-titles',
     'world-cup-goals',
     'player-career-goals'
   )
  LEFT JOIN entity_identity_links identity_link
    ON identity_link.source_entity_id = re.entity_id
  JOIN entities e
    ON e.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
   AND e.entity_type = 'player'
  WHERE re.rank <= 200
  GROUP BY COALESCE(identity_link.canonical_entity_id, re.entity_id)
)
INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
SELECT selected.entity_id,
       'iconic_legacy',
       TRUE,
       'Jugador histórico presente en el top-200 de la matriz diaria elegida',
       jsonb_build_object(
         'policy', 'modern-audience-v1',
         'curated', TRUE,
         'selectedHistoricalMatrix', TRUE,
         'selectedMatrixCategories', selected.category_slugs,
         'requiresOpenDataRights', TRUE
       )
  FROM selected_entities selected
ON CONFLICT (entity_id) DO UPDATE SET
  legacy_tier = 'iconic_legacy',
  playable_default = TRUE,
  reason = EXCLUDED.reason,
  reviewed_at = NOW(),
  metadata = entity_game_profiles.metadata || EXCLUDED.metadata;

COMMIT;
