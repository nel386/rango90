-- Phase 5: audited real category and deterministic draft daily challenge.
--
-- This migration records the source/contrast review and materializes the
-- single-category legacy daily challenge in draft. It intentionally does not
-- publish anything: the category snapshot and club badges still require the
-- existing editorial/media-rights approval flow.

BEGIN;

INSERT INTO sources (key, name, source_type, base_url, usage_notes, rights_status)
VALUES
  (
    'premier-league-honours-official',
    'Premier League official champions history',
    'official',
    'https://www.premierleague.com/en/news/4288492',
    'Primary source for the complete Premier League-era club title table; facts are frozen in source snapshots before gameplay.',
    'review_required'
  ),
  (
    'premier-league-explained-official-contrast',
    'Premier League official competition explainer',
    'official',
    'https://www.premierleague.com/en/premier-league-explained',
    'Independent official-page contrast: seven distinct winners and season-by-season champions; not merged as a second metric.',
    'review_required'
  ),
  (
    'premier-league-records-official-contrast',
    'Premier League official records',
    'official',
    'https://www.premierleague.com/en/stats/records',
    'Independent official-page contrast for Manchester United total and winning seasons.',
    'review_required'
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  usage_notes = EXCLUDED.usage_notes,
  rights_status = CASE
    WHEN sources.rights_status = 'approved' THEN sources.rights_status
    ELSE EXCLUDED.rights_status
  END;

-- The two contrast snapshots are metadata-only review records. They are not
-- used as ranking inputs and deliberately do not claim that raw HTML has
-- been archived. The primary normalized input remains the immutable JSON
-- source snapshot referenced by the ranking snapshot.
INSERT INTO source_snapshots
  (id, source_key, retrieved_at, content_type, storage_uri, content_sha256, metadata)
VALUES
  (
    'src_pl_explained_contrast_20260909',
    'premier-league-explained-official-contrast',
    '2026-09-09T00:00:00Z',
    'application/json',
    NULL,
    'c6103d0f3b4d92ef5f5ce03f9dd6efbd4f3cc2010778c676aefeea49a7399f7f',
    '{"reviewMode":"metadata-only","hashScope":"review-manifest","retrievalDate":"2026-09-09","sourceUrl":"https://www.premierleague.com/en/premier-league-explained","checks":["seven_distinct_winners","season_by_season_champions"]}'::jsonb
  ),
  (
    'src_pl_records_contrast_20260909',
    'premier-league-records-official-contrast',
    '2026-09-09T00:00:00Z',
    'application/json',
    NULL,
    'e5b6ae44f823fe3fba56ee03ef32f66ba529f9f54c8e73e46ec036909867af78',
    '{"reviewMode":"metadata-only","hashScope":"review-manifest","retrievalDate":"2026-09-09","sourceUrl":"https://www.premierleague.com/en/stats/records","checks":["manchester_united_13_titles","winning_seasons"]}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  source_key = EXCLUDED.source_key,
  metadata = source_snapshots.metadata || EXCLUDED.metadata;

UPDATE category_definitions
   SET label_es = 'Títulos de Premier League',
       label_en = 'Premier League titles',
       metric_key = 'club_titles',
       scope = '{"competitionId":"premier-league","closedUniverse":true,"seasonStart":"1992/93","seasonEnd":"2025/26","universeRule":"Every club that won the Premier League title in a completed season"}'::jsonb,
       definition_version = GREATEST(definition_version, 2),
       definition_md = 'Número de títulos de la Premier League ganados por cada club desde 1992/93 hasta la última temporada finalizada (2025/26). Se cuenta una vez cada campeonato oficial de la competición; no se incluyen títulos de First Division anteriores a 1992/93 ni otros trofeos. El universo cerrado contiene exclusivamente los clubes con al menos un título. En empate de valor se comparte posición de competición y el desempate de partida usa el hash oficial del resultado.',
       status = CASE WHEN status = 'published' THEN status ELSE 'draft' END
 WHERE slug = 'premier-league-club-titles';

-- Explicit canonical aliases document the only abbreviated labels used by
-- the primary source. Stable IDs and external IDs are already created by the
-- importer; these inserts are idempotent safeguards for clean environments.
INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES
  ('pl:club:12', 'Man Utd', 'premier-league-honours-official'),
  ('pl:club:11', 'Man City', 'premier-league-honours-official')
ON CONFLICT (entity_id, alias) DO UPDATE SET source_key = EXCLUDED.source_key;

INSERT INTO entity_external_ids (source_key, entity_type, external_id, entity_id, metadata)
VALUES
  ('premier-league-honours-official', 'club', 'premier-league:club:man-utd', 'pl:club:12', '{"identityReview":"canonical"}'::jsonb),
  ('premier-league-honours-official', 'club', 'premier-league:club:man-city', 'pl:club:11', '{"identityReview":"canonical"}'::jsonb),
  ('premier-league-honours-official', 'club', 'premier-league:club:chelsea', 'pl:club:4', '{"identityReview":"canonical"}'::jsonb),
  ('premier-league-honours-official', 'club', 'premier-league:club:arsenal', 'pl:club:1', '{"identityReview":"canonical"}'::jsonb),
  ('premier-league-honours-official', 'club', 'premier-league:club:liverpool', 'pl:club:10', '{"identityReview":"canonical"}'::jsonb),
  ('premier-league-honours-official', 'club', 'premier-league:club:blackburn-rovers', 'pl:club:blackburn-rovers', '{"identityReview":"canonical"}'::jsonb),
  ('premier-league-honours-official', 'club', 'premier-league:club:leicester-city', 'pl:club:leicester-city', '{"identityReview":"canonical"}'::jsonb)
ON CONFLICT (source_key, entity_type, external_id) DO UPDATE SET
  entity_id = EXCLUDED.entity_id,
  metadata = entity_external_ids.metadata || EXCLUDED.metadata,
  updated_at = NOW();

-- Enrich the already imported immutable ranking snapshot with the review
-- record. No ranking entry is recomputed or overwritten here.
UPDATE ranking_snapshots rs
   SET metadata = rs.metadata || jsonb_build_object(
     'phase5ReviewDate', '2026-09-09',
     'primarySourceUrl', 'https://www.premierleague.com/en/news/4288492',
     'contrastSourceSnapshotIds', jsonb_build_array('src_pl_explained_contrast_20260909', 'src_pl_records_contrast_20260909'),
     'definitionVersion', 2,
     'rightsDecision', 'draft_until_badges_and_source_rights_are_approved'
   )
 WHERE rs.id = (
   SELECT rs2.id
     FROM ranking_snapshots rs2
     JOIN category_definitions cd ON cd.id = rs2.category_id
    WHERE cd.slug = 'premier-league-club-titles'
    ORDER BY rs2.generated_at DESC
    LIMIT 1
 );

-- A real, complete seven-item daily challenge is materialized for local
-- testing, but it remains draft because its source/category/media rights are
-- not publishable. It uses the legacy single-category challenge model; the
-- multi-category online game contract must not be fed a fabricated square
-- matrix merely to make this category appear published.
INSERT INTO challenges
  (id, challenge_kind, challenge_date, category_id, ranking_snapshot_id, status, published_at, metadata)
SELECT
  'daily_2026-09-09_premier-league-club-titles',
  'daily',
  DATE '2026-09-09',
  rs.category_id,
  rs.id,
  'draft',
  NULL,
  jsonb_build_object(
    'phase', 5,
    'materialization', 'all_closed_universe_entries',
    'coverageComplete', rs.coverage_complete,
    'unresolvedConflicts', rs.unresolved_conflicts,
    'rightsStatus', 'review_required',
    'reasonDraft', 'category_and_badge_rights_not_approved',
    'sourceVersion', rs.data_version
  )
FROM ranking_snapshots rs
JOIN category_definitions cd ON cd.id = rs.category_id
WHERE cd.slug = 'premier-league-club-titles'
ORDER BY rs.generated_at DESC
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
  ranking_snapshot_id = EXCLUDED.ranking_snapshot_id,
  category_id = EXCLUDED.category_id,
  status = 'draft',
  published_at = NULL,
  metadata = EXCLUDED.metadata;

DELETE FROM challenge_items
 WHERE challenge_id = 'daily_2026-09-09_premier-league-club-titles';

INSERT INTO challenge_items (challenge_id, ordinal, entity_id, correct_rank, score_value)
SELECT
  'daily_2026-09-09_premier-league-club-titles',
  ROW_NUMBER() OVER (ORDER BY re.rank, re.entity_id) - 1,
  re.entity_id,
  re.rank,
  re.score_value
FROM ranking_entries re
JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
JOIN category_definitions cd ON cd.id = rs.category_id
WHERE cd.slug = 'premier-league-club-titles'
  AND rs.id = (
    SELECT rs2.id
      FROM ranking_snapshots rs2
      JOIN category_definitions cd2 ON cd2.id = rs2.category_id
     WHERE cd2.slug = 'premier-league-club-titles'
     ORDER BY rs2.generated_at DESC
     LIMIT 1
  );

COMMIT;
