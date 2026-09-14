-- Distinguish José Augusto Pinto de Almeida from José Augusto Torres. UEFA
-- uses the short label "José Augusto" for the winger's player record.
UPDATE entities
SET canonical_name = 'José Augusto Pinto de Almeida', short_name = 'José Augusto'
WHERE id = 'uefa:player:6096d66cc6817adf0cb5db7e';

INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES ('uefa:player:6096d66cc6817adf0cb5db7e', 'José Augusto', 'uefa-champions-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
