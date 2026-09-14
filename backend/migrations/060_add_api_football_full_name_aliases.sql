-- API-Football often supplies an abbreviated display name together with a
-- stable player ID and full firstname/lastname fields. Keep the canonical
-- label untouched, but retain the full provider name as an identity-search
-- alias so Commons/Wikidata discovery can resolve the correct person.
INSERT INTO entity_aliases (entity_id, alias, source_key)
SELECT e.id,
       NULLIF(BTRIM(CONCAT_WS(' ', e.metadata ->> 'firstname', e.metadata ->> 'lastname')), ''),
       'api-football-profile'
FROM entities e
WHERE e.entity_type = 'player'
  AND NULLIF(BTRIM(e.metadata ->> 'firstname'), '') IS NOT NULL
  AND NULLIF(BTRIM(e.metadata ->> 'lastname'), '') IS NOT NULL
  AND NULLIF(BTRIM(CONCAT_WS(' ', e.metadata ->> 'firstname', e.metadata ->> 'lastname')), '') <> e.canonical_name
ON CONFLICT (entity_id, alias) DO NOTHING;
