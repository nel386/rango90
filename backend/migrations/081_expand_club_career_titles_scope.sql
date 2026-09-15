-- Expand the selected club-career ranking from six domestic leagues to every
-- senior club competition that the audited API-Football trophy importer
-- records. National-team competitions remain explicitly excluded.
BEGIN;

UPDATE category_definitions
   SET scope = jsonb_set(
         jsonb_set(
           scope,
           '{includedCompetitions}',
           '"all_api_football_senior_club_competitions"'::jsonb,
           TRUE
         ),
         '{excludedCompetitions}',
         '["copa-america", "world-cup", "euro", "nations-league"]'::jsonb,
         TRUE
       ),
       definition_md = 'Número de títulos sénior de clubes registrados como Winner en los hechos importados de API-Football, agregados por jugador, competición y temporada. Se excluyen las competiciones de selecciones, amistosos, categorías juveniles, reservas y testimoniales; el resultado sigue siendo un mínimo observado hasta completar y contrastar todo el historial mundial.'
 WHERE slug = 'club-career-titles';

COMMIT;
