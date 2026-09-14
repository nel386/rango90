-- BDFutbol uses Sergio Ramos García while the canonical UEFA catalogue uses
-- Sergio Ramos. This is an explicit reviewed identity link, not a surname
-- heuristic, so image discovery cannot create a second portrait dossier.

INSERT INTO entity_identity_links
  (source_entity_id, canonical_entity_id, confidence, reason, source_key)
VALUES
  (
    'bdfutbol:la-liga:player:aac6625435f910488c3b44a2',
    'uefa:player:04cf3fda53c4035a29db57f9',
    'high',
    'Equivalencia explícita revisada por identificador de fuente: Sergio Ramos García = Sergio Ramos',
    'bdfutbol-la-liga-records'
  )
ON CONFLICT (source_entity_id) DO UPDATE SET
  canonical_entity_id = EXCLUDED.canonical_entity_id,
  confidence = EXCLUDED.confidence,
  reason = EXCLUDED.reason,
  source_key = EXCLUDED.source_key,
  updated_at = NOW();

UPDATE entities
SET metadata = metadata || jsonb_build_object(
      'identityStatus', 'redirect',
      'canonicalEntityId', 'uefa:player:04cf3fda53c4035a29db57f9'
    ),
    updated_at = NOW()
WHERE id = 'bdfutbol:la-liga:player:aac6625435f910488c3b44a2';
