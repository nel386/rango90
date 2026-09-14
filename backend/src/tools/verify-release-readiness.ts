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
  const approvedSources = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM sources WHERE rights_status = 'approved'`
  );
  const latestDaily = await pool.query<{
    id: string;
    category_count: number;
    decision_count: number;
    answer_count: number;
  }>(
    `SELECT gc.id,
            COUNT(DISTINCT gcc.category_id)::int AS category_count,
            COUNT(DISTINCT gcd.decision_ordinal)::int AS decision_count,
            COUNT(DISTINCT (gca.decision_ordinal, gca.category_id))::int AS answer_count
       FROM game_challenges gc
       LEFT JOIN game_challenge_categories gcc ON gcc.game_challenge_id = gc.id
       LEFT JOIN game_challenge_decisions gcd ON gcd.game_challenge_id = gc.id
       LEFT JOIN game_challenge_answers gca ON gca.game_challenge_id = gc.id
      WHERE gc.status = 'published' AND gc.challenge_kind = 'daily'
      GROUP BY gc.id
      ORDER BY gc.challenge_date DESC NULLS LAST, gc.published_at DESC NULLS LAST, gc.id DESC
      LIMIT 1`
  );

  const daily = latestDaily.rows[0] ?? null;
  const dailyShape = daily
    ? { id: daily.id, categories: daily.category_count, decisions: daily.decision_count, answers: daily.answer_count }
    : null;

  const dailyCategories = daily
    ? await pool.query<{
      slug: string;
      category_status: string;
      snapshot_status: string;
      coverage_complete: boolean;
      unresolved_conflicts: number;
      eligible_count: number;
      source_rights_status: string;
    }>(
      `SELECT c.slug, c.status AS category_status, rs.status AS snapshot_status,
              rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count,
              COALESCE(s.rights_status, 'unknown') AS source_rights_status
         FROM game_challenge_categories gcc
         JOIN category_definitions c ON c.id = gcc.category_id
         JOIN ranking_snapshots rs ON rs.id = gcc.ranking_snapshot_id
         LEFT JOIN source_snapshots ss ON ss.id = rs.metadata->>'sourceSnapshotId'
         LEFT JOIN sources s ON s.key = ss.source_key
        WHERE gcc.game_challenge_id = $1
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
    || category.source_rights_status !== 'approved'
  );
  const boundary = await verifyGameCatalogBoundary();
  const boundaryFailures = Object.entries(boundary.checks ?? {}).filter(([, value]) => Number(value) !== 0);

  const checks: Record<string, Check> = {
    database: check(Boolean(connection.rows[0]?.now), connection.rows[0]?.now ?? null, 'La base de datos responde'),
    approvedSources: check((approvedSources.rows[0]?.count ?? 0) > 0, approvedSources.rows[0]?.count ?? 0, 'Existe al menos una fuente con derechos aprobados'),
    publishedSnapshots: check((publishedSnapshots.rows[0]?.count ?? 0) > 0, publishedSnapshots.rows[0]?.count ?? 0, 'Existe al menos un snapshot publicado'),
    publishedDaily7x7: check(
      Boolean(daily && daily.category_count === 7 && daily.decision_count === 7 && daily.answer_count === 49),
      dailyShape,
      'Existe un reto diario publicado con matriz 7 categorías × 7 decisiones'
    ),
    dailyCategoryContracts: check(
      Boolean(daily && dailyCategories.rows.length === 7 && categoryFailures.length === 0),
      { categoryCount: dailyCategories.rows.length, failures: categoryFailures.map((category) => category.slug) },
      'Las categorías del reto tienen snapshot publicado, cobertura completa, conflictos resueltos, 200 entradas y derechos aprobados'
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
