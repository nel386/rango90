-- Global titles ranking for club entities. This is distinct from
-- club-career-titles, which ranks players by club honours won.
BEGIN;

INSERT INTO category_definitions
  (id, slug, label_es, label_en, entity_type, metric_key, scope_kind, scope,
   ranking_direction, tie_policy, score_cap, definition_version, definition_md, status)
VALUES
  (
    'category-club-global-titles',
    'club-global-titles',
    'Títulos globales de clubes',
    'Global club titles',
    'club',
    'titles',
    'career_global',
    '{
      "officialOnly": true,
      "seniorClubCompetitions": true,
      "clubRule": "one_title_count_per_competition_and_edition",
      "excluded": ["friendlies", "youth", "reserve", "testimonial"]
    }'::jsonb,
    'desc',
    'competition',
    100,
    1,
    'Número de títulos oficiales de primer equipo ganados por cada club, agregado entre las competiciones de clubes importadas. Se deduplican snapshots repetidos y se conserva la evidencia de cada competición; el corte actual es provisional hasta completar todas las competiciones y épocas.',
    'draft'
  )
ON CONFLICT (slug) DO UPDATE SET
  label_es = EXCLUDED.label_es,
  label_en = EXCLUDED.label_en,
  entity_type = EXCLUDED.entity_type,
  metric_key = EXCLUDED.metric_key,
  scope_kind = EXCLUDED.scope_kind,
  scope = EXCLUDED.scope,
  ranking_direction = EXCLUDED.ranking_direction,
  tie_policy = EXCLUDED.tie_policy,
  score_cap = EXCLUDED.score_cap,
  definition_version = EXCLUDED.definition_version,
  definition_md = EXCLUDED.definition_md;

COMMIT;
