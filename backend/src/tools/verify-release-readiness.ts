import { closeDb, pool } from '../db.js';
import { verifyGameCatalogBoundary } from '../catalogCleanup.js';

type Check = {
  ok: boolean;
  observed: unknown;
  detail: string;
};

function check(ok: boolean, observed: unknown, detail: string): Check {
  return { ok, observed, detail };
}

async function verifyReleaseReadiness(): Promise<{ ready: boolean; checks: Record<string, Check> }> {
  const connection = await pool.query<{ now: string }>('SELECT NOW()::text AS now');
  const publishedSnapshots = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ranking_snapshots WHERE status = 'published'`
  );
  const approvedSources = await pool.query<{ count: number; invalid_count: number }>(
    `SELECT COUNT(*) FILTER (WHERE rights_status = 'approved')::int AS count,
            COUNT(*) FILTER (
              WHERE rights_status = 'approved'
                AND (
                  rights_basis IN ('unknown', 'not_applicable')
                  OR commercial_use IS DISTINCT FROM TRUE
                  OR NULLIF(rights_evidence_url, '') IS NULL
                  OR rights_evidence_url !~* '^https?://'
                  OR rights_verified_at IS NULL
                  OR NULLIF(BTRIM(rights_verified_by), '') IS NULL
                  OR NULLIF(BTRIM(rights_notes), '') IS NULL
                  OR jsonb_typeof(rights_usage_scope) <> 'array'
                  OR NOT (rights_usage_scope @> '["web", "pwa", "android", "local_storage"]'::jsonb)
                  OR NOT EXISTS (
                    SELECT 1
                      FROM source_rights_reviews review
                     WHERE review.source_key = sources.key
                       AND review.decision = 'approved'
                       AND review.rights_basis = sources.rights_basis
                       AND review.commercial_use = TRUE
                       AND review.evidence_url = sources.rights_evidence_url
                       AND review.reviewer = sources.rights_verified_by
                       AND review.usage_scope @> '["web", "pwa", "android", "local_storage"]'::jsonb
                  )
                )
            )::int AS invalid_count
       FROM sources`
  );
  const latestDaily = await pool.query<{
    id: string;
    category_count: number;
    decision_count: number;
    decision_entity_count: number;
    answer_count: number;
    missing_ranking_entries: number;
    score_mismatches: number;
    entity_type_count: number;
  }>(
    `WITH published_daily AS (
       SELECT id
         FROM game_challenges
        WHERE status = 'published' AND challenge_kind = 'daily'
        ORDER BY challenge_date DESC NULLS LAST, published_at DESC NULLS LAST, id DESC
        LIMIT 1
     ),
     decision_category_matrix AS (
       SELECT gcd.game_challenge_id, gcd.decision_ordinal, gcd.entity_id,
              gcc.category_id, gcc.ranking_snapshot_id,
              gca.score_value AS answer_score,
              re.score_value AS ranking_score
         FROM game_challenge_decisions gcd
         JOIN published_daily pd ON pd.id = gcd.game_challenge_id
         CROSS JOIN game_challenge_categories gcc
         LEFT JOIN game_challenge_answers gca
           ON gca.game_challenge_id = gcd.game_challenge_id
          AND gca.decision_ordinal = gcd.decision_ordinal
          AND gca.category_id = gcc.category_id
         LEFT JOIN LATERAL (
           SELECT ranking_entry.score_value
             FROM ranking_entries ranking_entry
             LEFT JOIN entity_identity_links ranking_identity
               ON ranking_identity.source_entity_id = ranking_entry.entity_id
            WHERE ranking_entry.snapshot_id = gcc.ranking_snapshot_id
              AND COALESCE(ranking_identity.canonical_entity_id, ranking_entry.entity_id) = gcd.entity_id
            ORDER BY ranking_entry.rank, ranking_entry.entity_id
            LIMIT 1
         ) re ON TRUE
        WHERE gcc.game_challenge_id = gcd.game_challenge_id
     ),
     matrix_summary AS (
       SELECT game_challenge_id,
              COUNT(*) FILTER (WHERE ranking_score IS NULL)::int AS missing_ranking_entries,
              COUNT(*) FILTER (WHERE ranking_score IS NOT NULL AND answer_score IS DISTINCT FROM ranking_score)::int AS score_mismatches
         FROM decision_category_matrix
        GROUP BY game_challenge_id
     )
     SELECT gc.id,
            COUNT(DISTINCT gcc.category_id)::int AS category_count,
            COUNT(DISTINCT gcd.decision_ordinal)::int AS decision_count,
            COUNT(DISTINCT gcd.entity_id)::int AS decision_entity_count,
            COUNT(DISTINCT (gca.decision_ordinal, gca.category_id))::int AS answer_count,
            COALESCE(MAX(ms.missing_ranking_entries), 0)::int AS missing_ranking_entries,
            COALESCE(MAX(ms.score_mismatches), 0)::int AS score_mismatches,
            COUNT(DISTINCT c.entity_type)::int AS entity_type_count
       FROM game_challenges gc
       LEFT JOIN game_challenge_categories gcc ON gcc.game_challenge_id = gc.id
       LEFT JOIN category_definitions c ON c.id = gcc.category_id
       LEFT JOIN game_challenge_decisions gcd ON gcd.game_challenge_id = gc.id
       LEFT JOIN game_challenge_answers gca ON gca.game_challenge_id = gc.id
       LEFT JOIN matrix_summary ms ON ms.game_challenge_id = gc.id
      WHERE gc.status = 'published' AND gc.challenge_kind = 'daily'
       GROUP BY gc.id
      ORDER BY gc.challenge_date DESC NULLS LAST, gc.published_at DESC NULLS LAST, gc.id DESC
      LIMIT 1`
  );

  const daily = latestDaily.rows[0] ?? null;
  const dailyShape = daily
    ? {
      id: daily.id,
      categories: daily.category_count,
      decisions: daily.decision_count,
      distinctEntities: daily.decision_entity_count,
      answers: daily.answer_count,
      missingRankingEntries: daily.missing_ranking_entries,
      scoreMismatches: daily.score_mismatches,
      entityTypeCount: daily.entity_type_count
    }
    : null;

  const dailyCategories = daily
    ? await pool.query<{
      slug: string;
      category_status: string;
      snapshot_status: string;
      coverage_complete: boolean;
      unresolved_conflicts: number;
      eligible_count: number;
      ranking_entry_count: number;
      source_rights_status: string;
    }>(
      `SELECT c.slug, c.status AS category_status, rs.status AS snapshot_status,
              rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count,
              COUNT(DISTINCT COALESCE(identity_link.canonical_entity_id, re.entity_id))
                FILTER (
                  WHERE re.rank <= 200
                    AND canonical_entity.entity_type = c.entity_type
                    AND canonical_entity.catalog_status = 'active'
                    AND (canonical_entity.entity_type <> 'player' OR EXISTS (
                      SELECT 1
                        FROM entity_game_profiles playable_profile
                       WHERE playable_profile.entity_id = canonical_entity.id
                         AND playable_profile.playable_default = TRUE
                    ))
                )::int AS ranking_entry_count,
              COALESCE(s.rights_status, 'unknown') AS source_rights_status
         FROM game_challenge_categories gcc
         JOIN category_definitions c ON c.id = gcc.category_id
         JOIN ranking_snapshots rs ON rs.id = gcc.ranking_snapshot_id
         LEFT JOIN ranking_entries re ON re.snapshot_id = rs.id
         LEFT JOIN entity_identity_links identity_link
           ON identity_link.source_entity_id = re.entity_id
         LEFT JOIN entities canonical_entity
           ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
         LEFT JOIN source_snapshots ss ON ss.id = rs.metadata->>'sourceSnapshotId'
         LEFT JOIN sources s ON s.key = ss.source_key
        WHERE gcc.game_challenge_id = $1
        GROUP BY c.slug, c.status, rs.status, rs.coverage_complete,
                 rs.unresolved_conflicts, rs.eligible_count, s.rights_status,
                 gcc.category_ordinal
        ORDER BY gcc.category_ordinal`,
      [daily.id]
    )
    : { rows: [] };

  const categoryFailures = dailyCategories.rows.filter((category) =>
    !['approved', 'published'].includes(category.category_status)
    || category.snapshot_status !== 'published'
    || !category.coverage_complete
    || category.unresolved_conflicts > 0
    || category.eligible_count < 200
    || category.ranking_entry_count < 200
    || category.source_rights_status !== 'approved'
  );
  const boundary = await verifyGameCatalogBoundary();
  const boundaryFailures = Object.entries(boundary.checks ?? {}).filter(([, value]) => Number(value) !== 0);

  const checks: Record<string, Check> = {
    database: check(Boolean(connection.rows[0]?.now), connection.rows[0]?.now ?? null, 'La base de datos responde'),
    approvedSources: check((approvedSources.rows[0]?.count ?? 0) > 0, approvedSources.rows[0]?.count ?? 0, 'Existe al menos una fuente con derechos aprobados'),
    approvedSourceEvidence: check(
      (approvedSources.rows[0]?.count ?? 0) > 0 && (approvedSources.rows[0]?.invalid_count ?? 0) === 0,
      { approved: approvedSources.rows[0]?.count ?? 0, invalid: approvedSources.rows[0]?.invalid_count ?? 0 },
      'Cada fuente aprobada tiene evidencia comercial, alcance requerido y una revisión coincidente en el ledger'
    ),
    publishedSnapshots: check((publishedSnapshots.rows[0]?.count ?? 0) > 0, publishedSnapshots.rows[0]?.count ?? 0, 'Existe al menos un snapshot publicado'),
    publishedDaily7x7: check(
      Boolean(daily
        && daily.category_count === 7
        && daily.decision_count === 7
        && daily.decision_entity_count === 7
        && daily.answer_count === 49
        && daily.missing_ranking_entries === 0
        && daily.score_mismatches === 0
        && daily.entity_type_count === 1),
      dailyShape,
      'Existe un reto diario publicado con matriz 7×7, entidades comunes y valores derivados de sus snapshots'
    ),
    dailyCategoryContracts: check(
      Boolean(daily && dailyCategories.rows.length === 7 && categoryFailures.length === 0),
      { categoryCount: dailyCategories.rows.length, failures: categoryFailures.map((category) => category.slug) },
      'Las categorías del reto tienen snapshot publicado, cobertura completa, conflictos resueltos, 200 entradas reales y derechos aprobados'
    ),
    catalogBoundary: check(
      boundaryFailures.length === 0,
      boundary,
      'No hay entidades jugables fuera del top 200, retratos pendientes fuera del límite ni decisiones publicadas inválidas'
    )
  };

  return { ready: Object.values(checks).every((item) => item.ok), checks };
}

try {
  const result = await verifyReleaseReadiness();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
