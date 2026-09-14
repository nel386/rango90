-- Daily challenges may contain several entity types. The challenge remains a
-- seven-by-seven assignment board, but a player only has answers for player
-- categories and a club/national team only has answers for matching categories.

CREATE OR REPLACE FUNCTION rango90_validate_published_game_challenge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  category_count INTEGER;
  decision_count INTEGER;
  answer_count INTEGER;
  expected_answer_count INTEGER;
  invalid_answer_count INTEGER;
  unpublished_snapshots INTEGER;
  unapproved_categories INTEGER;
  unbacked_decisions INTEGER;
  score_mismatches INTEGER;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO category_count
    FROM game_challenge_categories WHERE game_challenge_id = NEW.id;
  SELECT COUNT(*) INTO decision_count
    FROM game_challenge_decisions WHERE game_challenge_id = NEW.id;
  SELECT COUNT(*) INTO answer_count
    FROM game_challenge_answers WHERE game_challenge_id = NEW.id;

  SELECT COUNT(*) INTO expected_answer_count
    FROM game_challenge_decisions gcd
    JOIN entities decision_entity ON decision_entity.id = gcd.entity_id
    CROSS JOIN game_challenge_categories gcc
    JOIN category_definitions cd ON cd.id = gcc.category_id
   WHERE gcd.game_challenge_id = NEW.id
     AND gcc.game_challenge_id = NEW.id
     AND decision_entity.entity_type = cd.entity_type;

  SELECT COUNT(*) INTO invalid_answer_count
    FROM game_challenge_answers gca
    JOIN game_challenge_decisions gcd
      ON gcd.game_challenge_id = gca.game_challenge_id
     AND gcd.decision_ordinal = gca.decision_ordinal
    JOIN game_challenge_categories gcc
      ON gcc.game_challenge_id = gca.game_challenge_id
     AND gcc.category_id = gca.category_id
    JOIN category_definitions cd ON cd.id = gcc.category_id
    JOIN entities decision_entity ON decision_entity.id = gcd.entity_id
   WHERE gca.game_challenge_id = NEW.id
     AND decision_entity.entity_type <> cd.entity_type;

  IF category_count = 0 OR category_count <> decision_count OR answer_count <> expected_answer_count OR invalid_answer_count > 0 THEN
    RAISE EXCEPTION 'published game challenge must have a complete compatible answer matrix' USING ERRCODE = '23514';
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

  SELECT COUNT(*) INTO unbacked_decisions
    FROM game_challenge_decisions gcd
    JOIN entities decision_entity ON decision_entity.id = gcd.entity_id
   WHERE gcd.game_challenge_id = NEW.id
     AND NOT EXISTS (
       SELECT 1
         FROM game_challenge_categories gcc
         JOIN category_definitions cd ON cd.id = gcc.category_id
         JOIN ranking_entries re ON re.snapshot_id = gcc.ranking_snapshot_id
         LEFT JOIN entity_identity_links identity_link
           ON identity_link.source_entity_id = re.entity_id
        WHERE gcc.game_challenge_id = NEW.id
          AND decision_entity.entity_type = cd.entity_type
          AND COALESCE(identity_link.canonical_entity_id, re.entity_id) = gcd.entity_id
     );
  IF unbacked_decisions > 0 THEN
    RAISE EXCEPTION 'published game challenge requires every decision entity in at least one compatible ranking snapshot' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO score_mismatches
    FROM game_challenge_decisions gcd
    JOIN entities decision_entity ON decision_entity.id = gcd.entity_id
    JOIN game_challenge_categories gcc ON gcc.game_challenge_id = gcd.game_challenge_id
    JOIN category_definitions cd ON cd.id = gcc.category_id
    JOIN game_challenge_answers gca
      ON gca.game_challenge_id = gcd.game_challenge_id
     AND gca.decision_ordinal = gcd.decision_ordinal
     AND gca.category_id = gcc.category_id
    LEFT JOIN LATERAL (
      SELECT ranking_entry.score_value
        FROM ranking_entries ranking_entry
        LEFT JOIN entity_identity_links identity_link
          ON identity_link.source_entity_id = ranking_entry.entity_id
       WHERE ranking_entry.snapshot_id = gcc.ranking_snapshot_id
         AND COALESCE(identity_link.canonical_entity_id, ranking_entry.entity_id) = gcd.entity_id
       ORDER BY ranking_entry.rank, ranking_entry.entity_id
       LIMIT 1
    ) re ON TRUE
   WHERE gcd.game_challenge_id = NEW.id
     AND decision_entity.entity_type = cd.entity_type
     AND gca.score_value IS DISTINCT FROM COALESCE(re.score_value, cd.score_cap);
  IF score_mismatches > 0 THEN
    RAISE EXCEPTION 'published game challenge answers must match ranking snapshot score values' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
