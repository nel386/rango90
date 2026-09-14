-- UEFA's historical Conference League table shortens several names to an
-- initial/surname. Keep the provider display value, but persist the reviewed
-- full names so identity and Commons searches can be exact.
INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES
  ('uefa:player:a3234260d16950158c81920a', 'Armend Thaqi', 'uefa-conference-league-official'),
  ('uefa:player:31d29cc07c11bdfeb78dbd5d', 'Palkó Dárdai', 'uefa-conference-league-official'),
  ('uefa:player:1e22fd98305a1681ca754d11', 'Giorgi Chakvetadze', 'uefa-conference-league-official'),
  ('uefa:player:7cdf242f726fd209334930f9', 'Rúben Vinagre', 'uefa-conference-league-official'),
  ('uefa:player:769e242d3c23b23dee822f5b', 'Viktor Karl Einarsson', 'uefa-conference-league-official'),
  ('uefa:player:02fd7e7bc2f60b3f75aba792', 'Uran Bislimi', 'uefa-conference-league-official')
ON CONFLICT (entity_id, alias) DO NOTHING;
