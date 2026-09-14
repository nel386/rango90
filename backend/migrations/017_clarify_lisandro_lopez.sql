UPDATE entities
SET canonical_name = 'Lisandro López',
    short_name = 'Lisandro López',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'identityClarification', 'UEFA player 101676',
      'identityCanonicalName', 'Lisandro López'
    )
WHERE id = 'uefa:player:51298cd1a6ccd4930c245472';

INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES
  ('uefa:player:51298cd1a6ccd4930c245472', 'Lisandro', 'uefa-champions-league-official'),
  ('uefa:player:51298cd1a6ccd4930c245472', 'Lisandro López', 'uefa-champions-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
