-- Phase 3: online game contract. The existing challenges table remains the
-- historical/single-category challenge source; these tables model a complete
-- multi-category published game and its runtime state separately.

CREATE TABLE IF NOT EXISTS game_challenges (
  id TEXT PRIMARY KEY,
  challenge_kind TEXT NOT NULL CHECK (challenge_kind IN ('daily', 'weekly', 'duel')),
  challenge_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  source_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  time_limit_seconds INTEGER NOT NULL CHECK (time_limit_seconds > 0),
  score_cap INTEGER NOT NULL CHECK (score_cap > 0),
  challenge_sha256 TEXT NOT NULL CHECK (challenge_sha256 ~ '^[0-9a-f]{64}$'),
  published_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status = 'published' AND published_at IS NOT NULL) OR status <> 'published'),
  CHECK (challenge_kind <> 'daily' OR challenge_date IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS game_challenges_one_published_daily_idx
  ON game_challenges (challenge_date)
  WHERE challenge_kind = 'daily' AND status = 'published';

CREATE INDEX IF NOT EXISTS game_challenges_published_lookup_idx
  ON game_challenges (status, challenge_kind, challenge_date DESC);

CREATE TABLE IF NOT EXISTS game_challenge_categories (
  game_challenge_id TEXT NOT NULL REFERENCES game_challenges(id) ON DELETE RESTRICT,
  category_id TEXT NOT NULL REFERENCES category_definitions(id) ON DELETE RESTRICT,
  category_ordinal INTEGER NOT NULL CHECK (category_ordinal >= 0),
  ranking_snapshot_id TEXT NOT NULL REFERENCES ranking_snapshots(id) ON DELETE RESTRICT,
  PRIMARY KEY (game_challenge_id, category_id),
  UNIQUE (game_challenge_id, category_ordinal)
);

CREATE INDEX IF NOT EXISTS game_challenge_categories_snapshot_idx
  ON game_challenge_categories (ranking_snapshot_id);

CREATE OR REPLACE FUNCTION rango90_validate_game_category_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  snapshot_category_id TEXT;
BEGIN
  SELECT category_id INTO snapshot_category_id
    FROM ranking_snapshots WHERE id = NEW.ranking_snapshot_id;
  IF snapshot_category_id IS NULL OR snapshot_category_id <> NEW.category_id THEN
    RAISE EXCEPTION 'game challenge category must use a snapshot of the same category' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_challenge_category_source_trigger ON game_challenge_categories;
CREATE TRIGGER game_challenge_category_source_trigger
  BEFORE INSERT OR UPDATE ON game_challenge_categories
  FOR EACH ROW EXECUTE FUNCTION rango90_validate_game_category_source();

CREATE TABLE IF NOT EXISTS game_challenge_decisions (
  game_challenge_id TEXT NOT NULL REFERENCES game_challenges(id) ON DELETE RESTRICT,
  decision_ordinal INTEGER NOT NULL CHECK (decision_ordinal >= 0),
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
  PRIMARY KEY (game_challenge_id, decision_ordinal),
  UNIQUE (game_challenge_id, entity_id)
);

CREATE INDEX IF NOT EXISTS game_challenge_decisions_entity_idx
  ON game_challenge_decisions (entity_id);

CREATE TABLE IF NOT EXISTS game_challenge_answers (
  game_challenge_id TEXT NOT NULL,
  decision_ordinal INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  score_value INTEGER NOT NULL CHECK (score_value > 0),
  PRIMARY KEY (game_challenge_id, decision_ordinal, category_id),
  FOREIGN KEY (game_challenge_id, decision_ordinal)
    REFERENCES game_challenge_decisions(game_challenge_id, decision_ordinal) ON DELETE RESTRICT,
  FOREIGN KEY (game_challenge_id, category_id)
    REFERENCES game_challenge_categories(game_challenge_id, category_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS game_challenge_answers_category_idx
  ON game_challenge_answers (game_challenge_id, category_id);

CREATE OR REPLACE FUNCTION rango90_check_game_answer_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cap INTEGER;
BEGIN
  SELECT score_cap INTO cap FROM game_challenges WHERE id = NEW.game_challenge_id;
  IF cap IS NULL OR NEW.score_value > cap THEN
    RAISE EXCEPTION 'game answer score exceeds challenge cap' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_answer_score_cap_trigger ON game_challenge_answers;
CREATE TRIGGER game_answer_score_cap_trigger
  BEFORE INSERT OR UPDATE ON game_challenge_answers
  FOR EACH ROW EXECUTE FUNCTION rango90_check_game_answer_score();

CREATE OR REPLACE FUNCTION rango90_validate_published_game_challenge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  category_count INTEGER;
  decision_count INTEGER;
  answer_count INTEGER;
  expected_answer_count INTEGER;
  unpublished_snapshots INTEGER;
  unpublished_categories INTEGER;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO category_count FROM game_challenge_categories WHERE game_challenge_id = NEW.id;
  SELECT COUNT(*) INTO decision_count FROM game_challenge_decisions WHERE game_challenge_id = NEW.id;
  SELECT COUNT(*) INTO answer_count FROM game_challenge_answers WHERE game_challenge_id = NEW.id;
  expected_answer_count := category_count * decision_count;
  IF category_count = 0 OR category_count <> decision_count OR answer_count <> expected_answer_count THEN
    RAISE EXCEPTION 'published game challenge must have a complete square answer matrix' USING ERRCODE = '23514';
  END IF;
  SELECT COUNT(*) INTO unpublished_snapshots
    FROM game_challenge_categories gcc
    JOIN ranking_snapshots rs ON rs.id = gcc.ranking_snapshot_id
   WHERE gcc.game_challenge_id = NEW.id AND rs.status <> 'published';
  IF unpublished_snapshots > 0 THEN
    RAISE EXCEPTION 'published game challenge requires published ranking snapshots' USING ERRCODE = '23514';
  END IF;
  SELECT COUNT(*) INTO unpublished_categories
    FROM game_challenge_categories gcc
    JOIN category_definitions cd ON cd.id = gcc.category_id
   WHERE gcc.game_challenge_id = NEW.id AND cd.status NOT IN ('approved', 'published');
  IF unpublished_categories > 0 THEN
    RAISE EXCEPTION 'published game challenge requires published categories' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_challenge_publish_validation_trigger ON game_challenges;
CREATE CONSTRAINT TRIGGER game_challenge_publish_validation_trigger
  AFTER INSERT OR UPDATE OF status ON game_challenges
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION rango90_validate_published_game_challenge();

CREATE OR REPLACE FUNCTION rango90_freeze_published_game_challenge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published' AND NEW.status <> 'retired' THEN
    RAISE EXCEPTION 'published game challenges can only be retired' USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'published' AND (
    NEW.id <> OLD.id OR NEW.challenge_kind <> OLD.challenge_kind OR NEW.challenge_date IS DISTINCT FROM OLD.challenge_date OR
    NEW.source_version <> OLD.source_version OR NEW.engine_version <> OLD.engine_version OR
    NEW.time_limit_seconds <> OLD.time_limit_seconds OR NEW.score_cap <> OLD.score_cap OR
    NEW.challenge_sha256 <> OLD.challenge_sha256 OR NEW.published_at IS DISTINCT FROM OLD.published_at OR
    NEW.metadata IS DISTINCT FROM OLD.metadata
  ) THEN
    RAISE EXCEPTION 'published game challenges are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_challenge_freeze_trigger ON game_challenges;
CREATE TRIGGER game_challenge_freeze_trigger
  BEFORE UPDATE ON game_challenges
  FOR EACH ROW EXECUTE FUNCTION rango90_freeze_published_game_challenge();

CREATE OR REPLACE FUNCTION rango90_freeze_published_game_children()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  challenge_id TEXT;
BEGIN
  challenge_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.game_challenge_id ELSE NEW.game_challenge_id END;
  IF EXISTS (SELECT 1 FROM game_challenges WHERE id = challenge_id AND status = 'published') THEN
    RAISE EXCEPTION 'published game challenge contents are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS game_challenge_categories_freeze_trigger ON game_challenge_categories;
CREATE TRIGGER game_challenge_categories_freeze_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON game_challenge_categories
  FOR EACH ROW EXECUTE FUNCTION rango90_freeze_published_game_children();

DROP TRIGGER IF EXISTS game_challenge_decisions_freeze_trigger ON game_challenge_decisions;
CREATE TRIGGER game_challenge_decisions_freeze_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON game_challenge_decisions
  FOR EACH ROW EXECUTE FUNCTION rango90_freeze_published_game_children();

DROP TRIGGER IF EXISTS game_challenge_answers_freeze_trigger ON game_challenge_answers;
CREATE TRIGGER game_challenge_answers_freeze_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON game_challenge_answers
  FOR EACH ROW EXECUTE FUNCTION rango90_freeze_published_game_children();

CREATE TABLE IF NOT EXISTS duels (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8,20}$'),
  game_challenge_id TEXT NOT NULL REFERENCES game_challenges(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'completed', 'expired', 'retired')),
  created_by_user_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
  replay_of_duel_id TEXT REFERENCES duels(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS duels_expiry_idx ON duels (status, expires_at);
CREATE INDEX IF NOT EXISTS duels_challenge_idx ON duels (game_challenge_id, created_at DESC);

CREATE TABLE IF NOT EXISTS duel_participants (
  id TEXT PRIMARY KEY,
  duel_id TEXT NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
  player_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
  participant_token_hash TEXT NOT NULL UNIQUE CHECK (participant_token_hash ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'expired')),
  started_at TIMESTAMPTZ NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (duel_id, slot),
  UNIQUE (duel_id, player_id),
  CHECK (deadline_at > started_at)
);

CREATE INDEX IF NOT EXISTS duel_participants_token_idx ON duel_participants (participant_token_hash);
CREATE INDEX IF NOT EXISTS duel_participants_player_idx ON duel_participants (player_id);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  game_challenge_id TEXT NOT NULL REFERENCES game_challenges(id) ON DELETE RESTRICT,
  player_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
  session_token_hash TEXT NOT NULL UNIQUE CHECK (session_token_hash ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  current_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (current_ordinal >= 0),
  state_version INTEGER NOT NULL DEFAULT 0 CHECK (state_version >= 0),
  replay_of_session_id TEXT REFERENCES game_sessions(id) ON DELETE SET NULL,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (deadline_at > started_at)
);

CREATE INDEX IF NOT EXISTS game_sessions_challenge_idx ON game_sessions (game_challenge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_sessions_player_idx ON game_sessions (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_sessions_active_expiry_idx ON game_sessions (status, deadline_at);

CREATE TABLE IF NOT EXISTS game_session_assignments (
  game_session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
  category_id TEXT NOT NULL REFERENCES category_definitions(id) ON DELETE RESTRICT,
  score_value INTEGER NOT NULL CHECK (score_value >= 0),
  timed_out BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (game_session_id, ordinal),
  UNIQUE (game_session_id, entity_id),
  UNIQUE (game_session_id, category_id)
);

CREATE TABLE IF NOT EXISTS game_results (
  id TEXT PRIMARY KEY,
  game_challenge_id TEXT NOT NULL REFERENCES game_challenges(id) ON DELETE RESTRICT,
  game_session_id TEXT REFERENCES game_sessions(id) ON DELETE RESTRICT,
  duel_participant_id TEXT REFERENCES duel_participants(id) ON DELETE RESTRICT,
  player_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
  submission_scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  result_hash TEXT NOT NULL CHECK (result_hash ~ '^[0-9a-f]{64}$'),
  source_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  elapsed_milliseconds BIGINT NOT NULL CHECK (elapsed_milliseconds >= 0),
  elapsed_seconds INTEGER NOT NULL CHECK (elapsed_seconds >= 0),
  total_score INTEGER NOT NULL CHECK (total_score >= 0),
  timed_out BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_session_id),
  UNIQUE (duel_participant_id),
  UNIQUE (submission_scope, game_challenge_id, idempotency_key),
  UNIQUE (submission_scope, game_challenge_id, result_hash),
  CHECK ((game_session_id IS NOT NULL) OR (duel_participant_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS game_results_leaderboard_idx
  ON game_results (game_challenge_id, total_score, elapsed_milliseconds, result_hash)
  WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS game_results_player_idx
  ON game_results (player_id, game_challenge_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS game_results_duel_idx ON game_results (duel_participant_id);

CREATE TABLE IF NOT EXISTS game_result_assignments (
  game_result_id TEXT NOT NULL REFERENCES game_results(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
  category_id TEXT NOT NULL REFERENCES category_definitions(id) ON DELETE RESTRICT,
  score_value INTEGER NOT NULL CHECK (score_value >= 0),
  timed_out BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (game_result_id, ordinal),
  UNIQUE (game_result_id, entity_id),
  UNIQUE (game_result_id, category_id)
);

CREATE INDEX IF NOT EXISTS game_result_assignments_entity_idx ON game_result_assignments (entity_id);
