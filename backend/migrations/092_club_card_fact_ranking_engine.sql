-- BLOQUE 31: tarjetas de clubes, separadas por métrica y append-only.

CREATE TABLE IF NOT EXISTS club_card_source_captures (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL REFERENCES sources(key),
  captured_at TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  data_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS club_card_competitions (
  id TEXT PRIMARY KEY,
  provider_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  competition_type TEXT NOT NULL CHECK (competition_type = 'club'),
  scope_status TEXT NOT NULL DEFAULT 'observed' CHECK (scope_status IN ('observed', 'excluded', 'unavailable')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS club_card_facts (
  id TEXT PRIMARY KEY,
  canonical_player_id TEXT REFERENCES entities(id),
  source_player_id TEXT NOT NULL,
  player_name_at_source TEXT NOT NULL,
  club_provider_id INTEGER NOT NULL,
  club_name_at_source TEXT NOT NULL,
  competition_id TEXT NOT NULL REFERENCES club_card_competitions(id),
  season_start INTEGER NOT NULL CHECK (season_start BETWEEN 1800 AND 2200),
  season_label TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('season_stat', 'match_event')),
  match_id TEXT,
  match_date DATE,
  match_type TEXT NOT NULL CHECK (match_type IN ('official_competition', 'friendly', 'youth', 'reserve', 'testimonial', 'national_team', 'unknown')),
  yellow_cards INTEGER CHECK (yellow_cards IS NULL OR yellow_cards >= 0),
  red_cards INTEGER CHECK (red_cards IS NULL OR red_cards >= 0),
  red_second_yellow INTEGER CHECK (red_second_yellow IS NULL OR red_second_yellow >= 0),
  red_direct INTEGER CHECK (red_direct IS NULL OR red_direct >= 0),
  source_key TEXT NOT NULL REFERENCES sources(key),
  source_capture_id TEXT NOT NULL REFERENCES club_card_source_captures(id),
  source_record_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'primary' CHECK (source_type IN ('primary', 'contrast')),
  verification_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (verification_status IN ('confirmed', 'unresolved', 'conflict')),
  scope_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  evidence JSONB NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_capture_id, source_record_id),
  CHECK (match_type = 'official_competition'),
  CHECK (canonical_player_id IS NOT NULL OR verification_status = 'unresolved'),
  CHECK (yellow_cards IS NOT NULL OR red_cards IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS club_card_facts_player_idx ON club_card_facts(canonical_player_id, competition_id, season_start);
CREATE INDEX IF NOT EXISTS club_card_facts_scope_idx ON club_card_facts(competition_id, season_start, scope_eligible, verification_status);
CREATE UNIQUE INDEX IF NOT EXISTS club_card_facts_logical_idx ON club_card_facts(source_key, competition_id, season_start, source_player_id, club_provider_id, source_record_id);

CREATE TABLE IF NOT EXISTS club_card_conflicts (
  id TEXT PRIMARY KEY,
  logical_key TEXT NOT NULL,
  fact_ids TEXT[] NOT NULL,
  source_keys TEXT[] NOT NULL,
  values JSONB NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolution JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS club_card_ranking_snapshots (
  id TEXT PRIMARY KEY,
  category_slug TEXT NOT NULL CHECK (category_slug IN ('club-career-yellow-cards', 'club-career-red-cards')),
  card_kind TEXT NOT NULL CHECK (card_kind IN ('yellow', 'red')),
  scope_version TEXT NOT NULL,
  dataset TEXT NOT NULL CHECK (dataset IN ('historical_base', 'active_weekly')),
  season_start INTEGER NOT NULL,
  season_end INTEGER NOT NULL,
  competition_filter TEXT,
  status TEXT NOT NULL CHECK (status IN ('lab_provisional', 'draft', 'published', 'superseded', 'rolled_back')),
  parent_snapshot_id TEXT REFERENCES club_card_ranking_snapshots(id),
  rollback_of TEXT REFERENCES club_card_ranking_snapshots(id),
  content_sha256 TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coverage_complete BOOLEAN NOT NULL DEFAULT FALSE,
  unresolved_conflicts INTEGER NOT NULL DEFAULT 0,
  unresolved_identity_facts INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS club_card_ranking_entries (
  snapshot_id TEXT NOT NULL REFERENCES club_card_ranking_snapshots(id),
  canonical_player_id TEXT NOT NULL REFERENCES entities(id),
  raw_value INTEGER NOT NULL CHECK (raw_value > 0),
  rank INTEGER NOT NULL CHECK (rank > 0),
  tie_group INTEGER NOT NULL CHECK (tie_group > 0),
  fact_ids TEXT[] NOT NULL,
  PRIMARY KEY (snapshot_id, canonical_player_id)
);

CREATE TABLE IF NOT EXISTS club_card_snapshot_audit (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES club_card_ranking_snapshots(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'rollback_requested', 'publication_rejected')),
  parent_snapshot_id TEXT,
  reason TEXT NOT NULL,
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION rango90_reject_club_card_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Club card history is append-only: % is not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS club_card_source_captures_append_only ON club_card_source_captures;
CREATE TRIGGER club_card_source_captures_append_only BEFORE UPDATE OR DELETE ON club_card_source_captures FOR EACH ROW EXECUTE FUNCTION rango90_reject_club_card_append_only_mutation();
DROP TRIGGER IF EXISTS club_card_facts_append_only ON club_card_facts;
CREATE TRIGGER club_card_facts_append_only BEFORE UPDATE OR DELETE ON club_card_facts FOR EACH ROW EXECUTE FUNCTION rango90_reject_club_card_append_only_mutation();
DROP TRIGGER IF EXISTS club_card_ranking_snapshots_append_only ON club_card_ranking_snapshots;
CREATE TRIGGER club_card_ranking_snapshots_append_only BEFORE UPDATE OR DELETE ON club_card_ranking_snapshots FOR EACH ROW EXECUTE FUNCTION rango90_reject_club_card_append_only_mutation();
DROP TRIGGER IF EXISTS club_card_ranking_entries_append_only ON club_card_ranking_entries;
CREATE TRIGGER club_card_ranking_entries_append_only BEFORE UPDATE OR DELETE ON club_card_ranking_entries FOR EACH ROW EXECUTE FUNCTION rango90_reject_club_card_append_only_mutation();

COMMENT ON TABLE club_card_facts IS 'Club competition card facts from explicit provider season records; national teams and non-official matches are excluded.';
COMMENT ON TABLE club_card_ranking_snapshots IS 'Candidate weekly snapshots for observed club-card scope; never official automatically.';
