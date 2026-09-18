-- BLOQUE 26: hechos y snapshots de asistencias de Copa de Europa / Champions.
-- Aditiva: no modifica goles, Mundial, imágenes, derechos ni snapshots existentes.

CREATE TABLE IF NOT EXISTS champions_assist_facts (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES champions_editions(id),
  canonical_player_id TEXT NOT NULL REFERENCES entities(id),
  source_player_id TEXT NOT NULL,
  player_name_at_source TEXT NOT NULL,
  match_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  match_date DATE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN (
    'qualifying', 'preliminary', 'first_round', 'second_round', 'third_round',
    'intermediate', 'league_phase', 'group', 'round_of_16', 'quarter_final',
    'semi_final', 'final', 'unknown'
  )),
  assists INTEGER NOT NULL CHECK (assists > 0),
  source_key TEXT NOT NULL REFERENCES sources(key),
  source_capture_id TEXT NOT NULL REFERENCES champions_source_captures(id),
  source_record_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'primary' CHECK (source_type IN ('primary', 'contrast')),
  verification_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (verification_status IN ('confirmed', 'unresolved', 'conflict')),
  evidence JSONB NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'conflict')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_capture_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS champions_assist_facts_player_idx
  ON champions_assist_facts(canonical_player_id, edition_id);
CREATE INDEX IF NOT EXISTS champions_assist_facts_match_idx
  ON champions_assist_facts(edition_id, match_id, canonical_player_id, phase);

CREATE UNIQUE INDEX IF NOT EXISTS champions_assist_facts_event_identity_idx
  ON champions_assist_facts(source_key, edition_id, match_id, event_id, canonical_player_id);

CREATE TABLE IF NOT EXISTS champions_assist_conflicts (
  id TEXT PRIMARY KEY,
  logical_key TEXT NOT NULL,
  fact_ids TEXT[] NOT NULL,
  source_keys TEXT[] NOT NULL,
  values INTEGER[] NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'different_assist_values_for_same_match_player',
    'duplicate_source_record_with_different_value'
  )),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolution JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

COMMENT ON TABLE champions_assist_facts IS 'Append-only per-match assist facts; aggregate top lists are not authoritative facts.';
COMMENT ON TABLE champions_assist_conflicts IS 'Conflicts between assist facts are retained until explicitly resolved.';

DROP TRIGGER IF EXISTS champions_assist_facts_append_only ON champions_assist_facts;
CREATE TRIGGER champions_assist_facts_append_only
  BEFORE UPDATE OR DELETE ON champions_assist_facts
  FOR EACH ROW EXECUTE FUNCTION rango90_reject_champions_append_only_mutation();
