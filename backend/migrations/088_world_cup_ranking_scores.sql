-- BLOQUE 21: conservar el score producido por el motor en el snapshot lab.
-- Es aditivo y no habilita publicación oficial.

ALTER TABLE world_cup_ranking_entries
  ADD COLUMN IF NOT EXISTS score_value INTEGER;

UPDATE world_cup_ranking_entries
   SET score_value = LEAST(rank, 100)
 WHERE score_value IS NULL;

ALTER TABLE world_cup_ranking_entries
  ALTER COLUMN score_value SET NOT NULL;

ALTER TABLE world_cup_ranking_entries
  DROP CONSTRAINT IF EXISTS world_cup_ranking_entries_score_check;

ALTER TABLE world_cup_ranking_entries
  ADD CONSTRAINT world_cup_ranking_entries_score_check CHECK (score_value >= 0);
