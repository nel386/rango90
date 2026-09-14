CREATE TABLE IF NOT EXISTS player_season_stats (
  entity_id TEXT NOT NULL REFERENCES entities(id),
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  season_year INTEGER NOT NULL CHECK (season_year >= 1800 AND season_year <= 2200),
  provider_team_id INTEGER,
  team_entity_id TEXT REFERENCES entities(id),
  appearances INTEGER CHECK (appearances IS NULL OR appearances >= 0),
  minutes INTEGER CHECK (minutes IS NULL OR minutes >= 0),
  goals INTEGER NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists INTEGER DEFAULT 0 CHECK (assists IS NULL OR assists >= 0),
  yellow_cards INTEGER NOT NULL DEFAULT 0 CHECK (yellow_cards >= 0),
  red_cards INTEGER NOT NULL DEFAULT 0 CHECK (red_cards >= 0),
  clean_sheets INTEGER CHECK (clean_sheets IS NULL OR clean_sheets >= 0),
  goals_conceded INTEGER CHECK (goals_conceded IS NULL OR goals_conceded >= 0),
  source_key TEXT NOT NULL REFERENCES sources(key),
  source_snapshot_id TEXT NOT NULL REFERENCES source_snapshots(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_id, competition_id, season_year, provider_team_id)
);

CREATE INDEX IF NOT EXISTS player_season_stats_competition_idx
  ON player_season_stats(competition_id, season_year, goals DESC, assists DESC);
