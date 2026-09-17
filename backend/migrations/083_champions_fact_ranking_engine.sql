-- BLOQUE 14: append-only fact model for the Copa de Europa / Champions history.
-- This migration is additive. It does not rewrite the existing category,
-- ranking snapshots, production facts, rights or media tables.

CREATE TABLE IF NOT EXISTS champions_source_captures (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL REFERENCES sources(key),
  captured_at TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  data_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS champions_editions (
  id TEXT PRIMARY KEY,
  season_start INTEGER NOT NULL CHECK (season_start >= 1955 AND season_start <= 2100),
  season_end INTEGER NOT NULL,
  season_label TEXT NOT NULL,
  era TEXT NOT NULL CHECK (era IN ('european_cup', 'champions_league')),
  competition_name TEXT NOT NULL CHECK (competition_name IN ('Copa de Europa', 'UEFA Champions League')),
  include_qualifying BOOLEAN NOT NULL DEFAULT FALSE,
  is_current_season BOOLEAN NOT NULL DEFAULT FALSE,
  scope_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (season_start, season_end)
);

CREATE TABLE IF NOT EXISTS champions_goal_facts (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES champions_editions(id),
  canonical_player_id TEXT NOT NULL REFERENCES entities(id),
  source_player_id TEXT NOT NULL,
  player_name_at_source TEXT NOT NULL,
  match_id TEXT NOT NULL,
  match_date DATE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('qualifying', 'preliminary', 'league_phase', 'group', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'unknown')),
  goals INTEGER NOT NULL CHECK (goals > 0),
  source_key TEXT NOT NULL REFERENCES sources(key),
  source_capture_id TEXT NOT NULL REFERENCES champions_source_captures(id),
  source_record_id TEXT NOT NULL,
  evidence JSONB NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'conflict')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_capture_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS champions_goal_facts_player_idx
  ON champions_goal_facts(canonical_player_id, edition_id);
CREATE INDEX IF NOT EXISTS champions_goal_facts_match_idx
  ON champions_goal_facts(edition_id, match_id, canonical_player_id, phase);

CREATE TABLE IF NOT EXISTS champions_fact_conflicts (
  id TEXT PRIMARY KEY,
  logical_key TEXT NOT NULL,
  fact_ids TEXT[] NOT NULL,
  source_keys TEXT[] NOT NULL,
  values INTEGER[] NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('different_goal_values_for_same_match_player', 'duplicate_source_record_with_different_value')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolution JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS champions_ranking_snapshots (
  id TEXT PRIMARY KEY,
  category_slug TEXT NOT NULL DEFAULT 'uefa-champions-league-goals',
  scope_version TEXT NOT NULL,
  dataset TEXT NOT NULL CHECK (dataset IN ('historical_base', 'active_season_weekly')),
  season_start INTEGER NOT NULL,
  season_end INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('lab_provisional', 'draft', 'published', 'superseded', 'rolled_back')),
  parent_snapshot_id TEXT REFERENCES champions_ranking_snapshots(id),
  rollback_of TEXT REFERENCES champions_ranking_snapshots(id),
  content_sha256 TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coverage_complete BOOLEAN NOT NULL DEFAULT FALSE,
  unresolved_conflicts INTEGER NOT NULL DEFAULT 0 CHECK (unresolved_conflicts >= 0),
  unresolved_identity_facts INTEGER NOT NULL DEFAULT 0 CHECK (unresolved_identity_facts >= 0),
  excluded_unknown_phase_facts INTEGER NOT NULL DEFAULT 0 CHECK (excluded_unknown_phase_facts >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS champions_ranking_entries (
  snapshot_id TEXT NOT NULL REFERENCES champions_ranking_snapshots(id),
  canonical_player_id TEXT NOT NULL REFERENCES entities(id),
  raw_value INTEGER NOT NULL CHECK (raw_value >= 0),
  rank INTEGER NOT NULL CHECK (rank > 0),
  tie_group INTEGER NOT NULL CHECK (tie_group > 0),
  fact_ids TEXT[] NOT NULL,
  eras TEXT[] NOT NULL,
  PRIMARY KEY (snapshot_id, canonical_player_id)
);

CREATE TABLE IF NOT EXISTS champions_snapshot_audit (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES champions_ranking_snapshots(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'rollback_requested', 'publication_rejected')),
  parent_snapshot_id TEXT,
  reason TEXT NOT NULL,
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION rango90_reject_champions_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Champions histórico append-only: no se permite % en %', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS champions_source_captures_append_only ON champions_source_captures;
CREATE TRIGGER champions_source_captures_append_only
  BEFORE UPDATE OR DELETE ON champions_source_captures
  FOR EACH ROW EXECUTE FUNCTION rango90_reject_champions_append_only_mutation();

DROP TRIGGER IF EXISTS champions_goal_facts_append_only ON champions_goal_facts;
CREATE TRIGGER champions_goal_facts_append_only
  BEFORE UPDATE OR DELETE ON champions_goal_facts
  FOR EACH ROW EXECUTE FUNCTION rango90_reject_champions_append_only_mutation();

DROP TRIGGER IF EXISTS champions_ranking_snapshots_append_only ON champions_ranking_snapshots;
CREATE TRIGGER champions_ranking_snapshots_append_only
  BEFORE UPDATE OR DELETE ON champions_ranking_snapshots
  FOR EACH ROW EXECUTE FUNCTION rango90_reject_champions_append_only_mutation();

DROP TRIGGER IF EXISTS champions_ranking_entries_append_only ON champions_ranking_entries;
CREATE TRIGGER champions_ranking_entries_append_only
  BEFORE UPDATE OR DELETE ON champions_ranking_entries
  FOR EACH ROW EXECUTE FUNCTION rango90_reject_champions_append_only_mutation();

COMMENT ON TABLE champions_goal_facts IS 'Append-only per-goal/per-match facts; no top-200 aggregate is authoritative by itself.';
COMMENT ON TABLE champions_ranking_snapshots IS 'Immutable derived snapshots. Corrections create a new row; prior snapshots remain auditable.';
