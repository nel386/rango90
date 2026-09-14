-- UEFA's historical ranking sometimes emits surnames or short labels. These
-- IDs were checked against the Champions League player records before adding
-- their canonical names and search aliases.
UPDATE entities SET canonical_name = 'Francisco Gento', short_name = 'Paco Gento'
WHERE id = 'uefa:player:8a495929571f7f30b2df3292';
UPDATE entities SET canonical_name = 'Serhiy Rebrov', short_name = 'Serhiy Rebrov'
WHERE id = 'uefa:player:9f58777302b04e2bbe0d1a9d';
UPDATE entities SET canonical_name = 'Marco Simone', short_name = 'Marco Simone'
WHERE id = 'uefa:player:bbcfcbb0b1f49c7bfd9510b6';
UPDATE entities SET canonical_name = 'Claudio Pizarro', short_name = 'Claudio Pizarro'
WHERE id = 'uefa:player:b40ec614c31187484eba5184';
UPDATE entities SET canonical_name = 'Maksim Shatskikh', short_name = 'Maksim Shatskikh'
WHERE id = 'uefa:player:eef203d5b5e5171817214edf';
UPDATE entities SET canonical_name = 'Harald Brattbakk', short_name = 'Harald Brattbakk'
WHERE id = 'uefa:player:ce5cb595d564620628d1b82b';
UPDATE entities SET canonical_name = 'José Augusto Torres', short_name = 'José Augusto Torres'
WHERE id = 'uefa:player:0cb5f3cf8de9c06347af3bba';
UPDATE entities SET canonical_name = 'Fernando Cruz', short_name = 'Fernando Cruz'
WHERE id = 'uefa:player:1b9a1c41f87317386372f6ce';

INSERT INTO entity_aliases (entity_id, alias, source_key) VALUES
  ('uefa:player:8a495929571f7f30b2df3292', 'Gento', 'uefa-champions-league-official'),
  ('uefa:player:9f58777302b04e2bbe0d1a9d', 'Rebrov', 'uefa-champions-league-official'),
  ('uefa:player:bbcfcbb0b1f49c7bfd9510b6', 'Simone', 'uefa-champions-league-official'),
  ('uefa:player:b40ec614c31187484eba5184', 'Pizarro', 'uefa-champions-league-official'),
  ('uefa:player:eef203d5b5e5171817214edf', 'Shatskikh', 'uefa-champions-league-official'),
  ('uefa:player:ce5cb595d564620628d1b82b', 'Brattbakk', 'uefa-champions-league-official'),
  ('uefa:player:0cb5f3cf8de9c06347af3bba', 'Torres', 'uefa-champions-league-official'),
  ('uefa:player:1b9a1c41f87317386372f6ce', 'Cruz', 'uefa-champions-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
