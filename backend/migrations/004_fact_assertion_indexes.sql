CREATE INDEX IF NOT EXISTS fact_assertions_source_snapshot_idx
  ON fact_assertions(source_snapshot_id);

CREATE INDEX IF NOT EXISTS fact_assertions_subject_type_idx
  ON fact_assertions(subject_entity_id, fact_type);
