-- Repair the six two-node identity cycles created when reciprocal catalog
-- consolidations ran in different orders. Keep the entity that actually owns
-- the ranking/assets as the canonical target; preserve the reverse alias link
-- so external source identities still resolve to it.
DELETE FROM entity_identity_links
WHERE (source_entity_id, canonical_entity_id) IN (
  ('bdfutbol:serie-a:player:1f3d02af868aa4ed92969aab', 'wikipedia-it:serie-a:player:401520b07710787f1dc7975c'),
  ('bdfutbol:serie-a:player:5b0239f685e3f0f357734bcc', 'wikipedia-it:serie-a:player:10dcc457791b9bfc65145202'),
  ('bdfutbol:serie-a:player:b23d114036a536b632198d14', 'wikipedia-it:serie-a:player:ef734b90550d708fd123f10b'),
  ('bdfutbol:serie-a:player:c06ae948134332e5b66a7f4c', 'wikipedia-it:serie-a:player:9f85caa20c065cb94251ba8c'),
  ('bdfutbol:serie-a:player:d51838431e61a16c4323f589', 'wikipedia-it:serie-a:player:3a7aef50b25cad5c45c44109'),
  ('wikipedia-es:copa-del-rey:club:1062bf49fd57223c47600fea', 'uefa:europa:club:61d6f57edf9f3d273eabba3b')
);
