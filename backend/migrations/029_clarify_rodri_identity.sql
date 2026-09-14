-- France Football's short label "Rodri" refers to Rodrigo Hernández Cascante.
-- Keep the display name unchanged while making Commons discovery disambiguate him.
INSERT INTO entity_aliases (entity_id, alias, source_key)
VALUES
  ('france-football:player:58597', 'Rodri Hernández', 'france-football'),
  ('france-football:player:58597', 'Rodrigo Hernández Cascante', 'france-football')
ON CONFLICT (entity_id, alias) DO NOTHING;
