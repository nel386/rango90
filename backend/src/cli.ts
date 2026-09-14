import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import type { PoolClient } from 'pg';
import { closeDb } from './db.js';
import { seedCatalog } from './seed.js';
import { importRankingInput, readRankingInput, type RankingInput } from './imports/rankingInput.js';
import { pool } from './db.js';
import { config } from './config.js';
import { fetchPremierLeagueRanking, type PremierLeagueMetric } from './providers/premierLeagueClient.js';
import { fetchPremierLeagueTeams } from './providers/premierLeagueTeamsClient.js';
import { fetchPremierLeagueClubTitles } from './providers/premierLeagueTitlesClient.js';
import { fetchBundesligaClubTitles } from './providers/bundesligaTitlesClient.js';
import { fetchDflSupercupTitles } from './providers/dflSupercupTitlesClient.js';
import { ApiFootballClient } from './providers/apiFootballClient.js';
import { downloadCommonsFile, fetchCommonsFile, fetchCommonsFileRest, isValidCommonsCandidate, searchCommonsCandidates, type CommonsImageCandidate } from './providers/commonsClient.js';
import { ensureExternalEntityLink } from './entityLinks.js';
import { fetchUefaChampionsLeagueRanking, fetchUefaConferenceLeagueRanking, fetchUefaEuropaLeagueRanking, fetchUefaEuroRanking, fetchUefaEuroNationalTeamTitles, fetchUefaClubTitles, type UefaPlayerRankingMetric, type UefaWinnersCompetition } from './providers/uefaChampionsLeagueClient.js';
import { fetchAllUefaEuroHistoricalRankings, fetchUefaEuroAllTimeRanking, fetchUefaEuroHistoricalRanking, UEFA_EURO_HISTORICAL_SEASONS, type UefaEuroHistoricalMetric, type UefaEuroHistoricalSeason } from './providers/uefaEuroHistoricalClient.js';
import { fetchBallonDorRanking } from './providers/franceFootballClient.js';
import { fetchRsssfInternationalGoals } from './providers/rsssfInternationalClient.js';
import { fetchWikipediaSerieAGoals } from './providers/wikipediaSerieAClient.js';
import { fetchRsssfWorldCupGoals } from './providers/rsssfWorldCupClient.js';
import { fetchStatbunkerWorldCupAssists } from './providers/statbunkerWorldCupClient.js';
import { fetchStatbunkerWorldCupCards, type StatbunkerWorldCupCardMetric } from './providers/statbunkerWorldCupCardsClient.js';
import { fetchStatbunkerClubWorldCupCleanSheets, fetchStatbunkerCopaAmericaCleanSheets, fetchStatbunkerConferenceCleanSheets, fetchStatbunkerCopaLibertadoresCleanSheets, fetchStatbunkerEuroCleanSheets, fetchStatbunkerEuropaCleanSheets, fetchStatbunkerNationsLeagueCleanSheets, fetchStatbunkerWorldCupCleanSheets } from './providers/statbunkerCleanSheetsClient.js';
import { fetchStatbunkerCompetitionRanking, fetchStatbunkerConferenceAssists, fetchStatbunkerConferenceGoals, fetchStatbunkerConferenceYellowCards, fetchStatbunkerEuroYellowCards, type StatbunkerUefaEuropaCompetition, type StatbunkerUefaEuropaMetric } from './providers/statbunkerUefaEuropaLeagueClient.js';
import { fetchDfbBundesligaGoals } from './providers/dfbBundesligaClient.js';
import { fetchBdfutbolLaLigaGoals } from './providers/bdfutbolLaLigaClient.js';
import { fetchBdfutbolLaLigaRanking, type BdfutbolLaLigaRankingMetric, type BdfutbolLeague } from './providers/bdfutbolLaLigaRankingsClient.js';
import { fetchTransfermarktHistoricalLeagueAssists, fetchTransfermarktLaLigaAssists, transfermarktHistoricalLeagueAssistsConfigs } from './providers/transfermarktLaLigaAssistsClient.js';
import { fetchRsssfCleanSheets } from './providers/rsssfCleanSheetsClient.js';
import { fetchIffhsGoalkeeperRanking } from './providers/iffhsGoalkeeperClient.js';
import { fetchNationalTeamOfficialAssists } from './providers/nationalTeamAssistsClient.js';
import { fetchCopaSudamericanaCleanSheets } from './providers/copaSudamericanaCleanSheetsClient.js';
import { fetchApiFootballCopaSudamericanaCleanSheets } from './providers/apiFootballCopaSudamericanaCleanSheetsClient.js';
import { fetchFifaWorldCupNationalTeamTitles } from './providers/fifaWorldCupClient.js';
import { fetchCopaAmericaNationalTeamTitles } from './providers/copaAmericaTitlesClient.js';
import { fetchUefaNationsLeagueNationalTeamTitles } from './providers/uefaNationsLeagueTitlesClient.js';
import { fetchFifaClubWorldCupClubTitles } from './providers/fifaClubWorldCupTitlesClient.js';
import { fetchFaCupClubTitles } from './providers/faCupTitlesClient.js';
import { fetchWikipediaCopaDelReyClubTitles } from './providers/wikipediaCopaDelReyClient.js';
import { fetchWikipediaCopaLibertadoresClubTitles } from './providers/wikipediaCopaLibertadoresClient.js';
import { fetchTransfermarktClubWorldCupGoals, fetchTransfermarktCopaAmericaGoals, fetchTransfermarktCopaLibertadoresGoals, fetchTransfermarktCopaSudamericanaGoals, fetchTransfermarktEuropeanCupChampionsLeagueGoals, fetchTransfermarktNationsLeagueGoals, fetchTransfermarktUefaEuropaLeagueGoals, fetchTransfermarktWorldCupGoals } from './providers/transfermarktCopaLibertadoresClient.js';
import { fetchWikipediaCopaSudamericanaClubTitles } from './providers/wikipediaCopaSudamericanaClient.js';
import { fetchWikipediaRecopaSudamericanaClubTitles } from './providers/wikipediaRecopaSudamericanaClient.js';
import { fetchDfbPokalClubTitles } from './providers/dfbPokalTitlesClient.js';
import { fetchSerieAClubTitles } from './providers/serieAClubTitlesClient.js';
import { fetchSupercoppaItalianaTitles } from './providers/supercoppaItalianaTitlesClient.js';
import { fetchLaLigaClubTitles } from './providers/laLigaTitlesClient.js';
import { fetchCoppaItaliaClubTitles } from './providers/coppaItaliaTitlesClient.js';
import { fetchLigue1ClubTitles } from './providers/ligue1TitlesClient.js';
import { fetchTropheeChampionsTitles } from './providers/tropheeChampionsTitlesClient.js';
import { fetchTacaPortugalClubTitles } from './providers/tacaPortugalTitlesClient.js';
import { fetchSupercopaEspanaTitles } from './providers/supercopaEspanaTitlesClient.js';
import { fetchCoupeFranceClubTitles } from './providers/coupeFranceTitlesClient.js';
import { fetchPrimeiraLigaClubTitles } from './providers/primeiraLigaTitlesClient.js';
import { fetchSupertacaPortugalClubTitles } from './providers/supertacaPortugalTitlesClient.js';
import { fetchCommunityShieldClubTitles } from './providers/communityShieldTitlesClient.js';
import { aliasesForTheSportsDbPortrait, downloadTheSportsDbImage, fetchTheSportsDbPlayerLicense, lookupTheSportsDbPlayerById, normalizeTheSportsDbName, resolveTheSportsDbBadge, resolveTheSportsDbPlayer, resolveTheSportsDbPortrait, resolveTheSportsDbPortraitById } from './providers/theSportsDbClient.js';
import { downloadOpenverseImage, searchOpenversePlayerCandidates, type OpenverseImageCandidate } from './providers/openverseClient.js';
import { seedGameAudienceProfiles } from './gameAudience.js';
import { cleanupApiFootballSeasonCache, fetchApiFootballLeagueCompleteSeason, fetchApiFootballPremierLeagueCompleteSeason, fetchApiFootballPremierLeagueSeason } from './providers/apiFootballSeasonClient.js';
import { fetchApiFootballPlayerTrophies, type ApiFootballTrophy } from './providers/apiFootballTrophiesClient.js';
import { consolidateApiFootballIdentities, consolidateBdfutbolLaLigaIdentities, consolidateBdfutbolSharedPlayerIdentities, consolidateDfbBundesligaIdentities, consolidateDfbPokalIdentities, consolidateDflSupercupIdentities, consolidateFaCupIdentities, consolidateFootballDataClubIdentities, consolidateFootballDataIncidentIdentities, consolidateRsssfIdentities, consolidateSerieAClubTitlesIdentities, consolidateStatbunkerChampionsLeagueIdentities, consolidateStatbunkerClubWorldCupIdentities, consolidateStatbunkerConferenceIdentities, consolidateStatbunkerCopaAmericaIdentities, consolidateStatbunkerCopaLibertadoresIdentities, consolidateStatbunkerEuroIdentities, consolidateStatbunkerEuropaIdentities, consolidateStatbunkerNationsLeagueIdentities, consolidateStatbunkerWorldCupIdentities, consolidateSupercoppaItalianaIdentities, consolidateTransfermarktBundesligaAssistsIdentities, consolidateTransfermarktClubWorldCupIdentities, consolidateTransfermarktCopaAmericaIdentities, consolidateTransfermarktCopaLibertadoresIdentities, consolidateTransfermarktCopaSudamericanaIdentities, consolidateTransfermarktEuropeanCupChampionsLeagueIdentities, consolidateTransfermarktLaLigaAssistsIdentities, consolidateTransfermarktLigue1AssistsIdentities, consolidateTransfermarktNationsLeagueIdentities, consolidateTransfermarktPrimeiraLigaAssistsIdentities, consolidateTransfermarktSerieAAssistsIdentities, consolidateTransfermarktUefaEuropaLeagueIdentities, consolidateTransfermarktWorldCupIdentities, consolidateUefaChampionsLeagueIdentities, consolidateUefaClubIdentities, consolidateUefaConferenceLeagueIdentities, consolidateUefaEuroIdentities, consolidateUefaSharedClubIdentities, consolidateUefaSharedPlayerIdentities, consolidateWikipediaCopaDelReyIdentities, consolidateWikipediaCopaSudamericanaIdentities, consolidateWikipediaRecopaSudamericanaIdentities, consolidateWikipediaSerieAIdentities, repairIdentityLinks } from './identityConsolidation.js';
import { findUniqueCanonicalEntity, moveEntityDataToCanonical, recordIdentityLink, resolveCanonicalEntityId } from './entityIdentity.js';
import { assertPublishableImageLicense, assertRightsApproval, assertSourceRightsApproval } from './mediaRights.js';
import { MAX_GAME_RANKING_ENTRIES, runDataCatalogCleanup, verifyGameCatalogBoundary } from './catalogCleanup.js';
import { calculateChallengeSha256 } from './game-contract.js';
import { selectCommonDailyEntities, type DailyChallengeCandidate } from './dailyChallengeSelection.js';
import { SELECTED_DAILY_CATEGORY_SLUGS } from './dailyMatrix.js';
import { buildOpenFootballClubTitleRanking, openFootballLeaguesUrl, parseFootballTxtResults, type OpenFootballSeasonSource } from './providers/openFootballClient.js';
import { buildFootballDataNationalLeagueRanking, fetchFootballDataResults, footballDataResultsUrl } from './providers/footballDataResultsClient.js';
import { buildFootballDataCareerCardsRankings, fetchFootballDataIncidents, type FootballDataCardMetric } from './providers/footballDataIncidentsClient.js';

const [command, ...args] = process.argv.slice(2);
const argument = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

/**
 * The catalogue remains a 200-entry ranking for open universes, and daily
 * decisions are drawn only from entities common to the selected categories
 * of the same type. The stronger top-90 band keeps the daily draw varied
 * while the typed common-entity rule guarantees a true 7×7 matrix.
 */
export const DAILY_CHALLENGE_CANDIDATE_RANK = 90;

type DailyChallengeCategorySelection = {
  category_id: string;
  slug: string;
  category_status: string;
  entity_type: 'player' | 'club' | 'national_team';
  snapshot_id: string;
  data_version: string;
  snapshot_status: string;
  coverage_complete: boolean;
  unresolved_conflicts: number;
  eligible_count: number;
  score_cap: number;
  source_rights_status: string | null;
  scope: { closedUniverse?: boolean };
};

type DailyChallengeRankingEntry = {
  snapshot_id: string;
  entity_id: string;
  rank: number;
  score_value: number;
};

function parseDailyChallengeCategories(): string[] {
  const value = argument('categories');
  const categories = (value ?? '').split(',').map((slug) => slug.trim()).filter(Boolean);
  if (categories.length !== 7 || new Set(categories).size !== 7) {
    throw new Error('El reto multicategoría requiere exactamente siete slugs únicos en --categories slug1,slug2,...');
  }
  return categories;
}

async function verifySnapshotRankingEntries(client: Pick<PoolClient, 'query'>, snapshotId: string, closedUniverse: boolean): Promise<void> {
  const result = await client.query<{
    top_count: number;
    unique_count: number;
    non_positive_count: number;
    not_playable_count: number;
    type_mismatch_count: number;
    rank_mismatch_count: number;
    tie_group_mismatch_count: number;
    score_mismatch_count: number;
  }>(
    `WITH ranked_entries AS (
       SELECT re.entity_id, re.raw_value, re.rank, re.score_value, re.tie_group,
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
        WHERE re.snapshot_id = $1
      ), top_entries AS (
       SELECT * FROM ranked_entries WHERE rank <= ${MAX_GAME_RANKING_ENTRIES}
      )
     SELECT COUNT(*)::int AS top_count,
            COUNT(DISTINCT top_entries.canonical_entity_id)::int AS unique_count,
            COUNT(*) FILTER (WHERE top_entries.raw_value <= 0 OR top_entries.score_value <= 0)::int AS non_positive_count,
            COUNT(*) FILTER (
              WHERE canonical_entity.catalog_status <> 'active'
                 OR (canonical_entity.entity_type = 'player' AND NOT EXISTS (
                   SELECT 1 FROM entity_game_profiles playable_profile
                    WHERE playable_profile.entity_id = canonical_entity.id
                      AND playable_profile.playable_default = TRUE
                 ))
            )::int AS not_playable_count,
            COUNT(*) FILTER (WHERE canonical_entity.entity_type <> top_entries.category_entity_type)::int AS type_mismatch_count,
            COUNT(*) FILTER (WHERE top_entries.rank <> top_entries.expected_rank)::int AS rank_mismatch_count,
            COUNT(*) FILTER (WHERE top_entries.tie_group <> top_entries.expected_tie_group)::int AS tie_group_mismatch_count,
            COUNT(*) FILTER (WHERE top_entries.score_value <> LEAST(top_entries.rank, top_entries.score_cap))::int AS score_mismatch_count
       FROM top_entries
       JOIN entities canonical_entity ON canonical_entity.id = top_entries.canonical_entity_id`,
    [snapshotId]
  );
  const counts = result.rows[0];
  const required = closedUniverse ? 1 : MAX_GAME_RANKING_ENTRIES;
  if (!counts || counts.top_count < required || counts.unique_count < required || counts.top_count !== counts.unique_count || counts.non_positive_count > 0 || counts.not_playable_count > 0 || counts.type_mismatch_count > 0 || counts.rank_mismatch_count > 0 || counts.tie_group_mismatch_count > 0 || counts.score_mismatch_count > 0) {
    throw new Error(`El snapshot ${snapshotId} no contiene ${closedUniverse ? 'un universo cerrado jugable' : `${MAX_GAME_RANKING_ENTRIES} entidades jugables reales`} sin duplicados canónicos, padding ni tipos incompatibles`);
  }
}

async function materializeDailyGameChallenge(date: string, categorySlugs: string[], publish: boolean): Promise<{ challengeId: string; snapshotIds: string[]; decisionIds: string[] }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const categoryResult = await client.query<DailyChallengeCategorySelection>(
      `SELECT c.id AS category_id, c.slug, c.status AS category_status, c.entity_type, c.scope,
              rs.id AS snapshot_id, rs.data_version, rs.status AS snapshot_status,
              rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count, c.score_cap,
              s.rights_status AS source_rights_status
         FROM category_definitions c
         JOIN LATERAL (
           SELECT ranking_snapshots.*
             FROM ranking_snapshots
            WHERE ranking_snapshots.category_id = c.id
              AND ranking_snapshots.status IN ('draft', 'approved', 'published')
            ORDER BY ranking_snapshots.status = 'published' DESC,
                     ranking_snapshots.status = 'approved' DESC,
                     ranking_snapshots.generated_at DESC, ranking_snapshots.id DESC
            LIMIT 1
         ) rs ON TRUE
         LEFT JOIN source_snapshots ss ON ss.id = rs.metadata->>'sourceSnapshotId'
         LEFT JOIN sources s ON s.key = ss.source_key
        WHERE c.slug = ANY($1::text[])`,
      [categorySlugs]
    );
    const bySlug = new Map(categoryResult.rows.map((row) => [row.slug, row]));
    const missing = categorySlugs.filter((slug) => !bySlug.has(slug));
    if (missing.length > 0) throw new Error(`No existen las categorías solicitadas: ${missing.join(', ')}`);
    const categories = categorySlugs.map((slug) => bySlug.get(slug) as DailyChallengeCategorySelection);
    const selectedCategorySet = new Set(SELECTED_DAILY_CATEGORY_SLUGS);
    if (categories.length !== selectedCategorySet.size || categories.some((category) => !selectedCategorySet.has(category.slug as typeof SELECTED_DAILY_CATEGORY_SLUGS[number]))) {
      throw new Error(`El reto diario debe usar exactamente la matriz elegida: ${SELECTED_DAILY_CATEGORY_SLUGS.join(', ')}`);
    }
    const categoryTypeCounts = categories.reduce<Record<string, number>>((counts, category) => ({
      ...counts,
      [category.entity_type]: (counts[category.entity_type] ?? 0) + 1
    }), {});
    if (categoryTypeCounts.player !== 5 || categoryTypeCounts.club !== 2 || (categoryTypeCounts.national_team ?? 0) !== 0) {
      throw new Error(`La matriz diaria elegida requiere exactamente cinco categorías de jugadores y dos de equipos; recibido: ${JSON.stringify(categoryTypeCounts)}`);
    }
    const incomplete = categories.filter((category) => {
      const minimumEntries = category.entity_type === 'player' || category.scope?.closedUniverse !== true
        ? MAX_GAME_RANKING_ENTRIES
        : 1;
      return !category.coverage_complete || category.unresolved_conflicts > 0 || category.eligible_count < minimumEntries || category.score_cap !== 100;
    });
    if (incomplete.length > 0) {
      throw new Error(`Las categorías no cumplen su tamaño mínimo de universo, cobertura completa, conflictos resueltos y scoreCap=100: ${incomplete.map((category) => category.slug).join(', ')}`);
    }
    if (publish && categories.some((category) => !['approved', 'published'].includes(category.category_status) || category.snapshot_status !== 'published' || category.source_rights_status !== 'approved')) {
      throw new Error('La publicación requiere categorías aprobadas, snapshots publicados y fuentes con derechos approved');
    }

    const snapshotIds = categories.map((category) => category.snapshot_id);
    const categoriesByEntityType = new Map<string, DailyChallengeCategorySelection[]>();
    for (const category of categories) {
      const group = categoriesByEntityType.get(category.entity_type) ?? [];
      group.push(category);
      categoriesByEntityType.set(category.entity_type, group);
    }
    const challengeSeed = `${date}|${snapshotIds.join('|')}`;
    const decisions: Array<DailyChallengeCandidate & { entityType: DailyChallengeCategorySelection['entity_type'] }> = [];
    for (const [entityType, group] of categoriesByEntityType) {
      const groupSnapshotIds = group.map((category) => category.snapshot_id);
      const entriesResult = await client.query<DailyChallengeRankingEntry>(
        `SELECT DISTINCT ON (re.snapshot_id, canonical_entity.id)
                re.snapshot_id, canonical_entity.id AS entity_id, re.rank, re.score_value
           FROM ranking_entries re
           LEFT JOIN entity_identity_links identity_link
             ON identity_link.source_entity_id = re.entity_id
           JOIN entities canonical_entity
             ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
          WHERE re.snapshot_id = ANY($1::text[])
            AND re.rank <= ${MAX_GAME_RANKING_ENTRIES}
            AND canonical_entity.entity_type = $2
            AND canonical_entity.catalog_status = 'active'
            AND (canonical_entity.entity_type <> 'player' OR EXISTS (
              SELECT 1 FROM entity_game_profiles playable_profile
               WHERE playable_profile.entity_id = canonical_entity.id
                 AND playable_profile.playable_default = TRUE
            ))
          ORDER BY re.snapshot_id, canonical_entity.id, re.rank, re.entity_id`,
        [groupSnapshotIds, entityType]
      );
      const groupCandidates = selectCommonDailyEntities(
        entriesResult.rows.map((entry) => ({
          snapshotId: entry.snapshot_id,
          entityId: entry.entity_id,
          rank: entry.rank,
          scoreValue: entry.score_value
        })),
        groupSnapshotIds,
        `${challengeSeed}|${entityType}`,
        DAILY_CHALLENGE_CANDIDATE_RANK,
        group.length
      );
      if (groupCandidates.length < group.length) {
        throw new Error(`No hay ${group.length} entidades ${entityType} comunes a sus categorías (con al menos una posición dentro del top ${DAILY_CHALLENGE_CANDIDATE_RANK}); solo hay ${groupCandidates.length}`);
      }
      decisions.push(...groupCandidates.map((candidate) => ({ ...candidate, entityType: entityType as DailyChallengeCategorySelection['entity_type'] })));
    }
    const challengeKey = `${date}|${categories.map((category) => `${category.slug}:${category.snapshot_id}`).join('|')}`;
    const challengeId = `daily_${date}_${createHash('sha256').update(challengeKey).digest('hex').slice(0, 16)}`;
    const sourceVersion = categories.map((category) => `${category.slug}@${category.data_version}`).join('|');
    const challengeSha256 = calculateChallengeSha256({
      id: challengeId,
      kind: 'daily',
      challengeDate: date,
      sourceVersion,
      engineVersion: 'game-engine-v2',
      timeLimitSeconds: 90,
      scoreCap: 100,
      categories: categories.map((category, ordinal) => ({ ordinal, categoryId: category.category_id, rankingSnapshotId: category.snapshot_id, slug: category.slug, entityType: category.entity_type })),
      decisions: decisions.map((decision, ordinal) => ({ ordinal, entityId: decision.entityId, entityType: decision.entityType })),
      answers: decisions.flatMap((decision, decisionOrdinal) => categories
        .filter((category) => category.entity_type === decision.entityType)
        .map((category) => ({
          decisionOrdinal,
          categoryId: category.category_id,
          scoreValue: decision.bySnapshot.get(category.snapshot_id)?.scoreValue ?? 100
        })))
    });
    const existing = await client.query<{ status: string }>('SELECT status FROM game_challenges WHERE id = $1 FOR UPDATE', [challengeId]);
    if (existing.rows[0]?.status === 'published') throw new Error(`El reto ${challengeId} ya está publicado y es inmutable`);
    await client.query(
      `INSERT INTO game_challenges
         (id, challenge_kind, challenge_date, status, source_version, engine_version, time_limit_seconds, score_cap, challenge_sha256, published_at, retired_at, metadata)
       VALUES ($1, 'daily', $2, 'draft', $3, 'game-engine-v2', 90, 100, $4, NULL, NULL, $5::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         challenge_date = EXCLUDED.challenge_date,
         status = 'draft', source_version = EXCLUDED.source_version,
         engine_version = EXCLUDED.engine_version, time_limit_seconds = EXCLUDED.time_limit_seconds,
         score_cap = EXCLUDED.score_cap, challenge_sha256 = EXCLUDED.challenge_sha256,
         published_at = NULL, retired_at = NULL, metadata = EXCLUDED.metadata, updated_at = NOW()`,
      [challengeId, date, sourceVersion, challengeSha256, JSON.stringify({ materialization: 'daily-multicategory-v4-typed-entities', categories: categorySlugs, snapshotIds, decisionCount: decisions.length, entityTypes: [...categoriesByEntityType.keys()], candidateRankLimit: DAILY_CHALLENGE_CANDIDATE_RANK, selection: 'deterministic-shuffle-v2', selectionSeed: challengeSeed, commonWithinEntityType: true })]
    );
    await client.query('DELETE FROM game_challenge_answers WHERE game_challenge_id = $1', [challengeId]);
    await client.query('DELETE FROM game_challenge_decisions WHERE game_challenge_id = $1', [challengeId]);
    await client.query('DELETE FROM game_challenge_categories WHERE game_challenge_id = $1', [challengeId]);
    for (const [ordinal, category] of categories.entries()) {
      await client.query(
        `INSERT INTO game_challenge_categories (game_challenge_id, category_id, category_ordinal, ranking_snapshot_id) VALUES ($1, $2, $3, $4)`,
        [challengeId, category.category_id, ordinal, category.snapshot_id]
      );
    }
    for (const [ordinal, decision] of decisions.entries()) {
      await client.query(
        `INSERT INTO game_challenge_decisions (game_challenge_id, decision_ordinal, entity_id) VALUES ($1, $2, $3)`,
        [challengeId, ordinal, decision.entityId]
      );
      for (const category of categories) {
        if (category.entity_type === decision.entityType) {
          await client.query(
            `INSERT INTO game_challenge_answers (game_challenge_id, decision_ordinal, category_id, score_value) VALUES ($1, $2, $3, $4)`,
            [challengeId, ordinal, category.category_id, decision.bySnapshot.get(category.snapshot_id)?.scoreValue]
          );
        }
      }
    }
    if (publish) await client.query(`UPDATE game_challenges SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = $1`, [challengeId]);
    await client.query('COMMIT');
    return { challengeId, snapshotIds, decisionIds: decisions.map((decision) => decision.entityId) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function nonNegativeInteger(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isInteger(value) && value >= 0 ? value : null;
}

function isApiFootballGoalkeeperPosition(position: string | null | undefined): boolean {
  const normalized = position?.trim().toLowerCase();
  return normalized === 'goalkeeper' || normalized === 'gk' || normalized === 'g';
}

type StoredApiFootballSeasonRow = {
  player?: { id?: number };
  statistic?: {
    team?: { id?: number };
    games?: { position?: string | null };
    goals?: { conceded?: number | null };
  };
};

async function backfillApiFootballGoalkeeperStats(): Promise<void> {
  const snapshotRows = await pool.query<{
    id: string;
    storage_uri: string | null;
    retrieved_at: string;
    metadata: { competitionId?: string; seasonYear?: number };
  }>(
    `SELECT id, storage_uri, retrieved_at, metadata
     FROM source_snapshots
     WHERE source_key = 'api-football'
       AND metadata->>'importType' = 'api-football-league-complete-season'
     ORDER BY retrieved_at ASC`
  );
  const latestBySeason = new Map<string, (typeof snapshotRows.rows)[number]>();
  for (const snapshot of snapshotRows.rows) {
    const competitionId = snapshot.metadata.competitionId;
    const seasonYear = snapshot.metadata.seasonYear;
    if (!competitionId || typeof seasonYear !== 'number' || !Number.isInteger(seasonYear)) continue;
    latestBySeason.set(`${competitionId}:${seasonYear}`, snapshot);
  }

  const externalIds = await pool.query<{ external_id: string; entity_id: string }>(
    `SELECT external_id, entity_id
     FROM entity_external_ids
     WHERE source_key = 'api-football' AND entity_type = 'player'`
  );
  const entityByExternalId = new Map(externalIds.rows.map((row) => [row.external_id, row.entity_id]));
  const links = await pool.query<{ source_entity_id: string; canonical_entity_id: string }>(
    'SELECT source_entity_id, canonical_entity_id FROM entity_identity_links'
  );
  const canonicalByEntityId = new Map(links.rows.map((row) => [row.source_entity_id, row.canonical_entity_id]));
  const resolveCanonical = (entityId: string): string => canonicalByEntityId.get(entityId) ?? entityId;

  const client = await pool.connect();
  let snapshotsProcessed = 0;
  let sourceRows = 0;
  let matchedRows = 0;
  let statsRowsUpdated = 0;
  let entitiesUpdated = 0;
  const unmatched: Array<{ snapshotId: string; playerId: number; teamId: number }> = [];
  try {
    await client.query('BEGIN');
    for (const snapshot of latestBySeason.values()) {
      const storagePath = resolve(config.snapshotRoot, basename(snapshot.storage_uri ?? `${snapshot.id}.json`));
      const raw = JSON.parse(await readFile(storagePath, 'utf8')) as { rows?: StoredApiFootballSeasonRow[] };
      const seasonYear = snapshot.metadata.seasonYear;
      const competitionId = snapshot.metadata.competitionId;
      if (!competitionId || typeof seasonYear !== 'number' || !Number.isInteger(seasonYear)) continue;
      const updates = new Map<string, {
        entityId: string;
        competitionId: string;
        seasonYear: number;
        providerTeamId: number;
        goalsConceded: number | null;
      }>();
      const entityUpdates = new Map<string, { entityId: string; position: string | null; isGoalkeeper: boolean }>();
      for (const row of raw.rows ?? []) {
        sourceRows += 1;
        const playerId = row.player?.id;
        const teamId = row.statistic?.team?.id;
        if (typeof playerId !== 'number' || !Number.isInteger(playerId) || typeof teamId !== 'number' || !Number.isInteger(teamId)) continue;
        const sourceEntityId = entityByExternalId.get(String(playerId));
        if (!sourceEntityId) {
          unmatched.push({ snapshotId: snapshot.id, playerId, teamId });
          continue;
        }
        const entityId = resolveCanonical(sourceEntityId);
        const position = row.statistic?.games?.position ?? null;
        const isGoalkeeper = isApiFootballGoalkeeperPosition(position);
        const previousEntity = entityUpdates.get(entityId);
        entityUpdates.set(entityId, {
          entityId,
          position: isGoalkeeper ? position : (previousEntity?.position ?? position),
          isGoalkeeper: Boolean(previousEntity?.isGoalkeeper) || isGoalkeeper
        });
        updates.set(`${entityId}:${teamId}`, {
          entityId,
          competitionId,
          seasonYear,
          providerTeamId: teamId,
          goalsConceded: nonNegativeInteger(row.statistic?.goals?.conceded)
        });
      }
      if (updates.size > 0) {
        const result = await client.query(
          `UPDATE player_season_stats AS p
           SET goals_conceded = v.goals_conceded,
               metadata = p.metadata || '{"goalkeeperStatsBackfilled":true}'::jsonb,
               updated_at = NOW()
           FROM jsonb_to_recordset($1::jsonb) AS v(
             entity_id text, competition_id text, season_year integer,
             provider_team_id integer, goals_conceded integer
           )
           WHERE p.entity_id = v.entity_id
             AND p.competition_id = v.competition_id
             AND p.season_year = v.season_year
             AND p.provider_team_id = v.provider_team_id`,
          [JSON.stringify([...updates.values()].map((update) => ({
            entity_id: update.entityId,
            competition_id: update.competitionId,
            season_year: update.seasonYear,
            provider_team_id: update.providerTeamId,
            goals_conceded: update.goalsConceded
          })))]
        );
        statsRowsUpdated += result.rowCount ?? 0;
        matchedRows += updates.size;
      }
      if (entityUpdates.size > 0) {
        const result = await client.query(
          `UPDATE entities AS e
           SET position = COALESCE(v.position, e.position),
               is_goalkeeper = e.is_goalkeeper OR v.is_goalkeeper,
               metadata = e.metadata || '{"goalkeeperPositionBackfilled":true}'::jsonb,
               updated_at = NOW()
           FROM jsonb_to_recordset($1::jsonb) AS v(
             entity_id text, position text, is_goalkeeper boolean
           )
           WHERE e.id = v.entity_id`,
          [JSON.stringify([...entityUpdates.values()].map((update) => ({
            entity_id: update.entityId,
            position: update.position,
            is_goalkeeper: update.isGoalkeeper
          })))]
        );
        entitiesUpdated += result.rowCount ?? 0;
      }
      snapshotsProcessed += 1;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({
    source: 'api-football',
    snapshotsProcessed,
    sourceRows,
    matchedRows,
    statsRowsUpdated,
    entitiesUpdated,
    unmatchedRows: unmatched.length,
    unmatched: unmatched.slice(0, 25),
    note: 'Se rellena únicamente goals_conceded cuando el snapshot lo proporciona; clean_sheets no se infiere desde este endpoint.'
  }, null, 2));
}

const apiFootballPlayerTitleCompetitionAliases: Record<string, string[]> = {
  'premier-league': ['premier league'],
  'la-liga': ['la liga', 'laliga'],
  bundesliga: ['bundesliga'],
  'serie-a': ['serie a'],
  'ligue-1': ['ligue 1'],
  'primeira-liga': ['primeira liga'],
  'uefa-champions-league': ['uefa champions league', 'champions league'],
  'uefa-cup-europa-league': ['uefa europa league', 'europa league', 'uefa cup'],
  'copa-libertadores': ['conmebol libertadores', 'copa libertadores'],
  'copa-sudamericana': ['conmebol sudamericana', 'copa sudamericana'],
  'copa-america': ['conmebol copa america', 'copa america'],
  'world-cup': ['fifa world cup', 'world cup'],
  euro: ['uefa european championship', 'euro'],
  'nations-league': ['uefa nations league', 'nations league'],
  'club-world-cup': ['fifa club world cup', 'club world cup'],
  'afc-champions-league': ['afc champions league', 'afc champions league elite'],
  'caf-champions-league': ['caf champions league'],
  'concacaf-champions-cup': ['concacaf champions cup', 'concacaf champions league']
};
const apiFootballPlayerTitleCompetitionCountries: Record<string, string[]> = {
  'premier-league': ['england'],
  'la-liga': ['spain'],
  bundesliga: ['germany'],
  'serie-a': ['italy'],
  'ligue-1': ['france'],
  'primeira-liga': ['portugal']
};

/**
 * Normalize API-Football trophy labels into stable competition keys. The
 * endpoint returns far more than the six domestic leagues originally used by
 * the importer. Keep senior official competitions, exclude youth/reserve and
 * exhibition records, and preserve the country for generic labels such as
 * "Cup" so two national cups cannot collapse into one competition.
 */
function apiFootballTrophyCompetition(value: string, country: string | null | undefined): string | null {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
  const normalizedCountry = country?.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim() ?? '';
  if (!normalized) return null;
  if (/(?:^| )(?:u ?(?:17|19|20|21|23)|u(?:17|19|20|21|23)|junior|youth|reserve|primavera|juvenil|amateur|all stars?)(?: |$)/u.test(normalized)
    || /(?:friendly|testimonial|audi cup|arena cup|challenge match|training)/u.test(normalized)) return null;
  for (const [competition, aliases] of Object.entries(apiFootballPlayerTitleCompetitionAliases)) {
    if (!aliases.includes(normalized)) continue;
    const countries = apiFootballPlayerTitleCompetitionCountries[competition];
    if (!countries || countries.includes(normalizedCountry)) return competition;
  }
  const countryKey = normalizedCountry.replace(/\s+/gu, '-').replace(/[^a-z0-9-]/gu, '') || 'unknown';
  const competitionKey = normalized.replace(/\s+/gu, '-').replace(/[^a-z0-9-]/gu, '');
  return competitionKey ? `api-football:${countryKey}:${competitionKey}` : null;
}

function isApiFootballWinner(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === 'winner';
}

function commonsTitleFromSourceUrl(sourceUrl: string): string | null {
  const marker = 'https://commons.wikimedia.org/wiki/';
  if (!sourceUrl.startsWith(marker)) return null;
  try {
    const title = decodeURIComponent(sourceUrl.slice(marker.length)).replaceAll('_', ' ');
    return title.startsWith('File:') ? title : null;
  } catch {
    return null;
  }
}

function preferredApiPlayerName(name: string | undefined, firstname: string | undefined, lastname: string | undefined): string {
  if (name && !/^\p{L}\./u.test(name)) return name;
  const abbreviatedSurname = name?.match(/^\p{L}\.\s*(.+)$/u)?.[1]?.trim();
  const firstName = firstname?.trim().split(/\s+/)[0];
  const lastName = abbreviatedSurname || lastname?.trim();
  return [firstName, lastName].filter(Boolean).join(' ') || name || '';
}

function validApiFootballBirthDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

type ApiFootballTeamRow = { team?: { id?: number; name?: string | null } };
type ApiFootballPlayerRow = {
  player?: {
    id?: number;
    name?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    photo?: string | null;
  };
};

function selectApiFootballTeam(rows: ApiFootballTeamRow[], sourceTeamName: string): { id: string; name: string } | null {
  const comparable = (value: string): string => normalizeTheSportsDbName(value).replace(/^(?:fc|cf|sc|ac|sv|fk|nk|rks)\s+/u, '');
  const source = comparable(sourceTeamName);
  const candidates = rows
    .map((row) => ({ id: row.team?.id, name: row.team?.name?.trim() }))
    .filter((team): team is { id: number; name: string } => Number.isInteger(team.id) && Boolean(team.name))
    .filter((team) => {
      const name = comparable(team.name);
      return name === source || name.startsWith(`${source} `) || source.startsWith(`${name} `);
    })
    .filter((team) => !/\b(women|woman|ladies|u19|u21|ii|iii|academy|reserve)\b/u.test(normalizeTheSportsDbName(team.name)));
  const unique = new Map(candidates.map((team) => [team.id, team]));
  if (unique.size !== 1) return null;
  const team = [...unique.values()][0];
  if (!team) return null;
  return { id: String(team.id), name: team.name };
}

function selectApiFootballPlayer(rows: ApiFootballPlayerRow[], targetName: string, aliases: string[]): { id: string; name: string; photo: string | null } | null {
  const accepted = new Set([targetName, ...aliases].map(normalizeTheSportsDbName));
  const targetIsSingleSurname = normalizeTheSportsDbName(targetName).split(' ').length === 1;
  const candidates = rows
    .map((row) => {
      const player = row.player;
      if (!player?.id || !player.name) return null;
      const fullName = [player.firstname, player.lastname].filter(Boolean).join(' ');
      const names = [player.name, fullName].filter(Boolean).map(normalizeTheSportsDbName);
      const exactName = names.some((name) => accepted.has(name));
      const exactSurname = targetIsSingleSurname && player.lastname
        ? accepted.has(normalizeTheSportsDbName(player.lastname))
        : false;
      return exactName || exactSurname
        ? { id: String(player.id), name: player.name, photo: player.photo ?? null }
        : null;
    })
    .filter((player): player is { id: string; name: string; photo: string | null } => Boolean(player));
  const unique = new Map(candidates.map((player) => [player.id, player]));
  if (unique.size !== 1) return null;
  return [...unique.values()][0] ?? null;
}

async function resolveApiFootballPlayerByTeam(
  client: ApiFootballClient,
  sourceTeamName: string,
  targetName: string,
  aliases: string[],
  season: number
): Promise<{ player: { id: string; name: string; photo: string | null }; team: { id: string; name: string } } | null> {
  const teamPayload = await client.request<{ response?: ApiFootballTeamRow[] }>('/teams', { search: sourceTeamName });
  const team = selectApiFootballTeam(teamPayload.response ?? [], sourceTeamName);
  if (!team) return null;
  const players = await client.requestAllPages<ApiFootballPlayerRow>('/players', { team: team.id, season });
  const player = selectApiFootballPlayer(players, targetName, aliases);
  return player ? { player, team } : null;
}

async function verifySnapshotArchive(snapshot: { storage_uri: string | null; content_sha256: string | null }): Promise<void> {
  if (!snapshot.storage_uri || !snapshot.content_sha256) {
    throw new Error('El snapshot no tiene archivo de evidencia archivado');
  }
  const archivePath = resolve(config.snapshotRoot, basename(snapshot.storage_uri));
  const archiveHash = createHash('sha256').update(await readFile(archivePath)).digest('hex');
  if (archiveHash !== snapshot.content_sha256) {
    throw new Error('El hash del archivo de evidencia no coincide con PostgreSQL');
  }
}

async function resolveCanonicalEntityIdFromPool(entityId: string): Promise<string> {
  let current = entityId;
  const visited = new Set<string>();
  for (let depth = 0; depth < 5; depth += 1) {
    if (visited.has(current)) throw new Error(`Ciclo de identidades detectado para ${entityId}`);
    visited.add(current);
    const result = await pool.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [current]
    );
    const next = result.rows[0]?.canonical_entity_id;
    if (!next || next === current) return current;
    current = next;
  }
  throw new Error(`Cadena de identidades demasiado larga para ${entityId}`);
}

async function assertPortraitStillNeedsStaging(entityId: string): Promise<void> {
  const existing = await pool.query<{ id: string; canonical_name: string }>(
    `WITH RECURSIVE identity_walk AS (
       SELECT source_entity_id, canonical_entity_id,
              ARRAY[source_entity_id, canonical_entity_id]::text[] AS path
       FROM entity_identity_links
       UNION ALL
       SELECT iw.source_entity_id, link.canonical_entity_id,
              iw.path || link.canonical_entity_id
       FROM identity_walk iw
       JOIN entity_identity_links link ON link.source_entity_id = iw.canonical_entity_id
       WHERE NOT link.canonical_entity_id = ANY(iw.path)
         AND cardinality(iw.path) < 20
     ), resolved_identity AS (
       SELECT DISTINCT ON (source_entity_id) source_entity_id, canonical_entity_id
       FROM identity_walk
       ORDER BY source_entity_id, cardinality(path) DESC
     )
     SELECT ia.id, canonical_entity.canonical_name
     FROM image_assets ia
     JOIN entities asset_entity ON asset_entity.id = ia.entity_id
     LEFT JOIN resolved_identity link ON link.source_entity_id = ia.entity_id
     JOIN entities canonical_entity ON canonical_entity.id = COALESCE(link.canonical_entity_id, ia.entity_id)
     WHERE COALESCE(link.canonical_entity_id, ia.entity_id) = $1
       AND ia.asset_kind = 'portrait'
       AND ia.is_primary = TRUE
       AND ia.review_status = 'approved'
       AND ia.rights_basis <> 'unknown'
       AND ia.commercial_use = TRUE
       AND ia.rights_verified_at IS NOT NULL
       AND ia.rights_evidence_url IS NOT NULL
       AND jsonb_array_length(ia.usage_scope) > 0
       AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
     LIMIT 1`,
    [entityId]
  );
  if (existing.rows[0]) {
    throw new Error(`El jugador ${existing.rows[0].canonical_name} ya tiene un retrato publicable (${existing.rows[0].id})`);
  }
}

async function stageCommonsCandidate(entityId: string, requestedKind: string | undefined, candidate: CommonsImageCandidate): Promise<void> {
  // Resolve the complete reviewed identity chain before checking/staging
  // media. A one-hop lookup could create a second canonical portrait when a
  // legacy source entity points through an intermediate identity record.
  entityId = await resolveCanonicalEntityIdFromPool(entityId);
  const entity = await pool.query<{ id: string; entity_type: 'player' | 'club' | 'national_team'; canonical_name: string }>(
    'SELECT id, entity_type, canonical_name FROM entities WHERE id = $1',
    [entityId]
  );
  const current = entity.rows[0];
  if (!current) throw new Error(`Entidad inexistente: ${entityId}`);
  const inferredKind = current.entity_type === 'player' ? 'portrait' : 'badge';
  const assetKind = requestedKind ?? inferredKind;
  if (!['portrait', 'badge'].includes(assetKind)) throw new Error('El tipo de activo debe ser portrait o badge');
  if ((assetKind === 'portrait' && current.entity_type !== 'player') || (assetKind === 'badge' && current.entity_type === 'player')) {
    throw new Error(`El activo ${assetKind} no corresponde al tipo ${current.entity_type}`);
  }
  // Historical portraits are often narrow scans or photographs whose shortest
  // side is just below the delivery size.  A bounded upscale is safer
  // than discarding an otherwise clear, individually identifiable portrait.
  // Visual review remains mandatory before publication.
  if (assetKind === 'portrait' && (candidate.width < 320 || candidate.height < 320)) {
    throw new Error('El retrato original no alcanza 320 px en ambos lados; se descarta para evitar ampliaciones borrosas');
  }
  if (!candidate.mimeType.startsWith('image/')
    || /\.(?:pdf|djvu)$/i.test(candidate.fileUrl)
    || (assetKind === 'portrait' && /\.svg$/i.test(candidate.fileUrl))
    || /\b(?:pdf|djvu|scan|book|document|journal|yearbook)\b/i.test(`${candidate.title} ${candidate.description ?? ''}`)) {
    throw new Error(assetKind === 'badge'
      ? 'El candidato Commons no es un archivo de imagen adecuado para un escudo'
      : 'El candidato Commons no es una fotografía raster adecuada');
  }
  const existingPublishable = await pool.query<{ id: string }>(
    `SELECT id
     FROM image_assets
     WHERE entity_id = $1
       AND asset_kind = $2
       AND is_primary = TRUE
       AND review_status = 'approved'
       AND rights_basis <> 'unknown'
       AND commercial_use = TRUE
       AND rights_verified_at IS NOT NULL
       AND rights_evidence_url IS NOT NULL
       AND jsonb_array_length(usage_scope) > 0
       AND ($2 <> 'badge' OR trademark_status = 'cleared')
       AND (attribution_required = FALSE OR NULLIF(attribution_text, '') IS NOT NULL)
     LIMIT 1`,
    [entityId, assetKind]
  );
  if (existingPublishable.rows[0] && !args.includes('--replace-primary')) {
    throw new Error(`La entidad ${current.canonical_name} ya tiene un ${assetKind} principal publicable (${existingPublishable.rows[0].id}); se ignora el candidato redundante`);
  }
  const existingSource = await pool.query<{ id: string; review_status: string }>(
    `SELECT id, review_status
     FROM image_assets
     WHERE entity_id = $1 AND asset_kind = $2 AND source_url = $3
     LIMIT 1`,
    [entityId, assetKind, candidate.descriptionUrl]
  );
  const reopenRejected = args.includes('--reopen-rejected') && existingSource.rows[0]?.review_status === 'rejected';
  if (existingSource.rows[0] && !reopenRejected) {
    throw new Error(`La fuente ya está registrada para ${current.canonical_name} (${existingSource.rows[0].id}, ${existingSource.rows[0].review_status}); no se vuelve a importar`);
  }
  const isPublicDomain = candidate.licenseName?.toLowerCase().includes('public domain') ?? false;
  if (!candidate.licenseName || candidate.rightsClass === 'unknown_or_restricted' || (!candidate.licenseUrl && !isPublicDomain)) {
    throw new Error('El archivo no tiene una licencia explícita compatible; queda descartado');
  }
  if (!candidate.descriptionUrl.startsWith('https://commons.wikimedia.org/wiki/File:') || !candidate.fileUrl.startsWith('https://upload.wikimedia.org/')) {
    throw new Error('El archivo no procede de un dominio de Commons permitido');
  }
  let inputBytes: Buffer;
  try {
    inputBytes = await downloadCommonsFile(candidate.thumbnailUrl ?? candidate.fileUrl);
  } catch (thumbnailError) {
    try {
      inputBytes = await downloadCommonsFile(candidate.fileUrl);
    } catch (originalError) {
      const fallbackThumbnail = buildCommonsThumbnailUrl(candidate.fileUrl, 960);
      if (!fallbackThumbnail) throw originalError;
      try {
        inputBytes = await downloadCommonsFile(fallbackThumbnail);
      } catch {
        throw thumbnailError;
      }
    }
  }
  if (inputBytes.length === 0 || inputBytes.length > 15 * 1024 * 1024) throw new Error('Tamaño de imagen no permitido');
  const normalizedBytes = await sharp(inputBytes)
    .rotate()
    .ensureAlpha()
    .resize(512, 512, assetKind === 'badge'
      ? { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
      : { fit: 'cover', position: 'top' })
    .webp({ quality: 88 })
    .toBuffer();
  const normalizedHash = createHash('sha256').update(normalizedBytes).digest('hex');
  const assetId = existingSource.rows[0]?.id ?? `img_${createHash('sha256').update(`${entityId}:${assetKind}:${candidate.descriptionUrl}:${normalizedHash}`).digest('hex').slice(0, 24)}`;
  await mkdir(resolve(config.mediaRoot), { recursive: true });
  const localPath = resolve(config.mediaRoot, `${entityId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${normalizedHash.slice(0, 24)}.webp`);
  await writeFile(localPath, normalizedBytes);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, local_path, provider, license_name, license_url, width, height, mime_type, sha256, is_primary, review_status, metadata)
       VALUES ($1, $2, $3, $4, $5, 'wikimedia-commons', $6, $7, 512, 512, 'image/webp', $8, FALSE, 'pending', $9)
       ON CONFLICT (id) DO UPDATE SET local_path = EXCLUDED.local_path, license_name = EXCLUDED.license_name, license_url = EXCLUDED.license_url, sha256 = EXCLUDED.sha256, review_status = 'pending', is_primary = FALSE, metadata = EXCLUDED.metadata`,
      [assetId, entityId, assetKind, candidate.descriptionUrl, localPath, candidate.licenseName, candidate.licenseUrl, normalizedHash, JSON.stringify({
        ...candidate,
        ...(reopenRejected ? {
          reopenedAt: new Date().toISOString(),
          reopenedFromRejected: true,
          reopeningReason: 'Nueva revisión manual de identidad y encuadre'
        } : {})
      })]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({ assetId, entityId, entityName: current.canonical_name, assetKind, localPath, licenseName: candidate.licenseName, sourceUrl: candidate.descriptionUrl, reviewStatus: 'pending' }, null, 2));
}

async function removeRegisteredCommonsCandidates(entityId: string, assetKind: 'portrait' | 'badge', candidates: CommonsImageCandidate[]): Promise<CommonsImageCandidate[]> {
  if (candidates.length === 0) return candidates;
  const registered = await pool.query<{ source_url: string }>(
    `WITH identity_entities AS (
       SELECT $1::text AS entity_id
       UNION
       SELECT eil.canonical_entity_id
       FROM entity_identity_links eil
       WHERE eil.source_entity_id = $1
       UNION
       SELECT eil.source_entity_id
       FROM entity_identity_links eil
       WHERE eil.canonical_entity_id = $1
     )
     SELECT ia.source_url
     FROM image_assets ia
     JOIN identity_entities ie ON ie.entity_id = ia.entity_id
     WHERE ia.asset_kind = $2`,
    [entityId, assetKind]
  );
  const registeredSources = new Set(registered.rows.map((row) => row.source_url));
  return candidates.filter((candidate) => !registeredSources.has(candidate.descriptionUrl));
}

async function recordCommonsDiscoveryAttempt(
  entityId: string,
  candidates: CommonsImageCandidate[],
  error?: string,
  assetKind: 'portrait' | 'badge' = 'portrait'
): Promise<void> {
  const canonical = await pool.query<{ canonical_entity_id: string }>(
    'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
    [entityId]
  );
  const targetEntityId = canonical.rows[0]?.canonical_entity_id ?? entityId;
  const discoveryPath = `{mediaDiscovery,wikimedia-commons,${assetKind}}`;
  await pool.query(
    `UPDATE entities
     SET metadata = jsonb_set(
       jsonb_set(
         jsonb_set(
           metadata,
           '{mediaDiscovery}',
           COALESCE(metadata->'mediaDiscovery', '{}'::jsonb),
           TRUE
         ),
         '{mediaDiscovery,wikimedia-commons}',
         COALESCE(metadata->'mediaDiscovery'->'wikimedia-commons', '{}'::jsonb),
         TRUE
       ),
       '${discoveryPath}',
       $2::jsonb,
       TRUE
     ), updated_at = NOW()
     WHERE id = $1`,
    [targetEntityId, JSON.stringify({
      status: error ? 'error' : candidates.length > 0 ? 'candidates' : 'no_candidate',
      candidateCount: candidates.length,
      attemptedAt: new Date().toISOString(),
      ...(error ? { error } : {})
    })]
  );
}

async function recordTheSportsDbDiscoveryAttempt(
  entityId: string,
  candidate: Awaited<ReturnType<typeof resolveTheSportsDbPortrait>>,
  error?: string
): Promise<void> {
  const canonical = await pool.query<{ canonical_entity_id: string }>(
    'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
    [entityId]
  );
  const targetEntityId = canonical.rows[0]?.canonical_entity_id ?? entityId;
  await pool.query(
    `UPDATE entities
     SET metadata = jsonb_set(
       jsonb_set(
         jsonb_set(
           metadata,
           '{mediaDiscovery}',
           COALESCE(metadata->'mediaDiscovery', '{}'::jsonb),
           TRUE
         ),
         '{mediaDiscovery,thesportsdb}',
         COALESCE(metadata->'mediaDiscovery'->'thesportsdb', '{}'::jsonb),
         TRUE
       ),
       '{mediaDiscovery,thesportsdb,portrait}',
       $2::jsonb,
       TRUE
     ), updated_at = NOW()
     WHERE id = $1`,
    [targetEntityId, JSON.stringify({
      status: error ? 'error' : candidate ? 'candidate' : 'no_candidate',
      candidateCount: candidate ? 1 : 0,
      attemptedAt: new Date().toISOString(),
      ...(candidate ? { externalId: candidate.externalId, playerName: candidate.playerName } : {}),
      ...(error ? { error } : {})
    })]
  );
}

const theSportsDbAliases: Record<string, string[]> = {
  'Brighton and Hove Albion': ['Brighton & Hove Albion', 'Brighton'],
  'Tottenham Hotspur': ['Tottenham'],
  'Wolverhampton Wanderers': ['Wolverhampton', 'Wolves'],
  'B. Dortmund': ['Borussia Dortmund', 'Dortmund'],
  'Man City': ['Manchester City'],
  'Man Utd': ['Manchester United', 'Man United'],
  "Nott'm Forest": ['Nottingham Forest'],
  'Paris': ['Paris Saint-Germain', 'Paris SG'],
  'Steaua București': ['FCSB', 'Steaua Bucharest'],
  'Estudiantes (LP)': ['Estudiantes de La Plata'],
  'Liga de Quito': ['LDU Quito', 'Liga Deportiva Universitaria'],
  'Colo-Colo': ['Colo Colo'],
  Cologne: ['Köln', '1. FC Köln', 'FC Köln'],
  Nuremberg: ['Nürnberg', '1. FC Nürnberg', 'FC Nürnberg'],
  'VfB Stuttgart': ['Stuttgart'],
  '1. FC Kaiserslautern': ['Kaiserslautern'],
  'AS Monaco FC': ['AS Monaco', 'Monaco'],
  'Athletic Club': ['Athletic Bilbao', 'Athletic Club Bilbao'],
  'Bayern München': ['Bayern Munich', 'FC Bayern Munich'],
  Betis: ['Real Betis', 'Real Betis Balompié', 'Real Betis Balompie'],
  'CSKA Moskva': ['CSKA Moscow', 'CSKA Moskva'],
  'FC Girondins de Bordeaux': ['Girondins de Bordeaux', 'Bordeaux'],
  'FC Nantes Atlantique': ['FC Nantes', 'Nantes'],
  'FC Sochaux Montbéliard': ['FC Sochaux-Montbéliard', 'Sochaux'],
  Inter: ['Inter Milan', 'Internazionale'],
  Milan: ['AC Milan'],
  Mönchengladbach: ['Borussia Mönchengladbach', 'Borussia Monchengladbach'],
  'OGC Nice': ['Nice'],
  'Olympique Lyonnais': ['Olympique Lyon', 'Lyon'],
  PSV: ['PSV Eindhoven'],
  'RC Deportivo de La Coruña': ['Deportivo La Coruña', 'Deportivo La Coruna', 'Deportivo'],
  'RC Lens': ['Lens'],
  'RC Strasbourg': ['Strasbourg'],
  Schalke: ['Schalke 04', 'FC Schalke 04'],
  Shakhtar: ['Shakhtar Donetsk'],
  Tottenham: ['Tottenham Hotspur', 'Tottenham Hotspur FC'],
  'West Ham': ['West Ham United'],
  Zenit: ['Zenit St Petersburg', 'Zenit Saint Petersburg'],
  'FC Sète 34': ['FC Sete', 'Sète'],
  'Vitória SC': ['Vitoria Guimaraes', 'Vitória Guimarães'],
  'SC Braga': ['Braga'],
  'SC Marítimo': ['Maritimo', 'CS Marítimo'],
  'CF Belenenses': ['Belenenses'],
  'Stade Rennais FC': ['Rennes', 'Stade Rennais'],
  'Olympique de Marseille': ['Marseille', 'Olympique Marseille'],
  'FC Metz': ['Metz'],
  'Le Havre AC': ['Le Havre'],
  'Lille OSC': ['Lille', 'LOSC Lille'],
  'AS Saint-Étienne': ['Saint-Etienne', 'Saint Étienne'],
  'RC Paris': ['Racing Club Paris'],
  'Toulouse FC (2023, club actual)': ['Toulouse FC', 'Toulouse'],
  'Rapid Wien': ['Rapid Vienna', 'SK Rapid Wien'],
  'TSV 1860 München': ['1860 Munich', 'TSV 1860 Munich'],
  'VfB Leipzig': ['VfB Leipzig', 'Lokomotive Leipzig'],
  'Hannoverscher SV 96': ['Hannover 96'],
  'Karlsruher SC': ['Karlsruhe'],
  'Rot-Weiss Essen': ['Rot Weiss Essen'],
  'SC Beira-Mar': ['Beira Mar'],
  'CS Marítimo': ['Maritimo']
};

async function stageTheSportsDbBadge(entityId: string, candidate: Awaited<ReturnType<typeof resolveTheSportsDbBadge>>): Promise<void> {
  if (!candidate) throw new Error(`No se ha encontrado un escudo exacto para ${entityId}`);
  const requestedEntityId = await resolveCanonicalEntityIdFromPool(entityId);
  entityId = requestedEntityId;
  let identitySourceEntityId: string | null = null;
  // A provider ID is stronger identity evidence than the display name.  A
  // previous import may already have attached the same TheSportsDB team to a
  // different source entity (for example, a UEFA and a league title row). In
  // that case reuse the already-linked canonical record only when the
  // provider's exact team name also matches it; never merge on a loose name.
  const existingProviderLink = await pool.query<{ entity_id: string }>(
    `SELECT entity_id
     FROM entity_external_ids
     WHERE source_key = 'thesportsdb-artwork'
       AND entity_type IN ('club', 'national_team')
       AND external_id = $1`,
    [candidate.externalId]
  );
  if (existingProviderLink.rows[0]) {
    const existingEntityId = await resolveCanonicalEntityIdFromPool(existingProviderLink.rows[0].entity_id);
    if (existingEntityId !== entityId) {
      const existingEntity = await pool.query<{ entity_type: 'club' | 'national_team'; canonical_name: string }>(
        `SELECT entity_type, canonical_name FROM entities WHERE id = $1`,
        [existingEntityId]
      );
      if (!existingEntity.rows[0] || normalizeTheSportsDbName(existingEntity.rows[0].canonical_name) !== normalizeTheSportsDbName(candidate.teamName)) {
        throw new Error(`El ID TheSportsDB ${candidate.externalId} ya está vinculado a una entidad con nombre incompatible`);
      }
      identitySourceEntityId = entityId;
      entityId = existingEntityId;
    }
  }
  await assertEntityMediaRequired(entityId);
  const entity = await pool.query<{ id: string; entity_type: 'club' | 'national_team'; canonical_name: string }>(
    "SELECT id, entity_type, canonical_name FROM entities WHERE id = $1 AND entity_type IN ('club', 'national_team')",
    [entityId]
  );
  const current = entity.rows[0];
  if (!current) throw new Error(`Entidad de club inexistente: ${entityId}`);
  const inputBytes = await downloadTheSportsDbImage(candidate.badgeUrl);
  if (inputBytes.length === 0 || inputBytes.length > 15 * 1024 * 1024) throw new Error('Tamaño de escudo no permitido');
  const normalizedBytes = await sharp(inputBytes)
    .rotate()
    .ensureAlpha()
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer();
  const hash = createHash('sha256').update(normalizedBytes).digest('hex');
  const assetId = `img_${createHash('sha256').update(`${entityId}:badge:${candidate.teamUrl}:${hash}`).digest('hex').slice(0, 24)}`;
  await mkdir(resolve(config.mediaRoot), { recursive: true });
  const localPath = resolve(config.mediaRoot, `${entityId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${hash.slice(0, 24)}.webp`);
  await writeFile(localPath, normalizedBytes);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO sources (key, name, source_type, base_url, rights_status)
       VALUES ('thesportsdb-artwork', 'TheSportsDB artwork candidates', 'api', 'https://www.thesportsdb.com/', 'review_required')
       ON CONFLICT (key) DO NOTHING`
    );
    if (identitySourceEntityId) {
      await recordIdentityLink(
        client,
        identitySourceEntityId,
        entityId,
        'thesportsdb-artwork',
        'Mismo identificador exacto de TheSportsDB y nombre exacto del equipo; consolidación multimedia segura'
      );
      await moveEntityDataToCanonical(client, identitySourceEntityId, entityId);
    }
    await ensureExternalEntityLink(client, 'thesportsdb-artwork', current.entity_type, candidate.externalId, entityId, {
      teamName: candidate.teamName,
      teamUrl: candidate.teamUrl,
      apiUrl: candidate.apiUrl
    });
    await client.query(
      `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, local_path, provider, license_name, license_url, width, height, mime_type, sha256, is_primary, review_status, metadata)
       VALUES ($1, $2, 'badge', $3, $4, 'thesportsdb', NULL, $5, 512, 512, 'image/webp', $6, FALSE, 'pending', $7)
       ON CONFLICT (id) DO UPDATE
         SET source_url = EXCLUDED.source_url, local_path = EXCLUDED.local_path, license_url = EXCLUDED.license_url,
             sha256 = EXCLUDED.sha256, is_primary = FALSE, review_status = 'pending', metadata = EXCLUDED.metadata`,
      [assetId, entityId, candidate.teamUrl, localPath, 'https://www.thesportsdb.com/docs_terms_of_use.php', hash, JSON.stringify({ ...candidate, normalization: { width: 512, height: 512, fit: 'contain', format: 'webp' } })]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({ entityId, entityName: current.canonical_name, assetId, localPath, reviewStatus: 'pending' }, null, 2));
}

function normalizeDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const text = String(value);
  const isoDate = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

async function stageTheSportsDbPortrait(entityId: string, candidate: Awaited<ReturnType<typeof resolveTheSportsDbPortrait>>): Promise<void> {
  if (!candidate) throw new Error(`No se ha encontrado un retrato exacto para ${entityId}`);
  entityId = await resolveCanonicalEntityIdFromPool(entityId);
  await assertEntityMediaRequired(entityId);
  await assertPortraitStillNeedsStaging(entityId);
  const entity = await pool.query<{ id: string; entity_type: 'player'; canonical_name: string; birth_date: string | Date | null }>(
    "SELECT id, entity_type, canonical_name, birth_date FROM entities WHERE id = $1 AND entity_type = 'player'",
    [entityId]
  );
  const current = entity.rows[0];
  if (!current) throw new Error(`Entidad de jugador inexistente: ${entityId}`);
  const canonicalBirthDate = normalizeDateOnly(current.birth_date);
  const providerBirthDate = normalizeDateOnly(candidate.providerBirthDate);
  if (canonicalBirthDate && providerBirthDate && canonicalBirthDate !== providerBirthDate) {
    throw new Error(`La fecha de nacimiento de TheSportsDB (${providerBirthDate}) no coincide con la entidad (${canonicalBirthDate}) para ${current.canonical_name}`);
  }
  const existingSource = await pool.query<{ id: string; review_status: string }>(
    `SELECT id, review_status
     FROM image_assets
     WHERE entity_id = $1 AND asset_kind = 'portrait' AND source_url = $2
     LIMIT 1`,
    [entityId, candidate.playerUrl]
  );
  if (existingSource.rows[0]) {
    throw new Error(`La fuente TheSportsDB ya está registrada para ${current.canonical_name} (${existingSource.rows[0].id}, ${existingSource.rows[0].review_status})`);
  }
  const inputBytes = await downloadTheSportsDbImage(candidate.portraitUrl);
  if (inputBytes.length === 0 || inputBytes.length > 15 * 1024 * 1024) throw new Error('Tamaño de retrato no permitido');
  const normalizedBytes = await sharp(inputBytes)
    .rotate()
    .resize(512, 512, { fit: 'cover', position: 'top' })
    .webp({ quality: 88 })
    .toBuffer();
  const hash = createHash('sha256').update(normalizedBytes).digest('hex');
  const assetId = `img_${createHash('sha256').update(`${entityId}:portrait:${candidate.playerUrl}:${hash}`).digest('hex').slice(0, 24)}`;
  await mkdir(resolve(config.mediaRoot), { recursive: true });
  const localPath = resolve(config.mediaRoot, `${entityId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${hash.slice(0, 24)}.webp`);
  await writeFile(localPath, normalizedBytes);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO sources (key, name, source_type, base_url, rights_status)
       VALUES ('thesportsdb-artwork', 'TheSportsDB artwork candidates', 'api', 'https://www.thesportsdb.com/', 'review_required')
       ON CONFLICT (key) DO NOTHING`
    );
    await ensureExternalEntityLink(client, 'thesportsdb-artwork', current.entity_type, candidate.externalId, entityId, {
      playerName: candidate.playerName,
      playerUrl: candidate.playerUrl,
      apiUrl: candidate.apiUrl
    });
    await client.query(
      `INSERT INTO entity_aliases (entity_id, alias, source_key)
       VALUES ($1, $2, 'thesportsdb-identity-audit')
       ON CONFLICT (entity_id, alias) DO NOTHING`,
      [entityId, candidate.playerName]
    );
    await client.query(
      `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, local_path, provider, license_name, license_url, width, height, mime_type, sha256, is_primary, review_status, metadata)
       VALUES ($1, $2, 'portrait', $3, $4, 'thesportsdb', NULL, $5, 512, 512, 'image/webp', $6, FALSE, 'pending', $7)
       ON CONFLICT (id) DO UPDATE
         SET source_url = EXCLUDED.source_url, local_path = EXCLUDED.local_path, license_url = EXCLUDED.license_url,
             sha256 = EXCLUDED.sha256, is_primary = FALSE, review_status = 'pending', metadata = EXCLUDED.metadata`,
      [assetId, entityId, candidate.playerUrl, localPath, 'https://www.thesportsdb.com/docs_terms_of_use.php', hash, JSON.stringify({ ...candidate, normalization: { width: 512, height: 512, fit: 'cover', format: 'webp' } })]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({ entityId, entityName: current.canonical_name, assetId, localPath, reviewStatus: 'pending' }, null, 2));
}

async function stageOpenversePortrait(entityId: string, candidate: OpenverseImageCandidate): Promise<{ assetId: string; localPath: string; contentType: string }> {
  entityId = await resolveCanonicalEntityIdFromPool(entityId);
  await assertEntityMediaRequired(entityId);
  await assertPortraitStillNeedsStaging(entityId);
  const entity = await pool.query<{ id: string; entity_type: 'player'; canonical_name: string }>(
    "SELECT id, entity_type, canonical_name FROM entities WHERE id = $1 AND entity_type = 'player'",
    [entityId]
  );
  const current = entity.rows[0];
  if (!current) throw new Error('Entidad de jugador inexistente: ' + entityId);
  const existingSource = await pool.query<{ id: string; review_status: string }>(
    `SELECT id, review_status
     FROM image_assets
     WHERE entity_id = $1 AND asset_kind = 'portrait' AND provider = 'openverse' AND source_url = $2
     LIMIT 1`,
    [entityId, candidate.landingUrl]
  );
  if (existingSource.rows[0]) {
    throw new Error('La fuente Openverse ya está registrada para ' + current.canonical_name + ' (' + existingSource.rows[0].id + ', ' + existingSource.rows[0].review_status + ')');
  }
  const downloaded = await downloadOpenverseImage(candidate.sourceUrl, config.mediaRequestTimeoutMs);
  const sourceMetadata = await sharp(downloaded.bytes).metadata();
  if (!sourceMetadata.width || !sourceMetadata.height || sourceMetadata.width < 512 || sourceMetadata.height < 512) {
    throw new Error('La imagen Openverse descargada no alcanza 512 px en ambos lados');
  }
  const normalizedBytes = await sharp(downloaded.bytes)
    .rotate()
    .resize(512, 512, { fit: 'cover', position: 'top' })
    .webp({ quality: 88 })
    .toBuffer();
  const hash = createHash('sha256').update(normalizedBytes).digest('hex');
  const assetId = 'img_' + createHash('sha256').update(entityId + ':portrait:' + candidate.landingUrl + ':' + hash).digest('hex').slice(0, 24);
  await mkdir(resolve(config.mediaRoot), { recursive: true });
  const localPath = resolve(config.mediaRoot, entityId.replace(/[^a-zA-Z0-9_-]/g, '_') + '-' + hash.slice(0, 24) + '.webp');
  await writeFile(localPath, normalizedBytes);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO sources (key, name, source_type, base_url, rights_status)
       VALUES ('openverse', 'Openverse image search', 'api', 'https://api.openverse.org/', 'review_required')
       ON CONFLICT (key) DO NOTHING`
    );
    await client.query(
      `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, local_path, provider, license_name, license_url, width, height, mime_type, sha256, is_primary, review_status, metadata)
       VALUES ($1, $2, 'portrait', $3, $4, 'openverse', $5, $6, 512, 512, 'image/webp', $7, FALSE, 'pending', $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        assetId,
        entityId,
        candidate.landingUrl,
        localPath,
        candidate.licenseName,
        candidate.licenseUrl,
        hash,
        JSON.stringify({
          ...candidate,
          downloadedSourceUrl: candidate.sourceUrl,
          downloadedContentType: downloaded.contentType,
          originalDimensions: { width: sourceMetadata.width, height: sourceMetadata.height },
          normalization: { width: 512, height: 512, fit: 'cover', position: 'top', format: 'webp' },
          visualReviewStatus: 'required',
          rightsStatus: 'review_required'
        })
      ]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { assetId, localPath, contentType: downloaded.contentType };
}

async function recordOpenverseDiscoveryAttempt(entityId: string, candidates: OpenverseImageCandidate[], error?: string): Promise<void> {
  const canonical = await pool.query<{ canonical_entity_id: string }>(
    'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
    [entityId]
  );
  const targetEntityId = canonical.rows[0]?.canonical_entity_id ?? entityId;
  await pool.query(
    `UPDATE entities
     SET metadata = jsonb_set(
       jsonb_set(
         jsonb_set(
           metadata,
           '{mediaDiscovery}',
           COALESCE(metadata->'mediaDiscovery', '{}'::jsonb),
           TRUE
         ),
         '{mediaDiscovery,openverse}',
         COALESCE(metadata->'mediaDiscovery'->'openverse', '{}'::jsonb),
         TRUE
       ),
       '{mediaDiscovery,openverse,portrait}',
       $2::jsonb,
       TRUE
     ), updated_at = NOW()
     WHERE id = $1`,
    [targetEntityId, JSON.stringify({
      status: error ? 'error' : candidates.length > 0 ? 'candidates' : 'no_candidate',
      candidateCount: candidates.length,
      attemptedAt: new Date().toISOString(),
      ...(error ? { error } : {})
    })]
  );
}

function buildCommonsThumbnailUrl(fileUrl: string, width: number): string | null {
  const parsed = new URL(fileUrl);
  if (parsed.hostname !== 'upload.wikimedia.org' || !parsed.pathname.startsWith('/wikipedia/commons/')) return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length !== 5 || parts[0] !== 'wikipedia' || parts[1] !== 'commons') return null;
  const filename = parts[4];
  return `https://thumb.wikimedia.org/wikipedia/commons/thumb/${parts[2]}/${parts[3]}/${filename}/${width}px-${filename}`;
}

function assertAllowedUefaImageUrl(sourceUrl: string): URL {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'img.uefa.com' || !parsed.pathname.startsWith('/imgml/TP/')) {
    throw new Error(`La imagen UEFA procede de un dominio o ruta no permitidos: ${sourceUrl}`);
  }
  return parsed;
}

function uefaCurrentImageFallback(sourceUrl: string): string | null {
  const match = /^https:\/\/img\.uefa\.com\/imgml\/TP\/players\/\d+\/history\/(\d+)\.jpg$/u.exec(sourceUrl);
  if (!match?.[1]) return null;
  return `https://img.uefa.com/imgml/TP/players/2019/2025/324x324/${match[1]}.jpg`;
}

function assertAllowedApiFootballImageUrl(sourceUrl: string, assetKind: 'portrait' | 'badge'): URL {
  const parsed = new URL(sourceUrl);
  const expectedPrefix = assetKind === 'portrait' ? '/football/players/' : '/football/teams/';
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'media.api-sports.io' || !parsed.pathname.startsWith(expectedPrefix)) {
    throw new Error(`La imagen API-Football procede de un dominio o ruta no permitidos: ${sourceUrl}`);
  }
  return parsed;
}

// API-Football occasionally returns a valid 200 response for its generic
// silhouette/"NO PHOTO YET" artwork. These hashes are for the deterministic
// 512x512 WebP normalization below; matching them must reject the asset.
const apiFootballPlaceholderHashes = new Set([
  'b69208fbd3b770ededded7d3ec000e97159bd65b2838be6836a4892e73ed585e',
  '3636e0e75988f2f337f0ab45c43a8f185a0fb40fb71f5ec8b8f2a86760809bc4'
]);

async function downloadApiFootballImage(sourceUrl: string, assetKind: 'portrait' | 'badge'): Promise<Buffer> {
  const url = assertAllowedApiFootballImageUrl(sourceUrl, assetKind);
  for (let attempt = 0; attempt < config.mediaMaxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'User-Agent': config.mediaUserAgent },
      signal: AbortSignal.timeout(config.mediaRequestTimeoutMs)
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status !== 429 && response.status < 500) throw new Error(`Descarga de API-Football ${response.status}`);
    if (attempt < config.mediaMaxAttempts - 1) await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(2 ** attempt * 1000, config.mediaRetryMaxMs)));
  }
  throw new Error('Descarga de API-Football: demasiados reintentos');
}

async function assertBadgeStillNeedsStaging(entityId: string): Promise<void> {
  const existing = await pool.query<{ id: string; canonical_name: string }>(
    `SELECT ia.id, e.canonical_name
     FROM image_assets ia
     JOIN entities e ON e.id = ia.entity_id
     WHERE ia.entity_id = $1
       AND ia.asset_kind = 'badge'
       AND ia.is_primary = TRUE
       AND ia.review_status = 'approved'
       AND ia.rights_basis <> 'unknown'
       AND ia.commercial_use = TRUE
       AND ia.rights_verified_at IS NOT NULL
       AND ia.rights_evidence_url IS NOT NULL
       AND jsonb_array_length(ia.usage_scope) > 0
       AND ia.trademark_status = 'cleared'
       AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
     LIMIT 1`,
    [entityId]
  );
  if (existing.rows[0]) {
    throw new Error(`El club ${existing.rows[0].canonical_name} ya tiene un escudo publicable (${existing.rows[0].id})`);
  }
}

async function assertEntityMediaRequired(entityId: string): Promise<void> {
  const result = await pool.query<{ entity_type: 'player' | 'club' | 'national_team'; catalog_status: string }>(
    'SELECT entity_type, catalog_status FROM entities WHERE id = $1',
    [entityId]
  );
  const entity = result.rows[0];
  if (!entity) throw new Error(`Entidad inexistente para media: ${entityId}`);
  if (entity.catalog_status !== 'active') {
    throw new Error(`Media no requerida para ${entityId}: catalog_status=${entity.catalog_status}`);
  }
}

async function stageApiFootballMedia(assetId: string, entityId: string, assetKind: 'portrait' | 'badge', sourceUrl: string): Promise<{ localPath: string; sha256: string }> {
  const canonicalEntityId = await resolveCanonicalEntityIdFromPool(entityId);
  await assertEntityMediaRequired(canonicalEntityId);
  if (assetKind === 'portrait') await assertPortraitStillNeedsStaging(canonicalEntityId);
  else await assertBadgeStillNeedsStaging(canonicalEntityId);
  const inputBytes = await downloadApiFootballImage(sourceUrl, assetKind);
  if (inputBytes.length === 0 || inputBytes.length > 15 * 1024 * 1024) throw new Error('Tamaño de imagen API-Football no permitido');
  const normalized = await sharp(inputBytes)
    .rotate()
    .ensureAlpha()
    .resize(512, 512, assetKind === 'badge'
      ? { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
      : { fit: 'cover', position: 'top' })
    .webp({ quality: 88 })
    .toBuffer();
  const sha256 = createHash('sha256').update(normalized).digest('hex');
  if (apiFootballPlaceholderHashes.has(sha256)) {
    await pool.query(
      `UPDATE image_assets
       SET review_status = 'rejected', is_primary = FALSE,
           metadata = metadata || $2::jsonb
       WHERE id = $1 AND provider = 'api-football' AND review_status = 'pending'
         AND COALESCE(media_status, 'required') = 'required'`,
      [assetId, JSON.stringify({ rejectionReason: 'API-Football devolvió un placeholder genérico sin fotografía' })]
    );
    throw new Error('API-Football devolvió un placeholder genérico sin fotografía');
  }
  await mkdir(resolve(config.mediaRoot), { recursive: true });
  const localPath = resolve(config.mediaRoot, `${entityId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${assetKind}-${sha256.slice(0, 24)}.webp`);
  await writeFile(localPath, normalized);
  await pool.query(
    `UPDATE image_assets
     SET local_path = $2, width = 512, height = 512, mime_type = 'image/webp', sha256 = $3,
         metadata = metadata || $4::jsonb
     WHERE id = $1 AND provider = 'api-football' AND asset_kind = $5 AND review_status = 'pending'
       AND COALESCE(media_status, 'required') = 'required'`,
    [assetId, localPath, sha256, JSON.stringify({ normalization: { width: 512, height: 512, fit: assetKind === 'badge' ? 'contain' : 'cover', format: 'webp' } }), assetKind]
  );
  return { localPath, sha256 };
}

async function downloadUefaImage(sourceUrl: string): Promise<{ bytes: Buffer; resolvedUrl: string }> {
  const url = assertAllowedUefaImageUrl(sourceUrl);
  const fallback = uefaCurrentImageFallback(sourceUrl);
  const candidateUrls = [url.toString(), fallback].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
  let lastError: Error | null = null;
  for (const candidateUrl of candidateUrls) {
    for (let attempt = 0; attempt < config.mediaMaxAttempts; attempt += 1) {
      const response = await fetch(candidateUrl, {
        headers: { 'User-Agent': config.mediaUserAgent },
        signal: AbortSignal.timeout(config.mediaRequestTimeoutMs)
      });
      if (response.ok) return { bytes: Buffer.from(await response.arrayBuffer()), resolvedUrl: candidateUrl };
      if (response.status === 404) {
        lastError = new Error(`Descarga de UEFA 404 (${candidateUrl})`);
        break;
      }
      if (response.status !== 429 && response.status < 500) throw new Error(`Descarga de UEFA ${response.status}`);
      const retryAfter = Number(response.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
      if (attempt < config.mediaMaxAttempts - 1) await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(waitMs, config.mediaRetryMaxMs)));
    }
  }
  throw lastError ?? new Error('Descarga de UEFA: demasiados reintentos');
}

async function stageUefaMedia(assetId: string, entityId: string, assetKind: 'portrait' | 'badge', sourceUrl: string): Promise<{ localPath: string; sha256: string }> {
  await assertEntityMediaRequired(await resolveCanonicalEntityIdFromPool(entityId));
  if (assetKind === 'portrait') await assertPortraitStillNeedsStaging(await resolveCanonicalEntityIdFromPool(entityId));
  const downloaded = await downloadUefaImage(sourceUrl);
  const inputBytes = downloaded.bytes;
  if (inputBytes.length === 0 || inputBytes.length > 15 * 1024 * 1024) throw new Error('Tamaño de imagen UEFA no permitido');
  const normalized = await sharp(inputBytes)
    .rotate()
    .ensureAlpha()
    .resize(512, 512, { fit: assetKind === 'badge' ? 'contain' : 'cover', position: assetKind === 'badge' ? 'centre' : 'top', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88 })
    .toBuffer();
  const sha256 = createHash('sha256').update(normalized).digest('hex');
  await mkdir(resolve(config.mediaRoot), { recursive: true });
  const localPath = resolve(config.mediaRoot, `${entityId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${assetKind}-${sha256.slice(0, 24)}.webp`);
  await writeFile(localPath, normalized);
  await pool.query(
    `UPDATE image_assets
     SET local_path = $2, width = 512, height = 512, mime_type = 'image/webp', sha256 = $3,
         source_url = $5,
         metadata = metadata || $4::jsonb
     WHERE id = $1 AND provider = 'uefa-official' AND review_status = 'pending'
       AND COALESCE(media_status, 'required') = 'required'`,
    [assetId, localPath, sha256, JSON.stringify({ normalization: { width: 512, height: 512, fit: assetKind === 'badge' ? 'contain' : 'cover', format: 'webp' }, resolvedSourceUrl: downloaded.resolvedUrl }), downloaded.resolvedUrl]
  );
  return { localPath, sha256 };
}

try {
  if (command === 'seed') {
    await seedCatalog();
  } else if (command === 'backfill-api-football-goalkeeper-stats') {
    await backfillApiFootballGoalkeeperStats();
  } else if (command === 'cleanup-data-catalog') {
    const report = await runDataCatalogCleanup({ apply: args.includes('--apply') });
    console.log(JSON.stringify(report, null, 2));
  } else if (command === 'verify-game-catalog') {
    console.log(JSON.stringify(await verifyGameCatalogBoundary(), null, 2));
  } else if (command === 'import-ranking') {
    const file = argument('file');
    if (!file) throw new Error('Falta --file');
    const rankingId = await importRankingInput(await readRankingInput(resolve(file)));
    console.log(`Snapshot creado: ${rankingId}`);
  } else if (command === 'build-api-football-rankings') {
    const competitionId = argument('competition');
    const fromSeason = Number(argument('from-season') ?? 2024);
    const toSeason = Number(argument('to-season') ?? fromSeason);
    const requestedMetrics = (argument('metric') ?? 'goals,assists,yellow_cards,red_cards')
      .split(',')
      .map((metric) => metric.trim())
      .filter(Boolean);
    const metricColumns: Record<string, string> = {
      goals: 'goals',
      assists: 'assists',
      yellow_cards: 'yellow_cards',
      red_cards: 'red_cards'
    };
    if (!competitionId) throw new Error('Falta --competition');
    if (!Number.isInteger(fromSeason) || !Number.isInteger(toSeason) || fromSeason < 1900 || toSeason > 2100 || fromSeason > toSeason) {
      throw new Error('La ventana de temporadas no es válida');
    }
    if (requestedMetrics.length === 0 || requestedMetrics.some((metric) => !metricColumns[metric])) {
      throw new Error('Métricas válidas: goals, assists, yellow_cards, red_cards');
    }
    const allowPartialDraft = args.includes('--allow-partial');
    const competition = await pool.query<{ id: string }>('SELECT id FROM competitions WHERE id = $1', [competitionId]);
    if (!competition.rows[0]) throw new Error(`Competición inexistente en el catálogo: ${competitionId}`);
    const bounds = await pool.query<{ min_season: number | null; max_season: number | null }>(
      `SELECT MIN(season_year)::int AS min_season, MAX(season_year)::int AS max_season
       FROM player_season_stats
       WHERE source_key = 'api-football' AND competition_id = $1
         AND season_year BETWEEN $2 AND $3`,
      [competitionId, fromSeason, toSeason]
    );
    const availableBounds = bounds.rows[0];
    if (!availableBounds?.min_season || !availableBounds.max_season) {
      throw new Error(`No hay estadísticas API-Football para ${competitionId} en ${fromSeason}-${toSeason}`);
    }
    const results: Array<{ metric: string; rankingId: string; entries: number; availableSeasons: number[]; coverageComplete: boolean }> = [];
    // The database keeps the canonical competition id used by the season
    // importer, while the public Champions categories use the explicit UEFA
    // slug.  Keep this mapping here rather than resurrecting the retired
    // duplicate `european-cup-champions-league-*` categories.
    const categoryCompetitionSlug: Record<string, string> = {
      'european-cup-champions-league': 'uefa-champions-league'
    };
    for (const metric of requestedMetrics) {
      const column = metricColumns[metric];
      // Cards are explicitly observed as zero by the API-Football player
      // endpoint. For those two metrics, a historical top-200 ranking may
      // legitimately reach players tied at zero. Assists are different:
      // older seasons often expose NULL (unknown), which must never be
      // treated as zero. We may include an observed zero assist only when
      // that player's own rows contain no NULL assists; incomplete player
      // series remain eligible only when their observed sum is positive.
      const includeZeroTies = metric === 'yellow_cards'
        || metric === 'red_cards'
        || metric === 'assists';
      const publicMetricSlug = competitionId === 'european-cup-champions-league' && metric === 'red_cards'
        ? 'red-cards'
        : competitionId === 'european-cup-champions-league' && metric === 'yellow_cards'
          ? 'yellow-cards'
          : metric;
      const categorySlug = `${categoryCompetitionSlug[competitionId] ?? competitionId}-${publicMetricSlug}`;
      const category = await pool.query<{ id: string }>('SELECT id FROM category_definitions WHERE slug = $1 AND entity_type = \'player\'', [categorySlug]);
      if (!category.rows[0]) throw new Error(`Categoría inexistente para la métrica ${categorySlug}`);
      const rows = await pool.query<{ entity_id: string; canonical_name: string; raw_value: string; seasons: number[]; source_snapshots: string[] }>(
        `SELECT p.entity_id, e.canonical_name, SUM(p.${column})::text AS raw_value,
                ARRAY_AGG(DISTINCT p.season_year ORDER BY p.season_year) AS seasons,
                ARRAY_AGG(DISTINCT p.source_snapshot_id ORDER BY p.source_snapshot_id) AS source_snapshots
         FROM player_season_stats p
         JOIN entities e ON e.id = p.entity_id AND e.entity_type = 'player'
         WHERE p.source_key = 'api-football' AND p.competition_id = $1
           AND p.season_year BETWEEN $2 AND $3
         GROUP BY p.entity_id, e.canonical_name
         HAVING ${metric === 'assists'
           ? 'COUNT(*) FILTER (WHERE p.assists IS NULL) = 0'
           : includeZeroTies
             ? 'COUNT(*) > 0'
             : `SUM(p.${column}) > 0`}
         ORDER BY SUM(p.${column}) DESC, p.entity_id
         LIMIT 200`,
        [competitionId, fromSeason, toSeason]
      );
      if (rows.rows.length < 200 && !allowPartialDraft) {
        throw new Error(`${categorySlug}: se requieren 200 jugadores con valor observado${includeZeroTies ? ' (se permiten empates a cero)' : ' positivo'}; disponibles ${rows.rows.length}`);
      }
      const availableSeasons = [...new Set(rows.rows.flatMap((row) => row.seasons.map(Number)))].sort((left, right) => left - right);
      // A complete flag is deliberately narrow.  It is only granted for the
      // Conference League's five completed editions imported page-by-page from
      // API-Football, and only when the selected metric is present on every
      // imported row.  This prevents the generic window builder from turning
      // a large-but-partial career aggregate into a false historical claim.
      const seasonalCoverage = await pool.query<{ season_year: number; row_count: string; null_count: string }>(
        `SELECT season_year::int,
                COUNT(*)::text AS row_count,
                COUNT(*) FILTER (WHERE ${column} IS NULL)::text AS null_count
           FROM player_season_stats
          WHERE source_key = 'api-football'
            AND competition_id = $1
            AND season_year BETWEEN $2 AND $3
          GROUP BY season_year
          ORDER BY season_year`,
        [competitionId, fromSeason, toSeason]
      );
      const expectedSeasons = Array.from({ length: toSeason - fromSeason + 1 }, (_, index) => fromSeason + index);
      const completeSeasonalInput = seasonalCoverage.rows.length === expectedSeasons.length
        && seasonalCoverage.rows.every((season, index) => Number(season.season_year) === expectedSeasons[index]
          && Number(season.row_count) > 0
          && Number(season.null_count) === 0);
      const coverageComplete = competitionId === 'uefa-conference-league'
        && fromSeason === 2021
        && toSeason === 2025
        && completeSeasonalInput
        && rows.rows.length >= 200;
      const rankingId = await importRankingInput({
        categorySlug,
        source: {
          key: 'api-football',
          name: 'API-Football / API-Sports',
          sourceType: 'api',
          baseUrl: 'https://v3.football.api-sports.io/players',
          rightsStatus: 'review_required'
        },
        dataVersion: `api-football-${competitionId}-${metric}-${fromSeason}-${toSeason}`,
        coverageComplete,
        allowPartialDraft: allowPartialDraft && rows.rows.length < 200,
        partialDraftReason: allowPartialDraft && rows.rows.length < 200
          ? `La edición ${competitionId} ${fromSeason} solo devuelve ${rows.rows.length} jugadores en el endpoint de API-Football; se conserva únicamente el conjunto real disponible, sin completar puestos artificialmente.`
          : undefined,
        reviewed: false,
        entries: rows.rows.map((row, index) => ({
          entityId: row.entity_id,
          entityType: 'player' as const,
          name: row.canonical_name,
          rawValue: Number(row.raw_value),
          evidence: {
            sourceRank: index + 1,
            sourceSnapshotIds: row.source_snapshots,
            seasons: row.seasons,
            competitionId,
            coverageWindow: { fromSeason, toSeason },
            definition: 'Suma de la columna API-Football player_season_stats por jugador; múltiples clubes se agregan por entidad canónica.'
            ,zeroTiePolicy: includeZeroTies ? 'Se conservan jugadores con cero observado para completar el corte top-200; no se imputan NULL.' : 'Solo se incluyen valores positivos; NULL no se interpreta como cero.'
          }
        }))
      });
      results.push({ metric, rankingId, entries: rows.rows.length, availableSeasons, coverageComplete });
    }
    const allResultsComplete = results.length > 0 && results.every((result) => result.coverageComplete);
    console.log(JSON.stringify({ source: 'api-football', competitionId, requestedWindow: { fromSeason, toSeason }, availableWindow: { fromSeason: availableBounds.min_season, toSeason: availableBounds.max_season }, results, allowPartialDraft, note: allResultsComplete
      ? 'El alcance cerrado y las métricas seleccionadas han pasado la validación de temporadas y nulos; los derechos de redistribución siguen pendientes y el snapshot permanece en borrador.'
      : 'Los snapshots de ventana permanecen en borrador; al menos una métrica no demuestra todavía el histórico completo.' }, null, 2));
  } else if (command === 'import-api-football-player-trophies') {
    const limit = Number(argument('limit') ?? 400);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? 300);
    const buildProvisional = args.includes('--build-provisional');
    const missingOnly = args.includes('--missing-only');
    if (!Number.isInteger(limit) || limit < 100 || limit > 1000 || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
      throw new Error('Los parámetros deben ser válidos: --limit 100-1000, --offset >=0 y --delay-ms 0-60000');
    }
    const candidates = await pool.query<{ entity_id: string; canonical_name: string; provider_ids: string[] }>(
      `SELECT COALESCE(identity_link.canonical_entity_id, source_entity.id) AS entity_id,
              canonical_entity.canonical_name,
              ARRAY_AGG(DISTINCT provider_id.external_id ORDER BY provider_id.external_id) AS provider_ids
         FROM entity_game_profiles egp
         JOIN entities source_entity ON source_entity.id = egp.entity_id AND source_entity.entity_type = 'player'
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = source_entity.id
         JOIN entities canonical_entity ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, source_entity.id)
        JOIN entity_external_ids provider_id
           ON provider_id.source_key = 'api-football'
          AND provider_id.entity_type = 'player'
          AND provider_id.entity_id IN (source_entity.id, canonical_entity.id)
        WHERE egp.playable_default = TRUE
        ${missingOnly ? `AND NOT EXISTS (
          SELECT 1
            FROM fact_assertions trophy_fact
           WHERE trophy_fact.subject_entity_id = COALESCE(identity_link.canonical_entity_id, source_entity.id)
             AND trophy_fact.fact_type LIKE 'player_trophy_record:%'
        )` : ''}
        GROUP BY COALESCE(identity_link.canonical_entity_id, source_entity.id), canonical_entity.canonical_name
        ORDER BY canonical_entity.canonical_name, entity_id
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    // The importer may legitimately have fewer than 100 unresolved players
    // after previous batches. Do not refuse a real remaining cohort merely to
    // satisfy the ranking-size rule; the 200-entry requirement belongs to the
    // ranking builder, not to evidence collection.
    if (candidates.rows.length < 1) throw new Error('No hay jugadores jugables pendientes con ID API-Football');

    const fetchedByProviderId = new Map<string, { trophies: ApiFootballTrophy[]; error?: string }>();
    const fetchErrors: Array<{ providerPlayerId: string; error: string }> = [];
    let requestsMade = 0;
    for (const candidate of candidates.rows) {
      for (const providerId of candidate.provider_ids) {
        if (fetchedByProviderId.has(providerId)) continue;
        try {
          const fetched = await fetchApiFootballPlayerTrophies(Number(providerId));
          fetchedByProviderId.set(providerId, fetched);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          fetchedByProviderId.set(providerId, { trophies: [], error: errorMessage });
          fetchErrors.push({ providerPlayerId: providerId, error: errorMessage });
        }
        requestsMade += 1;
        if (delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
      }
    }

    const retrievedAt = new Date().toISOString();
    const rawContent = JSON.stringify({
      source: 'api-football',
      endpoint: '/trophies',
      retrievedAt,
      missingOnly,
      candidates: candidates.rows,
      results: [...fetchedByProviderId.entries()].map(([providerPlayerId, result]) => ({ providerPlayerId, ...result })),
      errors: fetchErrors
    });
    const hash = createHash('sha256').update(rawContent).digest('hex');
    const snapshotId = `src_${hash.slice(0, 24)}`;
    const snapshotPath = resolve(config.snapshotRoot, `${snapshotId}.json`);
    await mkdir(resolve(config.snapshotRoot), { recursive: true });
    try {
      await writeFile(snapshotPath, rawContent, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }

    const globalCounts = new Map<string, { canonicalName: string; count: number; providerPlayerIds: Set<string>; seasons: Set<string>; competitions: Set<string> }>();
    for (const candidate of candidates.rows) {
      globalCounts.set(candidate.entity_id, {
        canonicalName: candidate.canonical_name,
        count: 0,
        providerPlayerIds: new Set(candidate.provider_ids),
        seasons: new Set(),
        competitions: new Set()
      });
    }

    const titleFacts: Array<{ entityId: string; canonicalName: string; competition: string; providerPlayerId: string; trophy: ApiFootballTrophy; season: string }> = [];
    const seenTitles = new Set<string>();
    for (const candidate of candidates.rows) {
      for (const providerPlayerId of candidate.provider_ids) {
        const fetched = fetchedByProviderId.get(providerPlayerId);
        if (!fetched) continue;
        for (const trophy of fetched.trophies) {
          const competition = typeof trophy.league === 'string' ? apiFootballTrophyCompetition(trophy.league, trophy.country) : null;
          const season = trophy.season === null || trophy.season === undefined ? '' : String(trophy.season).trim();
          if (!competition || !isApiFootballWinner(trophy.place) || !season) continue;
          const titleKey = `${candidate.entity_id}:${competition}:${season}`;
          if (seenTitles.has(titleKey)) continue;
          seenTitles.add(titleKey);
          const global = globalCounts.get(candidate.entity_id);
          if (global) {
            global.count += 1;
            global.seasons.add(season);
            global.competitions.add(competition);
          }
          titleFacts.push({ entityId: candidate.entity_id, canonicalName: candidate.canonical_name, competition, providerPlayerId, trophy, season });
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO sources (key, name, source_type, base_url, rights_status)
         VALUES ('api-football', 'API-Football / API-Sports', 'api', 'https://www.api-football.com/', 'review_required')
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, base_url = EXCLUDED.base_url`
      );
      await client.query(
        `INSERT INTO source_snapshots (id, source_key, retrieved_at, content_type, storage_uri, content_sha256, metadata)
         VALUES ($1, 'api-football', $2, 'application/json', $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [snapshotId, retrievedAt, `storage/source-snapshots/${snapshotId}.json`, hash, JSON.stringify({
          importType: 'api-football-player-trophies',
          endpoint: '/trophies',
          missingOnly,
          candidates: candidates.rows.length,
          providerPlayerIds: fetchedByProviderId.size,
          requestsMade,
          fetchErrors: fetchErrors.length,
          titleFacts: titleFacts.length,
          rightsStatus: 'review_required'
        })]
      );
      await client.query(
        `INSERT INTO import_runs (id, source_snapshot_id, status, metadata, finished_at)
         VALUES ($1, $2, 'validated', $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [`run_${hash.slice(0, 24)}`, snapshotId, JSON.stringify({ importType: 'api-football-player-trophies', endpoint: '/trophies', missingOnly, candidates: candidates.rows.length, requestsMade, fetchErrors: fetchErrors.length, titleFacts: titleFacts.length })]
      );
      for (const fact of titleFacts) {
        const factId = `fact_${createHash('sha256').update(JSON.stringify({ snapshotId, entityId: fact.entityId, competition: fact.competition, season: fact.season })).digest('hex').slice(0, 24)}`;
        await client.query(
          `INSERT INTO fact_assertions (id, fact_type, subject_entity_id, value, source_snapshot_id, review_status, metadata)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6)
           ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, review_status = EXCLUDED.review_status, metadata = fact_assertions.metadata || EXCLUDED.metadata`,
          [factId, `player_trophy_record:${fact.competition}`, fact.entityId, JSON.stringify({ competition: fact.competition, season: fact.season, place: fact.trophy.place ?? null, league: fact.trophy.league, country: fact.trophy.country ?? null }), snapshotId, JSON.stringify({ providerPlayerId: fact.providerPlayerId, source: 'api-football:trophies', participationVerified: false })]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const rankings: Array<{ category: string; rankingId: string; entries: number }> = [];
    if (buildProvisional) {
      // A cohort contains only 100 players, while the provisional ranking
      // must use every already imported /trophies fact.  Rebuild from the
      // persisted evidence instead of trying to pad the current cohort.
      // Only positive Winner facts are selected: no participation or zero
      // values are inferred.
      const rankingRows = await pool.query<{
        entity_id: string;
        canonical_name: string;
        titles: string;
        source_snapshots: string[] | null;
        provider_player_ids: string[] | null;
        seasons: string[] | null;
        competitions: string[] | null;
      }>(
        `WITH playable_players AS (
           SELECT DISTINCT COALESCE(link.canonical_entity_id, source_entity.id) AS entity_id
             FROM entity_game_profiles egp
             JOIN entities source_entity
               ON source_entity.id = egp.entity_id AND source_entity.entity_type = 'player'
             LEFT JOIN entity_identity_links link ON link.source_entity_id = source_entity.id
            WHERE egp.playable_default = TRUE
         ), distinct_title_facts AS (
           SELECT DISTINCT
                  COALESCE(link.canonical_entity_id, f.subject_entity_id) AS entity_id,
                  f.value->>'competition' AS competition,
                  f.value->>'season' AS season,
                  f.source_snapshot_id,
                  f.metadata->>'providerPlayerId' AS provider_player_id
             FROM fact_assertions f
             JOIN source_snapshots ss ON ss.id = f.source_snapshot_id
             LEFT JOIN entity_identity_links link ON link.source_entity_id = f.subject_entity_id
            WHERE f.fact_type LIKE 'player_trophy_record:%'
              AND f.value->>'place' = 'Winner'
              AND NULLIF(BTRIM(f.value->>'competition'), '') IS NOT NULL
              AND NULLIF(BTRIM(f.value->>'season'), '') IS NOT NULL
              AND f.review_status IN ('pending', 'approved')
              AND ss.source_key = 'api-football'
              AND ss.metadata->>'importType' = 'api-football-player-trophies'
         ), title_totals AS (
           SELECT entity_id,
                  COUNT(*)::text AS titles,
                  ARRAY_AGG(DISTINCT source_snapshot_id ORDER BY source_snapshot_id) AS source_snapshots,
                  ARRAY_AGG(DISTINCT provider_player_id ORDER BY provider_player_id)
                    FILTER (WHERE provider_player_id IS NOT NULL) AS provider_player_ids,
                  ARRAY_AGG(DISTINCT season ORDER BY season) AS seasons,
                  ARRAY_AGG(DISTINCT competition ORDER BY competition) AS competitions
             FROM distinct_title_facts
            GROUP BY entity_id
         )
         SELECT tt.entity_id, e.canonical_name, tt.titles, tt.source_snapshots,
                tt.provider_player_ids, tt.seasons, tt.competitions
           FROM title_totals tt
           JOIN playable_players pp ON pp.entity_id = tt.entity_id
           JOIN entities e ON e.id = tt.entity_id AND e.entity_type = 'player'
          ORDER BY tt.titles::numeric DESC, e.canonical_name, tt.entity_id
          LIMIT 200`
      );
      const ranked = rankingRows.rows;
      if (ranked.length < 200) throw new Error(`Se necesitan 200 jugadores para el ranking global de títulos; disponibles ${ranked.length}`);
      const rankingId = await importRankingInput({
        categorySlug: 'player-career-titles',
        source: {
          key: 'api-football',
          name: 'API-Football / API-Sports',
          sourceType: 'api',
          baseUrl: 'https://v3.football.api-sports.io/trophies',
          rightsStatus: 'review_required'
        },
        dataVersion: `api-football-player-career-titles-${snapshotId}`,
        coverageComplete: false,
        allowPartialDraft: true,
        partialDraftReason: 'El endpoint /trophies solo está contrastado para una cohorte jugable y no demuestra todavía todas las competiciones ni la participación efectiva en cada título.',
        reviewed: false,
        entries: ranked.map((row, index) => ({
          entityId: row.entity_id,
          entityType: 'player' as const,
          name: row.canonical_name,
          rawValue: Number(row.titles),
          evidence: {
            sourceRank: index + 1,
            sourceSnapshotIds: row.source_snapshots ?? [],
            providerPlayerIds: row.provider_player_ids ?? [],
            winningSeasons: row.seasons ?? [],
            competitions: row.competitions ?? [],
            definition: 'Número de registros API-Football /trophies con place=Winner, deduplicados por jugador canónico, competición y temporada; cohorte jugable, no histórico completo.'
          }
        }))
      });
      rankings.push({ category: 'player-career-titles', rankingId, entries: ranked.length });
    }
    if (!buildProvisional) {
      await pool.query(
        `UPDATE ranking_snapshots
            SET status = 'superseded'
          WHERE status = 'draft'
            AND data_version LIKE 'api-football-player-trophies-%'`
      );
    }
    console.log(JSON.stringify({ source: 'api-football', endpoint: '/trophies', snapshotId, missingOnly, candidates: candidates.rows.length, offset, providerPlayerIds: fetchedByProviderId.size, requestsMade, fetchErrors: fetchErrors.length, titleFacts: titleFacts.length, rankings, coverageComplete: false, buildProvisional, note: buildProvisional ? 'Ranking global provisional de registros de trofeo; no verifica participación y no es publicable.' : 'Registros de trofeo archivados; el ranking global se genera solo con --build-provisional y permanece en draft.' }, null, 2));
  } else if (command === 'build-api-football-career-rankings') {
    const fromSeason = Number(argument('from-season') ?? 2005);
    const toSeason = Number(argument('to-season') ?? 2025);
    const requestedMetrics = (argument('metric') ?? 'goals,assists').split(',').map((metric) => metric.trim()).filter(Boolean);
    const metricColumns: Record<string, string> = {
      goals: 'goals',
      assists: 'assists',
      yellow_cards: 'yellow_cards',
      red_cards: 'red_cards'
    };
    if (!Number.isInteger(fromSeason) || !Number.isInteger(toSeason) || fromSeason < 1900 || toSeason > 2100 || fromSeason > toSeason) {
      throw new Error('La ventana de temporadas no es válida');
    }
    if (requestedMetrics.length === 0 || requestedMetrics.some((metric) => !metricColumns[metric])) {
      throw new Error('Métricas válidas: goals, assists, yellow_cards, red_cards');
    }
    // The career categories are explicitly club-career categories.  The
    // stats table also stores national-team competitions (World Cup, EURO,
    // Copa América and Nations League), so selecting every imported
    // competition would silently contaminate this ranking with national
    // team assists.  Use the catalogue classification as the source of
    // truth and keep the selected scope in the evidence below.
    const competitionRows = await pool.query<{ competition_id: string }>(
      `SELECT DISTINCT p.competition_id
         FROM player_season_stats p
         JOIN competitions c ON c.id = p.competition_id
        WHERE p.source_key = 'api-football'
          AND c.competition_type <> 'national_team'
        ORDER BY p.competition_id`
    );
    const competitions = competitionRows.rows.map((row) => row.competition_id);
    if (competitions.length === 0) throw new Error('No hay estadísticas API-Football importadas para construir rankings globales');
    const careerMetricCategorySlug: Record<string, string> = {
      goals: 'club-career-goals',
      assists: 'club-career-assists',
      yellow_cards: 'club-career-yellow-cards',
      red_cards: 'club-career-red-cards'
    };
    const results: Array<{ metric: string; rankingId: string; entries: number; availableSeasons: number[] }> = [];
    for (const metric of requestedMetrics) {
      const categorySlug = careerMetricCategorySlug[metric];
      if (!categorySlug) throw new Error(`Categoría global inexistente para la métrica ${metric}`);
      const category = await pool.query<{ id: string }>(`SELECT id FROM category_definitions WHERE slug = $1 AND entity_type = 'player'`, [categorySlug]);
      if (!category.rows[0]) throw new Error(`Categoría inexistente: ${categorySlug}`);
      const column = metricColumns[metric];
      const rows = await pool.query<{ entity_id: string; canonical_name: string; raw_value: string; seasons: number[]; competitions: string[]; source_snapshots: string[] }>(
        `SELECT p.entity_id, e.canonical_name, SUM(p.${column})::text AS raw_value,
                ARRAY_AGG(DISTINCT p.season_year ORDER BY p.season_year) AS seasons,
                ARRAY_AGG(DISTINCT p.competition_id ORDER BY p.competition_id) AS competitions,
                ARRAY_AGG(DISTINCT p.source_snapshot_id ORDER BY p.source_snapshot_id) FILTER (WHERE p.source_snapshot_id IS NOT NULL) AS source_snapshots
           FROM player_season_stats p
           JOIN entities e ON e.id = p.entity_id AND e.entity_type = 'player'
          WHERE p.source_key = 'api-football'
            AND p.competition_id = ANY($1::text[])
            AND p.season_year BETWEEN $2 AND $3
          GROUP BY p.entity_id, e.canonical_name
          HAVING SUM(p.${column}) IS NOT NULL
          ORDER BY SUM(p.${column}) DESC, p.entity_id
          LIMIT 200`,
        [competitions, fromSeason, toSeason]
      );
      if (rows.rows.length < 200) throw new Error(`${categorySlug}: se requieren 200 jugadores; disponibles ${rows.rows.length}`);
      const availableSeasons = [...new Set(rows.rows.flatMap((row) => row.seasons.map(Number)))].sort((left, right) => left - right);
      const rankingId = await importRankingInput({
        categorySlug,
        source: {
          key: 'api-football',
          name: 'API-Football / API-Sports',
          sourceType: 'api',
          baseUrl: 'https://v3.football.api-sports.io/players',
          rightsStatus: 'review_required'
        },
        dataVersion: `api-football-club-career-${metric}-${fromSeason}-${toSeason}`,
        coverageComplete: false,
        reviewed: false,
        entries: rows.rows.map((row, index) => ({
          entityId: row.entity_id,
          entityType: 'player' as const,
          name: row.canonical_name,
          rawValue: Number(row.raw_value),
          evidence: {
            sourceRank: index + 1,
            sourceSnapshotIds: row.source_snapshots ?? [],
            seasons: row.seasons,
            competitions: row.competitions,
            coverageWindow: { fromSeason, toSeason },
            definition: 'Suma de la métrica de player_season_stats en todas las competiciones de clubes API-Football importadas para la ventana indicada; excluye competiciones de selecciones nacionales. Es un agregado global de los datos disponibles, no una afirmación de carrera completa hasta incorporar y validar todas las competiciones y temporadas.'
          }
        }))
      });
      results.push({ metric, rankingId, entries: rows.rows.length, availableSeasons });
    }
    console.log(JSON.stringify({ source: 'api-football', scope: 'imported-club-competitions', excludedCompetitionType: 'national_team', requestedWindow: { fromSeason, toSeason }, competitions, results, coverageComplete: false, note: 'Snapshots globales de las competiciones de clubes API-Football importadas; permanecen en draft hasta completar el histórico y revisar derechos.' }, null, 2));
  } else if (command === 'build-player-career-goals') {
    const categorySlug = 'player-career-goals';
    const nationalSnapshot = await pool.query<{ id: string; data_version: string }>(
      `SELECT rs.id, rs.data_version
         FROM ranking_snapshots rs
         JOIN category_definitions c ON c.id = rs.category_id
        WHERE c.slug = 'national-team-official-goals'
          AND rs.status IN ('draft', 'approved', 'published')
        ORDER BY rs.status = 'published' DESC, rs.status = 'approved' DESC,
                 rs.generated_at DESC, rs.id DESC
        LIMIT 1`
    );
    const selectedNationalSnapshot = nationalSnapshot.rows[0];
    if (!selectedNationalSnapshot) throw new Error('No hay snapshot de goles con selección para construir la carrera global');
    const rows = await pool.query<{
      entity_id: string;
      canonical_name: string;
      club_goals: string;
      national_goals: string;
      source_snapshots: string[];
    }>(
      `WITH playable_players AS (
         SELECT DISTINCT COALESCE(link.canonical_entity_id, source_entity.id) AS entity_id
           FROM entity_game_profiles egp
           JOIN entities source_entity
             ON source_entity.id = egp.entity_id
            AND source_entity.entity_type = 'player'
            AND source_entity.catalog_status = 'active'
           LEFT JOIN entity_identity_links link ON link.source_entity_id = source_entity.id
          WHERE egp.playable_default = TRUE
       ), club_totals AS (
         SELECT COALESCE(link.canonical_entity_id, stats.entity_id) AS entity_id,
                SUM(stats.goals)::numeric AS club_goals,
                ARRAY_AGG(DISTINCT stats.source_snapshot_id ORDER BY stats.source_snapshot_id)
                  FILTER (WHERE stats.source_snapshot_id IS NOT NULL) AS source_snapshots
           FROM player_season_stats stats
           JOIN competitions competition
             ON competition.id = stats.competition_id
            AND competition.competition_type <> 'national_team'
           LEFT JOIN entity_identity_links link ON link.source_entity_id = stats.entity_id
          WHERE stats.source_key = 'api-football'
          GROUP BY COALESCE(link.canonical_entity_id, stats.entity_id)
       ), national_totals AS (
         SELECT COALESCE(link.canonical_entity_id, entries.entity_id) AS entity_id,
                MAX(entries.raw_value)::numeric AS national_goals,
                ARRAY_AGG(DISTINCT entries.snapshot_id ORDER BY entries.snapshot_id) AS source_snapshots
           FROM ranking_entries entries
           JOIN ranking_snapshots snapshot ON snapshot.id = entries.snapshot_id
           JOIN category_definitions category
             ON category.id = snapshot.category_id
            AND category.slug = 'national-team-official-goals'
           LEFT JOIN entity_identity_links link ON link.source_entity_id = entries.entity_id
          WHERE entries.snapshot_id = $1
          GROUP BY COALESCE(link.canonical_entity_id, entries.entity_id)
       )
       SELECT playable.entity_id,
              entity.canonical_name,
              COALESCE(club.club_goals, 0)::text AS club_goals,
              COALESCE(national.national_goals, 0)::text AS national_goals,
              ARRAY_REMOVE(ARRAY_CAT(
                COALESCE(club.source_snapshots, '{}'::text[]),
                COALESCE(national.source_snapshots, '{}'::text[])
              ), NULL) AS source_snapshots
         FROM playable_players playable
         JOIN entities entity
           ON entity.id = playable.entity_id
          AND entity.entity_type = 'player'
          AND entity.catalog_status = 'active'
         LEFT JOIN club_totals club ON club.entity_id = playable.entity_id
         LEFT JOIN national_totals national ON national.entity_id = playable.entity_id
        WHERE COALESCE(club.club_goals, 0) + COALESCE(national.national_goals, 0) > 0
        ORDER BY COALESCE(club.club_goals, 0) + COALESCE(national.national_goals, 0) DESC,
                 entity.canonical_name, playable.entity_id
        LIMIT 200`,
      [selectedNationalSnapshot.id]
    );
    if (rows.rows.length < 200) throw new Error(`Se necesitan 200 jugadores jugables con goles observados; disponibles ${rows.rows.length}`);
    const rankingId = await importRankingInput({
      categorySlug,
      source: {
        key: 'rango90-global-career-goals-derived',
        name: 'Agregado Rango90 de goles de clubes y selección absoluta',
        sourceType: 'reference',
        baseUrl: 'https://www.rango90.local/data/global-career-goals',
        rightsStatus: 'review_required'
      },
      dataVersion: `rango90-player-career-goals-${new Date().toISOString().slice(0, 10)}`,
      coverageComplete: false,
      allowPartialDraft: true,
      partialDraftReason: 'El componente de clubes procede de las temporadas y competiciones API-Football actualmente importadas; el componente internacional procede del snapshot RSSSF disponible. El agregado no demuestra todavía una carrera mundial completa ni derechos de redistribución.',
      reviewed: false,
      entries: rows.rows.map((row, index) => ({
        entityId: row.entity_id,
        entityType: 'player' as const,
        name: row.canonical_name,
        rawValue: Number(row.club_goals) + Number(row.national_goals),
        evidence: {
          sourceRank: index + 1,
          clubGoals: Number(row.club_goals),
          nationalTeamGoals: Number(row.national_goals),
          sourceSnapshotIds: row.source_snapshots,
          nationalGoalsSnapshotId: selectedNationalSnapshot.id,
          definition: 'Suma provisional de goles observados en competiciones de clubes API-Football importadas y goles internacionales del snapshot RSSSF seleccionado; clubes + selección absoluta, sin afirmar cobertura completa de todas las temporadas o competiciones.'
        }
      }))
    });
    console.log(JSON.stringify({
      source: 'rango90-global-career-goals-derived',
      categorySlug,
      rankingId,
      entries: rows.rows.length,
      nationalSnapshotId: selectedNationalSnapshot.id,
      coverageComplete: false,
      published: false,
      note: 'Snapshot draft provisional; requiere ampliar el histórico, revisar identidades y obtener derechos abiertos o permiso escrito antes de cualquier publicación.'
    }, null, 2));
  } else if (command === 'build-global-goalkeeper-clean-sheets') {
    const categorySlug = 'goalkeeper-career-clean-sheets';
    const rows = await pool.query<{ entity_id: string; canonical_name: string; raw_value: string; source_snapshots: string[] }>(
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
       ), latest AS (
         SELECT DISTINCT ON (c.slug)
                c.slug, rs.id, rs.metadata->>'sourceSnapshotId' AS source_snapshot_id
           FROM category_definitions c
           JOIN ranking_snapshots rs
             ON rs.category_id = c.id AND rs.status <> 'superseded'
          WHERE c.status <> 'retired'
            AND c.entity_type = 'player'
            AND c.metric_key = 'clean_sheets'
            AND c.slug IN ('premier-league-clean_sheets', 'la-liga-clean_sheets', 'bundesliga-clean_sheets', 'serie-a-clean_sheets', 'ligue-1-clean_sheets', 'primeira-liga-clean_sheets')
          ORDER BY c.slug, rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC
       ), totals AS (
         SELECT COALESCE(link.canonical_entity_id, re.entity_id) AS entity_id,
                SUM(re.raw_value)::text AS raw_value,
                ARRAY_AGG(DISTINCT latest.source_snapshot_id) FILTER (WHERE latest.source_snapshot_id IS NOT NULL) AS source_snapshots
           FROM latest
           JOIN ranking_entries re ON re.snapshot_id = latest.id
           LEFT JOIN entity_identity_links link ON link.source_entity_id = re.entity_id
          WHERE re.raw_value > 0
          GROUP BY COALESCE(link.canonical_entity_id, re.entity_id)
       )
       SELECT totals.entity_id, e.canonical_name, totals.raw_value, totals.source_snapshots
         FROM totals
         JOIN entities e ON e.id = totals.entity_id AND e.entity_type = 'player'
        ORDER BY totals.raw_value::numeric DESC, e.canonical_name, totals.entity_id
        LIMIT 200`
    );
    if (rows.rows.length < 200) throw new Error(`Se necesitan 200 porteros para el ranking global de porterías a cero; disponibles ${rows.rows.length}`);
    const rankingId = await importRankingInput({
      categorySlug,
      source: {
        key: 'rango90-goalkeeper-clean-sheets-aggregate',
        name: 'Agregado Rango 90 de registros históricos de porterías a cero',
        sourceType: 'reference',
        baseUrl: 'https://www.bdfutbol.com/en/c/',
        rightsStatus: 'review_required'
      },
      dataVersion: `rango90-goalkeeper-clean-sheets-${new Date().toISOString().slice(0, 10)}`,
      coverageComplete: false,
      allowPartialDraft: true,
      partialDraftReason: 'El agregado suma únicamente los cortes históricos disponibles de seis ligas; no demuestra todavía la carrera completa de cada portero ni evita que falten competiciones.',
      reviewed: false,
      entries: rows.rows.map((row, index) => ({
        entityId: row.entity_id,
        entityType: 'player' as const,
        name: row.canonical_name,
        rawValue: Number(row.raw_value),
        evidence: {
          sourceRank: index + 1,
          sourceSnapshotIds: row.source_snapshots,
          metric: 'clean_sheets',
          definition: 'Suma de los valores de porterías a cero de los rankings históricos disponibles de Premier League, LaLiga, Bundesliga, Serie A, Ligue 1 y Primeira Liga; solo jugadores identificados como porteros por la fuente.'
        }
      }))
    });
    console.log(JSON.stringify({ source: 'rango90-clean-sheets-aggregate', categorySlug, rankingId, entries: rows.rows.length, coverageComplete: false, note: 'Snapshot provisional agregado de seis ligas; no es todavía una carrera mundial completa.' }, null, 2));
  } else if (command === 'import-uefa-euro-global') {
    const requestedMetric = argument('metric') as UefaEuroHistoricalMetric | undefined;
    const metrics: readonly UefaEuroHistoricalMetric[] = requestedMetric ? [requestedMetric] : ['goals', 'assists'];
    if (metrics.some((metric) => !['goals', 'assists', 'yellow_cards'].includes(metric))) {
      throw new Error('La métrica debe ser goals, assists o yellow_cards');
    }
    const results: Array<{ metric: UefaEuroHistoricalMetric; rankingId: string; entries: number; coverageComplete: boolean }> = [];
    for (const metric of metrics) {
      const input = await fetchUefaEuroAllTimeRanking(metric);
      const rankingId = await importRankingInput(input);
      results.push({ metric, rankingId, entries: input.entries.length, coverageComplete: input.coverageComplete });
    }
    console.log(JSON.stringify({ source: 'uefa-euro-official', results, editions: UEFA_EURO_HISTORICAL_SEASONS, coverageComplete: results.every((result) => result.coverageComplete), published: false, note: 'Ranking global agregado desde las 17 ediciones oficiales de fase final; los derechos de redistribución siguen en revisión.' }, null, 2));
  } else if (command === 'build-euro-assists') {
    const seasons = [...UEFA_EURO_HISTORICAL_SEASONS];
    const metrics = ['goals', 'assists'] as const;
    const results: Array<{ metric: string; rankingId: string; entries: number; uniquePlayers: number }> = [];
    const identityRows = await pool.query<{ source_entity_id: string; canonical_entity_id: string }>(
      'SELECT source_entity_id, canonical_entity_id FROM entity_identity_links'
    );
    const canonicalByEntityId = new Map(identityRows.rows.map((row) => [row.source_entity_id, row.canonical_entity_id]));
    for (const metric of metrics) {
      const categorySlug = `euro-${metric}`;
      const expectedSlugs = seasons.map((season) => `euro-${season}-${metric}`);
      const snapshotRows = await pool.query<{
        slug: string;
        id: string;
        source_snapshot_id: string | null;
      }>(
        `SELECT DISTINCT ON (c.slug)
                c.slug,
                rs.id,
                rs.metadata->>'sourceSnapshotId' AS source_snapshot_id
           FROM category_definitions c
           JOIN ranking_snapshots rs
             ON rs.category_id = c.id
            AND rs.status <> 'superseded'
          WHERE c.slug = ANY($1::text[])
            AND c.entity_type = 'player'
          ORDER BY c.slug, rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC`,
        [expectedSlugs]
      );
      const snapshotsBySlug = new Map(snapshotRows.rows.map((row) => [row.slug, row]));
      const missing = expectedSlugs.filter((slug) => !snapshotsBySlug.has(slug));
      if (missing.length > 0) throw new Error(`Faltan snapshots oficiales de ${metric} de Eurocopa: ${missing.join(', ')}`);
      const snapshotIds = snapshotRows.rows.map((row) => row.id);
      const entryRows = await pool.query<{
        entity_id: string;
        canonical_name: string;
        raw_value: string;
        snapshot_id: string;
        source_rank: number | null;
      }>(
        `SELECT re.entity_id,
                e.canonical_name,
                re.raw_value::text AS raw_value,
                re.snapshot_id,
                re.source_rank
           FROM ranking_entries re
           JOIN entities e ON e.id = re.entity_id AND e.entity_type = 'player'
          WHERE re.snapshot_id = ANY($1::text[])`,
        [snapshotIds]
      );
      type Aggregate = {
        entityId: string;
        name: string;
        value: number;
        editions: Set<number>;
        sourceRanks: Array<{ season: number; rank: number | null; value: number }>;
      };
      const aggregates = new Map<string, Aggregate>();
      const seasonBySnapshotId = new Map(snapshotRows.rows.map((row) => [row.id, Number(row.slug.match(/euro-(\d{4})-/)?.[1])]));
      for (const row of entryRows.rows) {
        const entityId = canonicalByEntityId.get(row.entity_id) ?? row.entity_id;
        const season = seasonBySnapshotId.get(row.snapshot_id);
        const value = Number(row.raw_value);
        if (!season || !Number.isFinite(value) || value < 0) continue;
        const aggregate = aggregates.get(entityId) ?? { entityId, name: row.canonical_name, value: 0, editions: new Set<number>(), sourceRanks: [] };
        aggregate.value += value;
        aggregate.editions.add(season);
        aggregate.sourceRanks.push({ season, rank: row.source_rank, value });
        aggregates.set(entityId, aggregate);
      }
      const top200 = [...aggregates.values()]
        .filter((row) => row.value > 0)
        .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name) || left.entityId.localeCompare(right.entityId))
        .slice(0, 200);
      if (top200.length < 200) throw new Error(`Se necesitan 200 jugadores para ${categorySlug}; disponibles ${top200.length}`);
      const rankingId = await importRankingInput({
        categorySlug,
        source: {
          key: 'uefa-euro-official',
          name: 'UEFA EURO official historical player statistics — aggregate editions',
          sourceType: 'official',
          baseUrl: `https://www.uefa.com/uefaeuro/history/rankings/players/${metric}/`,
          rightsStatus: 'review_required'
        },
        dataVersion: `uefa-euro-global-${metric}-${seasons.join('-')}-${new Date().toISOString().slice(0, 10)}`,
        coverageComplete: false,
        allowPartialDraft: true,
        partialDraftReason: `El agregado usa las ediciones de fase final que UEFA expone en su servicio histórico; la métrica ${metric} depende de la disponibilidad y definición de estadísticas de UEFA, por lo que no se afirma que cubra cualquier registro externo al servicio.`,
        reviewed: false,
        entries: top200.map((row, index) => ({
          entityId: row.entityId,
          entityType: 'player' as const,
          name: row.name,
          rawValue: row.value,
          evidence: {
            sourceRank: index + 1,
            sourceSnapshotIds: snapshotRows.rows.map((snapshot) => snapshot.source_snapshot_id ?? snapshot.id),
            editions: [...row.editions].sort((left, right) => left - right),
            componentRanks: row.sourceRanks.sort((left, right) => left.season - right.season),
            definition: `Suma de ${metric} registradas por UEFA en las ediciones importadas de la fase final de la Eurocopa; cada identidad se resuelve antes de agregar y no se aplica padding.`
          }
        }))
      });
      results.push({ metric, rankingId, entries: top200.length, uniquePlayers: aggregates.size });
    }
    console.log(JSON.stringify({ source: 'uefa-euro-official', results, editions: seasons, coverageComplete: false, published: false, note: 'Rankings globales agregados de las ediciones UEFA de fase final importadas; permanecen en borrador hasta revisar definición histórica y derechos.' }, null, 2));
  } else if (command === 'build-goalkeeper-historical-index') {
    const categorySlug = 'goalkeeper-historical-index';
    const rows = await pool.query<{
      entity_id: string;
      canonical_name: string;
      clean_sheets: string;
      appearances: string;
      major_titles: string;
      iffhs_points: string;
      national_team: string;
      clean_sheet_sources: string[] | null;
      iffhs_sources: string[] | null;
    }>(
      `WITH RECURSIVE identity_chain AS (
         SELECT source_entity_id, canonical_entity_id, 1 AS depth
         FROM entity_identity_links
         UNION ALL
         SELECT chain.source_entity_id, next_link.canonical_entity_id, chain.depth + 1
         FROM identity_chain chain
         JOIN entity_identity_links next_link ON next_link.source_entity_id = chain.canonical_entity_id
         WHERE chain.depth < 5
       ), resolved_identity_links AS (
         SELECT DISTINCT ON (source_entity_id) source_entity_id, canonical_entity_id
         FROM identity_chain
         ORDER BY source_entity_id, depth DESC
       ), latest_clean_sheets AS (
         SELECT rs.id
         FROM ranking_snapshots rs
         JOIN category_definitions c ON c.id = rs.category_id
                              AND c.scope_kind NOT IN ('integration', 'test')
         WHERE c.slug = 'goalkeeper-career-clean-sheets'
           AND rs.status <> 'superseded'
         ORDER BY rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC
         LIMIT 1
       ), clean_sheet_ranking AS (
         SELECT COALESCE(link.canonical_entity_id, re.entity_id) AS entity_id,
                MAX(re.raw_value)::numeric AS clean_sheets,
                ARRAY_AGG(DISTINCT rs.metadata->>'sourceSnapshotId') FILTER (WHERE rs.metadata->>'sourceSnapshotId' IS NOT NULL) AS source_snapshots
         FROM ranking_entries re
         JOIN latest_clean_sheets latest ON latest.id = re.snapshot_id
         JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
         LEFT JOIN resolved_identity_links link ON link.source_entity_id = re.entity_id
         GROUP BY COALESCE(link.canonical_entity_id, re.entity_id)
       ), iffhs AS (
         SELECT COALESCE(link.canonical_entity_id, f.subject_entity_id) AS entity_id,
                MAX((f.value->>'points')::numeric) AS iffhs_points,
                ARRAY_AGG(DISTINCT f.source_snapshot_id) FILTER (WHERE f.source_snapshot_id IS NOT NULL) AS source_snapshots
         FROM fact_assertions f
         LEFT JOIN resolved_identity_links link ON link.source_entity_id = f.subject_entity_id
         WHERE f.fact_type = 'historical_goalkeeper_iffhs_points'
           AND f.review_status <> 'rejected'
         GROUP BY COALESCE(link.canonical_entity_id, f.subject_entity_id)
       ), rsssf AS (
         SELECT COALESCE(link.canonical_entity_id, f.subject_entity_id) AS entity_id,
                MAX((f.value->>'cleanSheetsProfessional')::numeric) AS clean_sheets,
                MAX((f.value->>'gamesAll')::numeric) AS appearances,
                ARRAY_AGG(DISTINCT f.source_snapshot_id) FILTER (WHERE f.source_snapshot_id IS NOT NULL) AS source_snapshots
         FROM fact_assertions f
         LEFT JOIN resolved_identity_links link ON link.source_entity_id = f.subject_entity_id
         WHERE f.fact_type = 'historical_goalkeeper_clean_sheets'
           AND f.review_status <> 'rejected'
         GROUP BY COALESCE(link.canonical_entity_id, f.subject_entity_id)
       ), title_counts AS (
         SELECT COALESCE(link.canonical_entity_id, f.subject_entity_id) AS entity_id,
                COUNT(DISTINCT CONCAT(f.fact_type, ':', f.value->>'season'))::numeric AS major_titles
         FROM fact_assertions f
         LEFT JOIN resolved_identity_links link ON link.source_entity_id = f.subject_entity_id
         WHERE f.fact_type LIKE 'player_trophy_record:%'
           AND f.value->>'place' = 'Winner'
           AND f.review_status <> 'rejected'
         GROUP BY COALESCE(link.canonical_entity_id, f.subject_entity_id)
       ), candidates AS (
         SELECT entity_id FROM clean_sheet_ranking
         UNION
         SELECT entity_id FROM iffhs
         UNION
         SELECT entity_id FROM rsssf
       )
       SELECT candidates.entity_id, e.canonical_name,
              COALESCE(rsssf.clean_sheets, clean_sheet_ranking.clean_sheets, 0)::text AS clean_sheets,
              COALESCE(rsssf.appearances, 0)::text AS appearances,
              COALESCE(title_counts.major_titles, 0)::text AS major_titles,
              COALESCE(iffhs.iffhs_points, 0)::text AS iffhs_points,
              0::text AS national_team,
              ARRAY(SELECT DISTINCT value FROM unnest(COALESCE(rsssf.source_snapshots, '{}') || COALESCE(clean_sheet_ranking.source_snapshots, '{}')) AS value WHERE value IS NOT NULL) AS clean_sheet_sources,
              iffhs.source_snapshots AS iffhs_sources
         FROM candidates
         JOIN entities e ON e.id = candidates.entity_id AND e.entity_type = 'player' AND e.is_goalkeeper = TRUE
         LEFT JOIN clean_sheet_ranking ON clean_sheet_ranking.entity_id = candidates.entity_id
         LEFT JOIN iffhs ON iffhs.entity_id = candidates.entity_id
         LEFT JOIN rsssf ON rsssf.entity_id = candidates.entity_id
         LEFT JOIN title_counts ON title_counts.entity_id = candidates.entity_id`
    );
    if (rows.rows.length < 200) throw new Error(`Se necesitan 200 candidatos para el índice histórico de porteros; disponibles ${rows.rows.length}`);
    const max = (field: keyof typeof rows.rows[number]): number => Math.max(...rows.rows.map((row) => Number(row[field]) || 0), 1);
    const maxima = {
      majorTitles: max('major_titles'),
      appearances: max('appearances'),
      iffhsPoints: max('iffhs_points'),
      cleanSheets: max('clean_sheets'),
      nationalTeam: max('national_team')
    };
    const scored = rows.rows.map((row) => {
      const majorTitles = Number(row.major_titles) || 0;
      const appearances = Number(row.appearances) || 0;
      const iffhsPoints = Number(row.iffhs_points) || 0;
      const cleanSheets = Number(row.clean_sheets) || 0;
      const nationalTeam = Number(row.national_team) || 0;
      const score = 100 * (
        0.30 * majorTitles / maxima.majorTitles +
        0.25 * appearances / maxima.appearances +
        0.20 * iffhsPoints / maxima.iffhsPoints +
        0.15 * cleanSheets / maxima.cleanSheets +
        0.10 * nationalTeam / maxima.nationalTeam
      );
      return {
        entityId: row.entity_id,
        entityType: 'player' as const,
        name: row.canonical_name,
        rawValue: Number(score.toFixed(6)),
        evidence: {
          metric: 'goalkeeper_index',
          sourceRank: null,
          features: { majorTitles, appearances, iffhsPoints, cleanSheets, nationalTeam },
          weights: { majorTitles: 0.30, appearancesLongevity: 0.25, awards: 0.20, cleanSheets: 0.15, nationalTeam: 0.10 },
          normalizationMaxima: maxima,
          sourceSnapshotIds: [...new Set([...(row.clean_sheet_sources ?? []), ...(row.iffhs_sources ?? [])])],
          definition: 'Índice reproducible sobre los datos observados. IFFHS aporta los puntos históricos; RSSSF aporta porterías a cero y partidos; los títulos proceden de hechos de trofeos disponibles. Los componentes ausentes se dejan en cero y no se imputan. El resultado es provisional hasta completar apariciones, títulos y trayectoria internacional de forma mundial y homogénea.'
        }
      };
    }).sort((left, right) => right.rawValue - left.rawValue || left.name.localeCompare(right.name));
    const top200 = scored.slice(0, 200).map((entry, index) => ({ ...entry, evidence: { ...entry.evidence, sourceRank: index + 1 } }));
    const rankingId = await importRankingInput({
      categorySlug,
      source: {
        key: 'rango90-goalkeeper-historical-index',
        name: 'Índice histórico Rango 90 de porteros (derivado de IFFHS y RSSSF)',
        sourceType: 'reference',
        baseUrl: 'https://iffhs.com/en/news/iffhs-mens-all-time-world-best-goalkeeper-ranking-1987-2022-2597',
        rightsStatus: 'review_required'
      },
      dataVersion: `rango90-goalkeeper-historical-index-${new Date().toISOString().slice(0, 10)}`,
      coverageComplete: false,
      reviewed: false,
      entries: top200
    });
    console.log(JSON.stringify({ source: 'rango90-goalkeeper-historical-index', categorySlug, rankingId, candidates: rows.rows.length, entries: top200.length, coverageComplete: false, published: false, note: 'Índice provisional: no se imputan datos ausentes y permanece pendiente de revisión.' }, null, 2));
  } else if (command === 'build-player-career-titles') {
    const categorySlug = 'player-career-titles';
    const candidates = await pool.query<{ entity_id: string; canonical_name: string; titles: string; source_snapshots: string[] | null }>(
      `WITH playable_players AS (
         SELECT DISTINCT COALESCE(link.canonical_entity_id, source_entity.id) AS entity_id
           FROM entity_game_profiles egp
           JOIN entities source_entity
             ON source_entity.id = egp.entity_id AND source_entity.entity_type = 'player'
           LEFT JOIN entity_identity_links link ON link.source_entity_id = source_entity.id
          WHERE egp.playable_default = TRUE
       )
       ,title_totals AS (
         SELECT COALESCE(link.canonical_entity_id, f.subject_entity_id) AS entity_id,
                COUNT(DISTINCT CONCAT(f.value->>'competition', ':', f.value->>'season'))::text AS titles,
                ARRAY_AGG(DISTINCT f.source_snapshot_id) FILTER (WHERE f.source_snapshot_id IS NOT NULL) AS source_snapshots
           FROM fact_assertions f
           LEFT JOIN entity_identity_links link ON link.source_entity_id = f.subject_entity_id
          WHERE f.fact_type LIKE 'player_trophy_record:%'
            AND f.review_status <> 'rejected'
          GROUP BY COALESCE(link.canonical_entity_id, f.subject_entity_id)
       )
       SELECT pp.entity_id,
              e.canonical_name,
              COALESCE(title_totals.titles, '0') AS titles,
              COALESCE(title_totals.source_snapshots, '{}') AS source_snapshots
         FROM playable_players pp
         JOIN entities e ON e.id = pp.entity_id AND e.entity_type = 'player'
         LEFT JOIN title_totals ON title_totals.entity_id = pp.entity_id
        ORDER BY COALESCE(title_totals.titles, '0')::numeric DESC, e.canonical_name, pp.entity_id
        LIMIT 200`
    );
    if (candidates.rows.length < 200) {
      throw new Error(`Se necesitan 200 jugadores jugables para el ranking global de títulos; disponibles ${candidates.rows.length}`);
    }
    const rankingId = await importRankingInput({
      categorySlug,
      source: {
        key: 'api-football',
        name: 'API-Football / API-Sports',
        sourceType: 'api',
        baseUrl: 'https://v3.football.api-sports.io/trophies',
        rightsStatus: 'review_required'
      },
      dataVersion: `api-football-player-career-titles-${new Date().toISOString().slice(0, 10)}`,
      coverageComplete: false,
      allowPartialDraft: true,
      partialDraftReason: 'El endpoint /trophies solo está contrastado para una cohorte jugable y no demuestra todavía todas las competiciones ni la participación efectiva en cada título.',
      reviewed: false,
      entries: candidates.rows.map((row, index) => ({
        entityId: row.entity_id,
        entityType: 'player' as const,
        name: row.canonical_name,
        rawValue: Number(row.titles),
        evidence: {
          sourceRank: index + 1,
          sourceSnapshotIds: row.source_snapshots ?? [],
          definition: 'Títulos oficiales registrados por API-Football /trophies, deduplicados por jugador, competición y temporada; los ceros representan jugadores incluidos en la cohorte para mantener un corte de 200.'
        }
      }))
    });
    console.log(JSON.stringify({ source: 'api-football', categorySlug, rankingId, entries: candidates.rows.length, positiveTitlePlayers: candidates.rows.filter((row) => Number(row.titles) > 0).length, coverageComplete: false, note: 'Snapshot provisional: requiere ampliar/contrastar trofeos y participación antes de publicar.' }, null, 2));
  } else if (command === 'build-club-global-titles') {
    const categorySlug = 'club-global-titles';
    const rows = await pool.query<{
      entity_id: string;
      canonical_name: string;
      titles: string;
      source_snapshots: string[];
      source_fact_ids: string[];
      competitions: string[];
    }>(
      `WITH RECURSIVE identity_chain AS (
         SELECT e.id AS source_entity_id,
                e.id AS canonical_entity_id,
                ARRAY[e.id]::text[] AS path,
                0 AS depth
           FROM entities e
          WHERE e.entity_type = 'club'
         UNION ALL
         SELECT chain.source_entity_id,
                link.canonical_entity_id,
                chain.path || link.canonical_entity_id,
                chain.depth + 1
           FROM identity_chain chain
           JOIN entity_identity_links link
             ON link.source_entity_id = chain.canonical_entity_id
          WHERE NOT link.canonical_entity_id = ANY(chain.path)
            AND chain.depth < 10
       ), resolved_identity AS (
         SELECT DISTINCT ON (source_entity_id)
                source_entity_id,
                canonical_entity_id
           FROM identity_chain
          ORDER BY source_entity_id, depth DESC
       ), playable_clubs AS (
         SELECT DISTINCT COALESCE(link.canonical_entity_id, source_entity.id) AS entity_id
           FROM entity_game_profiles egp
           JOIN entities source_entity
             ON source_entity.id = egp.entity_id AND source_entity.entity_type = 'club'
           LEFT JOIN entity_identity_links link ON link.source_entity_id = source_entity.id
          WHERE egp.playable_default = TRUE
       ), imported_title_facts AS (
         SELECT f.id,
                COALESCE(resolved_identity.canonical_entity_id, f.subject_entity_id) AS entity_id,
                f.source_snapshot_id,
                f.value->>'categorySlug' AS competition,
                NULLIF((f.value->>'rawValue')::numeric, 0) AS raw_value,
                ss.retrieved_at,
                ROW_NUMBER() OVER (
                  PARTITION BY COALESCE(resolved_identity.canonical_entity_id, f.subject_entity_id), f.value->>'categorySlug'
                  ORDER BY ss.retrieved_at DESC, f.id DESC
                ) AS freshness_rank
           FROM fact_assertions f
           JOIN source_snapshots ss ON ss.id = f.source_snapshot_id
           JOIN entities subject ON subject.id = f.subject_entity_id AND subject.entity_type = 'club'
           LEFT JOIN resolved_identity ON resolved_identity.source_entity_id = f.subject_entity_id
           JOIN category_definitions source_category
             ON source_category.slug = f.value->>'categorySlug'
            AND source_category.entity_type = 'club'
            AND source_category.status <> 'retired'
            AND source_category.slug <> 'club-global-titles'
          WHERE EXISTS (
                SELECT 1
                  FROM ranking_snapshots source_ranking
                 WHERE source_ranking.category_id = source_category.id
                   AND source_ranking.metadata->>'sourceSnapshotId' = f.source_snapshot_id
                   AND source_ranking.status <> 'superseded'
                   AND source_ranking.coverage_complete = TRUE
          )
            AND f.fact_type = 'ranking_value:titles'
            AND f.review_status IN ('pending', 'approved')
            AND NULLIF(BTRIM(f.value->>'categorySlug'), '') IS NOT NULL
            AND NULLIF((f.value->>'rawValue')::numeric, 0) IS NOT NULL
       ), selected_title_facts AS (
         SELECT * FROM imported_title_facts WHERE freshness_rank = 1
       ), totals AS (
         SELECT selected.entity_id,
                SUM(selected.raw_value)::text AS titles,
                ARRAY_AGG(DISTINCT selected.source_snapshot_id ORDER BY selected.source_snapshot_id) AS source_snapshots,
                ARRAY_AGG(DISTINCT selected.id ORDER BY selected.id) AS source_fact_ids,
                ARRAY_AGG(DISTINCT selected.competition ORDER BY selected.competition) AS competitions
           FROM selected_title_facts selected
           JOIN playable_clubs playable ON playable.entity_id = selected.entity_id
          GROUP BY selected.entity_id
       )
       SELECT totals.entity_id,
              e.canonical_name,
              totals.titles,
              totals.source_snapshots,
              totals.source_fact_ids,
              totals.competitions
         FROM totals
         JOIN entities e ON e.id = totals.entity_id AND e.entity_type = 'club'
       ORDER BY totals.titles::numeric DESC, e.canonical_name, totals.entity_id
        LIMIT 200`
    );
    const selfReferentialRows = rows.rows.filter((row) => row.competitions.includes(categorySlug));
    if (selfReferentialRows.length > 0) {
      throw new Error(`El ranking ${categorySlug} contiene hechos derivados de sí mismo en ${selfReferentialRows.length} clubes`);
    }
    if (rows.rows.length < 200) {
      throw new Error(`Se necesitan 200 clubes jugables con hechos de títulos; disponibles ${rows.rows.length}`);
    }
    const rankingId = await importRankingInput({
      categorySlug,
      source: {
        key: 'rango90-club-title-facts',
        name: 'Hechos de palmarés de clubes ya importados en Rango 90',
        sourceType: 'reference',
        rightsStatus: 'review_required'
      },
      dataVersion: `rango90-club-global-titles-${new Date().toISOString().slice(0, 10)}`,
      coverageComplete: false,
      allowPartialDraft: true,
      partialDraftReason: 'El ranking suma únicamente competiciones de clubes ya importadas y no afirma una cobertura mundial completa.',
      reviewed: false,
      entries: rows.rows.map((row, index) => ({
        entityId: row.entity_id,
        entityType: 'club' as const,
        name: row.canonical_name,
        rawValue: Number(row.titles),
        evidence: {
          sourceRank: index + 1,
          sourceSnapshotIds: row.source_snapshots,
          sourceFactIds: row.source_fact_ids,
          competitions: row.competitions,
          definition: 'Suma de los últimos hechos ranking_value:titles disponibles por club y competición activa; se descartan snapshots repetidos conservando el más reciente y no se aplica padding.'
        }
      }))
    });
    console.log(JSON.stringify({ source: 'rango90-club-title-facts', categorySlug, rankingId, entries: rows.rows.length, coverageComplete: false, note: 'Snapshot provisional: solo incluye palmarés de clubes importados y deduplicados.' }, null, 2));
  } else if (command === 'build-football-data-national-league-club-titles') {
    const sourceUrl = argument('url') ?? footballDataResultsUrl;
    const sourceVersion = argument('version');
    if (!/^https:\/\//i.test(sourceUrl)) throw new Error('La fuente football-data requiere una URL HTTPS');
    const results = await fetchFootballDataResults(sourceUrl);
    const input = buildFootballDataNationalLeagueRanking(results, { sourceUrl, sourceVersion });
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({
      source: 'schochastics-football-data',
      categorySlug: input.categorySlug,
      rankingId,
      sourceUrl,
      sourceVersion: sourceVersion ?? null,
      sourceRows: results.length,
      entries: input.entries.length,
      coverageComplete: input.coverageComplete,
      published: false,
      note: 'Snapshot draft provisional: los resultados tienen licencia de atribución y advertencias históricas; falta contraste de campeones, identidades, cobertura y derechos antes de aprobar o publicar.'
    }, null, 2));
  } else if (command === 'build-football-data-career-cards') {
    const requestedMetrics = (argument('metric') ?? 'yellow_cards,red_cards')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean) as FootballDataCardMetric[];
    if (requestedMetrics.length === 0 || requestedMetrics.some((value) => !['yellow_cards', 'red_cards'].includes(value))) {
      throw new Error('Métricas válidas: yellow_cards, red_cards');
    }
    const uniqueMetrics = [...new Set(requestedMetrics)];
    const fetched = await fetchFootballDataIncidents();
    const rankings = buildFootballDataCareerCardsRankings(fetched.incidents, {
      sourceVersion: fetched.manifest.commitSha,
      sourceFiles: fetched.manifest.files.length
    });
    const results = [];
    for (const metric of uniqueMetrics) {
      const input = rankings[metric];
      const rankingId = await importRankingInput(input);
      results.push({ metric, categorySlug: input.categorySlug, rankingId, entries: input.entries.length });
    }
    console.log(JSON.stringify({
      source: 'schochastics-football-data-incidents',
      sourceVersion: fetched.manifest.commitSha,
      sourceFiles: fetched.manifest.files.length,
      sourceIncidents: fetched.incidents.length,
      results,
      coverageComplete: false,
      published: false,
      note: 'Snapshots draft candidatos: la fuente ODbL aporta incidentes, pero usa nombres Surname Initial sin IDs estables y no demuestra por sí sola cobertura mundial ni una identidad canónica segura.'
    }, null, 2));
  } else if (command === 'build-openfootball-national-league-club-titles') {
    const manifestPath = argument('manifest');
    if (!manifestPath) throw new Error('Se requiere --manifest con las temporadas Football.TXT a importar');
    const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8')) as {
      sourceVersion?: string;
      seasons?: OpenFootballSeasonSource[];
    };
    if (!Array.isArray(manifest.seasons) || manifest.seasons.length === 0) {
      throw new Error('El manifiesto OpenFootball debe contener al menos una temporada');
    }
    if (manifest.seasons.length > 10_000) throw new Error('El manifiesto OpenFootball supera el límite de temporadas');
    const sources = manifest.seasons.map((season) => {
      if (!season || typeof season.competition !== 'string' || !season.competition.trim() || typeof season.season !== 'string' || !season.season.trim() || typeof season.url !== 'string' || !/^https:\/\//i.test(season.url)) {
        throw new Error('Cada temporada OpenFootball requiere competition, season y una URL HTTPS');
      }
      return { competition: season.competition.trim(), season: season.season.trim(), url: season.url };
    });
    const fetchedSeasons = [];
    for (const source of sources) {
      const response = await fetch(source.url, { headers: { 'User-Agent': 'Rango90-openfootball-import/0.1' }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`OpenFootball ${source.url}: HTTP ${response.status}`);
      const content = await response.text();
      const matches = parseFootballTxtResults(content, source.season);
      fetchedSeasons.push({ ...source, matches });
    }
    const input = buildOpenFootballClubTitleRanking(fetchedSeasons);
    input.audit = {
      sourceRepository: openFootballLeaguesUrl,
      sourceLicense: 'public-domain-dedication',
      sourceVersion: manifest.sourceVersion ?? null,
      manifestPath,
      seasonSources: sources,
      fetchedSeasonCount: fetchedSeasons.length,
      fetchedMatchCount: fetchedSeasons.reduce((total, season) => total + season.matches.length, 0)
    };
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({
      source: 'openfootball-leagues',
      categorySlug: input.categorySlug,
      rankingId,
      entries: input.entries.length,
      seasons: sources.length,
      coverageComplete: input.coverageComplete,
      published: false,
      note: 'Snapshot draft provisional: el manifiesto y los resultados deben auditarse para cobertura mundial, formato histórico, identidades y derechos antes de aprobar o publicar.'
    }, null, 2));
  } else if (command === 'build-national-league-club-titles') {
    const categorySlug = 'national-league-club-titles';
    const domesticCategorySlugs = [
      'premier-league-club-titles',
      'la-liga-club-titles',
      'bundesliga-club-titles',
      'serie-a-club-titles',
      'ligue-1-club-titles',
      'primeira-liga-club-titles'
    ];
    const rows = await pool.query<{
      entity_id: string;
      canonical_name: string;
      titles: string;
      source_snapshots: string[];
      source_fact_ids: string[];
      competitions: string[];
    }>(
      `WITH RECURSIVE identity_chain AS (
         SELECT e.id AS source_entity_id, e.id AS canonical_entity_id,
                ARRAY[e.id]::text[] AS path, 0 AS depth
           FROM entities e
          WHERE e.entity_type = 'club'
         UNION ALL
         SELECT chain.source_entity_id, link.canonical_entity_id,
                chain.path || link.canonical_entity_id, chain.depth + 1
           FROM identity_chain chain
           JOIN entity_identity_links link ON link.source_entity_id = chain.canonical_entity_id
          WHERE NOT link.canonical_entity_id = ANY(chain.path)
            AND chain.depth < 10
       ), resolved_identity AS (
         SELECT DISTINCT ON (source_entity_id) source_entity_id, canonical_entity_id
           FROM identity_chain
          ORDER BY source_entity_id, depth DESC
       ), playable_clubs AS (
         SELECT DISTINCT COALESCE(resolved_identity.canonical_entity_id, e.id) AS entity_id
           FROM entity_game_profiles profile
           JOIN entities e ON e.id = profile.entity_id AND e.entity_type = 'club'
           LEFT JOIN resolved_identity ON resolved_identity.source_entity_id = e.id
          WHERE profile.playable_default = TRUE
       ), domestic_facts AS (
         SELECT f.id,
                COALESCE(resolved_identity.canonical_entity_id, f.subject_entity_id) AS entity_id,
                f.source_snapshot_id,
                f.value->>'categorySlug' AS competition,
                NULLIF((f.value->>'rawValue')::numeric, 0) AS raw_value,
                ROW_NUMBER() OVER (
                  PARTITION BY COALESCE(resolved_identity.canonical_entity_id, f.subject_entity_id), f.value->>'categorySlug'
                  ORDER BY f.id DESC
                ) AS freshness_rank
           FROM fact_assertions f
           JOIN entities subject ON subject.id = f.subject_entity_id AND subject.entity_type = 'club'
           LEFT JOIN resolved_identity ON resolved_identity.source_entity_id = f.subject_entity_id
          WHERE f.fact_type = 'ranking_value:titles'
            AND f.review_status IN ('pending', 'approved')
            AND f.value->>'categorySlug' = ANY($1::text[])
            AND NULLIF((f.value->>'rawValue')::numeric, 0) IS NOT NULL
            AND EXISTS (
              SELECT 1
                FROM ranking_snapshots source_ranking
                JOIN category_definitions source_category ON source_category.id = source_ranking.category_id
               WHERE source_category.slug = f.value->>'categorySlug'
                 AND source_category.entity_type = 'club'
                 AND source_ranking.metadata->>'sourceSnapshotId' = f.source_snapshot_id
                 AND source_ranking.status <> 'superseded'
                 AND source_ranking.coverage_complete = TRUE
            )
       ), totals AS (
         SELECT fact.entity_id,
                SUM(fact.raw_value)::text AS titles,
                ARRAY_AGG(DISTINCT fact.source_snapshot_id ORDER BY fact.source_snapshot_id) AS source_snapshots,
                ARRAY_AGG(DISTINCT fact.id ORDER BY fact.id) AS source_fact_ids,
                ARRAY_AGG(DISTINCT fact.competition ORDER BY fact.competition) AS competitions
           FROM domestic_facts fact
           JOIN playable_clubs playable ON playable.entity_id = fact.entity_id
          WHERE fact.freshness_rank = 1
          GROUP BY fact.entity_id
       )
       SELECT totals.entity_id, entity.canonical_name, totals.titles,
              totals.source_snapshots, totals.source_fact_ids, totals.competitions
         FROM totals
         JOIN entities entity ON entity.id = totals.entity_id AND entity.entity_type = 'club'
        ORDER BY totals.titles::numeric DESC, entity.canonical_name, totals.entity_id`,
      [domesticCategorySlugs]
    );
    if (rows.rows.length === 0) throw new Error('No hay clubes jugables con hechos de títulos nacionales importados');
    const rankingId = await importRankingInput({
      categorySlug,
      source: {
        key: 'rango90-domestic-league-club-titles-derived',
        name: 'Agregado Rango90 de títulos de primera división doméstica',
        sourceType: 'reference',
        baseUrl: 'https://www.rango90.local/data/domestic-league-club-titles',
        rightsStatus: 'review_required'
      },
      dataVersion: `rango90-national-league-club-titles-${new Date().toISOString().slice(0, 10)}`,
      coverageComplete: false,
      allowPartialDraft: true,
      partialDraftReason: `El snapshot suma solo las seis ligas domésticas actualmente importadas (${domesticCategorySlugs.join(', ')}); contiene ${rows.rows.length} clubes y no afirma cobertura mundial de títulos nacionales ni derechos de redistribución.`,
      reviewed: false,
      entries: rows.rows.map((row, index) => ({
        entityId: row.entity_id,
        entityType: 'club' as const,
        name: row.canonical_name,
        rawValue: Number(row.titles),
        evidence: {
          sourceRank: index + 1,
          sourceSnapshotIds: row.source_snapshots,
          sourceFactIds: row.source_fact_ids,
          domesticCompetitions: row.competitions,
          definition: 'Suma provisional de títulos de primera división de las ligas domésticas importadas; se cuenta cada club y competición una vez y no se aplica padding.'
        }
      }))
    });
    console.log(JSON.stringify({
      source: 'rango90-domestic-league-club-titles-derived',
      categorySlug,
      rankingId,
      entries: rows.rows.length,
      requiredOpenUniverseEntries: MAX_GAME_RANKING_ENTRIES,
      coverageComplete: false,
      published: false,
      domesticCompetitions: domesticCategorySlugs,
      note: 'Snapshot draft parcial; requiere ampliar a ligas nacionales mundiales, resolver identidades y obtener derechos abiertos o permiso escrito antes de publicar.'
    }, null, 2));
  } else if (command === 'build-club-career-titles') {
    const categorySlug = 'club-career-titles';
    const rows = await pool.query<{
      entity_id: string;
      canonical_name: string;
      titles: string;
      source_snapshots: string[];
      source_fact_ids: string[];
      competitions: string[];
      seasons: string[];
    }>(
      `WITH RECURSIVE identity_chain AS (
         SELECT e.id AS source_entity_id,
                e.id AS canonical_entity_id,
                ARRAY[e.id]::text[] AS path,
                0 AS depth
           FROM entities e
          WHERE e.entity_type = 'player'
         UNION ALL
         SELECT chain.source_entity_id,
                link.canonical_entity_id,
                chain.path || link.canonical_entity_id,
                chain.depth + 1
           FROM identity_chain chain
           JOIN entity_identity_links link
             ON link.source_entity_id = chain.canonical_entity_id
          WHERE NOT link.canonical_entity_id = ANY(chain.path)
            AND chain.depth < 10
       ), resolved_identity AS (
         SELECT DISTINCT ON (source_entity_id)
                source_entity_id,
                canonical_entity_id
           FROM identity_chain
          ORDER BY source_entity_id, depth DESC
       ), imported_club_title_facts AS (
         SELECT f.id,
                COALESCE(resolved_identity.canonical_entity_id, f.subject_entity_id) AS entity_id,
                f.source_snapshot_id,
                f.value->>'competition' AS competition,
                f.value->>'season' AS season
           FROM fact_assertions f
           JOIN source_snapshots ss ON ss.id = f.source_snapshot_id
           JOIN entities subject ON subject.id = f.subject_entity_id AND subject.entity_type = 'player'
           LEFT JOIN resolved_identity ON resolved_identity.source_entity_id = f.subject_entity_id
          WHERE f.fact_type = ANY($1::text[])
            AND f.value->>'place' = 'Winner'
            AND NULLIF(BTRIM(f.value->>'competition'), '') IS NOT NULL
            AND NULLIF(BTRIM(f.value->>'season'), '') IS NOT NULL
            AND f.review_status IN ('pending', 'approved')
            AND ss.source_key = 'api-football'
            AND ss.metadata->>'importType' = 'api-football-player-trophies'
       ), distinct_title_facts AS (
         SELECT DISTINCT entity_id, competition, season
           FROM imported_club_title_facts
       ), totals AS (
         SELECT distinct_title_facts.entity_id,
                COUNT(*)::text AS titles,
                ARRAY(
                  SELECT DISTINCT facts.source_snapshot_id
                    FROM imported_club_title_facts facts
                   WHERE facts.entity_id = distinct_title_facts.entity_id
                   ORDER BY facts.source_snapshot_id
                ) AS source_snapshots,
                ARRAY(
                  SELECT DISTINCT facts.id
                    FROM imported_club_title_facts facts
                   WHERE facts.entity_id = distinct_title_facts.entity_id
                   ORDER BY facts.id
                ) AS source_fact_ids,
                ARRAY_AGG(DISTINCT distinct_title_facts.competition ORDER BY distinct_title_facts.competition) AS competitions,
                ARRAY_AGG(DISTINCT distinct_title_facts.season ORDER BY distinct_title_facts.season) AS seasons
           FROM distinct_title_facts
          GROUP BY distinct_title_facts.entity_id
       )
       SELECT totals.entity_id,
              e.canonical_name,
              totals.titles,
              totals.source_snapshots,
              totals.source_fact_ids,
              totals.competitions,
              totals.seasons
         FROM totals
         JOIN entities e ON e.id = totals.entity_id AND e.entity_type = 'player'
        ORDER BY totals.titles::numeric DESC, e.canonical_name, totals.entity_id
        LIMIT 200`,
      [[
        'player_trophy_record:premier-league',
        'player_trophy_record:la-liga',
        'player_trophy_record:bundesliga',
        'player_trophy_record:serie-a',
        'player_trophy_record:ligue-1',
        'player_trophy_record:primeira-liga'
      ]]
    );
    if (rows.rows.length === 0) throw new Error('No hay hechos de títulos de clubes importados y trazables para construir el ranking');
    const rankingId = await importRankingInput({
      categorySlug,
      source: {
        key: 'api-football',
        name: 'API-Football / API-Sports',
        sourceType: 'api',
        baseUrl: 'https://v3.football.api-sports.io/trophies',
        rightsStatus: 'review_required'
      },
      dataVersion: 'api-football-club-career-titles-' + new Date().toISOString().slice(0, 10),
      coverageComplete: false,
      allowPartialDraft: true,
      partialDraftReason: 'El snapshot agrega únicamente hechos de títulos de clubes ya importados de seis competiciones; no se añaden jugadores sin hechos ni se afirma que cubra todas las competiciones y temporadas de la carrera.',
      reviewed: false,
      entries: rows.rows.map((row, index) => ({
        entityId: row.entity_id,
        entityType: 'player' as const,
        name: row.canonical_name,
        rawValue: Number(row.titles),
        evidence: {
          sourceRank: index + 1,
          sourceSnapshotIds: row.source_snapshots,
          sourceFactIds: row.source_fact_ids,
          competitions: row.competitions,
          seasons: row.seasons,
          definition: 'Cuenta de hechos player_trophy_record:* con place=Winner, fuente API-Football /trophies y snapshot de importación trazable; cada combinación jugador canónico–competición–temporada cuenta una sola vez. Solo se incluyen las seis competiciones de clubes importadas y no se aplica padding.'
        }
      }))
    });
    console.log(JSON.stringify({ source: 'api-football', endpoint: '/trophies', categorySlug, rankingId, entries: rows.rows.length, positiveTitlePlayers: rows.rows.length, coverageComplete: false, note: 'Snapshot provisional de títulos de clubes observados; no contiene jugadores sin hechos ni ceros de relleno.' }, null, 2));
  } else if (command === 'import-premier-league') {
    const metric = argument('metric') as PremierLeagueMetric | undefined;
    if (!metric || !['goals', 'assists', 'clean_sheets', 'yellow_cards', 'red_cards'].includes(metric)) {
      throw new Error('Falta --metric: goals | assists | clean_sheets | yellow_cards | red_cards');
    }
    const rankingId = await importRankingInput(await fetchPremierLeagueRanking(metric));
    console.log(`Snapshot de Premier League creado: ${rankingId}`);
  } else if (command === 'import-premier-league-club-titles') {
    const rankingId = await importRankingInput(await fetchPremierLeagueClubTitles());
    console.log(JSON.stringify({ source: 'premier-league-honours-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-bundesliga-club-titles') {
    const rankingId = await importRankingInput(await fetchBundesligaClubTitles());
    console.log(JSON.stringify({ source: 'bundesliga-honours-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-dfl-supercup-club-titles') {
    const rankingId = await importRankingInput(await fetchDflSupercupTitles());
    console.log(JSON.stringify({ source: 'bundesliga-dfl-supercup-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-fa-cup-club-titles') {
    const rankingId = await importRankingInput(await fetchFaCupClubTitles());
    console.log(JSON.stringify({ source: 'fa-cup-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-dfb-pokal-club-titles') {
    const rankingId = await importRankingInput(await fetchDfbPokalClubTitles());
    console.log(JSON.stringify({ source: 'dfb-pokal-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-serie-a-club-titles') {
    const rankingId = await importRankingInput(await fetchSerieAClubTitles());
    console.log(JSON.stringify({ source: 'legaseriea-official-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-la-liga-club-titles') {
    const rankingId = await importRankingInput(await fetchLaLigaClubTitles());
    console.log(JSON.stringify({ source: 'laliga-official-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-coppa-italia-club-titles') {
    const rankingId = await importRankingInput(await fetchCoppaItaliaClubTitles());
    console.log(JSON.stringify({ source: 'legaseriea-coppa-italia-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-ligue-1-club-titles') {
    const rankingId = await importRankingInput(await fetchLigue1ClubTitles());
    console.log(JSON.stringify({ source: 'ligue1-official-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-trophee-champions-club-titles') {
    const rankingId = await importRankingInput(await fetchTropheeChampionsTitles());
    console.log(JSON.stringify({ source: 'ligue1-trophee-champions-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-taca-portugal-club-titles') {
    const rankingId = await importRankingInput(await fetchTacaPortugalClubTitles());
    console.log(JSON.stringify({ source: 'fpf-taca-portugal-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-supercopa-espana-club-titles') {
    const rankingId = await importRankingInput(await fetchSupercopaEspanaTitles());
    console.log(JSON.stringify({ source: 'rfef-supercopa-espana-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-coupe-de-france-club-titles') {
    const rankingId = await importRankingInput(await fetchCoupeFranceClubTitles());
    console.log(JSON.stringify({ source: 'fff-coupe-de-france-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-primeira-liga-club-titles') {
    const rankingId = await importRankingInput(await fetchPrimeiraLigaClubTitles());
    console.log(JSON.stringify({ source: 'fpf-primeira-liga-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-supertaca-portugal-club-titles') {
    const rankingId = await importRankingInput(await fetchSupertacaPortugalClubTitles());
    console.log(JSON.stringify({ source: 'fpf-supertaca-portugal-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-community-shield-club-titles') {
    const rankingId = await importRankingInput(await fetchCommunityShieldClubTitles());
    console.log(JSON.stringify({ source: 'rsssf-fa-community-shield', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-supercoppa-italiana-club-titles') {
    const rankingId = await importRankingInput(await fetchSupercoppaItalianaTitles());
    console.log(JSON.stringify({ source: 'legaseriea-supercoppa-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-copa-del-rey-club-titles') {
    const rankingId = await importRankingInput(await fetchWikipediaCopaDelReyClubTitles());
    console.log(JSON.stringify({ source: 'wikipedia-es-copa-del-rey-palmares', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-copa-libertadores-club-titles') {
    const rankingId = await importRankingInput(await fetchWikipediaCopaLibertadoresClubTitles());
    console.log(JSON.stringify({ source: 'wikipedia-es-copa-libertadores-records', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-copa-libertadores-goals') {
    const rankingId = await importRankingInput(await fetchTransfermarktCopaLibertadoresGoals());
    console.log(JSON.stringify({ source: 'transfermarkt-copa-libertadores-historical-goals', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-copa-sudamericana-goals') {
    const rankingId = await importRankingInput(await fetchTransfermarktCopaSudamericanaGoals());
    console.log(JSON.stringify({ source: 'transfermarkt-copa-sudamericana-historical-goals', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-uefa-cup-europa-league-goals') {
    const rankingId = await importRankingInput(await fetchTransfermarktUefaEuropaLeagueGoals());
    console.log(JSON.stringify({ source: 'transfermarkt-uefa-cup-europa-league-historical-goals', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-european-cup-champions-league-goals') {
    const rankingId = await importRankingInput(await fetchTransfermarktEuropeanCupChampionsLeagueGoals());
    console.log(JSON.stringify({ source: 'transfermarkt-european-cup-champions-league-historical-goals', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-copa-sudamericana-club-titles') {
    const rankingId = await importRankingInput(await fetchWikipediaCopaSudamericanaClubTitles());
    console.log(JSON.stringify({ source: 'wikipedia-es-copa-sudamericana-records', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-recopa-sudamericana-club-titles') {
    const rankingId = await importRankingInput(await fetchWikipediaRecopaSudamericanaClubTitles());
    console.log(JSON.stringify({ source: 'wikipedia-es-recopa-sudamericana-records', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'refresh-premier-league') {
    const metrics: PremierLeagueMetric[] = ['goals', 'assists', 'clean_sheets', 'yellow_cards', 'red_cards'];
    const snapshots: Array<{ metric: PremierLeagueMetric; rankingId: string }> = [];
    for (const metric of metrics) {
      snapshots.push({ metric, rankingId: await importRankingInput(await fetchPremierLeagueRanking(metric)) });
    }
    console.log(JSON.stringify({ source: 'premier-league-official', snapshots, published: false }, null, 2));
  } else if (command === 'import-uefa-champions-league') {
    const requestedMetric = argument('metric') as UefaPlayerRankingMetric | undefined;
    const metrics: UefaPlayerRankingMetric[] = requestedMetric ? [requestedMetric] : ['goals', 'assists', 'red_cards'];
    if (metrics.some((metric) => !['goals', 'assists', 'red_cards'].includes(metric))) {
      throw new Error('El metric debe ser goals, assists o red_cards');
    }
    const snapshots = [] as Array<{ metric: UefaPlayerRankingMetric; rankingId: string }>;
    for (const metric of metrics) snapshots.push({ metric, rankingId: await importRankingInput(await fetchUefaChampionsLeagueRanking(metric)) });
    console.log(JSON.stringify({ source: 'uefa-champions-league-official', snapshots, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-uefa-conference-league') {
    const requestedMetric = argument('metric') as UefaPlayerRankingMetric | undefined;
    const metrics: UefaPlayerRankingMetric[] = requestedMetric ? [requestedMetric] : ['goals', 'assists', 'red_cards'];
    if (metrics.some((metric) => !['goals', 'assists', 'red_cards'].includes(metric))) {
      throw new Error('El metric debe ser goals, assists o red_cards');
    }
    const snapshots = [] as Array<{ metric: UefaPlayerRankingMetric; rankingId: string }>;
    for (const metric of metrics) snapshots.push({ metric, rankingId: await importRankingInput(await fetchUefaConferenceLeagueRanking(metric)) });
    console.log(JSON.stringify({ source: 'uefa-conference-league-official', snapshots, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-uefa-europa-league') {
    const requestedMetric = argument('metric') as UefaPlayerRankingMetric | undefined;
    const metrics: UefaPlayerRankingMetric[] = requestedMetric ? [requestedMetric] : ['goals', 'assists', 'red_cards'];
    if (metrics.some((metric) => !['goals', 'assists', 'red_cards'].includes(metric))) {
      throw new Error('El metric debe ser goals, assists o red_cards');
    }
    const snapshots = [] as Array<{ metric: UefaPlayerRankingMetric; rankingId: string }>;
    for (const metric of metrics) snapshots.push({ metric, rankingId: await importRankingInput(await fetchUefaEuropaLeagueRanking(metric)) });
    console.log(JSON.stringify({ source: 'uefa-europa-league-official', snapshots, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-uefa-euro') {
    const requestedMetric = argument('metric') as UefaPlayerRankingMetric | undefined;
    const metrics: UefaPlayerRankingMetric[] = requestedMetric ? [requestedMetric] : ['goals', 'assists', 'red_cards'];
    if (metrics.some((metric) => !['goals', 'assists', 'red_cards'].includes(metric))) {
      throw new Error('El metric debe ser goals, assists o red_cards');
    }
    const snapshots = [] as Array<{ metric: UefaPlayerRankingMetric; rankingId: string }>;
    for (const metric of metrics) snapshots.push({ metric, rankingId: await importRankingInput(await fetchUefaEuroRanking(metric)) });
    console.log(JSON.stringify({ source: 'uefa-euro-official', snapshots, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-uefa-euro-historical') {
    const seasonArgument = argument('season');
    const metricArgument = argument('metric') as UefaEuroHistoricalMetric | undefined;
    const seasons: UefaEuroHistoricalSeason[] = seasonArgument
      ? [Number(seasonArgument) as UefaEuroHistoricalSeason]
      : [...UEFA_EURO_HISTORICAL_SEASONS];
    if (seasons.some((season) => !UEFA_EURO_HISTORICAL_SEASONS.includes(season))) {
      throw new Error(`El season debe ser uno de: ${UEFA_EURO_HISTORICAL_SEASONS.join(', ')}`);
    }
    const metrics: UefaEuroHistoricalMetric[] = metricArgument ? [metricArgument] : ['goals', 'assists'];
    if (metrics.some((metric) => !['goals', 'assists'].includes(metric))) {
      throw new Error('El metric debe ser goals o assists');
    }
    const inputs = seasonArgument || metricArgument
      ? await Promise.all(seasons.flatMap((season) => metrics.map((metric) => fetchUefaEuroHistoricalRanking(season, metric))))
      : await fetchAllUefaEuroHistoricalRankings(seasons, metrics);
    const snapshots = [] as Array<{ season: number; metric: UefaEuroHistoricalMetric; entries: number; rankingId: string; coverageComplete: boolean }>;
    for (const input of inputs) {
      const season = Number(input.entries[0]?.evidence?.season ?? input.dataVersion.match(/uefa-euro-(\d{4})-/)?.[1]);
      const metric = input.entries[0]?.evidence?.metric as UefaEuroHistoricalMetric | undefined;
      snapshots.push({ season, metric: metric ?? 'goals', entries: input.entries.length, rankingId: await importRankingInput(input), coverageComplete: input.coverageComplete });
    }
    console.log(JSON.stringify({ source: 'uefa-euro-official', snapshots, published: false, note: 'Solo filas reales devueltas por UEFA; no se aplica padding.' }, null, 2));
  } else if (command === 'import-uefa-euro-titles') {
    const rankingId = await importRankingInput(await fetchUefaEuroNationalTeamTitles());
    console.log(JSON.stringify({ source: 'uefa-euro-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-fifa-world-cup-titles') {
    const rankingId = await importRankingInput(fetchFifaWorldCupNationalTeamTitles());
    console.log(JSON.stringify({ source: 'fifa-world-cup-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-copa-america-national-team-titles') {
    const rankingId = await importRankingInput(fetchCopaAmericaNationalTeamTitles());
    console.log(JSON.stringify({ source: 'conmebol-copa-america-history', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-nations-league-national-team-titles') {
    const rankingId = await importRankingInput(fetchUefaNationsLeagueNationalTeamTitles());
    console.log(JSON.stringify({ source: 'uefa-nations-league-roll-of-honour', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-club-world-cup-club-titles') {
    const rankingId = await importRankingInput(fetchFifaClubWorldCupClubTitles());
    console.log(JSON.stringify({ source: 'fifa-club-world-cup-archive', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-concacaf-champions-cup-club-titles') {
    const rankingId = await importRankingInput(await readRankingInput(resolve('storage/rankings/concacaf-champions-cup-club-titles.json')));
    console.log(JSON.stringify({ source: 'concacaf-champions-cup-record-holders', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-caf-champions-league-club-titles') {
    const rankingId = await importRankingInput(await readRankingInput(resolve('storage/rankings/caf-champions-league-club-titles.json')));
    console.log(JSON.stringify({ source: 'caf-champions-league-past-winners', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-ofc-champions-league-club-titles') {
    const rankingId = await importRankingInput(await readRankingInput(resolve('storage/rankings/ofc-champions-league-club-titles.json')));
    console.log(JSON.stringify({ source: 'ofc-champions-league-history', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-afc-champions-league-club-titles') {
    const rankingId = await importRankingInput(await readRankingInput(resolve('storage/rankings/afc-champions-league-club-titles.json')));
    console.log(JSON.stringify({ source: 'afc-champions-league-official-roll-of-honour', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-uefa-club-titles') {
    const requestedCompetition = argument('competition') as UefaWinnersCompetition | undefined;
    const competitions: UefaWinnersCompetition[] = requestedCompetition ? [requestedCompetition] : ['champions', 'europa', 'conference'];
    if (competitions.some((competition) => !['champions', 'europa', 'conference'].includes(competition))) {
      throw new Error('El competition debe ser champions, europa o conference');
    }
    const snapshots = [] as Array<{ competition: UefaWinnersCompetition; rankingId: string }>;
    for (const competition of competitions) snapshots.push({ competition, rankingId: await importRankingInput(await fetchUefaClubTitles(competition)) });
    console.log(JSON.stringify({ source: 'uefa-official-winners', snapshots, published: false }, null, 2));
  } else if (command === 'import-ballon-dor') {
    const rankingId = await importRankingInput(await fetchBallonDorRanking());
    console.log(JSON.stringify({ source: 'france-football-official', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-national-team-goals') {
    const input = await fetchRsssfInternationalGoals();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({
      source: input.source.key,
      rankingId,
      entries: input.entries.length,
      sourceAsOf: input.entries[0]?.evidence?.sourceAsOf ?? null,
      sourceRowsParsed: input.entries[0]?.evidence?.sourceRowsParsed ?? null,
      published: false,
      coverageComplete: input.coverageComplete
    }, null, 2));
  } else if (command === 'import-national-team-official-assists') {
    const allowPartialDraft = args.includes('--allow-partial');
    const input = await fetchNationalTeamOfficialAssists({ allowPartialDraft });
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete, allowPartialDraft: input.allowPartialDraft ?? false }, null, 2));
  } else if (command === 'import-world-cup-goals') {
    const rankingId = await importRankingInput(await fetchRsssfWorldCupGoals());
    console.log(JSON.stringify({ source: 'rsssf-world-cup-records', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-transfermarkt-world-cup-goals') {
    const rankingId = await importRankingInput(await fetchTransfermarktWorldCupGoals());
    console.log(JSON.stringify({ source: 'transfermarkt-world-cup-historical-goals', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-transfermarkt-club-world-cup-goals') {
    const rankingId = await importRankingInput(await fetchTransfermarktClubWorldCupGoals());
    console.log(JSON.stringify({ source: 'transfermarkt-fifa-club-world-cup-historical-goals', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-transfermarkt-copa-america-goals') {
    const rankingId = await importRankingInput(await fetchTransfermarktCopaAmericaGoals());
    console.log(JSON.stringify({ source: 'transfermarkt-copa-america-historical-goals', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-transfermarkt-nations-league-goals') {
    const rankingId = await importRankingInput(await fetchTransfermarktNationsLeagueGoals());
    console.log(JSON.stringify({ source: 'transfermarkt-nations-league-historical-goals', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-world-cup-assists') {
    const rankingId = await importRankingInput(await fetchStatbunkerWorldCupAssists());
    console.log(JSON.stringify({ source: 'statbunker-world-cup', rankingId, published: false, coverageComplete: false }, null, 2));
  } else if (command === 'import-world-cup-cards') {
    const metric = argument('metric') as StatbunkerWorldCupCardMetric | undefined;
    if (!metric || !['yellow_cards', 'red_cards'].includes(metric)) {
      throw new Error('Falta --metric: yellow_cards | red_cards');
    }
    const input = await fetchStatbunkerWorldCupCards(metric);
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: 'statbunker-world-cup-cards', metric, rankingId, entries: input.entries.length, published: false, coverageComplete: false }, null, 2));
  } else if (command === 'import-statbunker-uefa-europa') {
    const competition = (argument('competition') ?? 'europa') as StatbunkerUefaEuropaCompetition;
    const metric = argument('metric') as StatbunkerUefaEuropaMetric | undefined;
    if (!['champions_league', 'europa', 'euro', 'world_cup'].includes(competition)) {
      throw new Error('El competition debe ser champions_league | europa | euro | world_cup');
    }
    if (!metric || !['goals', 'assists', 'yellow_cards', 'red_cards'].includes(metric)) {
      throw new Error('Falta --metric: goals | assists | yellow_cards | red_cards');
    }
    const input = await fetchStatbunkerCompetitionRanking(competition, metric);
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition, metric, rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-conference-assists') {
    const input = await fetchStatbunkerConferenceAssists();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'conference', metric: 'assists', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-euro-yellow-cards') {
    const input = await fetchStatbunkerEuroYellowCards();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'euro', metric: 'yellow_cards', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-conference-goals') {
    const input = await fetchStatbunkerConferenceGoals();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'conference', metric: 'goals', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-conference-yellow-cards') {
    const input = await fetchStatbunkerConferenceYellowCards();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'conference', metric: 'yellow_cards', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-world-cup-clean-sheets') {
    const input = await fetchStatbunkerWorldCupCleanSheets();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'world_cup', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-club-world-cup-clean-sheets') {
    const input = await fetchStatbunkerClubWorldCupCleanSheets();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'club_world_cup', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-copa-libertadores-clean-sheets') {
    const input = await fetchStatbunkerCopaLibertadoresCleanSheets();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'copa_libertadores', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-euro-clean-sheets') {
    const input = await fetchStatbunkerEuroCleanSheets();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'euro', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-nations-league-clean-sheets') {
    const input = await fetchStatbunkerNationsLeagueCleanSheets();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'nations_league', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-copa-america-clean-sheets') {
    const input = await fetchStatbunkerCopaAmericaCleanSheets();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'copa_america', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-conference-clean-sheets') {
    const input = await fetchStatbunkerConferenceCleanSheets();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'conference', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-statbunker-europa-clean-sheets') {
    const input = await fetchStatbunkerEuropaCleanSheets();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'europa', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete }, null, 2));
  } else if (command === 'import-copa-sudamericana-clean-sheets') {
    const startYear = argument('start-year') ? Number(argument('start-year')) : undefined;
    const endYear = argument('end-year') ? Number(argument('end-year')) : undefined;
    const input = await fetchCopaSudamericanaCleanSheets({ startYear, endYear });
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'copa_sudamericana', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete, allowPartialDraft: input.allowPartialDraft ?? false }, null, 2));
  } else if (command === 'import-api-football-copa-sudamericana-clean-sheets') {
    const startYear = argument('start-year') ? Number(argument('start-year')) : undefined;
    const endYear = argument('end-year') ? Number(argument('end-year')) : undefined;
    const input = await fetchApiFootballCopaSudamericanaCleanSheets({ startYear, endYear });
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, competition: 'copa_sudamericana', metric: 'clean_sheets', rankingId, entries: input.entries.length, published: false, coverageComplete: input.coverageComplete, allowPartialDraft: input.allowPartialDraft ?? false }, null, 2));
  } else if (command === 'import-serie-a-goals') {
    const rankingId = await importRankingInput(await fetchWikipediaSerieAGoals());
    console.log(JSON.stringify({ source: 'wikipedia-it-serie-a-records', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-bundesliga-goals') {
    const rankingId = await importRankingInput(await fetchDfbBundesligaGoals());
    console.log(JSON.stringify({ source: 'dfb-bundesliga-record-scorers', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-la-liga-goals') {
    const rankingId = await importRankingInput(await fetchBdfutbolLaLigaGoals());
    console.log(JSON.stringify({ source: 'bdfutbol-la-liga-record-scorers', rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-la-liga-assists') {
    const input = await fetchTransfermarktLaLigaAssists();
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, rankingId, published: false, coverageComplete: input.coverageComplete, allowPartialDraft: input.allowPartialDraft ?? false, entries: input.entries.length }, null, 2));
  } else if (command === 'import-bundesliga-assists' || command === 'import-serie-a-assists' || command === 'import-ligue-1-assists' || command === 'import-primeira-liga-assists') {
    const config = command === 'import-bundesliga-assists'
      ? transfermarktHistoricalLeagueAssistsConfigs.bundesliga
      : command === 'import-serie-a-assists'
        ? transfermarktHistoricalLeagueAssistsConfigs.serieA
        : command === 'import-ligue-1-assists'
          ? transfermarktHistoricalLeagueAssistsConfigs.ligue1
          : transfermarktHistoricalLeagueAssistsConfigs.primeiraLiga;
    const input = await fetchTransfermarktHistoricalLeagueAssists(config);
    const rankingId = await importRankingInput(input);
    console.log(JSON.stringify({ source: input.source.key, rankingId, published: false, coverageComplete: input.coverageComplete, allowPartialDraft: input.allowPartialDraft ?? false, entries: input.entries.length }, null, 2));
  } else if (command === 'import-la-liga-ranking') {
    const metric = argument('metric') as BdfutbolLaLigaRankingMetric | undefined;
    if (!metric || !['clean_sheets', 'yellow_cards', 'red_cards'].includes(metric)) {
      throw new Error('Falta --metric: clean_sheets | yellow_cards | red_cards');
    }
    const rankingId = await importRankingInput(await fetchBdfutbolLaLigaRanking(metric));
    console.log(JSON.stringify({ source: 'bdfutbol-la-liga-records', metric, rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-bdfutbol-ranking') {
    const league = argument('league') as BdfutbolLeague | undefined;
    const metric = argument('metric') as BdfutbolLaLigaRankingMetric | undefined;
    if (!league || !['la-liga', 'premier-league', 'bundesliga', 'serie-a', 'ligue-1', 'primeira-liga'].includes(league)) {
      throw new Error('Falta --league: la-liga | premier-league | bundesliga | serie-a | ligue-1 | primeira-liga');
    }
    if (!metric || !['goals', 'clean_sheets', 'yellow_cards', 'red_cards'].includes(metric)) {
      throw new Error('Falta --metric: goals | clean_sheets | yellow_cards | red_cards');
    }
    const rankingId = await importRankingInput(await fetchBdfutbolLaLigaRanking(metric, league));
    console.log(JSON.stringify({ source: `bdfutbol-${league}-records`, league, metric, rankingId, published: false, coverageComplete: true }, null, 2));
  } else if (command === 'import-rsssf-clean-sheets') {
    const dataset = await fetchRsssfCleanSheets();
    // Retrieval time is metadata, not source content. Keeping it out of the
    // content hash makes repeated imports idempotent instead of creating a
    // new snapshot and a new set of assertions on every run.
    const content = {
      sourceUrl: dataset.sourceUrl,
      sourceUpdatedAt: dataset.sourceUpdatedAt,
      entries: dataset.entries
    };
    const rawContent = JSON.stringify(content);
    const hash = createHash('sha256').update(rawContent).digest('hex');
    const snapshotId = `src_${hash.slice(0, 24)}`;
    const snapshotPath = resolve(config.snapshotRoot, `${snapshotId}.json`);
    await mkdir(resolve(config.snapshotRoot), { recursive: true });
    try {
      await writeFile(snapshotPath, rawContent, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const client = await pool.connect();
    let imported = 0;
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO sources (key, name, source_type, base_url, usage_notes, rights_status)
         VALUES ('rsssf-goalkeeper-cleansheets', 'RSSSF goalkeeper clean sheets', 'reference', $1, $2, 'review_required')
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, base_url = EXCLUDED.base_url, usage_notes = EXCLUDED.usage_notes`,
        [dataset.sourceUrl, 'Lista preliminar; se conserva como evidencia para el índice histórico de porteros, no como un top 100 completo.']
      );
      await client.query(
        `INSERT INTO source_snapshots (id, source_key, retrieved_at, content_type, storage_uri, content_sha256, metadata)
         VALUES ($1, 'rsssf-goalkeeper-cleansheets', $2, 'application/json', $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET storage_uri = EXCLUDED.storage_uri, metadata = source_snapshots.metadata || EXCLUDED.metadata`,
        [snapshotId, dataset.retrievedAt, `storage/source-snapshots/${snapshotId}.json`, hash, JSON.stringify({
          importType: 'rsssf-goalkeeper-clean-sheets',
          sourceUrl: dataset.sourceUrl,
          sourceUpdatedAt: dataset.sourceUpdatedAt,
          entries: dataset.entries.length,
          coverageComplete: false,
          reviewStatus: 'pending'
        })]
      );
      await client.query(
        `INSERT INTO import_runs (id, source_snapshot_id, status, metadata, finished_at)
         VALUES ($1, $2, 'validated', $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [`run_${hash.slice(0, 24)}`, snapshotId, JSON.stringify({ entries: dataset.entries.length, coverageComplete: false })]
      );

      for (const row of dataset.entries) {
        const sourceEntityId = `rsssf:goalkeeper:player:${createHash('sha256').update(row.name.toLocaleLowerCase('en-US')).digest('hex').slice(0, 24)}`;
        // Prefer an existing provider identifier on re-import. Name-only
        // matching can be ambiguous after historical identity splits even
        // when the external identifier is already linked unambiguously.
        const existingExternal = await client.query<{ entity_id: string }>(
          `SELECT entity_id FROM entity_external_ids
           WHERE source_key = 'rsssf-goalkeeper-cleansheets'
             AND entity_type = 'player' AND external_id = $1`,
          [row.externalId]
        );
        const canonicalEntityId = existingExternal.rows[0]?.entity_id
          ?? await findUniqueCanonicalEntity(client, 'player', 'rsssf-goalkeeper-cleansheets:', row.name);
        const entityId = canonicalEntityId ?? sourceEntityId;
        await client.query(
          `INSERT INTO entities (id, entity_type, canonical_name, is_goalkeeper, metadata)
           VALUES ($1, 'player', $2, TRUE, $3)
           ON CONFLICT (id) DO UPDATE SET is_goalkeeper = TRUE, metadata = entities.metadata || EXCLUDED.metadata`,
          [entityId, row.name, JSON.stringify({ sourceKey: 'rsssf-goalkeeper-cleansheets', sourceSnapshotId: snapshotId, sourceRank: row.sourceRank })]
        );
        await ensureExternalEntityLink(client, 'rsssf-goalkeeper-cleansheets', 'player', row.externalId, entityId, { sourceSnapshotId: snapshotId, sourceRank: row.sourceRank });
        const factId = `fact_${createHash('sha256').update(JSON.stringify({ sourceSnapshotId: snapshotId, entityId, factType: 'historical_goalkeeper_clean_sheets' })).digest('hex').slice(0, 24)}`;
        await client.query(
          `INSERT INTO fact_assertions (id, fact_type, subject_entity_id, value, source_snapshot_id, review_status, metadata)
           VALUES ($1, 'historical_goalkeeper_clean_sheets', $2, $3, $4, 'pending', $5)
           ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, metadata = fact_assertions.metadata || EXCLUDED.metadata`,
          [factId, entityId, JSON.stringify({ sourceRank: row.sourceRank, cleanSheetsProfessional: row.cleanSheetsProfessional, incompleteGames: row.incompleteGames, cleanSheetsAll: row.cleanSheetsAll, gamesAll: row.gamesAll, bestSeason: row.bestSeason }), snapshotId, JSON.stringify({ sourceUrl: dataset.sourceUrl, sourceUpdatedAt: dataset.sourceUpdatedAt })]
        );
        imported += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(JSON.stringify({ source: 'rsssf-goalkeeper-cleansheets', snapshotId, entries: imported, coverageComplete: false, published: false }, null, 2));
  } else if (command === 'import-iffhs-goalkeeper-ranking') {
    const dataset = fetchIffhsGoalkeeperRanking();
    const content = {
      sourceUrl: dataset.sourceUrl,
      sourcePublishedAt: dataset.sourcePublishedAt,
      entries: dataset.entries
    };
    const rawContent = JSON.stringify(content);
    const hash = createHash('sha256').update(rawContent).digest('hex');
    const snapshotId = `src_${hash.slice(0, 24)}`;
    const snapshotPath = resolve(config.snapshotRoot, `${snapshotId}.json`);
    await mkdir(resolve(config.snapshotRoot), { recursive: true });
    try {
      await writeFile(snapshotPath, rawContent, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const client = await pool.connect();
    let imported = 0;
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO sources (key, name, source_type, base_url, usage_notes, rights_status)
         VALUES ('iffhs-all-time-goalkeepers', 'IFFHS all-time world best goalkeeper ranking 1987-2022', 'reference', $1, $2, 'review_required')
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, base_url = EXCLUDED.base_url, usage_notes = EXCLUDED.usage_notes`,
        [dataset.sourceUrl, 'Historical source table. Points and displayed ranks are retained as evidence for the goalkeeper index; not a claim of complete career statistics.']
      );
      await client.query(
        `INSERT INTO source_snapshots (id, source_key, retrieved_at, source_published_at, content_type, storage_uri, content_sha256, metadata)
         VALUES ($1, 'iffhs-all-time-goalkeepers', $2, $3, 'application/json', $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET storage_uri = EXCLUDED.storage_uri, metadata = source_snapshots.metadata || EXCLUDED.metadata`,
        [snapshotId, dataset.retrievedAt, dataset.sourcePublishedAt, `storage/source-snapshots/${snapshotId}.json`, hash, JSON.stringify({
          importType: 'iffhs-all-time-goalkeeper-ranking',
          sourceUrl: dataset.sourceUrl,
          entries: dataset.entries.length,
          coverageComplete: false,
          reviewStatus: 'pending'
        })]
      );
      await client.query(
        `INSERT INTO import_runs (id, source_snapshot_id, status, metadata, finished_at)
         VALUES ($1, $2, 'validated', $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [`run_${hash.slice(0, 24)}`, snapshotId, JSON.stringify({ entries: dataset.entries.length, coverageComplete: false })]
      );
      for (const row of dataset.entries) {
        const sourceEntityId = `iffhs:goalkeeper:player:${createHash('sha256').update(row.name.toLocaleLowerCase('en-US')).digest('hex').slice(0, 24)}`;
        // Re-imports must reuse an existing external identifier before doing
        // name matching.  A prior identity consolidation may have attached
        // this IFFHS identifier to an RSSSF/provider entity; name matching
        // alone would otherwise create a second source entity and make the
        // import fail on its own external-ID uniqueness invariant.
        const existingExternal = await client.query<{ entity_id: string }>(
          `SELECT entity_id FROM entity_external_ids
           WHERE source_key = 'iffhs-all-time-goalkeepers'
             AND entity_type = 'player' AND external_id = $1`,
          [row.externalId]
        );
        const canonicalEntityId = existingExternal.rows[0]?.entity_id
          ?? await findUniqueCanonicalEntity(client, 'player', 'iffhs:goalkeeper:player:', row.name);
        const entityId = canonicalEntityId ?? sourceEntityId;
        await client.query(
          `INSERT INTO entities (id, entity_type, canonical_name, is_goalkeeper, metadata)
           VALUES ($1, 'player', $2, TRUE, $3)
           ON CONFLICT (id) DO UPDATE SET is_goalkeeper = TRUE, metadata = entities.metadata || EXCLUDED.metadata`,
          [entityId, row.name, JSON.stringify({ sourceKey: 'iffhs-all-time-goalkeepers', sourceSnapshotId: snapshotId, sourceRank: row.sourceRank, displayedRank: row.displayedRank, country: row.country })]
        );
        await ensureExternalEntityLink(client, 'iffhs-all-time-goalkeepers', 'player', row.externalId, entityId, { sourceSnapshotId: snapshotId, sourceRank: row.sourceRank });
        const factId = `fact_${createHash('sha256').update(JSON.stringify({ sourceSnapshotId: snapshotId, entityId, factType: 'historical_goalkeeper_iffhs_points' })).digest('hex').slice(0, 24)}`;
        await client.query(
          `INSERT INTO fact_assertions (id, fact_type, subject_entity_id, value, source_snapshot_id, review_status, metadata)
           VALUES ($1, 'historical_goalkeeper_iffhs_points', $2, $3, $4, 'pending', $5)
           ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, metadata = fact_assertions.metadata || EXCLUDED.metadata`,
          [factId, entityId, JSON.stringify({ sourceRank: row.sourceRank, displayedRank: row.displayedRank, points: row.points, country: row.country }), snapshotId, JSON.stringify({ sourceUrl: dataset.sourceUrl, sourcePublishedAt: dataset.sourcePublishedAt })]
        );
        imported += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(JSON.stringify({ source: 'iffhs-all-time-goalkeepers', snapshotId, entries: imported, coverageComplete: false, published: false }, null, 2));
  } else if (command === 'consolidate-iffhs-goalkeeper-identities') {
    // The IFFHS table uses short names while the statistical providers often
    // use full names or diacritics. Only these explicit, source-reviewed
    // mappings are applied; no fuzzy matching is allowed for identities.
    const canonicalNameByIffhsName: Record<string, string> = {
      'Andoni Zubizarreta': 'Andoni Zubizarreta',
      'Andreas Köpke': 'Andreas Köpke',
      'Andre ter Stegen': 'Marc-André ter Stegen',
      'Bodo Illgner': 'Bodo Illgner',
      'Claudio Bravo': 'Claudio Bravo',
      'Claudio Taffarel': 'Cláudio André Mergen Taffarel',
      'David de Gea': 'David de Gea',
      'David Seaman': 'David Seaman',
      'Edwin van der Sar': 'Edwin van der Sar',
      'Francisco Guillermo Ochoa': 'Francisco Guillermo Ochoa Magaña',
      'Hugo Lloris': 'Hugo Lloris',
      'Iker Casillas': 'Iker Casillas Fernández',
      'Jan Oblak': 'Jan Oblak',
      'Jean Marie Pfaff': 'Jean-Marie Pfaff',
      'Jens Lehmann': 'Jens Lehmann',
      'Jose Luis Felix Chilavert': 'José Luis Félix Chilavert',
      'Jose Manuel Reina': 'José Manuel Reina Páez',
      'Jose Santiago Canizares': 'José Santiago Cañizares Ruiz',
      'Julio Cesar Soares': 'Júlio César Soares de Espindola',
      'Manuel Neuer': 'Manuel Neuer',
      'Nelson de Jesus e Silva Dida': 'Nelson de Jesus da Silva',
      'Oscar Eduardo Cordoba': 'Óscar Eduardo Córdoba',
      'Peter Shilton': 'Peter Shilton',
      'Rinat Dasaev': 'Rinat Dassayev',
      'Thibaut Courtois': 'Thibaut Courtois',
      'Walter Zenga': 'Walter Zenga'
    };
    const latestCleanSheet = await pool.query<{ id: string }>(
      `SELECT rs.id
         FROM ranking_snapshots rs
         JOIN category_definitions c ON c.id = rs.category_id
        WHERE c.slug = 'goalkeeper-career-clean-sheets' AND rs.status <> 'superseded'
        ORDER BY rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC LIMIT 1`
    );
    const client = await pool.connect();
    let linked = 0;
    let skipped = 0;
    try {
      await client.query('BEGIN');
    for (const [sourceName, targetName] of Object.entries(canonicalNameByIffhsName)) {
        const externalId = `iffhs-goalkeeper:${createHash('sha256').update(sourceName.toLocaleLowerCase('en-US')).digest('hex').slice(0, 24)}`;
        const sourceResult = await client.query<{ entity_id: string }>(
          `SELECT entity_id FROM entity_external_ids
            WHERE source_key = 'iffhs-all-time-goalkeepers' AND entity_type = 'player' AND external_id = $1`,
          [externalId]
        );
        const sourceEntityId = sourceResult.rows[0]?.entity_id;
        if (!sourceEntityId) {
          skipped += 1;
          continue;
        }
        const targetResult = await client.query<{ id: string }>(
          `SELECT e.id
             FROM entities e
             WHERE e.entity_type = 'player' AND e.is_goalkeeper = TRUE
               AND e.canonical_name = $1 AND e.id NOT LIKE 'iffhs:%'
             ORDER BY CASE WHEN EXISTS (
               SELECT 1 FROM ranking_entries re
               WHERE re.snapshot_id = $2 AND re.entity_id = e.id
             ) THEN 0 WHEN e.id LIKE 'rsssf:%' THEN 1 WHEN e.id LIKE 'bdfutbol:%' THEN 2 ELSE 3 END, e.id
             LIMIT 1`,
          [targetName, latestCleanSheet.rows[0]?.id ?? '']
        );
        const targetEntityId = targetResult.rows[0]?.id;
        if (!targetEntityId || sourceEntityId === targetEntityId) {
          skipped += 1;
          continue;
        }
        const resolvedSourceEntityId = await resolveCanonicalEntityId(client, sourceEntityId);
        const resolvedTargetEntityId = await resolveCanonicalEntityId(client, targetEntityId);
        if (resolvedSourceEntityId === resolvedTargetEntityId) {
          skipped += 1;
          continue;
        }
        await recordIdentityLink(client, sourceEntityId, targetEntityId, 'iffhs-all-time-goalkeepers', 'Explicit reviewed mapping from IFFHS short name to provider canonical identity');
        linked += 1;
      }
      const rsssfCanonicalNameByName: Record<string, string> = {
        'Fábio': 'Fábio',
        'Gianluigi Buffon': 'Gianluigi Buffon',
        'Peter Shilton': 'Peter Shilton',
        'Raymond Clemence': 'Raymond Clemence',
        'Essam Al-Hadary': 'Essam Al-Hadary',
        'Dino Zoff': 'Dino Zoff',
        'Iker Casillas': 'Iker Casillas Fernández',
        'Edwin van der Sar': 'Edwin van der Sar',
        'Manuel Neuer': 'Manuel Neuer',
        'Rogério Ceni': 'Rogério Ceni',
        'David Seaman': 'David Seaman',
        'Petr Čech': 'Petr Čech',
        'Peter Schmeichel': 'Peter Schmeichel',
        'Andoni Zubizarreta': 'Andoni Zubizarreta',
        'Weverton': 'Weverton',
        'Charles Shaw': 'Charles Shaw',
        'Jose Reina': 'José Manuel Reina Páez',
        'Dida': 'Dida',
        'Igor Akinfeev': 'Igor Akinfeev',
        'James Leighton': 'James Leighton'
      };
      for (const [sourceName, targetName] of Object.entries(rsssfCanonicalNameByName)) {
        const externalId = `clean-sheets:${createHash('sha256').update(sourceName.toLocaleLowerCase('en-US')).digest('hex').slice(0, 24)}`;
        const sourceResult = await client.query<{ entity_id: string }>(
          `SELECT entity_id FROM entity_external_ids
            WHERE source_key = 'rsssf-goalkeeper-cleansheets' AND entity_type = 'player' AND external_id = $1`,
          [externalId]
        );
        const sourceEntityId = sourceResult.rows[0]?.entity_id;
        if (!sourceEntityId) continue;
        const targetResult = await client.query<{ id: string }>(
          `SELECT e.id
             FROM entities e
             WHERE e.entity_type = 'player' AND e.is_goalkeeper = TRUE
               AND e.canonical_name = $1 AND e.id <> $2 AND e.id NOT LIKE 'iffhs:%'
             ORDER BY CASE WHEN EXISTS (
               SELECT 1 FROM ranking_entries re
               WHERE re.snapshot_id = $3 AND re.entity_id = e.id
             ) THEN 0 WHEN e.id LIKE 'bdfutbol:%' THEN 1 ELSE 2 END, e.id
             LIMIT 1`,
          [targetName, sourceEntityId, latestCleanSheet.rows[0]?.id ?? '']
        );
        const targetEntityId = targetResult.rows[0]?.id;
        if (!targetEntityId || sourceEntityId === targetEntityId) continue;
        const resolvedSourceEntityId = await resolveCanonicalEntityId(client, sourceEntityId);
        const resolvedTargetEntityId = await resolveCanonicalEntityId(client, targetEntityId);
        if (resolvedSourceEntityId === resolvedTargetEntityId) continue;
        await recordIdentityLink(client, sourceEntityId, targetEntityId, 'rsssf-goalkeeper-cleansheets', 'Explicit reviewed mapping from RSSSF clean-sheet record to canonical provider identity');
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(JSON.stringify({ source: 'iffhs-all-time-goalkeepers', linked, skipped }, null, 2));
  } else if (command === 'audit-api-football') {
    const season = Number(argument('season') ?? 2023);
    // API-Football exposes historical tournament editions before 2000 (for
    // example World Cups and EUROs). They are valid source data even though
    // the modern-audience seeder deliberately does not make every historical
    // player playable.
    if (!Number.isInteger(season) || season < 1900 || season > 2100) throw new Error('El season debe ser un año válido');
    const client = new ApiFootballClient();
    const status = await client.request<{ response?: { subscription?: { plan?: string; active?: boolean }; requests?: { current?: number; limit_day?: number } } }>('/status');
    const leagues = await client.request<{ response?: Array<{ league?: { id?: number; name?: string }; country?: { name?: string }; seasons?: Array<{ year?: number; coverage?: Record<string, unknown> }> }> }>('/leagues', { id: 39 });
    const scorers = await client.request<{ response?: Array<{ player?: { id?: number; name?: string }; statistics?: Array<{ goals?: { total?: number } }> }>; errors?: Record<string, unknown> }>('/players/topscorers', { league: 39, season });
    console.log(JSON.stringify({
      season,
      subscription: status.response?.subscription ?? null,
      requests: status.response?.requests ?? null,
      premierLeague: leagues.response?.map((league) => ({
        id: league.league?.id ?? null,
        name: league.league?.name ?? null,
        country: league.country?.name ?? null,
        seasons: league.seasons?.length ?? 0,
        requestedSeasonCoverage: league.seasons?.find((item) => item.year === season)?.coverage ?? null
      })) ?? [],
      scorerRows: scorers.response?.length ?? 0,
      scorerErrors: scorers.errors ?? {},
      note: 'Auditoría de conectividad y cobertura; no guarda ni publica datos.'
    }, null, 2));
  } else if (command === 'import-api-football-premier-league' || command === 'import-api-football-league') {
    const season = Number(argument('season') ?? 2024);
    // Historical editions before 2000 are valid API-Football source data;
    // playability is curated separately by seed-game-audience.
    if (!Number.isInteger(season) || season < 1900 || season > 2100) throw new Error('El season debe ser un año válido');
    const complete = args.includes('--full');
    const skipMedia = args.includes('--skip-media');
    const cacheDir = argument('cache-dir');
    const resume = args.includes('--resume');
    const cleanupCache = args.includes('--cleanup-cache');
    const isPremierLeague = command === 'import-api-football-premier-league';
    const leagueId = isPremierLeague ? 39 : Number(argument('league-id'));
    const competitionId = isPremierLeague ? 'premier-league' : argument('competition');
    if (!Number.isInteger(leagueId) || leagueId < 1 || leagueId > 10_000) throw new Error('Para una liga genérica se requiere --league-id entero');
    if (!competitionId) throw new Error('Para una liga genérica se requiere --competition con un id del catálogo');
    if (!isPremierLeague && !complete) throw new Error('La importación genérica requiere --full para evitar guardar una muestra como temporada completa');
    if ((cacheDir !== undefined || resume || cleanupCache) && !complete) throw new Error('--cache-dir, --resume y --cleanup-cache solo están disponibles con --full');
    if ((resume || cleanupCache) && cacheDir === undefined) throw new Error('--resume y --cleanup-cache requieren --cache-dir');
    const competition = await pool.query<{ id: string }>('SELECT id FROM competitions WHERE id = $1', [competitionId]);
    if (!competition.rows[0]) throw new Error(`Competición inexistente en el catálogo: ${competitionId}`);
    const result = complete
      ? (isPremierLeague
        ? await fetchApiFootballPremierLeagueCompleteSeason(season, { cacheDir, resume })
        : await fetchApiFootballLeagueCompleteSeason(leagueId, season, { cacheDir, resume }))
      : await fetchApiFootballPremierLeagueSeason(season);
    const rawContent = JSON.stringify(result);
    const hash = createHash('sha256').update(rawContent).digest('hex');
    const snapshotId = `src_${hash.slice(0, 24)}`;
    const snapshotPath = resolve(config.snapshotRoot, `${snapshotId}.json`);
    await mkdir(resolve(config.snapshotRoot), { recursive: true });
    try {
      await writeFile(snapshotPath, rawContent, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO sources (key, name, source_type, base_url, rights_status)
         VALUES ('api-football', 'API-Football / API-Sports', 'api', 'https://www.api-football.com/', 'review_required')
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, base_url = EXCLUDED.base_url`
      );
      await client.query(
        `INSERT INTO source_snapshots (id, source_key, retrieved_at, content_type, storage_uri, content_sha256, metadata)
         VALUES ($1, 'api-football', $2, 'application/json', $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [snapshotId, result.retrievedAt, `storage/source-snapshots/${snapshotId}.json`, hash, JSON.stringify({
          importType: complete ? 'api-football-league-complete-season' : 'api-football-premier-league-season', leagueId: result.leagueId, competitionId, seasonYear: season,
          endpointCoverage: Object.fromEntries(Object.entries(result.endpoints).map(([key, payload]) => [key, { rows: payload.response?.length ?? 0, paging: payload.paging }])),
          sourceUrl: result.sourceUrl, rightsStatus: 'review_required', skipMedia, validationAnomalies: result.validationAnomalies,
          cache: result.cache ?? null, cleanupCache
        })]
      );
      await client.query(
        `INSERT INTO import_runs (id, source_snapshot_id, status, metadata, finished_at)
         VALUES ($1, $2, 'validated', $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [`run_${hash.slice(0, 24)}`, snapshotId, JSON.stringify({ rows: result.rows.length, seasonYear: season, complete, cache: result.cache ?? null, cleanupCache })]
      );

      for (const row of result.rows) {
        const player = row.player;
        const statistic = row.statistic;
        const playerExternalId = String(player.id);
        const linked = await client.query<{ entity_id: string }>(
          `SELECT entity_id FROM entity_external_ids WHERE source_key = 'api-football' AND entity_type = 'player' AND external_id = $1`,
          [playerExternalId]
        );
        const displayName = preferredApiPlayerName(player.name, player.firstname, player.lastname);
        if (!displayName) throw new Error(`API-Football: nombre ausente para ${player.id}`);
        const linkedEntityId = linked.rows[0]?.entity_id;
        const playerEntityId = linkedEntityId
          ? await resolveCanonicalEntityId(client, linkedEntityId)
          : await findUniqueCanonicalEntity(client, 'player', 'api-football:', displayName, player.birth?.date, 'pl:player:') ?? `api-football:player:${player.id}`;
        await client.query(
          `INSERT INTO entities (id, entity_type, canonical_name, short_name, birth_date, position, is_goalkeeper, metadata)
           VALUES ($1, 'player', $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             canonical_name = EXCLUDED.canonical_name,
             short_name = EXCLUDED.short_name,
             birth_date = COALESCE(entities.birth_date, EXCLUDED.birth_date),
             position = CASE WHEN EXCLUDED.is_goalkeeper THEN COALESCE(EXCLUDED.position, entities.position) ELSE COALESCE(entities.position, EXCLUDED.position) END,
             is_goalkeeper = entities.is_goalkeeper OR EXCLUDED.is_goalkeeper,
             metadata = entities.metadata || EXCLUDED.metadata`,
          [playerEntityId, displayName, player.name ?? displayName, validApiFootballBirthDate(player.birth?.date), statistic.games?.position ?? null, isApiFootballGoalkeeperPosition(statistic.games?.position), JSON.stringify({
            provider: 'api-football', providerPlayerId: player.id, firstname: player.firstname ?? null,
            lastname: player.lastname ?? null, nationality: player.nationality ?? null,
            height: player.height ?? null, weight: player.weight ?? null, photoUrl: player.photo ?? null,
            birthPlace: player.birth?.place ?? null, birthCountry: player.birth?.country ?? null
          })]
        );
        if (player.name && player.name !== displayName) {
          await client.query(
            `INSERT INTO entity_aliases (entity_id, alias, source_key) VALUES ($1, $2, 'api-football') ON CONFLICT (entity_id, alias) DO NOTHING`,
            [playerEntityId, player.name]
          );
        }
        // Historical imports can contain thousands of players that are useful
        // as raw statistical evidence but can never enter the current game
        // pool. Do not create a media-review task for those rows. The later
        // playable-media queue can add the candidate once a player is admitted
        // to an active top-200 ranking.
        if (!skipMedia && player.photo) {
          await client.query(
            `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, provider, width, height, mime_type, sha256, review_status, metadata)
             SELECT $1, $2, 'portrait', $3, 'api-football', 512, 512, 'image/png', $4, 'pending', $5
             WHERE EXISTS (
               SELECT 1
               FROM entity_game_profiles egp
               LEFT JOIN entity_identity_links profile_link
                 ON profile_link.source_entity_id = egp.entity_id
               WHERE COALESCE(profile_link.canonical_entity_id, egp.entity_id) = $2
                 AND egp.playable_default = TRUE
             )
             AND EXISTS (
               SELECT 1
               FROM ranking_entries ranked_entry
               JOIN ranking_snapshots ranked_snapshot
                 ON ranked_snapshot.id = ranked_entry.snapshot_id
                AND ranked_snapshot.status <> 'superseded'
               LEFT JOIN entity_identity_links ranked_link
                 ON ranked_link.source_entity_id = ranked_entry.entity_id
               WHERE COALESCE(ranked_link.canonical_entity_id, ranked_entry.entity_id) = $2
                 AND ranked_entry.rank <= ${MAX_GAME_RANKING_ENTRIES}
             )
             AND NOT EXISTS (
               SELECT 1 FROM image_assets existing
               WHERE existing.entity_id = $2
                 AND existing.asset_kind = 'portrait'
                 AND existing.is_primary = TRUE
                 AND existing.review_status = 'approved'
                 AND existing.rights_basis <> 'unknown'
                 AND existing.commercial_use = TRUE
                 AND existing.rights_verified_at IS NOT NULL
                 AND existing.rights_evidence_url IS NOT NULL
                 AND jsonb_array_length(existing.usage_scope) > 0
                 AND (existing.attribution_required = FALSE OR NULLIF(existing.attribution_text, '') IS NOT NULL)
             )
             ON CONFLICT (id) DO NOTHING`,
            [`img_${createHash('sha256').update(`${playerEntityId}:portrait:${player.photo}`).digest('hex').slice(0, 24)}`, playerEntityId, player.photo, createHash('sha256').update(player.photo).digest('hex'), JSON.stringify({ sourceSnapshotId: snapshotId, rightsStatus: 'review_required', purpose: 'candidate_only' })]
          );
        }
        await ensureExternalEntityLink(client, 'api-football', 'player', playerExternalId, playerEntityId, { sourceSnapshotId: snapshotId });
        // Historical/statistical ingestion must not enlarge the default game
        // pool. Playability is a separate, reviewed curation decision made by
        // seed-game-audience; otherwise importing an old season would mark
        // every fringe player as modern and playable.

        const teamId = statistic.team?.id ?? 0;
        const teamName = statistic.team?.name ?? null;
        let teamEntityId: string | null = null;
        if (teamId > 0 && teamName) {
          const linkedTeam = await client.query<{ entity_id: string }>(
            `SELECT entity_id FROM entity_external_ids
             WHERE source_key = 'api-football' AND entity_type = 'club' AND external_id = $1`,
            [String(teamId)]
          );
          const linkedTeamEntityId = linkedTeam.rows[0]?.entity_id;
          teamEntityId = linkedTeamEntityId
            ? await resolveCanonicalEntityId(client, linkedTeamEntityId)
            : await findUniqueCanonicalEntity(client, 'club', 'api-football:', teamName, null, 'pl:club:') ?? `api-football:club:${teamId}`;
          await client.query(
            `INSERT INTO entities (id, entity_type, canonical_name, short_name, country_code, metadata)
             VALUES ($1, 'club', $2, $2, 'UNK', $3)
             ON CONFLICT (id) DO UPDATE SET canonical_name = EXCLUDED.canonical_name, metadata = entities.metadata || EXCLUDED.metadata`,
            [teamEntityId, teamName, JSON.stringify({ provider: 'api-football', providerTeamId: teamId, logoUrl: statistic.team?.logo ?? null })]
          );
          await ensureExternalEntityLink(client, 'api-football', 'club', String(teamId), teamEntityId, { sourceSnapshotId: snapshotId });
        }
        if (!skipMedia && teamEntityId && statistic.team?.logo) {
          await client.query(
            `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, provider, width, height, mime_type, sha256, review_status, metadata)
             SELECT $1, $2, 'badge', $3, 'api-football', 512, 512, 'image/png', $4, 'pending', $5
             WHERE NOT EXISTS (
               SELECT 1 FROM image_assets existing
               WHERE existing.entity_id = $2
                 AND existing.asset_kind = 'badge'
                 AND existing.is_primary = TRUE
                 AND existing.review_status = 'approved'
                 AND existing.rights_basis <> 'unknown'
                 AND existing.commercial_use = TRUE
                 AND existing.rights_verified_at IS NOT NULL
                 AND existing.rights_evidence_url IS NOT NULL
                 AND jsonb_array_length(existing.usage_scope) > 0
                 AND existing.trademark_status = 'cleared'
                 AND (existing.attribution_required = FALSE OR NULLIF(existing.attribution_text, '') IS NOT NULL)
             )
             ON CONFLICT (id) DO NOTHING`,
            [`img_${createHash('sha256').update(`${teamEntityId}:badge:${statistic.team.logo}`).digest('hex').slice(0, 24)}`, teamEntityId, statistic.team.logo, createHash('sha256').update(statistic.team.logo).digest('hex'), JSON.stringify({ sourceSnapshotId: snapshotId, rightsStatus: 'review_required', purpose: 'candidate_only' })]
          );
        }

        const goals = nonNegativeInteger(statistic.goals?.total) ?? 0;
        // API-Football returns NULL for historical seasons where assists were
        // not recorded. Preserve NULL so ranking generation cannot mistake an
        // unknown value for an observed zero.
        const assists = nonNegativeInteger(statistic.goals?.assists);
        const goalsConceded = nonNegativeInteger(statistic.goals?.conceded);
        const yellowCards = nonNegativeInteger(statistic.cards?.yellow) ?? 0;
        const redCards = nonNegativeInteger(statistic.cards?.red) ?? 0;
        const appearances = nonNegativeInteger(statistic.games?.appearences);
        const minutes = nonNegativeInteger(statistic.games?.minutes);
        await client.query(
          `INSERT INTO player_season_stats (entity_id, competition_id, season_year, provider_team_id, team_entity_id, appearances, minutes, goals, assists, yellow_cards, red_cards, goals_conceded, source_key, source_snapshot_id, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'api-football', $13, $14)
           ON CONFLICT (entity_id, competition_id, season_year, provider_team_id) DO UPDATE SET
             team_entity_id = EXCLUDED.team_entity_id, appearances = EXCLUDED.appearances, minutes = EXCLUDED.minutes,
             goals = EXCLUDED.goals, assists = EXCLUDED.assists, yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards,
             goals_conceded = EXCLUDED.goals_conceded,
             source_snapshot_id = EXCLUDED.source_snapshot_id, metadata = EXCLUDED.metadata, updated_at = NOW()`,
          [playerEntityId, competitionId, season, teamId, teamEntityId, appearances, minutes, goals, assists, yellowCards, redCards, goalsConceded, snapshotId, JSON.stringify({ observedFrom: row.observedFrom, position: statistic.games?.position ?? null, imageCandidate: player.photo ?? null, teamless: teamId === 0 })]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    if (cleanupCache) await cleanupApiFootballSeasonCache(cacheDir!, leagueId, season);
    const sourceCoverage = result.rows.length === 0 ? 'empty' : 'usable';
    console.log(JSON.stringify({ snapshotId, source: 'api-football', leagueId: result.leagueId, competitionId, season, rows: result.rows.length, sourceCoverage, endpoints: Object.keys(result.endpoints), validationAnomalies: result.validationAnomalies, complete, skipMedia, cache: result.cache ?? null, cleanupCache, status: 'validated', rightsStatus: 'review_required', note: sourceCoverage === 'empty' ? 'La fuente devolvió una respuesta vacía para esta temporada; se archiva la limitación y no se generan rankings.' : complete ? (skipMedia ? 'Datos completos del endpoint de jugadores para la temporada; importación estadística sin tocar imágenes.' : 'Datos completos del endpoint de jugadores para la temporada; no publica imágenes automáticamente.') : 'Datos archivados para contraste; no es un top histórico completo ni publica imágenes automáticamente.' }, null, 2));
  } else if (command === 'import-premier-league-teams') {
    const seasonArgument = argument('season-id');
    const seasonId = seasonArgument === undefined ? undefined : Number(seasonArgument);
    if (seasonArgument !== undefined && (!Number.isInteger(seasonId) || (seasonId ?? 0) < 1)) throw new Error('El season-id debe ser un entero positivo');
    const result = await fetchPremierLeagueTeams(seasonId);
    const rawContent = JSON.stringify(result);
    const hash = createHash('sha256').update(rawContent).digest('hex');
    const snapshotId = `src_${hash.slice(0, 24)}`;
    const snapshotPath = resolve(config.snapshotRoot, `${snapshotId}.json`);
    await mkdir(resolve(config.snapshotRoot), { recursive: true });
    try {
      await writeFile(snapshotPath, rawContent, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO sources (key, name, source_type, base_url, rights_status)
         VALUES ('premier-league-official', 'Premier League official statistics', 'official', 'https://www.premierleague.com/', 'review_required')
         ON CONFLICT (key) DO NOTHING`
      );
      await client.query(
        `INSERT INTO source_snapshots (id, source_key, retrieved_at, content_type, storage_uri, content_sha256, metadata)
         VALUES ($1, 'premier-league-official', $2, 'application/json', $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [snapshotId, result.retrievedAt, `storage/source-snapshots/${snapshotId}.json`, hash, JSON.stringify({ importType: 'premier-league-teams', compSeasonId: result.compSeasonId, seasonLabel: result.seasonLabel, sourceUrl: result.sourceUrl })]
      );
      await client.query(
        `INSERT INTO import_runs (id, source_snapshot_id, status, metadata, finished_at)
         VALUES ($1, $2, 'validated', $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [`run_${hash.slice(0, 24)}`, snapshotId, JSON.stringify({ teams: result.teams.length, compSeasonId: result.compSeasonId })]
      );
      for (const team of result.teams) {
        await client.query(
          `INSERT INTO entities (id, entity_type, canonical_name, short_name, country_code, metadata)
           VALUES ($1, 'club', $2, $3, 'ENG', $4)
           ON CONFLICT (id) DO UPDATE
             SET canonical_name = EXCLUDED.canonical_name,
                 short_name = EXCLUDED.short_name,
                 country_code = EXCLUDED.country_code,
                 metadata = entities.metadata || EXCLUDED.metadata`,
          [`pl:club:${team.providerTeamId}`, team.name, team.shortName, JSON.stringify({ provider: 'pulselive', providerTeamId: team.providerTeamId, abbreviation: team.abbreviation, teamType: team.teamType, compSeasonId: result.compSeasonId, seasonLabel: result.seasonLabel, grounds: team.grounds })]
        );
        await ensureExternalEntityLink(client, 'premier-league-official', 'club', String(team.providerTeamId), `pl:club:${team.providerTeamId}`, { field: 'providerTeamId', compSeasonId: result.compSeasonId });
        await client.query(
          `INSERT INTO entity_game_profiles
             (entity_id, legacy_tier, playable_default, reason, source_key, source_snapshot_id, metadata)
           VALUES ($1, 'modern', TRUE, $2, 'premier-league-official', $3, $4)
           ON CONFLICT (entity_id) DO UPDATE SET
             legacy_tier = EXCLUDED.legacy_tier,
             playable_default = EXCLUDED.playable_default,
             reason = EXCLUDED.reason,
             source_key = EXCLUDED.source_key,
             source_snapshot_id = EXCLUDED.source_snapshot_id,
             reviewed_at = NOW(),
             metadata = entity_game_profiles.metadata || EXCLUDED.metadata`,
          [
            `pl:club:${team.providerTeamId}`,
            `Club importado desde la fuente oficial de Premier League (Pulselive), temporada ${result.seasonLabel}, compSeasonId ${result.compSeasonId}; elegible por defecto como entidad de juego.`,
            snapshotId,
            JSON.stringify({
              policy: 'premier-league-official-club-import-v1',
              provider: 'pulselive',
              providerTeamId: team.providerTeamId,
              compSeasonId: result.compSeasonId,
              seasonLabel: result.seasonLabel,
              sourceUrl: result.sourceUrl,
              reasonCode: 'official_premier_league_club_import'
            })
          ]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(JSON.stringify({ snapshotId, season: result.seasonLabel, teams: result.teams.length, status: 'validated' }, null, 2));
  } else if (command === 'link-entity') {
    const entityId = argument('entity');
    const sourceKey = argument('source');
    const externalId = argument('external-id');
    const requestedType = argument('type') as 'player' | 'club' | 'national_team' | undefined;
    if (!entityId || !sourceKey || !externalId || !/^[a-z0-9][a-z0-9._:-]{0,99}$/i.test(externalId)) {
      throw new Error('Faltan --entity, --source o --external-id inválido');
    }
    if (requestedType && !['player', 'club', 'national_team'].includes(requestedType)) {
      throw new Error('El type debe ser player, club o national_team');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const entity = await client.query<{ entity_type: 'player' | 'club' | 'national_team' }>('SELECT entity_type FROM entities WHERE id = $1', [entityId]);
      if (!entity.rows[0]) throw new Error(`Entidad inexistente: ${entityId}`);
      const source = await client.query('SELECT key FROM sources WHERE key = $1', [sourceKey]);
      if (!source.rows[0]) throw new Error(`Fuente inexistente: ${sourceKey}`);
      if (requestedType && requestedType !== entity.rows[0].entity_type) throw new Error('El type no coincide con la entidad');
      await ensureExternalEntityLink(client, sourceKey, requestedType ?? entity.rows[0].entity_type, externalId, entityId, { linkedBy: 'cli' });
      await client.query('COMMIT');
      console.log(`Identificador externo vinculado: ${sourceKey}/${externalId} -> ${entityId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'discover-commons') {
    const entityId = argument('entity');
    const kind = argument('kind') as 'portrait' | 'badge' | undefined;
    const limit = Number(argument('limit') ?? 5);
    if (!entityId || !kind || !['portrait', 'badge'].includes(kind) || !Number.isInteger(limit) || limit < 1 || limit > 10) {
      throw new Error('Faltan --entity, --kind portrait|badge o --limit inválido (1-10)');
    }
    const entity = await pool.query<{ canonical_name: string; entity_type: 'player' | 'club' | 'national_team'; aliases: string[]; source_team_name: string | null }>(
      `SELECT e.canonical_name, e.entity_type, e.metadata->>'sourceTeamName' AS source_team_name,
              COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
       FROM entities e LEFT JOIN entity_aliases a ON a.entity_id = e.id
       WHERE e.id = $1 GROUP BY e.id`,
      [entityId]
    );
    const current = entity.rows[0];
    if (!current) throw new Error(`Entidad inexistente: ${entityId}`);
    if ((kind === 'portrait' && current.entity_type !== 'player') || (kind === 'badge' && !['club', 'national_team'].includes(current.entity_type))) {
      throw new Error(`El tipo ${kind} no es compatible con ${current.entity_type}`);
    }
    const candidates = await searchCommonsCandidates(current.canonical_name, kind, limit, current.aliases, current.source_team_name ?? undefined);
    const filteredCandidates = await removeRegisteredCommonsCandidates(entityId, kind, candidates);
    console.log(JSON.stringify({ entityId, entityName: current.canonical_name, aliases: current.aliases, kind, candidates: filteredCandidates }, null, 2));
  } else if (command === 'discover-commons-ranking') {
    const snapshotId = argument('snapshot');
    const kind = argument('kind') as 'portrait' | 'badge' | undefined;
    const limit = Number(argument('limit') ?? MAX_GAME_RANKING_ENTRIES);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? 2_000);
    const resume = args.includes('--resume');
    // Media work must stay inside the game pool by default.  The explicit
    // escape hatch is retained for read-only legacy manifests/audits.
    const playableOnly = !args.includes('--all-ranked');
    const missingOnly = args.includes('--missing-only');
    const includePending = args.includes('--include-pending');
    if (!snapshotId || !kind || !['portrait', 'badge'].includes(kind) || !Number.isInteger(limit) || limit < 1 || limit > MAX_GAME_RANKING_ENTRIES || !Number.isInteger(offset) || offset < 0 || offset >= MAX_GAME_RANKING_ENTRIES || offset + limit > MAX_GAME_RANKING_ENTRIES || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10_000) {
      throw new Error('Faltan --snapshot, --kind portrait|badge o hay límites inválidos');
    }
    const ranking = await pool.query<{ entity_id: string; canonical_name: string; entity_type: 'player' | 'club' | 'national_team'; rank: number; aliases: string[]; team_name: string | null }>(
      `SELECT re.entity_id, e.canonical_name, e.entity_type, re.rank, e.metadata->>'sourceTeamName' AS team_name
              , COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
       FROM ranking_entries re JOIN entities e ON e.id = re.entity_id
       LEFT JOIN entity_aliases a ON a.entity_id = e.id
       WHERE re.snapshot_id = $1 AND re.rank <= ${MAX_GAME_RANKING_ENTRIES}
         AND e.catalog_status = 'active'
       ${playableOnly ? `AND EXISTS (
         SELECT 1 FROM entity_game_profiles egp
         WHERE egp.entity_id = COALESCE(
                 (SELECT eil.canonical_entity_id
                  FROM entity_identity_links eil
                  WHERE eil.source_entity_id = re.entity_id),
                 re.entity_id
               )
           AND egp.playable_default
       )` : ''}
       ${missingOnly ? `AND NOT EXISTS (
         SELECT 1 FROM image_assets ia
         WHERE ia.entity_id = COALESCE(
                 (SELECT eil.canonical_entity_id
                  FROM entity_identity_links eil
                  WHERE eil.source_entity_id = re.entity_id),
                 re.entity_id
               )
           AND ia.asset_kind = $4
           AND ia.is_primary = TRUE AND ia.review_status = 'approved'
           AND ia.rights_basis <> 'unknown' AND ia.commercial_use = TRUE
           AND ia.rights_verified_at IS NOT NULL
           AND ia.rights_evidence_url IS NOT NULL AND jsonb_array_length(ia.usage_scope) > 0
           AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
           ${kind === 'badge' ? `AND ia.trademark_status = 'cleared'` : ''}
       )` : ''}
       ${missingOnly && !includePending ? `AND NOT EXISTS (
         SELECT 1 FROM image_assets pending_asset
         WHERE pending_asset.entity_id = COALESCE(
                 (SELECT eil.canonical_entity_id
                  FROM entity_identity_links eil
                  WHERE eil.source_entity_id = re.entity_id),
                 re.entity_id
               )
           AND pending_asset.asset_kind = $4
           AND pending_asset.review_status = 'pending'
           AND pending_asset.provider IN ('wikimedia-commons', 'openverse')
       )` : ''}
       GROUP BY re.entity_id, e.canonical_name, e.entity_type, re.rank, e.metadata->>'sourceTeamName'
       ORDER BY re.rank, e.canonical_name LIMIT $2 OFFSET $3`,
      missingOnly ? [snapshotId, limit, offset, kind] : [snapshotId, limit, offset]
    );
    if (ranking.rows.length === 0) throw new Error(`Snapshot inexistente o sin entradas: ${snapshotId}`);
    const expectedType = kind === 'portrait' ? 'player' : null;
    if (ranking.rows.some((row) => expectedType ? row.entity_type !== expectedType : !['club', 'national_team'].includes(row.entity_type))) {
      throw new Error(`El snapshot contiene entidades incompatibles con ${kind}`);
    }
    const manifest: {
      snapshotId: string;
      kind: 'portrait' | 'badge';
      offset: number;
      generatedAt: string;
      complete: boolean;
      entries: Array<Record<string, unknown>>;
    } = { snapshotId, kind, offset, generatedAt: new Date().toISOString(), complete: false, entries: [] };
    await mkdir(resolve(config.mediaCandidateRoot), { recursive: true });
    const filterSuffix = `${playableOnly ? '-playable' : '-all-ranked'}${missingOnly ? '-missing' : ''}${includePending ? '-include-pending' : ''}`;
    const outputPath = resolve(config.mediaCandidateRoot, `${snapshotId}-${kind}${filterSuffix}-${offset}-${limit}.json`);
    if (resume) {
      try {
        const existing = JSON.parse(await readFile(outputPath, 'utf8')) as typeof manifest;
        if (existing.snapshotId === snapshotId && existing.kind === kind && existing.offset === offset) {
          manifest.generatedAt = existing.generatedAt;
          const currentEntityIds = new Set(ranking.rows.map((row) => row.entity_id));
          manifest.entries = (existing.entries ?? []).filter((entry) => currentEntityIds.has(String(entry.entityId)));
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    for (const [index, row] of ranking.rows.entries()) {
      const previous = manifest.entries.find((entry) => entry.entityId === row.entity_id);
      if (previous && !('error' in previous)) continue;
      try {
        const candidates = await searchCommonsCandidates(row.canonical_name, kind, 5, row.aliases, row.team_name ?? undefined);
        const filteredCandidates = await removeRegisteredCommonsCandidates(row.entity_id, kind, candidates);
        const next = { entityId: row.entity_id, entityName: row.canonical_name, rank: row.rank, aliases: row.aliases, teamName: row.team_name, candidates: filteredCandidates };
        const previousIndex = manifest.entries.findIndex((entry) => entry.entityId === row.entity_id);
        if (previousIndex >= 0) manifest.entries[previousIndex] = next;
        else manifest.entries.push(next);
      } catch (error) {
        const next = { entityId: row.entity_id, entityName: row.canonical_name, rank: row.rank, error: error instanceof Error ? error.message : String(error), candidates: [] };
        const previousIndex = manifest.entries.findIndex((entry) => entry.entityId === row.entity_id);
        if (previousIndex >= 0) manifest.entries[previousIndex] = next;
        else manifest.entries.push(next);
      }
      await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
      if (index < ranking.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    manifest.complete = manifest.entries.length === ranking.rows.length && manifest.entries.every((entry) => !('error' in entry));
    await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(JSON.stringify({ outputPath, entries: manifest.entries.length, complete: manifest.complete }, null, 2));
  } else if (command === 'discover-playable-portrait-range') {
    const from = Number(argument('from') ?? 1);
    const to = Number(argument('to') ?? 150);
    const delayMs = Number(argument('delay-ms') ?? 500);
    const resume = args.includes('--resume');
    if (!Number.isInteger(from) || from < 1 || !Number.isInteger(to) || to < from || to > 800 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10_000) {
      throw new Error('El tramo debe ser válido: --from >=1, --to >= from y <=800; --delay-ms 0-10000');
    }
    const players = await pool.query<{
      entity_id: string;
      canonical_name: string;
      best_rank: number;
      ranking_count: number;
      aliases: string[];
      team_name: string | null;
      missing_position: number;
    }>(
      `WITH ranked_players AS (
         SELECT COALESCE(identity_link.canonical_entity_id, re.entity_id) AS entity_id,
                MIN(re.rank)::int AS best_rank,
                COUNT(DISTINCT re.snapshot_id)::int AS ranking_count
           FROM ranking_entries re
           JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
           JOIN entities ranked_entity ON ranked_entity.id = re.entity_id AND ranked_entity.entity_type = 'player'
           LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = re.entity_id
          WHERE re.rank <= ${MAX_GAME_RANKING_ENTRIES}
          GROUP BY COALESCE(identity_link.canonical_entity_id, re.entity_id)
       ), playable_players AS (
         SELECT ranked_players.*
           FROM ranked_players
          WHERE EXISTS (
            SELECT 1 FROM entity_game_profiles egp
             WHERE egp.entity_id = ranked_players.entity_id AND egp.playable_default = TRUE
          )
       ), legal_portraits AS (
         SELECT DISTINCT COALESCE(identity_link.canonical_entity_id, ia.entity_id) AS entity_id
           FROM image_assets ia
           LEFT JOIN entity_identity_links identity_link
             ON identity_link.source_entity_id = ia.entity_id
          WHERE ia.asset_kind = 'portrait'
            AND ia.is_primary = TRUE
            AND ia.review_status = 'approved'
            AND ia.rights_basis <> 'unknown'
            AND ia.commercial_use = TRUE
            AND ia.rights_verified_at IS NOT NULL
            AND ia.rights_evidence_url IS NOT NULL
            AND jsonb_array_length(ia.usage_scope) > 0
            AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
       ), missing_players AS (
         SELECT playable_players.*,
                ROW_NUMBER() OVER (ORDER BY playable_players.best_rank, e.canonical_name, playable_players.entity_id)::int AS missing_position
           FROM playable_players
           JOIN entities e ON e.id = playable_players.entity_id AND e.catalog_status = 'active'
          WHERE NOT EXISTS (SELECT 1 FROM legal_portraits WHERE legal_portraits.entity_id = playable_players.entity_id)
       )
       SELECT missing_players.entity_id, e.canonical_name, missing_players.best_rank,
              missing_players.ranking_count, missing_players.missing_position,
              e.metadata->>'sourceTeamName' AS team_name,
              COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
         FROM missing_players
         JOIN entities e ON e.id = missing_players.entity_id
         LEFT JOIN entity_aliases a ON a.entity_id = missing_players.entity_id
        WHERE missing_players.missing_position BETWEEN $1 AND $2
        GROUP BY missing_players.entity_id, e.canonical_name, missing_players.best_rank,
                 missing_players.ranking_count, missing_players.missing_position,
                 e.metadata->>'sourceTeamName'
        ORDER BY missing_players.missing_position`,
      [from, to]
    );
    if (players.rows.length === 0) throw new Error(`No hay jugadores faltantes en el tramo ${from}-${to}`);
    type RangeManifest = {
      kind: 'portrait';
      range: { from: number; to: number };
      generatedAt: string;
      complete: boolean;
      source: 'wikimedia-commons';
      entries: Array<Record<string, unknown>>;
    };
    const manifest: RangeManifest = {
      kind: 'portrait',
      range: { from, to },
      generatedAt: new Date().toISOString(),
      complete: false,
      source: 'wikimedia-commons',
      entries: []
    };
    await mkdir(resolve(config.mediaCandidateRoot), { recursive: true });
    const outputPath = resolve(config.mediaCandidateRoot, `players-portrait-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-global-${from}-${to}.json`);
    if (resume) {
      try {
        const existing = JSON.parse(await readFile(outputPath, 'utf8')) as RangeManifest;
        if (existing.kind === 'portrait' && existing.range?.from === from && existing.range?.to === to) {
          manifest.generatedAt = existing.generatedAt;
          // A ranking refresh can change the missing-player order between
          // resumptions. Keep only entities in the current query; stale
          // entries made a finished range report incomplete and could leave
          // obsolete candidates in the review manifest.
          const currentEntityIds = new Set(players.rows.map((player) => player.entity_id));
          manifest.entries = (existing.entries ?? []).filter((entry) => currentEntityIds.has(String(entry.entityId)));
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    for (const [index, player] of players.rows.entries()) {
      const previous = manifest.entries.find((entry) => entry.entityId === player.entity_id);
      if (previous && !('error' in previous)) continue;
      try {
        const candidates = await searchCommonsCandidates(player.canonical_name, 'portrait', 5, player.aliases, player.team_name ?? undefined);
        const filteredCandidates = await removeRegisteredCommonsCandidates(player.entity_id, 'portrait', candidates);
        const next = {
          entityId: player.entity_id,
          entityName: player.canonical_name,
          missingPosition: player.missing_position,
          bestRank: player.best_rank,
          rankingCount: player.ranking_count,
          aliases: player.aliases,
          teamName: player.team_name,
          candidates: filteredCandidates
        };
        const previousIndex = manifest.entries.findIndex((entry) => entry.entityId === player.entity_id);
        if (previousIndex >= 0) manifest.entries[previousIndex] = next;
        else manifest.entries.push(next);
      } catch (error) {
        const next = {
          entityId: player.entity_id,
          entityName: player.canonical_name,
          missingPosition: player.missing_position,
          bestRank: player.best_rank,
          rankingCount: player.ranking_count,
          candidates: [],
          error: error instanceof Error ? error.message : String(error)
        };
        const previousIndex = manifest.entries.findIndex((entry) => entry.entityId === player.entity_id);
        if (previousIndex >= 0) manifest.entries[previousIndex] = next;
        else manifest.entries.push(next);
      }
      await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
      if (index < players.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    manifest.complete = manifest.entries.length === players.rows.length && manifest.entries.every((entry) => !('error' in entry));
    await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(JSON.stringify({ outputPath, range: { from, to }, players: players.rows.length, candidates: manifest.entries.reduce((total, entry) => total + (((entry.candidates as unknown[]) ?? []).length), 0), complete: manifest.complete, openverseAuthenticated: Boolean(config.openverseClientId && config.openverseClientSecret) }, null, 2));
  } else if (command === 'discover-commons-players') {
    const limit = Number(argument('limit') ?? 20);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? 1500);
    const concurrency = Number(argument('concurrency') ?? 1);
    const resume = args.includes('--resume');
    const retryNoCandidate = args.includes('--retry-no-candidate');
    const includePending = args.includes('--include-pending');
    const allRanked = args.includes('--all-ranked');
    const fast = args.includes('--fast');
    const retryRecent = args.includes('--retry-recent');
    const wikidataOnly = args.includes('--wikidata-only');
    const bestRankFirst = args.includes('--best-rank');
    const requestedManifestPath = argument('manifest');
    if (resume && !requestedManifestPath) {
      throw new Error('La reanudación requiere --manifest con la ruta del manifiesto existente');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_GAME_RANKING_ENTRIES || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10_000 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
      throw new Error(`Los límites deben ser válidos: --offset >=0, --limit 1-${MAX_GAME_RANKING_ENTRIES}, --delay-ms 0-10000 y --concurrency 1-8`);
    }
    const players = await pool.query<{ id: string; canonical_name: string; aliases: string[]; source_team_name: string | null }>(
      `WITH ranked_players AS (
         SELECT COALESCE(eil.canonical_entity_id, re.entity_id) AS entity_id,
                MIN(re.rank)::int AS best_rank,
                COUNT(DISTINCT rs.id)::int AS ranking_count,
                MAX(e.metadata->>'sourceTeamName') AS ranked_team_name
         FROM ranking_entries re
         JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
         JOIN entities e ON e.id = re.entity_id AND e.entity_type = 'player'
         LEFT JOIN entity_identity_links eil ON eil.source_entity_id = re.entity_id
         WHERE re.rank <= ${MAX_GAME_RANKING_ENTRIES}
         GROUP BY COALESCE(eil.canonical_entity_id, re.entity_id)
       ), legal_portraits AS (
         SELECT DISTINCT COALESCE(identity_link.canonical_entity_id, ia.entity_id) AS entity_id
         FROM image_assets ia
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = ia.entity_id
         WHERE ia.asset_kind = 'portrait'
           AND ia.is_primary = TRUE
           AND ia.review_status = 'approved'
           AND ia.rights_basis <> 'unknown'
           AND ia.commercial_use = TRUE
           AND ia.rights_verified_at IS NOT NULL
           AND ia.rights_evidence_url IS NOT NULL
           AND jsonb_array_length(ia.usage_scope) > 0
           AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
       )
       SELECT e.id, e.canonical_name,
              COALESCE(e.metadata->>'sourceTeamName', rp.ranked_team_name) AS source_team_name,
              COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
       FROM ranked_players rp
       JOIN entities e ON e.id = rp.entity_id AND e.entity_type = 'player'
       LEFT JOIN entity_aliases a ON a.entity_id = e.id
       WHERE e.catalog_status = 'active'
         AND ($5::boolean OR EXISTS (
                SELECT 1
                FROM entity_game_profiles egp
                LEFT JOIN entity_identity_links profile_identity
                  ON profile_identity.source_entity_id = egp.entity_id
                WHERE COALESCE(profile_identity.canonical_entity_id, egp.entity_id) = e.id
                  AND egp.playable_default
              ))
       AND NOT EXISTS (
           SELECT 1 FROM legal_portraits lp
           WHERE lp.entity_id = e.id
         )
        AND (
          $4::boolean OR NOT EXISTS (
            SELECT 1
            FROM image_assets ia
            LEFT JOIN entity_identity_links image_identity
              ON image_identity.source_entity_id = ia.entity_id
            WHERE COALESCE(image_identity.canonical_entity_id, ia.entity_id) = e.id
              AND ia.asset_kind = 'portrait'
              AND ia.local_path IS NOT NULL
              AND ia.review_status IN ('pending', 'approved')
          )
        )
         AND (
           $4::boolean OR $6::boolean
           OR NOT EXISTS (
            SELECT 1 FROM image_assets ia
            LEFT JOIN entity_identity_links image_identity
              ON image_identity.source_entity_id = ia.entity_id
            WHERE COALESCE(image_identity.canonical_entity_id, ia.entity_id) = e.id
              AND ia.asset_kind = 'portrait'
              AND COALESCE(ia.media_status, 'required') = 'required'
              AND ia.review_status = 'pending'
              AND ia.provider IN ('wikimedia-commons', 'openverse')
          )
        )
        AND (
          $7::boolean
          OR $6::boolean
          OR (
            ($3::boolean AND e.metadata #>> '{mediaDiscovery,wikimedia-commons,portrait,status}' = 'no_candidate')
            OR
            (NOT $3::boolean AND NOT EXISTS (
               SELECT 1
               FROM entities discovery_entity
               WHERE discovery_entity.id = e.id
                 AND discovery_entity.metadata #>> '{mediaDiscovery,wikimedia-commons,portrait,status}' IN ('no_candidate', 'candidates')
                 AND (
                   discovery_entity.metadata #>> '{mediaDiscovery,wikimedia-commons,portrait,attemptedAt}'
                 )::timestamptz > NOW() - INTERVAL '30 days'
             ))
          )
        )
       GROUP BY e.id, e.canonical_name, e.metadata->>'sourceTeamName', rp.ranked_team_name, rp.best_rank, rp.ranking_count
       ORDER BY ${bestRankFirst ? 'rp.best_rank NULLS LAST, rp.ranking_count DESC' : 'rp.ranking_count DESC, rp.best_rank NULLS LAST'}, e.canonical_name, e.id LIMIT $1 OFFSET $2`,
      [limit, offset, retryNoCandidate, includePending, allRanked, resume, retryRecent]
    );
    if (players.rows.length === 0) {
      throw new Error(`No hay jugadores ${allRanked ? 'ranqueados' : 'jugables'} pendientes de descubrimiento: los candidatos restantes ya tienen un intento reciente; usa --retry-no-candidate para forzar una nueva pasada`);
    }
    const manifest: { kind: 'portrait'; offset: number; generatedAt: string; complete: boolean; entries: Array<Record<string, unknown>> } = {
      kind: 'portrait', offset, generatedAt: new Date().toISOString(), complete: false, entries: []
    };
    await mkdir(resolve(config.mediaCandidateRoot), { recursive: true });
    const outputPath = requestedManifestPath
      ? resolve(requestedManifestPath)
      : resolve(config.mediaCandidateRoot, `players-portrait-${Date.now()}-${offset}-${limit}.json`);
    if (resume) {
      const existing = JSON.parse(await readFile(outputPath, 'utf8')) as typeof manifest;
      if (existing.kind !== 'portrait' || existing.offset !== offset) {
        throw new Error('El manifiesto no corresponde al lote de retratos solicitado');
      }
      manifest.generatedAt = existing.generatedAt;
      // Keep entries from earlier passes even when the discovery queue has
      // changed because recent attempts or newly approved portraits now make
      // those entities ineligible. They are part of the audit trail and must
      // not disappear from a resumable manifest.
      manifest.entries = existing.entries ?? [];
    }
    await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    for (let batchStart = 0; batchStart < players.rows.length; batchStart += concurrency) {
      const batch = players.rows.slice(batchStart, batchStart + concurrency);
      const results = await Promise.all(batch.map(async (player) => {
        const previous = manifest.entries.find((entry) => entry.entityId === player.id);
        if (previous && !('error' in previous)) {
          await recordCommonsDiscoveryAttempt(player.id, (previous.candidates as CommonsImageCandidate[] | undefined) ?? []);
          return null;
        }
        try {
          const candidates = await searchCommonsCandidates(player.canonical_name, 'portrait', 5, player.aliases, player.source_team_name ?? undefined, { fast, wikidataOnly });
          const filteredCandidates = await removeRegisteredCommonsCandidates(player.id, 'portrait', candidates);
          const next = { entityId: player.id, entityName: player.canonical_name, aliases: player.aliases, teamName: player.source_team_name, candidates: filteredCandidates };
          await recordCommonsDiscoveryAttempt(player.id, filteredCandidates);
          return next;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const next = { entityId: player.id, entityName: player.canonical_name, aliases: player.aliases, error: errorMessage, candidates: [] };
          await recordCommonsDiscoveryAttempt(player.id, [], errorMessage);
          return next;
        }
      }));
      for (const next of results) {
        if (!next) continue;
        const previousIndex = manifest.entries.findIndex((entry) => entry.entityId === next.entityId);
        if (previousIndex >= 0) manifest.entries[previousIndex] = next;
        else manifest.entries.push(next);
      }
      await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
      if (batchStart + batch.length < players.rows.length && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    const completedEntityIds = new Set(
      manifest.entries.filter((entry) => !('error' in entry)).map((entry) => String(entry.entityId))
    );
    manifest.complete = players.rows.every((player) => completedEntityIds.has(player.id));
    await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(JSON.stringify({ outputPath, entries: manifest.entries.length, complete: manifest.complete, retryRecent }, null, 2));
  } else if (command === 'discover-commons-clubs') {
    const limit = Number(argument('limit') ?? 20);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? 1500);
    const concurrency = Number(argument('concurrency') ?? 1);
    const fast = args.includes('--fast');
    const retryNoCandidate = args.includes('--retry-no-candidate');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10_000 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
      throw new Error('Los límites deben ser válidos: --offset >=0, --limit 1-100, --delay-ms 0-10000 y --concurrency 1-8');
    }
    const clubs = await pool.query<{ id: string; canonical_name: string; aliases: string[] }>(
      `WITH playable_entities AS (
         SELECT DISTINCT COALESCE(identity_link.canonical_entity_id, egp.entity_id) AS entity_id
         FROM entity_game_profiles egp
         JOIN entities profile_entity ON profile_entity.id = egp.entity_id
         LEFT JOIN entity_identity_links identity_link
           ON identity_link.source_entity_id = egp.entity_id
         WHERE egp.playable_default = TRUE
           AND profile_entity.entity_type IN ('club', 'national_team')
       )
       SELECT e.id, e.canonical_name,
              COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
       FROM playable_entities playable
       JOIN entities e ON e.id = playable.entity_id
       LEFT JOIN entity_aliases a ON a.entity_id = e.id
       WHERE e.entity_type IN ('club', 'national_team')
         AND (
           $3::boolean
           OR e.metadata #>> '{mediaDiscovery,wikimedia-commons,badge,attemptedAt}' IS NULL
           OR (e.metadata #>> '{mediaDiscovery,wikimedia-commons,badge,attemptedAt}')::timestamptz <= NOW() - INTERVAL '30 days'
         )
       GROUP BY e.id, e.canonical_name, e.entity_type
       ORDER BY e.entity_type, e.canonical_name LIMIT $1 OFFSET $2`,
      [limit, offset, retryNoCandidate]
    );
    if (clubs.rows.length === 0) throw new Error('No hay clubes Pulselive importados');
    const manifest: { kind: 'badge'; generatedAt: string; complete: boolean; entries: Array<Record<string, unknown>> } = {
      kind: 'badge', generatedAt: new Date().toISOString(), complete: false, entries: []
    };
    await mkdir(resolve(config.mediaCandidateRoot), { recursive: true });
    const outputPath = resolve(config.mediaCandidateRoot, `clubs-badge-${Date.now()}-${offset}-${limit}.json`);
    await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    for (let batchStart = 0; batchStart < clubs.rows.length; batchStart += concurrency) {
      const batch = clubs.rows.slice(batchStart, batchStart + concurrency);
      const entries = await Promise.all(batch.map(async (club) => {
        try {
          return await Promise.race([
            (async () => {
              const candidates = await searchCommonsCandidates(club.canonical_name, 'badge', 5, club.aliases, undefined, { fast });
              const filteredCandidates = await removeRegisteredCommonsCandidates(club.id, 'badge', candidates);
              await recordCommonsDiscoveryAttempt(club.id, filteredCandidates, undefined, 'badge');
              return { entityId: club.id, entityName: club.canonical_name, aliases: club.aliases, candidates: filteredCandidates };
            })(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout en descubrimiento Commons del escudo')), 90_000))
          ]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await recordCommonsDiscoveryAttempt(club.id, [], message, 'badge');
          return { entityId: club.id, entityName: club.canonical_name, aliases: club.aliases, error: message, candidates: [] };
        }
      }));
      manifest.entries.push(...entries);
      await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
      if (batchStart + batch.length < clubs.rows.length && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    manifest.complete = manifest.entries.length === clubs.rows.length && manifest.entries.every((entry) => !('error' in entry));
    await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(JSON.stringify({ outputPath, entries: manifest.entries.length, complete: manifest.complete }, null, 2));
  } else if (command === 'discover-thesportsdb-badges' || command === 'stage-thesportsdb-badges') {
    const snapshotId = argument('snapshot');
    const limit = Number(argument('limit') ?? 20);
    const delayMs = Number(argument('delay-ms') ?? config.theSportsDbMinRequestIntervalMs);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
      throw new Error('Los límites deben ser válidos: --limit 1-100 y --delay-ms 0-60000');
    }
    const clubs = snapshotId
      ? await pool.query<{ id: string; canonical_name: string }>(
        `SELECT DISTINCT re.entity_id AS id, e.canonical_name
         FROM ranking_entries re
         JOIN entities e ON e.id = re.entity_id
         WHERE re.snapshot_id = $1 AND re.rank <= ${MAX_GAME_RANKING_ENTRIES} AND e.entity_type = 'club'
           AND NOT EXISTS (
           SELECT 1 FROM image_assets ia
            WHERE ia.entity_id = e.id AND ia.asset_kind = 'badge'
              AND ia.review_status = 'approved'
           )
           AND NOT EXISTS (
           SELECT 1 FROM image_assets ia
            WHERE ia.entity_id = e.id AND ia.asset_kind = 'badge'
              AND ia.provider = 'thesportsdb'
              AND ia.review_status IN ('approved', 'pending')
           )
         ORDER BY e.canonical_name LIMIT $2`,
        [snapshotId, limit]
      )
      : await pool.query<{ id: string; canonical_name: string }>(
        `SELECT e.id, e.canonical_name
         FROM entities e
         JOIN entity_game_profiles egp ON egp.entity_id = e.id AND egp.playable_default = TRUE
         WHERE e.entity_type = 'club'
           AND NOT EXISTS (
             SELECT 1 FROM image_assets ia
             WHERE ia.entity_id = e.id AND ia.asset_kind = 'badge'
               AND ia.review_status = 'approved'
           )
           AND NOT EXISTS (
             SELECT 1 FROM image_assets ia
             WHERE ia.entity_id = e.id AND ia.asset_kind = 'badge'
               AND ia.provider = 'thesportsdb'
               AND ia.review_status IN ('approved', 'pending')
           )
         ORDER BY e.canonical_name LIMIT $1`,
        [limit]
      );
    if (clubs.rows.length === 0) throw new Error('No hay clubes pendientes en el ámbito solicitado');
    const entries: Array<Record<string, unknown>> = [];
    for (const [index, club] of clubs.rows.entries()) {
      try {
        const candidate = await resolveTheSportsDbBadge(club.canonical_name, theSportsDbAliases[club.canonical_name] ?? []);
        if (candidate && command === 'stage-thesportsdb-badges') await stageTheSportsDbBadge(club.id, candidate);
        entries.push({ entityId: club.id, entityName: club.canonical_name, candidate, staged: Boolean(candidate && command === 'stage-thesportsdb-badges') });
      } catch (error) {
        entries.push({ entityId: club.id, entityName: club.canonical_name, candidate: null, error: error instanceof Error ? error.message : String(error), staged: false });
      }
      if (index < clubs.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'thesportsdb', mode: command === 'stage-thesportsdb-badges' ? 'stage-pending' : 'discover-only', ...(snapshotId ? { snapshotId } : {}), entries, note: 'Los escudos quedan review_required y no son publicables sin licencia comercial revisada.' }, null, 2));
  } else if (command === 'stage-thesportsdb-portraits') {
    const snapshotId = argument('snapshot');
    const limit = Number(argument('limit') ?? MAX_GAME_RANKING_ENTRIES);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? config.theSportsDbMinRequestIntervalMs);
    const includeLegacy = args.includes('--include-legacy');
    if (!snapshotId || !Number.isInteger(limit) || limit < 1 || limit > MAX_GAME_RANKING_ENTRIES || !Number.isInteger(offset) || offset < 0 || offset >= MAX_GAME_RANKING_ENTRIES || offset + limit > MAX_GAME_RANKING_ENTRIES || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
      throw new Error(`Faltan --snapshot o hay límites inválidos: --limit 1-${MAX_GAME_RANKING_ENTRIES}, --offset 0-${MAX_GAME_RANKING_ENTRIES - 1} y --delay-ms 0-60000`);
    }
    const ranking = await pool.query<{ entity_id: string; canonical_name: string; rank: number; thesportsdb_id: string | null }>(
      `SELECT DISTINCT ON (canonical_entity.id)
              canonical_entity.id AS entity_id, canonical_entity.canonical_name, re.rank
              ,(SELECT external_id FROM entity_external_ids
                WHERE entity_id = canonical_entity.id AND source_key = 'thesportsdb-artwork' AND entity_type = 'player'
                ORDER BY external_id LIMIT 1) AS thesportsdb_id
       FROM ranking_entries re
       JOIN entities source_entity ON source_entity.id = re.entity_id
       LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = source_entity.id
       JOIN entities canonical_entity ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, source_entity.id)
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = canonical_entity.id
       WHERE re.snapshot_id = $1 AND re.rank <= ${MAX_GAME_RANKING_ENTRIES} AND source_entity.entity_type = 'player'
         AND ($4::boolean OR COALESCE(egp.playable_default, FALSE) = TRUE)
         AND NOT EXISTS (
           SELECT 1 FROM image_assets existing
           WHERE existing.entity_id = canonical_entity.id
             AND existing.asset_kind = 'portrait'
             AND existing.is_primary = TRUE
             AND existing.review_status = 'approved'
             AND existing.rights_basis <> 'unknown'
             AND existing.commercial_use = TRUE
             AND existing.rights_verified_at IS NOT NULL
             AND existing.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(existing.usage_scope) > 0
             AND (existing.attribution_required = FALSE OR NULLIF(existing.attribution_text, '') IS NOT NULL)
         )
         AND NOT EXISTS (
           SELECT 1 FROM image_assets ia
           WHERE ia.entity_id = canonical_entity.id AND ia.asset_kind = 'portrait'
             AND ia.provider = 'thesportsdb' AND ia.review_status IN ('approved', 'pending')
         )
       ORDER BY canonical_entity.id, re.rank, source_entity.id
       LIMIT $2 OFFSET $3`,
      [snapshotId, limit, offset, includeLegacy]
    );
    if (ranking.rows.length === 0) throw new Error(`No hay retratos pendientes en el snapshot: ${snapshotId}`);
    const entries: Array<Record<string, unknown>> = [];
    for (const [index, row] of ranking.rows.entries()) {
      try {
        const candidate = row.thesportsdb_id
          ? await resolveTheSportsDbPortraitById(row.thesportsdb_id)
          : await resolveTheSportsDbPortrait(row.canonical_name, aliasesForTheSportsDbPortrait(row.canonical_name));
        if (candidate) await stageTheSportsDbPortrait(row.entity_id, candidate);
        entries.push({ entityId: row.entity_id, entityName: row.canonical_name, rank: row.rank, candidate, staged: Boolean(candidate) });
      } catch (error) {
        entries.push({ entityId: row.entity_id, entityName: row.canonical_name, rank: row.rank, candidate: null, error: error instanceof Error ? error.message : String(error), staged: false });
      }
      if (index < ranking.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'thesportsdb', mode: 'stage-pending', snapshotId, includeLegacy, entries, note: 'Los retratos quedan review_required y no son publicables sin licencia comercial revisada.' }, null, 2));
  } else if (command === 'stage-thesportsdb-playable-portraits') {
    const limit = Number(argument('limit') ?? 100);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? config.theSportsDbMinRequestIntervalMs);
    const entityFilter = argument('entity');
    const retryRecent = args.includes('--retry-recent');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
      throw new Error('Los límites deben ser válidos: --limit 1-100, --offset >=0 y --delay-ms 0-60000');
    }
    const players = await pool.query<{ entity_id: string; canonical_name: string; thesportsdb_id: string | null; aliases: string[]; rank: number | null; ranking_count: number }>(
      `SELECT canonical_entity.id AS entity_id, canonical_entity.canonical_name,
              MIN(re.rank) FILTER (WHERE rs.id IS NOT NULL) AS rank,
              COUNT(DISTINCT rs.category_id)::int AS ranking_count,
              (SELECT external_id FROM entity_external_ids
               WHERE entity_id = canonical_entity.id AND source_key = 'thesportsdb-artwork' AND entity_type = 'player'
               ORDER BY external_id LIMIT 1) AS thesportsdb_id,
              (SELECT COALESCE(array_agg(alias ORDER BY alias), '{}')
               FROM entity_aliases
               WHERE entity_id = canonical_entity.id) AS aliases
       FROM entities e
       JOIN entity_game_profiles egp ON egp.entity_id = e.id AND egp.playable_default = TRUE
       LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = e.id
       JOIN entities canonical_entity ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, e.id)
       LEFT JOIN ranking_entries re ON re.entity_id = e.id
       LEFT JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
       WHERE e.entity_type = 'player'
         -- The media pool is the ranked playable pool, not every playable
         -- profile.  Without this guard pagination eventually spent API
         -- calls on players that can never appear in a game ranking.
         AND rs.id IS NOT NULL
         AND re.rank <= ${MAX_GAME_RANKING_ENTRIES}
         AND ($2::boolean OR COALESCE(canonical_entity.metadata #>> '{mediaDiscovery,thesportsdb,portrait,status}', '') NOT IN ('no_candidate', 'candidate', 'error'))
         AND NOT EXISTS (
           SELECT 1 FROM image_assets ia
           LEFT JOIN entity_identity_links image_identity ON image_identity.source_entity_id = ia.entity_id
           WHERE COALESCE(image_identity.canonical_entity_id, ia.entity_id) = canonical_entity.id
             AND ia.asset_kind = 'portrait'
             AND ia.is_primary = TRUE AND ia.review_status = 'approved'
             AND ia.rights_basis <> 'unknown' AND ia.commercial_use = TRUE
             AND ia.rights_verified_at IS NOT NULL AND ia.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(ia.usage_scope) > 0
             AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
         )
         AND NOT EXISTS (
           SELECT 1 FROM image_assets ia
           LEFT JOIN entity_identity_links image_identity ON image_identity.source_entity_id = ia.entity_id
           WHERE COALESCE(image_identity.canonical_entity_id, ia.entity_id) = canonical_entity.id
             AND ia.asset_kind = 'portrait'
             AND ia.review_status = 'pending'
             AND ia.local_path IS NOT NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM image_assets ia
           LEFT JOIN entity_identity_links image_identity ON image_identity.source_entity_id = ia.entity_id
           WHERE COALESCE(image_identity.canonical_entity_id, ia.entity_id) = canonical_entity.id
             AND ia.asset_kind = 'portrait'
             AND ia.provider = 'thesportsdb' AND ia.review_status IN ('approved', 'pending')
         )
         AND ($4::text IS NULL OR canonical_entity.id = $4)
       GROUP BY canonical_entity.id, canonical_entity.canonical_name
       ORDER BY COUNT(DISTINCT rs.category_id) DESC,
                MIN(re.rank) FILTER (WHERE rs.id IS NOT NULL) NULLS LAST,
                canonical_entity.canonical_name, canonical_entity.id
       LIMIT $1 OFFSET $3`,
      [limit, retryRecent, offset, entityFilter ?? null]
    );
    if (players.rows.length === 0) throw new Error('No hay jugadores jugables pendientes para TheSportsDB');
    const entries: Array<Record<string, unknown>> = [];
    for (const [index, player] of players.rows.entries()) {
      try {
        const candidate = player.thesportsdb_id
          ? await resolveTheSportsDbPortraitById(player.thesportsdb_id)
          : await resolveTheSportsDbPortrait(player.canonical_name, [
              ...aliasesForTheSportsDbPortrait(player.canonical_name),
              ...(player.aliases ?? [])
            ]);
        if (candidate) await stageTheSportsDbPortrait(player.entity_id, candidate);
        await recordTheSportsDbDiscoveryAttempt(player.entity_id, candidate);
        entries.push({ entityId: player.entity_id, entityName: player.canonical_name, rank: player.rank, rankingCount: player.ranking_count, candidate, staged: Boolean(candidate) });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await recordTheSportsDbDiscoveryAttempt(player.entity_id, null, errorMessage);
        entries.push({ entityId: player.entity_id, entityName: player.canonical_name, rank: player.rank, rankingCount: player.ranking_count, candidate: null, error: errorMessage, staged: false });
      }
      if (index < players.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'thesportsdb', mode: 'stage-playable-pending', retryRecent, offset, ...(entityFilter ? { entityFilter } : {}), entries, note: 'Solo se procesan jugadores sin retrato aprobado ni candidato local pendiente; los resultados ya registrados se saltan en pasadas normales y solo se reabren con --retry-recent. Los activos quedan review_required.' }, null, 2));
  } else if (command === 'stage-api-football-from-thesportsdb') {
    const limit = Number(argument('limit') ?? 100);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? config.theSportsDbMinRequestIntervalMs);
    const includePending = args.includes('--include-pending');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
      throw new Error('Los límites deben ser válidos: --limit 1-100, --offset >=0 y --delay-ms 0-60000');
    }
    const players = await pool.query<{ entity_id: string; canonical_name: string; aliases: string[]; source_team_name: string | null }>(
      `SELECT DISTINCT ON (canonical_entity.id)
              canonical_entity.id AS entity_id, canonical_entity.canonical_name,
              canonical_entity.metadata->>'sourceTeamName' AS source_team_name,
              (SELECT COALESCE(array_agg(alias ORDER BY alias), '{}')
               FROM entity_aliases
               WHERE entity_id = canonical_entity.id) AS aliases
       FROM entities e
       JOIN entity_game_profiles egp ON egp.entity_id = e.id AND egp.playable_default = TRUE
       LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = e.id
       JOIN entities canonical_entity ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, e.id)
       WHERE e.entity_type = 'player'
         AND canonical_entity.catalog_status = 'active'
         -- This enrichment exists only for the current game pool.  Do not
         -- spend provider requests on playable profiles that are not present
         -- in an active top-200 ranking.
         AND EXISTS (
           SELECT 1
           FROM ranking_entries ranked_entry
           JOIN ranking_snapshots ranked_snapshot
             ON ranked_snapshot.id = ranked_entry.snapshot_id
            AND ranked_snapshot.status <> 'superseded'
           LEFT JOIN entity_identity_links ranked_identity
             ON ranked_identity.source_entity_id = ranked_entry.entity_id
          WHERE ranked_entry.rank <= ${MAX_GAME_RANKING_ENTRIES}
            AND COALESCE(ranked_identity.canonical_entity_id, ranked_entry.entity_id) = canonical_entity.id
         )
         AND COALESCE(canonical_entity.metadata #>> '{mediaDiscovery,thesportsdb,portrait,status}', '')
             NOT IN ('no_candidate', 'error')
         AND NOT EXISTS (
           SELECT 1
           FROM image_assets ia
           LEFT JOIN entity_identity_links image_identity ON image_identity.source_entity_id = ia.entity_id
           WHERE COALESCE(image_identity.canonical_entity_id, ia.entity_id) = canonical_entity.id
             AND ia.asset_kind = 'portrait'
             AND ia.local_path IS NOT NULL
         )
         ${includePending ? '' : `AND NOT EXISTS (
           SELECT 1 FROM image_assets ia
           WHERE ia.entity_id = canonical_entity.id AND ia.asset_kind = 'portrait'
             AND COALESCE(ia.media_status, 'required') = 'required'
             AND ia.review_status = 'pending'
             AND ia.provider IN ('wikimedia-commons', 'openverse')
         )`}
       ORDER BY canonical_entity.id, e.id
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const entries: Array<Record<string, unknown>> = [];
    for (const [index, target] of players.rows.entries()) {
      try {
        const aliases = [...new Set([
          ...aliasesForTheSportsDbPortrait(target.canonical_name),
          ...(target.aliases ?? [])
        ])];
        const resolved = await resolveTheSportsDbPlayer(target.canonical_name, aliases);
        // searchplayers.php omits idAPIfootball in many records. Enrich only
        // the exact match we are about to stage through lookupplayer.php.
        const detailedPlayer = resolved?.player.idAPIfootball
          ? resolved.player
          : resolved
            ? await lookupTheSportsDbPlayerById(resolved.player.idPlayer)
            : null;
        const providerPlayer = detailedPlayer ?? resolved?.player ?? null;
        let fallback: Awaited<ReturnType<typeof resolveApiFootballPlayerByTeam>> = null;
        if (!providerPlayer?.idAPIfootball && target.source_team_name) {
          fallback = await resolveApiFootballPlayerByTeam(new ApiFootballClient(), target.source_team_name, target.canonical_name, aliases, Number(argument('season') ?? 2024));
        }
        const providerPlayerId = providerPlayer?.idAPIfootball?.trim() || fallback?.player.id || null;
        if (!providerPlayerId || !/^\d+$/u.test(providerPlayerId)) {
          entries.push({ entityId: target.entity_id, entityName: target.canonical_name, status: 'no_api_football_id', providerPlayerName: providerPlayer?.strPlayer ?? fallback?.player.name ?? null, sourceTeamName: target.source_team_name });
        } else {
          const sourceUrl = `https://media.api-sports.io/football/players/${providerPlayerId}.png`;
          const assetId = `img_${createHash('sha256').update(`${target.entity_id}:portrait:${sourceUrl}`).digest('hex').slice(0, 24)}`;
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(
              `INSERT INTO sources (key, name, source_type, base_url, rights_status)
               VALUES ('api-football', 'API-Football / API-Sports', 'api', 'https://www.api-football.com/', 'review_required')
               ON CONFLICT (key) DO NOTHING`
            );
            await ensureExternalEntityLink(client, 'api-football', 'player', providerPlayerId, target.entity_id, {
              source: fallback ? 'api-football-team-season' : 'thesportsdb',
              sourcePlayerId: providerPlayer?.idPlayer ?? null,
              sourcePlayerName: providerPlayer?.strPlayer ?? fallback?.player.name ?? null,
              sourceSport: providerPlayer?.strSport ?? 'Soccer',
              sourceTeam: providerPlayer?.strTeam ?? fallback?.team.name ?? target.source_team_name,
              sourceApiUrl: resolved?.apiUrl ?? 'https://v3.football.api-sports.io/players'
            });
            const providerPlayerName = providerPlayer?.strPlayer ?? fallback?.player.name ?? null;
            if (providerPlayerName) {
              await client.query(
                `INSERT INTO entity_aliases (entity_id, alias, source_key)
                 VALUES ($1, $2, 'thesportsdb-identity-audit')
                 ON CONFLICT (entity_id, alias) DO NOTHING`,
                [target.entity_id, providerPlayerName]
              );
            }
            await client.query(
              `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, provider, license_url, width, height, mime_type, sha256, is_primary, review_status, metadata)
               VALUES ($1, $2, 'portrait', $3, 'api-football', 'https://www.api-football.com/terms', 512, 512, 'image/png', $4, FALSE, 'pending', $5)
               ON CONFLICT (id) DO NOTHING`,
              [assetId, target.entity_id, sourceUrl, createHash('sha256').update(sourceUrl).digest('hex'), JSON.stringify({
                purpose: 'candidate_only',
                rightsStatus: 'review_required',
                source: fallback ? 'api-football-team-season' : 'thesportsdb-exact-player',
                sourcePlayerId: providerPlayer?.idPlayer ?? null,
                sourcePlayerName: providerPlayer?.strPlayer ?? fallback?.player.name ?? null,
                sourceSport: providerPlayer?.strSport ?? 'Soccer',
                sourceTeam: providerPlayer?.strTeam ?? fallback?.team.name ?? target.source_team_name,
                sourceApiUrl: resolved?.apiUrl ?? 'https://v3.football.api-sports.io/players',
                sourceSeason: fallback ? Number(argument('season') ?? 2024) : null,
                sourceTeamId: fallback?.team.id ?? null,
                providerPlayerId
              })]
            );
            await client.query('COMMIT');
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally {
            client.release();
          }
          const current = await pool.query<{ review_status: string }>('SELECT review_status FROM image_assets WHERE id = $1', [assetId]);
          if (current.rows[0]?.review_status !== 'pending') {
            entries.push({ entityId: target.entity_id, entityName: target.canonical_name, status: 'existing_asset', assetId, reviewStatus: current.rows[0]?.review_status ?? null });
          } else {
            const normalized = await stageApiFootballMedia(assetId, target.entity_id, 'portrait', sourceUrl);
            entries.push({ entityId: target.entity_id, entityName: target.canonical_name, status: 'staged', assetId, providerPlayerName: providerPlayer?.strPlayer ?? fallback?.player.name ?? null, providerPlayerId, ...normalized });
          }
        }
      } catch (error) {
        entries.push({ entityId: target.entity_id, entityName: target.canonical_name, status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
      if (index < players.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'api-football', mode: 'stage-exact-from-thesportsdb', staged: entries.filter((entry) => entry.status === 'staged').length, noApiFootballId: entries.filter((entry) => entry.status === 'no_api_football_id').length, errors: entries.filter((entry) => entry.status === 'error').length, entries, note: 'La identidad se valida por nombre exacto y deporte Soccer en TheSportsDB; la imagen y sus derechos siguen pending.' }, null, 2));
  } else if (command === 'audit-thesportsdb-player-media') {
    const limit = Number(argument('limit') ?? 100);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? config.theSportsDbMinRequestIntervalMs);
    const unverifiedOnly = args.includes('--unverified-only');
    if (!Number.isInteger(limit) || limit < 1 || limit > 600 || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
      throw new Error('Los límites deben ser válidos: --limit 1-600, --offset >=0 y --delay-ms 0-60000');
    }
    const assets = await pool.query<{ id: string; entity_id: string; canonical_name: string; aliases: string[]; external_id: string | null }>(
      `SELECT ia.id, ia.entity_id, e.canonical_name,
              COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases,
              ia.metadata->>'externalId' AS external_id
       FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id AND e.entity_type = 'player'
       LEFT JOIN entity_aliases a ON a.entity_id = e.id
       WHERE ia.provider = 'thesportsdb' AND ia.asset_kind = 'portrait'
         AND e.catalog_status = 'active'
         AND COALESCE(ia.media_status, 'required') = 'required'
         AND ia.review_status = 'pending' AND ia.local_path IS NOT NULL
         AND ($3::boolean = FALSE OR ia.metadata->'identityAudit' IS NULL)
       GROUP BY ia.id, ia.entity_id, e.canonical_name, ia.metadata->>'externalId'
       ORDER BY ia.id LIMIT $1 OFFSET $2`,
      [limit, offset, unverifiedOnly]
    );
    const entries: Array<Record<string, unknown>> = [];
    for (const [index, asset] of assets.rows.entries()) {
      try {
        if (!asset.external_id) {
          entries.push({ assetId: asset.id, entityId: asset.entity_id, entityName: asset.canonical_name, status: 'unverified', reason: 'Falta el identificador TheSportsDB' });
        } else {
          const player = await lookupTheSportsDbPlayerById(asset.external_id);
          if (!player) {
            entries.push({ assetId: asset.id, entityId: asset.entity_id, entityName: asset.canonical_name, status: 'unverified', reason: 'TheSportsDB no devolvió el registro del jugador' });
          } else {
            const acceptedNames = new Set([
              asset.canonical_name,
              ...asset.aliases,
              ...aliasesForTheSportsDbPortrait(asset.canonical_name)
            ].map(normalizeTheSportsDbName));
            const providerNameMatches = acceptedNames.has(normalizeTheSportsDbName(player.strPlayer));
            const nonFootball = player.strSport ? normalizeTheSportsDbName(player.strSport) !== 'soccer' : false;
            const nonPlayerRole = ['manager', 'head coach', 'assistant manager', 'coach']
              .includes(normalizeTheSportsDbName(player.strPosition ?? ''));
            const rejectionReason = nonFootball
              ? `El proveedor identifica el deporte como ${player.strSport}`
              : nonPlayerRole
                ? `El proveedor identifica el registro como ${player.strPosition}`
              : !providerNameMatches
                ? `El nombre del proveedor (${player.strPlayer}) no coincide con la entidad`
                : null;
            const providerEvidence = {
              providerSport: player.strSport ?? null,
              providerTeam: player.strTeam ?? null,
              providerPosition: player.strPosition ?? null,
              providerNationality: player.strNationality ?? null,
              providerBirthDate: player.dateBorn ?? null,
              providerCreativeCommons: player.strCreativeCommons ?? null,
              identityAudit: { auditedAt: new Date().toISOString(), providerNameMatches, nonFootball, nonPlayerRole }
            };
            if (rejectionReason) {
              await pool.query(
                `UPDATE image_assets
                 SET review_status = 'rejected', is_primary = FALSE,
                     metadata = metadata || $2::jsonb || jsonb_build_object('rejectionReason', $3::text)
                 WHERE id = $1 AND review_status = 'pending'`,
                [asset.id, JSON.stringify(providerEvidence), rejectionReason]
              );
              entries.push({ assetId: asset.id, entityId: asset.entity_id, entityName: asset.canonical_name, status: 'rejected', providerName: player.strPlayer, providerSport: player.strSport, reason: rejectionReason });
            } else {
              await pool.query(
                `UPDATE image_assets SET metadata = metadata || $2::jsonb WHERE id = $1 AND review_status = 'pending'`,
                [asset.id, JSON.stringify(providerEvidence)]
              );
              await pool.query(
                `INSERT INTO entity_aliases (entity_id, alias, source_key)
                 VALUES ($1, $2, 'thesportsdb-identity-audit')
                 ON CONFLICT (entity_id, alias) DO NOTHING`,
                [asset.entity_id, player.strPlayer]
              );
              entries.push({ assetId: asset.id, entityId: asset.entity_id, entityName: asset.canonical_name, status: 'verified', providerName: player.strPlayer, providerSport: player.strSport, providerCreativeCommons: player.strCreativeCommons ?? null });
            }
          }
        }
      } catch (error) {
        entries.push({ assetId: asset.id, entityId: asset.entity_id, entityName: asset.canonical_name, status: 'unverified', error: error instanceof Error ? error.message : String(error) });
      }
      if (index < assets.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'thesportsdb', assetKind: 'portrait', offset, unverifiedOnly, audited: entries.length, verified: entries.filter((entry) => entry.status === 'verified').length, rejected: entries.filter((entry) => entry.status === 'rejected').length, entries, note: 'La auditoría valida identidad y deporte; no concede licencia ni aprueba publicación.' }, null, 2));
  } else if (command === 'backfill-thesportsdb-cc-licenses') {
    const limit = Number(argument('limit') ?? 100);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? config.theSportsDbMinRequestIntervalMs);
    const allPending = args.includes('--all-pending');
    if (!Number.isInteger(limit) || limit < 1 || limit > 600 || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
      throw new Error('Los límites deben ser válidos: --limit 1-600, --offset >=0 y --delay-ms 0-60000');
    }
    const assets = await pool.query<{ id: string; entity_id: string; canonical_name: string; source_url: string }>(
      `SELECT ia.id, ia.entity_id, e.canonical_name, ia.source_url
       FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id AND e.entity_type = 'player'
       WHERE ia.provider = 'thesportsdb' AND ia.asset_kind = 'portrait'
         AND ia.review_status = 'pending'
         AND ($3::boolean OR ia.metadata->>'providerCreativeCommons' = 'Yes')
       ORDER BY ia.id LIMIT $1 OFFSET $2`,
      [limit, offset, allPending]
    );
    const entries: Array<Record<string, unknown>> = [];
    for (const [index, asset] of assets.rows.entries()) {
      try {
        const evidence = await fetchTheSportsDbPlayerLicense(asset.source_url);
        if (!evidence) {
          entries.push({ assetId: asset.id, entityId: asset.entity_id, entityName: asset.canonical_name, status: 'not_found' });
        } else {
          await pool.query(
            `UPDATE image_assets
             SET license_name = $2, license_url = $3,
                 metadata = metadata || $4::jsonb
             WHERE id = $1 AND review_status = 'pending'`,
            [asset.id, evidence.licenseName, evidence.licenseUrl, JSON.stringify({ providerLicenseName: evidence.licenseName, providerLicenseUrl: evidence.licenseUrl, licenseEvidenceUrl: evidence.sourceUrl, rightsStatus: 'review_required' })]
          );
          entries.push({ assetId: asset.id, entityId: asset.entity_id, entityName: asset.canonical_name, status: 'backfilled', licenseName: evidence.licenseName, licenseUrl: evidence.licenseUrl, evidenceUrl: evidence.sourceUrl });
        }
      } catch (error) {
        entries.push({ assetId: asset.id, entityId: asset.entity_id, entityName: asset.canonical_name, status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
      if (index < assets.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'thesportsdb', assetKind: 'portrait', offset, allPending, scanned: entries.length, backfilled: entries.filter((entry) => entry.status === 'backfilled').length, notFound: entries.filter((entry) => entry.status === 'not_found').length, errors: entries.filter((entry) => entry.status === 'error').length, entries, note: 'La licencia concreta queda registrada como evidencia; los activos siguen pending hasta revisar ShareAlike, derechos de imagen y plan de publicación.' }, null, 2));
  } else if (command === 'stage-openverse-playable-portraits') {
    const limit = Number(argument('limit') ?? 20);
    const delayMs = Number(argument('delay-ms') ?? 500);
    const concurrency = Number(argument('concurrency') ?? 1);
    const retryRecent = args.includes('--retry-recent');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
      throw new Error('Los límites deben ser válidos: --limit 1-100, --delay-ms 0-60000 y --concurrency 1-8');
    }
    const authenticated = Boolean(config.openverseClientId.trim() && config.openverseClientSecret.trim());
    // Openverse supports anonymous requests, but their unauthenticated quota
    // is smaller. Keep the anonymous path deliberately bounded and serialized
    // so the low-cost fallback cannot create a burst or a 429 storm. The
    // provider client already applies the global request interval and records
    // failed attempts without staging a false asset.
    if (!authenticated && (limit > 20 || concurrency > 1)) {
      throw new Error('Openverse sin credenciales permite como máximo 20 jugadores y una concurrencia de 1; usa credenciales para lotes mayores.');
    }
    const players = await pool.query<{ entity_id: string; canonical_name: string; aliases: string[]; rank: number | null; ranking_count: number }>(
      `WITH ranked_players AS (
         SELECT COALESCE(identity_link.canonical_entity_id, re.entity_id) AS entity_id,
                MIN(re.rank)::int AS best_rank,
                COUNT(DISTINCT rs.category_id)::int AS ranking_count
         FROM ranking_entries re
         JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
         JOIN entities ranked_entity ON ranked_entity.id = re.entity_id AND ranked_entity.entity_type = 'player'
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = re.entity_id
         WHERE re.rank <= ${MAX_GAME_RANKING_ENTRIES}
         GROUP BY COALESCE(identity_link.canonical_entity_id, re.entity_id)
       )
       SELECT canonical_entity.id AS entity_id, canonical_entity.canonical_name,
              ranked_players.best_rank AS rank,
              ranked_players.ranking_count,
              COALESCE(array_agg(alias_entity.alias) FILTER (WHERE alias_entity.alias IS NOT NULL), '{}') AS aliases
       FROM ranked_players
       JOIN entities canonical_entity ON canonical_entity.id = ranked_players.entity_id AND canonical_entity.entity_type = 'player'
       LEFT JOIN entity_aliases alias_entity ON alias_entity.entity_id = canonical_entity.id
       WHERE EXISTS (
               SELECT 1 FROM entity_game_profiles egp
               WHERE egp.entity_id = canonical_entity.id AND egp.playable_default = TRUE
             )
         AND NOT EXISTS (
               SELECT 1 FROM image_assets ia
               WHERE ia.entity_id = canonical_entity.id AND ia.asset_kind = 'portrait'
                 AND ia.is_primary = TRUE AND ia.review_status = 'approved'
                 AND ia.rights_basis <> 'unknown' AND ia.commercial_use = TRUE
                 AND ia.rights_verified_at IS NOT NULL AND ia.rights_evidence_url IS NOT NULL
                 AND jsonb_array_length(ia.usage_scope) > 0
                 AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
             )
         AND NOT EXISTS (
               SELECT 1 FROM image_assets ia
               WHERE ia.entity_id = canonical_entity.id AND ia.asset_kind = 'portrait'
                 AND ia.provider = 'openverse' AND ia.review_status IN ('approved', 'pending')
             )
         AND (
               $2::boolean
               OR canonical_entity.metadata #>> '{mediaDiscovery,openverse,portrait,attemptedAt}' IS NULL
               OR (canonical_entity.metadata #>> '{mediaDiscovery,openverse,portrait,attemptedAt}')::timestamptz <= NOW() - INTERVAL '30 days'
             )
       GROUP BY canonical_entity.id, canonical_entity.canonical_name, ranked_players.best_rank, ranked_players.ranking_count
       ORDER BY ranked_players.ranking_count DESC, ranked_players.best_rank NULLS LAST, canonical_entity.canonical_name, canonical_entity.id
       LIMIT $1`,
      [limit, retryRecent]
    );
    if (players.rows.length === 0) throw new Error('No hay jugadores jugables ranqueados pendientes para Openverse');
    const entries: Array<Record<string, unknown>> = [];
    const processPlayer = async (player: typeof players.rows[number]): Promise<void> => {
      try {
        const found = await searchOpenversePlayerCandidates(player.canonical_name, { limit: 5, aliases: player.aliases });
        const stageErrors: string[] = [];
        let staged: { assetId: string; localPath: string; contentType: string } | null = null;
        for (const candidate of found.candidates) {
          try {
            staged = await stageOpenversePortrait(player.entity_id, candidate);
            break;
          } catch (error) {
            stageErrors.push(error instanceof Error ? error.message : String(error));
          }
        }
        await recordOpenverseDiscoveryAttempt(player.entity_id, found.candidates, stageErrors.length > 0 && !staged ? stageErrors.join('; ') : undefined);
        entries.push({ entityId: player.entity_id, entityName: player.canonical_name, rank: player.rank, rankingCount: player.ranking_count, apiUrl: found.apiUrl, candidates: found.candidates, staged, stageErrors });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // A provider/authentication/throttling failure is not a meaningful
        // discovery attempt. Do not suppress this player for the normal
        // 30-day retry window; keep the failure in the command output so the
        // operator can distinguish it from a genuine no-candidate result.
        if (!/^Openverse (?:401|429|5\d{2})\b/u.test(message)) {
          await recordOpenverseDiscoveryAttempt(player.entity_id, [], message);
        }
        entries.push({ entityId: player.entity_id, entityName: player.canonical_name, rank: player.rank, rankingCount: player.ranking_count, candidates: [], staged: null, error: message });
      }
    };
    for (let offset = 0; offset < players.rows.length; offset += concurrency) {
      const batch = players.rows.slice(offset, offset + concurrency);
      await Promise.all(batch.map((player) => processPlayer(player)));
      if (offset + concurrency < players.rows.length && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'openverse', assetKind: 'portrait', authenticated, attempted: entries.length, candidates: entries.reduce((total, entry) => total + ((entry.candidates as unknown[])?.length ?? 0), 0), staged: entries.filter((entry) => entry.staged).length, concurrency, entries, note: 'Los assets Openverse quedan pending hasta revisión visual y legal manual; las peticiones anónimas se mantienen en lote pequeño y serializado.' }, null, 2));
  } else if (command === 'stage-uefa-media') {
    const assetKind = argument('kind') as 'portrait' | 'badge' | undefined;
    const limit = Number(argument('limit') ?? 100);
    const delayMs = Number(argument('delay-ms') ?? 300);
    if (!assetKind || !['portrait', 'badge'].includes(assetKind) || !Number.isInteger(limit) || limit < 1 || limit > 600 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
      throw new Error('Faltan --kind portrait|badge o hay límites inválidos: --limit 1-600 y --delay-ms 0-60000');
    }
    const assets = await pool.query<{ id: string; entity_id: string; source_url: string }>(
      `SELECT ia.id, ia.entity_id, ia.source_url FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id
       WHERE ia.provider = 'uefa-official' AND ia.asset_kind = $1 AND ia.review_status = 'pending' AND ia.local_path IS NULL
         AND e.catalog_status = 'active'
         AND COALESCE(ia.media_status, 'required') = 'required'
         AND NOT EXISTS (
           SELECT 1 FROM image_assets existing
           WHERE existing.entity_id = COALESCE(
                   (SELECT eil.canonical_entity_id
                   FROM entity_identity_links eil
                   WHERE eil.source_entity_id = ia.entity_id),
                   ia.entity_id
                 )
             AND existing.asset_kind = ia.asset_kind
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
       ORDER BY ia.id LIMIT $2`,
      [assetKind, limit]
    );
    const entries: Array<Record<string, unknown>> = [];
    for (const [index, asset] of assets.rows.entries()) {
      try {
        const normalized = await stageUefaMedia(asset.id, asset.entity_id, assetKind, asset.source_url);
        entries.push({ assetId: asset.id, entityId: asset.entity_id, sourceUrl: asset.source_url, ...normalized, staged: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // A definitive 404 is not a licensing review state: the URL is dead and
        // retrying it on every media pass only creates noise. Keep transient
        // failures pending so they can be retried later.
        if (/\b404\b/.test(errorMessage)) {
          await pool.query(
            `UPDATE image_assets
             SET review_status = 'rejected', is_primary = FALSE,
                 metadata = metadata || jsonb_build_object('rejectionReason', 'La URL oficial devolvió 404', 'rejectedAt', NOW())
             WHERE id = $1 AND review_status = 'pending'`,
            [asset.id]
          );
        }
        entries.push({ assetId: asset.id, entityId: asset.entity_id, sourceUrl: asset.source_url, staged: false, reviewStatus: /\b404\b/.test(errorMessage) ? 'rejected' : 'pending', error: errorMessage });
      }
      if (index < assets.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'uefa-official', assetKind, staged: entries.filter((entry) => entry.staged).length, failed: entries.filter((entry) => !entry.staged).length, entries, note: 'Los activos siguen pending; descargar una imagen oficial no concede licencia de redistribución.' }, null, 2));
  } else if (command === 'stage-api-football-media') {
    const limit = Number(argument('limit') ?? 100);
    const delayMs = Number(argument('delay-ms') ?? 300);
    const assetKind = argument('kind') ?? 'portrait';
    // Do not download media for non-playable ranked rows unless an operator
    // explicitly requests the legacy all-ranked pool.
    const playableOnly = !args.includes('--all-ranked');
    if (!['portrait', 'badge'].includes(assetKind) || !Number.isInteger(limit) || limit < 1 || limit > 5000 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
      throw new Error('Los parámetros deben ser válidos: --kind portrait|badge, --limit 1-5000 y --delay-ms 0-60000');
    }
    const assets = await pool.query<{ id: string; entity_id: string; source_url: string }>(
      `SELECT ia.id, ia.entity_id, ia.source_url
       FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id
       WHERE ia.provider = 'api-football' AND ia.asset_kind = $2
         AND e.catalog_status = 'active'
         AND COALESCE(ia.media_status, 'required') = 'required'
         AND ia.review_status = 'pending' AND ia.local_path IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM image_assets existing
           WHERE existing.entity_id = COALESCE(
                   (SELECT eil.canonical_entity_id
                    FROM entity_identity_links eil
                    WHERE eil.source_entity_id = ia.entity_id),
                   ia.entity_id
                 )
             AND existing.asset_kind = $2
             AND existing.is_primary = TRUE AND existing.review_status = 'approved'
             AND existing.rights_basis <> 'unknown' AND existing.commercial_use = TRUE
             AND existing.rights_verified_at IS NOT NULL AND existing.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(existing.usage_scope) > 0
             AND (existing.asset_kind <> 'badge' OR existing.trademark_status = 'cleared')
             AND (existing.attribution_required = FALSE OR NULLIF(existing.attribution_text, '') IS NOT NULL)
         )
         AND ($3::boolean = FALSE OR EXISTS (
           SELECT 1
           FROM entity_game_profiles egp
           LEFT JOIN entity_identity_links profile_identity ON profile_identity.source_entity_id = egp.entity_id
           WHERE egp.playable_default
             AND COALESCE(profile_identity.canonical_entity_id, egp.entity_id) = COALESCE(
               (SELECT identity_link.canonical_entity_id
                FROM entity_identity_links identity_link
                WHERE identity_link.source_entity_id = ia.entity_id),
               ia.entity_id
             )
         ))
       ORDER BY ia.id LIMIT $1`,
      [limit, assetKind, playableOnly]
    );
    const entries: Array<Record<string, unknown>> = [];
    for (const [index, asset] of assets.rows.entries()) {
      try {
        const normalized = await stageApiFootballMedia(asset.id, asset.entity_id, assetKind as 'portrait' | 'badge', asset.source_url);
        entries.push({ assetId: asset.id, entityId: asset.entity_id, sourceUrl: asset.source_url, ...normalized, staged: true });
      } catch (error) {
        entries.push({ assetId: asset.id, entityId: asset.entity_id, sourceUrl: asset.source_url, staged: false, error: error instanceof Error ? error.message : String(error) });
      }
      if (index < assets.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'api-football', assetKind, staged: entries.filter((entry) => entry.staged).length, failed: entries.filter((entry) => !entry.staged).length, entries, note: 'Los activos siguen pending; API-Football no concede por sí sola licencia de redistribución.' }, null, 2));
  } else if (command === 'stage-commons') {
    const entityId = argument('entity');
    const title = argument('title');
    const requestedKind = argument('kind');
    if (!entityId || !title) throw new Error('Faltan --entity y --title');
    const candidate = await fetchCommonsFile(title);
    if (!candidate) throw new Error(`Archivo de Commons no encontrado: ${title}`);
    await stageCommonsCandidate(entityId, requestedKind, candidate);
  } else if (command === 'stage-commons-rest') {
    const entityId = argument('entity');
    const title = argument('title');
    const requestedKind = argument('kind');
    if (!entityId || !title) throw new Error('Faltan --entity y --title');
    const candidate = await fetchCommonsFileRest(title);
    if (!candidate) throw new Error(`Archivo de Commons no encontrado: ${title}`);
    await stageCommonsCandidate(entityId, requestedKind, candidate);
  } else if (command === 'stage-commons-manifest') {
    const entityId = argument('entity');
    const title = argument('title');
    const manifestPath = argument('manifest');
    const requestedKind = argument('kind');
    if (!entityId || !title || !manifestPath) throw new Error('Faltan --entity, --title o --manifest');
    const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8')) as {
      kind?: string;
      entries?: Array<{ entityId: string; candidates?: CommonsImageCandidate[] }>;
    };
    let entry = manifest.entries?.find((item) => item.entityId === entityId);
    if (!entry) {
      const linkedSource = await pool.query<{ source_entity_id: string }>(
        `SELECT source_entity_id FROM entity_identity_links
         WHERE canonical_entity_id = $1 AND source_entity_id = ANY($2::text[])`,
        [entityId, (manifest.entries ?? []).map((item) => item.entityId)]
      );
      const sourceEntityId = linkedSource.rows[0]?.source_entity_id;
      entry = manifest.entries?.find((item) => item.entityId === sourceEntityId);
    }
    const candidate = entry?.candidates?.find((item) => item.title === title
      && (!args.includes('--wikidata-only') || item.wikidataP18 === true));
    if (!candidate) throw new Error(`Candidato no encontrado en el manifiesto: ${title}`);
    await stageCommonsCandidate(entityId, requestedKind ?? manifest.kind, candidate);
  } else if (command === 'stage-commons-manifests') {
    const limit = Number(argument('limit') ?? 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('El límite debe ser un entero entre 1 y 100');
    const manifestFiles = (await readdir(resolve(config.mediaCandidateRoot)))
      .filter((file) => (file.startsWith('players-portrait-') || file.startsWith('clubs-badge-')) && file.endsWith('.json'))
      .sort();
    const processed = new Set<string>();
    const staged: Array<{ entityId: string; kind: 'portrait' | 'badge'; title: string; assetId?: string }> = [];
    const skipped: Array<{ entityId: string; reason: string }> = [];
    const errors: Array<{ entityId: string; title: string; error: string }> = [];
    for (const manifestFile of manifestFiles) {
      if (staged.length >= limit) break;
      const manifestPath = resolve(config.mediaCandidateRoot, manifestFile);
      type CommonsManifestKind = 'portrait' | 'badge';
      let manifest: { kind?: CommonsManifestKind; entries?: Array<{ entityId: string; entityName?: string; aliases?: string[]; candidates?: CommonsImageCandidate[] }> };
      try {
        manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as typeof manifest;
      } catch {
        continue;
      }
      const manifestKind = manifest.kind;
      if (manifestKind !== 'portrait' && manifestKind !== 'badge') continue;
      for (const entry of manifest.entries ?? []) {
        if (staged.length >= limit || !entry.entityId) continue;
        const canonicalEntityId = await resolveCanonicalEntityIdFromPool(entry.entityId);
        if (processed.has(canonicalEntityId)) continue;
        // A lote must stage at most one asset per canonical entity, even when
        // the same provider entity appears in several manifests. Do not mark
        // it before checking candidates: an earlier manifest can be empty
        // while a later one contains the valid file we need.
        const canonicalNameResult = await pool.query<{ canonical_name: string; source_team_name: string | null; aliases: string[] }>(
          `WITH identity_entities AS (
             SELECT $1::text AS entity_id
             UNION
             SELECT source_entity_id
             FROM entity_identity_links
             WHERE canonical_entity_id = $1
           )
           SELECT canonical.canonical_name,
                  canonical.metadata->>'sourceTeamName' AS source_team_name,
                  COALESCE(array_agg(DISTINCT alias_entity.alias) FILTER (WHERE alias_entity.alias IS NOT NULL), '{}') AS aliases
           FROM entities canonical
           JOIN identity_entities ON TRUE
           LEFT JOIN entity_aliases alias_entity ON alias_entity.entity_id = identity_entities.entity_id
           WHERE canonical.id = $1
           GROUP BY canonical.id, canonical.canonical_name, canonical.metadata->>'sourceTeamName'`,
          [canonicalEntityId]
        );
        const canonicalName = canonicalNameResult.rows[0]?.canonical_name;
        if (!canonicalName) {
          skipped.push({ entityId: canonicalEntityId, reason: 'canonical_entity_not_found' });
          continue;
        }
        const eligible = await pool.query<{ playable: boolean; has_approved: boolean; has_pending: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM entity_game_profiles egp
             LEFT JOIN entity_identity_links profile_link ON profile_link.source_entity_id = egp.entity_id
             WHERE COALESCE(profile_link.canonical_entity_id, egp.entity_id) = $1
               AND egp.playable_default = TRUE
           ) AS playable,
           EXISTS (
             SELECT 1 FROM image_assets ia
             WHERE ia.entity_id = $1 AND ia.asset_kind = $2
               AND ia.is_primary = TRUE AND ia.review_status = 'approved'
               AND ia.rights_basis <> 'unknown' AND ia.commercial_use = TRUE
               AND ia.rights_verified_at IS NOT NULL AND ia.rights_evidence_url IS NOT NULL
               AND jsonb_array_length(ia.usage_scope) > 0
               AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
           ) AS has_approved,
           EXISTS (
           SELECT 1 FROM image_assets ia
           WHERE ia.entity_id = $1 AND ia.asset_kind = $2
             AND COALESCE(ia.media_status, 'required') = 'required'
             AND ia.review_status = 'pending'
             AND ia.provider IN ('wikimedia-commons', 'openverse')
           ) AS has_pending`,
          [canonicalEntityId, manifestKind]
        );
        const eligibility = eligible.rows[0];
        if (!eligibility?.playable || eligibility.has_approved || eligibility.has_pending) {
          skipped.push({ entityId: canonicalEntityId, reason: !eligibility?.playable ? 'not_playable' : eligibility.has_approved ? `already_has_approved_${manifestKind}` : `already_has_pending_${manifestKind}` });
          continue;
        }
        const candidates = [...(entry.candidates ?? [])]
          .filter((candidate) => isValidCommonsCandidate(
            candidate,
            manifestKind,
            canonicalName,
            [...new Set([
              ...(canonicalNameResult.rows[0]?.aliases ?? []),
              ...(Array.isArray(entry.aliases) ? entry.aliases : []),
              ...(entry.entityName && entry.entityName !== canonicalName ? [entry.entityName] : [])
            ])],
            canonicalNameResult.rows[0]?.source_team_name ?? undefined
          ))
          .sort((left, right) => (right.width * right.height) - (left.width * left.height));
        if (candidates.length === 0) {
          skipped.push({ entityId: canonicalEntityId, reason: 'no_eligible_manifest_candidate' });
          continue;
        }
        let stagedThisEntity = false;
        for (const candidate of candidates) {
          try {
            await stageCommonsCandidate(canonicalEntityId, manifestKind, candidate);
            staged.push({ entityId: canonicalEntityId, kind: manifestKind, title: candidate.title });
            processed.add(canonicalEntityId);
            stagedThisEntity = true;
            break;
          } catch (error) {
            errors.push({ entityId: canonicalEntityId, title: candidate.title, error: error instanceof Error ? error.message : String(error) });
          }
        }
        if (!stagedThisEntity && errors.length === 0) skipped.push({ entityId: canonicalEntityId, reason: 'all_candidates_rejected' });
      }
    }
    console.log(JSON.stringify({ provider: 'wikimedia-commons', mode: 'stage-existing-manifests', manifestFiles: manifestFiles.length, staged, stagedCount: staged.length, skippedCount: skipped.length, errors, note: 'Solo entidades jugables sin activo aprobado ni candidato pendiente del tipo del manifiesto; los activos quedan en pending para revisión.' }, null, 2));
  } else if (command === 'approve-image') {
    const imageId = argument('id');
    const allowShareAlike = args.includes('--allow-share-alike');
    if (!imageId) throw new Error('Falta --id');
    const result = await pool.query<{
      id: string;
      entity_id: string;
      entity_type: 'player' | 'club' | 'national_team';
      asset_kind: 'portrait' | 'badge';
      local_path: string | null;
      provider: string;
      license_name: string | null;
      license_url: string | null;
      sha256: string;
      source_rights_status: string;
      provider_creative_commons: string | null;
      license_evidence_url: string | null;
    }>(
      `SELECT ia.id, ia.entity_id, e.entity_type, ia.asset_kind, ia.local_path, ia.provider, ia.license_name, ia.license_url, ia.sha256,
              COALESCE((SELECT rights_status FROM sources WHERE key = 'thesportsdb-artwork'), 'unknown') AS source_rights_status,
              ia.metadata->>'providerCreativeCommons' AS provider_creative_commons,
              ia.metadata->>'licenseEvidenceUrl' AS license_evidence_url
       FROM image_assets ia JOIN entities e ON e.id = ia.entity_id
       WHERE ia.id = $1
         AND ia.review_status IN ('pending', 'approved')
         AND (ia.review_status = 'pending' OR ia.rights_basis = 'unknown')`,
      [imageId]
    );
    const asset = result.rows[0];
    if (!asset) throw new Error(`Imagen inexistente o sin revisión de derechos pendiente: ${imageId}`);
    const rightsReview = assertRightsApproval({
      assetKind: asset.asset_kind,
      entityType: asset.entity_type,
      provider: asset.provider,
      licenseName: asset.license_name,
      licenseUrl: asset.license_url,
      sourceRightsStatus: asset.source_rights_status,
      rightsBasis: argument('rights-basis'),
      commercialUse: args.includes('--commercial-use'),
      attributionRequired: args.includes('--attribution-required'),
      attributionText: argument('attribution'),
      trademarkStatus: argument('trademark-status'),
      rightsEvidenceUrl: argument('rights-evidence-url'),
      usageScope: argument('usage-scope'),
      allowShareAlike,
      assetLevelOpenLicense: asset.provider.toLowerCase().includes('thesportsdb')
        // The API's strCreativeCommons field is not authoritative enough on
        // its own: some records expose `No` while the provider's player page
        // declares a concrete Creative Commons URL. Accept that independent
        // page evidence only when the stored license is a recognised CC URL
        // and the evidence points to the exact TheSportsDB player page.
        && (
          asset.provider_creative_commons === 'Yes'
          || (
            Boolean(asset.license_name)
            && /^https:\/\/creativecommons\.org\/(?:licenses|publicdomain)\//i.test(asset.license_url ?? '')
            && /^https:\/\/www\.thesportsdb\.com\/player\/\d+(?:[-/]|$)/i.test(asset.license_evidence_url ?? '')
          )
        )
    });
    const reviewer = argument('reviewer');
    if (!reviewer?.trim()) throw new Error('La revisión legal requiere --reviewer');
    if (!asset.local_path) throw new Error('La imagen necesita un archivo local antes de aprobarse');
    const mediaRoot = resolve(config.mediaRoot);
    const localPath = resolve(asset.local_path);
    if (!localPath.startsWith(`${mediaRoot}/`)) throw new Error('La imagen está fuera de MEDIA_ROOT');
    const bytes = await readFile(localPath);
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== 512 || metadata.height !== 512 || metadata.format !== 'webp') {
      throw new Error('La imagen pendiente debe ser WebP de 512x512');
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== asset.sha256) throw new Error('El hash de la imagen no coincide con PostgreSQL');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE image_assets SET is_primary = FALSE WHERE entity_id = $1', [asset.entity_id]);
      await client.query(
        `UPDATE image_assets
         SET review_status = 'approved', is_primary = TRUE,
             rights_basis = $2, commercial_use = TRUE,
             attribution_required = $3, attribution_text = $4,
             rights_evidence_url = $5, rights_verified_at = NOW(), rights_verified_by = $6,
             trademark_status = $7, usage_scope = $8::jsonb,
             metadata = metadata
               || jsonb_build_object(
                 'rightsReview', jsonb_build_object('reviewer', $6::text, 'reviewedAt', NOW(), 'evidenceUrl', $5::text),
                 'shareAlikeAccepted', $9::boolean
               )
               || CASE
                    WHEN $9::boolean AND license_name IS NOT NULL THEN
                      jsonb_build_object('derivedLicenseName', license_name, 'derivedLicenseUrl', license_url)
                    ELSE '{}'::jsonb
                  END
         WHERE id = $1`,
        [imageId, rightsReview.rightsBasis, args.includes('--attribution-required') || Boolean(argument('attribution')), argument('attribution') ?? null, rightsReview.rightsEvidenceUrl, reviewer, rightsReview.trademarkStatus, JSON.stringify(rightsReview.usageScope), allowShareAlike]
      );
      await client.query(
        `INSERT INTO media_rights_reviews (id, image_asset_id, decision, rights_basis, commercial_use, attribution_required, attribution_text, trademark_status, evidence_url, reviewer, notes, usage_scope)
         VALUES ($1, $2, 'approved', $3, TRUE, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [
          `mrr_${createHash('sha256').update(`${imageId}:approved:${reviewer}:${rightsReview.rightsEvidenceUrl}:${Date.now()}`).digest('hex').slice(0, 24)}`,
          imageId,
          rightsReview.rightsBasis,
          args.includes('--attribution-required') || Boolean(argument('attribution')),
          argument('attribution') ?? null,
          rightsReview.trademarkStatus,
          rightsReview.rightsEvidenceUrl,
          reviewer,
          argument('rights-notes') ?? '',
          JSON.stringify(rightsReview.usageScope)
        ]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(`Imagen aprobada y marcada como principal: ${imageId}`);
  } else if (command === 'approve-category') {
    const slug = argument('slug');
    if (!slug) throw new Error('Falta --slug');
    const result = await pool.query(
      `UPDATE category_definitions SET status = 'approved'
       WHERE slug = $1 AND status IN ('draft', 'approved')
       RETURNING slug`,
      [slug]
    );
    if (!result.rows[0]) throw new Error(`Categoría inexistente o retirada: ${slug}`);
    console.log(`Categoría aprobada: ${slug}`);
  } else if (command === 'review-source') {
    const key = argument('key');
    const rightsStatus = argument('status');
    if (!key || !rightsStatus || !['unknown', 'review_required', 'approved', 'rejected'].includes(rightsStatus)) {
      throw new Error('Faltan --key o --status: unknown | review_required | approved | rejected');
    }
    if (rightsStatus !== 'approved') {
      const result = await pool.query(
        `UPDATE sources SET rights_status = $2 WHERE key = $1 RETURNING key`,
        [key, rightsStatus]
      );
      if (!result.rows[0]) throw new Error(`Fuente inexistente: ${key}`);
      console.log(`Estado de derechos actualizado: ${key} -> ${rightsStatus}`);
    } else {
      const rightsReview = assertSourceRightsApproval({
        rightsBasis: argument('rights-basis'),
        commercialUse: args.includes('--commercial-use'),
        reviewer: argument('reviewer'),
        rightsEvidenceUrl: argument('rights-evidence-url'),
        usageScope: argument('usage-scope'),
        rightsNotes: argument('rights-notes')
      });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const source = await client.query<{ key: string }>(
          `SELECT key FROM sources WHERE key = $1 FOR UPDATE`,
          [key]
        );
        if (!source.rows[0]) throw new Error(`Fuente inexistente: ${key}`);
        const reviewId = `srr_${createHash('sha256').update(`${key}:${rightsReview.rightsEvidenceUrl}:${rightsReview.reviewer}:${Date.now()}`).digest('hex').slice(0, 24)}`;
        await client.query(
          `INSERT INTO source_rights_reviews
             (id, source_key, decision, rights_basis, commercial_use, evidence_url, reviewer, usage_scope, notes)
           VALUES ($1, $2, 'approved', $3, TRUE, $4, $5, $6::jsonb, $7)`,
          [reviewId, key, rightsReview.rightsBasis, rightsReview.rightsEvidenceUrl, rightsReview.reviewer, JSON.stringify(rightsReview.usageScope), rightsReview.rightsNotes]
        );
        await client.query(
          `UPDATE sources
              SET rights_status = 'approved', rights_basis = $2,
                  commercial_use = TRUE, rights_evidence_url = $3,
                  rights_verified_at = NOW(), rights_verified_by = $4,
                  rights_usage_scope = $5::jsonb, rights_notes = $6
            WHERE key = $1`,
          [key, rightsReview.rightsBasis, rightsReview.rightsEvidenceUrl, rightsReview.reviewer, JSON.stringify(rightsReview.usageScope), rightsReview.rightsNotes]
        );
        await client.query('COMMIT');
        console.log(`Fuente aprobada con evidencia registrada: ${key}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } else if (command === 'audit-media-rights') {
    const result = await pool.query<{
      asset_kind: 'portrait' | 'badge';
      provider: string;
      total: number;
      approved: number;
      publishable: number;
      pending: number;
      rejected: number;
    }>(
      `SELECT ia.asset_kind, ia.provider, COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE ia.review_status = 'approved')::int AS approved,
              COUNT(*) FILTER (WHERE ia.review_status = 'approved'
                AND ia.rights_basis <> 'unknown'
                AND ia.commercial_use = TRUE
                AND ia.rights_verified_at IS NOT NULL
                AND ia.rights_evidence_url IS NOT NULL
                AND jsonb_array_length(ia.usage_scope) > 0
                AND (e.entity_type <> 'club' OR ia.trademark_status = 'cleared')
                AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
              )::int AS publishable,
              COUNT(*) FILTER (WHERE ia.review_status = 'pending')::int AS pending,
              COUNT(*) FILTER (WHERE ia.review_status = 'rejected')::int AS rejected
       FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id
       GROUP BY ia.asset_kind, ia.provider
       ORDER BY ia.asset_kind, ia.provider`
    );
    const blockers = await pool.query<{ blocker: string; asset_kind: string; count: number }>(
      `SELECT blocker, asset_kind, COUNT(*)::int AS count
       FROM (
         SELECT ia.asset_kind,
                CASE
                  WHEN ia.review_status <> 'approved' THEN 'review_status_' || ia.review_status
                  WHEN ia.rights_basis = 'unknown' THEN 'rights_basis_missing'
                  WHEN ia.commercial_use = FALSE THEN 'commercial_use_unconfirmed'
                  WHEN ia.rights_verified_at IS NULL THEN 'reviewer_or_date_missing'
                  WHEN ia.rights_evidence_url IS NULL THEN 'evidence_url_missing'
                  WHEN jsonb_array_length(ia.usage_scope) = 0 THEN 'usage_scope_missing'
                  WHEN e.entity_type = 'club' AND ia.trademark_status <> 'cleared' THEN 'club_trademark_not_cleared'
                  WHEN ia.attribution_required = TRUE AND NULLIF(ia.attribution_text, '') IS NULL THEN 'attribution_missing'
                  ELSE 'publishable'
                END AS blocker
         FROM image_assets ia JOIN entities e ON e.id = ia.entity_id
       ) classified
       WHERE blocker <> 'publishable'
       GROUP BY blocker, asset_kind
       ORDER BY asset_kind, blocker`
    );
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      groups: result.rows,
      blockers: blockers.rows,
      policy: 'asset-is-publishable-only-when-licence-scope-and-review-are-explicit'
    }, null, 2));
  } else if (command === 'clean-ranking-padding') {
    const requestedCategory = argument('category');
    const apply = args.includes('--apply');
    const candidates = await pool.query<{
      slug: string;
      snapshot_id: string;
      source_key: string;
      source_name: string;
      source_type: RankingInput['source']['sourceType'];
      base_url: string | null;
      rights_status: RankingInput['source']['rightsStatus'];
      coverage_complete: boolean;
      generated_at: string;
      nonpositive: number;
    }>(
      `WITH latest AS (
         SELECT DISTINCT ON (rs.category_id)
                rs.id AS snapshot_id, rs.category_id, rs.coverage_complete,
                rs.generated_at, ss.source_key
         FROM ranking_snapshots rs
         LEFT JOIN source_snapshots ss ON ss.id = rs.metadata->>'sourceSnapshotId'
         WHERE rs.status <> 'superseded'
         ORDER BY rs.category_id, rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC
       )
       SELECT c.slug, latest.snapshot_id, latest.source_key,
              COALESCE(s.name, latest.source_key) AS source_name,
              COALESCE(s.source_type, 'reference') AS source_type,
              s.base_url, COALESCE(s.rights_status, 'review_required') AS rights_status,
              latest.coverage_complete, latest.generated_at,
              COUNT(*) FILTER (WHERE re.raw_value <= 0)::int AS nonpositive
       FROM latest
       JOIN category_definitions c ON c.id = latest.category_id
       LEFT JOIN sources s ON s.key = latest.source_key
       JOIN ranking_entries re ON re.snapshot_id = latest.snapshot_id
       WHERE c.status <> 'retired'
         AND c.scope_kind NOT IN ('integration', 'test')
         AND ($1::text IS NULL OR c.slug = $1)
       GROUP BY c.slug, latest.snapshot_id, latest.source_key, s.name, s.source_type,
                s.base_url, s.rights_status, latest.coverage_complete, latest.generated_at
       HAVING COUNT(*) FILTER (WHERE re.raw_value <= 0) > 0
       ORDER BY c.slug`,
      [requestedCategory ?? null]
    );
    const processed: Array<{ category: string; oldSnapshotId: string; newSnapshotId?: string; oldEntries: number; positiveEntries: number; applied: boolean }> = [];
    for (const candidate of candidates.rows) {
      const rows = await pool.query<{
        entity_id: string;
        canonical_name: string;
        entity_type: 'player' | 'club' | 'national_team';
        raw_value: string;
        rank: number;
        evidence: Record<string, unknown>;
      }>(
        `SELECT re.entity_id, e.canonical_name, e.entity_type, re.raw_value::text,
                re.rank, re.evidence
           FROM ranking_entries re
           JOIN entities e ON e.id = re.entity_id
          WHERE re.snapshot_id = $1 AND re.raw_value > 0
          ORDER BY re.rank, re.entity_id`,
        [candidate.snapshot_id]
      );
      const result = {
        category: candidate.slug,
        oldSnapshotId: candidate.snapshot_id,
        oldEntries: rows.rows.length + candidate.nonpositive,
        positiveEntries: rows.rows.length,
        applied: false
      } as { category: string; oldSnapshotId: string; newSnapshotId?: string; oldEntries: number; positiveEntries: number; applied: boolean };
      if (apply) {
        if (rows.rows.length === 0) throw new Error(`No quedan valores positivos en ${candidate.slug}; revisión manual requerida`);
        const input: RankingInput = {
          categorySlug: candidate.slug,
          source: {
            key: candidate.source_key,
            name: candidate.source_name,
            sourceType: candidate.source_type,
            ...(candidate.base_url ? { baseUrl: candidate.base_url } : {}),
            rightsStatus: candidate.rights_status
          },
          dataVersion: `${candidate.source_key}-positive-only-${new Date().toISOString().slice(0, 10)}`,
          coverageComplete: false,
          allowPartialDraft: true,
          partialDraftReason: `Se retiraron ${candidate.nonpositive} filas no positivas de la cohorte anterior; solo se conservan valores estadísticos positivos observados. La fuente no alcanza necesariamente 200 jugadores positivos históricos.`,
          reviewed: false,
          entries: rows.rows.map((row) => ({
            entityId: row.entity_id,
            entityType: row.entity_type,
            name: row.canonical_name,
            rawValue: Number(row.raw_value),
            evidence: { ...row.evidence, sourceRank: row.evidence?.sourceRank ?? row.rank }
          }))
        };
        result.newSnapshotId = await importRankingInput(input);
        result.applied = true;
      }
      processed.push(result);
    }
    console.log(JSON.stringify({ apply, candidates: processed }, null, 2));
  } else if (command === 'backfill-commons-portrait-rights') {
    const apply = args.includes('--apply');
    const allowShareAlike = args.includes('--allow-share-alike');
    const reviewer = argument('reviewer');
    if (apply && !reviewer?.trim()) throw new Error('--apply requiere --reviewer');
    const usageScope = argument('usage-scope') ?? 'web,pwa,android,ios,cdn,local_storage';
    const result = await pool.query<{
      id: string;
      entity_id: string;
      canonical_name: string;
      license_name: string | null;
      license_url: string | null;
      source_url: string;
      local_path: string | null;
      author: string | null;
    }>(
      `SELECT ia.id, ia.entity_id, e.canonical_name, ia.license_name, ia.license_url, ia.source_url, ia.local_path,
              NULLIF(BTRIM(ia.metadata->>'author'), '') AS author
       FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id
       WHERE ia.provider IN ('wikimedia-commons', 'wikipedia-it')
         AND ia.asset_kind = 'portrait'
         AND ia.review_status = 'approved'
         AND (
           ia.source_url LIKE 'https://commons.wikimedia.org/wiki/File:%'
           OR ia.source_url LIKE 'https://%.wikipedia.org/wiki/File:%'
         )
         AND ia.local_path IS NOT NULL
         AND ia.rights_basis = 'unknown'
       ORDER BY e.canonical_name, ia.id`
    );
    const eligible: Array<Record<string, unknown>> = [];
    const skipped: Array<Record<string, unknown>> = [];
    for (const asset of result.rows) {
      const license = asset.license_name?.toLowerCase() ?? '';
      const publicDomain = license.includes('public domain') || license === 'pd' || license.includes('cc0');
      const ccBy = license.includes('cc by') && !license.includes('cc by-sa') && !license.includes('-nc') && !license.includes(' nc') && !license.includes('-nd') && !license.includes(' nd');
      const ccBySa = license.includes('cc by-sa');
      const attribution = (ccBy || (ccBySa && allowShareAlike))
        ? `${asset.author ?? ''} — ${asset.source_url} — ${asset.license_name ?? 'CC BY'}`.trim()
        : undefined;
      if ((!publicDomain && !ccBy && !(ccBySa && allowShareAlike)) || ((ccBy || (ccBySa && allowShareAlike)) && !asset.author)) {
        skipped.push({
          assetId: asset.id,
          entityId: asset.entity_id,
          entityName: asset.canonical_name,
          licenseName: asset.license_name,
          reason: ccBySa && !allowShareAlike ? 'cc_by_sa_requires_explicit_flag' : (ccBy || ccBySa ? 'open_license_author_missing' : 'license_requires_manual_review')
        });
        continue;
      }
      try {
        assertPublishableImageLicense('wikimedia-commons', asset.license_name, asset.license_url, allowShareAlike);
        const rightsReview = assertRightsApproval({
          assetKind: 'portrait',
          entityType: 'player',
          provider: 'wikimedia-commons',
          licenseName: asset.license_name,
          licenseUrl: asset.license_url,
          sourceRightsStatus: 'review_required',
          rightsBasis: publicDomain ? 'public_domain' : 'open_license',
          commercialUse: true,
          attributionRequired: Boolean(attribution),
          attributionText: attribution,
          trademarkStatus: 'not_applicable',
          rightsEvidenceUrl: asset.source_url,
          usageScope,
          allowShareAlike
        });
        const item = {
          assetId: asset.id,
          entityId: asset.entity_id,
          entityName: asset.canonical_name,
          licenseName: asset.license_name,
          attribution,
          rightsBasis: rightsReview.rightsBasis,
          usageScope: rightsReview.usageScope,
          applied: apply
        };
        eligible.push(item);
        if (apply) {
          await pool.query(
            `UPDATE image_assets
             SET rights_basis = $2, commercial_use = TRUE,
                 attribution_required = $3, attribution_text = $4,
                 rights_evidence_url = $5, rights_verified_at = NOW(), rights_verified_by = $6,
                 trademark_status = 'not_applicable', usage_scope = $7::jsonb,
                 metadata = metadata || jsonb_build_object(
                   'shareAlikeAccepted', $8::boolean,
                   'shareAlikeAcceptedAt', NOW(),
                   'derivedLicenseName', $9::text,
                   'derivedLicenseUrl', $10::text
                 ),
                 rights_notes = COALESCE(NULLIF(rights_notes, ''), 'Licencia de Commons comprobada contra los metadatos archivados y la página de archivo.')
             WHERE id = $1 AND review_status = 'approved'`,
            [asset.id, rightsReview.rightsBasis, Boolean(attribution), attribution ?? null, asset.source_url, reviewer, JSON.stringify(rightsReview.usageScope), allowShareAlike, asset.license_name ?? null, asset.license_url ?? null]
          );
          await pool.query(
            `INSERT INTO media_rights_reviews (id, image_asset_id, decision, rights_basis, commercial_use, attribution_required, attribution_text, trademark_status, evidence_url, reviewer, notes, usage_scope)
             VALUES ($1, $2, 'approved', $3, TRUE, $4, $5, 'not_applicable', $6, $7, $8, $9::jsonb)
             ON CONFLICT (id) DO NOTHING`,
            [
              `mrr_${createHash('sha256').update(`${asset.id}:commons-open-license:${reviewer}`).digest('hex').slice(0, 24)}`,
              asset.id,
              rightsReview.rightsBasis,
              Boolean(attribution),
              attribution ?? null,
              asset.source_url,
              reviewer,
              `Backfill explícito de licencia abierta compatible; ${allowShareAlike ? 'CC BY-SA aceptado expresamente y el derivado debe conservar esa licencia.' : 'no incluye CC BY-SA ni escudos.'}`,
              JSON.stringify(rightsReview.usageScope)
            ]
          );
        }
      } catch (error) {
        skipped.push({ assetId: asset.id, entityId: asset.entity_id, entityName: asset.canonical_name, licenseName: asset.license_name, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      reviewer: reviewer ?? null,
      allowShareAlike,
      scanned: result.rows.length,
      eligible: eligible.length,
      skipped: skipped.length,
      eligibleAssets: eligible,
      skippedAssets: skipped
    }, null, 2));
  } else if (command === 'refresh-commons-metadata') {
    const ids = (argument('ids') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const limit = Number(argument('limit') ?? 100);
    const offset = Number(argument('offset') ?? 0);
    const delayMs = Number(argument('delay-ms') ?? 1_500);
    if ((ids.length === 0 && (!Number.isInteger(limit) || limit < 1 || limit > 100)) || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10_000) {
      throw new Error('Indica --ids ID1,ID2 o usa --limit 1-100, con --offset >=0 y --delay-ms 0-10000');
    }
    const result = await pool.query<{
      id: string;
      source_url: string;
      metadata: Record<string, unknown>;
    }>(
      `SELECT id, source_url, metadata
       FROM image_assets
       WHERE provider = 'wikimedia-commons'
         AND ${ids.length > 0 ? 'id = ANY($1::text[])' : "source_url LIKE 'https://commons.wikimedia.org/wiki/File:%'"}
       ORDER BY id
       ${ids.length > 0 ? '' : 'LIMIT $1 OFFSET $2'}`,
      ids.length > 0 ? [ids] : [limit, offset]
    );
    if (result.rows.length === 0) throw new Error('No hay activos Commons que refrescar');
    const entries: Array<Record<string, unknown>> = [];
    for (const [index, asset] of result.rows.entries()) {
      const title = commonsTitleFromSourceUrl(asset.source_url);
      if (!title) {
        entries.push({ assetId: asset.id, refreshed: false, reason: 'source_url_not_commons_file' });
        continue;
      }
      try {
        const candidate = await fetchCommonsFile(title);
        if (!candidate) {
          entries.push({ assetId: asset.id, title, refreshed: false, reason: 'commons_file_not_found' });
        } else {
          await pool.query(
            `UPDATE image_assets
             SET license_name = $2, license_url = $3,
                 metadata = metadata || $4::jsonb
             WHERE id = $1`,
            [asset.id, candidate.licenseName ?? null, candidate.licenseUrl ?? null, JSON.stringify({ ...candidate, liveLicenseCheckedAt: new Date().toISOString() })]
          );
          entries.push({ assetId: asset.id, title, refreshed: true, licenseName: candidate.licenseName ?? null, licenseUrl: candidate.licenseUrl ?? null, author: candidate.author ?? null });
        }
      } catch (error) {
        entries.push({ assetId: asset.id, title, refreshed: false, reason: error instanceof Error ? error.message : String(error) });
      }
      if (index < result.rows.length - 1 && delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(JSON.stringify({ provider: 'wikimedia-commons', entries, refreshed: entries.filter((entry) => entry.refreshed).length }, null, 2));
  } else if (command === 'clean-redundant-pending-media') {
    const apply = args.includes('--apply');
    const candidates = await pool.query<{
      id: string;
      entity_id: string;
      canonical_name: string;
      asset_kind: 'portrait' | 'badge';
      provider: string;
    }>(
      `SELECT pending.id, pending.entity_id, e.canonical_name, pending.asset_kind, pending.provider
       FROM image_assets pending
       JOIN entities e ON e.id = pending.entity_id
       WHERE pending.review_status = 'pending'
         AND EXISTS (
           SELECT 1
           FROM image_assets approved
           JOIN entities approved_entity ON approved_entity.id = approved.entity_id
           WHERE approved.entity_id = pending.entity_id
             AND approved.asset_kind = pending.asset_kind
             AND approved.is_primary = TRUE
             AND approved.review_status = 'approved'
             AND approved.rights_basis <> 'unknown'
             AND approved.commercial_use = TRUE
             AND approved.rights_verified_at IS NOT NULL
             AND approved.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(approved.usage_scope) > 0
             AND (approved_entity.entity_type <> 'club' OR approved.trademark_status = 'cleared')
             AND (approved.attribution_required = FALSE OR NULLIF(approved.attribution_text, '') IS NOT NULL)
         )
       ORDER BY e.canonical_name, pending.asset_kind, pending.id`
    );
    if (apply && candidates.rows.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE image_assets
           SET review_status = 'rejected', is_primary = FALSE,
               metadata = metadata || jsonb_build_object(
                 'rejectionReason', 'redundant_approved_primary',
                 'rejectedAt', NOW(),
                 'rejectionNote', 'Se conserva para auditoría; la entidad ya tiene un activo principal publicable.'
               )
           WHERE id = ANY($1::text[]) AND review_status = 'pending'`,
          [candidates.rows.map((candidate) => candidate.id)]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      scanned: candidates.rows.length,
      rejected: apply ? candidates.rows.length : 0,
      preservedForAudit: true,
      candidates: candidates.rows
    }, null, 2));
  } else if (command === 'retire-nonrequired-pending-media') {
    const apply = args.includes('--apply');
    const candidates = await pool.query<{ id: string; entity_id: string; canonical_name: string; asset_kind: 'portrait' | 'badge'; provider: string }>(
      `WITH playable_entities AS (
         SELECT DISTINCT COALESCE(profile_link.canonical_entity_id, egp.entity_id) AS entity_id
         FROM entity_game_profiles egp
         LEFT JOIN entity_identity_links profile_link ON profile_link.source_entity_id = egp.entity_id
         WHERE egp.playable_default = TRUE
       )
       SELECT ia.id, ia.entity_id, e.canonical_name, ia.asset_kind, ia.provider
       FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id
       LEFT JOIN entity_identity_links pending_link ON pending_link.source_entity_id = ia.entity_id
       WHERE ia.review_status = 'pending'
         AND (
           COALESCE(ia.media_status, 'required') = 'media_not_required'
           OR (
             e.entity_type = 'player'
             AND NOT EXISTS (SELECT 1 FROM playable_entities pe
                             WHERE pe.entity_id = COALESCE(pending_link.canonical_entity_id, ia.entity_id))
           )
         )
       ORDER BY e.canonical_name, ia.asset_kind, ia.id`
    );
    if (apply && candidates.rows.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE image_assets
           SET review_status = 'rejected', is_primary = FALSE, media_status = 'media_not_required',
               metadata = metadata || jsonb_build_object(
                 'rejectionReason', 'media_not_required_catalog_cleanup',
                 'rejectedAt', NOW(),
                 'rejectionNote', 'Se conserva para auditoría; la entidad no pertenece al pool jugable actual y no necesita retrato en este lanzamiento.'
               )
           WHERE id = ANY($1::text[]) AND review_status = 'pending'`,
          [candidates.rows.map((candidate) => candidate.id)]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      scanned: candidates.rows.length,
      rejected: apply ? candidates.rows.length : 0,
      preservedForAudit: true,
      candidates: candidates.rows.slice(0, 100)
    }, null, 2));
  } else if (command === 'clean-exact-api-football-duplicates') {
    const apply = args.includes('--apply');
    const candidates = await pool.query<{ id: string; canonical_id: string; canonical_name: string; local_path: string }>(
      `WITH playable_entities AS (
         SELECT DISTINCT COALESCE(profile_link.canonical_entity_id, egp.entity_id) AS entity_id
         FROM entity_game_profiles egp
         LEFT JOIN entity_identity_links profile_link ON profile_link.source_entity_id = egp.entity_id
         JOIN entities playable_entity ON playable_entity.id = COALESCE(profile_link.canonical_entity_id, egp.entity_id)
         WHERE egp.playable_default = TRUE
           AND playable_entity.entity_type = 'player'
           AND playable_entity.catalog_status = 'active'
       ), exact_assets AS (
         SELECT ia.id, COALESCE(identity_link.canonical_entity_id, ia.entity_id) AS canonical_id,
                e.canonical_name, ia.local_path
         FROM image_assets ia
         JOIN entities e ON e.id = ia.entity_id
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = ia.entity_id
         WHERE ia.provider = 'api-football'
           AND ia.asset_kind = 'portrait'
           AND ia.local_path IS NOT NULL
           AND ia.metadata->>'source' = 'thesportsdb-exact-player'
       )
       SELECT exact_assets.id, exact_assets.canonical_id, exact_assets.canonical_name, exact_assets.local_path
       FROM exact_assets
       WHERE NOT EXISTS (SELECT 1 FROM playable_entities playable WHERE playable.entity_id = exact_assets.canonical_id)
          OR EXISTS (
             SELECT 1
             FROM image_assets other
             LEFT JOIN entity_identity_links other_link ON other_link.source_entity_id = other.entity_id
             WHERE COALESCE(other_link.canonical_entity_id, other.entity_id) = exact_assets.canonical_id
               AND other.asset_kind = 'portrait'
               AND other.local_path IS NOT NULL
               AND other.id <> exact_assets.id
          )
       ORDER BY exact_assets.canonical_name, exact_assets.id`
    );
    const mediaRoot = resolve(config.mediaRoot);
    const removable = new Set<string>();
    const skipped: Array<{ id: string; localPath: string; reason: string }> = [];
    for (const candidate of candidates.rows) {
      const localPath = resolve(candidate.local_path);
      if (!localPath.startsWith(`${mediaRoot}/`)) skipped.push({ id: candidate.id, localPath: candidate.local_path, reason: 'path_outside_media_root' });
      else removable.add(localPath);
    }
    const eligibleIds = candidates.rows.filter((candidate) => !skipped.some((item) => item.id === candidate.id)).map((candidate) => candidate.id);
    if (apply && eligibleIds.length > 0) {
      await pool.query(
        `UPDATE image_assets
            SET review_status = 'rejected', is_primary = FALSE, local_path = NULL, media_status = 'media_not_required',
                metadata = metadata || jsonb_build_object(
                  'rejectionReason', 'redundant_exact_api_football_portrait',
                  'rejectedAt', NOW(),
                  'rejectionNote', 'Se conserva para auditoría; el lote exacto era redundante o quedó fuera del pool jugable.'
                )
          WHERE id = ANY($1::text[]) AND provider = 'api-football'`,
        [eligibleIds]
      );
      for (const localPath of removable) {
        const referenced = await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM image_assets WHERE local_path = $1', [localPath]);
        if (referenced.rows[0]?.count !== 0) continue;
        try {
          await unlink(localPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') skipped.push({ id: 'file', localPath, reason: 'unlink_failed' });
        }
      }
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates: candidates.rows.length, eligible: eligibleIds.length, rejected: apply ? eligibleIds.length : 0, filesRemoved: apply ? removable.size - skipped.filter((item) => item.reason === 'unlink_failed').length : 0, preservedForAudit: true, skipped }, null, 2));
  } else if (command === 'queue-api-football-playable-portraits') {
    const apply = args.includes('--apply');
    const candidates = await pool.query<{ entity_id: string; canonical_name: string; provider_id: string; source_url: string }>(
      `WITH playable_entities AS (
         SELECT DISTINCT COALESCE(profile_link.canonical_entity_id, egp.entity_id) AS entity_id
         FROM entity_game_profiles egp
         LEFT JOIN entity_identity_links profile_link ON profile_link.source_entity_id = egp.entity_id
         JOIN entities playable_entity ON playable_entity.id = COALESCE(profile_link.canonical_entity_id, egp.entity_id)
         WHERE egp.playable_default = TRUE
           AND playable_entity.entity_type = 'player'
           AND playable_entity.catalog_status = 'active'
       ), covered AS (
         SELECT DISTINCT COALESCE(identity_link.canonical_entity_id, ia.entity_id) AS entity_id
         FROM image_assets ia
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = ia.entity_id
         WHERE ia.asset_kind = 'portrait'
           AND (ia.local_path IS NOT NULL OR (ia.review_status = 'approved' AND ia.is_primary = TRUE))
       )
       SELECT playable_entity.id AS entity_id,
              playable_entity.canonical_name,
              playable_entity.metadata->>'providerPlayerId' AS provider_id,
              'https://media.api-sports.io/football/players/' || (playable_entity.metadata->>'providerPlayerId') || '.png' AS source_url
       FROM playable_entities playable
       JOIN entities playable_entity ON playable_entity.id = playable.entity_id
       LEFT JOIN covered ON covered.entity_id = playable_entity.id
       WHERE covered.entity_id IS NULL
         AND playable_entity.metadata->>'providerPlayerId' ~ '^[0-9]+$'
         AND NOT EXISTS (
           SELECT 1 FROM image_assets existing
           WHERE existing.provider = 'api-football'
             AND existing.asset_kind = 'portrait'
             AND existing.source_url = 'https://media.api-sports.io/football/players/' || (playable_entity.metadata->>'providerPlayerId') || '.png'
         )
       ORDER BY playable_entity.canonical_name, playable_entity.id`
    );
    if (apply && candidates.rows.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO sources (key, name, source_type, base_url, rights_status)
           VALUES ('api-football', 'API-Football / API-Sports', 'api', 'https://www.api-football.com/', 'review_required')
           ON CONFLICT (key) DO NOTHING`
        );
        for (const candidate of candidates.rows) {
          const assetId = `img_${createHash('sha256').update(`${candidate.entity_id}:portrait:${candidate.source_url}`).digest('hex').slice(0, 24)}`;
          await client.query(
            `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, provider, license_url, width, height, mime_type, sha256, is_primary, review_status, metadata)
             VALUES ($1, $2, 'portrait', $3, 'api-football', 'https://www.api-football.com/terms', 512, 512, 'image/png', $4, FALSE, 'pending', $5)
             ON CONFLICT (id) DO NOTHING`,
            [assetId, candidate.entity_id, candidate.source_url, createHash('sha256').update(candidate.source_url).digest('hex'), JSON.stringify({
              purpose: 'candidate_only',
              rightsStatus: 'review_required',
              source: 'canonical-provider-player-id',
              providerPlayerId: candidate.provider_id
            })]
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      candidates: candidates.rows.length,
      queued: apply ? candidates.rows.length : 0,
      preservedForAudit: true,
      sample: candidates.rows.slice(0, 100)
    }, null, 2));
  } else if (command === 'dedupe-playable-local-portraits') {
    const apply = args.includes('--apply');
    const candidates = await pool.query<{
      id: string;
      canonical_id: string;
      canonical_name: string;
      entity_id: string;
      provider: string;
      local_path: string;
      source_url: string;
      preference: number;
    }>(
      `WITH playable_entities AS (
         SELECT DISTINCT COALESCE(profile_link.canonical_entity_id, egp.entity_id) AS entity_id
         FROM entity_game_profiles egp
         LEFT JOIN entity_identity_links profile_link ON profile_link.source_entity_id = egp.entity_id
         JOIN entities playable_entity ON playable_entity.id = COALESCE(profile_link.canonical_entity_id, egp.entity_id)
         WHERE egp.playable_default = TRUE
           AND playable_entity.entity_type = 'player'
           AND playable_entity.catalog_status = 'active'
       ), approved_entities AS (
         SELECT DISTINCT COALESCE(identity_link.canonical_entity_id, ia.entity_id) AS canonical_id
         FROM image_assets ia
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = ia.entity_id
         JOIN playable_entities playable ON playable.entity_id = COALESCE(identity_link.canonical_entity_id, ia.entity_id)
         WHERE ia.asset_kind = 'portrait'
           AND ia.is_primary = TRUE
           AND ia.review_status = 'approved'
           AND ia.rights_basis <> 'unknown'
           AND ia.commercial_use = TRUE
           AND ia.rights_verified_at IS NOT NULL
           AND ia.rights_evidence_url IS NOT NULL
           AND jsonb_array_length(ia.usage_scope) > 0
           AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
       ), candidate_pool AS (
         SELECT COALESCE(identity_link.canonical_entity_id, ia.entity_id) AS canonical_id,
                ia.id, ia.entity_id, ia.provider, ia.local_path, ia.source_url,
                canonical_entity.canonical_name,
                CASE
                  WHEN ia.provider = 'api-football'
                   AND canonical_entity.metadata->>'providerPlayerId' IS NOT NULL
                   AND ia.source_url = 'https://media.api-sports.io/football/players/'
                     || (canonical_entity.metadata->>'providerPlayerId') || '.png' THEN 0
                  WHEN ia.entity_id = canonical_entity.id THEN 1
                  WHEN ia.provider = 'api-football' THEN 2
                  ELSE 3
                END AS preference
         FROM image_assets ia
         JOIN entities source_entity ON source_entity.id = ia.entity_id
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = ia.entity_id
         JOIN entities canonical_entity ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, ia.entity_id)
         JOIN playable_entities playable ON playable.entity_id = canonical_entity.id
         WHERE ia.asset_kind = 'portrait'
           AND ia.review_status = 'pending'
           AND ia.local_path IS NOT NULL
       ), ranked AS (
         SELECT candidate_pool.*,
                ROW_NUMBER() OVER (PARTITION BY canonical_id ORDER BY preference, id) AS candidate_rank
         FROM candidate_pool
       )
       SELECT id, canonical_id, canonical_name, entity_id, provider, local_path, source_url, preference
       FROM ranked
       WHERE candidate_rank > 1
          OR EXISTS (SELECT 1 FROM approved_entities approved WHERE approved.canonical_id = ranked.canonical_id)
       ORDER BY canonical_name, candidate_rank, id`
    );
    const mediaRoot = resolve(config.mediaRoot);
    const skipped: Array<{ id: string; localPath: string; reason: string }> = [];
    const removable = new Set<string>();
    for (const candidate of candidates.rows) {
      const localPath = resolve(candidate.local_path);
      if (!localPath.startsWith(`${mediaRoot}/`)) {
        skipped.push({ id: candidate.id, localPath: candidate.local_path, reason: 'path_outside_media_root' });
      } else {
        removable.add(localPath);
      }
    }
    const eligibleIds = candidates.rows
      .filter((candidate) => !skipped.some((item) => item.id === candidate.id))
      .map((candidate) => candidate.id);
    if (apply && eligibleIds.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE image_assets
              SET review_status = 'rejected',
                  is_primary = FALSE,
                  local_path = NULL,
                  metadata = metadata || jsonb_build_object(
                    'rejectionReason', 'redundant_canonical_portrait',
                    'rejectedAt', NOW(),
                    'rejectionNote', 'Se conserva para auditoría; se mantiene un único candidato local por jugador canónico.',
                    'localBinaryRemovedReason', 'redundant_canonical_portrait'
                  )
            WHERE id = ANY($1::text[])
              AND review_status = 'pending'`,
          [eligibleIds]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      for (const localPath of removable) {
        const stillReferenced = await pool.query<{ count: number }>(
          'SELECT COUNT(*)::int AS count FROM image_assets WHERE local_path = $1',
          [localPath]
        );
        if (stillReferenced.rows[0]?.count !== 0) continue;
        try {
          await unlink(localPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            skipped.push({ id: 'file', localPath, reason: 'unlink_failed' });
          }
        }
      }
    }
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      candidates: candidates.rows.length,
      eligible: eligibleIds.length,
      rejected: apply ? eligibleIds.length : 0,
      filesRemoved: apply ? removable.size - skipped.filter((item) => item.reason === 'unlink_failed').length : 0,
      preservedForAudit: true,
      skipped,
      sample: candidates.rows.slice(0, 100)
    }, null, 2));
  } else if (command === 'clean-noncanonical-local-portraits') {
    const apply = args.includes('--apply');
    const candidates = await pool.query<{
      id: string;
      canonical_name: string;
      review_status: string;
      is_primary: boolean;
      provider: string;
      local_path: string;
    }>(
      `WITH canonical_assets AS (
         SELECT ia.id,
                COALESCE(identity_link.canonical_entity_id, ia.entity_id) AS canonical_id,
                canonical_entity.canonical_name,
                ia.review_status, ia.is_primary, ia.provider, ia.local_path
         FROM image_assets ia
         LEFT JOIN entity_identity_links identity_link
           ON identity_link.source_entity_id = ia.entity_id
         JOIN entities canonical_entity
           ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, ia.entity_id)
         WHERE ia.asset_kind = 'portrait'
           AND ia.local_path IS NOT NULL
           AND (
             ia.review_status = 'rejected'
             OR (ia.review_status = 'approved' AND ia.is_primary = FALSE)
           )
       )
       SELECT candidate.*
       FROM canonical_assets candidate
       WHERE NOT EXISTS (
         SELECT 1
         FROM image_assets keep
         WHERE keep.id <> candidate.id
           AND keep.asset_kind = 'portrait'
           AND keep.local_path = candidate.local_path
           AND (
             (keep.review_status = 'approved' AND keep.is_primary = TRUE)
             OR keep.review_status = 'pending'
           )
       )
       ORDER BY candidate.canonical_name, candidate.id`
    );
    const mediaRoot = resolve(config.mediaRoot);
    const skipped: Array<{ id: string; localPath: string; reason: string }> = [];
    const removable = new Set<string>();
    for (const candidate of candidates.rows) {
      const localPath = resolve(candidate.local_path);
      if (!localPath.startsWith(`${mediaRoot}/`)) {
        skipped.push({ id: candidate.id, localPath: candidate.local_path, reason: 'path_outside_media_root' });
      } else {
        removable.add(localPath);
      }
    }
    const eligibleIds = candidates.rows
      .filter((candidate) => !skipped.some((item) => item.id === candidate.id))
      .map((candidate) => candidate.id);
    if (apply && eligibleIds.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE image_assets
              SET local_path = NULL,
                  metadata = metadata || jsonb_build_object(
                    'localBinaryRemovedAt', NOW(),
                    'localBinaryRemovalReason', 'noncanonical_portrait_cleanup'
                  )
            WHERE id = ANY($1::text[])
              AND local_path IS NOT NULL
              AND (
                review_status = 'rejected'
                OR (review_status = 'approved' AND is_primary = FALSE)
              )`,
          [eligibleIds]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      for (const localPath of removable) {
        const stillReferenced = await pool.query<{ count: number }>(
          'SELECT COUNT(*)::int AS count FROM image_assets WHERE local_path = $1',
          [localPath]
        );
        if (stillReferenced.rows[0]?.count !== 0) continue;
        try {
          await unlink(localPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            skipped.push({ id: 'file', localPath, reason: 'unlink_failed' });
          }
        }
      }
    }
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      candidates: candidates.rows.length,
      eligible: eligibleIds.length,
      localFilesRemoved: apply ? removable.size - skipped.filter((item) => item.reason === 'unlink_failed').length : 0,
      preservedForAudit: true,
      skipped,
      sample: candidates.rows.slice(0, 100)
    }, null, 2));
  } else if (command === 'requeue-playable-api-football-media') {
    const apply = args.includes('--apply');
    const assetKind = argument('kind') ?? 'portrait';
    if (!['portrait', 'badge'].includes(assetKind)) {
      throw new Error('Usa --kind portrait|badge');
    }
    const candidates = await pool.query<{
      id: string;
      entity_id: string;
      canonical_name: string;
      local_path: string | null;
      previous_rejection_reason: string | null;
    }>(
      `WITH playable_entities AS (
         SELECT DISTINCT COALESCE(profile_link.canonical_entity_id, egp.entity_id) AS entity_id
         FROM entity_game_profiles egp
         LEFT JOIN entity_identity_links profile_link ON profile_link.source_entity_id = egp.entity_id
         JOIN entities playable_entity ON playable_entity.id = COALESCE(profile_link.canonical_entity_id, egp.entity_id)
         WHERE egp.playable_default = TRUE
           AND playable_entity.entity_type = 'player'
           AND playable_entity.catalog_status = 'active'
       ), publishable AS (
         SELECT DISTINCT ia.entity_id
         FROM image_assets ia
         JOIN entities e ON e.id = ia.entity_id
         WHERE ia.asset_kind = $1
           AND ia.review_status = 'approved'
           AND ia.is_primary = TRUE
           AND ia.rights_basis <> 'unknown'
           AND ia.commercial_use = TRUE
           AND ia.rights_verified_at IS NOT NULL
           AND ia.rights_evidence_url IS NOT NULL
           AND jsonb_array_length(ia.usage_scope) > 0
           AND (e.entity_type <> 'club' OR ia.trademark_status = 'cleared')
       )
       SELECT ia.id, ia.entity_id, e.canonical_name, ia.local_path,
              ia.metadata->>'rejectionReason' AS previous_rejection_reason
       FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id
       JOIN playable_entities pe ON pe.entity_id = ia.entity_id
       LEFT JOIN publishable p ON p.entity_id = ia.entity_id
       WHERE ia.provider = 'api-football'
         AND ia.asset_kind = $1
         AND ia.review_status = 'rejected'
         AND ia.metadata->>'rejectionReason' = 'media_not_required_catalog_cleanup'
         AND p.entity_id IS NULL
       ORDER BY e.canonical_name, ia.id`
    , [assetKind]);
    if (apply && candidates.rows.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE image_assets
              SET review_status = 'pending',
                  is_primary = FALSE,
                  media_status = 'required',
                  metadata = metadata || jsonb_build_object(
                    'requeuedAt', NOW(),
                    'requeueReason', 'playable_after_catalog_cleanup',
                    'previousRejectionReason', 'media_not_required_catalog_cleanup'
                  )
            WHERE id = ANY($1::text[])
              AND review_status = 'rejected'`,
          [candidates.rows.map((candidate) => candidate.id)]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      assetKind,
      candidates: candidates.rows.length,
      requeued: apply ? candidates.rows.length : 0,
      localFilesAlreadyPresent: candidates.rows.filter((candidate) => Boolean(candidate.local_path)).length,
      preservedForAudit: true,
      sample: candidates.rows.slice(0, 100)
    }, null, 2));
  } else if (command === 'clean-nonrequired-media-files') {
    const apply = args.includes('--apply');
    const candidates = await pool.query<{ id: string; local_path: string; canonical_name: string; provider: string }>(
      `SELECT ia.id, ia.local_path, e.canonical_name, ia.provider
         FROM image_assets ia
         JOIN entities e ON e.id = ia.entity_id
        WHERE e.entity_type = 'player'
          AND ia.review_status IN ('pending', 'approved', 'rejected')
          AND ia.media_status = 'media_not_required'
          AND ia.local_path IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
              FROM image_assets protected
             WHERE protected.id <> ia.id
               AND protected.local_path = ia.local_path
               AND (
                 protected.review_status = 'approved'
                 OR COALESCE(protected.media_status, 'required') = 'required'
               )
          )
        ORDER BY ia.id`
    );
    const mediaRoot = resolve(config.mediaRoot);
    const removable = new Map<string, { ids: string[]; bytes: number; names: string[] }>();
    const skipped: Array<{ id: string; localPath: string; reason: string }> = [];
    for (const candidate of candidates.rows) {
      const localPath = resolve(candidate.local_path);
      if (!localPath.startsWith(`${mediaRoot}/`)) {
        skipped.push({ id: candidate.id, localPath: candidate.local_path, reason: 'path_outside_media_root' });
        continue;
      }
      let bytes = 0;
      try {
        bytes = (await stat(localPath)).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          skipped.push({ id: candidate.id, localPath: candidate.local_path, reason: 'stat_failed' });
          continue;
        }
      }
      const current = removable.get(localPath) ?? { ids: [], bytes, names: [] };
      current.ids.push(candidate.id);
      current.names.push(candidate.canonical_name);
      removable.set(localPath, current);
    }
    const ids = [...removable.values()].flatMap((item) => item.ids);
    if (apply && ids.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE image_assets
              SET local_path = NULL,
                  metadata = metadata || jsonb_build_object(
                    'localBinaryRemovedAt', NOW(),
                    'localBinaryRemovalReason', 'media_not_required_catalog_cleanup'
                  )
            WHERE id = ANY($1::text[])
              AND review_status IN ('pending', 'approved', 'rejected')
              AND media_status = 'media_not_required'`,
          [ids]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      for (const [localPath] of removable) {
        try {
          await unlink(localPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            skipped.push({ id: ids.find((id) => candidates.rows.some((candidate) => candidate.id === id && resolve(candidate.local_path) === localPath)) ?? 'unknown', localPath, reason: 'unlink_failed' });
          }
        }
      }
    }
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      candidates: candidates.rows.length,
      uniqueFiles: removable.size,
      databaseRowsCleared: apply ? ids.length : 0,
      bytes: [...removable.values()].reduce((sum, item) => sum + item.bytes, 0),
      megabytes: Number(([...removable.values()].reduce((sum, item) => sum + item.bytes, 0) / 1048576).toFixed(1)),
      preservedForAudit: true,
      skipped
    }, null, 2));
  } else if (command === 'audit-assets') {
    const snapshotId = argument('snapshot');
    const entityType = argument('entity-type') as 'player' | 'club' | 'national_team' | undefined;
    const assetKind = argument('kind') as 'portrait' | 'badge' | undefined;
    const playableOnly = args.includes('--playable-only');
    if ((!snapshotId && !entityType) || (snapshotId && entityType) || !assetKind || !['portrait', 'badge'].includes(assetKind)) {
      throw new Error('Indica exactamente --snapshot o --entity-type player|club|national_team, además de --kind portrait|badge');
    }
    const result = snapshotId
      ? await pool.query<{ entity_id: string; canonical_name: string; entity_type: string; rank: number; asset_id: string | null; review_status: string | null; rights_basis: string | null; commercial_use: boolean | null; attribution_required: boolean | null; attribution_text: string | null; rights_verified_at: string | null; rights_evidence_url: string | null; trademark_status: string | null; usage_scope: string[] | null }>(
          `SELECT re.entity_id, e.canonical_name, e.entity_type, re.rank, ia.asset_id, ia.review_status,
                  ia.rights_basis, ia.commercial_use, ia.attribution_required, ia.attribution_text, ia.rights_verified_at, ia.rights_evidence_url, ia.trademark_status, ia.usage_scope
           FROM ranking_entries re
           JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
           JOIN entities e ON e.id = re.entity_id
           LEFT JOIN LATERAL (
             SELECT id AS asset_id, review_status, rights_basis, commercial_use, attribution_required, attribution_text, rights_verified_at, rights_evidence_url, trademark_status, usage_scope
             FROM image_assets
             WHERE entity_id = COALESCE(
                     (SELECT eil.canonical_entity_id
                      FROM entity_identity_links eil
                      WHERE eil.source_entity_id = e.id),
                     e.id
                   )
               AND asset_kind = $2
               AND is_primary = TRUE
             ORDER BY is_primary DESC, (review_status = 'pending') DESC, id
             LIMIT 1
           ) ia ON TRUE
           WHERE rs.id = $1 AND re.rank <= ${MAX_GAME_RANKING_ENTRIES}
             AND ($3::boolean = FALSE OR EXISTS (
               SELECT 1
               FROM entity_game_profiles playable_profile
               WHERE playable_profile.entity_id = COALESCE(
                       (SELECT eil.canonical_entity_id
                        FROM entity_identity_links eil
                        WHERE eil.source_entity_id = re.entity_id),
                       re.entity_id
                     )
                 AND playable_profile.playable_default
             ))
           ORDER BY re.rank, e.canonical_name`,
          [snapshotId, assetKind, playableOnly]
        )
      : await pool.query<{ entity_id: string; canonical_name: string; entity_type: string; rank: number | null; asset_id: string | null; review_status: string | null; rights_basis: string | null; commercial_use: boolean | null; attribution_required: boolean | null; attribution_text: string | null; rights_verified_at: string | null; rights_evidence_url: string | null; trademark_status: string | null; usage_scope: string[] | null }>(
          `SELECT DISTINCT ON (canonical_entity.id)
                  canonical_entity.id AS entity_id, canonical_entity.canonical_name, canonical_entity.entity_type, NULL::integer AS rank, ia.asset_id, ia.review_status,
                  ia.rights_basis, ia.commercial_use, ia.attribution_required, ia.attribution_text, ia.rights_verified_at, ia.rights_evidence_url, ia.trademark_status, ia.usage_scope
           FROM entities source_entity
           LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = source_entity.id
           JOIN entities canonical_entity ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, source_entity.id)
           LEFT JOIN LATERAL (
             SELECT id AS asset_id, review_status, rights_basis, commercial_use, attribution_required, attribution_text, rights_verified_at, rights_evidence_url, trademark_status, usage_scope
             FROM image_assets
             WHERE entity_id = canonical_entity.id
               AND asset_kind = $2
               AND is_primary = TRUE
             ORDER BY is_primary DESC, (review_status = 'pending') DESC, id
             LIMIT 1
           ) ia ON TRUE
           WHERE canonical_entity.entity_type = $1
             AND ($3::boolean = FALSE OR EXISTS (
               SELECT 1
               FROM entity_game_profiles playable_profile
               WHERE playable_profile.entity_id = canonical_entity.id
                 AND playable_profile.playable_default
             ))
           ORDER BY canonical_entity.id, source_entity.id`,
          [entityType, assetKind, playableOnly]
        );
    const missing = result.rows.filter((row) => !row.asset_id || row.review_status !== 'approved');
    const missingRights = result.rows.filter((row) => Boolean(row.asset_id) && row.review_status === 'approved' && (
      row.rights_basis === 'unknown'
      || row.commercial_use !== true
      || !row.rights_verified_at
      || !row.rights_evidence_url
      || !row.usage_scope || row.usage_scope.length === 0
      || (row.entity_type === 'club' && row.trademark_status !== 'cleared')
      || (row.attribution_required === true && !row.attribution_text)
    ));
    console.log(JSON.stringify({
      scope: snapshotId
        ? { snapshotId, top: MAX_GAME_RANKING_ENTRIES, playableOnly }
        : { entityType, playableOnly },
      assetKind,
      total: result.rows.length,
      approved: result.rows.length - missing.length,
      pendingOrMissing: missing.length,
      approvedButNotPublishable: missingRights.length,
      missing: missing.map((row) => ({ entityId: row.entity_id, name: row.canonical_name, rank: row.rank, status: row.review_status ?? 'missing' }))
        .concat(missingRights.map((row) => ({ entityId: row.entity_id, name: row.canonical_name, rank: row.rank, status: 'rights_review_required' })))
    }, null, 2));
  } else if (command === 'audit-data-readiness') {
    const categorySlug = argument('category');
    const result = await pool.query<{
      slug: string;
      snapshot_id: string | null;
      snapshot_status: string | null;
      generated_at: string | null;
      coverage_complete: boolean | null;
      unresolved_conflicts: number | null;
      eligible_count: number | null;
      closed_universe: boolean;
      source_key: string | null;
      source_rights_status: string | null;
      entries: number;
      unique_entities: number;
      playable: number;
      playable_with_image: number;
      missing_top_200_images: number;
      unique_top_200_missing_images: number;
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
       ), playable_profiles AS MATERIALIZED (
         SELECT DISTINCT COALESCE(ri.canonical_entity_id, egp.entity_id) AS canonical_entity_id
         FROM entity_game_profiles egp
           JOIN entities profile_entity ON profile_entity.id = egp.entity_id
           LEFT JOIN resolved_identity ri ON ri.source_entity_id = egp.entity_id
         WHERE egp.playable_default
           AND profile_entity.catalog_status = 'active'
       ), legal_assets AS MATERIALIZED (
         SELECT DISTINCT COALESCE(ri.canonical_entity_id, ia.entity_id) AS canonical_entity_id,
                         ia.asset_kind
         FROM image_assets ia
         JOIN entities asset_entity ON asset_entity.id = ia.entity_id
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = ia.entity_id
         WHERE ia.is_primary = TRUE
           AND ia.review_status = 'approved'
           AND ia.rights_basis <> 'unknown'
           AND ia.commercial_use = TRUE
           AND ia.rights_verified_at IS NOT NULL
           AND ia.rights_evidence_url IS NOT NULL
           AND jsonb_array_length(ia.usage_scope) > 0
           AND (asset_entity.entity_type <> 'club' OR ia.trademark_status = 'cleared')
           AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
       ), latest AS (
         SELECT DISTINCT ON (rs.category_id)
                rs.id, rs.category_id, rs.status, rs.generated_at,
                rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count,
                c.entity_type,
                COALESCE((c.scope->>'closedUniverse')::boolean, FALSE) AS closed_universe,
                ss.source_key, s.rights_status
         FROM ranking_snapshots rs
         JOIN category_definitions c ON c.id = rs.category_id
                                      AND c.scope_kind NOT IN ('integration', 'test')
         LEFT JOIN source_snapshots ss ON ss.id = rs.metadata->>'sourceSnapshotId'
         LEFT JOIN sources s ON s.key = ss.source_key
         WHERE rs.status <> 'superseded'
         ORDER BY rs.category_id, rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC
       ), entry_stats AS (
         SELECT l.id AS snapshot_id,
                re.entity_id,
                re.rank,
                COALESCE(ri.canonical_entity_id, re.entity_id) AS canonical_entity_id,
                EXISTS (
                  SELECT 1 FROM playable_profiles playable_profile
                  WHERE playable_profile.canonical_entity_id = COALESCE(ri.canonical_entity_id, re.entity_id)
                ) AS playable,
                EXISTS (
                  SELECT 1 FROM legal_assets legal_asset
                  WHERE legal_asset.canonical_entity_id = COALESCE(ri.canonical_entity_id, re.entity_id)
                    AND legal_asset.asset_kind = CASE WHEN e.entity_type = 'player' THEN 'portrait' ELSE 'badge' END
                ) AS has_image
         FROM latest l
         JOIN ranking_entries re ON re.snapshot_id = l.id
         JOIN entities e ON e.id = re.entity_id
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = re.entity_id
       ), stats AS (
         SELECT l.*,
                COUNT(es.entity_id)::int AS entries,
                COUNT(DISTINCT es.canonical_entity_id)::int AS unique_entities,
                COUNT(DISTINCT es.canonical_entity_id) FILTER (WHERE (l.closed_universe OR es.rank <= ${MAX_GAME_RANKING_ENTRIES}) AND es.playable)::int AS playable,
                COUNT(DISTINCT es.canonical_entity_id) FILTER (WHERE (l.closed_universe OR es.rank <= ${MAX_GAME_RANKING_ENTRIES}) AND es.playable AND es.has_image)::int AS playable_with_image,
                COUNT(*) FILTER (WHERE es.rank <= ${MAX_GAME_RANKING_ENTRIES} AND es.playable AND NOT es.has_image)::int AS missing_top_200_images,
                COUNT(DISTINCT es.canonical_entity_id) FILTER (WHERE es.rank <= ${MAX_GAME_RANKING_ENTRIES} AND es.playable AND NOT es.has_image)::int AS unique_top_200_missing_images
         FROM latest l
         LEFT JOIN entry_stats es ON es.snapshot_id = l.id
         GROUP BY l.id, l.category_id, l.status, l.generated_at, l.coverage_complete,
                  l.unresolved_conflicts, l.eligible_count, l.entity_type, l.closed_universe,
                  l.source_key, l.rights_status
       )
       SELECT c.slug, stats.id AS snapshot_id, stats.status AS snapshot_status,
              stats.generated_at, stats.coverage_complete, stats.unresolved_conflicts,
              stats.eligible_count, stats.entity_type,
              COALESCE((c.scope->>'closedUniverse')::boolean, FALSE) AS closed_universe,
              stats.source_key, stats.rights_status AS source_rights_status,
              stats.entries, stats.unique_entities, stats.playable, stats.playable_with_image,
              stats.missing_top_200_images, stats.unique_top_200_missing_images
       FROM category_definitions c
       LEFT JOIN stats ON stats.category_id = c.id
       WHERE c.status <> 'retired'
         AND c.scope_kind NOT IN ('integration', 'test')
         AND ($1::text IS NULL OR c.slug = $1)
       ORDER BY c.slug`,
      [categorySlug ?? null]
    );
    const summaryResult = await pool.query<{ summary: Record<string, unknown> }>(
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
       ), latest AS (
         SELECT DISTINCT ON (rs.category_id)
                rs.id,
                rs.category_id,
                rs.coverage_complete,
                rs.eligible_count,
                rs.unresolved_conflicts,
                c.entity_type,
                COALESCE((c.scope->>'closedUniverse')::boolean, FALSE) AS closed_universe,
                COALESCE(src.rights_status, 'unknown') AS source_rights_status
         FROM ranking_snapshots rs
         JOIN category_definitions c ON c.id = rs.category_id
         LEFT JOIN source_snapshots ss ON ss.id = rs.metadata->>'sourceSnapshotId'
         LEFT JOIN sources src ON src.key = ss.source_key
         WHERE rs.status <> 'superseded'
           AND c.status <> 'retired'
           AND c.scope_kind NOT IN ('integration', 'test')
         ORDER BY rs.category_id, rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC
       ), ranked AS (
         SELECT re.entity_id,
                COALESCE(ri.canonical_entity_id, re.entity_id) AS canonical_entity_id,
                re.rank,
                e.entity_type
         FROM latest l
         JOIN ranking_entries re ON re.snapshot_id = l.id
         JOIN entities e ON e.id = re.entity_id
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = re.entity_id
         WHERE re.rank <= ${MAX_GAME_RANKING_ENTRIES}
         ), legal_portraits AS (
           SELECT DISTINCT COALESCE(ri.canonical_entity_id, ia.entity_id) AS entity_id
             FROM image_assets ia
             JOIN entities e ON e.id = ia.entity_id
             LEFT JOIN resolved_identity ri ON ri.source_entity_id = ia.entity_id
         WHERE e.entity_type = 'player'
           AND ia.asset_kind = 'portrait'
           AND ia.is_primary = TRUE
           AND ia.review_status = 'approved'
           AND ia.rights_basis <> 'unknown'
           AND ia.commercial_use = TRUE
           AND ia.rights_verified_at IS NOT NULL
           AND ia.rights_evidence_url IS NOT NULL
               AND jsonb_array_length(ia.usage_scope) > 0
                 AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
       ), pending_portraits AS (
         SELECT DISTINCT COALESCE(ri.canonical_entity_id, ia.entity_id) AS entity_id
         FROM image_assets ia
         JOIN entities e ON e.id = ia.entity_id
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = ia.entity_id
         WHERE e.entity_type = 'player'
           AND ia.asset_kind = 'portrait'
           AND ia.review_status = 'pending'
           AND ia.local_path IS NOT NULL
       ), ranked_players AS (
         SELECT DISTINCT canonical_entity_id
         FROM ranked
         WHERE entity_type = 'player'
       ), playable_players AS (
         SELECT DISTINCT COALESCE(ri.canonical_entity_id, egp.entity_id) AS entity_id
         FROM entity_game_profiles egp
         JOIN entities e ON e.id = egp.entity_id
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = egp.entity_id
         WHERE e.entity_type = 'player'
           AND e.catalog_status = 'active'
           AND egp.playable_default = TRUE
       ), category_playability AS (
         SELECT l.category_id,
                l.entity_type,
                l.closed_universe,
                COUNT(DISTINCT COALESCE(ri.canonical_entity_id, re.entity_id))
                  FILTER (WHERE pp.entity_id IS NOT NULL)::int AS playable_entries
         FROM latest l
         JOIN ranking_entries re
           ON re.snapshot_id = l.id
          AND re.rank <= ${MAX_GAME_RANKING_ENTRIES}
         JOIN entities ranked_entity ON ranked_entity.id = re.entity_id
         LEFT JOIN resolved_identity ri ON ri.source_entity_id = re.entity_id
         LEFT JOIN playable_players pp
           ON pp.entity_id = COALESCE(ri.canonical_entity_id, re.entity_id)
         GROUP BY l.category_id, l.entity_type, l.closed_universe
       )
       SELECT json_build_object(
         'rawPlayerRows', (SELECT COUNT(*)::int FROM entities WHERE entity_type = 'player'),
         'playerEntityRows', (SELECT COUNT(*)::int FROM entities WHERE entity_type = 'player'),
         'canonicalUniquePlayers', (
           SELECT COUNT(DISTINCT COALESCE(ri.canonical_entity_id, e.id))::int
           FROM entities e
           LEFT JOIN resolved_identity ri ON ri.source_entity_id = e.id
           WHERE e.entity_type = 'player'
         ),
         'identityLinks', (
           SELECT COUNT(*)::int
           FROM entity_identity_links
         ),
         'identityLinkChains', (
           SELECT COUNT(*)::int
           FROM entity_identity_links link
           WHERE EXISTS (
             SELECT 1
             FROM entity_identity_links nested_link
             WHERE nested_link.source_entity_id = link.canonical_entity_id
           )
         ),
         'playerProfiles', (
           SELECT COUNT(*)::int
           FROM entity_game_profiles egp
           JOIN entities e ON e.id = egp.entity_id
           WHERE e.entity_type = 'player'
         ),
         'playablePlayerProfiles', (SELECT COUNT(*)::int FROM playable_players),
         'legalPortraitAssets', (
           SELECT COUNT(*)::int
           FROM image_assets ia
           JOIN entities e ON e.id = ia.entity_id
           WHERE e.entity_type = 'player'
             AND ia.asset_kind = 'portrait'
             AND ia.review_status = 'approved'
             AND ia.rights_basis <> 'unknown'
             AND ia.commercial_use = TRUE
             AND ia.rights_verified_at IS NOT NULL
             AND ia.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(ia.usage_scope) > 0
             AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
         ),
         'canonicalPlayersWithPortrait', (
           SELECT COUNT(DISTINCT lp.entity_id)::int
           FROM legal_portraits lp
         ),
         'top200Positions', (SELECT COUNT(*)::int FROM ranked),
         'top200PlayerPositions', (SELECT COUNT(*)::int FROM ranked WHERE entity_type = 'player'),
         'top200PlayerPositionsWithPortrait', (
           SELECT COUNT(*)::int
           FROM ranked r
           JOIN legal_portraits lp ON lp.entity_id = r.canonical_entity_id
           WHERE r.entity_type = 'player'
         ),
         'rankedPlayerPositionCount', (SELECT COUNT(*)::int FROM ranked WHERE entity_type = 'player'),
         'rankedPlayerPositionsWithLegalPortrait', (
           SELECT COUNT(*)::int
           FROM ranked r
           JOIN legal_portraits lp ON lp.entity_id = r.canonical_entity_id
           WHERE r.entity_type = 'player'
         ),
         'uniqueRankedPlayers', (SELECT COUNT(*)::int FROM ranked_players),
         'uniqueRankedPlayersWithPortrait', (
           SELECT COUNT(*)::int
           FROM ranked_players rp
           JOIN legal_portraits lp ON lp.entity_id = rp.canonical_entity_id
         ),
         'rankedPlayablePlayers', (
           SELECT COUNT(*)::int
           FROM ranked_players rp
           JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
         ),
         'rankedPlayablePlayersWithPortrait', (
           SELECT COUNT(*)::int
           FROM ranked_players rp
           JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
           JOIN legal_portraits lp ON lp.entity_id = rp.canonical_entity_id
         ),
         'rankedPlayablePlayersWithoutPortrait', (
           SELECT COUNT(*)::int
           FROM ranked_players rp
           JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
           LEFT JOIN legal_portraits lp ON lp.entity_id = rp.canonical_entity_id
           WHERE lp.entity_id IS NULL
         ),
         'rankedPlayablePlayersWithPendingPortrait', (
           SELECT COUNT(*)::int
           FROM ranked_players rp
           JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
           JOIN pending_portraits pending ON pending.entity_id = rp.canonical_entity_id
         ),
         'pendingPortraitAssets', (
           SELECT COUNT(*)::int
           FROM image_assets ia
           JOIN entities e ON e.id = ia.entity_id
           WHERE e.entity_type = 'player'
             AND ia.asset_kind = 'portrait'
             AND ia.review_status = 'pending'
             AND ia.local_path IS NOT NULL
         ),
         'rankedPlayablePlayersPortraitCoveragePercent', (
           ROUND(
             100.0 * (
               SELECT COUNT(*)
               FROM ranked_players rp
               JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
               JOIN legal_portraits lp ON lp.entity_id = rp.canonical_entity_id
             ) / NULLIF((SELECT COUNT(*) FROM ranked_players rp JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id), 0),
             2
           )
         ),
         'primaryGamePortraitCoverage', json_build_object(
           'covered', (
             SELECT COUNT(*)::int
             FROM ranked_players rp
             JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
             JOIN legal_portraits lp ON lp.entity_id = rp.canonical_entity_id
           ),
           'required', (
             SELECT COUNT(*)::int
             FROM ranked_players rp
             JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
           ),
           'percent', (
             ROUND(100.0 * (
               SELECT COUNT(*)
               FROM ranked_players rp
               JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
               JOIN legal_portraits lp ON lp.entity_id = rp.canonical_entity_id
             ) / NULLIF((SELECT COUNT(*) FROM ranked_players rp JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id), 0), 2)
           ),
           'unit', 'unique_playable_ranked_players',
           'definition', 'Cada persona jugable única presente en al menos un ranking activo; un retrato canónico por persona.'
         ),
         'visualAvailability', json_build_object(
           'covered', (
             SELECT COUNT(*)::int
             FROM ranked_players rp
             JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
           ),
           'required', (
             SELECT COUNT(*)::int
             FROM ranked_players rp
             JOIN playable_players pp ON pp.entity_id = rp.canonical_entity_id
           ),
           'percent', 100.0,
           'unit', 'unique_playable_ranked_players',
           'definition', 'Disponibilidad visual para el juego: retrato licenciado o fallback propio determinista; el fallback no es una licencia de imagen.'
         ),
         'clubProfiles', (
           SELECT COUNT(*)::int
           FROM entity_game_profiles egp
           JOIN entities e ON e.id = egp.entity_id
           WHERE e.entity_type = 'club'
         ),
         'playableClubProfiles', (
           SELECT COUNT(DISTINCT COALESCE(ri.canonical_entity_id, egp.entity_id))::int
           FROM entity_game_profiles egp
           JOIN entities e ON e.id = egp.entity_id
           LEFT JOIN resolved_identity ri ON ri.source_entity_id = egp.entity_id
           WHERE e.entity_type = 'club'
             AND egp.playable_default = TRUE
         ),
         'legalBadgeAssets', (
           SELECT COUNT(*)::int
           FROM image_assets ia
           JOIN entities e ON e.id = ia.entity_id
           WHERE e.entity_type IN ('club', 'national_team')
             AND ia.asset_kind = 'badge'
             AND ia.review_status = 'approved'
             AND ia.rights_basis <> 'unknown'
             AND ia.commercial_use = TRUE
             AND ia.rights_verified_at IS NOT NULL
             AND ia.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(ia.usage_scope) > 0
             AND (e.entity_type <> 'club' OR ia.trademark_status = 'cleared')
             AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
         ),
         'legalClubBadgeAssets', (
           SELECT COUNT(*)::int
           FROM image_assets ia
           JOIN entities e ON e.id = ia.entity_id
           WHERE e.entity_type = 'club'
             AND ia.asset_kind = 'badge'
             AND ia.review_status = 'approved'
             AND ia.rights_basis <> 'unknown'
             AND ia.commercial_use = TRUE
             AND ia.rights_verified_at IS NOT NULL
             AND ia.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(ia.usage_scope) > 0
             AND ia.trademark_status = 'cleared'
             AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
         ),
         'legalNationalTeamBadgeAssets', (
           SELECT COUNT(*)::int
           FROM image_assets ia
           JOIN entities e ON e.id = ia.entity_id
           WHERE e.entity_type = 'national_team'
             AND ia.asset_kind = 'badge'
             AND ia.review_status = 'approved'
             AND ia.rights_basis <> 'unknown'
             AND ia.commercial_use = TRUE
             AND ia.rights_verified_at IS NOT NULL
             AND ia.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(ia.usage_scope) > 0
             AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
         ),
         'rankedClubPositions', (SELECT COUNT(*)::int FROM ranked WHERE entity_type = 'club'),
         'rankedClubPositionsWithBadge', (
           SELECT COUNT(DISTINCT r.canonical_entity_id)::int
           FROM ranked r
           JOIN image_assets ia
             ON COALESCE((
                  SELECT iw.canonical_entity_id
                  FROM resolved_identity iw
                  WHERE iw.source_entity_id = ia.entity_id
                ), ia.entity_id) = r.canonical_entity_id
            JOIN entities asset_entity ON asset_entity.id = ia.entity_id
           WHERE r.entity_type = 'club'
             AND ia.asset_kind = 'badge'
             AND ia.is_primary = TRUE
             AND ia.review_status = 'approved'
             AND ia.rights_basis <> 'unknown'
             AND ia.commercial_use = TRUE
             AND ia.rights_verified_at IS NOT NULL
             AND ia.rights_evidence_url IS NOT NULL
             AND jsonb_array_length(ia.usage_scope) > 0
             AND ia.trademark_status = 'cleared'
             AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
         ),
         'activeCategoryCount', (SELECT COUNT(*)::int FROM latest),
         'categoriesWithRequiredSize', (
           SELECT COUNT(*)::int
           FROM latest
           WHERE eligible_count >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
         ),
         'categoriesWithRequiredSizePercent', (
           ROUND(100.0 * (
             SELECT COUNT(*)
             FROM latest
             WHERE eligible_count >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
           ) / NULLIF((SELECT COUNT(*) FROM latest), 0), 1)
         ),
         'playerCategoriesWithRequiredPlayableSize', (
           SELECT COUNT(*)::int
           FROM category_playability
           WHERE entity_type = 'player'
             AND playable_entries >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
         ),
         'playerCategoriesWithRequiredPlayableSizePercent', (
           ROUND(100.0 * (
             SELECT COUNT(*)
             FROM category_playability
             WHERE entity_type = 'player'
               AND playable_entries >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
           ) / NULLIF((SELECT COUNT(*) FROM category_playability WHERE entity_type = 'player'), 0), 1)
         ),
         'categoriesWithCompleteData', (
           SELECT COUNT(*)::int
           FROM latest
           WHERE coverage_complete
             AND unresolved_conflicts = 0
             AND eligible_count >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
         ),
         'categoriesWithCompleteDataPercent', (
           ROUND(100.0 * (
             SELECT COUNT(*)
             FROM latest
             WHERE coverage_complete
               AND unresolved_conflicts = 0
               AND eligible_count >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
           ) / NULLIF((SELECT COUNT(*) FROM latest), 0), 1)
         ),
         'categoryDataCoverage', json_build_object(
           'complete', (
             SELECT COUNT(*)::int
             FROM latest
             WHERE coverage_complete
               AND unresolved_conflicts = 0
               AND eligible_count >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
           ),
           'active', (SELECT COUNT(*)::int FROM latest),
           'percent', (
             ROUND(100.0 * (
               SELECT COUNT(*)
               FROM latest
               WHERE coverage_complete
                 AND unresolved_conflicts = 0
                 AND eligible_count >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
             ) / NULLIF((SELECT COUNT(*) FROM latest), 0), 1)
           ),
           'unit', 'active_categories',
           'definition', 'Categoría con cobertura validada, sin conflictos y con 200 entradas (o universo cerrado completo).'
         ),
         'rankingEntryCoverage', json_build_object(
           'sized', (
             SELECT COUNT(*)::int
             FROM latest
             WHERE eligible_count >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
           ),
           'active', (SELECT COUNT(*)::int FROM latest),
           'percent', (
             ROUND(100.0 * (
               SELECT COUNT(*)
               FROM latest
               WHERE eligible_count >= CASE WHEN closed_universe THEN 1 ELSE ${MAX_GAME_RANKING_ENTRIES} END
             ) / NULLIF((SELECT COUNT(*) FROM latest), 0), 1)
           ),
           'unit', 'active_categories',
           'definition', 'Categoría cuyo snapshot activo contiene el tamaño mínimo requerido; no implica que el histórico esté validado ni que la fuente tenga derechos aprobados.'
         ),
         'progressMetricPolicy', json_build_object(
           'primaryPortraitMetric', 'primaryGamePortraitCoverage',
           'categoryMetric', 'categoryDataCoverage',
           'notIncludedInCoverage', json_build_array('duplicate ranking positions', 'alternative image assets', 'non-playable entities', 'pending or unverified media'),
           'overallPercent', NULL,
           'overallPercentReason', 'No se calcula un porcentaje global sin ponderación aprobada entre datos, retratos, escudos, licencias y publicación.'
         ),
         'openCategoriesWithTwoHundred', (
           SELECT COUNT(*)::int
           FROM latest
           WHERE NOT closed_universe AND eligible_count >= ${MAX_GAME_RANKING_ENTRIES}
         ),
         'closedCategoriesComplete', (
           SELECT COUNT(*)::int
           FROM latest
           WHERE closed_universe
             AND coverage_complete
             AND unresolved_conflicts = 0
             AND eligible_count >= 1
         )
       ) AS summary`
    );
    console.log(JSON.stringify({
      summary: summaryResult.rows[0]?.summary ?? {},
      categories: result.rows.map((row) => ({
        ...row,
        readyForPublish: Boolean(
          row.snapshot_id
          && row.coverage_complete
          && (row.unresolved_conflicts ?? 0) === 0
          && (row.eligible_count ?? 0) >= (row.closed_universe ? 1 : MAX_GAME_RANKING_ENTRIES)
          && (row.playable ?? 0) >= (row.closed_universe ? 1 : MAX_GAME_RANKING_ENTRIES)
          && row.source_rights_status === 'approved'
        )
      }))
    }, null, 2));
  } else if (command === 'reject-image') {
    const imageId = argument('id');
    const reason = argument('reason');
    if (!imageId || !reason) throw new Error('Faltan --id o --reason');
    const result = await pool.query(
      `UPDATE image_assets
       SET review_status = 'rejected', is_primary = FALSE,
           metadata = metadata || jsonb_build_object('rejectionReason', $2::text, 'rejectedAt', NOW())
       WHERE id = $1 AND review_status = 'pending'
       RETURNING id`,
      [imageId, reason]
    );
    if (!result.rows[0]) throw new Error(`Imagen inexistente o no pendiente: ${imageId}`);
    console.log(`Imagen rechazada: ${imageId}`);
  } else if (command === 'approve-snapshot') {
    const snapshotId = argument('snapshot');
    if (!snapshotId) throw new Error('Falta --snapshot');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{
        id: string;
        category_status: string;
        coverage_complete: boolean;
        unresolved_conflicts: number;
        eligible_count: number;
        source_rights_status: string | null;
        closed_universe: boolean;
        storage_uri: string | null;
        content_sha256: string | null;
      }>(
        `SELECT rs.id, c.status AS category_status, rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count,
                COALESCE((c.scope->>'closedUniverse')::boolean, FALSE) AS closed_universe,
                s.rights_status AS source_rights_status, ss.storage_uri, ss.content_sha256
         FROM ranking_snapshots rs
         JOIN category_definitions c ON c.id = rs.category_id
         LEFT JOIN source_snapshots ss ON ss.id = rs.metadata->>'sourceSnapshotId'
         LEFT JOIN sources s ON s.key = ss.source_key
         WHERE rs.id = $1 AND rs.status = 'draft'
         FOR UPDATE OF rs`,
        [snapshotId]
      );
      const snapshot = result.rows[0];
      if (!snapshot) throw new Error('Snapshot inexistente o no está en estado draft');
      if (!['approved', 'published'].includes(snapshot.category_status)) throw new Error('La categoría debe estar aprobada');
      if (snapshot.source_rights_status !== 'approved') throw new Error('La fuente no tiene los derechos aprobados');
      if (!snapshot.coverage_complete || snapshot.unresolved_conflicts > 0 || snapshot.eligible_count < (snapshot.closed_universe ? 1 : MAX_GAME_RANKING_ENTRIES)) {
        throw new Error(`El snapshot no cumple cobertura completa, conflictos resueltos y mínimo de ${MAX_GAME_RANKING_ENTRIES} entidades`);
      }
      await verifySnapshotRankingEntries(client, snapshotId, snapshot.closed_universe);
      await verifySnapshotArchive(snapshot);
      await client.query(`UPDATE ranking_snapshots SET status = 'approved' WHERE id = $1`, [snapshotId]);
      await client.query('COMMIT');
      console.log(`Snapshot aprobado: ${snapshotId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'publish') {
    const snapshotId = argument('snapshot');
    if (!snapshotId) throw new Error('Falta --snapshot');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{
        category_id: string;
        category_status: string;
        coverage_complete: boolean;
        unresolved_conflicts: number;
        eligible_count: number;
        source_rights_status: string | null;
        closed_universe: boolean;
        storage_uri: string | null;
        content_sha256: string | null;
      }>(
        `SELECT rs.category_id, c.status AS category_status, rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count,
                COALESCE((c.scope->>'closedUniverse')::boolean, FALSE) AS closed_universe,
                s.rights_status AS source_rights_status, ss.storage_uri, ss.content_sha256
         FROM ranking_snapshots rs
         JOIN category_definitions c ON c.id = rs.category_id
         LEFT JOIN source_snapshots ss ON ss.id = rs.metadata->>'sourceSnapshotId'
         LEFT JOIN sources s ON s.key = ss.source_key
         WHERE rs.id = $1 AND rs.status = 'approved'
         FOR UPDATE OF rs`,
        [snapshotId]
      );
      const snapshot = result.rows[0];
      if (!snapshot) throw new Error('Snapshot inexistente o no aprobado para publicación');
      if (!['approved', 'published'].includes(snapshot.category_status)) {
        throw new Error('La categoría debe estar aprobada antes de publicar');
      }
      if (snapshot.source_rights_status !== 'approved') {
        throw new Error('La fuente del snapshot no tiene los derechos aprobados');
      }
      await verifySnapshotArchive(snapshot);
      if (!snapshot.coverage_complete || snapshot.unresolved_conflicts > 0 || snapshot.eligible_count < (snapshot.closed_universe ? 1 : MAX_GAME_RANKING_ENTRIES)) {
        throw new Error(`El snapshot no cumple cobertura completa, conflictos resueltos y mínimo de ${MAX_GAME_RANKING_ENTRIES} entidades`);
      }
      await verifySnapshotRankingEntries(client, snapshotId, snapshot.closed_universe);
      await client.query(`UPDATE ranking_snapshots SET status = 'superseded' WHERE category_id = $1 AND status = 'published'`, [snapshot.category_id]);
      await client.query(`UPDATE ranking_snapshots SET status = 'published' WHERE id = $1`, [snapshotId]);
      await client.query('COMMIT');
      console.log(`Snapshot publicado: ${snapshotId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'normalize-image') {
    const input = argument('input');
    const output = argument('output');
    if (!input || !output) throw new Error('Faltan --input y --output');
    await mkdir(resolve(output, '..'), { recursive: true });
    const metadata = await sharp(input).metadata();
    if (!metadata.width || !metadata.height) throw new Error('La imagen no tiene dimensiones válidas');
    await sharp(input)
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'top' })
      .webp({ quality: 88 })
      .toFile(output);
    const bytes = await readFile(output);
    console.log(JSON.stringify({ input: basename(input), output, width: 512, height: 512, mimeType: 'image/webp', sha256: createHash('sha256').update(bytes).digest('hex') }));
  } else if (command === 'register-image') {
    const entityId = argument('entity');
    const sourceUrl = argument('source-url');
    const provider = argument('provider');
    const input = argument('input');
    const licenseName = argument('license');
    const licenseUrl = argument('license-url');
    const requestedKind = argument('kind');
    const approve = args.includes('--approve');
    const allowShareAlike = args.includes('--allow-share-alike');
    const rightsBasis = argument('rights-basis');
    const commercialUse = args.includes('--commercial-use');
    const attributionRequired = args.includes('--attribution-required');
    const attributionText = argument('attribution');
    const trademarkStatus = argument('trademark-status');
    const rightsEvidenceUrl = argument('rights-evidence-url');
    const reviewer = argument('reviewer');
    if (!entityId || !sourceUrl || !provider || !input) throw new Error('Faltan --entity, --source-url, --provider o --input');
    try {
      new URL(sourceUrl);
    } catch {
      throw new Error('La URL de origen de la imagen no es válida');
    }
    let sourceRightsStatus = 'unknown';
    if (provider.toLowerCase().includes('thesportsdb')) {
      const source = await pool.query<{ rights_status: string }>(
        `SELECT rights_status FROM sources WHERE key = 'thesportsdb-artwork'`
      );
      sourceRightsStatus = source.rows[0]?.rights_status ?? 'unknown';
    }
    const metadata = await sharp(input).metadata();
    if (metadata.width !== 512 || metadata.height !== 512 || metadata.format !== 'webp') {
      throw new Error('La imagen registrada debe ser WebP de 512x512; utiliza normalize-image antes');
    }
    const bytes = await readFile(input);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const mediaRoot = resolve(config.mediaRoot);
    const inputPath = resolve(input);
    if (!inputPath.startsWith(`${mediaRoot}/`)) {
      throw new Error(`La imagen debe estar dentro de MEDIA_ROOT (${mediaRoot})`);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const entity = await client.query<{ id: string; entity_type: 'player' | 'club' | 'national_team' }>('SELECT id, entity_type FROM entities WHERE id = $1', [entityId]);
      if (!entity.rows[0]) throw new Error(`Entidad inexistente: ${entityId}`);
      const inferredKind = entity.rows[0].entity_type === 'player' ? 'portrait' : 'badge';
      const assetKind = (requestedKind ?? inferredKind) as 'portrait' | 'badge';
      if (!['portrait', 'badge'].includes(assetKind)) throw new Error('El tipo de activo debe ser portrait o badge');
      if ((assetKind === 'portrait' && entity.rows[0].entity_type !== 'player') || (assetKind === 'badge' && entity.rows[0].entity_type === 'player')) {
        throw new Error(`El activo ${assetKind} no corresponde al tipo ${entity.rows[0].entity_type}`);
      }
      const rightsReview = approve
        ? assertRightsApproval({
          assetKind,
          entityType: entity.rows[0].entity_type,
          provider,
          licenseName,
          licenseUrl,
          sourceRightsStatus,
          rightsBasis,
          commercialUse,
          attributionRequired,
          attributionText,
          trademarkStatus,
          rightsEvidenceUrl,
          usageScope: argument('usage-scope'),
          allowShareAlike
        })
        : null;
      if (approve) await client.query('UPDATE image_assets SET is_primary = FALSE WHERE entity_id = $1', [entityId]);
      await client.query(
        `INSERT INTO image_assets (id, entity_id, asset_kind, source_url, local_path, provider, license_name, license_url, width, height, mime_type, sha256, is_primary, review_status, rights_basis, commercial_use, attribution_required, attribution_text, rights_evidence_url, rights_verified_at, rights_verified_by, trademark_status, usage_scope, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 512, 512, 'image/webp', $9, $10, $11, $12, $13, $14, $15, $16, CASE WHEN $10 THEN NOW() ELSE NULL END, $17, $18, $19::jsonb, $20)
           ON CONFLICT (id) DO UPDATE SET source_url = EXCLUDED.source_url, provider = EXCLUDED.provider, license_name = EXCLUDED.license_name, license_url = EXCLUDED.license_url, asset_kind = EXCLUDED.asset_kind, local_path = EXCLUDED.local_path, sha256 = EXCLUDED.sha256, is_primary = EXCLUDED.is_primary, review_status = EXCLUDED.review_status, rights_basis = EXCLUDED.rights_basis, commercial_use = EXCLUDED.commercial_use, attribution_required = EXCLUDED.attribution_required, attribution_text = EXCLUDED.attribution_text, rights_evidence_url = EXCLUDED.rights_evidence_url, rights_verified_at = EXCLUDED.rights_verified_at, rights_verified_by = EXCLUDED.rights_verified_by, trademark_status = EXCLUDED.trademark_status, usage_scope = EXCLUDED.usage_scope, metadata = EXCLUDED.metadata`,
        [
          `img_${createHash('sha256').update(`${entityId}:${assetKind}:${sourceUrl}:${hash}`).digest('hex').slice(0, 24)}`,
          entityId,
          assetKind,
          sourceUrl,
          input,
          provider,
          licenseName ?? null,
          licenseUrl ?? null,
          hash,
          approve,
          approve ? 'approved' : 'pending',
          rightsReview?.rightsBasis ?? 'unknown',
          approve ? commercialUse : false,
          approve ? attributionRequired || Boolean(attributionText) : false,
          approve ? attributionText ?? null : null,
          approve ? rightsReview?.rightsEvidenceUrl ?? null : rightsEvidenceUrl ?? null,
          approve ? reviewer : null,
          approve ? rightsReview?.trademarkStatus ?? 'not_applicable' : trademarkStatus ?? 'not_applicable',
          approve ? JSON.stringify(rightsReview?.usageScope ?? []) : '[]',
          JSON.stringify(
            allowShareAlike && approve
              ? {
                shareAlikeAccepted: true,
                shareAlikeAcceptedAt: new Date().toISOString(),
                ...(licenseName ? { derivedLicenseName: licenseName, derivedLicenseUrl: licenseUrl ?? null } : {})
              }
              : {}
          )
        ]
      );
      if (approve) {
        await client.query(
          `INSERT INTO media_rights_reviews (id, image_asset_id, decision, rights_basis, commercial_use, attribution_required, attribution_text, trademark_status, evidence_url, reviewer, notes, usage_scope)
           VALUES ($1, $2, 'approved', $3, TRUE, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
          [
            `mrr_${createHash('sha256').update(`${entityId}:${assetKind}:${sourceUrl}:${reviewer}:${Date.now()}`).digest('hex').slice(0, 24)}`,
            `img_${createHash('sha256').update(`${entityId}:${assetKind}:${sourceUrl}:${hash}`).digest('hex').slice(0, 24)}`,
            rightsReview?.rightsBasis,
            attributionRequired || Boolean(attributionText),
            attributionText ?? null,
            rightsReview?.trademarkStatus,
            rightsReview?.rightsEvidenceUrl,
            reviewer,
            argument('rights-notes') ?? '',
            JSON.stringify(rightsReview?.usageScope ?? [])
          ]
        );
      }
      await client.query('COMMIT');
      console.log(`Imagen registrada para ${entityId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'create-daily-draft') {
    const date = argument('date');
    if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) throw new Error('Falta --date YYYY-MM-DD');
    const result = await materializeDailyGameChallenge(date, parseDailyChallengeCategories(), false);
    console.log(JSON.stringify({ ...result, status: 'draft', reason: 'rights_and_publication_review_required' }, null, 2));
  } else if (command === '__legacy_create_daily_draft_disabled__') {
    const date = argument('date');
    const categorySlug = argument('category');
    if (!date || !categorySlug || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Faltan --date YYYY-MM-DD o --category');
    }
    const challengeId = `daily_${date}_${categorySlug}`;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const snapshot = await client.query<{
        id: string;
        category_id: string;
        data_version: string;
        status: string;
        coverage_complete: boolean;
        unresolved_conflicts: number;
        eligible_count: number;
      }>(
        `SELECT rs.id, rs.category_id, rs.data_version, rs.status,
                rs.coverage_complete, rs.unresolved_conflicts, rs.eligible_count
           FROM ranking_snapshots rs
           JOIN category_definitions c ON c.id = rs.category_id
          WHERE c.slug = $1 AND rs.status IN ('draft', 'approved', 'published')
          ORDER BY rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC
          LIMIT 1
          FOR UPDATE OF rs`,
        [categorySlug]
      );
      const current = snapshot.rows[0];
      if (!current) throw new Error(`No hay snapshot para ${categorySlug}`);

      const entries = await client.query<{ entity_id: string; rank: number; score_value: number }>(
        `SELECT selected.entity_id, selected.rank, selected.score_value
           FROM (
             SELECT DISTINCT ON (canonical_entity.id)
                    canonical_entity.id AS entity_id, re.rank, re.score_value
               FROM ranking_entries re
               JOIN entities source_entity ON source_entity.id = re.entity_id
               LEFT JOIN entity_identity_links identity_link
                 ON identity_link.source_entity_id = re.entity_id
               JOIN entities canonical_entity
                 ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
               JOIN entity_game_profiles egp
                 ON egp.entity_id = canonical_entity.id
              WHERE re.snapshot_id = $1
                AND re.rank <= ${MAX_GAME_RANKING_ENTRIES}
                AND canonical_entity.catalog_status = 'active'
                AND egp.playable_default = TRUE
              ORDER BY canonical_entity.id, re.rank, re.entity_id
           ) selected
          ORDER BY selected.rank, selected.entity_id`,
        [current.id]
      );
      if (entries.rowCount === 0) throw new Error(`El snapshot ${current.id} no tiene entradas`);

      await client.query(
        `INSERT INTO challenges
           (id, challenge_kind, challenge_date, category_id, ranking_snapshot_id, status, published_at, metadata)
         VALUES ($1, 'daily', $2, $3, $4, 'draft', NULL, $5::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           ranking_snapshot_id = EXCLUDED.ranking_snapshot_id,
           status = 'draft',
           published_at = NULL,
           metadata = EXCLUDED.metadata`,
        [
          challengeId,
          date,
          current.category_id,
          current.id,
          JSON.stringify({
            phase: 5,
            materialization: 'active_playable_catalog_entries',
            sourceEntryCount: current.eligible_count,
            sourceVersion: current.data_version,
            snapshotStatus: current.status,
            coverageComplete: current.coverage_complete,
            unresolvedConflicts: current.unresolved_conflicts,
            eligibleCount: current.eligible_count,
            rightsStatus: 'review_required',
            reasonDraft: 'category_and_badge_rights_not_approved'
          })
        ]
      );
      await client.query('DELETE FROM challenge_items WHERE challenge_id = $1', [challengeId]);
      for (const [ordinal, entry] of entries.rows.entries()) {
        await client.query(
          `INSERT INTO challenge_items (challenge_id, ordinal, entity_id, correct_rank, score_value)
           VALUES ($1, $2, $3, $4, $5)`,
          [challengeId, ordinal, entry.entity_id, entry.rank, entry.score_value]
        );
      }
      await client.query('COMMIT');
      console.log(JSON.stringify({ challengeId, status: 'draft', snapshotId: current.id, entries: entries.rowCount, reason: 'rights_review_required' }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'create-daily') {
    const date = argument('date');
    if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) throw new Error('Falta --date YYYY-MM-DD');
    const result = await materializeDailyGameChallenge(date, parseDailyChallengeCategories(), true);
    console.log(JSON.stringify({ ...result, status: 'published' }, null, 2));
  } else if (command === '__legacy_create_daily_disabled__') {
    const date = argument('date');
    const categorySlug = argument('category');
    const itemCount = Number(argument('items') ?? 8);
    if (!date || !categorySlug || !Number.isInteger(itemCount) || itemCount < 1 || itemCount > 20) {
      throw new Error('Faltan --date, --category o --items inválido (1-20)');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const snapshot = await client.query<{ id: string; category_id: string }>(
        `SELECT rs.id, rs.category_id FROM ranking_snapshots rs
         JOIN category_definitions c ON c.id = rs.category_id
         WHERE c.slug = $1 AND rs.status = 'published'
         ORDER BY rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC LIMIT 1`,
        [categorySlug]
      );
      const current = snapshot.rows[0];
      if (!current) throw new Error(`No hay ranking publicado para ${categorySlug}`);
      const challengeId = `daily_${date}_${categorySlug}`;
      await client.query(
        `INSERT INTO challenges (id, challenge_kind, challenge_date, category_id, ranking_snapshot_id, status, published_at)
         VALUES ($1, 'daily', $2, $3, $4, 'draft', NULL)
         ON CONFLICT (id) DO UPDATE SET ranking_snapshot_id = EXCLUDED.ranking_snapshot_id, status = 'draft', published_at = NULL`,
        [challengeId, date, current.category_id, current.id]
      );
      await client.query('DELETE FROM challenge_items WHERE challenge_id = $1', [challengeId]);
      const entries = await client.query<{ entity_id: string; rank: number; score_value: number }>(
         `SELECT selected.entity_id, selected.rank, selected.score_value
            FROM (
              SELECT DISTINCT ON (canonical_entity.id)
                     canonical_entity.id AS entity_id, re.rank, re.score_value
                FROM ranking_entries re
                JOIN entities source_entity ON source_entity.id = re.entity_id
                LEFT JOIN entity_identity_links identity_link
                  ON identity_link.source_entity_id = re.entity_id
                JOIN entities canonical_entity
                  ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
                JOIN entity_game_profiles egp
                  ON egp.entity_id = canonical_entity.id
                JOIN image_assets ia ON ia.entity_id = canonical_entity.id
                  AND ia.asset_kind = CASE WHEN canonical_entity.entity_type = 'player' THEN 'portrait' ELSE 'badge' END
                  AND ia.is_primary = TRUE AND ia.review_status = 'approved'
               WHERE re.snapshot_id = $1
                 AND re.rank <= ${MAX_GAME_RANKING_ENTRIES}
                 AND canonical_entity.catalog_status = 'active'
                 AND egp.playable_default = TRUE
               ORDER BY canonical_entity.id, re.rank, re.entity_id
            ) selected
           ORDER BY md5(selected.entity_id || $2) LIMIT $3`,
        [current.id, `${date}:${categorySlug}`, itemCount]
      );
      if (entries.rowCount !== itemCount) {
        throw new Error(`No hay ${itemCount} entidades con imagen aprobada para el reto`);
      }
      for (const [ordinal, entry] of entries.rows.entries()) {
        await client.query(
          `INSERT INTO challenge_items (challenge_id, ordinal, entity_id, correct_rank, score_value) VALUES ($1, $2, $3, $4, $5)`,
          [challengeId, ordinal, entry.entity_id, entry.rank, entry.score_value]
        );
      }
      await client.query(`UPDATE challenges SET status = 'published', published_at = NOW() WHERE id = $1`, [challengeId]);
      await client.query('COMMIT');
      console.log(`Reto diario publicado: ${challengeId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'seed-game-audience') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await seedGameAudienceProfiles(client, { expand: args.includes('--expand') });
      await client.query('COMMIT');
      console.log(JSON.stringify({ policy: 'modern-audience-v1', explicitExpansionRequired: true, ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'repair-identity-links') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await repairIdentityLinks(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'entity-identity-links', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-api-football-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateApiFootballIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'api-football', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-football-data-club-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateFootballDataClubIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'schochastics-football-data', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-football-data-incident-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateFootballDataIncidentIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'schochastics-football-data-incidents', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-uefa-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateUefaChampionsLeagueIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'uefa-champions-league-official', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-uefa-shared-player-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateUefaSharedPlayerIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'uefa-shared-player-identifiers', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-uefa-club-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateUefaClubIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'uefa-club-official', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-uefa-shared-club-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateUefaSharedClubIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'uefa-shared-club-identifiers', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-uefa-conference-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateUefaConferenceLeagueIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'uefa-conference-league-official', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-fa-cup-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateFaCupIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'fa-cup-official', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-rsssf-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateRsssfIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'rsssf-international-records', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-statbunker-world-cup-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateStatbunkerWorldCupIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'statbunker-world-cup', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-statbunker-club-world-cup-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateStatbunkerClubWorldCupIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'statbunker-club-world-cup-clean-sheets', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-statbunker-copa-libertadores-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateStatbunkerCopaLibertadoresIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'statbunker-copa-libertadores-clean-sheets', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-statbunker-conference-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateStatbunkerConferenceIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'statbunker-uefa-conference-league', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-statbunker-euro-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateStatbunkerEuroIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'statbunker-euro', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-statbunker-nations-league-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateStatbunkerNationsLeagueIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'statbunker-nations-league', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-statbunker-copa-america-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateStatbunkerCopaAmericaIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'statbunker-copa-america-clean-sheets', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-statbunker-champions-league-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateStatbunkerChampionsLeagueIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'statbunker-uefa-champions-league', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-statbunker-europa-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateStatbunkerEuropaIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'statbunker-uefa-europa-league', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-uefa-euro-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateUefaEuroIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'uefa-euro-official', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-dfb-bundesliga-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateDfbBundesligaIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'dfb-bundesliga-record-scorers', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-dfb-pokal-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateDfbPokalIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'dfb-pokal-official', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-serie-a-club-titles-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateSerieAClubTitlesIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'legaseriea-official-palmares', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-supercoppa-italiana-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateSupercoppaItalianaIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'legaseriea-supercoppa-official', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-dfl-supercup-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateDflSupercupIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'bundesliga-dfl-supercup-official', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-wikipedia-serie-a-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateWikipediaSerieAIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'wikipedia-it-serie-a-records', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-wikipedia-copa-del-rey-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateWikipediaCopaDelReyIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'wikipedia-es-copa-del-rey-palmares', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-wikipedia-copa-sudamericana-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateWikipediaCopaSudamericanaIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'wikipedia-es-copa-sudamericana-records', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-wikipedia-recopa-sudamericana-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateWikipediaRecopaSudamericanaIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'wikipedia-es-recopa-sudamericana-records', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-bdfutbol-la-liga-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateBdfutbolLaLigaIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'bdfutbol-la-liga-records', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-bdfutbol-shared-player-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateBdfutbolSharedPlayerIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'bdfutbol-shared-player-identifiers', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-copa-libertadores-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateTransfermarktCopaLibertadoresIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'transfermarkt-copa-libertadores-historical-goals', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-copa-sudamericana-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateTransfermarktCopaSudamericanaIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'transfermarkt-copa-sudamericana-historical-goals', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-uefa-cup-europa-league-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateTransfermarktUefaEuropaLeagueIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'transfermarkt-uefa-cup-europa-league-historical-goals', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-european-cup-champions-league-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateTransfermarktEuropeanCupChampionsLeagueIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'transfermarkt-european-cup-champions-league-historical-goals', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-club-world-cup-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateTransfermarktClubWorldCupIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'transfermarkt-fifa-club-world-cup-historical-goals', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-copa-america-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateTransfermarktCopaAmericaIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'transfermarkt-copa-america-historical-goals', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-nations-league-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateTransfermarktNationsLeagueIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'transfermarkt-nations-league-historical-goals', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-world-cup-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateTransfermarktWorldCupIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'transfermarkt-world-cup-historical-goals', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-la-liga-assists-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await consolidateTransfermarktLaLigaAssistsIdentities(client);
      await client.query('COMMIT');
      console.log(JSON.stringify({ source: 'transfermarkt-la-liga-assists', ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (command === 'consolidate-transfermarkt-bundesliga-assists-identities' || command === 'consolidate-transfermarkt-serie-a-assists-identities' || command === 'consolidate-transfermarkt-ligue-1-assists-identities' || command === 'consolidate-transfermarkt-primeira-liga-assists-identities') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = command === 'consolidate-transfermarkt-bundesliga-assists-identities'
        ? await consolidateTransfermarktBundesligaAssistsIdentities(client)
        : command === 'consolidate-transfermarkt-serie-a-assists-identities'
          ? await consolidateTransfermarktSerieAAssistsIdentities(client)
          : command === 'consolidate-transfermarkt-ligue-1-assists-identities'
            ? await consolidateTransfermarktLigue1AssistsIdentities(client)
            : await consolidateTransfermarktPrimeiraLigaAssistsIdentities(client);
      await client.query('COMMIT');
      const source = command.includes('bundesliga')
        ? 'transfermarkt-bundesliga-assists'
        : command.includes('serie-a')
          ? 'transfermarkt-serie-a-assists'
          : command.includes('ligue-1')
            ? 'transfermarkt-ligue-1-assists'
            : 'transfermarkt-primeira-liga-assists';
      console.log(JSON.stringify({ source, ...result }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    console.error('Comandos: seed | import-ranking --file FILE | build-club-global-titles | build-club-career-titles | import-premier-league --metric METRIC | import-premier-league-club-titles | ... | create-daily-draft --date YYYY-MM-DD --categories SLUG1,SLUG2,...,SLUG7 | create-daily --date YYYY-MM-DD --categories SLUG1,SLUG2,...,SLUG7');
    process.exitCode = 1;
  }
} finally {
  if (command && command !== 'normalize-image') await closeDb();
  void config.mediaRoot;
}
