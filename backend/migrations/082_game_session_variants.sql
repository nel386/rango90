-- A game session receives its own independently selected 7x7 board. The
-- published daily challenge remains the audited category/snapshot source;
-- this immutable session payload records the exact server-side variant.
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS variant_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS variant_decisions JSONB;

ALTER TABLE game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_variant_sha256_check;

ALTER TABLE game_sessions
  ADD CONSTRAINT game_sessions_variant_sha256_check
  CHECK (variant_sha256 IS NULL OR variant_sha256 ~ '^[0-9a-f]{64}$');
