-- Full names recovered from official competition/federation records for
-- playable UEFA catalogue entries that were stored only as a surname or
-- initial. Aliases improve media discovery; they do not approve media.
BEGIN;

INSERT INTO entity_aliases (entity_id, alias, source_key)
SELECT v.entity_id, v.alias, 'identity-research-official-records'
FROM (VALUES
  ('uefa:player:3fe36d1b9893ef73d5a73002', 'Tedi Cara'),
  ('uefa:player:2d38648b577a5c44a471c66b', 'Emerson'),
  ('uefa:player:b6420f84798ee701f6f23def', 'Árni Frederiksberg'),
  ('uefa:player:5afb61e3bdc8b581daa2038e', 'Tryggvi Hrafn Haraldsson'),
  ('uefa:player:35bb0baa79e95c62fef560d8', 'Hákon Arnar Haraldsson'),
  ('uefa:player:da92bb862e1ea589a24efd46', 'Jesper Karlsson'),
  ('uefa:player:5fed51cdd7338a730755daac', 'Jan Krob'),
  ('uefa:player:4f1705002c501a1e8910ab4f', 'Guillaume López'),
  ('pl:player:16286', 'Rodri Hernández')
) AS v(entity_id, alias)
WHERE EXISTS (SELECT 1 FROM entities e WHERE e.id = v.entity_id AND e.entity_type = 'player')
ON CONFLICT (entity_id, alias) DO NOTHING;

COMMIT;
