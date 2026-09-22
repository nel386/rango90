-- BLOQUE 45A: distingue la liga usada para elegibilidad de las competiciones
-- oficiales de clubes que se acumulan en la carrera.

ALTER TABLE club_yellow_card_facts
  ADD COLUMN IF NOT EXISTS competition_type TEXT NOT NULL DEFAULT 'official_club_competition'
    CHECK (competition_type = 'official_club_competition');

ALTER TABLE club_yellow_card_facts
  ADD COLUMN IF NOT EXISTS eligibility_major_league_id INTEGER;

COMMENT ON COLUMN club_yellow_card_facts.eligibility_major_league_id IS
  'Major-league season evidence used only for the two-seasons-in-one-league eligibility rule.';
