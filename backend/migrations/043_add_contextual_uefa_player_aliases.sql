-- Full names confirmed against the UEFA club context and provider sport.
-- Identity aliases only; media remains pending until rights review.
INSERT INTO entity_aliases (entity_id, alias, source_key)
SELECT v.entity_id, v.alias, 'media-identity-review'
FROM (VALUES
  ('uefa:player:8ddcf9b48d4d8a870159dc5a', 'Emil Atlason'),
  ('uefa:player:09558b75f3713b7bba853340', 'Besart Ibraimi'),
  ('uefa:player:484a4177b56e1a6371a8cb37', 'Cherif Ndiaye'),
  ('uefa:player:d093d79a37729badf7b86ac9', 'Luka Juričić')
) AS v(entity_id, alias)
WHERE EXISTS (SELECT 1 FROM entities e WHERE e.id = v.entity_id AND e.entity_type = 'player')
ON CONFLICT (entity_id, alias) DO UPDATE SET source_key = EXCLUDED.source_key;
