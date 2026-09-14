-- Admit every modern player with a verified birth date that appears in the
-- top-200 of an active player category. This makes the playable cohort match
-- the game's 200-entry category contract instead of silently using a small
-- hand-curated subset. Historical players, missing dates and manual audience
-- exclusions remain outside the default pool.
BEGIN;

WITH ranked_modern AS (
  SELECT COALESCE(identity_link.canonical_entity_id, re.entity_id) AS entity_id,
         MIN(re.rank)::int AS best_rank,
         COUNT(DISTINCT c.id)::int AS category_count,
         ARRAY_AGG(DISTINCT c.slug ORDER BY c.slug) AS category_slugs
    FROM ranking_entries re
    JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
    JOIN category_definitions c ON c.id = rs.category_id AND c.status <> 'retired'
    LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = re.entity_id
    JOIN entities canonical_entity
      ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
     AND canonical_entity.entity_type = 'player'
   WHERE re.rank <= 200
     AND canonical_entity.birth_date >= DATE '1960-01-01'
     AND canonical_entity.catalog_status = 'active'
   GROUP BY COALESCE(identity_link.canonical_entity_id, re.entity_id)
)
INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
SELECT entity_id,
       'modern',
       TRUE,
       'Jugador moderno presente en el top-200 de una categoría activa',
       jsonb_build_object(
         'policy', 'modern-audience-v1',
         'modernTop200Admission', TRUE,
         'bestRank', best_rank,
         'activeCategoryCount', category_count,
         'activeCategories', category_slugs
       )
  FROM ranked_modern
ON CONFLICT (entity_id) DO UPDATE SET
  legacy_tier = CASE
    WHEN entity_game_profiles.metadata->>'curated' = 'true'
         AND entity_game_profiles.playable_default THEN entity_game_profiles.legacy_tier
    WHEN entity_game_profiles.metadata->>'historicalExclusion' = 'true' THEN entity_game_profiles.legacy_tier
    ELSE EXCLUDED.legacy_tier
  END,
  playable_default = CASE
    WHEN entity_game_profiles.metadata->>'historicalExclusion' = 'true' THEN entity_game_profiles.playable_default
    ELSE EXCLUDED.playable_default
  END,
  reason = CASE
    WHEN entity_game_profiles.metadata->>'historicalExclusion' = 'true' THEN entity_game_profiles.reason
    ELSE EXCLUDED.reason
  END,
  reviewed_at = NOW(),
  metadata = entity_game_profiles.metadata || EXCLUDED.metadata;

COMMIT;
