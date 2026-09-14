-- Exact provider names recovered from TheSportsDB searches with UEFA team context.
-- These aliases are identity hints only; they do not approve or publish media.
INSERT INTO entity_aliases (entity_id, alias, source_key)
SELECT v.entity_id, v.alias, 'media-identity-review'
FROM (VALUES
  ('uefa:player:33e1379886938621a6d24e98', 'Tonni Adamsen'),
  ('uefa:player:a3457a99bea3f61408726281', 'Zeki Amdouni'),
  ('uefa:player:8ddcf9b48d4d8a870159dc5a', 'Árni Atlason'),
  ('uefa:player:09558b75f3713b7bba853340', 'Besart Ibraimi'),
  ('uefa:player:02fd7e7bc2f60b3f75aba792', 'Uran Bislimi'),
  ('uefa:player:4981d62c8a6819db6520e6aa', 'Michal Ďuriš'),
  ('uefa:player:420670da1db64d6aa3f2ef45', 'Álvaro García'),
  ('uefa:player:61c9011f16a02126c4492216', 'Martial Godo'),
  ('uefa:player:665065cd7df70e0a17890abe', 'Jake Grech'),
  ('uefa:player:8ee3e13096647faf5fbe4089', 'Samir Hadji'),
  ('uefa:player:a578eacdf6dfffc4087607b9', 'Kady Borges'),
  ('uefa:player:da92bb862e1ea589a24efd46', 'Erik Karlsson'),
  ('uefa:player:e9dc1b7d92bc8907ac4f7ab5', 'Darko Lemajić'),
  ('uefa:player:29835dc1f49f3e621b56f407', 'Regi Lushkja'),
  ('uefa:player:d95e0172adf7669e9dda4f48', 'Darian Males'),
  ('uefa:player:4c1bb659edf08e9acfd1bdd9', 'Marc Gual'),
  ('uefa:player:fa1fafe071d0f71d3a7532bc', 'Bruno Petković'),
  ('uefa:player:4dc8a60069c28ed4e1c9439e', 'Nikola Petković'),
  ('uefa:player:a11917043cadfe40a054d885', 'Virgile Pinson'),
  ('uefa:player:2a97eff4bd309bff82857142', 'Michał Przybylski'),
  ('uefa:player:c5727b8790c95d04bdfb6e38', 'Roope Riski'),
  ('uefa:player:119ef9572a24897f72ce9929', 'Yira Collins Sor'),
  ('uefa:player:4ae87ff7c493bb5e4dafd444', 'Philipp Sturm'),
  ('uefa:player:769e242d3c23b23dee822f5b', 'Viktor Karl Einarsson'),
  ('uefa:player:23f8adede091bca913bd32d9', 'Tomer Yosefi')
) AS v(entity_id, alias)
WHERE EXISTS (SELECT 1 FROM entities e WHERE e.id = v.entity_id AND e.entity_type = 'player')
ON CONFLICT (entity_id, alias) DO UPDATE SET source_key = EXCLUDED.source_key;
