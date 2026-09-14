CREATE TABLE IF NOT EXISTS entity_external_ids (
  source_key TEXT NOT NULL REFERENCES sources(key),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('player', 'club', 'national_team')),
  external_id TEXT NOT NULL,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_key, entity_type, external_id),
  UNIQUE (entity_id, source_key, entity_type)
);

CREATE INDEX IF NOT EXISTS entity_external_ids_entity_idx
  ON entity_external_ids(entity_id);
