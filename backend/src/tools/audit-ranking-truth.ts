import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDb, pool } from '../db.js';
import { SELECTED_DAILY_CATEGORY_SLUGS } from '../dailyMatrix.js';
import {
  buildRankingTruthAudit,
  rankingTruthCsv,
  rankingTruthJson,
  rankingTruthMarkdown,
  type AuditCategoryInput,
  type AuditEntryInput,
  type AuditEntityType
} from '../rankingTruthAudit.js';

const MAX_TOP_RANK = 200;

type CategoryRow = {
  slug: string;
  label_es: string;
  label_en: string;
  definition_md: string;
  entity_type: AuditEntityType;
  metric_key: string;
  scope_kind: string;
  scope: Record<string, unknown>;
  category_status: string;
  ranking_direction: 'asc' | 'desc';
  snapshot_id: string | null;
  snapshot_status: string | null;
  data_version: string | null;
  algorithm_version: string | null;
  content_sha256: string | null;
  generated_at: string | null;
  coverage_complete: boolean | null;
  unresolved_conflicts: number | null;
  eligible_count: number | null;
  score_cap: number | null;
  snapshot_rows_total: number;
  snapshot_source_id: string | null;
  source_snapshot_id: string | null;
  source_key: string | null;
  source_name: string | null;
  source_base_url: string | null;
  source_rights_status: string | null;
  source_retrieved_at: string | null;
  source_published_at: string | null;
  source_storage_uri: string | null;
  source_content_sha256: string | null;
  source_metadata: Record<string, unknown>;
  snapshot_metadata: Record<string, unknown>;
};

type EntryRow = {
  category_slug: string;
  snapshot_id: string;
  source_entity_id: string;
  source_name: string;
  source_entity_type: AuditEntityType;
  canonical_entity_id: string | null;
  canonical_name: string | null;
  canonical_entity_type: AuditEntityType | null;
  raw_value: string | number;
  rank: number;
  score_value: number;
  tie_group: number;
  evidence: Record<string, unknown>;
};

type EntityRow = { id: string; entity_type: AuditEntityType; canonical_name: string; catalog_status: string | null };
type ExternalRow = { source_key: string; entity_type: AuditEntityType; external_id: string; entity_id: string };
type AliasRow = { entity_id: string; alias: string; source_key: string | null };
type ProfileRow = { entity_id: string; playable_default: boolean };
type MediaRow = { id: string; entity_id: string; review_status: string; is_primary: boolean; provider: string; rights_evidence_url: string | null; rights_verified_at: string | null; metadata: Record<string, unknown> };

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function selectedSlugs(): string[] {
  const value = arg('category');
  const slugs = (value ? value.split(',') : [...SELECTED_DAILY_CATEGORY_SLUGS]).map((slug) => slug.trim()).filter(Boolean);
  if (slugs.length === 0 || new Set(slugs).size !== slugs.length) throw new Error('--category debe contener uno o más slugs únicos separados por comas');
  return slugs.sort();
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: string | number): number {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`Valor ranking no numérico: ${String(value)}`);
  return result;
}

async function loadCategories(slugs: string[], snapshotId: string | undefined): Promise<CategoryRow[]> {
  const result = await pool.query<CategoryRow>(
    `SELECT c.slug, c.label_es, c.label_en, c.definition_md, c.entity_type, c.metric_key,
            c.scope_kind, c.scope, c.status AS category_status, c.ranking_direction,
            rs.id AS snapshot_id, rs.status AS snapshot_status, rs.data_version,
            rs.algorithm_version, rs.content_sha256, rs.generated_at,
            rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count, c.score_cap,
            COALESCE((SELECT COUNT(*)::int FROM ranking_entries entry_count WHERE entry_count.snapshot_id = rs.id), 0)::int AS snapshot_rows_total,
            rs.metadata->>'sourceSnapshotId' AS snapshot_source_id,
            ss.id AS source_snapshot_id, ss.source_key, s.name AS source_name,
            s.base_url AS source_base_url, s.rights_status AS source_rights_status,
            ss.retrieved_at AS source_retrieved_at, ss.source_published_at,
            ss.storage_uri AS source_storage_uri, ss.content_sha256 AS source_content_sha256,
            ss.metadata AS source_metadata, rs.metadata AS snapshot_metadata
       FROM category_definitions c
       LEFT JOIN LATERAL (
         SELECT snapshot.*
           FROM ranking_snapshots snapshot
          WHERE snapshot.category_id = c.id
            AND ($2::text IS NULL OR snapshot.id = $2)
            AND ($2::text IS NOT NULL OR snapshot.status <> 'superseded')
          ORDER BY CASE snapshot.status WHEN 'published' THEN 0 WHEN 'approved' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
                   snapshot.coverage_complete DESC, snapshot.generated_at DESC, snapshot.id DESC
          LIMIT 1
       ) rs ON TRUE
       LEFT JOIN source_snapshots ss ON ss.id = rs.metadata->>'sourceSnapshotId'
       LEFT JOIN sources s ON s.key = ss.source_key
      WHERE c.slug = ANY($1::text[])
      ORDER BY c.slug`,
    [slugs, snapshotId ?? null]
  );
  return result.rows;
}

async function loadEntries(categories: CategoryRow[]): Promise<EntryRow[]> {
  const snapshots = categories.map((category) => category.snapshot_id).filter((value): value is string => Boolean(value));
  if (snapshots.length === 0) return [];
  const result = await pool.query<EntryRow>(
    `WITH RECURSIVE identity_walk AS (
       SELECT link.source_entity_id, link.canonical_entity_id,
              ARRAY[link.source_entity_id, link.canonical_entity_id]::text[] AS path
         FROM entity_identity_links link
       UNION ALL
       SELECT walk.source_entity_id, link.canonical_entity_id, walk.path || link.canonical_entity_id
         FROM identity_walk walk
         JOIN entity_identity_links link ON link.source_entity_id = walk.canonical_entity_id
        WHERE NOT link.canonical_entity_id = ANY(walk.path)
          AND cardinality(walk.path) < 20
     ), resolved_identity AS (
       SELECT DISTINCT ON (source_entity_id) source_entity_id, canonical_entity_id
         FROM identity_walk
        ORDER BY source_entity_id, cardinality(path) DESC, canonical_entity_id
     )
     SELECT c.slug AS category_slug, re.snapshot_id, re.entity_id AS source_entity_id,
            source_entity.canonical_name AS source_name, source_entity.entity_type AS source_entity_type,
            COALESCE(resolved.canonical_entity_id, re.entity_id) AS canonical_entity_id,
            canonical_entity.canonical_name, canonical_entity.entity_type AS canonical_entity_type,
            re.raw_value, re.rank, re.score_value, re.tie_group, re.evidence
       FROM ranking_entries re
       JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
       JOIN category_definitions c ON c.id = rs.category_id
       JOIN entities source_entity ON source_entity.id = re.entity_id
       LEFT JOIN resolved_identity resolved ON resolved.source_entity_id = re.entity_id
       LEFT JOIN entities canonical_entity ON canonical_entity.id = COALESCE(resolved.canonical_entity_id, re.entity_id)
      WHERE re.snapshot_id = ANY($1::text[])
        AND re.rank <= ${MAX_TOP_RANK}
      ORDER BY c.slug, re.rank, re.entity_id`,
    [snapshots]
  );
  return result.rows;
}

async function buildEntries(rows: EntryRow[]): Promise<AuditEntryInput[]> {
  const entityIds = [...new Set(rows.flatMap((row) => [row.source_entity_id, row.canonical_entity_id].filter((value): value is string => Boolean(value))))];
  if (entityIds.length === 0) return [];
  const [entities, externals, aliases, profiles, media] = await Promise.all([
    pool.query<EntityRow>('SELECT id, entity_type, canonical_name, catalog_status FROM entities WHERE id = ANY($1::text[])', [entityIds]),
    pool.query<ExternalRow>('SELECT source_key, entity_type, external_id, entity_id FROM entity_external_ids', []),
    pool.query<AliasRow>('SELECT entity_id, alias, source_key FROM entity_aliases WHERE entity_id = ANY($1::text[])', [entityIds]),
    pool.query<ProfileRow>('SELECT entity_id, playable_default FROM entity_game_profiles WHERE entity_id = ANY($1::text[])', [entityIds]),
    pool.query<MediaRow>('SELECT id, entity_id, review_status, is_primary, provider, rights_evidence_url, rights_verified_at, metadata FROM image_assets WHERE entity_id = ANY($1::text[])', [entityIds])
  ]);
  const entityById = new Map(entities.rows.map((entity) => [entity.id, entity]));
  const profileById = new Map(profiles.rows.map((profile) => [profile.entity_id, profile.playable_default]));
  const aliasesById = new Map<string, AliasRow[]>();
  for (const alias of aliases.rows) aliasesById.set(alias.entity_id, [...(aliasesById.get(alias.entity_id) ?? []), alias]);
  const mediaById = new Map<string, MediaRow[]>();
  for (const asset of media.rows) mediaById.set(asset.entity_id, [...(mediaById.get(asset.entity_id) ?? []), asset]);
  const externalById = new Map<string, ExternalRow[]>();
  for (const external of externals.rows) externalById.set(external.entity_id, [...(externalById.get(external.entity_id) ?? []), external]);
  const externalByKey = new Map<string, ExternalRow[]>();
  for (const external of externals.rows) {
    const key = `${external.source_key}/${external.entity_type}/${external.external_id}`;
    externalByKey.set(key, [...(externalByKey.get(key) ?? []), external]);
  }
  return rows.map((row) => {
    const canonicalId = row.canonical_entity_id;
    const canonical = canonicalId ? entityById.get(canonicalId) : undefined;
    const source = entityById.get(row.source_entity_id);
    const entityIdsForContext = [...new Set([row.source_entity_id, canonicalId].filter((value): value is string => Boolean(value)))];
    return {
      categorySlug: row.category_slug,
      snapshotId: row.snapshot_id,
      sourceEntityId: row.source_entity_id,
      sourceName: row.source_name,
      sourceEntityType: row.source_entity_type,
      canonicalEntityId: canonicalId,
      canonicalName: row.canonical_name,
      canonicalEntityType: row.canonical_entity_type,
      rawValue: numberValue(row.raw_value),
      rank: row.rank,
      scoreValue: row.score_value,
      tieGroup: row.tie_group,
      evidence: jsonObject(row.evidence),
      playable: entityIdsForContext.some((entityId) => profileById.get(entityId) === true) || (canonical?.entity_type !== 'player' && canonical?.catalog_status === 'active'),
      catalogStatus: canonical?.catalog_status ?? source?.catalog_status ?? null,
      externalIds: entityIdsForContext.flatMap((entityId) => (externalById.get(entityId) ?? []).flatMap((external) => {
        const key = `${external.source_key}/${external.entity_type}/${external.external_id}`;
        return (externalByKey.get(key) ?? []).map((conflictingExternal) => ({ sourceKey: conflictingExternal.source_key, entityType: conflictingExternal.entity_type, externalId: conflictingExternal.external_id, entityId: conflictingExternal.entity_id }));
      })),
      aliases: entityIdsForContext.flatMap((entityId) => (aliasesById.get(entityId) ?? []).map((alias) => ({ alias: alias.alias, sourceKey: alias.source_key }))),
      media: entityIdsForContext.flatMap((entityId) => (mediaById.get(entityId) ?? []).map((asset) => ({ id: asset.id, reviewStatus: asset.review_status, isPrimary: asset.is_primary, provider: asset.provider, rightsEvidenceUrl: asset.rights_evidence_url, rightsVerifiedAt: asset.rights_verified_at, metadata: jsonObject(asset.metadata) })))
    };
  });
}

function categoryInput(row: CategoryRow): AuditCategoryInput {
  return {
    slug: row.slug,
    labelEs: row.label_es,
    labelEn: row.label_en,
    definition: row.definition_md,
    entityType: row.entity_type,
    metricKey: row.metric_key,
    scopeKind: row.scope_kind,
    scope: jsonObject(row.scope),
    categoryStatus: row.category_status,
    snapshotId: row.snapshot_id,
    snapshotStatus: row.snapshot_status,
    dataVersion: row.data_version,
    algorithmVersion: row.algorithm_version,
    contentSha256: row.content_sha256,
    generatedAt: row.generated_at ? new Date(row.generated_at).toISOString() : null,
    coverageComplete: row.coverage_complete,
    unresolvedConflicts: row.unresolved_conflicts,
    eligibleCount: row.eligible_count,
    scoreCap: row.score_cap,
    snapshotRowsTotal: row.snapshot_rows_total,
    sourceSnapshotId: row.source_snapshot_id ?? row.snapshot_source_id,
    sourceKey: row.source_key,
    sourceName: row.source_name,
    sourceBaseUrl: row.source_base_url,
    sourceRightsStatus: row.source_rights_status,
    sourceRetrievedAt: row.source_retrieved_at ? new Date(row.source_retrieved_at).toISOString() : null,
    sourcePublishedAt: row.source_published_at ? new Date(row.source_published_at).toISOString() : null,
    sourceStorageUri: row.source_storage_uri,
    sourceContentSha256: row.source_content_sha256,
    sourceMetadata: jsonObject(row.source_metadata),
    snapshotMetadata: jsonObject(row.snapshot_metadata),
    rankingDirection: row.ranking_direction
  };
}

async function main(): Promise<void> {
  const slugs = selectedSlugs();
  const snapshotId = arg('snapshot');
  const outputDirectory = resolve(arg('out-dir') ?? 'audits/ranking-truth');
  const categories = await loadCategories(slugs, snapshotId);
  const entries = await loadEntries(categories);
  const auditEntries = await buildEntries(entries);
  const report = buildRankingTruthAudit(categories.map(categoryInput), auditEntries, slugs);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, 'ranking-truth.json'), rankingTruthJson(report), 'utf8'),
    writeFile(resolve(outputDirectory, 'ranking-truth.md'), rankingTruthMarkdown(report), 'utf8'),
    writeFile(resolve(outputDirectory, 'ranking-truth.csv'), rankingTruthCsv(report), 'utf8')
  ]);
  console.log(JSON.stringify({
    readOnly: true,
    outputDirectory,
    selectedCategories: slugs,
    categoryCount: report.categories.length,
    blockingAnomalies: report.anomalies.filter((anomaly) => anomaly.severity === 'blocking').length,
    priorityCandidates: report.priorityCandidates,
    hashes: report.hashes
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
