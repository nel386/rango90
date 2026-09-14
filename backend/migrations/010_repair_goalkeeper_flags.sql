-- Repair a historical importer bug: category=clean_sheets used to mark every
-- row as a goalkeeper, even when a bad/old provider response contained an
-- outfield player. Rebuild the durable flag only from trusted goalkeeper
-- evidence already stored in the database.

UPDATE entities
SET is_goalkeeper = FALSE,
    updated_at = NOW()
WHERE entity_type = 'player';

UPDATE entities e
SET is_goalkeeper = TRUE,
    updated_at = NOW()
FROM ranking_entries re
JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
JOIN category_definitions c ON c.id = rs.category_id
WHERE re.entity_id = e.id
  AND c.slug = 'premier-league-clean_sheets'
  AND rs.status <> 'superseded';

UPDATE entities e
SET is_goalkeeper = TRUE,
    updated_at = NOW()
FROM entity_external_ids x
WHERE x.entity_id = e.id
  AND e.entity_type = 'player'
  AND x.source_key = 'rsssf-goalkeeper-cleansheets';

UPDATE entities e
SET is_goalkeeper = TRUE,
    updated_at = NOW()
FROM player_season_stats pss
WHERE pss.entity_id = e.id
  AND e.entity_type = 'player'
  AND UPPER(COALESCE(pss.metadata->>'position', '')) IN ('G', 'GK', 'GOALKEEPER');
