import type { PoolClient } from 'pg';
import { MAX_GAME_RANKING_ENTRIES } from './catalogCleanup.js';
import { SELECTED_DAILY_PLAYER_CATEGORY_SLUGS } from './dailyMatrix.js';

type AudienceSeed = {
  entityId: string;
  tier: 'modern' | 'iconic_legacy' | 'classic_legacy';
  playable: boolean;
  reason: string;
};

export const MODERN_AUDIENCE_POLICY = {
  id: 'modern-audience-v1',
  historicalRetirementCutoffYear: 1990,
  // A birth date before this year is a conservative, auditable proxy for a
  // player who was already retired before 1990. An explicitly curated
  // iconic_legacy profile always wins over this fallback.
  historicalBirthCutoffYear: 1960,
  pre1930AudienceCutoffYear: 1930,
  defaultHistoricalPlayable: false,
  note: 'Los jugadores retirados antes de 1990 solo entran mediante una excepción icónica revisada; una fecha de nacimiento anterior a 1960 activa una exclusión conservadora si no hay excepción. Las cinco categorías históricas de la matriz diaria elegida tienen una excepción explícita y acotada para sus entidades canónicas del top-200.',
} as const;

// The goalkeeper launch category is intentionally a top-200 historical list,
// but ranking position is not an audience decision. A goalkeeper being in the
// historical top 100 does not automatically make him playable/iconic: many
// entries are from generations the product explicitly does not target. Keep
// the ranking for data and future modes; eligibility is decided by the same
// modern/explicitly-curated policy as every other player.
const HISTORICAL_GOALKEEPER_PLAYABLE_CUTOFF = 100;

// Deliberately small and explicit: historical data is retained, while the default
// game pool is curated for the current audience. Additions require human review.
const seededProfiles: AudienceSeed[] = [
  { entityId: 'france-football:player:9446', tier: 'iconic_legacy', playable: true, reason: 'Gerd Müller: excepción histórica icónica y reconocible para la audiencia general' },
  { entityId: 'rsssf:international:player:9e2ef1e6a3c2774f73e45c1d', tier: 'modern', playable: true, reason: 'Robert Lewandowski: referente moderno del fútbol internacional' },
  { entityId: 'dfb:bundesliga:player:6d43a9ba7a8c54354e5d5611', tier: 'modern', playable: true, reason: 'Marco Reus: referente moderno de Bundesliga' },
  { entityId: 'dfb:bundesliga:player:c50065a141a513c2431d1c08', tier: 'modern', playable: true, reason: 'Thomas Müller: referente moderno de Bundesliga' },
  { entityId: 'dfb:bundesliga:player:2a87a9d8d8dbd1e97af1b247', tier: 'modern', playable: true, reason: 'Mario Gómez: goleador moderno reconocible' },
  { entityId: 'pl:player:2658', tier: 'modern', playable: true, reason: 'Arjen Robben: referente moderno del fútbol europeo' },
  { entityId: 'pl:player:4478', tier: 'modern', playable: true, reason: 'Serge Gnabry: jugador moderno de alto reconocimiento' },
  { entityId: 'pl:player:3960', tier: 'modern', playable: true, reason: 'Harry Kane: jugador moderno de alto reconocimiento' },
  { entityId: 'pl:player:5110', tier: 'modern', playable: true, reason: 'Pierre-Emerick Aubameyang: goleador moderno reconocible' },
  { entityId: 'dfb:bundesliga:player:41d6e1b1fed8be03527f65c5', tier: 'modern', playable: true, reason: 'Franck Ribéry: referente moderno del fútbol europeo' },
  { entityId: 'dfb:bundesliga:player:bf7acf84ad33e4dc534497fa', tier: 'modern', playable: true, reason: 'Klaas-Jan Huntelaar: goleador moderno reconocible' },
  { entityId: 'rsssf:international:player:3a6e7722fafe083b07887f40', tier: 'modern', playable: true, reason: 'Miroslav Klose: referente moderno del fútbol internacional' },
  { entityId: 'uefa:player:0cb5f3cf8de9c06347af3bba', tier: 'classic_legacy', playable: false, reason: 'José Augusto Torres: jugador histórico anterior a 1990; fuera del pool moderno por defecto' },
  { entityId: 'transfermarkt:world-cup:player:0f03fc0cf25d0c58202b8f98', tier: 'iconic_legacy', playable: true, reason: 'Pelé: icono histórico reconocido por la audiencia general' },
  { entityId: 'france-football:player:9446', tier: 'iconic_legacy', playable: true, reason: 'Icono histórico reconocido por la audiencia general' },
  { entityId: 'france-football:player:9627', tier: 'iconic_legacy', playable: true, reason: 'Icono histórico reconocido por la audiencia general' },
  { entityId: 'france-football:player:46710', tier: 'iconic_legacy', playable: true, reason: 'Icono histórico reconocido por la audiencia general' },
  { entityId: 'uefa:player:8a495929571f7f30b2df3292', tier: 'classic_legacy', playable: false, reason: 'Jugador histórico anterior a 1990; fuera del pool moderno por defecto' },
  { entityId: 'uefa:player:287b9d026254427929cc27d2', tier: 'classic_legacy', playable: false, reason: 'Jugador histórico anterior a 1990; fuera del pool moderno por defecto' },
  { entityId: 'uefa:player:13ab0f34489fbf93f0d60f76', tier: 'classic_legacy', playable: false, reason: 'Jugador histórico anterior a 1990; fuera del pool moderno por defecto' },
  { entityId: 'uefa:player:5897f9c4834ca339c0f04ff1', tier: 'classic_legacy', playable: false, reason: 'Jugador histórico anterior a 1990; fuera del pool moderno por defecto' },
  { entityId: 'uefa:player:6096d66cc6817adf0cb5db7e', tier: 'classic_legacy', playable: false, reason: 'Jugador histórico anterior a 1990; fuera del pool moderno por defecto' },
  { entityId: 'uefa:player:39edd2344868e117717f9aa2', tier: 'classic_legacy', playable: false, reason: 'Jugador histórico anterior a 1990; fuera del pool moderno por defecto' }
];

// Historical ranking sources contain a few technically relevant but
// low-recognition names that would make the default game pool feel dated.
// They remain available for historical categories; this list only controls
// default playability and is intentionally explicit rather than inferred from
// an uncertain retirement-date field.
const defaultExcludedHistoricalNames = [
  'Altafini',
  'Amancio',
  'Antonis Antoniadis',
  'Bora Kostic',
  'Brattbakk',
  'Cruz',
  'Dennis Viollet',
  'Elber',
  'Ferenc Bene',
  'Hakan Şükür',
  'Héctor Rial',
  'Jardel',
  'Jozef Adamec',
  'José Águas',
  'José Torres',
  'Luis Enrique',
  'Makaay',
  'Papin',
  'Pizarro',
  'Piet Keizer',
  'Rebrov',
  'Sávio',
  'Shatskikh',
  'Simone',
  'Willie Wallace',
  'Wlodzimierz Lubanski',
  // Historical UEFA short names with an unambiguous identity. These are
  // excluded by name as a second safeguard if another provider introduces an
  // alias entity before identity consolidation runs.
  'Amancio Amaro',
  'Gento',
  'José Augusto',
  'Pirri',
  'Santillana',
  'Van Himst'
];

const curatedSerieAPlayableNames = [
  'Francesco Totti',
  'Antonio Di Natale',
  'Roberto Baggio',
  'Ciro Immobile',
  'Alberto Gilardino',
  'Alessandro Del Piero',
  'Giuseppe Signori',
  'Gabriel Batistuta',
  'Fabio Quagliarella',
  'Luca Toni',
  'Filippo Inzaghi',
  'Roberto Mancini',
  'Zlatan Ibrahimović',
  'Christian Vieri',
  'Marco Di Vaio',
  'Vincenzo Montella',
  'Enrico Chiesa',
  'Lautaro Martínez',
  'Domenico Berardi',
  'Paulo Dybala',
  'Andrij Ševčenko',
  'Duván Zapata',
  'Gonzalo Higuaín',
  'David Trezeguet',
  'Gianluca Vialli',
  'Mauro Icardi',
  'Andrea Belotti',
  'Giampaolo Pazzini',
  'Dries Mertens',
  'Antonio Cassano',
  'Edinson Cavani',
  'Sergio Pellissier',
  'Edin Džeko',
  'Adrian Mutu',
  'Luis Muriel',
  'Oliver Bierhoff',
  'Goran Pandev',
  'Marek Hamšík',
  'Lorenzo Insigne',
  'Marco Borriello',
  'Mirko Vučinić'
];

export async function seedGameAudienceProfiles(
  client: PoolClient,
  options: { expand?: boolean } = {}
): Promise<{ applied: number; missing: string[]; expansionApplied: boolean; historicalMatrixApplied: number }> {
  // Re-seeding is a potentially broad catalog operation. Keep the existing
  // game roster stable unless an operator explicitly opts into expansion;
  // otherwise a new ranking import can silently change image/licensing scope
  // and make progress percentages incomparable.
  if (!options.expand) return { applied: 0, missing: [], expansionApplied: false, historicalMatrixApplied: 0 };
  // Only the reviewed Champions League pilot rankings are opened initially.
  // New entities remain outside the game until an importer or curator assigns
  // them a profile.
  await client.query(`DELETE FROM entity_game_profiles WHERE metadata->>'baseline' = 'true'`);
  await client.query(`DELETE FROM entity_game_profiles WHERE metadata->>'baselineTeam' = 'true'`);
  // Consolidated provider entities are aliases, not separate game entities.
  // Remove any profile left on the source side so a re-seed cannot recreate a
  // duplicate playable player after an identity consolidation.
  await client.query(`
    DELETE FROM entity_game_profiles egp
    USING entity_identity_links l
    WHERE egp.entity_id = l.source_entity_id
  `);
  await client.query(`DELETE FROM entity_game_profiles WHERE metadata->>'serieAGoalsSeed' = 'true'`);
  await client.query(
    `INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
     SELECT DISTINCT re.entity_id, 'modern', TRUE, 'Baseline del piloto moderno Champions League', '{"policy":"modern-audience-v1","baseline":true}'::jsonb
     FROM ranking_entries re
     JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
     JOIN category_definitions c ON c.id = rs.category_id
     WHERE c.slug IN ('uefa-champions-league-goals', 'uefa-champions-league-assists')
       AND rs.status <> 'superseded'
       AND NOT EXISTS (
         SELECT 1 FROM entity_identity_links l
         WHERE l.source_entity_id = re.entity_id
       )
       AND rs.id = (
         SELECT latest.id
         FROM ranking_snapshots latest
         JOIN category_definitions latest_category ON latest_category.id = latest.category_id
         WHERE latest_category.slug = c.slug
           AND latest.status <> 'superseded'
         ORDER BY latest.coverage_complete DESC, latest.generated_at DESC, latest.id DESC
         LIMIT 1
       )
    ON CONFLICT (entity_id) DO NOTHING`
  );
  await client.query(
    `INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
     SELECT DISTINCT re.entity_id, 'modern', TRUE,
            'Jugador de la UEFA Conference League; competición moderna desde 2021',
            '{"policy":"modern-audience-v1","modernCompetition":true}'::jsonb
     FROM ranking_entries re
     JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
     JOIN category_definitions c ON c.id = rs.category_id
     JOIN entities e ON e.id = re.entity_id
     WHERE c.slug IN (
       'uefa-conference-league-goals',
       'uefa-conference-league-assists',
       'uefa-conference-league-red-cards'
     )
       AND rs.status <> 'superseded'
       AND e.entity_type = 'player'
       AND NOT EXISTS (
         SELECT 1 FROM entity_identity_links l
         WHERE l.source_entity_id = re.entity_id
       )
     ON CONFLICT (entity_id) DO UPDATE SET
       legacy_tier = EXCLUDED.legacy_tier,
       playable_default = EXCLUDED.playable_default,
       reason = EXCLUDED.reason,
       reviewed_at = NOW(),
       metadata = entity_game_profiles.metadata || EXCLUDED.metadata`
  );
  // Goalkeeper categories are part of the launch catalogue, not an offline
  // research appendix. Open the union of their reviewed top-200 rankings so a
  // clean-sheet or goalkeeper-index round can select a player. The ranking is
  // retained in full, but historical rank is never treated as an automatic
  // iconic/audience exception. Only modern players and explicitly curated
  // legacy profiles enter the default pool.
  await client.query(
    `WITH latest_goalkeeper_rankings AS (
       SELECT DISTINCT ON (c.slug) c.slug, rs.id
       FROM category_definitions c
       JOIN ranking_snapshots rs ON rs.category_id = c.id AND rs.status <> 'superseded'
       WHERE c.entity_type = 'player'
         AND c.slug IN ('goalkeeper-historical-index', 'goalkeeper-career-clean-sheets')
       ORDER BY c.slug, rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC
     ), goalkeeper_pool AS (
       SELECT COALESCE(link.canonical_entity_id, re.entity_id) AS entity_id,
              MIN(re.rank)::int AS best_rank,
              BOOL_OR(latest.slug = 'goalkeeper-historical-index') AS from_historical_index
       FROM latest_goalkeeper_rankings latest
       JOIN ranking_entries re ON re.snapshot_id = latest.id AND re.rank <= ${MAX_GAME_RANKING_ENTRIES}
       LEFT JOIN entity_identity_links link ON link.source_entity_id = re.entity_id
       GROUP BY COALESCE(link.canonical_entity_id, re.entity_id)
     )
     INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
       SELECT gp.entity_id,
            CASE
              WHEN COALESCE(e.birth_date >= DATE '1980-01-01', FALSE) THEN 'modern'
              ELSE 'classic_legacy'
            END,
            COALESCE(e.birth_date >= DATE '1980-01-01', FALSE),
            CASE
              WHEN COALESCE(e.birth_date >= DATE '1980-01-01', FALSE)
                THEN 'Portero moderno incluido en las categorías globales de porteros'
              ELSE 'Portero histórico; conservado en datos, fuera del pool jugable por defecto'
            END,
            jsonb_build_object(
              'policy', 'modern-audience-v1',
              'goalkeeperCategories', TRUE,
              'bestGoalkeeperRank', gp.best_rank,
              'historicalIndexTop100Reviewed', gp.from_historical_index AND gp.best_rank <= ${HISTORICAL_GOALKEEPER_PLAYABLE_CUTOFF},
              'historicalIndexTop100Playable', FALSE
            )
       FROM goalkeeper_pool gp
       JOIN entities e ON e.id = gp.entity_id
      WHERE e.entity_type = 'player'
        AND e.is_goalkeeper = TRUE
        AND e.catalog_status = 'active'
     ON CONFLICT (entity_id) DO UPDATE SET
       legacy_tier = CASE
         WHEN entity_game_profiles.metadata->>'curated' = 'true'
              AND entity_game_profiles.playable_default THEN 'iconic_legacy'
         ELSE EXCLUDED.legacy_tier
       END,
       playable_default = CASE
         WHEN entity_game_profiles.metadata->>'curated' = 'true'
              AND entity_game_profiles.playable_default THEN TRUE
         ELSE EXCLUDED.playable_default
       END,
       reason = EXCLUDED.reason,
       reviewed_at = NOW(),
       metadata = entity_game_profiles.metadata || EXCLUDED.metadata`
  );
  await client.query(
    `INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
     SELECT DISTINCT re.entity_id, 'modern', TRUE,
            'Jugador moderno curado para el bloque histórico de goleadores de Serie A',
            '{"policy":"modern-audience-v1","serieAGoalsSeed":true}'::jsonb
     FROM ranking_entries re
     JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
     JOIN category_definitions c ON c.id = rs.category_id
     JOIN entities e ON e.id = re.entity_id
     WHERE c.slug = 'serie-a-goals'
       AND rs.status <> 'superseded'
       AND rs.id = (
         SELECT latest.id
         FROM ranking_snapshots latest
         JOIN category_definitions latest_category ON latest_category.id = latest.category_id
         WHERE latest_category.slug = 'serie-a-goals'
           AND latest.status <> 'superseded'
         ORDER BY latest.coverage_complete DESC, latest.generated_at DESC, latest.id DESC
         LIMIT 1
       )
       AND e.canonical_name = ANY($1::text[])
       AND NOT EXISTS (
         SELECT 1 FROM entity_identity_links l
         WHERE l.source_entity_id = re.entity_id
       )
    ON CONFLICT (entity_id) DO UPDATE SET
      legacy_tier = EXCLUDED.legacy_tier,
      playable_default = EXCLUDED.playable_default,
      reason = EXCLUDED.reason,
      reviewed_at = NOW(),
      metadata = entity_game_profiles.metadata || EXCLUDED.metadata`,
    [curatedSerieAPlayableNames]
  );
  await client.query(
    `INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
     SELECT DISTINCT re.entity_id, 'modern', TRUE,
            'Equipo presente en un ranking histórico de títulos; pool de equipos por defecto',
            '{"policy":"modern-audience-v1","baselineTeam":true}'::jsonb
     FROM ranking_entries re
     JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
     JOIN category_definitions c ON c.id = rs.category_id
     JOIN entities e ON e.id = re.entity_id
     WHERE c.slug IN (
       'european-cup-champions-league-club-titles',
       'uefa-cup-europa-league-club-titles',
       'uefa-conference-league-club-titles',
       'premier-league-club-titles',
       'bundesliga-club-titles',
       'fa-cup-club-titles',
       'copa-libertadores-club-titles',
       'copa-sudamericana-club-titles',
       'recopa-sudamericana-club-titles',
       'dfb-pokal-club-titles',
       'serie-a-club-titles',
       'la-liga-club-titles',
       'ligue-1-club-titles',
       'taca-portugal-club-titles',
       'supercopa-espana-club-titles',
       'coupe-de-france-club-titles',
       'primeira-liga-club-titles',
       'supertaca-portugal-club-titles',
       'coppa-italia-club-titles',
       'supercoppa-italiana-club-titles',
       'euro-national_team-titles',
       'world-cup-national_team-titles'
     )
       AND e.entity_type IN ('club', 'national_team')
       AND NOT EXISTS (
         SELECT 1 FROM entity_identity_links l
         WHERE l.source_entity_id = re.entity_id
       )
    ON CONFLICT (entity_id) DO NOTHING`
  );
  await client.query(
    `UPDATE entity_game_profiles egp
     SET legacy_tier = 'classic_legacy',
         playable_default = FALSE,
         reason = 'Jugador histórico secundario; fuera del pool moderno por defecto',
         reviewed_at = NOW(),
       metadata = egp.metadata || '{"policy":"modern-audience-v1","historicalExclusion":true,"retirementCutoffYear":1990}'::jsonb
     FROM entities e
     WHERE egp.entity_id = e.id
       AND e.entity_type = 'player'
       AND COALESCE(egp.metadata->>'curated', 'false') <> 'true'
       AND e.canonical_name = ANY($1::text[])`,
    [defaultExcludedHistoricalNames]
  );

  // Every active player category must expose its real top-200 cohort to the
  // game. Modern players with a verified birth date are safe audience
  // candidates; historical and unknown-date rows remain outside the default
  // pool unless explicitly curated. Keep manually reviewed exclusions closed
  // so this expansion cannot silently reopen them.
  await client.query(
    `WITH ranked_modern AS (
       SELECT COALESCE(identity_link.canonical_entity_id, re.entity_id) AS entity_id,
              MIN(re.rank)::int AS best_rank,
              COUNT(DISTINCT c.id)::int AS category_count,
              ARRAY_AGG(DISTINCT c.slug ORDER BY c.slug) AS category_slugs
       FROM ranking_entries re
       JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
       JOIN category_definitions c ON c.id = rs.category_id AND c.status <> 'retired'
       LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = re.entity_id
       JOIN entities ranked_entity ON ranked_entity.id = re.entity_id AND ranked_entity.entity_type = 'player'
       JOIN entities canonical_entity
         ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
        AND canonical_entity.entity_type = 'player'
       WHERE re.rank <= ${MAX_GAME_RANKING_ENTRIES}
         AND canonical_entity.birth_date >= DATE '1960-01-01'
         AND canonical_entity.catalog_status = 'active'
       GROUP BY COALESCE(identity_link.canonical_entity_id, re.entity_id)
     )
     INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
       SELECT ranked_modern.entity_id,
              'modern',
              TRUE,
              'Jugador moderno presente en el top-200 de una categoría activa',
              jsonb_build_object(
                'policy', 'modern-audience-v1',
                'modernTop200Admission', TRUE,
                'bestRank', ranked_modern.best_rank,
                'activeCategoryCount', ranked_modern.category_count,
                'activeCategories', ranked_modern.category_slugs
              )
       FROM ranked_modern
      ON CONFLICT (entity_id) DO UPDATE SET
        legacy_tier = CASE
          WHEN entity_game_profiles.metadata->>'curated' = 'true'
               AND entity_game_profiles.playable_default THEN entity_game_profiles.legacy_tier
          WHEN entity_game_profiles.metadata->>'historicalExclusion' = 'true'
               AND entity_game_profiles.metadata->>'exclusionBasis' <> 'missing_birth_date' THEN entity_game_profiles.legacy_tier
          ELSE EXCLUDED.legacy_tier
        END,
        playable_default = CASE
          WHEN entity_game_profiles.metadata->>'historicalExclusion' = 'true'
               AND entity_game_profiles.metadata->>'exclusionBasis' <> 'missing_birth_date' THEN entity_game_profiles.playable_default
          ELSE EXCLUDED.playable_default
        END,
        reason = CASE
          WHEN entity_game_profiles.metadata->>'historicalExclusion' = 'true'
               AND entity_game_profiles.metadata->>'exclusionBasis' <> 'missing_birth_date' THEN entity_game_profiles.reason
          ELSE EXCLUDED.reason
        END,
        reviewed_at = NOW(),
        metadata = entity_game_profiles.metadata || EXCLUDED.metadata`
  );
  let applied = 0;
  const missing: string[] = [];
  for (const profile of seededProfiles) {
    const entity = await client.query('SELECT 1 FROM entities WHERE id = $1', [profile.entityId]);
    if (entity.rowCount !== 1) {
      missing.push(profile.entityId);
      continue;
    }
    await client.query(
      `INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (entity_id) DO UPDATE SET
         legacy_tier = EXCLUDED.legacy_tier,
         playable_default = EXCLUDED.playable_default,
         reason = EXCLUDED.reason,
         reviewed_at = NOW(),
         metadata = entity_game_profiles.metadata || EXCLUDED.metadata`,
      [profile.entityId, profile.tier, profile.playable, profile.reason, JSON.stringify({
        policy: MODERN_AUDIENCE_POLICY.id,
        curated: true,
        historicalRetirementCutoffYear: MODERN_AUDIENCE_POLICY.historicalRetirementCutoffYear
      })]
    );
    applied += 1;
  }
  // Ranking providers often omit retirement dates. Do not let a player born
  // before the historical cutoff enter the modern pool merely because he was
  // present in a broad all-time ranking. Keep the entity and all its facts;
  // only the default game audience is changed. Curated iconic exceptions are
  // protected by their tier.
  await client.query(
    `UPDATE entity_game_profiles egp
     SET legacy_tier = 'classic_legacy',
         playable_default = FALSE,
         reason = 'Jugador histórico anterior a 1990 según fecha de nacimiento; requiere excepción icónica revisada',
         reviewed_at = NOW(),
         metadata = egp.metadata || $1::jsonb
     FROM entities e
     WHERE egp.entity_id = e.id
       AND e.entity_type = 'player'
       AND egp.playable_default = TRUE
       AND COALESCE(egp.metadata->>'curated', 'false') <> 'true'
       AND e.birth_date < make_date($2::integer, 1, 1)`,
    [JSON.stringify({
      policy: MODERN_AUDIENCE_POLICY.id,
      historicalExclusion: true,
      exclusionBasis: 'birth_date_fallback',
      historicalBirthCutoffYear: MODERN_AUDIENCE_POLICY.historicalBirthCutoffYear
    }), MODERN_AUDIENCE_POLICY.historicalBirthCutoffYear]
  );
  // A missing birth date is not evidence that a player is modern. Historical
  // providers frequently omit it, so keeping such a profile playable would
  // reintroduce exactly the old-player leakage this audience policy is meant
  // to prevent. Only an explicitly curated iconic profile may bypass this
  // conservative rule; the entity and its ranking facts remain stored.
  await client.query(
    `UPDATE entity_game_profiles egp
     SET legacy_tier = 'classic_legacy',
         playable_default = FALSE,
         reason = 'Jugador sin fecha de nacimiento verificada; fuera del pool jugable hasta revisión',
         reviewed_at = NOW(),
         metadata = egp.metadata || $1::jsonb
     FROM entities e
     WHERE egp.entity_id = e.id
       AND e.entity_type = 'player'
       AND egp.playable_default = TRUE
       AND e.birth_date IS NULL
       AND COALESCE(egp.metadata->>'curated', 'false') <> 'true'`,
    [JSON.stringify({
      policy: MODERN_AUDIENCE_POLICY.id,
      historicalExclusion: true,
      exclusionBasis: 'missing_birth_date',
      requiresVerifiedBirthDate: true
    })]
  );
  // The catalogue audit is authoritative for game eligibility. A reseed may
  // add a curated profile, but it must never reopen a player that is outside
  // the active top-200 union or is an identity-source record.
  await client.query(
    `UPDATE entity_game_profiles egp
        SET playable_default = FALSE,
            reason = 'Fuera del catálogo activo tras la auditoría top-200; requiere revisión explícita.',
            reviewed_at = NOW(),
            metadata = egp.metadata || '{"catalogCleanup":"catalog-cleanup-v1"}'::jsonb
       FROM entities e
      WHERE e.id = egp.entity_id
        AND e.entity_type = 'player'
        AND e.catalog_status <> 'active'`
  );
  // The top-200 union is the hard product boundary. Curated audience
  // profiles may override the age/recognition policy, but never this catalog
  // boundary; raw entities and facts remain available for audit.
  await client.query(
    `UPDATE entity_game_profiles egp
        SET playable_default = FALSE,
            reason = 'Fuera del top-200 activo; conservado solo para auditoría.',
            reviewed_at = NOW(),
            metadata = egp.metadata || '{"catalogCleanup":"catalog-cleanup-v1","outsideTop200":true}'::jsonb
       FROM entities e
      WHERE e.id = egp.entity_id
        AND e.entity_type = 'player'
        AND egp.playable_default = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM ranking_entries re
          JOIN ranking_snapshots rs
            ON rs.id = re.snapshot_id
           AND rs.status <> 'superseded'
          JOIN category_definitions c
            ON c.id = rs.category_id
           AND c.status <> 'retired'
          LEFT JOIN entity_identity_links ranking_identity
            ON ranking_identity.source_entity_id = re.entity_id
          WHERE re.rank <= ${MAX_GAME_RANKING_ENTRIES}
            AND COALESCE(ranking_identity.canonical_entity_id, re.entity_id) = e.id
       )`
  );
  // The selected matrix contains all-time categories. Its historical players
  // must be playable when they have a canonical identity in one of those
  // top-200 snapshots, even if the default modern-audience policy would have
  // excluded them by age or missing birth date. This is a scoped, explicit
  // exception; it does not reopen unrelated categories or entities.
  const historicalCatalog = await client.query<{ id: string }>(
    `WITH selected_entities AS (
       SELECT DISTINCT COALESCE(identity_link.canonical_entity_id, re.entity_id) AS entity_id
       FROM ranking_entries re
       JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
       JOIN category_definitions c
         ON c.id = rs.category_id
        AND c.slug = ANY($1::text[])
        AND c.entity_type = 'player'
        AND c.status <> 'retired'
       LEFT JOIN entity_identity_links identity_link
         ON identity_link.source_entity_id = re.entity_id
       JOIN entities e
         ON e.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
        AND e.entity_type = 'player'
       WHERE re.rank <= ${MAX_GAME_RANKING_ENTRIES}
     )
     UPDATE entities e
        SET catalog_status = 'active',
            metadata = e.metadata || jsonb_build_object(
              'selectedHistoricalMatrix', TRUE,
              'selectedHistoricalMatrixAt', NOW()
            ),
            updated_at = NOW()
       FROM selected_entities selected
      WHERE e.id = selected.entity_id
        AND e.catalog_status <> 'active'
     RETURNING e.id`,
    [SELECTED_DAILY_PLAYER_CATEGORY_SLUGS]
  );
  const historicalProfiles = await client.query<{ id: string }>(
    `WITH selected_entities AS (
       SELECT COALESCE(identity_link.canonical_entity_id, re.entity_id) AS entity_id,
              ARRAY_AGG(DISTINCT c.slug ORDER BY c.slug) AS category_slugs
       FROM ranking_entries re
       JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
       JOIN category_definitions c
         ON c.id = rs.category_id
        AND c.slug = ANY($1::text[])
        AND c.entity_type = 'player'
        AND c.status <> 'retired'
       LEFT JOIN entity_identity_links identity_link
         ON identity_link.source_entity_id = re.entity_id
       JOIN entities e
         ON e.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
        AND e.entity_type = 'player'
       WHERE re.rank <= ${MAX_GAME_RANKING_ENTRIES}
       GROUP BY COALESCE(identity_link.canonical_entity_id, re.entity_id)
     )
     INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
     SELECT selected.entity_id,
            'iconic_legacy',
            TRUE,
            'Jugador histórico presente en el top-200 de la matriz diaria elegida',
            jsonb_build_object(
              'policy', 'modern-audience-v1',
              'curated', TRUE,
              'selectedHistoricalMatrix', TRUE,
              'selectedMatrixCategories', selected.category_slugs,
              'requiresOpenDataRights', TRUE
            )
       FROM selected_entities selected
     ON CONFLICT (entity_id) DO UPDATE SET
       legacy_tier = 'iconic_legacy',
       playable_default = TRUE,
       reason = EXCLUDED.reason,
       reviewed_at = NOW(),
       metadata = entity_game_profiles.metadata || EXCLUDED.metadata
     RETURNING entity_game_profiles.entity_id AS id`,
    [SELECTED_DAILY_PLAYER_CATEGORY_SLUGS]
  );
  // Product policy: the current game does not include players born before
  // 1930 unless they are explicitly admitted by the selected all-time daily
  // matrix. Historical facts remain stored for audit and future modes.
  await client.query(
    `UPDATE entity_game_profiles egp
        SET legacy_tier = 'classic_legacy',
            playable_default = FALSE,
            reason = 'Jugador nacido antes de 1930; fuera del catálogo jugable actual',
            reviewed_at = NOW(),
            metadata = egp.metadata || '{"historicalExclusion":true,"exclusionBasis":"pre_1930_audience_policy"}'::jsonb
       FROM entities e
      WHERE e.id = egp.entity_id
       AND e.entity_type = 'player'
       AND e.birth_date < DATE '1930-01-01'
       AND COALESCE(egp.metadata->>'selectedHistoricalMatrix', 'false') <> 'true'`
  );
  return {
    applied,
    missing,
    expansionApplied: true,
    historicalMatrixApplied: (historicalCatalog.rowCount ?? 0) + (historicalProfiles.rowCount ?? 0)
  };
}
