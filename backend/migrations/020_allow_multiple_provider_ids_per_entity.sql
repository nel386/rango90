-- A provider may expose more than one stable record for the same real-world
-- entity (for example, separate artwork/team records). Keep every provider
-- identifier instead of forcing the canonical entity to choose one.
ALTER TABLE entity_external_ids
  DROP CONSTRAINT IF EXISTS entity_external_ids_entity_id_source_key_entity_type_key;

CREATE INDEX IF NOT EXISTS entity_external_ids_entity_source_type_idx
  ON entity_external_ids (entity_id, source_key, entity_type);
