import { closeDb, pool } from '../db.js';
import { auditSevenBySeven, type SevenBySevenCategory } from '../sevenBySevenAudit.js';
import { SELECTED_DAILY_CATEGORY_COUNTS, SELECTED_DAILY_CATEGORY_SLUGS } from '../dailyMatrix.js';

const MAX_GAME_RANKING_ENTRIES = 200;
const DAILY_CHALLENGE_CANDIDATE_RANK = 90;

type SnapshotRow = {
  category_id: string;
  slug: string;
  category_status: string;
  snapshot_id: string;
  snapshot_status: string;
  entity_type: 'player' | 'club' | 'national_team';
  closed_universe: boolean;
  coverage_complete: boolean;
  unresolved_conflicts: number;
  eligible_count: number;
  score_cap: number;
};

type RankingEntryRow = {
  snapshot_id: string;
  entity_id: string;
  rank: number;
};

type SnapshotIntegrityRow = {
  snapshot_id: string;
  entry_count: number;
  top_entry_count: number;
  missing_entity_count: number;
  duplicate_canonical_count: number;
  non_positive_count: number;
  not_playable_count: number;
  type_mismatch_count: number;
  rank_mismatch_count: number;
  tie_group_mismatch_count: number;
  score_mismatch_count: number;
};

type CategoryDiagnostic = {
  slug: string;
  snapshotId: string;
  rawEntryCount: number;
  playableTop200: number;
  playableTop90: number;
  coverageComplete: boolean;
  unresolvedConflicts: number;
  eligibleCount: number;
  scoreCap: number;
  integrity: {
    ready: boolean;
    missingEntities: number;
    duplicateCanonicalEntries: number;
    nonPositiveValues: number;
    notPlayableEntries: number;
    typeMismatches: number;
    rankMismatches: number;
    tieGroupMismatches: number;
    scoreMismatches: number;
  };
  blockingReasons: string[];
};

type SelectedDataIntersection = {
  categoryCount: number;
  requiredCategoryCount: number;
  commonTop200Count: number;
  commonCandidateBandCount: number;
  commonCandidateBandEntityIds: string[];
};

function intersectSets(sets: ReadonlySet<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  return sets.slice(1).reduce<Set<string>>((common, current) => new Set([...common].filter((entityId) => current.has(entityId))), new Set(sets[0]));
}

try {
  const snapshotRows = await pool.query<SnapshotRow>(
      `SELECT DISTINCT ON (c.id)
            c.id AS category_id, c.slug, c.status AS category_status,
            rs.id AS snapshot_id, rs.status AS snapshot_status, c.entity_type,
            COALESCE((c.scope->>'closedUniverse')::boolean, FALSE) AS closed_universe,
            rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count, c.score_cap
       FROM category_definitions c
       JOIN ranking_snapshots rs ON rs.category_id = c.id
      WHERE c.status <> 'retired'
        AND rs.status IN ('draft', 'approved', 'published')
      ORDER BY c.id,
               CASE rs.status WHEN 'published' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC`
  );

  const entries = snapshotRows.rows.length > 0
    ? await pool.query<RankingEntryRow>(
      `SELECT re.snapshot_id,
              canonical_entity.id AS entity_id,
              MIN(re.rank)::int AS rank
         FROM ranking_entries re
         JOIN ranking_snapshots snapshot ON snapshot.id = re.snapshot_id
         JOIN category_definitions category ON category.id = snapshot.category_id
         LEFT JOIN entity_identity_links identity_link
           ON identity_link.source_entity_id = re.entity_id
         JOIN entities canonical_entity
           ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
        WHERE re.snapshot_id = ANY($1::text[])
          AND re.rank <= $2
            AND canonical_entity.catalog_status = 'active'
            AND canonical_entity.entity_type = category.entity_type
            AND (canonical_entity.entity_type <> 'player' OR EXISTS (
              SELECT 1
                FROM entity_game_profiles playable_profile
               WHERE playable_profile.entity_id = canonical_entity.id
                 AND playable_profile.playable_default = TRUE
            ))
        GROUP BY re.snapshot_id, canonical_entity.id`,
      [snapshotRows.rows.map((row) => row.snapshot_id), MAX_GAME_RANKING_ENTRIES]
    )
    : { rows: [] as RankingEntryRow[] };

  // This is deliberately independent from the 7×7 intersection check. It
  // validates every selected/latest category snapshot on its own, so a
  // category cannot look healthy merely because it has 200 database rows.
  const integrity = snapshotRows.rows.length > 0
    ? await pool.query<SnapshotIntegrityRow>(
      `WITH ranked_entries AS (
         SELECT re.snapshot_id, re.raw_value, re.rank, re.score_value, re.tie_group,
                COALESCE(link.canonical_entity_id, re.entity_id) AS canonical_entity_id,
                category.entity_type AS category_entity_type, category.score_cap,
                CASE WHEN category.ranking_direction = 'desc'
                  THEN RANK() OVER (PARTITION BY re.snapshot_id ORDER BY re.raw_value DESC)
                  ELSE RANK() OVER (PARTITION BY re.snapshot_id ORDER BY re.raw_value ASC)
                END AS expected_rank,
                CASE WHEN category.ranking_direction = 'desc'
                  THEN DENSE_RANK() OVER (PARTITION BY re.snapshot_id ORDER BY re.raw_value DESC)
                  ELSE DENSE_RANK() OVER (PARTITION BY re.snapshot_id ORDER BY re.raw_value ASC)
                END AS expected_tie_group
           FROM ranking_entries re
           LEFT JOIN entity_identity_links link ON link.source_entity_id = re.entity_id
           JOIN ranking_snapshots snapshot ON snapshot.id = re.snapshot_id
           JOIN category_definitions category ON category.id = snapshot.category_id
          WHERE re.snapshot_id = ANY($1::text[])
        ), top_entries AS (
         SELECT * FROM ranked_entries WHERE rank <= $2
        ), counts AS (
         SELECT top_entries.snapshot_id,
                COUNT(*)::int AS top_entry_count,
                COUNT(*) FILTER (WHERE canonical_entity.id IS NULL)::int AS missing_entity_count,
                (COUNT(*) FILTER (WHERE canonical_entity.id IS NOT NULL) - COUNT(DISTINCT canonical_entity.id))::int AS duplicate_canonical_count,
                COUNT(*) FILTER (WHERE top_entries.raw_value <= 0 OR top_entries.score_value <= 0)::int AS non_positive_count,
                COUNT(*) FILTER (
                  WHERE canonical_entity.id IS NULL
                     OR canonical_entity.catalog_status <> 'active'
                     OR (canonical_entity.entity_type = 'player' AND NOT EXISTS (
                       SELECT 1 FROM entity_game_profiles playable_profile
                        WHERE playable_profile.entity_id = canonical_entity.id
                          AND playable_profile.playable_default = TRUE
                     ))
                )::int AS not_playable_count,
                COUNT(*) FILTER (WHERE canonical_entity.id IS NULL OR canonical_entity.entity_type <> top_entries.category_entity_type)::int AS type_mismatch_count,
                COUNT(*) FILTER (WHERE top_entries.rank <> top_entries.expected_rank)::int AS rank_mismatch_count,
                COUNT(*) FILTER (WHERE top_entries.tie_group <> top_entries.expected_tie_group)::int AS tie_group_mismatch_count,
                COUNT(*) FILTER (WHERE top_entries.score_value <> LEAST(top_entries.rank, top_entries.score_cap))::int AS score_mismatch_count
           FROM top_entries
           LEFT JOIN entities canonical_entity ON canonical_entity.id = top_entries.canonical_entity_id
          GROUP BY top_entries.snapshot_id
        ), totals AS (
         SELECT snapshot_id, COUNT(*)::int AS entry_count
           FROM ranked_entries
          GROUP BY snapshot_id
        )
       SELECT totals.snapshot_id, totals.entry_count,
              COALESCE(counts.top_entry_count, 0)::int AS top_entry_count,
              COALESCE(counts.missing_entity_count, 0)::int AS missing_entity_count,
              COALESCE(counts.duplicate_canonical_count, 0)::int AS duplicate_canonical_count,
              COALESCE(counts.non_positive_count, 0)::int AS non_positive_count,
              COALESCE(counts.not_playable_count, 0)::int AS not_playable_count,
              COALESCE(counts.type_mismatch_count, 0)::int AS type_mismatch_count,
              COALESCE(counts.rank_mismatch_count, 0)::int AS rank_mismatch_count,
              COALESCE(counts.tie_group_mismatch_count, 0)::int AS tie_group_mismatch_count,
              COALESCE(counts.score_mismatch_count, 0)::int AS score_mismatch_count
         FROM totals
         LEFT JOIN counts ON counts.snapshot_id = totals.snapshot_id`,
      [snapshotRows.rows.map((row) => row.snapshot_id), MAX_GAME_RANKING_ENTRIES]
    )
    : { rows: [] as SnapshotIntegrityRow[] };

  const integrityBySnapshot = new Map(integrity.rows.map((row) => [row.snapshot_id, row]));

  const bySnapshot = new Map<string, Map<string, number>>();
  for (const entry of entries.rows) {
    const snapshotEntries = bySnapshot.get(entry.snapshot_id) ?? new Map<string, number>();
    const previousRank = snapshotEntries.get(entry.entity_id);
    if (previousRank === undefined || entry.rank < previousRank) snapshotEntries.set(entry.entity_id, entry.rank);
    bySnapshot.set(entry.snapshot_id, snapshotEntries);
  }

  const diagnostics: CategoryDiagnostic[] = snapshotRows.rows.map((row) => {
    const snapshotEntries = bySnapshot.get(row.snapshot_id) ?? new Map<string, number>();
    const integrityRow = integrityBySnapshot.get(row.snapshot_id);
    const playableTop90 = [...snapshotEntries.values()].filter((rank) => rank <= DAILY_CHALLENGE_CANDIDATE_RANK).length;
    const minimumEntries = row.closed_universe ? 1 : MAX_GAME_RANKING_ENTRIES;
    const blockingReasons: string[] = [];
    if (!row.coverage_complete) blockingReasons.push('coverage_incomplete');
    if (row.unresolved_conflicts !== 0) blockingReasons.push('unresolved_conflicts');
    if (row.eligible_count < minimumEntries) blockingReasons.push(row.closed_universe ? 'source_entry_count_below_closed_universe_minimum' : 'source_entry_count_below_200');
    if (row.score_cap !== 100) blockingReasons.push('score_cap_not_100');
    if (snapshotEntries.size < minimumEntries) blockingReasons.push(row.entity_type === 'player' ? 'playable_canonical_players_below_200' : 'playable_canonical_entities_below_required_size');
    if (playableTop90 < 1) blockingReasons.push(`no_${row.entity_type}_in_top_90`);
    if (!integrityRow) {
      blockingReasons.push('integrity_audit_missing');
    } else {
      if (integrityRow.missing_entity_count > 0) blockingReasons.push('missing_entities');
      if (integrityRow.duplicate_canonical_count > 0) blockingReasons.push('duplicate_canonical_entries');
      if (integrityRow.non_positive_count > 0) blockingReasons.push('non_positive_values');
      if (integrityRow.not_playable_count > 0) blockingReasons.push('not_playable_entries');
      if (integrityRow.type_mismatch_count > 0) blockingReasons.push('entity_type_mismatch');
      if (integrityRow.rank_mismatch_count > 0) blockingReasons.push('rank_mismatch');
      if (integrityRow.tie_group_mismatch_count > 0) blockingReasons.push('tie_group_mismatch');
      if (integrityRow.score_mismatch_count > 0) blockingReasons.push('score_mismatch');
    }
    return {
      slug: row.slug,
      snapshotId: row.snapshot_id,
      rawEntryCount: integrityRow?.entry_count ?? 0,
      playableTop200: snapshotEntries.size,
      playableTop90,
      coverageComplete: row.coverage_complete,
      unresolvedConflicts: row.unresolved_conflicts,
      eligibleCount: row.eligible_count,
      scoreCap: row.score_cap,
      integrity: {
        ready: Boolean(integrityRow) && [
          integrityRow?.missing_entity_count,
          integrityRow?.duplicate_canonical_count,
          integrityRow?.non_positive_count,
          integrityRow?.not_playable_count,
          integrityRow?.type_mismatch_count,
          integrityRow?.rank_mismatch_count,
          integrityRow?.tie_group_mismatch_count,
          integrityRow?.score_mismatch_count
        ].every((count) => count === 0),
        missingEntities: integrityRow?.missing_entity_count ?? 0,
        duplicateCanonicalEntries: integrityRow?.duplicate_canonical_count ?? 0,
        nonPositiveValues: integrityRow?.non_positive_count ?? 0,
        notPlayableEntries: integrityRow?.not_playable_count ?? 0,
        typeMismatches: integrityRow?.type_mismatch_count ?? 0,
        rankMismatches: integrityRow?.rank_mismatch_count ?? 0,
        tieGroupMismatches: integrityRow?.tie_group_mismatch_count ?? 0,
        scoreMismatches: integrityRow?.score_mismatch_count ?? 0
      },
      blockingReasons
    };
  });

  const selectedDataIntersection = (entityType: SnapshotRow['entity_type'], requiredCategoryCount: number): SelectedDataIntersection => {
    const selectedCategories = SELECTED_DAILY_CATEGORY_SLUGS
      .map((slug) => snapshotRows.rows.find((row) => row.slug === slug))
      .filter((row): row is SnapshotRow => row?.entity_type === entityType)
      .map((row) => {
        const snapshotEntries = bySnapshot.get(row.snapshot_id) ?? new Map<string, number>();
        return {
          top200EntityIds: new Set(snapshotEntries.keys()),
          candidateBandEntityIds: new Set([...snapshotEntries.entries()]
            .filter(([, rank]) => rank <= DAILY_CHALLENGE_CANDIDATE_RANK)
            .map(([entityId]) => entityId))
        };
      });
    const commonTop200 = intersectSets(selectedCategories.map((category) => category.top200EntityIds));
    const commonCandidateBand = intersectSets(selectedCategories.map((category) => category.candidateBandEntityIds));
    return {
      categoryCount: selectedCategories.length,
      requiredCategoryCount,
      commonTop200Count: commonTop200.size,
      commonCandidateBandCount: commonCandidateBand.size,
      commonCandidateBandEntityIds: [...commonCandidateBand].sort()
    };
  };

  const candidates: SevenBySevenCategory[] = snapshotRows.rows
    .filter((row) => diagnostics.find((diagnostic) => diagnostic.snapshotId === row.snapshot_id)?.blockingReasons.length === 0)
    .map((row) => {
      const snapshotEntries = bySnapshot.get(row.snapshot_id) ?? new Map<string, number>();
      return {
        slug: row.slug,
        snapshotId: row.snapshot_id,
        top200EntityIds: new Set(snapshotEntries.keys()),
        candidateBandEntityIds: new Set([...snapshotEntries.entries()]
          .filter(([, rank]) => rank <= DAILY_CHALLENGE_CANDIDATE_RANK)
          .map(([entityId]) => entityId))
      };
    });

  const candidatesByEntityType = new Map<string, SevenBySevenCategory[]>();
  for (const row of snapshotRows.rows) {
    const diagnostic = diagnostics.find((item) => item.snapshotId === row.snapshot_id);
    if (!diagnostic || diagnostic.blockingReasons.length > 0) continue;
    const candidate = candidates.find((item) => item.snapshotId === row.snapshot_id);
    if (!candidate) continue;
    const group = candidatesByEntityType.get(row.entity_type) ?? [];
    group.push(candidate);
    candidatesByEntityType.set(row.entity_type, group);
  }
  const playerAudit = auditSevenBySeven(candidatesByEntityType.get('player') ?? [], 7, 7, DAILY_CHALLENGE_CANDIDATE_RANK, 20);
  const clubAudit = auditSevenBySeven(candidatesByEntityType.get('club') ?? [], 1, 1, DAILY_CHALLENGE_CANDIDATE_RANK, 20);
  const audit = {
    player: playerAudit,
    club: clubAudit,
    matches: playerAudit.matches.flatMap((playerMatch) => clubAudit.matches.map((clubMatch) => ({
      playerCategories: playerMatch.categories,
      clubCategories: clubMatch.categories,
      commonPlayers: playerMatch.commonCandidateBandCount,
      commonClubs: clubMatch.commonCandidateBandCount
    })))
  };
  const selectedPlayerCandidates = candidates.filter((candidate) =>
    SELECTED_DAILY_CATEGORY_SLUGS.includes(candidate.slug as typeof SELECTED_DAILY_CATEGORY_SLUGS[number])
  );
  const selectedPlayerAudit = auditSevenBySeven(
    selectedPlayerCandidates,
    SELECTED_DAILY_CATEGORY_COUNTS.player,
    SELECTED_DAILY_CATEGORY_COUNTS.player,
    DAILY_CHALLENGE_CANDIDATE_RANK,
    1
  );
  const selectedMatrix = SELECTED_DAILY_CATEGORY_SLUGS.map((slug) => {
    const snapshot = snapshotRows.rows.find((row) => row.slug === slug);
    const diagnostic = diagnostics.find((item) => item.slug === slug);
    return {
      slug,
      entityType: snapshot?.entity_type ?? null,
      categoryStatus: snapshot?.category_status ?? 'missing',
      snapshotId: snapshot?.snapshot_id ?? null,
      snapshotStatus: snapshot?.snapshot_status ?? 'missing',
      coverageComplete: snapshot?.coverage_complete ?? false,
      unresolvedConflicts: snapshot?.unresolved_conflicts ?? null,
      eligibleCount: snapshot?.eligible_count ?? null,
      playableTop200: diagnostic?.playableTop200 ?? 0,
      playableTop90: diagnostic?.playableTop90 ?? 0,
      blockingReasons: diagnostic?.blockingReasons ?? ['missing_snapshot']
    };
  });
  const selectedMatrixReady = selectedMatrix.length === SELECTED_DAILY_CATEGORY_SLUGS.length
    && selectedMatrix.every((category) => category.blockingReasons.length === 0 && category.playableTop90 >= 1);
  console.log(JSON.stringify({
    ready: selectedMatrixReady,
    requirements: {
      categories: 7,
      playerCategories: 7,
      clubCategories: 0,
      entriesPerCategory: MAX_GAME_RANKING_ENTRIES,
      candidateRankLimit: DAILY_CHALLENGE_CANDIDATE_RANK,
      independentCategorySelection: true,
      absentCompatibleCategoryScore: 'score_cap',
      requiresCoverageComplete: true,
      requiresZeroConflicts: true,
      requiresPlayableCanonicalPlayers: true
    },
    activeCategoriesByEntityType: Object.fromEntries([...candidatesByEntityType.entries()].map(([entityType, group]) => [entityType, group.length])),
    individuallyEligibleCategories: candidates.map((category) => ({ slug: category.slug, snapshotId: category.snapshotId })),
    selectedMatrix: {
      slugs: SELECTED_DAILY_CATEGORY_SLUGS,
      player: selectedPlayerAudit,
      club: { categoryCount: 0, matchingCombinationCount: 0, matches: [] },
      overlapDiagnostics: {
        player: selectedDataIntersection('player', SELECTED_DAILY_CATEGORY_COUNTS.player),
        club: { categoryCount: 0, requiredCategoryCount: 0, commonTop200Count: 0, commonCandidateBandCount: 0, commonCandidateBandEntityIds: [] }
      },
      categories: selectedMatrix
    },
    allCategoryDiagnostics: diagnostics
      .slice()
      .sort((left, right) => left.slug.localeCompare(right.slug)),
    closestCategoryDiagnostics: diagnostics
      .sort((left, right) => right.playableTop200 - left.playableTop200 || right.playableTop90 - left.playableTop90 || left.slug.localeCompare(right.slug))
      .slice(0, 20),
    typedAudit: audit,
    note: 'Cada categoría se valida de forma independiente. El solapamiento entre categorías es solo diagnóstico y no bloquea la matriz; las entidades ausentes en una categoría compatible reciben scoreCap al materializar el reto. Esta auditoría no aprueba derechos de redistribución ni activos visuales.'
  }, null, 2));
  if (!selectedMatrixReady) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
