BEGIN;

-- Earlier CC BY-SA portrait approvals used the provider homepage as the
-- rights evidence URL even though the individual player page was stored in
-- image_assets.metadata. Promote that verified per-asset URL into both the
-- asset and its review ledger. The predicate makes this migration safe to
-- re-run and limits it to the affected approvals.
UPDATE image_assets ia
SET rights_evidence_url = ia.metadata->>'licenseEvidenceUrl'
WHERE ia.provider = 'thesportsdb'
  AND ia.asset_kind = 'portrait'
  AND ia.review_status = 'approved'
  AND ia.rights_evidence_url = 'https://www.thesportsdb.com/'
  AND (ia.metadata->>'licenseEvidenceUrl') LIKE 'https://www.thesportsdb.com/player/%';

UPDATE media_rights_reviews mrr
SET evidence_url = ia.metadata->>'licenseEvidenceUrl'
FROM image_assets ia
WHERE mrr.image_asset_id = ia.id
  AND ia.provider = 'thesportsdb'
  AND ia.asset_kind = 'portrait'
  AND mrr.decision = 'approved'
  AND mrr.evidence_url = 'https://www.thesportsdb.com/'
  AND (ia.metadata->>'licenseEvidenceUrl') LIKE 'https://www.thesportsdb.com/player/%';

COMMIT;
