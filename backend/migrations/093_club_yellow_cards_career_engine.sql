-- BLOQUE 45: tarjetas amarillas de clubes, carrera y temporada activa separados.

CREATE TABLE IF NOT EXISTS club_yellow_card_facts (
  id TEXT PRIMARY KEY,
  source_player_id TEXT NOT NULL,
  player_name_original TEXT NOT NULL,
  canonical_player_id TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  club_provider_id INTEGER NOT NULL,
  club_name TEXT NOT NULL,
  competition_provider_id INTEGER NOT NULL,
  competition_name TEXT NOT NULL,
  season_start INTEGER NOT NULL CHECK (season_start BETWEEN 1800 AND 2200),
  appearances INTEGER,
  minutes INTEGER,
  yellow_cards INTEGER NOT NULL CHECK (yellow_cards >= 0),
  source_key TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_page INTEGER NOT NULL CHECK (source_page > 0),
  locator TEXT NOT NULL,
  response_sha256 TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'primary' CHECK (source_type IN ('primary', 'contrast')),
  verification_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (verification_status IN ('confirmed', 'unresolved', 'conflict')),
  coverage_status TEXT NOT NULL DEFAULT 'coverage_partial' CHECK (coverage_status IN ('coverage_complete', 'coverage_partial')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, source_player_id, competition_provider_id, club_provider_id, season_start)
);

CREATE INDEX IF NOT EXISTS club_yellow_card_facts_player_idx
  ON club_yellow_card_facts(canonical_player_id, season_start, competition_provider_id);

CREATE TABLE IF NOT EXISTS club_yellow_card_ranking_snapshots (
  id TEXT PRIMARY KEY,
  ranking_type TEXT NOT NULL CHECK (ranking_type IN ('career', 'active_season', 'active_players_career')),
  season_start INTEGER NOT NULL,
  season_end INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('lab_provisional', 'draft', 'rolled_back')),
  content_sha256 TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS club_yellow_card_ranking_entries (
  snapshot_id TEXT NOT NULL REFERENCES club_yellow_card_ranking_snapshots(id),
  canonical_player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  raw_value INTEGER NOT NULL CHECK (raw_value > 0),
  rank INTEGER NOT NULL CHECK (rank > 0),
  tie_group INTEGER NOT NULL CHECK (tie_group > 0),
  seasons INTEGER[] NOT NULL DEFAULT '{}',
  competitions INTEGER[] NOT NULL DEFAULT '{}',
  fact_ids TEXT[] NOT NULL DEFAULT '{}',
  is_current_player BOOLEAN NOT NULL DEFAULT FALSE,
  coverage_status TEXT NOT NULL CHECK (coverage_status IN ('coverage_complete', 'coverage_partial')),
  PRIMARY KEY (snapshot_id, canonical_player_id)
);

CREATE TABLE IF NOT EXISTS club_yellow_card_snapshot_audit (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES club_yellow_card_ranking_snapshots(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'rollback_requested')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION rango90_reject_yellow_career_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'BLOQUE 45 append-only: % is not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS club_yellow_card_facts_append_only ON club_yellow_card_facts;
CREATE TRIGGER club_yellow_card_facts_append_only
  BEFORE UPDATE OR DELETE ON club_yellow_card_facts
  FOR EACH ROW EXECUTE FUNCTION rango90_reject_yellow_career_mutation();

DROP TRIGGER IF EXISTS club_yellow_card_snapshots_append_only ON club_yellow_card_ranking_snapshots;
CREATE TRIGGER club_yellow_card_snapshots_append_only
  BEFORE UPDATE OR DELETE ON club_yellow_card_ranking_snapshots
  FOR EACH ROW EXECUTE FUNCTION rango90_reject_yellow_career_mutation();

DROP TRIGGER IF EXISTS club_yellow_card_entries_append_only ON club_yellow_card_ranking_entries;
CREATE TRIGGER club_yellow_card_entries_append_only
  BEFORE UPDATE OR DELETE ON club_yellow_card_ranking_entries
  FOR EACH ROW EXECUTE FUNCTION rango90_reject_yellow_career_mutation();

COMMENT ON TABLE club_yellow_card_facts IS 'API-Football player-season club facts for yellow cards; no top-yellow-cards endpoint or national-team data.';
COMMENT ON TABLE club_yellow_card_ranking_snapshots IS 'Separate candidate snapshots for career, active season, and active-player career yellow cards.';
