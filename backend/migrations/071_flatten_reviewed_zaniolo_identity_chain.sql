-- Flatten the one remaining reviewed identity chain found by the current
-- catalog audit. Keep both UEFA source entities and all their evidence; only
-- redirect the older source link to the already reviewed canonical player so
-- one-hop ranking/media readers resolve the same person.
BEGIN;

UPDATE entity_identity_links
SET canonical_entity_id = 'pl:player:22795',
    reason = reason || '; flattened reviewed Zaniolo identity chain',
    updated_at = NOW()
WHERE source_entity_id = 'uefa:player:73e7744cbe1849644fa242a1'
  AND canonical_entity_id = 'uefa:player:abbb901952dc98cc287ca7c9';

COMMIT;

