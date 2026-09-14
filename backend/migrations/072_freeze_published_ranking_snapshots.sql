-- Published ranking snapshots are append-only evidence. A published snapshot
-- may be superseded by a newer snapshot, but its contents and metadata may not
-- be changed and its entries may not be inserted, updated, or deleted.

CREATE OR REPLACE FUNCTION rango90_freeze_published_ranking_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'published ranking snapshots are immutable' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'published' AND (
    NEW.id <> OLD.id OR
    NEW.category_id <> OLD.category_id OR
    NEW.data_version <> OLD.data_version OR
    NEW.algorithm_version <> OLD.algorithm_version OR
    NEW.content_sha256 <> OLD.content_sha256 OR
    NEW.generated_at IS DISTINCT FROM OLD.generated_at OR
    NEW.coverage_complete IS DISTINCT FROM OLD.coverage_complete OR
    NEW.eligible_count <> OLD.eligible_count OR
    NEW.unresolved_conflicts <> OLD.unresolved_conflicts OR
    NEW.metadata IS DISTINCT FROM OLD.metadata OR
    NEW.status NOT IN ('published', 'superseded')
  ) THEN
    RAISE EXCEPTION 'published ranking snapshots are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ranking_snapshot_freeze_trigger ON ranking_snapshots;
CREATE TRIGGER ranking_snapshot_freeze_trigger
  BEFORE UPDATE OR DELETE ON ranking_snapshots
  FOR EACH ROW EXECUTE FUNCTION rango90_freeze_published_ranking_snapshot();

CREATE OR REPLACE FUNCTION rango90_freeze_published_ranking_entries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  snapshot_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD.snapshot_id ELSE NEW.snapshot_id END;
BEGIN
  IF EXISTS (SELECT 1 FROM ranking_snapshots WHERE id = snapshot_id AND status = 'published') THEN
    RAISE EXCEPTION 'published ranking snapshot entries are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS ranking_entries_freeze_trigger ON ranking_entries;
CREATE TRIGGER ranking_entries_freeze_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON ranking_entries
  FOR EACH ROW EXECUTE FUNCTION rango90_freeze_published_ranking_entries();
