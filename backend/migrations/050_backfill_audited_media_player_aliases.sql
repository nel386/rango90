-- Preserve the exact provider names used to validate staged portraits.
-- These are identity-search aliases only; they do not grant media rights.
BEGIN;

INSERT INTO entity_aliases (entity_id, alias, source_key)
SELECT DISTINCT ia.entity_id,
       COALESCE(ia.metadata->>'playerName', ia.metadata->>'sourcePlayerName') AS alias,
       'thesportsdb-identity-audit'
FROM image_assets ia
JOIN entities e ON e.id = ia.entity_id AND e.entity_type = 'player'
WHERE ia.asset_kind = 'portrait'
  AND ia.review_status = 'pending'
  AND NULLIF(COALESCE(ia.metadata->>'playerName', ia.metadata->>'sourcePlayerName'), '') IS NOT NULL
  AND (
    (ia.provider = 'thesportsdb' AND ia.metadata #>> '{identityAudit,providerNameMatches}' = 'true')
    OR (ia.provider = 'api-football' AND ia.metadata->>'source' = 'thesportsdb-exact-player')
  )
ON CONFLICT (entity_id, alias) DO NOTHING;

COMMIT;
