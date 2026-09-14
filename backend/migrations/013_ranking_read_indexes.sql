-- Read path used by the game: latest published snapshot per category,
-- followed by the first ranked entries and their primary media.
CREATE INDEX IF NOT EXISTS ranking_snapshots_category_status_generated_idx
  ON ranking_snapshots(category_id, status, generated_at DESC);

CREATE INDEX IF NOT EXISTS ranking_entries_snapshot_rank_entity_idx
  ON ranking_entries(snapshot_id, rank, entity_id);

CREATE INDEX IF NOT EXISTS image_assets_entity_kind_primary_review_idx
  ON image_assets(entity_id, asset_kind, is_primary, review_status);

-- Identity resolution is part of every import and must remain cheap as the
-- catalogue grows across providers.
CREATE INDEX IF NOT EXISTS entity_external_ids_lookup_idx
  ON entity_external_ids(source_key, entity_type, external_id, entity_id);
