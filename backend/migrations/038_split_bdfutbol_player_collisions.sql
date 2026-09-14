-- Split BDFutbol player identifiers that were previously attached to a
-- surname-only canonical entity. The destination entities already exist in
-- the catalogue; this migration moves only rows identified by the exact
-- BDFutbol player URL, preserving the original snapshots and evidence.

BEGIN;

CREATE TEMP TABLE bdfutbol_player_collision_map (
  source_key TEXT NOT NULL,
  external_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  birth_date DATE NOT NULL,
  PRIMARY KEY (source_key, external_id)
) ON COMMIT DROP;

INSERT INTO bdfutbol_player_collision_map (source_key, external_id, target_entity_id, birth_date)
VALUES
  ('bdfutbol-la-liga-records', 'https://www.bdfutbol.com/en/j/j756.html', 'bdfutbol:la-liga:player:df6ce2914df7e498d400edd1', '1965-09-11'),
  ('bdfutbol-la-liga-records', 'https://www.bdfutbol.com/en/j/j768.html', 'bdfutbol:la-liga:player:4bc8a782ea8c10db91af0601', '1961-08-15'),
  ('bdfutbol-ligue-1-records', 'https://www.bdfutbol.com/en/j/j94334.html', 'bdfutbol:ligue-1:player:0ecd7d15f46e71ca1a31428a', '1978-03-30'),
  ('bdfutbol-ligue-1-records', 'https://www.bdfutbol.com/en/j/j94605.html', 'bdfutbol:ligue-1:player:5702450800ff238b92536bfd', '1981-08-12'),
  ('bdfutbol-premier-league-records', 'https://www.bdfutbol.com/en/j/j25035.html', 'bdfutbol:premier-league:player:ee4de60eb21bda6f2c35a632', '1985-02-16'),
  ('bdfutbol-premier-league-records', 'https://www.bdfutbol.com/en/j/j80486.html', 'bdfutbol:premier-league:player:11775d95f686b156ec37f41e', '1954-04-19'),
  ('bdfutbol-premier-league-records', 'https://www.bdfutbol.com/en/j/j80516.html', 'bdfutbol:premier-league:player:2678de7951284b43cbff9454', '1962-11-21'),
  ('bdfutbol-premier-league-records', 'https://www.bdfutbol.com/en/j/j95646.html', 'bdfutbol:premier-league:player:2495be46cfd620d595032c7a', '1991-04-29'),
  ('bdfutbol-premier-league-records', 'https://www.bdfutbol.com/en/j/j52057.html', 'bdfutbol:premier-league:player:b6155e2f5c1c0bb621faaf75', '1945-10-03'),
  ('bdfutbol-premier-league-records', 'https://www.bdfutbol.com/en/j/j93945.html', 'bdfutbol:premier-league:player:746c04b23db10f6d03d9370b', '1979-10-13'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j18025.html', 'bdfutbol:primeira-liga:player:42e651641a399bc09028df21', '1982-05-01'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j71120.html', 'bdfutbol:primeira-liga:player:9498c09037281140710e5126', '1976-11-20'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j4070.html', 'bdfutbol:primeira-liga:player:d15d780b7203c4e12f40ee44', '1976-02-11'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j70207.html', 'bdfutbol:primeira-liga:player:8a3293e3b2c55c3b6bffe33f', '1980-08-19'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j6476.html', 'bdfutbol:primeira-liga:player:d6067b73db45cd637e16ac2a', '1975-07-04'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j77009.html', 'bdfutbol:primeira-liga:player:cbe106ca3e7683d10bfe801f', '1975-04-16'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j70685.html', 'bdfutbol:primeira-liga:player:647ff68b594963902c79b6ce', '1992-11-09'),
  ('bdfutbol-primeira-liga-records', 'https://www.bdfutbol.com/en/j/j71922.html', 'bdfutbol:primeira-liga:player:73c72df335a00a5f741e4e11', '1966-05-26'),
  ('bdfutbol-serie-a-records', 'https://www.bdfutbol.com/en/j/j95641.html', 'bdfutbol:serie-a:player:4cf03a24e63d5f81ce5cd096', '1979-10-22'),
  ('bdfutbol-serie-a-records', 'https://www.bdfutbol.com/en/j/j463.html', 'bdfutbol:serie-a:player:fbc950217b1ef7f6710704bb', '1973-04-01');

UPDATE entities e
SET birth_date = m.birth_date,
    metadata = e.metadata || jsonb_build_object('identityRepair', 'bdfutbol-exact-player-url-2026-09-09'),
    updated_at = NOW()
FROM bdfutbol_player_collision_map m
WHERE e.id = m.target_entity_id;

-- Move the source identifier to the exact destination entity.
UPDATE entity_external_ids ex
SET entity_id = m.target_entity_id,
    updated_at = NOW()
FROM bdfutbol_player_collision_map m
WHERE ex.source_key = m.source_key
  AND ex.entity_type = 'player'
  AND ex.external_id = m.external_id;

-- Ranking entries are keyed by snapshot/entity, so move them using the exact
-- evidence URL rather than a name or surname heuristic.
UPDATE ranking_entries re
SET entity_id = m.target_entity_id
FROM bdfutbol_player_collision_map m
WHERE re.evidence->>'externalId' = m.external_id;

-- Facts generated from those ranking snapshots carry the source rank. Match
-- that rank back to the moved ranking entry and keep the same target entity.
UPDATE fact_assertions fa
SET subject_entity_id = re.entity_id
FROM ranking_entries re
JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
JOIN bdfutbol_player_collision_map m ON m.external_id = re.evidence->>'externalId'
WHERE fa.source_snapshot_id = rs.metadata->>'sourceSnapshotId'
  AND fa.metadata->>'sourceRank' = re.evidence->>'sourceRank'
  AND fa.value->>'categorySlug' = (
    SELECT cd.slug
    FROM category_definitions cd
    WHERE cd.id = rs.category_id
  );

-- Reviewed cross-provider equivalences. The remaining destinations stay
-- independent until another source confirms the identity.
INSERT INTO entity_identity_links
  (source_entity_id, canonical_entity_id, confidence, reason, source_key)
VALUES
  ('bdfutbol:ligue-1:player:0ecd7d15f46e71ca1a31428a', 'pl:player:2394', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Édouard Léopold Cissé', 'bdfutbol-ligue-1-records'),
  ('bdfutbol:ligue-1:player:5702450800ff238b92536bfd', 'pl:player:2723', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Djibril Cissé', 'bdfutbol-ligue-1-records'),
  ('bdfutbol:premier-league:player:ee4de60eb21bda6f2c35a632', 'pl:player:8044', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Simon Francis', 'bdfutbol-premier-league-records'),
  ('bdfutbol:premier-league:player:11775d95f686b156ec37f41e', 'pl:player:515', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Trevor Francis', 'bdfutbol-premier-league-records'),
  ('bdfutbol:premier-league:player:2678de7951284b43cbff9454', 'pl:player:1412', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Alan Martin Smith', 'bdfutbol-premier-league-records'),
  ('bdfutbol:premier-league:player:746c04b23db10f6d03d9370b', 'pl:player:1211', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Wesley Michael Brown', 'bdfutbol-premier-league-records'),
  ('bdfutbol:serie-a:player:4cf03a24e63d5f81ce5cd096', 'pl:player:4312', 'high', 'URL BDFutbol exacta y fecha de nacimiento: Doniéber Alexander Marangon (Doni)', 'bdfutbol-serie-a-records')
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
  'bdfutbol:ligue-1:player:0ecd7d15f46e71ca1a31428a',
  'bdfutbol:ligue-1:player:5702450800ff238b92536bfd',
  'bdfutbol:premier-league:player:ee4de60eb21bda6f2c35a632',
  'bdfutbol:premier-league:player:11775d95f686b156ec37f41e',
  'bdfutbol:premier-league:player:2678de7951284b43cbff9454',
  'bdfutbol:premier-league:player:746c04b23db10f6d03d9370b',
  'bdfutbol:serie-a:player:4cf03a24e63d5f81ce5cd096'
);

COMMIT;
