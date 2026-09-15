import { closeDb, pool } from '../db.js';

/** Read-only audit for the composite player-career-goals category. */
try {
  const national = await pool.query<{
    id: string;
    data_version: string;
    status: string;
    coverage_complete: boolean;
    eligible_count: number;
  }>(
    `SELECT rs.id, rs.data_version, rs.status, rs.coverage_complete, rs.eligible_count
       FROM ranking_snapshots rs
       JOIN category_definitions c ON c.id = rs.category_id
      WHERE c.slug = 'national-team-official-goals'
        AND rs.status IN ('draft', 'approved', 'published')
      ORDER BY rs.status = 'published' DESC, rs.status = 'approved' DESC,
               rs.generated_at DESC, rs.id DESC
      LIMIT 1`
  );
  const global = await pool.query<{
    id: string;
    data_version: string;
    status: string;
    coverage_complete: boolean;
    eligible_count: number;
    entries: number;
    unknown_component_entries: number;
    complete_component_entries: number;
    legacy_zero_national_entries: number;
  }>(
    `SELECT rs.id, rs.data_version, rs.status, rs.coverage_complete, rs.eligible_count,
            COUNT(re.entity_id)::int AS entries,
            COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(re.evidence->'unknownComponents', '[]'::jsonb)) > 0)::int AS unknown_component_entries,
            COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(re.evidence->'unknownComponents', '[]'::jsonb)) = 0)::int AS complete_component_entries,
            COUNT(*) FILTER (WHERE re.evidence->>'nationalTeamGoals' = '0')::int AS legacy_zero_national_entries
       FROM ranking_snapshots rs
       JOIN category_definitions c ON c.id = rs.category_id
       LEFT JOIN ranking_entries re ON re.snapshot_id = rs.id
      WHERE c.slug = 'player-career-goals'
        AND rs.status IN ('draft', 'approved', 'published')
      GROUP BY rs.id
      ORDER BY rs.status = 'published' DESC, rs.status = 'approved' DESC,
               rs.generated_at DESC, rs.id DESC
      LIMIT 1`
  );
  const apiFootball = await pool.query<{
    rows: number;
    players: number;
    min_season: number;
    max_season: number;
    competitions: number;
  }>(
    `SELECT COUNT(*)::int AS rows, COUNT(DISTINCT entity_id)::int AS players,
            MIN(season_year)::int AS min_season, MAX(season_year)::int AS max_season,
            COUNT(DISTINCT competition_id)::int AS competitions
       FROM player_season_stats
      WHERE source_key = 'api-football'`
  );
  const playable = await pool.query<{ players: number }>(
    `SELECT COUNT(DISTINCT entity_id)::int AS players
       FROM entity_game_profiles
      WHERE playable_default = TRUE`
  );

  console.log(JSON.stringify({
    category: 'player-career-goals',
    definition: 'clubes + selección absoluta; sin imputar desconocidos a cero',
    latestNationalSnapshot: national.rows[0] ?? null,
    latestGlobalSnapshot: global.rows[0] ?? null,
    apiFootballObserved: apiFootball.rows[0],
    playablePlayers: playable.rows[0]?.players ?? 0,
    publishable: false,
    note: 'Auditoría de solo lectura. La cobertura parcial y los derechos pendientes mantienen el snapshot en draft.'
  }, null, 2));
} finally {
  await closeDb();
}
