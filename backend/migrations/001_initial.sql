CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('player', 'club', 'national_team')),
  canonical_name TEXT NOT NULL,
  short_name TEXT,
  country_code CHAR(3),
  birth_date DATE,
  position TEXT,
  is_goalkeeper BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  entity_id TEXT NOT NULL REFERENCES entities(id),
  alias TEXT NOT NULL,
  source_key TEXT,
  PRIMARY KEY (entity_id, alias)
);

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code CHAR(3),
  confederation TEXT,
  competition_type TEXT NOT NULL CHECK (competition_type IN ('league', 'cup', 'continental', 'national_team', 'club_world', 'supercup', 'award')),
  is_whitelisted BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS competition_editions (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  season_label TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  source_key TEXT,
  UNIQUE (competition_id, season_label)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  competition_edition_id TEXT REFERENCES competition_editions(id),
  match_date DATE,
  home_entity_id TEXT REFERENCES entities(id),
  away_entity_id TEXT REFERENCES entities(id),
  home_score INTEGER,
  away_score INTEGER,
  status TEXT,
  source_key TEXT,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS match_player_stats (
  match_id TEXT NOT NULL REFERENCES matches(id),
  player_id TEXT NOT NULL REFERENCES entities(id),
  team_id TEXT REFERENCES entities(id),
  started BOOLEAN,
  minutes INTEGER CHECK (minutes IS NULL OR minutes >= 0),
  goals INTEGER NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists INTEGER NOT NULL DEFAULT 0 CHECK (assists >= 0),
  yellow_cards INTEGER NOT NULL DEFAULT 0 CHECK (yellow_cards >= 0),
  second_yellows INTEGER NOT NULL DEFAULT 0 CHECK (second_yellows >= 0),
  direct_red_cards INTEGER NOT NULL DEFAULT 0 CHECK (direct_red_cards >= 0),
  clean_sheet BOOLEAN,
  goals_conceded INTEGER CHECK (goals_conceded IS NULL OR goals_conceded >= 0),
  is_goalkeeper BOOLEAN NOT NULL DEFAULT FALSE,
  source_key TEXT,
  source_snapshot_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS honours (
  id TEXT PRIMARY KEY,
  competition_edition_id TEXT REFERENCES competition_editions(id),
  competition_id TEXT REFERENCES competitions(id),
  winner_entity_id TEXT NOT NULL REFERENCES entities(id),
  winner_entity_type TEXT NOT NULL CHECK (winner_entity_type IN ('player', 'club', 'national_team')),
  player_participated BOOLEAN,
  source_key TEXT NOT NULL,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  award_key TEXT NOT NULL,
  award_label TEXT NOT NULL,
  award_year INTEGER NOT NULL,
  winner_entity_id TEXT NOT NULL REFERENCES entities(id),
  source_key TEXT NOT NULL,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (award_key, award_year)
);

CREATE TABLE IF NOT EXISTS sources (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('official', 'licensed_provider', 'manual', 'reference')),
  base_url TEXT,
  usage_notes TEXT,
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown', 'review_required', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL REFERENCES sources(key),
  retrieved_at TIMESTAMPTZ NOT NULL,
  source_published_at TIMESTAMPTZ,
  content_type TEXT,
  storage_uri TEXT,
  content_sha256 TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  source_snapshot_id TEXT REFERENCES source_snapshots(id),
  status TEXT NOT NULL CHECK (status IN ('started', 'validated', 'approved', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS fact_assertions (
  id TEXT PRIMARY KEY,
  fact_type TEXT NOT NULL,
  subject_entity_id TEXT REFERENCES entities(id),
  match_id TEXT REFERENCES matches(id),
  competition_edition_id TEXT REFERENCES competition_editions(id),
  value JSONB NOT NULL,
  source_snapshot_id TEXT REFERENCES source_snapshots(id),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'conflict')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS category_definitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label_es TEXT NOT NULL,
  label_en TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('player', 'club', 'national_team')),
  metric_key TEXT NOT NULL,
  scope_kind TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  ranking_direction TEXT NOT NULL CHECK (ranking_direction IN ('desc', 'asc')),
  tie_policy TEXT NOT NULL DEFAULT 'competition',
  score_cap INTEGER NOT NULL DEFAULT 100 CHECK (score_cap > 0),
  definition_version INTEGER NOT NULL DEFAULT 1,
  definition_md TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranking_snapshots (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES category_definitions(id),
  data_version TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'superseded')),
  coverage_complete BOOLEAN NOT NULL DEFAULT FALSE,
  eligible_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_count >= 0),
  unresolved_conflicts INTEGER NOT NULL DEFAULT 0 CHECK (unresolved_conflicts >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ranking_entries (
  snapshot_id TEXT NOT NULL REFERENCES ranking_snapshots(id),
  entity_id TEXT NOT NULL REFERENCES entities(id),
  raw_value NUMERIC NOT NULL,
  rank INTEGER NOT NULL CHECK (rank > 0),
  score_value INTEGER NOT NULL CHECK (score_value >= 0),
  tie_group INTEGER NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (snapshot_id, entity_id)
);

CREATE TABLE IF NOT EXISTS image_assets (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  asset_kind TEXT NOT NULL DEFAULT 'portrait' CHECK (asset_kind IN ('portrait', 'badge')),
  source_url TEXT NOT NULL,
  local_path TEXT,
  provider TEXT NOT NULL,
  license_name TEXT,
  license_url TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_entity_idx
  ON image_assets(entity_id) WHERE is_primary = TRUE;

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  challenge_kind TEXT NOT NULL CHECK (challenge_kind IN ('daily', 'weekly', 'duel')),
  challenge_date DATE,
  category_id TEXT NOT NULL REFERENCES category_definitions(id),
  ranking_snapshot_id TEXT NOT NULL REFERENCES ranking_snapshots(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  published_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS challenge_items (
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  entity_id TEXT NOT NULL REFERENCES entities(id),
  correct_rank INTEGER NOT NULL,
  score_value INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, ordinal),
  UNIQUE (challenge_id, entity_id)
);

CREATE INDEX IF NOT EXISTS ranking_entries_rank_idx ON ranking_entries(snapshot_id, rank);
CREATE INDEX IF NOT EXISTS ranking_entries_entity_idx ON ranking_entries(entity_id);
CREATE INDEX IF NOT EXISTS match_player_stats_player_idx ON match_player_stats(player_id);
CREATE INDEX IF NOT EXISTS category_status_idx ON category_definitions(status);
CREATE INDEX IF NOT EXISTS challenge_date_idx ON challenges(challenge_date, status);
