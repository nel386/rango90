-- Reuse the exact player name returned alongside a stable TheSportsDB ID.
-- These aliases improve later Commons searches for UEFA's abbreviated display
-- names. The image remains pending and the provider is not treated as a
-- licence grant; this migration only records identity evidence.
INSERT INTO entity_aliases (entity_id, alias, source_key)
SELECT DISTINCT ia.entity_id,
       NULLIF(BTRIM(ia.metadata ->> 'playerName'), ''),
       'thesportsdb-artwork'
FROM image_assets ia
JOIN entities e ON e.id = ia.entity_id AND e.entity_type = 'player'
WHERE ia.provider = 'thesportsdb'
  AND ia.asset_kind = 'portrait'
  AND NULLIF(BTRIM(ia.metadata ->> 'playerName'), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM entity_aliases existing
    WHERE existing.entity_id = ia.entity_id
      AND existing.alias = NULLIF(BTRIM(ia.metadata ->> 'playerName'), '')
  )
ON CONFLICT (entity_id, alias) DO NOTHING;
