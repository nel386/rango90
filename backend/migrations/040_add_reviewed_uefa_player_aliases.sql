-- Preserve full names recovered from an official UEFA club context and an
-- exact, reviewed Commons description. This improves future media searches;
-- it does not merge entities or infer identity from a surname alone.
INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES
  ('uefa:player:7643094817b65e5c5cf5d6f8', 'Michail Antonio', 'uefa-conference-league-official'),
  ('uefa:player:cbb6a7f58ba9aed35e2afc6c', 'Marius Mouandilmadji', 'uefa-conference-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
