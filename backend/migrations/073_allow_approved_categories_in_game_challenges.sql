-- Category approval is the publication gate used by the existing CLI. Keep
-- published game challenges strict while allowing an approved category to be
-- referenced; incomplete categories remain draft or retired and cannot pass
-- the snapshot checks before this trigger runs.

CREATE OR REPLACE FUNCTION rango90_validate_published_game_challenge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  category_count INTEGER;
  decision_count INTEGER;
  answer_count INTEGER;
  expected_answer_count INTEGER;
  unpublished_snapshots INTEGER;
  unapproved_categories INTEGER;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO category_count FROM game_challenge_categories WHERE game_challenge_id = NEW.id;
  SELECT COUNT(*) INTO decision_count FROM game_challenge_decisions WHERE game_challenge_id = NEW.id;
  SELECT COUNT(*) INTO answer_count FROM game_challenge_answers WHERE game_challenge_id = NEW.id;
  expected_answer_count := category_count * decision_count;
  IF category_count = 0 OR category_count <> decision_count OR answer_count <> expected_answer_count THEN
    RAISE EXCEPTION 'published game challenge must have a complete square answer matrix' USING ERRCODE = '23514';
  END IF;
  SELECT COUNT(*) INTO unpublished_snapshots
    FROM game_challenge_categories gcc
    JOIN ranking_snapshots rs ON rs.id = gcc.ranking_snapshot_id
   WHERE gcc.game_challenge_id = NEW.id AND rs.status <> 'published';
  IF unpublished_snapshots > 0 THEN
    RAISE EXCEPTION 'published game challenge requires published ranking snapshots' USING ERRCODE = '23514';
  END IF;
  SELECT COUNT(*) INTO unapproved_categories
    FROM game_challenge_categories gcc
    JOIN category_definitions cd ON cd.id = gcc.category_id
   WHERE gcc.game_challenge_id = NEW.id AND cd.status NOT IN ('approved', 'published');
  IF unapproved_categories > 0 THEN
    RAISE EXCEPTION 'published game challenge requires approved categories' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
