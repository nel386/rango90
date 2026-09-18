-- BLOQUE 20: distingue hechos primarios de filas de contraste sin duplicar el ranking.
ALTER TABLE world_cup_goal_facts
  ADD COLUMN IF NOT EXISTS fact_role TEXT NOT NULL DEFAULT 'primary';

ALTER TABLE world_cup_goal_facts
  DROP CONSTRAINT IF EXISTS world_cup_goal_facts_role_check;

ALTER TABLE world_cup_goal_facts
  DROP CONSTRAINT IF EXISTS world_cup_goal_facts_phase_check;

ALTER TABLE world_cup_goal_facts
  ADD CONSTRAINT world_cup_goal_facts_phase_check
  CHECK (phase IN ('group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final', 'unknown'));

ALTER TABLE world_cup_goal_facts
  ADD CONSTRAINT world_cup_goal_facts_role_check
  CHECK (fact_role IN ('primary', 'contrast'));

CREATE INDEX IF NOT EXISTS world_cup_goal_facts_role_idx
  ON world_cup_goal_facts(fact_role, edition_id, match_id);
