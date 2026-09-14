-- Reviewed full-name variants used only to improve Wikimedia discovery.
-- They do not merge entities or change statistics.

INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES
  ('uefa:player:ce5cb595d564620628d1b82b', 'Harald Martin Brattbakk', NULL),
  ('statbunker:world-cup:player:16400', 'Lee Eul-yong', NULL),
  ('statbunker:world-cup:player:16400', 'I Eulyong', NULL),
  ('statbunker:world-cup:player:2835', 'Javier de Pedro', NULL),
  ('statbunker:world-cup:player:2835', 'Francisco Javier de Pedro Falque', NULL),
  ('pl:player:79', 'Stuart Edward Ripley', NULL)
ON CONFLICT (entity_id, alias) DO NOTHING;
