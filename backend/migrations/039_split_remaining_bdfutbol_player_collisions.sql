-- Split the remaining BDFutbol collisions detected by the post-repair audit.
-- Each row is keyed by the exact source URL and is moved to an existing
-- full-name entity; no ranking snapshot is deleted or rewritten in place.

BEGIN;

CREATE TEMP TABLE bdfutbol_player_collision_map_039 (
  source_key TEXT NOT NULL,
  external_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  birth_date DATE NOT NULL,
  PRIMARY KEY (source_key, external_id)
) ON COMMIT DROP;

INSERT INTO bdfutbol_player_collision_map_039 (source_key, external_id, target_entity_id, birth_date)
VALUES
  ('bdfutbol-la-liga-records', 'https://www.bdfutbol.com/en/j/j1543.html', 'bdfutbol:la-liga:player:1e88f074a78e84df65991e3e', '1963-03-23'),
  ('bdfutbol-la-liga-record-scorers', 'https://www.bdfutbol.com/en/j/j1543.html', 'bdfutbol:la-liga:player:1e88f074a78e84df65991e3e', '1963-03-23'),
  ('bdfutbol-ligue-1-records', 'https://www.bdfutbol.com/en/j/j84901.html', 'bdfutbol:ligue-1:player:393030c3af99521db0e2cb13', '1971-04-24'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j71971.html', 'bdfutbol:primeira-liga:player:2e3e91fab1a248c7163be940', '1970-04-04'),
  ('bdfutbol-premier-league-records', 'https://www.bdfutbol.com/en/j/j93783.html', 'bdfutbol:premier-league:player:34bdf8a5c9397cfdabda7e57', '1976-06-23'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j13731.html', 'bdfutbol:primeira-liga:player:a9f08e9099a5064e44f6eca4', '1989-10-06'),
  ('bdfutbol-la-liga-records', 'https://www.bdfutbol.com/en/j/j1607.html', 'bdfutbol:la-liga:player:7eca0019c6029cfd4332d0ed', '1968-06-07'),
  ('bdfutbol-la-liga-record-scorers', 'https://www.bdfutbol.com/en/j/j1607.html', 'bdfutbol:la-liga:player:7eca0019c6029cfd4332d0ed', '1968-06-07'),
  ('bdfutbol-bundesliga-records', 'https://www.bdfutbol.com/en/j/j90135.html', 'bdfutbol:bundesliga:player:668ea5669017767a77950b17', '1978-10-03'),
  ('bdfutbol-serie-a-records', 'https://www.bdfutbol.com/en/j/j95625.html', 'bdfutbol:serie-a:player:43f1328b8ea418289d46b7c7', '1979-09-11'),
  ('bdfutbol-la-liga-records', 'https://www.bdfutbol.com/en/j/j1669.html', 'bdfutbol:la-liga:player:57da8a3e03123a811ccd682e', '1973-07-12'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j4407.html', 'bdfutbol:primeira-liga:player:4037061a508093cefa1aa27a', '1974-06-03');

UPDATE entities e
SET birth_date = m.birth_date,
    metadata = e.metadata || jsonb_build_object('identityRepair', 'bdfutbol-exact-player-url-2026-09-09'),
    updated_at = NOW()
FROM bdfutbol_player_collision_map_039 m
WHERE e.id = m.target_entity_id;

UPDATE entity_external_ids ex
SET entity_id = m.target_entity_id,
    updated_at = NOW()
FROM bdfutbol_player_collision_map_039 m
WHERE ex.source_key = m.source_key
  AND ex.entity_type = 'player'
  AND ex.external_id = m.external_id;

UPDATE ranking_entries re
SET entity_id = m.target_entity_id
FROM bdfutbol_player_collision_map_039 m
WHERE re.evidence->>'externalId' = m.external_id;

UPDATE fact_assertions fa
SET subject_entity_id = re.entity_id
FROM ranking_entries re
JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
JOIN bdfutbol_player_collision_map_039 m ON m.external_id = re.evidence->>'externalId'
WHERE fa.source_snapshot_id = rs.metadata->>'sourceSnapshotId'
  AND fa.metadata->>'sourceRank' = re.evidence->>'sourceRank'
  AND fa.value->>'categorySlug' = (
    SELECT cd.slug
    FROM category_definitions cd
    WHERE cd.id = rs.category_id
  );

INSERT INTO entity_identity_links
  (source_entity_id, canonical_entity_id, confidence, reason, source_key)
VALUES
  ('bdfutbol:la-liga:player:1e88f074a78e84df65991e3e', 'pl:player:3810', 'high', 'URL BDFutbol exacta y fecha de nacimiento: José Miguel González Martín del Campo (Míchel)', 'bdfutbol-la-liga-records'),
  ('bdfutbol:premier-league:player:34bdf8a5c9397cfdabda7e57', 'pl:player:1132', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Patrick Paul Vieira', 'bdfutbol-premier-league-records'),
  ('bdfutbol:primeira-liga:player:a9f08e9099a5064e44f6eca4', 'uefa:player:6d7405f519a77a55aee022c7', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Luís Miguel Afonso Fernandes (Pizzi)', 'bdfutbol-primeira-liga-records'),
  ('bdfutbol:bundesliga:player:668ea5669017767a77950b17', 'pl:player:3367', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Claudio Miguel Pizarro Bossio', 'bdfutbol-bundesliga-records'),
  ('bdfutbol:serie-a:player:43f1328b8ea418289d46b7c7', 'pl:player:4324', 'high', 'URL BDFutbol exacta y fecha de nacimiento: David Marcelo Pizarro Cortés', 'bdfutbol-serie-a-records')
ON CONFLICT (source_entity_id) DO UPDATE SET
  canonical_entity_id = EXCLUDED.canonical_entity_id,
  confidence = EXCLUDED.confidence,
  reason = EXCLUDED.reason,
  source_key = EXCLUDED.source_key,
  updated_at = NOW();

UPDATE entities e
SET metadata = e.metadata || jsonb_build_object('identityStatus', 'linked-source'),
    updated_at = NOW()
WHERE e.id IN (
  'bdfutbol:la-liga:player:1e88f074a78e84df65991e3e',
  'bdfutbol:premier-league:player:34bdf8a5c9397cfdabda7e57',
  'bdfutbol:primeira-liga:player:a9f08e9099a5064e44f6eca4',
  'bdfutbol:bundesliga:player:668ea5669017767a77950b17',
  'bdfutbol:serie-a:player:43f1328b8ea418289d46b7c7'
);

COMMIT;
