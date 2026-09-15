-- API-Football uses NULL when a historical card value was not recorded.
-- Preserve that distinction; an observed zero is different from unknown.
ALTER TABLE player_season_stats
  ALTER COLUMN yellow_cards DROP NOT NULL,
  ALTER COLUMN red_cards DROP NOT NULL;

ALTER TABLE player_season_stats
  ALTER COLUMN yellow_cards DROP DEFAULT,
  ALTER COLUMN red_cards DROP DEFAULT;
