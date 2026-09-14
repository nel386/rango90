CREATE TABLE IF NOT EXISTS entity_identity_links (
  source_entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  canonical_entity_id TEXT NOT NULL REFERENCES entities(id),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'manual')),
  reason TEXT NOT NULL,
  source_key TEXT NOT NULL REFERENCES sources(key),
  source_snapshot_id TEXT REFERENCES source_snapshots(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_entity_id <> canonical_entity_id)
);

CREATE INDEX IF NOT EXISTS entity_identity_links_canonical_idx
  ON entity_identity_links(canonical_entity_id);

ALTER TABLE player_season_stats
  ALTER COLUMN provider_team_id SET NOT NULL;
