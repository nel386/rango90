-- Repair known historical-icon identity collisions found during the roster audit.
-- Facts and source rows are retained; only the canonical identity/profile/media
-- admission used by the game is corrected.
BEGIN;

-- These source records are the intended historical players, but their dates
-- were missing or contaminated by an unrelated API-Football profile.
UPDATE entities
SET birth_date = DATE '1926-07-04', updated_at = NOW(),
    metadata = metadata || '{"identityRepair":"historical-icon-audit-2026-09-13"}'::jsonb
WHERE id = 'france-football:player:10288';

UPDATE entities
SET birth_date = DATE '1942-01-25', updated_at = NOW(),
    metadata = (metadata - ARRAY['provider','providerPlayerId','firstname','lastname','photoUrl','birthPlace','birthCountry','height','weight','nationality'])
      || '{"identityRepair":"historical-icon-audit-2026-09-13"}'::jsonb
WHERE id = 'france-football:player:10294';

UPDATE entities
SET birth_date = DATE '1947-04-25', updated_at = NOW(),
    metadata = metadata || '{"identityRepair":"historical-icon-audit-2026-09-13"}'::jsonb
WHERE id = 'france-football:player:9627';

UPDATE entities
SET canonical_name = 'Kaká', birth_date = DATE '1982-04-22', updated_at = NOW(),
    metadata = (metadata - ARRAY['provider','providerPlayerId','firstname','lastname','photoUrl','birthPlace','birthCountry','height','weight','nationality'])
      || '{"identityRepair":"historical-icon-audit-2026-09-13"}'::jsonb
WHERE id = 'france-football:player:46710';

UPDATE entities
SET birth_date = DATE '1940-10-23', updated_at = NOW(),
    metadata = metadata || '{"identityRepair":"historical-icon-audit-2026-09-13"}'::jsonb
WHERE id = 'transfermarkt:world-cup:player:0f03fc0cf25d0c58202b8f98';

-- This RSSSF row carries API-Football identity data for Judilson Tuncará
-- Gomes, not the Brazilian Pelé. It remains as raw evidence but is not a game
-- player and its portrait cannot remain approved under the Pelé label.
UPDATE entity_game_profiles
SET legacy_tier = 'classic_legacy', playable_default = FALSE,
    reason = 'Identidad incompatible: registro RSSSF contaminado con otro jugador; conservado solo como histórico bruto',
    reviewed_at = NOW(),
    metadata = metadata || '{"identityRepair":"historical-icon-audit-2026-09-13","curated":false}'::jsonb
WHERE entity_id = 'rsssf:international:player:3a2f79afbeb7ae44fac0d76a';

UPDATE entities
SET catalog_status = 'excluded_from_game', updated_at = NOW(),
    metadata = metadata || '{"identityRepair":"historical-icon-audit-2026-09-13","excludedReason":"wrong-pelé-identity"}'::jsonb
WHERE id = 'rsssf:international:player:3a2f79afbeb7ae44fac0d76a';

UPDATE image_assets
SET review_status = 'rejected', is_primary = FALSE,
    rights_basis = 'unknown', commercial_use = FALSE,
    rights_verified_at = NULL, rights_evidence_url = NULL,
    rights_notes = 'Identidad incompatible: asset asociado a registro incorrecto de Pelé'
WHERE entity_id = 'rsssf:international:player:3a2f79afbeb7ae44fac0d76a';

COMMIT;
