-- UEFA's all-time tables use short labels for a few players. Resolve them
-- once in the durable catalogue so media discovery and future imports use the
-- same person instead of an ambiguous namesake.
UPDATE entities
SET canonical_name = CASE id
  WHEN 'uefa:player:21162feec037e2ec20b9c308' THEN 'Leroy Sané'
  WHEN 'uefa:player:1d119acaa0b1108876a3c327' THEN 'Clarence Seedorf'
  WHEN 'uefa:player:9dd7414d3afc32b570e18447' THEN 'Kingsley Coman'
  WHEN 'uefa:player:45cc49428ab671e0a5fd3ddf' THEN 'David Beckham'
  WHEN 'uefa:player:aec27e27bb933ad60adc2b94' THEN 'Alex de Souza'
  ELSE canonical_name
END,
updated_at = NOW()
WHERE id IN (
  'uefa:player:21162feec037e2ec20b9c308',
  'uefa:player:1d119acaa0b1108876a3c327',
  'uefa:player:9dd7414d3afc32b570e18447',
  'uefa:player:45cc49428ab671e0a5fd3ddf',
  'uefa:player:aec27e27bb933ad60adc2b94'
);

INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES
  ('uefa:player:21162feec037e2ec20b9c308', 'Sané', 'uefa-champions-league-official'),
  ('uefa:player:1d119acaa0b1108876a3c327', 'Seedorf', 'uefa-champions-league-official'),
  ('uefa:player:9dd7414d3afc32b570e18447', 'Coman', 'uefa-champions-league-official'),
  ('uefa:player:45cc49428ab671e0a5fd3ddf', 'Beckham', 'uefa-champions-league-official'),
  ('uefa:player:aec27e27bb933ad60adc2b94', 'Alex', 'uefa-champions-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
