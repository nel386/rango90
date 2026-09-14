-- API-Football uses NULL for historical seasons where the assist field was not
-- recorded. Keep that distinction from an observed zero instead of silently
-- turning missing data into a ranking value.
ALTER TABLE player_season_stats
  ALTER COLUMN assists DROP NOT NULL;

ALTER TABLE player_season_stats
  DROP CONSTRAINT IF EXISTS player_season_stats_assists_check;

ALTER TABLE player_season_stats
  ADD CONSTRAINT player_season_stats_assists_check
  CHECK (assists IS NULL OR assists >= 0);
