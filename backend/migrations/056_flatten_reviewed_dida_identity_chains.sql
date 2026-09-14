-- Flatten the two explicitly reviewed Dida identity chains.
-- The source rows remain in the catalogue and their evidence is preserved;
-- only the link target is changed from the intermediate RSSSF row to the
-- already reviewed API-Football canonical row so one-hop readers are safe.
BEGIN;

UPDATE entity_identity_links
SET canonical_entity_id = 'api-football:player:384441',
    reason = reason || '; flattened reviewed Dida identity chain',
    updated_at = NOW()
WHERE source_entity_id IN (
  'bdfutbol:serie-a:player:9acb485b98b06d1eb250cf4b',
  'iffhs:goalkeeper:player:b9e15dbae786450ac08e525f'
)
  AND canonical_entity_id = 'rsssf:goalkeeper:player:14830a9aaf8ef4c53dd282e0';

COMMIT;
