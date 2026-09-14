import { closeDb, pool } from '../db.js';
import { auditSevenBySeven, type SevenBySevenCategory } from '../sevenBySevenAudit.js';

const MAX_GAME_RANKING_ENTRIES = 200;
const DAILY_CHALLENGE_CANDIDATE_RANK = 90;

type SnapshotRow = {
  category_id: string;
  slug: string;
  snapshot_id: string;
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

type CategoryDiagnostic = {
  slug: string;
  snapshotId: string;
  playableTop200: number;
  playableTop90: number;
  coverageComplete: boolean;
  unresolvedConflicts: number;
  eligibleCount: number;
  scoreCap: number;
  blockingReasons: string[];
};

try {
  const snapshotRows = await pool.query<SnapshotRow>(
      `SELECT DISTINCT ON (c.id)
            c.id AS category_id, c.slug, rs.id AS snapshot_id, c.entity_type,
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

  const bySnapshot = new Map<string, Map<string, number>>();
  for (const entry of entries.rows) {
    const snapshotEntries = bySnapshot.get(entry.snapshot_id) ?? new Map<string, number>();
    const previousRank = snapshotEntries.get(entry.entity_id);
    if (previousRank === undefined || entry.rank < previousRank) snapshotEntries.set(entry.entity_id, entry.rank);
    bySnapshot.set(entry.snapshot_id, snapshotEntries);
  }

  const diagnostics: CategoryDiagnostic[] = snapshotRows.rows.map((row) => {
    const snapshotEntries = bySnapshot.get(row.snapshot_id) ?? new Map<string, number>();
    const playableTop90 = [...snapshotEntries.values()].filter((rank) => rank <= DAILY_CHALLENGE_CANDIDATE_RANK).length;
    const minimumEntries = row.closed_universe ? 1 : MAX_GAME_RANKING_ENTRIES;
    const requiredCommon = row.entity_type === 'player' ? 5 : row.entity_type === 'club' ? 2 : 2;
    const blockingReasons: string[] = [];
    if (!row.coverage_complete) blockingReasons.push('coverage_incomplete');
    if (row.unresolved_conflicts !== 0) blockingReasons.push('unresolved_conflicts');
    if (row.eligible_count < minimumEntries) blockingReasons.push(row.closed_universe ? 'source_entry_count_below_closed_universe_minimum' : 'source_entry_count_below_200');
    if (row.score_cap !== 100) blockingReasons.push('score_cap_not_100');
    if (snapshotEntries.size < minimumEntries) blockingReasons.push(row.entity_type === 'player' ? 'playable_canonical_players_below_200' : 'playable_canonical_entities_below_required_size');
    if (playableTop90 < requiredCommon) blockingReasons.push(`fewer_than_${requiredCommon}_${row.entity_type}_in_top_90`);
    return {
      slug: row.slug,
      snapshotId: row.snapshot_id,
      playableTop200: snapshotEntries.size,
      playableTop90,
      coverageComplete: row.coverage_complete,
      unresolvedConflicts: row.unresolved_conflicts,
      eligibleCount: row.eligible_count,
      scoreCap: row.score_cap,
      blockingReasons
    };
  });

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
  const playerAudit = auditSevenBySeven(candidatesByEntityType.get('player') ?? [], 5, 5, DAILY_CHALLENGE_CANDIDATE_RANK, 20);
  const clubAudit = auditSevenBySeven(candidatesByEntityType.get('club') ?? [], 2, 2, DAILY_CHALLENGE_CANDIDATE_RANK, 20);
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
  console.log(JSON.stringify({
    ready: audit.matches.length > 0,
    requirements: {
      categories: 7,
      playerCategories: 5,
      clubCategories: 2,
      commonPlayers: 5,
      commonClubs: 2,
      entriesPerCategory: MAX_GAME_RANKING_ENTRIES,
      candidateRankLimit: DAILY_CHALLENGE_CANDIDATE_RANK,
      requiresCoverageComplete: true,
      requiresZeroConflicts: true,
      requiresPlayableCanonicalPlayers: true
    },
    activeCategoriesByEntityType: Object.fromEntries([...candidatesByEntityType.entries()].map(([entityType, group]) => [entityType, group.length])),
    individuallyEligibleCategories: candidates.map((category) => ({ slug: category.slug, snapshotId: category.snapshotId })),
    closestCategoryDiagnostics: diagnostics
      .sort((left, right) => right.playableTop200 - left.playableTop200 || right.playableTop90 - left.playableTop90 || left.slug.localeCompare(right.slug))
      .slice(0, 20),
    typedAudit: audit,
    note: 'Esta auditoría valida datos locales y no aprueba derechos de redistribución ni activos visuales.'
  }, null, 2));
  if (audit.matches.length === 0) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
