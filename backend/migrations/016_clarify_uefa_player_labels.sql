UPDATE entities
SET canonical_name = CASE id
      WHEN 'uefa:player:454d0d05d2d07b33d1552fe1' THEN 'Gonzalo Higuaín'
      WHEN 'uefa:player:091db2cd48b9e8e4274fa678' THEN 'Lautaro Martínez'
      WHEN 'uefa:player:b9a71ac2ace226ffaf90e4fb' THEN 'Luuk de Jong'
      ELSE canonical_name
    END,
    metadata = metadata || jsonb_build_object('identityClarification', CASE id
      WHEN 'uefa:player:454d0d05d2d07b33d1552fe1' THEN 'UEFA player 1900739'
      WHEN 'uefa:player:091db2cd48b9e8e4274fa678' THEN 'UEFA player 250118281'
      WHEN 'uefa:player:b9a71ac2ace226ffaf90e4fb' THEN 'UEFA player 250005343'
      ELSE NULL
    END)
WHERE id IN (
  'uefa:player:454d0d05d2d07b33d1552fe1',
  'uefa:player:091db2cd48b9e8e4274fa678',
  'uefa:player:b9a71ac2ace226ffaf90e4fb'
);

INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES
  ('uefa:player:454d0d05d2d07b33d1552fe1', 'Higuaín', 'uefa-champions-league-official'),
  ('uefa:player:091db2cd48b9e8e4274fa678', 'L. Martínez', 'uefa-champions-league-official'),
  ('uefa:player:b9a71ac2ace226ffaf90e4fb', 'L. de Jong', 'uefa-champions-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
