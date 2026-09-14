import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { pool } from '../db.js';
import { buildRanking, selectTopRankPositions } from '../ranking.js';
import { config } from '../config.js';
import { ensureExternalEntityLink } from '../entityLinks.js';
import { resolveCanonicalEntityId } from '../entityIdentity.js';
import { MAX_GAME_RANKING_ENTRIES } from '../catalogCleanup.js';

const schema = z.object({
  categorySlug: z.string().min(1),
  source: z.object({
    key: z.string().min(1),
    name: z.string().min(1),
    sourceType: z.enum(['official', 'licensed_provider', 'manual', 'reference', 'api']),
    baseUrl: z.string().url().optional(),
    rightsStatus: z.enum(['unknown', 'review_required', 'approved', 'rejected']).default('review_required')
  }),
  dataVersion: z.string().min(1),
  coverageComplete: z.boolean(),
  // Optional, source-owned audit context. It is copied into both the
  // immutable source snapshot and the ranking snapshot so a production
  // decision cannot depend on a README that may drift later.
  audit: z.record(z.string(), z.unknown()).optional(),
  allowPartialDraft: z.boolean().optional(),
  partialDraftReason: z.string().min(10).optional(),
  allowExtendedRanking: z.boolean().optional(),
  extendedRankingReason: z.string().min(10).optional(),
  reviewed: z.boolean().default(false),
  entries: z.array(z.object({
    entityId: z.string().min(1),
    entityType: z.enum(['player', 'club', 'national_team']),
    name: z.string().min(1),
    rawValue: z.number().finite().nonnegative(),
    evidence: z.record(z.string(), z.unknown()).optional(),
    image: z.object({
      assetKind: z.enum(['portrait', 'badge']).optional(),
      sourceUrl: z.string().url(),
      provider: z.string().min(1),
      licenseName: z.string().optional(),
      licenseUrl: z.string().url().optional()
    }).optional()
  })).min(1),
  awards: z.array(z.object({
    awardKey: z.string().min(1),
    awardLabel: z.string().min(1),
    awardYear: z.number().int().min(1800).max(2200),
    winnerEntityId: z.string().min(1),
    sourceUrl: z.string().url().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })).optional()
});

export type RankingInput = z.infer<typeof schema>;

export async function readRankingInput(filePath: string): Promise<RankingInput> {
  const content = await readFile(filePath, 'utf8');
  return schema.parse(JSON.parse(content));
}

export async function importRankingInput(input: RankingInput): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Ranking imports touch shared entity and identity indexes in entry order.
    // Serialize them explicitly so parallel ingestion jobs cannot deadlock
    // while still allowing reads and media review to run concurrently.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('rango90:ranking-import'))");
    const categoryResult = await client.query<{
      id: string;
      entity_type: RankingInput['entries'][number]['entityType'];
      metric_key: string;
      ranking_direction: 'desc' | 'asc';
      score_cap: number;
      scope: Record<string, unknown>;
      status: 'draft' | 'approved' | 'published' | 'retired';
    }>(
      'SELECT id, entity_type, metric_key, ranking_direction, score_cap, scope, status FROM category_definitions WHERE slug = $1',
      [input.categorySlug]
    );
    const category = categoryResult.rows[0];
    if (!category) throw new Error(`Categoría desconocida: ${input.categorySlug}`);
    // Retired categories are not game-facing, but a provider may still need
    // to archive a strictly partial source snapshot while the missing
    // historical universe is being acquired. These exceptions are deliberately
    // narrow: they require an explicit partial draft and are limited to
    // research categories whose verified rows must remain archivable while
    // their source cannot reach the product cut. They never make a category
    // playable and never permit padding or invented rows.
    const archiveRetiredPartialDraft = category.status === 'retired'
      && input.allowPartialDraft === true
      && input.coverageComplete === false
      && (
        ['national-team-official-assists', 'uefa-conference-league-clean_sheets', 'copa-america-clean_sheets', 'nations-league-clean_sheets', 'club-world-cup-clean_sheets'].includes(input.categorySlug)
        || (
          input.categorySlug === 'copa-libertadores-clean_sheets'
          && input.source.key === 'statbunker-copa-libertadores-clean-sheets'
        )
      );
    if (category.status === 'retired' && !archiveRetiredPartialDraft) {
      throw new Error(`La categoría está retirada del juego: ${input.categorySlug}`);
    }
    validateInput(input, category.entity_type, category.scope.closedUniverse === true, category.metric_key);

    if (input.source.rightsStatus === 'rejected') {
      throw new Error(`La fuente ${input.source.key} está rechazada`);
    }
    if (input.reviewed && input.source.rightsStatus !== 'approved') {
      throw new Error('Un snapshot revisado requiere una fuente con derechos aprobados');
    }

    await client.query(
      `INSERT INTO sources (key, name, source_type, base_url, rights_status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, base_url = EXCLUDED.base_url, rights_status = EXCLUDED.rights_status`,
      [input.source.key, input.source.name, input.source.sourceType, input.source.baseUrl ?? null, input.source.rightsStatus]
    );

    const rawContent = JSON.stringify(input);
    const hash = createHash('sha256').update(rawContent).digest('hex');
    const snapshotId = `src_${hash.slice(0, 24)}`;
    const snapshotPath = resolve(config.snapshotRoot, `${snapshotId}.json`);
    await mkdir(resolve(config.snapshotRoot), { recursive: true });
    try {
      await writeFile(snapshotPath, rawContent, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    await client.query(
       `INSERT INTO source_snapshots (id, source_key, retrieved_at, content_type, storage_uri, content_sha256, metadata)
       VALUES ($1, $2, NOW(), 'application/json', $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET storage_uri = COALESCE(source_snapshots.storage_uri, EXCLUDED.storage_uri),
             metadata = source_snapshots.metadata || EXCLUDED.metadata`,
      [snapshotId, input.source.key, `storage/source-snapshots/${snapshotId}.json`, hash, JSON.stringify({
        importType: 'normalized-ranking-input',
        categorySlug: input.categorySlug,
        dataVersion: input.dataVersion,
        entries: input.entries.length,
        sourceUrl: input.source.baseUrl,
        sourceType: input.source.sourceType,
        rightsStatus: input.source.rightsStatus,
        audit: input.audit ?? null,
        allowPartialDraft: input.allowPartialDraft,
        partialDraftReason: input.partialDraftReason ?? null,
        allowExtendedRanking: input.allowExtendedRanking ?? false,
        extendedRankingReason: input.extendedRankingReason ?? null
      })]
    );

    const runId = `run_${hash.slice(0, 24)}`;
    await client.query(
      `INSERT INTO import_runs (id, source_snapshot_id, status, metadata)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [runId, snapshotId, input.reviewed ? 'approved' : 'validated', JSON.stringify({ entries: input.entries.length, contentSha256: hash })]
    );

    const isGoalkeeperCategory = category.metric_key === 'clean_sheets' || category.metric_key === 'goalkeeper_index';
    const effectiveEntityIds = new Map<string, string>();
    const imageCandidates = new Map<string, {
      image: NonNullable<RankingInput['entries'][number]['image']>;
      entityType: RankingInput['entries'][number]['entityType'];
    }>();
    for (const entry of input.entries) {
      const evidenceDateOfBirth = entry.evidence?.dateOfBirth;
      const birthDate = typeof evidenceDateOfBirth === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(evidenceDateOfBirth)
        ? `${evidenceDateOfBirth.slice(6, 10)}-${evidenceDateOfBirth.slice(3, 5)}-${evidenceDateOfBirth.slice(0, 2)}`
        : typeof evidenceDateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(evidenceDateOfBirth)
          ? evidenceDateOfBirth
          : null;
      const externalIds: string[] = [];
      const providerPlayerId = entry.evidence?.providerPlayerId;
      if (typeof providerPlayerId === 'number' && Number.isInteger(providerPlayerId) && providerPlayerId > 0) {
        externalIds.push(String(providerPlayerId));
      }
      const externalId = entry.evidence?.externalId;
      if (typeof externalId === 'string' && externalId.length > 0 && externalId.length <= 200) {
        externalIds.push(externalId);
      }

      let effectiveEntityId = await resolveCanonicalEntityId(client, entry.entityId);
      let resolvedThroughIdentityLink = effectiveEntityId !== entry.entityId;
      for (const candidateExternalId of externalIds) {
        const linkedEntity = await client.query<{ entity_id: string }>(
          `SELECT entity_id FROM entity_external_ids
           WHERE source_key = $1 AND entity_type = $2 AND external_id = $3`,
          [input.source.key, entry.entityType, candidateExternalId]
        );
        const linkedEntityId = linkedEntity.rows[0]?.entity_id;
        const linkedCanonicalEntityId = linkedEntityId ? await resolveCanonicalEntityId(client, linkedEntityId) : null;
        if (linkedCanonicalEntityId && linkedCanonicalEntityId !== linkedEntityId) resolvedThroughIdentityLink = true;
        if (linkedCanonicalEntityId && linkedCanonicalEntityId !== effectiveEntityId) {
          if (effectiveEntityId !== entry.entityId) {
            throw new Error(`La entrada ${entry.name} tiene identificadores externos que apuntan a entidades distintas`);
          }
          effectiveEntityId = linkedCanonicalEntityId;
        }
      }
      const duplicateCanonicalEntry = [...effectiveEntityIds.entries()].find(([, id]) => id === effectiveEntityId);
      if (duplicateCanonicalEntry && duplicateCanonicalEntry[0] !== entry.entityId) {
        throw new Error(`Dos entradas del ranking apuntan a la misma entidad canónica: ${entry.name} y ${duplicateCanonicalEntry[0]}`);
      }
      effectiveEntityIds.set(entry.entityId, effectiveEntityId);

      // A category name is not enough evidence to mutate the entity's role:
      // an old/incorrect clean-sheet import once contained outfield players.
      // Only an explicit goalkeeper position (or a reviewed goalkeeper index
      // assertion) may set the durable entity flag. Existing true values are
      // repaired by migration 010 from trusted current facts.
      const position = typeof entry.evidence?.position === 'string' ? entry.evidence.position.toUpperCase() : null;
      const entryIsGoalkeeper = isGoalkeeperCategory && (
        position === 'G' || position === 'GK' || position === 'GOALKEEPER' || entry.evidence?.isGoalkeeper === true
      );
      const entityMetadata = typeof entry.evidence?.teamName === 'string' && entry.evidence.teamName.trim().length > 0
        ? { sourceTeamName: entry.evidence.teamName.trim(), sourceKey: input.source.key }
        : {};

      const entityResult = await client.query(
        `INSERT INTO entities (id, entity_type, canonical_name, birth_date, is_goalkeeper, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
           SET canonical_name = CASE WHEN $7::boolean THEN entities.canonical_name ELSE EXCLUDED.canonical_name END,
               birth_date = COALESCE(entities.birth_date, EXCLUDED.birth_date),
               is_goalkeeper = entities.is_goalkeeper OR EXCLUDED.is_goalkeeper,
               metadata = entities.metadata || EXCLUDED.metadata
           WHERE entities.entity_type = EXCLUDED.entity_type
         RETURNING id`,
         [effectiveEntityId, entry.entityType, entry.name, birthDate, entryIsGoalkeeper, entityMetadata, resolvedThroughIdentityLink]
      );
      if (entityResult.rowCount !== 1) {
        throw new Error(`La entidad ${effectiveEntityId} ya existe con un tipo incompatible`);
      }
      if (typeof providerPlayerId === 'number' && Number.isInteger(providerPlayerId) && providerPlayerId > 0) {
        await ensureExternalEntityLink(client, input.source.key, entry.entityType, String(providerPlayerId), effectiveEntityId, { field: 'evidence.providerPlayerId' });
      }
      if (typeof externalId === 'string' && externalId.length > 0 && externalId.length <= 200) {
        await ensureExternalEntityLink(client, input.source.key, entry.entityType, externalId, effectiveEntityId, { field: 'evidence.externalId' });
      }
      // Image metadata belongs to the game-facing cut only. Keep the raw
      // ranking and its entities for audit, but do not create pending media
      // work for extended entries outside the computed top 200.
      if (entry.image) imageCandidates.set(effectiveEntityId, { image: entry.image, entityType: entry.entityType });
      const factId = `fact_${createHash('sha256').update(JSON.stringify({ sourceSnapshotId: snapshotId, categorySlug: input.categorySlug, entityId: effectiveEntityId })).digest('hex').slice(0, 24)}`;
      await client.query(
        `INSERT INTO fact_assertions (id, fact_type, subject_entity_id, value, source_snapshot_id, review_status, reviewed_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 = 'approved' THEN NOW() ELSE NULL END, $7)
         ON CONFLICT (id) DO UPDATE SET
           value = EXCLUDED.value,
           review_status = EXCLUDED.review_status,
           reviewed_at = EXCLUDED.reviewed_at,
           metadata = fact_assertions.metadata || EXCLUDED.metadata`,
        [
          factId,
          `ranking_value:${category.metric_key}`,
          effectiveEntityId,
          JSON.stringify({ rawValue: entry.rawValue, entityType: entry.entityType, categorySlug: input.categorySlug }),
          snapshotId,
          input.reviewed ? 'approved' : 'pending',
          JSON.stringify({ dataVersion: input.dataVersion, sourceRank: entry.evidence?.sourceRank ?? null })
        ]
      );
    }

    const entryIds = new Set(input.entries.map((entry) => entry.entityId));
    for (const award of input.awards ?? []) {
      if (!entryIds.has(award.winnerEntityId)) throw new Error(`El premio ${award.awardKey}/${award.awardYear} apunta a una entidad fuera del ranking`);
      const effectiveWinnerEntityId = effectiveEntityIds.get(award.winnerEntityId) ?? award.winnerEntityId;
      const awardId = `award_${createHash('sha256').update(JSON.stringify({ sourceSnapshotId: snapshotId, awardKey: award.awardKey, awardYear: award.awardYear })).digest('hex').slice(0, 24)}`;
      await client.query(
        `INSERT INTO awards (id, award_key, award_label, award_year, winner_entity_id, source_key, source_url, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (award_key, award_year) DO UPDATE SET
           award_label = EXCLUDED.award_label,
           winner_entity_id = EXCLUDED.winner_entity_id,
           source_key = EXCLUDED.source_key,
           source_url = EXCLUDED.source_url,
           metadata = awards.metadata || EXCLUDED.metadata`,
        [awardId, award.awardKey, award.awardLabel, award.awardYear, effectiveWinnerEntityId, input.source.key, award.sourceUrl ?? input.source.baseUrl ?? null, JSON.stringify({ ...(award.metadata ?? {}), sourceSnapshotId: snapshotId, dataVersion: input.dataVersion })]
      );
      const factId = `fact_${createHash('sha256').update(JSON.stringify({ sourceSnapshotId: snapshotId, factType: `award_win:${award.awardKey}`, awardYear: award.awardYear, winnerEntityId: award.winnerEntityId })).digest('hex').slice(0, 24)}`;
      await client.query(
        `INSERT INTO fact_assertions (id, fact_type, subject_entity_id, value, source_snapshot_id, review_status, reviewed_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 = 'approved' THEN NOW() ELSE NULL END, $7)
         ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, review_status = EXCLUDED.review_status, reviewed_at = EXCLUDED.reviewed_at, metadata = fact_assertions.metadata || EXCLUDED.metadata`,
        [factId, `award_win:${award.awardKey}`, effectiveWinnerEntityId, JSON.stringify({ awardYear: award.awardYear, awardKey: award.awardKey }), snapshotId, input.reviewed ? 'approved' : 'pending', JSON.stringify({ dataVersion: input.dataVersion })]
      );
    }

    const rankingEntries = buildRanking(input.entries.map((entry) => ({ entityId: effectiveEntityIds.get(entry.entityId) ?? entry.entityId, rawValue: entry.rawValue, evidence: entry.evidence })), {
      direction: category.ranking_direction,
      scoreCap: category.score_cap
    });
    for (const rankingEntry of selectTopRankPositions(rankingEntries, MAX_GAME_RANKING_ENTRIES)) {
      const imageCandidate = imageCandidates.get(rankingEntry.entityId);
      if (!imageCandidate) continue;
      const { image, entityType } = imageCandidate;
      const imageHash = createHash('sha256').update(image.sourceUrl).digest('hex');
      await client.query(
        `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, provider, license_name, license_url, width, height, mime_type, sha256, review_status)
         SELECT $1, $2, $3, $4, $5, $6, $7, 512, 512, 'image/webp', $8, 'pending'
         WHERE NOT EXISTS (
           SELECT 1 FROM image_assets existing
           WHERE existing.entity_id = $2
             AND existing.asset_kind = $3
             AND existing.is_primary = TRUE
             AND existing.review_status = 'approved'
             AND existing.rights_basis <> 'unknown'
             AND existing.commercial_use = TRUE
             AND existing.rights_verified_at IS NOT NULL
             AND existing.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(existing.usage_scope) > 0
             AND (existing.asset_kind <> 'badge' OR existing.trademark_status = 'cleared')
             AND (existing.attribution_required = FALSE OR NULLIF(existing.attribution_text, '') IS NOT NULL)
         )
         ON CONFLICT (id) DO NOTHING`,
        [`img_${createHash('sha256').update(`${rankingEntry.entityId}:${image.sourceUrl}`).digest('hex').slice(0, 24)}`, rankingEntry.entityId, image.assetKind ?? (entityType === 'player' ? 'portrait' : 'badge'), image.sourceUrl, image.provider, image.licenseName ?? null, image.licenseUrl ?? null, imageHash]
      );
    }
    const rankingHash = createHash('sha256').update(JSON.stringify({ categoryId: category.id, dataVersion: input.dataVersion, entries: rankingEntries })).digest('hex');
    const rankingId = `rs_${rankingHash.slice(0, 24)}`;
    const auditUnresolvedConflicts = typeof input.audit?.['unresolvedConflicts'] === 'number'
      && Number.isInteger(input.audit['unresolvedConflicts'])
      && input.audit['unresolvedConflicts'] >= 0
      ? input.audit['unresolvedConflicts']
      : 0;
    await client.query(
      `INSERT INTO ranking_snapshots (id, category_id, data_version, algorithm_version, content_sha256, status, coverage_complete, eligible_count, unresolved_conflicts, metadata)
       VALUES ($1, $2, $3, 'ranking-v1', $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         data_version = CASE
           WHEN ranking_snapshots.status IN ('approved', 'published') THEN ranking_snapshots.data_version
           ELSE EXCLUDED.data_version
         END,
         content_sha256 = CASE
           WHEN ranking_snapshots.status IN ('approved', 'published') THEN ranking_snapshots.content_sha256
           ELSE EXCLUDED.content_sha256
         END,
         status = CASE
           WHEN ranking_snapshots.status IN ('approved', 'published') THEN ranking_snapshots.status
           ELSE EXCLUDED.status
         END,
         coverage_complete = CASE
           WHEN ranking_snapshots.status IN ('approved', 'published') THEN ranking_snapshots.coverage_complete
           ELSE EXCLUDED.coverage_complete
         END,
         eligible_count = CASE
           WHEN ranking_snapshots.status IN ('approved', 'published') THEN ranking_snapshots.eligible_count
           ELSE EXCLUDED.eligible_count
         END,
         unresolved_conflicts = CASE
           WHEN ranking_snapshots.status IN ('approved', 'published') THEN ranking_snapshots.unresolved_conflicts
           ELSE EXCLUDED.unresolved_conflicts
         END,
         metadata = CASE
           WHEN ranking_snapshots.status IN ('approved', 'published') THEN ranking_snapshots.metadata
           ELSE ranking_snapshots.metadata || EXCLUDED.metadata
         END`,
       [rankingId, category.id, input.dataVersion, rankingHash, input.reviewed ? 'approved' : 'draft', input.coverageComplete, rankingEntries.length, auditUnresolvedConflicts, JSON.stringify({
         sourceSnapshotId: snapshotId,
         audit: input.audit ?? null,
         allowPartialDraft: input.allowPartialDraft ?? false,
         partialDraftReason: input.partialDraftReason ?? null,
         allowExtendedRanking: input.allowExtendedRanking ?? false,
         extendedRankingReason: input.extendedRankingReason ?? null
       })]
    );

    // Keep the import atomic, but avoid one round trip per row for the
    // common top-200 case. jsonb_to_recordset preserves the same typed
    // columns and ON CONFLICT behavior as the previous per-row inserts.
    const rankingEntryPayload = JSON.stringify(rankingEntries.map((entry, entryIndex) => ({
      entity_id: entry.entityId,
      raw_value: entry.rawValue,
      rank: entry.rank,
      score_value: entry.scoreValue,
      tie_group: entry.tieGroup,
      evidence: entry.evidence ?? {},
      source_rank: typeof entry.evidence?.sourceRank === 'number' && Number.isInteger(entry.evidence.sourceRank) && entry.evidence.sourceRank > 0
        ? entry.evidence.sourceRank
        : null,
      ranking_position: entry.rank,
      entry_order: entryIndex + 1
    })));
    await client.query(
      `INSERT INTO ranking_entries
         (snapshot_id, entity_id, raw_value, rank, score_value, tie_group, evidence,
          source_rank, ranking_position, entry_order)
       SELECT $1, entry.entity_id, entry.raw_value, entry.rank, entry.score_value,
              entry.tie_group, entry.evidence, entry.source_rank,
              entry.ranking_position, entry.entry_order
       FROM jsonb_to_recordset($2::jsonb) AS entry(
         entity_id TEXT,
         raw_value NUMERIC,
         rank INTEGER,
         score_value INTEGER,
         tie_group INTEGER,
         evidence JSONB,
         source_rank INTEGER,
         ranking_position INTEGER,
         entry_order INTEGER
       )
       ON CONFLICT (snapshot_id, entity_id) DO NOTHING`,
      [rankingId, rankingEntryPayload]
    );

    // A refresh becomes the current draft for this category while previous
    // drafts remain queryable for audit/history. Approved or published
    // snapshots are immutable and are deliberately not superseded here.
    await client.query(
      `UPDATE ranking_snapshots
       SET status = 'superseded'
       WHERE category_id = $1
         AND status = 'draft'
         AND id <> $2
         AND generated_at <= (SELECT generated_at FROM ranking_snapshots WHERE id = $2)
         AND NOT (
           $3::boolean = FALSE
           AND ranking_snapshots.coverage_complete = TRUE
           AND ranking_snapshots.eligible_count >= $4::int
         )`,
      [category.id, rankingId, input.coverageComplete, category.scope.closedUniverse === true ? 1 : 200]
    );

    await client.query(
      `UPDATE import_runs SET finished_at = NOW(), status = $2 WHERE id = $1`,
      [runId, input.reviewed ? 'approved' : 'validated']
    );

    await client.query('COMMIT');
    return rankingId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function validateInput(
  input: RankingInput,
  categoryEntityType: RankingInput['entries'][number]['entityType'],
  closedUniverse: boolean,
  metricKey: string
): void {
  if (input.entries.length > 200 && !input.allowExtendedRanking) {
    throw new Error('Un ranking jugable no puede superar 200 entradas; documenta explícitamente allowExtendedRanking y extendedRankingReason para una excepción de auditoría');
  }
  if (input.allowExtendedRanking && !input.extendedRankingReason) {
    throw new Error('allowExtendedRanking requiere extendedRankingReason');
  }
  if (input.allowPartialDraft && !input.partialDraftReason) {
    throw new Error('allowPartialDraft requiere partialDraftReason para dejar constancia de por qué la fuente no alcanza el top 200');
  }
  if (input.entries.length < (closedUniverse ? 1 : 200) && !input.allowPartialDraft) {
    throw new Error(`Un ranking abierto necesita al menos ${closedUniverse ? 1 : 200} entidades; recibido: ${input.entries.length}`);
  }
  if (closedUniverse && !input.coverageComplete) {
    throw new Error('Un ranking de universo cerrado debe declarar coverageComplete=true');
  }

  const ids = new Set<string>();
  for (const entry of input.entries) {
    if (entry.entityType !== categoryEntityType) {
      throw new Error(`La categoría espera entidades ${categoryEntityType}, pero ${entry.entityId} es ${entry.entityType}`);
    }
    if (metricKey === 'titles' && !Number.isInteger(entry.rawValue)) {
      throw new Error(`Un título debe ser un número entero para ${entry.entityId}: ${entry.rawValue}`);
    }
    if (ids.has(entry.entityId)) {
      throw new Error(`Entidad duplicada en el input: ${entry.entityId}`);
    }
    ids.add(entry.entityId);

    const sourceRank = entry.evidence?.sourceRank;
    if (sourceRank !== undefined && (!Number.isInteger(sourceRank) || Number(sourceRank) < 1)) {
      throw new Error(`sourceRank inválido para ${entry.entityId}`);
    }
  }
  const awardKeys = new Set<string>();
  const entryIds = new Set(input.entries.map((entry) => entry.entityId));
  for (const award of input.awards ?? []) {
    const awardKey = `${award.awardKey}:${award.awardYear}`;
    if (awardKeys.has(awardKey)) throw new Error(`Premio duplicado en el input: ${awardKey}`);
    if (!entryIds.has(award.winnerEntityId)) throw new Error(`Premio ${awardKey} apunta a una entidad inexistente en el input`);
    awardKeys.add(awardKey);
  }
}
