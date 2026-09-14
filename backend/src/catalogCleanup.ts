import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './db.js';

export const MAX_GAME_RANKING_ENTRIES = 200;

export function isSnapshotEligibleForCatalog(snapshotStatus: string, categoryStatus: string): boolean {
  return ['draft', 'approved', 'published'].includes(snapshotStatus) && categoryStatus !== 'retired';
}

export function mediaRequirement(entityType: 'player' | 'club' | 'national_team', catalogStatus: string, isEligiblePlayer: boolean): 'required' | 'media_not_required' {
  return entityType !== 'player' || (catalogStatus === 'active' && isEligiblePlayer) ? 'required' : 'media_not_required';
}

export function isAllowedInChallenge(catalogStatus: string): boolean {
  return catalogStatus === 'active';
}

export function isPlayableWithExplicitProfile(catalogStatus: string, playableProfile: boolean): boolean {
  return catalogStatus === 'active' && playableProfile;
}

export function decideIdentityReview(candidateCount: number): { resolutionStatus: 'confirmed_existing_canonical' | 'not_found'; autoCorrected: false } {
  return candidateCount === 1
    ? { resolutionStatus: 'confirmed_existing_canonical', autoCorrected: false }
    : { resolutionStatus: 'not_found', autoCorrected: false };
}

export type CleanupRankingEntry = {
  snapshotId: string;
  entityId: string;
  rawValue: string;
  rank: number;
  scoreValue: number;
  tieGroup: number;
  sourceRank: number | null;
  rankingPosition: number | null;
  entryOrder: number | null;
  evidence: Record<string, unknown>;
};

export type CleanupCandidate = CleanupRankingEntry & { canonicalEntityId: string };

export function orderRankingEntries<T extends { rank: number; tieGroup: number; entryOrder: number | null; entityId: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) =>
    left.rank - right.rank ||
    left.tieGroup - right.tieGroup ||
    (left.entryOrder ?? Number.MAX_SAFE_INTEGER) - (right.entryOrder ?? Number.MAX_SAFE_INTEGER) ||
    left.entityId.localeCompare(right.entityId)
  );
}

/**
 * Selects a deterministic maximum-size ranking cut. Tied entries at the
 * boundary are resolved by the stored source/order provenance, never by a
 * random query order. Canonical duplicates count once.
 */
export function selectCanonicalRankingCut(entries: CleanupCandidate[], maxEntries = MAX_GAME_RANKING_ENTRIES): CleanupCandidate[] {
  const selected: CleanupCandidate[] = [];
  const seenCanonical = new Set<string>();
  for (const entry of orderRankingEntries(entries)) {
    if (seenCanonical.has(entry.canonicalEntityId)) continue;
    seenCanonical.add(entry.canonicalEntityId);
    selected.push(entry);
    if (selected.length >= maxEntries) break;
  }
  return selected;
}

function resolveEntityId(entityId: string, links: Map<string, string>): string {
  let current = entityId;
  const visited = new Set<string>();
  for (let depth = 0; depth < 10; depth += 1) {
    if (visited.has(current)) throw new Error(`Ciclo de identidad durante la auditoría: ${entityId}`);
    visited.add(current);
    const next = links.get(current);
    if (!next || next === current) return current;
    current = next;
  }
  throw new Error(`Cadena de identidad demasiado larga durante la auditoría: ${entityId}`);
}

type SnapshotRow = {
  id: string;
  category_id: string;
  category_slug: string;
  category_status: string;
  entity_type: 'player' | 'club' | 'national_team';
  data_version: string;
  algorithm_version: string;
  content_sha256: string;
  generated_at: string;
  status: 'draft' | 'approved' | 'published' | 'superseded';
  coverage_complete: boolean;
  eligible_count: number;
  unresolved_conflicts: number;
  metadata: Record<string, unknown>;
};

type EntityRow = { id: string; entity_type: 'player' | 'club' | 'national_team'; canonical_name: string; catalog_status: string };

const REVIEW_CASES = [
  ['identity-review-neil-macdonald', 'Neil MacDonald', 'Neil McDonald'],
  ['identity-review-somen-choji', 'Somen Choji', 'Somen Tchoyi'],
  ['identity-review-brian-small', 'Brian Small', 'Bryan Small'],
  ['identity-review-gabriel-damas', 'Gabriel Damas', 'Vítor Damas'],
  ['identity-review-shane-ferguson', 'Shane Ferguson', null],
  ['identity-review-simeon-jackson', 'Simeon Jackson', null],
  ['identity-review-grant-holt', 'Grant Holt', null],
  ['identity-review-jan-stekkal', 'Jan Stekkal', 'Jan Stejskal']
] as const;

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function loadCatalog(client: PoolClient) {
  const entities = await client.query<EntityRow>('SELECT id, entity_type, canonical_name, catalog_status FROM entities');
  const links = await client.query<{ source_entity_id: string; canonical_entity_id: string }>('SELECT source_entity_id, canonical_entity_id FROM entity_identity_links');
  const snapshots = await client.query<SnapshotRow>(
    `SELECT DISTINCT ON (c.id)
        rs.id, rs.category_id, c.slug AS category_slug, c.status AS category_status,
        c.entity_type, rs.data_version, rs.algorithm_version, rs.content_sha256,
        rs.generated_at, rs.status, rs.coverage_complete, rs.eligible_count,
        rs.unresolved_conflicts, rs.metadata
     FROM ranking_snapshots rs
     JOIN category_definitions c ON c.id = rs.category_id
     WHERE rs.status <> 'superseded' AND c.status <> 'retired'
     ORDER BY c.id, rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC`
  );
  const linksBySource = new Map(links.rows.map((row) => [row.source_entity_id, row.canonical_entity_id]));
  const canonicalById = new Map(entities.rows.map((entity) => [entity.id, resolveEntityId(entity.id, linksBySource)]));
  const entries = await client.query<CleanupRankingEntry>(
    `SELECT re.snapshot_id AS "snapshotId", re.entity_id AS "entityId", re.raw_value::text AS "rawValue",
            re.rank, re.score_value AS "scoreValue", re.tie_group AS "tieGroup",
            re.source_rank AS "sourceRank", re.ranking_position AS "rankingPosition",
            re.entry_order AS "entryOrder", re.evidence
       FROM ranking_entries re
       WHERE re.snapshot_id = ANY($1::text[])`,
    [snapshots.rows.map((snapshot) => snapshot.id)]
  );
  const bySnapshot = new Map<string, CleanupCandidate[]>();
  for (const entry of entries.rows) {
    const list = bySnapshot.get(entry.snapshotId) ?? [];
    list.push({ ...entry, canonicalEntityId: canonicalById.get(entry.entityId) ?? entry.entityId });
    bySnapshot.set(entry.snapshotId, list);
  }
  return { entities: entities.rows, linksBySource, canonicalById, snapshots: snapshots.rows, bySnapshot };
}

async function resolveReviewCases(client: PoolClient, canonicalById: Map<string, string>, apply: boolean) {
  const cases: Array<Record<string, unknown>> = [];
  for (const [id, requestedName, likelyName] of REVIEW_CASES) {
    const candidate = await client.query<{ id: string; canonical_name: string; birth_date: string | null }>(
      `SELECT id, canonical_name, birth_date
         FROM entities
        WHERE entity_type = 'player'
          AND (LOWER(BTRIM(canonical_name)) = LOWER(BTRIM($1))
               OR ($2::text IS NOT NULL AND LOWER(BTRIM(canonical_name)) = LOWER(BTRIM($2))))
        ORDER BY id`,
      [requestedName, likelyName]
    );
    const uniqueCandidates = [...new Map(candidate.rows.map((row) => [canonicalById.get(row.id) ?? row.id, row])).values()];
    const resolved = uniqueCandidates.length === 1 ? uniqueCandidates[0] : null;
    const reviewDecision = decideIdentityReview(uniqueCandidates.length);
    const status = reviewDecision.resolutionStatus;
    const providerIds = resolved
      ? await client.query<{ source_key: string; external_id: string }>(
        'SELECT source_key, external_id FROM entity_external_ids WHERE entity_id = $1 ORDER BY source_key, external_id',
        [canonicalById.get(resolved.id) ?? resolved.id]
      )
      : { rows: [] };
    const rankingReferences = resolved
      ? await client.query<{ category_slug: string; rank: number; snapshot_id: string }>(
        `SELECT c.slug AS category_slug, re.rank, rs.id AS snapshot_id
           FROM ranking_entries re
           JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
           JOIN category_definitions c ON c.id = rs.category_id
          WHERE re.entity_id = $1
          ORDER BY c.slug, re.rank`,
        [canonicalById.get(resolved.id) ?? resolved.id]
      )
      : { rows: [] };
    const decision = resolved
      ? `Canonical existente identificado como ${resolved.canonical_name}; no se creó alias ni enlace automático.`
      : 'No hay candidato canónico inequívoco en la BBDD; requiere revisión manual y no se aplicó corrección.';
    const payload = {
      id,
      requestedName,
      likelyName,
      resolutionStatus: status,
      canonicalEntityId: resolved ? canonicalById.get(resolved.id) ?? resolved.id : null,
      canonicalName: resolved?.canonical_name ?? null,
      birthDate: resolved?.birth_date ?? null,
      candidateCount: uniqueCandidates.length,
      providerIds: providerIds.rows,
      activeRankingReferences: rankingReferences.rows,
      decision
    };
    cases.push(payload);
    if (apply) {
      await client.query(
        `UPDATE identity_review_cases
            SET resolution_status = $2,
                canonical_entity_id = $3,
                decision = $4,
                evidence = evidence || $5::jsonb,
                reviewed_at = NOW(),
                updated_at = NOW()
          WHERE id = $1`,
        [id, status, payload.canonicalEntityId, decision, JSON.stringify({ audit: payload })]
      );
    }
  }
  return cases;
}

export async function runDataCatalogCleanup(options: { apply: boolean }): Promise<Record<string, unknown>> {
  const client = await pool.connect();
  try {
    if (options.apply) await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('rango90:data-catalog-cleanup'))");
    const catalog = await loadCatalog(client);
    const oversized = catalog.snapshots
      .map((snapshot) => ({ snapshot, entries: catalog.bySnapshot.get(snapshot.id) ?? [] }))
      .filter(({ entries }) => entries.length > MAX_GAME_RANKING_ENTRIES);

    const derivedSnapshots: Array<{ originalId: string; derivedId: string; categorySlug: string; originalEntries: number; derivedEntries: number }> = [];
    for (const { snapshot, entries } of oversized) {
      const selected = selectCanonicalRankingCut(entries);
      const canonicalEntries = selected.map((entry, index) => ({
        entityId: entry.canonicalEntityId,
        rawValue: entry.rawValue,
        rank: entry.rank,
        scoreValue: entry.scoreValue,
        tieGroup: entry.tieGroup,
        sourceRank: entry.sourceRank ?? entry.rankingPosition ?? entry.rank,
        rankingPosition: entry.rankingPosition ?? entry.rank,
        entryOrder: index + 1,
        evidence: {
          ...jsonObject(entry.evidence),
          sourceRank: entry.sourceRank ?? entry.rankingPosition ?? entry.rank,
          catalogCleanup: { derivedFromSnapshotId: snapshot.id, maxEntries: MAX_GAME_RANKING_ENTRIES }
        }
      }));
      const contentHash = createHash('sha256').update(JSON.stringify({ categoryId: snapshot.category_id, dataVersion: `${snapshot.data_version}-catalog-cleanup-v1`, entries: canonicalEntries })).digest('hex');
      const derivedId = `rs_${contentHash.slice(0, 24)}`;
      derivedSnapshots.push({ originalId: snapshot.id, derivedId, categorySlug: snapshot.category_slug, originalEntries: entries.length, derivedEntries: canonicalEntries.length });
      if (!options.apply) continue;
      await client.query(
        `INSERT INTO ranking_snapshots
           (id, category_id, data_version, algorithm_version, content_sha256, status,
            coverage_complete, eligible_count, unresolved_conflicts, metadata)
         VALUES ($1, $2, $3, $4, $5, 'draft', FALSE, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [derivedId, snapshot.category_id, `${snapshot.data_version}-catalog-cleanup-v1`, `${snapshot.algorithm_version}-catalog-cleanup-v1`, contentHash, canonicalEntries.length, snapshot.unresolved_conflicts, JSON.stringify({
          ...(snapshot.metadata ?? {}),
          catalogCleanup: { version: 'catalog-cleanup-v1', derivedFromSnapshotId: snapshot.id, maxEntries: MAX_GAME_RANKING_ENTRIES, sourceEntryCount: entries.length }
        })]
      );
      for (const entry of canonicalEntries) {
        await client.query(
          `INSERT INTO ranking_entries
             (snapshot_id, entity_id, raw_value, rank, score_value, tie_group, evidence,
              source_rank, ranking_position, entry_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (snapshot_id, entity_id) DO NOTHING`,
          [derivedId, entry.entityId, entry.rawValue, entry.rank, entry.scoreValue, entry.tieGroup, JSON.stringify(entry.evidence), entry.sourceRank, entry.rankingPosition, entry.entryOrder]
        );
      }
      if (snapshot.status === 'draft') {
        await client.query(
          `UPDATE ranking_snapshots
              SET status = 'superseded',
                  metadata = metadata || $2::jsonb
            WHERE id = $1 AND status = 'draft'`,
          [snapshot.id, JSON.stringify({ catalogCleanup: { version: 'catalog-cleanup-v1', supersededBySnapshotId: derivedId } })]
        );
      }
    }

    const derivedByOriginal = new Map(derivedSnapshots.map((row) => [row.originalId, row.derivedId]));
    const currentSnapshots = catalog.snapshots.map((snapshot) => ({
      ...snapshot,
      id: derivedByOriginal.get(snapshot.id) ?? snapshot.id,
      entries: derivedByOriginal.has(snapshot.id)
        ? selectCanonicalRankingCut(catalog.bySnapshot.get(snapshot.id) ?? []).map((entry) => ({ ...entry, snapshotId: derivedByOriginal.get(snapshot.id)! }))
        : catalog.bySnapshot.get(snapshot.id) ?? []
    }));
    const eligibleCanonicalPlayers = new Set<string>();
    for (const snapshot of currentSnapshots) {
      if (snapshot.entity_type !== 'player') continue;
      for (const entry of selectCanonicalRankingCut(snapshot.entries)) eligibleCanonicalPlayers.add(entry.canonicalEntityId);
    }
    const canonicalPlayerIds = catalog.entities.filter((entity) => entity.entity_type === 'player' && (catalog.canonicalById.get(entity.id) ?? entity.id) === entity.id).map((entity) => entity.id);
    const outOfCutPlayers = canonicalPlayerIds.filter((id) => !eligibleCanonicalPlayers.has(id));
    const supersededEntityIds = catalog.entities.filter((entity) => catalog.linksBySource.has(entity.id)).map((entity) => entity.id);

    // Keep the operational invariants visible in the catalog audit. These are
    // deliberately calculated from canonical identities so a provider row
    // cannot reintroduce a player into the game/media pool under a second ID.
    const playableProfileRows = await client.query<{ entity_id: string }>(
      `SELECT egp.entity_id
         FROM entity_game_profiles egp
         JOIN entities e ON e.id = egp.entity_id
        WHERE e.entity_type = 'player'
          AND e.catalog_status = 'active'
          AND egp.playable_default = TRUE`
    );
    const playableCanonicalPlayers = new Set(
      playableProfileRows.rows.map(({ entity_id }) => catalog.canonicalById.get(entity_id) ?? entity_id)
    );
    const pendingPortraitRows = await client.query<{ entity_id: string }>(
      `SELECT ia.entity_id
         FROM image_assets ia
         JOIN entities e ON e.id = ia.entity_id
        WHERE e.entity_type = 'player'
          AND ia.asset_kind = 'portrait'
          AND ia.review_status = 'pending'`
    );
    const pendingPortraitCanonicalPlayers = new Set(
      pendingPortraitRows.rows.map(({ entity_id }) => catalog.canonicalById.get(entity_id) ?? entity_id)
    );
    const pendingOutsideCutPlayers = [...pendingPortraitCanonicalPlayers].filter((id) => !eligibleCanonicalPlayers.has(id));
    const pendingOutsidePlayablePlayers = [...pendingPortraitCanonicalPlayers].filter((id) => !playableCanonicalPlayers.has(id));
    const localPortraitRows = await client.query<{ entity_id: string }>(
      `SELECT ia.entity_id
         FROM image_assets ia
         JOIN entities e ON e.id = ia.entity_id
        WHERE e.entity_type = 'player'
          AND ia.asset_kind = 'portrait'
          AND ia.local_path IS NOT NULL
          AND ia.review_status IN ('pending', 'approved')`
    );
    const localPortraitCounts = new Map<string, number>();
    for (const { entity_id } of localPortraitRows.rows) {
      const canonicalId = catalog.canonicalById.get(entity_id) ?? entity_id;
      localPortraitCounts.set(canonicalId, (localPortraitCounts.get(canonicalId) ?? 0) + 1);
    }
    const canonicalPlayersWithMultipleLocalPortraits = [...localPortraitCounts.values()].filter((count) => count > 1).length;

    if (options.apply) {
      await client.query(
        `UPDATE entities e
            SET catalog_status = CASE
              WHEN e.id = ANY($1::text[]) THEN 'superseded'
              WHEN e.catalog_status = 'identity_review_required' THEN e.catalog_status
              WHEN e.entity_type = 'player'
               AND e.birth_date < DATE '1960-01-01'
               AND NOT EXISTS (
                 SELECT 1
                 FROM entity_game_profiles historical_profile
                 WHERE historical_profile.entity_id = e.id
                   AND historical_profile.playable_default = TRUE
                   AND historical_profile.legacy_tier = 'iconic_legacy'
                   AND historical_profile.metadata->>'curated' = 'true'
               ) THEN 'excluded_from_game'
              WHEN e.id = ANY($2::text[]) THEN 'active'
              WHEN e.entity_type = 'player' THEN 'excluded_from_game'
              ELSE 'active'
            END,
            metadata = metadata || jsonb_build_object('catalogAudit', jsonb_build_object(
              'version', 'catalog-cleanup-v1',
              'eligibleInActiveTop200', e.id = ANY($2::text[]),
              'excludedFromGame', e.entity_type = 'player' AND NOT (e.id = ANY($2::text[])),
              'auditedAt', NOW()
            )),
            updated_at = NOW()
          WHERE e.entity_type = ANY(ARRAY['player', 'club', 'national_team'])`,
        [supersededEntityIds, [...eligibleCanonicalPlayers]]
      );
      await client.query(
        `UPDATE entity_game_profiles egp
            SET playable_default = FALSE,
                reason = 'Fuera del top 200 de todas las categorías activas; requiere nueva revisión explícita.',
                metadata = egp.metadata || '{"catalogCleanup":"catalog-cleanup-v1"}'::jsonb
           FROM entities e
          WHERE e.id = egp.entity_id
            AND e.entity_type = 'player'
            AND e.catalog_status <> 'active'`,
        []
      );
      await client.query(
        `UPDATE image_assets ia
            SET media_status = CASE
              WHEN e.entity_type <> 'player' THEN 'required'
              WHEN e.id = ANY($1::text[])
               AND EXISTS (
                 SELECT 1
                 FROM entity_game_profiles playable_profile
                 LEFT JOIN entity_identity_links profile_link
                   ON profile_link.source_entity_id = playable_profile.entity_id
                 WHERE COALESCE(profile_link.canonical_entity_id, playable_profile.entity_id) = e.id
                   AND playable_profile.playable_default = TRUE
               ) THEN 'required'
              ELSE 'media_not_required'
            END,
            metadata = ia.metadata || jsonb_build_object('catalogCleanup', jsonb_build_object(
              'version', 'catalog-cleanup-v1',
              'mediaRequired', e.entity_type <> 'player' OR (
                e.id = ANY($1::text[])
                AND EXISTS (
                  SELECT 1
                  FROM entity_game_profiles playable_profile
                  LEFT JOIN entity_identity_links profile_link
                    ON profile_link.source_entity_id = playable_profile.entity_id
                  WHERE COALESCE(profile_link.canonical_entity_id, playable_profile.entity_id) = e.id
                    AND playable_profile.playable_default = TRUE
                )
              ),
              'auditedAt', NOW()
            ))
           FROM entities e
          WHERE e.id = ia.entity_id`,
        [[...eligibleCanonicalPlayers]]
      );
      // Draft challenges are materialized views of the game catalog. Remove
      // player items that are no longer playable after the top-200 cleanup;
      // raw rankings and historical/published challenge records remain intact.
      await client.query(
        `DELETE FROM challenge_items ci
          USING challenges c, entities e
         WHERE ci.challenge_id = c.id
           AND c.status = 'draft'
           AND e.id = ci.entity_id
           AND e.entity_type = 'player'
           AND NOT EXISTS (
             SELECT 1
               FROM entity_game_profiles playable_profile
               LEFT JOIN entity_identity_links profile_link
                 ON profile_link.source_entity_id = playable_profile.entity_id
              WHERE COALESCE(profile_link.canonical_entity_id, playable_profile.entity_id) =
                    COALESCE(
                      (SELECT identity_link.canonical_entity_id
                         FROM entity_identity_links identity_link
                        WHERE identity_link.source_entity_id = ci.entity_id),
                      ci.entity_id
                    )
                AND playable_profile.playable_default = TRUE
           )`
      );
    }

    const reviewCases = await resolveReviewCases(client, catalog.canonicalById, options.apply);
    const challengeAudit = await client.query<{ legacy_challenges: string; legacy_items: string; game_challenges: string; game_decisions: string }>(
      `SELECT
         (SELECT COUNT(*) FROM challenges)::text AS legacy_challenges,
         (SELECT COUNT(*) FROM challenge_items ci JOIN entities e ON e.id = ci.entity_id WHERE e.catalog_status <> 'active')::text AS legacy_items,
         (SELECT COUNT(*) FROM game_challenges)::text AS game_challenges,
         (SELECT COUNT(*) FROM game_challenge_decisions gcd JOIN entities e ON e.id = gcd.entity_id WHERE e.catalog_status <> 'active')::text AS game_decisions`
    );
    if (options.apply) await client.query('COMMIT');
    return {
      mode: options.apply ? 'apply' : 'dry-run',
      maxGameRankingEntries: MAX_GAME_RANKING_ENTRIES,
      activeSnapshots: currentSnapshots.length,
      activeDraftSnapshots: currentSnapshots.filter((snapshot) => snapshot.status === 'draft').length,
      approvedOrPublishedSnapshots: currentSnapshots.filter((snapshot) => snapshot.status === 'approved' || snapshot.status === 'published').length,
      oversizedActiveSnapshots: oversized.map(({ snapshot, entries }) => ({ id: snapshot.id, category: snapshot.category_slug, status: snapshot.status, entries: entries.length })),
      derivedSnapshots,
      canonicalPlayers: canonicalPlayerIds.length,
      eligibleCanonicalPlayers: eligibleCanonicalPlayers.size,
      outOfCutPlayers: outOfCutPlayers.length,
      outOfCutPlayerSample: outOfCutPlayers.slice(0, 100).map((id) => catalog.entities.find((entity) => entity.id === id)?.canonical_name ?? id),
      supersededSourceEntities: supersededEntityIds.length,
      playablePlayers: playableCanonicalPlayers.size,
      playableOutsideTop200: [...playableCanonicalPlayers].filter((id) => !eligibleCanonicalPlayers.has(id)).length,
      pendingPortraitPlayers: pendingPortraitCanonicalPlayers.size,
      pendingPortraitsOutsideTop200: pendingOutsideCutPlayers.length,
      pendingPortraitsOutsidePlayable: pendingOutsidePlayablePlayers.length,
      canonicalPlayersWithMultipleLocalPortraits,
      identityReviewCases: reviewCases,
      challengeAudit: challengeAudit.rows[0]
    };
  } catch (error) {
    if (options.apply) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Read-only production guard for the hard game-catalog boundary. This is
 * intentionally separate from cleanup-data-catalog: it never changes raw
 * entities, ranking facts or media, and is safe to run before every publish.
 */
export async function verifyGameCatalogBoundary(): Promise<Record<string, unknown>> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      playable_outside_top200: number;
      pending_portraits_outside_top200: number;
      duplicate_canonical_primary_portraits: number;
      published_challenge_decisions_outside_top200: number;
    }>(
      `WITH RECURSIVE identity_walk AS (
         SELECT eil.source_entity_id, eil.canonical_entity_id,
                ARRAY[eil.source_entity_id, eil.canonical_entity_id]::text[] AS path
         FROM entity_identity_links eil
         UNION ALL
         SELECT iw.source_entity_id, eil.canonical_entity_id,
                iw.path || eil.canonical_entity_id
         FROM identity_walk iw
         JOIN entity_identity_links eil ON eil.source_entity_id = iw.canonical_entity_id
         WHERE NOT eil.canonical_entity_id = ANY(iw.path)
           AND cardinality(iw.path) < 20
       ), resolved_identity AS (
         SELECT DISTINCT ON (source_entity_id) source_entity_id, canonical_entity_id
         FROM identity_walk
         ORDER BY source_entity_id, cardinality(path) DESC
       ), top200_players AS MATERIALIZED (
         SELECT DISTINCT COALESCE(ri.canonical_entity_id, re.entity_id) AS canonical_id
         FROM ranking_entries re
         JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
         JOIN category_definitions c ON c.id = rs.category_id AND c.status <> 'retired'
         JOIN entities source_entity ON source_entity.id = re.entity_id AND source_entity.entity_type = 'player'
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = re.entity_id
         WHERE re.rank <= ${MAX_GAME_RANKING_ENTRIES}
       ), playable_outside AS (
         SELECT COUNT(*)::int AS count
         FROM entity_game_profiles egp
         JOIN entities profile_entity ON profile_entity.id = egp.entity_id AND profile_entity.entity_type = 'player'
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = egp.entity_id
         WHERE egp.playable_default = TRUE
           AND NOT EXISTS (
             SELECT 1 FROM top200_players top200
             WHERE top200.canonical_id = COALESCE(ri.canonical_entity_id, egp.entity_id)
           )
       ), pending_outside AS (
         SELECT COUNT(*)::int AS count
         FROM image_assets ia
         JOIN entities asset_entity ON asset_entity.id = ia.entity_id AND asset_entity.entity_type = 'player'
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = ia.entity_id
         WHERE ia.asset_kind = 'portrait'
           AND ia.review_status = 'pending'
           AND NOT EXISTS (
             SELECT 1 FROM top200_players top200
             WHERE top200.canonical_id = COALESCE(ri.canonical_entity_id, ia.entity_id)
           )
       ), duplicate_primary AS (
         SELECT COUNT(*)::int AS count
         FROM (
           SELECT COALESCE(ri.canonical_entity_id, ia.entity_id) AS canonical_id
           FROM image_assets ia
           JOIN entities asset_entity ON asset_entity.id = ia.entity_id AND asset_entity.entity_type = 'player'
           LEFT JOIN resolved_identity ri ON ri.source_entity_id = ia.entity_id
           WHERE ia.asset_kind = 'portrait' AND ia.is_primary = TRUE
           GROUP BY COALESCE(ri.canonical_entity_id, ia.entity_id)
           HAVING COUNT(*) > 1
         ) duplicate_groups
       ), published_decisions AS (
         SELECT COUNT(*)::int AS count
         FROM game_challenge_decisions gcd
         JOIN game_challenges gc ON gc.id = gcd.game_challenge_id AND gc.status = 'published'
         JOIN entities decision_entity ON decision_entity.id = gcd.entity_id AND decision_entity.entity_type = 'player'
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = gcd.entity_id
         WHERE NOT EXISTS (
           SELECT 1 FROM top200_players top200
           WHERE top200.canonical_id = COALESCE(ri.canonical_entity_id, gcd.entity_id)
         )
       )
       SELECT playable_outside.count AS playable_outside_top200,
              pending_outside.count AS pending_portraits_outside_top200,
              duplicate_primary.count AS duplicate_canonical_primary_portraits,
              published_decisions.count AS published_challenge_decisions_outside_top200
       FROM playable_outside, pending_outside, duplicate_primary, published_decisions`
    );
    const row = result.rows[0] ?? {
      playable_outside_top200: 0,
      pending_portraits_outside_top200: 0,
      duplicate_canonical_primary_portraits: 0,
      published_challenge_decisions_outside_top200: 0
    };
    const report = {
      policy: 'catalog-cleanup-v1',
      maxGameRankingEntries: MAX_GAME_RANKING_ENTRIES,
      checks: row,
      passed: Object.values(row).every((value) => Number(value) === 0)
    };
    if (!report.passed) throw new Error(`Fallo de frontera del catálogo: ${JSON.stringify(report)}`);
    return report;
  } finally {
    client.release();
  }
}
