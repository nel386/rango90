import { closeDb, pool } from '../db.js';
import { nationalLeagueClubTitleAlternatives, type NationalLeagueAlternative } from '../providers/nationalLeagueTitlesContrast.js';

type CategoryRow = {
  slug: string;
  status: string;
  entity_type: string;
  metric_key: string;
  scope: Record<string, unknown>;
};

try {
  const categories = await pool.query<CategoryRow>(
    `SELECT slug, status, entity_type, metric_key, scope
       FROM category_definitions
      WHERE entity_type = 'club' AND metric_key = 'titles' AND status <> 'retired'
      ORDER BY slug`
  );
  const snapshots = await pool.query<{
    slug: string;
    snapshot_id: string;
    status: string;
    coverage_complete: boolean;
    eligible_count: number;
    unresolved_conflicts: number;
    source_key: string;
    source_rights_status: string;
  }>(
    `SELECT DISTINCT ON (category.slug)
            category.slug,
            snapshot.id AS snapshot_id,
            snapshot.status,
            snapshot.coverage_complete,
            snapshot.eligible_count,
            snapshot.unresolved_conflicts,
            source.key AS source_key,
            source.rights_status AS source_rights_status
       FROM category_definitions category
       JOIN ranking_snapshots snapshot ON snapshot.category_id = category.id
       JOIN source_snapshots source_snapshot ON source_snapshot.id = snapshot.metadata->>'sourceSnapshotId'
       JOIN sources source ON source.key = source_snapshot.source_key
      WHERE category.entity_type = 'club'
        AND category.metric_key = 'titles'
        AND category.status <> 'retired'
        AND snapshot.status IN ('draft', 'approved', 'published')
      ORDER BY category.slug,
        CASE snapshot.status WHEN 'published' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        snapshot.generated_at DESC`
  );
  const snapshotBySlug = new Map(snapshots.rows.map((row) => [row.slug, row]));
  const alternatives = nationalLeagueClubTitleAlternatives.map((alternative: NationalLeagueAlternative) => {
    const category = categories.rows.find((row) => row.slug === alternative.slug);
    const snapshot = snapshotBySlug.get(alternative.slug);
    return {
      ...alternative,
      categoryStatus: category?.status ?? 'missing',
      snapshotStatus: snapshot?.status ?? 'missing',
      coverageComplete: snapshot?.coverage_complete ?? false,
      eligibleCount: snapshot?.eligible_count ?? 0,
      rightsStatus: snapshot?.source_rights_status ?? 'unknown',
      usableWithoutRightsApproval: false
    };
  });
  const target = snapshotBySlug.get('national-league-club-titles');
  console.log(JSON.stringify({
    category: 'national-league-club-titles',
    target: target ?? { snapshotStatus: 'missing', coverageComplete: false, eligibleCount: 0 },
    sourcePolicy: {
      openfootball: { url: 'https://github.com/openfootball/leagues', license: 'CC0-1.0/public-domain dedication', role: 'result evidence; title derivation needs contrast' },
      footballData: { url: 'https://github.com/schochastics/football-data', license: 'ODbL-1.0', role: 'independent result evidence; historical errors documented by provider' },
      apiFootball: { url: 'https://www.api-football.com/documentation-v3', role: 'current-season refresh and official league/standings cross-check where available', rightsStatus: 'review_required' },
      official: { role: 'required for final champion confirmation and rights review', rightsStatus: 'review_required' }
    },
    alternatives,
    rules: {
      noPadding: true,
      unknownsAreExcluded: true,
      ambiguousOrConflictingSeasonsRemainEvidence: true,
      independentCategorySelection: true,
      noRightsApproval: true,
      noPublication: true
    }
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
