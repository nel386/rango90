-- Global club-career titles for players. This is deliberately separate from
-- player-career-titles, which may include senior national-team honours.
-- The ranking command consumes only already imported player_trophy_record facts
-- and creates a partial draft when the available evidence is incomplete.
BEGIN;

INSERT INTO category_definitions
  (id, slug, label_es, label_en, entity_type, metric_key, scope_kind, scope,
   ranking_direction, tie_policy, score_cap, definition_version, definition_md, status)
VALUES
  (
    'category-club-career-titles',
    'club-career-titles',
    'Títulos globales en clubes (carrera)',
    'Global club career titles',
    'player',
    'titles',
    'club_career_global',
    '{
      "officialOnly": true,
      "seniorClubCompetitions": true,
      "playerRule": "provider_recorded_winner",
      "includedCompetitions": ["premier-league", "la-liga", "bundesliga", "serie-a", "ligue-1", "primeira-liga"],
      "excluded": ["national_team", "friendlies", "youth", "reserve", "testimonial"]
    }'::jsonb,
    'desc',
    'competition',
    100,
    1,
    'Número de títulos de clubes registrados como Winner en los hechos importados de API-Football, agregados por jugador, competición y temporada. El corte actual solo cubre las seis competiciones de clubes importadas y no afirma todavía la carrera mundial completa.',
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
