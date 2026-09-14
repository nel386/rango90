CREATE TABLE IF NOT EXISTS entity_game_profiles (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  legacy_tier TEXT NOT NULL DEFAULT 'modern'
    CHECK (legacy_tier IN ('modern', 'iconic_legacy', 'classic_legacy', 'unknown')),
  playable_default BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT NOT NULL,
  source_key TEXT REFERENCES sources(key),
  source_snapshot_id TEXT REFERENCES source_snapshots(id),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS entity_game_profiles_playable_idx
  ON entity_game_profiles(playable_default, legacy_tier);
