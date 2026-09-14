-- UEFA's historical ranking labels José Augusto Torres only as "Torres".
-- Keep the provider identifier and evidence intact, but make the canonical
-- display name unambiguous for the game and for manual image review.
UPDATE entities
SET canonical_name = 'José Augusto Torres',
    short_name = 'José Augusto Torres',
    updated_at = NOW(),
    metadata = metadata || '{"identityClarification":"UEFA player 37711"}'::jsonb
WHERE id = 'uefa:player:0cb5f3cf8de9c06347af3bba'
  AND canonical_name = 'Torres';

INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES ('uefa:player:0cb5f3cf8de9c06347af3bba', 'Torres', 'uefa-champions-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
