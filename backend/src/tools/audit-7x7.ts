import { closeDb, pool } from '../db.js';
import { auditSevenBySeven, type SevenBySevenCategory } from '../sevenBySevenAudit.js';

const MAX_GAME_RANKING_ENTRIES = 200;
const DAILY_CHALLENGE_CANDIDATE_RANK = 90;

type SnapshotRow = {
  category_id: string;
  slug: string;
  snapshot_id: string;
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

try {
  const snapshotRows = await pool.query<SnapshotRow>(
    `SELECT DISTINCT ON (c.id)
            c.id AS category_id, c.slug, rs.id AS snapshot_id,
            rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count, c.score_cap
       FROM category_definitions c
       JOIN ranking_snapshots rs ON rs.category_id = c.id
      WHERE c.status <> 'retired'
        AND c.entity_type = 'player'
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
         JOIN entities source_entity ON source_entity.id = re.entity_id
         LEFT JOIN entity_identity_links identity_link
           ON identity_link.source_entity_id = re.entity_id
         JOIN entities canonical_entity
           ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
        WHERE re.snapshot_id = ANY($1::text[])
          AND re.rank <= $2
          AND canonical_entity.entity_type = 'player'
          AND canonical_entity.catalog_status = 'active'
          AND EXISTS (
            SELECT 1
              FROM entity_game_profiles playable_profile
             WHERE playable_profile.entity_id = canonical_entity.id
               AND playable_profile.playable_default = TRUE
          )
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

  const candidates: SevenBySevenCategory[] = snapshotRows.rows
    .filter((row) => {
      const snapshotEntries = bySnapshot.get(row.snapshot_id) ?? new Map<string, number>();
      return row.coverage_complete
        && row.unresolved_conflicts === 0
        && row.eligible_count >= MAX_GAME_RANKING_ENTRIES
        && row.score_cap === 100
        && snapshotEntries.size >= MAX_GAME_RANKING_ENTRIES;
    })
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

  const audit = auditSevenBySeven(candidates);
  console.log(JSON.stringify({
    ready: audit.matches.length > 0,
    requirements: {
      categories: 7,
      commonPlayers: 7,
      entriesPerCategory: MAX_GAME_RANKING_ENTRIES,
      candidateRankLimit: DAILY_CHALLENGE_CANDIDATE_RANK,
      requiresCoverageComplete: true,
      requiresZeroConflicts: true,
      requiresPlayableCanonicalPlayers: true
    },
    activePlayerCategories: snapshotRows.rows.length,
    individuallyEligibleCategories: candidates.map((category) => ({ slug: category.slug, snapshotId: category.snapshotId })),
    ...audit,
    note: 'Esta auditoría valida datos locales y no aprueba derechos de redistribución ni activos visuales.'
  }, null, 2));
  if (audit.matches.length === 0) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
