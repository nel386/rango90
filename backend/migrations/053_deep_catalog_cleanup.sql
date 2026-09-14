-- Deep catalogue audit/cleanup support.
-- This migration is intentionally additive: raw snapshots, source payloads,
-- historical ranking rows and media candidates are never deleted.
BEGIN;

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS catalog_status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entities_catalog_status_check'
  ) THEN
    ALTER TABLE entities
      ADD CONSTRAINT entities_catalog_status_check
      CHECK (catalog_status IN ('active', 'excluded_from_game', 'identity_review_required', 'retired', 'superseded'));
  END IF;
END $$;

ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS media_status TEXT NOT NULL DEFAULT 'required';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'image_assets_media_status_check'
  ) THEN
    ALTER TABLE image_assets
      ADD CONSTRAINT image_assets_media_status_check
      CHECK (media_status IN ('required', 'media_not_required'));
  END IF;
END $$;

ALTER TABLE ranking_entries
  ADD COLUMN IF NOT EXISTS source_rank INTEGER,
  ADD COLUMN IF NOT EXISTS ranking_position INTEGER,
  ADD COLUMN IF NOT EXISTS entry_order INTEGER;

UPDATE ranking_entries
SET source_rank = CASE
  WHEN evidence->>'sourceRank' ~ '^[0-9]+$' THEN (evidence->>'sourceRank')::integer
  WHEN evidence->>'source_rank' ~ '^[0-9]+$' THEN (evidence->>'source_rank')::integer
  ELSE source_rank
END
WHERE source_rank IS NULL;

WITH numbered AS (
  SELECT snapshot_id, entity_id,
         ROW_NUMBER() OVER (
           PARTITION BY snapshot_id
           ORDER BY rank, tie_group, entity_id
         )::integer AS ordinal
  FROM ranking_entries
)
UPDATE ranking_entries re
SET ranking_position = COALESCE(re.ranking_position, re.rank),
    entry_order = COALESCE(re.entry_order, numbered.ordinal)
FROM numbered
WHERE re.snapshot_id = numbered.snapshot_id
  AND re.entity_id = numbered.entity_id;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ranking_entries_source_rank_check') THEN
    ALTER TABLE ranking_entries ADD CONSTRAINT ranking_entries_source_rank_check CHECK (source_rank IS NULL OR source_rank > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ranking_entries_ranking_position_check') THEN
    ALTER TABLE ranking_entries ADD CONSTRAINT ranking_entries_ranking_position_check CHECK (ranking_position IS NULL OR ranking_position > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ranking_entries_entry_order_check') THEN
    ALTER TABLE ranking_entries ADD CONSTRAINT ranking_entries_entry_order_check CHECK (entry_order IS NULL OR entry_order > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS entities_catalog_status_type_idx
  ON entities(entity_type, catalog_status);

CREATE INDEX IF NOT EXISTS image_assets_media_status_entity_idx
  ON image_assets(entity_id, media_status, review_status);

CREATE INDEX IF NOT EXISTS ranking_entries_snapshot_position_idx
  ON ranking_entries(snapshot_id, ranking_position, entry_order, entity_id);

-- A challenge may only reference entities currently admitted to the active
-- catalogue. Historical rows remain untouched; future invalid challenges fail
-- loudly instead of leaking excluded/identity-source players into the game.
CREATE OR REPLACE FUNCTION rango90_validate_active_catalog_entity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  status TEXT;
BEGIN
  SELECT catalog_status INTO status FROM entities WHERE id = NEW.entity_id;
  IF status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'challenge entity % is not active in the game catalogue (status=%)', NEW.entity_id, status USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS challenges_active_catalog_entity_trigger ON challenge_items;
CREATE TRIGGER challenges_active_catalog_entity_trigger
  BEFORE INSERT OR UPDATE OF entity_id ON challenge_items
  FOR EACH ROW EXECUTE FUNCTION rango90_validate_active_catalog_entity();

DROP TRIGGER IF EXISTS game_challenge_decisions_active_catalog_entity_trigger ON game_challenge_decisions;
CREATE TRIGGER game_challenge_decisions_active_catalog_entity_trigger
  BEFORE INSERT OR UPDATE OF entity_id ON game_challenge_decisions
  FOR EACH ROW EXECUTE FUNCTION rango90_validate_active_catalog_entity();

CREATE TABLE IF NOT EXISTS identity_review_cases (
  id TEXT PRIMARY KEY,
  requested_name TEXT NOT NULL,
  likely_name TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('player', 'club', 'national_team')),
  resolution_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (resolution_status IN ('pending', 'confirmed_existing_canonical', 'not_found', 'needs_manual_review')),
  canonical_entity_id TEXT REFERENCES entities(id),
  decision TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO identity_review_cases
  (id, requested_name, likely_name, entity_type, decision, metadata)
VALUES
  ('identity-review-neil-macdonald', 'Neil MacDonald', 'Neil McDonald', 'player', 'Do not auto-correct by name; verify the canonical record and evidence.', '{"source":"deep-catalog-audit"}'),
  ('identity-review-somen-choji', 'Somen Choji', 'Somen Tchoyi', 'player', 'Do not auto-correct by name; verify the canonical record and evidence.', '{"source":"deep-catalog-audit"}'),
  ('identity-review-brian-small', 'Brian Small', 'Bryan Small', 'player', 'Do not auto-correct by name; verify the canonical record and evidence.', '{"source":"deep-catalog-audit"}'),
  ('identity-review-gabriel-damas', 'Gabriel Damas', 'Vítor Damas', 'player', 'No name-only correction; keep unresolved until authoritative evidence is found.', '{"source":"deep-catalog-audit"}'),
  ('identity-review-shane-ferguson', 'Shane Ferguson', NULL, 'player', 'Existing canonical spelling; verify provider identity before any merge.', '{"source":"deep-catalog-audit"}'),
  ('identity-review-simeon-jackson', 'Simeon Jackson', NULL, 'player', 'Existing canonical spelling; verify provider identity before any merge.', '{"source":"deep-catalog-audit"}'),
  ('identity-review-grant-holt', 'Grant Holt', NULL, 'player', 'Existing canonical spelling; verify provider identity before any merge.', '{"source":"deep-catalog-audit"}'),
  ('identity-review-jan-stekkal', 'Jan Stekkal', 'Jan Stejskal', 'player', 'Do not auto-correct by name; verify the canonical record and evidence.', '{"source":"deep-catalog-audit"}')
ON CONFLICT (id) DO NOTHING;

COMMIT;
