-- The UEFA feed exposes this player as "Behrens"; Commons and other
-- identity sources use the complete name. Keep the alias explicit so future
-- media/stat imports do not rely on surname-only matching.
INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES ('uefa:player:8a319587063874199530208b', 'Hanno Behrens', 'uefa-conference-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
