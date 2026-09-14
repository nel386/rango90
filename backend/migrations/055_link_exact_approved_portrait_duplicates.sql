-- Consolidate source player entities when the exact same approved portrait is
-- attached to them.  An identical normalized SHA-256 plus a matching player
-- identity is strong evidence of an accidental source split, but the source
-- entities and their historical facts/assets are deliberately preserved.
--
-- This migration is intentionally explicit and idempotent.  It does not
-- merge by name alone and it does not infer identity from an unreviewed image.
BEGIN;

INSERT INTO sources (key, name, source_type, usage_notes, rights_status)
VALUES (
  'rango90-exact-portrait-identity-audit',
  'Rango 90 exact approved portrait identity audit',
  'manual',
  'Internal identity evidence: an approved normalized portrait has the exact same SHA-256 on two source player entities with matching identity context.',
  'unknown'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO entity_identity_links
  (source_entity_id, canonical_entity_id, confidence, reason, source_key)
SELECT source_entity_id, canonical_entity_id, confidence, reason,
       'rango90-exact-portrait-identity-audit'
FROM (VALUES
  ('pl:player:3247', 'rsssf:international:player:2a05d814e4f054a8e26de461', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'pl'),
  ('rsssf:international:player:2b504f78b6b9176e299abddd', 'pl:player:4973', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:international:player:4460d2f1f7b4f8acb2478846', 'france-football:player:9446', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:international:player:59a6d8eacede0829eec4413b', 'bdfutbol:la-liga:player:8496753b629895ff211f4d41', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:international:player:8639aa46975a96c4cefa56ab', 'france-football:player:9951', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:international:player:bb0840d319b91147ed89da99', 'france-football:player:53960', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:serie-a:player:b516d0461d67129523df966a', 'wikipedia-it:serie-a:player:087d2d52f90f03789f847e2b', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:47cc642a60d9c509316f68ae', 'pl:player:12901', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:5b4e1d5652cd59affbadef08', 'france-football:player:9494', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:659dd19cd289e5a00dc95467', 'pl:player:49481', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:666488e34484e12fd65e8ba1', 'rsssf:international:player:b0779271f54447c3d4b00de1', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:68b00743883104baf28121a4', 'france-football:player:9663', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:7646f42a873313cbca945d26', 'rsssf:international:player:4952555376407d6375bde5eb', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:7ee1e2ef5bdf2b594537b40b', 'france-football:player:16111', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:99bb15e95ea766d978eff7fc', 'france-football:player:9441', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:9dcc571f7829a8e642ca8521', 'uefa:player:0484e7fe0d00a68288865d80', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:b6c6a64df58b13dfad499142', 'rsssf:international:player:8e4813abd22b5f0be733017f', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:b7d14cf360df3ad36e8b7ad0', 'uefa:player:5cf267dd10c20c4f6346c154', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:bff57f4faa565fd20aa18746', 'rsssf:international:player:90d81888922321233e537597', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:c0c0844b84bc9447005ef429', 'rsssf:international:player:2fb097f1f2d1a3551bfe8eac', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:f0db8039c25819b651f82c37', 'rsssf:international:player:e5d0d8f7fdde9ec3aaa0e71d', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('rsssf:world-cup:player:7dc301eeb31f3c3e0e7c1cd9', 'pl:player:991', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'rsssf'),
  ('uefa:player:b87b0795380a361c50a9f473', 'pl:player:1217', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('statbunker:world-cup:player:18214', 'pl:player:2417', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'statbunker'),
  ('statbunker:world-cup:player:23604', 'pl:player:4138', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'statbunker'),
  ('uefa:player:1755d621deec40395dbacbe5', 'rsssf:world-cup:player:47561c11937a22f411515250', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:2cf051a8f2dbc23185ff683c', 'pl:player:4845', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:3dc40936dd951ecd16b18c48', 'api-football:player:386', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:41fea66bd580f38b2985fc9f', 'france-football:player:4022', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:454d0d05d2d07b33d1552fe1', 'pl:player:5698', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:5faa198102364158c82c575f', 'rsssf:international:player:4adb8de2a54aaff6966fdfe4', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:8074bd255eb9e093daa7f5db', 'statbunker:world-cup:player:21835', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:a5e9148c92cd115b1dbf2003', 'rsssf:international:player:f52d60da4e277f58de4dc77a', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:ad8f471134140e8bd8b216f2', 'api-football:player:56', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:f7cddab2791916f36d46f81d', 'pl:player:4151', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('uefa:player:fc0995126f4cd618a44d4220', 'rsssf:international:player:13c393f997c3c414b1c6493d', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'uefa'),
  ('wikipedia-it:serie-a:player:1e48f87dbbb30c785b973164', 'pl:player:5772', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'wikipedia-it'),
  ('wikipedia-it:serie-a:player:9b9c1df8a4e147bc7521cde5', 'rsssf:international:player:8e4813abd22b5f0be733017f', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'wikipedia-it'),
  ('wikipedia-it:serie-a:player:f61271c20c605e2ce2c6699f', 'uefa:player:1e55bc7ed04280152efb1a25', 'high', 'Same approved normalized portrait SHA-256 and matching player identity', 'wikipedia-it')
) AS links(source_entity_id, canonical_entity_id, confidence, reason, original_source_key)
WHERE EXISTS (
        SELECT 1 FROM entities source_entity
        WHERE source_entity.id = links.source_entity_id
          AND source_entity.entity_type = 'player'
      )
  AND EXISTS (
        SELECT 1 FROM entities canonical_entity
        WHERE canonical_entity.id = links.canonical_entity_id
          AND canonical_entity.entity_type = 'player'
      )
ON CONFLICT (source_entity_id) DO UPDATE
SET canonical_entity_id = EXCLUDED.canonical_entity_id,
    confidence = EXCLUDED.confidence,
    reason = EXCLUDED.reason,
    source_key = EXCLUDED.source_key,
    updated_at = NOW();

COMMIT;
