-- BLOQUE 19: hechos append-only para la Copa Mundial masculina (fases finales).
-- Este esquema es aditivo y solo se carga en lab/test. No reutiliza rankings agregados.

CREATE TABLE IF NOT EXISTS world_cup_source_captures (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL REFERENCES sources(key),
  captured_at TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  data_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS world_cup_editions (
  id TEXT PRIMARY KEY,
  edition_year INTEGER NOT NULL CHECK (edition_year BETWEEN 1930 AND 2100),
  edition_label TEXT NOT NULL,
  tournament_phase_scope TEXT NOT NULL DEFAULT 'final_tournament',
  is_current_edition BOOLEAN NOT NULL DEFAULT FALSE,
  scope_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (edition_year)
);

CREATE TABLE IF NOT EXISTS world_cup_goal_facts (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES world_cup_editions(id),
  canonical_player_id TEXT REFERENCES entities(id),
  source_player_id TEXT,
  player_name_at_source TEXT,
  match_id TEXT NOT NULL,
  match_date DATE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('group', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final', 'unknown')),
  goals INTEGER NOT NULL CHECK (goals > 0),
  is_own_goal BOOLEAN NOT NULL DEFAULT FALSE,
  is_shootout BOOLEAN NOT NULL DEFAULT FALSE,
  scope_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  source_key TEXT NOT NULL REFERENCES sources(key),
  source_capture_id TEXT NOT NULL REFERENCES world_cup_source_captures(id),
  source_record_id TEXT NOT NULL,
  evidence JSONB NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'conflict')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_capture_id, source_record_id),
  CHECK (is_own_goal OR canonical_player_id IS NOT NULL),
  CHECK (NOT is_shootout)
);

CREATE INDEX IF NOT EXISTS world_cup_goal_facts_player_idx
  ON world_cup_goal_facts(canonical_player_id, edition_id);
CREATE INDEX IF NOT EXISTS world_cup_goal_facts_match_idx
  ON world_cup_goal_facts(edition_id, match_id, canonical_player_id, phase);

CREATE TABLE IF NOT EXISTS world_cup_fact_conflicts (
  id TEXT PRIMARY KEY,
  logical_key TEXT NOT NULL,
  fact_ids TEXT[] NOT NULL,
  source_keys TEXT[] NOT NULL,
  values INTEGER[] NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolution JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS world_cup_ranking_snapshots (
  id TEXT PRIMARY KEY,
  category_slug TEXT NOT NULL DEFAULT 'world-cup-goals',
  scope_version TEXT NOT NULL,
  dataset TEXT NOT NULL CHECK (dataset IN ('historical_base', 'active_edition_weekly')),
  edition_start INTEGER NOT NULL,
  edition_end INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('lab_provisional', 'draft', 'published', 'superseded', 'rolled_back')),
  parent_snapshot_id TEXT REFERENCES world_cup_ranking_snapshots(id),
  rollback_of TEXT REFERENCES world_cup_ranking_snapshots(id),
  content_sha256 TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coverage_complete BOOLEAN NOT NULL DEFAULT FALSE,
  unresolved_conflicts INTEGER NOT NULL DEFAULT 0 CHECK (unresolved_conflicts >= 0),
  unresolved_identity_facts INTEGER NOT NULL DEFAULT 0 CHECK (unresolved_identity_facts >= 0),
  excluded_own_goal_facts INTEGER NOT NULL DEFAULT 0 CHECK (excluded_own_goal_facts >= 0),
  excluded_unknown_phase_facts INTEGER NOT NULL DEFAULT 0 CHECK (excluded_unknown_phase_facts >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS world_cup_ranking_entries (
  snapshot_id TEXT NOT NULL REFERENCES world_cup_ranking_snapshots(id),
  canonical_player_id TEXT NOT NULL REFERENCES entities(id),
  raw_value INTEGER NOT NULL CHECK (raw_value >= 0),
  rank INTEGER NOT NULL CHECK (rank > 0),
  tie_group INTEGER NOT NULL CHECK (tie_group > 0),
  fact_ids TEXT[] NOT NULL,
  PRIMARY KEY (snapshot_id, canonical_player_id)
);

CREATE TABLE IF NOT EXISTS world_cup_snapshot_audit (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES world_cup_ranking_snapshots(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'rollback_requested', 'publication_rejected')),
  parent_snapshot_id TEXT,
  reason TEXT NOT NULL,
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION rango90_reject_world_cup_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'World Cup histórico append-only: no se permite % en %', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS world_cup_source_captures_append_only ON world_cup_source_captures;
CREATE TRIGGER world_cup_source_captures_append_only BEFORE UPDATE OR DELETE ON world_cup_source_captures FOR EACH ROW EXECUTE FUNCTION rango90_reject_world_cup_append_only_mutation();
DROP TRIGGER IF EXISTS world_cup_goal_facts_append_only ON world_cup_goal_facts;
CREATE TRIGGER world_cup_goal_facts_append_only BEFORE UPDATE OR DELETE ON world_cup_goal_facts FOR EACH ROW EXECUTE FUNCTION rango90_reject_world_cup_append_only_mutation();
DROP TRIGGER IF EXISTS world_cup_ranking_snapshots_append_only ON world_cup_ranking_snapshots;
CREATE TRIGGER world_cup_ranking_snapshots_append_only BEFORE UPDATE OR DELETE ON world_cup_ranking_snapshots FOR EACH ROW EXECUTE FUNCTION rango90_reject_world_cup_append_only_mutation();
DROP TRIGGER IF EXISTS world_cup_ranking_entries_append_only ON world_cup_ranking_entries;
CREATE TRIGGER world_cup_ranking_entries_append_only BEFORE UPDATE OR DELETE ON world_cup_ranking_entries FOR EACH ROW EXECUTE FUNCTION rango90_reject_world_cup_append_only_mutation();

COMMENT ON TABLE world_cup_goal_facts IS 'Hechos partido/jugador de fases finales masculinas; autogoles se conservan pero no se acreditan a un jugador.';
COMMENT ON TABLE world_cup_ranking_snapshots IS 'Snapshots derivados append-only; los candidatos de lab nunca se convierten en oficiales automáticamente.';
