import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../db.js';
import { config } from '../config.js';
import { buildPlayableMediaAudit, renderPlayableMediaAuditCsv, renderPlayableMediaAuditMarkdown, type PlayableMediaAuditEntry } from '../playableMediaAudit.js';

const outputDirectory = resolve(config.auditOutputRoot, 'media');

const result = await pool.query<PlayableMediaAuditEntry & { generated_at: string | null }>(
  `WITH ranked_pool AS (
     SELECT DISTINCT ON (canonical_entity.id, category.slug)
            canonical_entity.id AS "entityId", canonical_entity.canonical_name AS "canonicalName",
            category.slug AS "categorySlug", ranking.rank,
            MAX(ranking_snapshot.generated_at) OVER () AS generated_at,
            CASE
              WHEN approved_asset.entity_id IS NOT NULL THEN 'licensed'
              WHEN canonical_entity.id IS NOT NULL THEN 'fallback'
              ELSE 'unavailable'
            END AS "mediaStatus",
            CASE
              WHEN approved_asset.entity_id IS NOT NULL THEN 'approved'
              WHEN pending_asset.entity_id IS NOT NULL THEN 'pending'
              WHEN rejected_asset.entity_id IS NOT NULL THEN 'rejected'
              ELSE 'missing'
            END AS "reviewStatus",
            CASE
              WHEN approved_asset.entity_id IS NOT NULL THEN 'approved'
              WHEN pending_asset.entity_id IS NOT NULL THEN 'review_required'
              WHEN rejected_asset.entity_id IS NOT NULL THEN 'rejected'
              ELSE 'missing'
            END AS "rightsStatus",
            (approved_asset.entity_id IS NOT NULL) AS "isPublishable",
            (category.slug = 'world-cup-goals'
             AND ROW_NUMBER() OVER (PARTITION BY category.slug ORDER BY ranking.rank, ranking.entity_id) <= 20
             AND approved_asset.entity_id IS NULL) AS priority,
            CASE
              WHEN approved_asset.entity_id IS NOT NULL THEN 'Existe un retrato aprobado y publicable.'
              WHEN pending_asset.entity_id IS NOT NULL THEN 'Existe un candidato pendiente de revisión; no es publicable todavía.'
              WHEN rejected_asset.entity_id IS NOT NULL THEN 'Los candidatos existentes están rechazados; se conserva fallback.'
              ELSE 'No existe retrato aprobado; se sirve fallback propio.'
            END AS reason
       FROM ranking_entries ranking
       JOIN ranking_snapshots ranking_snapshot ON ranking_snapshot.id = ranking.snapshot_id AND ranking_snapshot.status <> 'superseded'
       JOIN category_definitions category ON category.id = ranking_snapshot.category_id AND category.status <> 'retired'
       JOIN entities source_entity ON source_entity.id = ranking.entity_id AND source_entity.entity_type = 'player'
       LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = source_entity.id
       JOIN entities canonical_entity ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, source_entity.id)
       JOIN entity_game_profiles profile ON profile.entity_id = canonical_entity.id AND profile.playable_default = TRUE
       LEFT JOIN LATERAL (
         SELECT ia.entity_id FROM image_assets ia
          WHERE ia.entity_id = canonical_entity.id AND ia.asset_kind = 'portrait' AND ia.is_primary = TRUE
            AND ia.review_status = 'approved' AND ia.rights_basis <> 'unknown' AND ia.commercial_use = TRUE
            AND ia.rights_verified_at IS NOT NULL AND ia.rights_evidence_url IS NOT NULL
            AND jsonb_array_length(ia.usage_scope) > 0
            AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
          LIMIT 1
       ) approved_asset ON TRUE
       LEFT JOIN LATERAL (SELECT ia.entity_id FROM image_assets ia WHERE ia.entity_id = canonical_entity.id AND ia.asset_kind = 'portrait' AND ia.review_status = 'pending' LIMIT 1) pending_asset ON TRUE
       LEFT JOIN LATERAL (SELECT ia.entity_id FROM image_assets ia WHERE ia.entity_id = canonical_entity.id AND ia.asset_kind = 'portrait' AND ia.review_status = 'rejected' LIMIT 1) rejected_asset ON TRUE
      WHERE ranking.rank <= 200 AND canonical_entity.catalog_status = 'active'
        AND EXISTS (
          SELECT 1 FROM ranking_entries boundary_entry
          JOIN ranking_snapshots boundary_snapshot ON boundary_snapshot.id = boundary_entry.snapshot_id AND boundary_snapshot.status <> 'superseded'
          LEFT JOIN entity_identity_links boundary_identity ON boundary_identity.source_entity_id = boundary_entry.entity_id
          WHERE boundary_entry.rank <= 200 AND COALESCE(boundary_identity.canonical_entity_id, boundary_entry.entity_id) = canonical_entity.id
        )
      ORDER BY canonical_entity.id, category.slug, ranking.rank, ranking.entity_id
   )
   SELECT * FROM ranked_pool
   ORDER BY priority DESC, rank, "canonicalName", "entityId"`, []
);

const watermark = result.rows.map((row) => row.generated_at).filter(Boolean).sort().at(-1) ?? null;
const auditEntries = result.rows.map((entry) => {
  return {
    entityId: entry.entityId,
    canonicalName: entry.canonicalName,
    categorySlug: entry.categorySlug,
    rank: entry.rank,
    mediaStatus: entry.mediaStatus,
    reviewStatus: entry.reviewStatus,
    rightsStatus: entry.rightsStatus,
    isPublishable: entry.isPublishable,
    priority: entry.priority,
    reason: entry.reason
  };
});
const report = buildPlayableMediaAudit(auditEntries, watermark);
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'playable-media-audit.json'), JSON.stringify(report, null, 2) + '\n'),
  writeFile(resolve(outputDirectory, 'playable-media-audit.md'), renderPlayableMediaAuditMarkdown(report)),
  writeFile(resolve(outputDirectory, 'playable-media-audit.csv'), renderPlayableMediaAuditCsv(report))
]);
console.log(JSON.stringify({ readOnly: true, productionData: false, editorialApproval: false, outputDirectory, appearancesTotal: report.appearancesTotal, canonicalEntitiesTotal: report.canonicalEntitiesTotal, priorityMissingApprovedPortraits: report.priorityMissingApprovedPortraits, sha256: report.sha256 }, null, 2));
await pool.end();
