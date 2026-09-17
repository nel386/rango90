-- BLOQUE 15B: preserve historical main-round labels without treating them as qualifying.
-- Additive and isolated; no production database is touched by this block.

ALTER TABLE champions_goal_facts
  DROP CONSTRAINT IF EXISTS champions_goal_facts_phase_check;

ALTER TABLE champions_goal_facts
  ADD CONSTRAINT champions_goal_facts_phase_check
  CHECK (phase IN (
    'qualifying', 'preliminary', 'first_round', 'second_round', 'third_round',
    'intermediate', 'league_phase', 'group', 'round_of_16', 'quarter_final',
    'semi_final', 'final', 'unknown'
  ));
