-- BLOQUE 45F: preserve provider card categories independently for future facts.
-- Existing facts remain unchanged; missing values stay NULL rather than becoming zero.
ALTER TABLE club_yellow_card_facts
  ALTER COLUMN yellow_cards DROP NOT NULL;

ALTER TABLE club_yellow_card_facts
  ADD COLUMN IF NOT EXISTS red_cards INTEGER CHECK (red_cards IS NULL OR red_cards >= 0),
  ADD COLUMN IF NOT EXISTS yellow_red_cards INTEGER CHECK (yellow_red_cards IS NULL OR yellow_red_cards >= 0);

COMMENT ON COLUMN club_yellow_card_facts.red_cards IS
  'API-Football cards.red; kept separate from yellow-red dismissals.';
COMMENT ON COLUMN club_yellow_card_facts.yellow_red_cards IS
  'API-Football cards.yellowred (second booking); never added to red_cards.';
