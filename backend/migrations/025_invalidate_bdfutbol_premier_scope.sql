-- BDFutbol's rankingGEng1 page is labelled Premier League but includes the
-- historical English top flight before the 1992 Premier League era. Preserve
-- those archived imports for audit, but prevent them from being the active
-- ranking for any Premier League category.
UPDATE ranking_snapshots rs
SET status = 'superseded',
    metadata = rs.metadata || jsonb_build_object(
      'invalidatedReason',
      'BDFutbol rankingGEng1 mixes English top-flight seasons before the 1992 Premier League era'
    )
FROM source_snapshots ss
WHERE rs.metadata->>'sourceSnapshotId' = ss.id
  AND ss.source_key = 'bdfutbol-premier-league-records'
  AND rs.status <> 'superseded';
