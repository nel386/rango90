-- Keep one current draft per category while preserving every old snapshot
-- for audit and reproducibility. Approved/published snapshots are immutable.
WITH current AS (
  SELECT DISTINCT ON (category_id) id, category_id, generated_at
  FROM ranking_snapshots
  WHERE status = 'draft'
  ORDER BY category_id, generated_at DESC, id DESC
), old_drafts AS (
  SELECT rs.id
  FROM ranking_snapshots rs
  JOIN current c ON c.category_id = rs.category_id
  WHERE rs.status = 'draft'
    AND rs.id <> c.id
    AND rs.generated_at <= c.generated_at
)
UPDATE ranking_snapshots rs
SET status = 'superseded'
FROM old_drafts old
WHERE rs.id = old.id;
