UPDATE entities
SET canonical_name = 'Ferenc Puskás',
    short_name = 'Puskás',
    metadata = metadata || '{"identityClarification":"UEFA player 71683"}'::jsonb
WHERE id = 'uefa:player:519291d14b5654664901bf09';

INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES ('uefa:player:519291d14b5654664901bf09', 'Puskás', 'uefa-champions-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
