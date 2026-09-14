-- Simplify the player catalogue around global career metrics.
-- Historical source snapshots and ranking snapshots are deliberately kept;
-- only the game-facing category definitions are retired.
BEGIN;

UPDATE category_definitions
SET status = 'retired'
WHERE entity_type = 'player'
  AND (
    slug LIKE '%-player-titles'
    OR slug IN (
      'fa-cup-goals', 'fa-cup-assists', 'fa-cup-yellow_cards', 'fa-cup-red_cards', 'fa-cup-clean_sheets',
      'copa-del-rey-goals', 'copa-del-rey-assists', 'copa-del-rey-yellow_cards', 'copa-del-rey-red_cards', 'copa-del-rey-clean_sheets',
      'coppa-italia-goals', 'coppa-italia-assists', 'coppa-italia-yellow_cards', 'coppa-italia-red_cards', 'coppa-italia-clean_sheets',
      'dfb-pokal-goals', 'dfb-pokal-assists', 'dfb-pokal-yellow_cards', 'dfb-pokal-red_cards', 'dfb-pokal-clean_sheets',
      'coupe-de-france-goals', 'coupe-de-france-assists', 'coupe-de-france-yellow_cards', 'coupe-de-france-red_cards', 'coupe-de-france-clean_sheets',
      'taca-portugal-goals', 'taca-portugal-assists', 'taca-portugal-yellow_cards', 'taca-portugal-red_cards', 'taca-portugal-clean_sheets',
      'community-shield-goals', 'community-shield-assists', 'community-shield-yellow_cards', 'community-shield-red_cards', 'community-shield-clean_sheets',
      'supercopa-espana-goals', 'supercopa-espana-assists', 'supercopa-espana-yellow_cards', 'supercopa-espana-red_cards', 'supercopa-espana-clean_sheets',
      'supercoppa-italiana-goals', 'supercoppa-italiana-assists', 'supercoppa-italiana-yellow_cards', 'supercoppa-italiana-red_cards', 'supercoppa-italiana-clean_sheets',
      'dfl-supercup-goals', 'dfl-supercup-assists', 'dfl-supercup-yellow_cards', 'dfl-supercup-red_cards', 'dfl-supercup-clean_sheets',
      'trophee-champions-goals', 'trophee-champions-assists', 'trophee-champions-yellow_cards', 'trophee-champions-red_cards', 'trophee-champions-clean_sheets',
      'supertaca-portugal-goals', 'supertaca-portugal-assists', 'supertaca-portugal-yellow_cards', 'supertaca-portugal-red_cards', 'supertaca-portugal-clean_sheets',
      'recopa-sudamericana-goals', 'recopa-sudamericana-assists', 'recopa-sudamericana-yellow_cards', 'recopa-sudamericana-red_cards', 'recopa-sudamericana-clean_sheets'
    )
  );

UPDATE category_definitions
SET status = 'retired'
WHERE slug = 'recopa-sudamericana-club-titles';

COMMIT;
