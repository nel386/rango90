-- UEFA exposes the Celje player only as "Kovačević". The reviewed club
-- source and the licensed Commons file identify this entity as Franko.
INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES ('uefa:player:152f590db8d45f7f7a9d6c31', 'Franko Kovačević', 'uefa-conference-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
