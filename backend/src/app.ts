import Fastify from 'fastify';
import cors from '@fastify/cors';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { z } from 'zod';
import { config, corsOrigins } from './config.js';
import { runtimeConfigPayload, type RuntimeMode } from './runtimeMode.js';
import { pool } from './db.js';
import { registerAuthRoutes } from './auth.js';
import { ContractError, registerGameContractRoutes, type ContractDatabase } from './game-contract.js';
import { MAX_GAME_RANKING_ENTRIES } from './catalogCleanup.js';
import { renderMediaFallback } from './mediaFallback.js';
import { SlidingWindowRateLimiter, rateLimitPolicy } from './rateLimit.js';
import { buildClubCardsScopeStatus, CLUB_CARD_SCOPE_COMPETITIONS, getKnownClubCardsCompetitionStatus } from './clubCardsScope.js';
import { RANKING_CATALOG_DEFINITIONS, type RankingCatalogCategory, type RankingCatalogScope, type RankingCatalogStatus } from './rankingCatalog.js';

const CHAMPIONS_CATEGORY_SLUG = 'uefa-champions-league-goals';
const CHAMPIONS_ASSISTS_CATEGORY_SLUG = 'uefa-champions-league-assists';
const WORLD_CUP_CATEGORY_SLUG = 'world-cup-goals';
const CLUB_CAREER_GOALS_CATEGORY_SLUG = 'club-career-goals';
const CLUB_CAREER_YELLOW_CARDS_CATEGORY_SLUG = 'club-career-yellow-cards';
const CLUB_CAREER_RED_CARDS_CATEGORY_SLUG = 'club-career-red-cards';
const CLUB_CARDS_CATEGORY_SLUG = 'club-cards';
type ChampionsLabDataset = 'historical_base' | 'active_season_weekly';
type WorldCupLabDataset = 'historical_base' | 'active_edition_weekly';

function playableTop200Predicate(entityAlias: string, profileAlias: string): string {
  return `(
    ${entityAlias}.entity_type <> 'player'
    OR (
      COALESCE(${profileAlias}.playable_default, FALSE)
      AND EXISTS (
        SELECT 1
        FROM ranking_entries boundary_entry
        JOIN ranking_snapshots boundary_snapshot
          ON boundary_snapshot.id = boundary_entry.snapshot_id
         AND boundary_snapshot.status <> 'superseded'
        JOIN category_definitions boundary_category
          ON boundary_category.id = boundary_snapshot.category_id
         AND boundary_category.status <> 'retired'
        LEFT JOIN entity_identity_links boundary_identity
          ON boundary_identity.source_entity_id = boundary_entry.entity_id
        WHERE boundary_entry.rank <= ${MAX_GAME_RANKING_ENTRIES}
          AND COALESCE(boundary_identity.canonical_entity_id, boundary_entry.entity_id) = ${entityAlias}.id
      )
    )
  )`;
}

async function getLabChampionsRanking(appDb: ContractDatabase, dataset: ChampionsLabDataset, limit: number, runtimeMode: RuntimeMode) {
  const snapshotResult = await appDb.query<{
    id: string;
    category_slug: string;
    dataset: ChampionsLabDataset;
    season_start: number;
    season_end: number;
    status: string;
    scope_version: string;
    content_sha256: string;
    generated_at: string;
    coverage_complete: boolean;
    fact_count: number;
    source_count: number;
  }>(
    `WITH latest AS (
       SELECT rs.*
         FROM champions_ranking_snapshots rs
        WHERE rs.category_slug = $1
          AND rs.dataset = $2
          AND rs.status IN ('lab_provisional', 'draft')
          AND rs.coverage_complete = TRUE
          AND COALESCE((rs.metadata->>'fixtureOnly')::boolean, FALSE) = FALSE
        ORDER BY rs.generated_at DESC
        LIMIT 1
     ), fact_summary AS (
       SELECT COUNT(DISTINCT f.id)::int AS fact_count,
              COUNT(DISTINCT f.source_key)::int AS source_count
         FROM latest s
         JOIN champions_ranking_entries re ON re.snapshot_id = s.id
         JOIN champions_goal_facts f ON f.id = ANY(re.fact_ids)
     )
     SELECT latest.id, latest.category_slug, latest.dataset, latest.season_start, latest.season_end,
            latest.status, latest.scope_version, latest.content_sha256, latest.generated_at,
            latest.coverage_complete,
            COALESCE(NULLIF(latest.metadata->>'factCount', '')::int, fact_summary.fact_count, 0)::int AS fact_count,
            COALESCE(fact_summary.source_count, 0)::int AS source_count
       FROM latest CROSS JOIN fact_summary`,
    [CHAMPIONS_CATEGORY_SLUG, dataset]
  );
  const snapshot = snapshotResult.rows[0];
  if (!snapshot) return null;
  const entries = await appDb.query(
    `SELECT re.canonical_player_id AS entity_id, e.canonical_name, e.short_name, e.entity_type,
            re.raw_value, re.rank, re.tie_group,
            (e.catalog_status = 'active' AND COALESCE(egp.playable_default, FALSE)) AS playable,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'sourceKey', f.source_key,
                'sourceCaptureId', f.source_capture_id,
                'sourceRecordId', f.source_record_id,
                'sourceUrl', f.evidence->>'sourceUrl',
                'locator', f.evidence->>'locator',
                'contentSha256', f.evidence->>'contentSha256'
              ) ORDER BY f.source_key, f.source_capture_id, f.source_record_id)
                FROM champions_goal_facts f
               WHERE f.id = ANY(re.fact_ids)
            ), '[]'::jsonb) AS sources
       FROM champions_ranking_entries re
       JOIN entities e ON e.id = re.canonical_player_id
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = e.id
      WHERE re.snapshot_id = $1
        AND re.rank <= $2
      ORDER BY re.rank, e.canonical_name`,
    [snapshot.id, limit]
  );
  const isHistorical = snapshot.dataset === 'historical_base';
  return {
    category: snapshot.category_slug,
    categoryLabelEs: 'Goles históricos — UEFA Champions League',
    categoryLabelEn: 'All-time goals — UEFA Champions League',
    rankingScope: isHistorical ? 'historical_snapshot' : 'active_season_weekly',
    snapshotId: snapshot.id,
    mode: runtimeMode,
    status: 'provisional',
    dataset: snapshot.dataset,
    seasonStart: snapshot.season_start,
    seasonEnd: snapshot.season_end,
    scopeLabelEs: isHistorical ? 'Histórico: Copa de Europa y Champions 1955/56–2025/26' : 'Actualización semanal: histórico + temporada activa 2026/27',
    scopeLabelEn: isHistorical ? 'History: European Cup and Champions League 1955/56–2025/26' : 'Weekly update: history + active 2026/27 season',
    coverageComplete: snapshot.coverage_complete,
    factCount: snapshot.fact_count,
    sourceCount: snapshot.source_count,
    dataVersion: snapshot.scope_version,
    contentSha256: snapshot.content_sha256,
    generatedAt: snapshot.generated_at,
    entries: entries.rows.map((row) => ({
      ...row,
      score_value: Math.min(Number(row.rank), 100),
      image_url: null,
      image_status: 'unavailable',
      review_status: 'missing',
      rights_status: 'missing',
      is_publishable: false,
      image_source_url: null,
      image_license_name: null,
      sources: row.sources ?? []
    }))
  };
}

async function getLabChampionsAssistsRanking(appDb: ContractDatabase, dataset: ChampionsLabDataset, limit: number, runtimeMode: RuntimeMode, season?: number) {
  const snapshotResult = await appDb.query<{
    id: string; category_slug: string; dataset: ChampionsLabDataset; season_start: number; season_end: number; status: string;
    scope_version: string; content_sha256: string; generated_at: string; coverage_complete: boolean; fact_count: number; source_count: number; metadata: Record<string, unknown>;
  }>(
    `WITH latest AS (
       SELECT rs.* FROM champions_ranking_snapshots rs
        WHERE rs.category_slug = $1 AND rs.dataset = $2
          AND rs.status IN ('lab_provisional', 'draft')
          AND COALESCE((rs.metadata->>'fixtureOnly')::boolean, FALSE) = FALSE
          AND ($3::int IS NULL OR rs.season_start = $3)
        ORDER BY rs.generated_at DESC LIMIT 1
     ), fact_summary AS (
       SELECT COUNT(DISTINCT f.id)::int AS fact_count, COUNT(DISTINCT f.source_key)::int AS source_count
         FROM latest s
         JOIN champions_ranking_entries re ON re.snapshot_id = s.id
         JOIN champions_assist_facts f ON f.id = ANY(re.fact_ids)
     )
     SELECT latest.id, latest.category_slug, latest.dataset, latest.season_start, latest.season_end,
            latest.status, latest.scope_version, latest.content_sha256, latest.generated_at,
            latest.coverage_complete,
            latest.metadata,
            COALESCE(NULLIF(latest.metadata->>'factCount', '')::int, fact_summary.fact_count, 0)::int AS fact_count,
            COALESCE(NULLIF(latest.metadata->>'sourceCount', '')::int, fact_summary.source_count, 0)::int AS source_count
       FROM latest CROSS JOIN fact_summary`,
    [CHAMPIONS_ASSISTS_CATEGORY_SLUG, dataset, season ?? null]
  );
  const snapshot = snapshotResult.rows[0];
  if (!snapshot) return null;
  const entries = await appDb.query(
    `SELECT re.canonical_player_id AS entity_id, e.canonical_name, e.short_name, e.entity_type,
            re.raw_value, re.rank, re.tie_group,
            (e.catalog_status = 'active' AND COALESCE(egp.playable_default, FALSE)) AS playable,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'sourceKey', f.source_key, 'sourceCaptureId', f.source_capture_id, 'sourceRecordId', f.source_record_id, 'eventId', f.event_id,
              'sourceType', f.source_type, 'verificationStatus', f.verification_status,
              'sourceUrl', f.evidence->>'sourceUrl', 'locator', f.evidence->>'locator', 'contentSha256', f.evidence->>'contentSha256'
            ) ORDER BY f.source_key, f.source_capture_id, f.source_record_id)
              FROM champions_assist_facts f WHERE f.id = ANY(re.fact_ids)), '[]'::jsonb) AS sources
       FROM champions_ranking_entries re
       JOIN entities e ON e.id = re.canonical_player_id
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = e.id
      WHERE re.snapshot_id = $1 AND re.rank <= $2
      ORDER BY re.rank, e.canonical_name`,
    [snapshot.id, limit]
  );
  const isHistorical = snapshot.dataset === 'historical_base';
  return {
    category: snapshot.category_slug,
    categoryLabelEs: 'Asistencias históricas — UEFA Champions League',
    categoryLabelEn: 'All-time assists — UEFA Champions League',
    rankingScope: isHistorical ? 'historical_snapshot' : 'active_season_weekly',
    snapshotId: snapshot.id, mode: runtimeMode, status: 'provisional', dataset: snapshot.dataset,
    seasonStart: snapshot.season_start, seasonEnd: snapshot.season_end,
    scope: isHistorical ? 'historical' : 'active_season',
    season: snapshot.season_start,
    scopeLabelEs: isHistorical ? 'Champions — histórico no disponible: cobertura insuficiente' : 'Champions — temporada activa. Ranking provisional; el histórico completo todavía no tiene cobertura suficiente.',
    scopeLabelEn: isHistorical ? 'Champions — historical unavailable: insufficient coverage' : 'Champions — active season. Provisional ranking; the complete history does not yet have sufficient coverage.',
    coverageComplete: snapshot.coverage_complete, factCount: snapshot.fact_count, sourceCount: snapshot.source_count,
    coverageEstimated: typeof snapshot.metadata.coverageEstimated === 'number' ? snapshot.metadata.coverageEstimated : null,
    provisionalWarningEs: 'Ranking provisional de la temporada activa. El histórico completo todavía no tiene cobertura suficiente.',
    provisionalWarningEn: 'Provisional active-season ranking. The complete historical ranking does not yet have sufficient coverage.',
    source: 'api-football',
    degraded: snapshot.metadata.degraded === true,
    updateDate: snapshot.metadata.updatedAt ?? snapshot.generated_at,
    dataVersion: snapshot.scope_version, contentSha256: snapshot.content_sha256, generatedAt: snapshot.generated_at,
    entries: entries.rows.map((row) => ({ ...row, score_value: Math.min(Number(row.rank), 100), image_url: null, image_status: 'unavailable', review_status: 'missing', rights_status: 'missing', is_publishable: false, image_source_url: null, image_license_name: null, sources: row.sources ?? [] }))
  };
}

async function getLabWorldCupRanking(appDb: ContractDatabase, dataset: WorldCupLabDataset, limit: number, runtimeMode: RuntimeMode) {
  const snapshotResult = await appDb.query<{
    id: string; category_slug: string; dataset: WorldCupLabDataset; edition_start: number; edition_end: number; status: string;
    scope_version: string; content_sha256: string; generated_at: string; coverage_complete: boolean; fact_count: number; source_count: number; fixture_only: boolean;
  }>(
    `WITH latest AS (
       SELECT rs.*
         FROM world_cup_ranking_snapshots rs
       WHERE rs.category_slug = $1 AND rs.dataset = $2
          AND rs.status IN ('lab_provisional', 'draft') AND rs.coverage_complete = TRUE
          AND COALESCE((rs.metadata->>'fixtureOnly')::boolean, FALSE) = FALSE
        ORDER BY rs.generated_at DESC LIMIT 1
     ), fact_summary AS (
       SELECT COUNT(DISTINCT f.id)::int AS fact_count, COUNT(DISTINCT f.source_key)::int AS source_count
         FROM latest s JOIN world_cup_ranking_entries re ON re.snapshot_id = s.id
         JOIN world_cup_goal_facts f ON f.id = ANY(re.fact_ids)
     )
     SELECT latest.id, latest.category_slug, latest.dataset, latest.edition_start, latest.edition_end,
            latest.status, latest.scope_version, latest.content_sha256, latest.generated_at, latest.coverage_complete,
            COALESCE(NULLIF(latest.metadata->>'factCount', '')::int, fact_summary.fact_count, 0)::int AS fact_count,
            COALESCE(NULLIF(latest.metadata->>'sourceCount', '')::int, fact_summary.source_count, 0)::int AS source_count,
            COALESCE((latest.metadata->>'fixtureOnly')::boolean, FALSE) AS fixture_only
       FROM latest CROSS JOIN fact_summary`, [WORLD_CUP_CATEGORY_SLUG, dataset]
  );
  const snapshot = snapshotResult.rows[0];
  if (!snapshot) return null;
  const entries = await appDb.query(
    `SELECT re.canonical_player_id AS entity_id, e.canonical_name, e.short_name, e.entity_type,
            re.raw_value, re.rank, re.score_value, re.tie_group, re.fact_ids,
            (e.catalog_status = 'active' AND COALESCE(egp.playable_default, FALSE)) AS playable,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'sourceKey', f.source_key, 'sourceCaptureId', f.source_capture_id, 'sourceRecordId', f.source_record_id,
              'sourceUrl', f.evidence->>'sourceUrl', 'locator', f.evidence->>'locator', 'contentSha256', f.evidence->>'contentSha256'
            ) ORDER BY f.source_key, f.source_capture_id, f.source_record_id)
              FROM world_cup_goal_facts f WHERE f.id = ANY(re.fact_ids)), '[]'::jsonb) AS sources
       FROM world_cup_ranking_entries re JOIN entities e ON e.id = re.canonical_player_id
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = e.id
      WHERE re.snapshot_id = $1 AND re.rank <= $2 ORDER BY re.rank, re.canonical_player_id`, [snapshot.id, limit]
  );
  const isHistorical = snapshot.dataset === 'historical_base';
  return {
    category: snapshot.category_slug, categoryLabelEs: 'Goles históricos — Mundial masculino', categoryLabelEn: 'All-time goals — Men\'s World Cup',
    rankingScope: isHistorical ? 'historical_snapshot' : 'active_season_weekly', snapshotId: snapshot.id, mode: runtimeMode, status: 'provisional',
    dataset: snapshot.dataset, editionStart: snapshot.edition_start, editionEnd: snapshot.edition_end,
    scopeLabelEs: snapshot.fixture_only ? 'Fixture controlado de lab; no es cobertura histórica' : (isHistorical ? 'Histórico: fases finales masculinas' : 'Actualización semanal: histórico + edición activa'),
    scopeLabelEn: snapshot.fixture_only ? 'Controlled lab fixture; not historical coverage' : (isHistorical ? 'History: men\'s final tournaments' : 'Weekly update: history + active edition'),
    coverageComplete: snapshot.coverage_complete, factCount: snapshot.fact_count, sourceCount: snapshot.source_count, dataVersion: snapshot.scope_version,
    contentSha256: snapshot.content_sha256, generatedAt: snapshot.generated_at, fixtureOnly: snapshot.fixture_only,
    entries: entries.rows.map((row) => ({ ...row, image_url: null, image_status: 'unavailable', review_status: 'missing', rights_status: 'missing', is_publishable: false, image_source_url: null, image_license_name: null, sources: row.sources ?? [] }))
  };
}

async function getLabClubCareerGoalsRanking(appDb: ContractDatabase, limit: number, runtimeMode: RuntimeMode, season?: number, competition?: string) {
  const snapshotResult = await appDb.query<{
    id: string; category_slug: string; dataset: string; season_start: number; season_end: number; status: string; competition_filter: string | null;
    scope_version: string; content_sha256: string; generated_at: string; coverage_complete: boolean; metadata: Record<string, unknown>;
  }>(
    `SELECT rs.*
       FROM club_goal_ranking_snapshots rs
      WHERE rs.category_slug = $1
        AND rs.dataset = 'active_weekly'
        AND rs.status IN ('lab_provisional', 'draft')
        AND COALESCE((rs.metadata->>'fixtureOnly')::boolean, FALSE) = FALSE
        AND ($2::int IS NULL OR rs.season_start = $2)
        AND ($3::text IS NULL OR rs.competition_filter = $3)
      ORDER BY rs.generated_at DESC
      LIMIT 1`,
    [CLUB_CAREER_GOALS_CATEGORY_SLUG, season ?? null, competition ?? null]
  );
  const snapshot = snapshotResult.rows[0];
  if (!snapshot) return null;
  const entries = await appDb.query(
    `SELECT re.canonical_player_id AS entity_id, e.canonical_name, e.short_name, e.entity_type,
            re.raw_value, re.rank, re.tie_group,
            (e.catalog_status = 'active' AND COALESCE(egp.playable_default, FALSE)) AS playable,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'sourceKey', f.source_key, 'sourceCaptureId', f.source_capture_id, 'sourceRecordId', f.source_record_id,
              'sourceType', f.source_type, 'verificationStatus', f.verification_status,
              'sourceUrl', f.evidence->>'sourceUrl', 'locator', f.evidence->>'locator', 'contentSha256', f.evidence->>'contentSha256'
            ) ORDER BY f.source_key, f.source_capture_id, f.source_record_id)
              FROM club_goal_facts f WHERE f.id = ANY(re.fact_ids)), '[]'::jsonb) AS sources
       FROM club_goal_ranking_entries re
       JOIN entities e ON e.id = re.canonical_player_id
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = e.id
      WHERE re.snapshot_id = $1 AND re.rank <= $2
      ORDER BY re.rank, e.canonical_name`,
    [snapshot.id, limit]
  );
  const metadata = snapshot.metadata ?? {};
  return {
    category: snapshot.category_slug,
    categoryLabelEs: 'Goles globales en clubes — alcance observado',
    categoryLabelEn: 'Global club goals — observed scope',
    rankingScope: 'active_season_weekly', snapshotId: snapshot.id, mode: runtimeMode, status: 'provisional', dataset: 'active_weekly',
    scope: 'active', season: snapshot.season_start, competition: snapshot.competition_filter,
    scopeLabelEs: 'Ranking provisional del alcance observado de competiciones de clubes. No representa todos los goles de carrera mundial.',
    scopeLabelEn: 'Provisional ranking for the observed club-competition scope. It does not represent all career goals worldwide.',
    coverageComplete: snapshot.coverage_complete, coverageEstimated: typeof metadata.coverageEstimated === 'number' ? metadata.coverageEstimated : null,
    provisionalWarningEs: 'Cobertura limitada a las competiciones y temporadas indicadas; el histórico global de carrera no está disponible.',
    provisionalWarningEn: 'Coverage is limited to the listed competitions and seasons; the global career history is not available.',
    source: 'api-football', degraded: metadata.degraded === true, updateDate: metadata.updatedAt ?? snapshot.generated_at,
    factCount: Number(metadata.factCount ?? 0), sourceCount: Number(metadata.sourceCount ?? 0), dataVersion: snapshot.scope_version,
    contentSha256: snapshot.content_sha256, generatedAt: snapshot.generated_at,
    entries: entries.rows.map((row) => ({ ...row, score_value: Math.min(Number(row.rank), 100), image_url: null, image_status: 'unavailable', review_status: 'missing', rights_status: 'missing', is_publishable: false, image_source_url: null, image_license_name: null, sources: row.sources ?? [] }))
  };
}

async function getLabClubCardsRanking(appDb: ContractDatabase, cardKind: 'yellow' | 'red', dataset: 'historical_base' | 'active_weekly', limit: number, runtimeMode: RuntimeMode, season?: number, competition?: string) {
  const categorySlug = cardKind === 'yellow' ? CLUB_CAREER_YELLOW_CARDS_CATEGORY_SLUG : CLUB_CAREER_RED_CARDS_CATEGORY_SLUG;
  const snapshotResult = await appDb.query<{
    id: string; category_slug: string; card_kind: 'yellow' | 'red'; dataset: 'historical_base' | 'active_weekly'; season_start: number; season_end: number;
    scope_version: string; content_sha256: string; generated_at: string; coverage_complete: boolean; competition_filter: string | null; metadata: Record<string, unknown>;
  }>(
    `SELECT rs.* FROM club_card_ranking_snapshots rs
      WHERE rs.category_slug = $1 AND rs.card_kind = $2 AND rs.dataset = $3
        AND rs.status IN ('lab_provisional', 'draft')
        AND COALESCE((rs.metadata->>'fixtureOnly')::boolean, FALSE) = FALSE
        AND ($4::int IS NULL OR rs.season_start = $4)
        AND ($5::text IS NULL OR rs.competition_filter = $5 OR ($5 = 'complete_scope' AND rs.competition_filter IS NULL AND rs.coverage_complete = TRUE))
      ORDER BY rs.generated_at DESC LIMIT 1`,
    [categorySlug, cardKind, dataset, season ?? null, competition ?? null]
  );
  const snapshot = snapshotResult.rows[0]; if (!snapshot) return null;
  const entries = await appDb.query(
    `SELECT re.canonical_player_id AS entity_id, e.canonical_name, e.short_name, e.entity_type,
            re.raw_value, re.rank, re.tie_group,
            (e.catalog_status = 'active' AND COALESCE(egp.playable_default, FALSE)) AS playable,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'sourceKey', f.source_key, 'sourceCaptureId', f.source_capture_id, 'sourceRecordId', f.source_record_id,
              'sourceType', f.source_type, 'verificationStatus', f.verification_status,
              'sourceUrl', f.evidence->>'sourceUrl', 'locator', f.evidence->>'locator', 'contentSha256', f.evidence->>'contentSha256'
            ) ORDER BY f.source_key, f.source_capture_id, f.source_record_id)
              FROM club_card_facts f WHERE f.id = ANY(re.fact_ids)), '[]'::jsonb) AS sources
       FROM club_card_ranking_entries re JOIN entities e ON e.id = re.canonical_player_id
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = e.id
      WHERE re.snapshot_id = $1 AND re.rank <= $2
      ORDER BY re.rank, e.canonical_name`,
    [snapshot.id, limit]
  );
  const isHistorical = snapshot.dataset === 'historical_base'; const cardLabelEs = cardKind === 'yellow' ? 'tarjetas amarillas' : 'tarjetas rojas'; const cardLabelEn = cardKind === 'yellow' ? 'yellow cards' : 'red cards'; const metadata = snapshot.metadata ?? {}; const observedScope = snapshot.competition_filter === 'observed_scope'; const completeScope = snapshot.competition_filter === 'complete_scope' || snapshot.competition_filter === null; const activeSeasonStatus = typeof metadata.activeSeasonStatus === 'string' ? metadata.activeSeasonStatus : completeScope ? 'complete_scope' : snapshot.coverage_complete ? 'complete_scope' : 'partial_missing_provider_data'; const seasonInProgress = metadata.seasonInProgress === true;
  return {
    category: snapshot.category_slug, categoryLabelEs: `${cardLabelEs.charAt(0).toUpperCase()}${cardLabelEs.slice(1)} globales en clubes — alcance observado`, categoryLabelEn: `Global club ${cardLabelEn} — observed scope`,
    rankingScope: isHistorical ? 'historical_snapshot' : 'active_season_weekly', snapshotId: snapshot.id, mode: runtimeMode, status: 'provisional', dataset: snapshot.dataset,
    scope: isHistorical ? 'historical' : 'active', season: snapshot.season_start, competition: snapshot.competition_filter,
    scopeLabelEs: isHistorical ? 'Histórico: cobertura completa declarada' : completeScope ? '3 competiciones completas: Premier League, La Liga y Serie A. 3 pendientes por cuota; no es un ranking global de seis competiciones.' : activeSeasonStatus === 'provisional_active_season' ? `Temporada activa ${snapshot.season_start}; datos observados válidos y temporada en curso.` : observedScope ? `Temporada activa ${snapshot.season_start}; alcance observado (parcial)` : `Temporada activa ${snapshot.season_start}; competición ${snapshot.competition_filter ?? 'no especificada'}`,
    scopeLabelEn: isHistorical ? 'History: declared complete coverage' : completeScope ? '3 complete competitions: Premier League, La Liga and Serie A. 3 pending quota; this is not a six-competition global ranking.' : activeSeasonStatus === 'provisional_active_season' ? `Active season ${snapshot.season_start}; observed data is valid and the season is in progress.` : observedScope ? `Active season ${snapshot.season_start}; observed scope (partial)` : `Active season ${snapshot.season_start}; competition ${snapshot.competition_filter ?? 'unspecified'}`,
    scopeStatus: completeScope ? 'complete_scope' : activeSeasonStatus === 'provisional_active_season' ? 'provisional_active_season' : snapshot.coverage_complete ? 'complete' : 'partial_missing_provider_data',
    includedCompetitions: completeScope ? ['39', '140', '135'] : snapshot.competition_filter ? [snapshot.competition_filter] : [],
    excludedCompetitions: completeScope ? ['78', '61', '94'] : [],
    blockReason: completeScope ? 'Bundesliga, Ligue 1 y Primeira Liga están pendientes por cuota.' : activeSeasonStatus === 'provisional_active_season' ? 'La temporada activa continúa; el ranking es provisional y no entra en complete_scope.' : null,
    coverageComplete: snapshot.coverage_complete, activeSeasonStatus, seasonInProgress, observedFacts: Number(metadata.observedFacts ?? metadata.factCount ?? 0), observedPages: Number(metadata.observedPages ?? 0) || null, provisionalWarningEs: activeSeasonStatus === 'provisional_active_season' ? 'Ranking provisional de la temporada activa. La temporada continúa; no representa un alcance histórico ni complete_scope.' : 'Ranking provisional y limitado al alcance observado; no representa toda la carrera mundial.', provisionalWarningEn: activeSeasonStatus === 'provisional_active_season' ? 'Provisional ranking for the active season. The season is in progress; it is not historical or complete_scope.' : 'Provisional ranking limited to the observed scope; it does not represent a complete worldwide career.',
    source: 'api-football', updateDate: snapshot.generated_at, factCount: Number(metadata.factCount ?? 0), sourceCount: 1, dataVersion: snapshot.scope_version, contentSha256: snapshot.content_sha256, generatedAt: snapshot.generated_at,
    redTypesDifferentiated: metadata.redTypesDifferentiated === true,
    entries: entries.rows.map((row) => ({ ...row, score_value: Math.min(Number(row.rank), 100), image_url: null, image_status: 'unavailable', review_status: 'missing', rights_status: 'missing', is_publishable: false, image_source_url: null, image_license_name: null, sources: row.sources ?? [] }))
  };
}

async function getLabClubCardsScopeStatus(appDb: ContractDatabase, season = 2026) {
  const result = await appDb.query<{ card_kind: 'yellow' | 'red'; competition_filter: string | null; id: string; generated_at: string; content_sha256: string; metadata: Record<string, unknown> }>(
    `SELECT DISTINCT ON (card_kind, competition_filter) card_kind, competition_filter, id, generated_at, content_sha256, metadata
       FROM club_card_ranking_snapshots
      WHERE dataset = 'active_weekly' AND season_start = $1 AND status IN ('lab_provisional', 'draft')
      ORDER BY card_kind, competition_filter, generated_at DESC`, [season]
  );
  const byCompetition: Record<string, { id: string; generatedAt: string; contentSha256: string; status?: 'provisional_active_season' | 'complete_scope' | 'quota_insufficient' | 'partial_missing_provider_data' | 'provider_unavailable' }> = {};
  for (const row of result.rows) if (row.competition_filter && CLUB_CARD_SCOPE_COMPETITIONS.some((competition) => competition.id === row.competition_filter)) {
    byCompetition[row.competition_filter] ??= { id: row.id, generatedAt: row.generated_at, contentSha256: row.content_sha256, status: typeof row.metadata?.activeSeasonStatus === 'string' ? row.metadata.activeSeasonStatus as 'provisional_active_season' : undefined };
  }
  const scope = buildClubCardsScopeStatus({ lastSnapshots: byCompetition });
  return { ...scope, season, dataset: 'active_weekly', isProvisionalLab: true, updatedAt: result.rows.map((row) => row.generated_at).sort().at(-1) ?? null, snapshots: { yellow: result.rows.filter((row) => row.card_kind === 'yellow').map((row) => row.id), red: result.rows.filter((row) => row.card_kind === 'red').map((row) => row.id) }, source: 'preserved_lab_snapshots' };
}

type CatalogSnapshot = {
  id: string;
  generatedAt: string;
  contentSha256: string;
  coverageComplete: boolean;
  factCount: number | null;
  players: number;
  source: string;
};

async function readCatalogSnapshot(appDb: ContractDatabase, options: {
  snapshotTable: 'champions_ranking_snapshots' | 'world_cup_ranking_snapshots' | 'club_goal_ranking_snapshots' | 'club_card_ranking_snapshots';
  entryTable: 'champions_ranking_entries' | 'world_cup_ranking_entries' | 'club_goal_ranking_entries' | 'club_card_ranking_entries';
  categorySlug: string;
  dataset: string;
  competitionFilter?: string;
  requireComplete?: boolean;
}) {
  const competitionClause = options.competitionFilter ? 'AND rs.competition_filter = $3' : 'AND $3::text IS NULL';
  const result = await appDb.query<CatalogSnapshot>(
    `SELECT rs.id, rs.generated_at AS "generatedAt", rs.content_sha256 AS "contentSha256", rs.coverage_complete AS "coverageComplete",
            CASE WHEN rs.metadata->>'factCount' ~ '^[0-9]+$' THEN (rs.metadata->>'factCount')::int ELSE NULL END AS "factCount",
            (SELECT COUNT(*)::int FROM ${options.entryTable} re WHERE re.snapshot_id = rs.id) AS players,
            COALESCE(NULLIF(rs.metadata->>'source', ''), 'preserved_lab_snapshot') AS source
       FROM ${options.snapshotTable} rs
      WHERE rs.category_slug = $1
        AND rs.dataset = $2
        AND rs.status IN ('lab_provisional', 'draft')
        AND COALESCE((rs.metadata->>'fixtureOnly')::boolean, FALSE) = FALSE
        ${competitionClause}
        AND ($4::boolean = FALSE OR rs.coverage_complete = TRUE)
      ORDER BY rs.generated_at DESC
      LIMIT 1`,
    [options.categorySlug, options.dataset, options.competitionFilter ?? null, options.requireComplete === true]
  );
  return result.rows[0] ?? null;
}

function unavailableCatalogScope(scope: string, status: RankingCatalogStatus, reason: string): RankingCatalogScope {
  return { status, available: false, scope, snapshotId: null, lastUpdated: null, factCount: null, players: null, source: null, provisional: true, reason };
}

function availableCatalogScope(scope: string, snapshot: CatalogSnapshot, status: RankingCatalogStatus, reason: string | null = null): RankingCatalogScope {
  return { status, available: true, scope, snapshotId: snapshot.id, lastUpdated: snapshot.generatedAt, factCount: snapshot.factCount, players: snapshot.players, source: snapshot.source, provisional: true, reason };
}

function buildCatalogCategory(definition: typeof RANKING_CATALOG_DEFINITIONS[number], historical: RankingCatalogScope, active: RankingCatalogScope, officialReason: string, scopeDetails?: Record<string, unknown>): RankingCatalogCategory {
  const availableScopes = (['historical', 'active'] as const).filter((key) => (key === 'historical' ? historical.available : active.available));
  const primary = active.available ? active : historical;
  const status = primary.available ? primary.status : historical.status === 'candidate_not_sufficient' ? historical.status : active.status;
  const blockReason = primary.reason ?? (!historical.available ? historical.reason : null) ?? (!active.available ? active.reason : null);
  return {
    ...definition,
    status,
    availableScopes,
    lastUpdated: primary.lastUpdated,
    factCount: primary.factCount,
    players: primary.players,
    source: primary.source,
    provisional: true,
    blockReason,
    allowsHistorical: historical.available,
    allowsActiveSeason: active.available,
    allowsOfficial: false,
    historical,
    active,
    official: unavailableCatalogScope('official', 'official_not_ready', officialReason),
    scopeDetails,
  };
}

async function getRankingCatalog(appDb: ContractDatabase, runtimeMode: RuntimeMode, season = 2026) {
  const officialReason = 'official_not_ready: no existe un snapshot oficial publicable.';
  const [championsHistorical, championsActive, worldCupHistorical, worldCupActive, championsAssistsActive, clubGoalsActive, yellowCardsActive, redCardsActive, clubCardsStatus] = await Promise.all([
    readCatalogSnapshot(appDb, { snapshotTable: 'champions_ranking_snapshots', entryTable: 'champions_ranking_entries', categorySlug: CHAMPIONS_CATEGORY_SLUG, dataset: 'historical_base', requireComplete: true }),
    readCatalogSnapshot(appDb, { snapshotTable: 'champions_ranking_snapshots', entryTable: 'champions_ranking_entries', categorySlug: CHAMPIONS_CATEGORY_SLUG, dataset: 'active_season_weekly', requireComplete: true }),
    readCatalogSnapshot(appDb, { snapshotTable: 'world_cup_ranking_snapshots', entryTable: 'world_cup_ranking_entries', categorySlug: WORLD_CUP_CATEGORY_SLUG, dataset: 'historical_base', requireComplete: true }),
    readCatalogSnapshot(appDb, { snapshotTable: 'world_cup_ranking_snapshots', entryTable: 'world_cup_ranking_entries', categorySlug: WORLD_CUP_CATEGORY_SLUG, dataset: 'active_edition_weekly', requireComplete: true }),
    readCatalogSnapshot(appDb, { snapshotTable: 'champions_ranking_snapshots', entryTable: 'champions_ranking_entries', categorySlug: CHAMPIONS_ASSISTS_CATEGORY_SLUG, dataset: 'active_season_weekly', requireComplete: false }),
    readCatalogSnapshot(appDb, { snapshotTable: 'club_goal_ranking_snapshots', entryTable: 'club_goal_ranking_entries', categorySlug: CLUB_CAREER_GOALS_CATEGORY_SLUG, dataset: 'active_weekly', requireComplete: false }),
    readCatalogSnapshot(appDb, { snapshotTable: 'club_card_ranking_snapshots', entryTable: 'club_card_ranking_entries', categorySlug: CLUB_CAREER_YELLOW_CARDS_CATEGORY_SLUG, dataset: 'active_weekly', competitionFilter: 'complete_scope', requireComplete: true }),
    readCatalogSnapshot(appDb, { snapshotTable: 'club_card_ranking_snapshots', entryTable: 'club_card_ranking_entries', categorySlug: CLUB_CAREER_RED_CARDS_CATEGORY_SLUG, dataset: 'active_weekly', competitionFilter: 'complete_scope', requireComplete: true }),
    getLabClubCardsScopeStatus(appDb, season),
  ]);
  const definition = (slug: string) => RANKING_CATALOG_DEFINITIONS.find((candidate) => candidate.slug === slug)!;
  const unavailableHistory = (scope: string, status: RankingCatalogStatus, reason: string) => unavailableCatalogScope(scope, status, reason);
  const categories: RankingCatalogCategory[] = [
    buildCatalogCategory(definition(CHAMPIONS_CATEGORY_SLUG), championsHistorical ? availableCatalogScope('Copa de Europa + Champions histórico', championsHistorical, 'available_lab') : unavailableHistory('Copa de Europa + Champions histórico', 'ranking_not_available', 'No hay snapshot histórico válido en lab.'), championsActive ? availableCatalogScope('Temporada activa', championsActive, 'available_lab') : unavailableHistory('Temporada activa', 'ranking_not_available', 'No hay snapshot de temporada activa válido en lab.'), officialReason),
    buildCatalogCategory(definition(WORLD_CUP_CATEGORY_SLUG), worldCupHistorical ? availableCatalogScope('Mundial masculino, fases finales 1930–2026', worldCupHistorical, 'available_lab') : unavailableHistory('Mundial masculino histórico', 'ranking_not_available', 'No hay snapshot histórico válido en lab.'), worldCupActive ? availableCatalogScope('Edición activa', worldCupActive, 'available_lab') : unavailableHistory('Edición activa', 'ranking_not_available', 'No hay snapshot de edición activa válido en lab.'), officialReason),
    buildCatalogCategory(definition(CHAMPIONS_ASSISTS_CATEGORY_SLUG), unavailableHistory('Histórico acumulado', 'candidate_not_sufficient', 'La cobertura histórica de asistencias no es suficiente.'), championsAssistsActive ? availableCatalogScope('Temporada activa provisional', championsAssistsActive, 'provisional_lab') : unavailableHistory('Temporada activa provisional', 'ranking_not_available', 'No hay snapshot de temporada activa válido en lab.'), officialReason),
    buildCatalogCategory(definition(CLUB_CAREER_GOALS_CATEGORY_SLUG), unavailableHistory('Histórico de carrera', 'candidate_not_sufficient', 'La cobertura histórica de carrera no es suficiente.'), clubGoalsActive ? availableCatalogScope('Alcance observado de competiciones y temporadas', clubGoalsActive, 'partial_scope', 'El alcance observado no representa todos los goles de carrera.') : unavailableHistory('Alcance observado', 'ranking_not_available', 'No hay snapshot activo válido en lab.'), officialReason),
    buildCatalogCategory(definition(CLUB_CAREER_YELLOW_CARDS_CATEGORY_SLUG), unavailableHistory('Histórico de clubes', 'candidate_not_sufficient', 'La cobertura histórica no es suficiente.'), yellowCardsActive ? availableCatalogScope('3 de 6 competiciones completas', yellowCardsActive, 'partial_scope', clubCardsStatus?.provisional?.length ? `${clubCardsStatus.provisional.map((item) => item.name).join(', ')} tienen temporada activa provisional y no entran en complete_scope.` : 'Bundesliga, Ligue 1 y Primeira Liga están pendientes por cuota.') : unavailableHistory('3 de 6 competiciones completas', 'ranking_not_available', 'No hay snapshot complete_scope válido en lab.'), officialReason, clubCardsStatus ? { included: clubCardsStatus.included, excluded: clubCardsStatus.excluded, provisional: clubCardsStatus.provisional } : undefined),
    buildCatalogCategory(definition(CLUB_CAREER_RED_CARDS_CATEGORY_SLUG), unavailableHistory('Histórico de clubes', 'candidate_not_sufficient', 'La cobertura histórica no es suficiente.'), redCardsActive ? availableCatalogScope('3 de 6 competiciones completas', redCardsActive, 'partial_scope', clubCardsStatus?.provisional?.length ? `${clubCardsStatus.provisional.map((item) => item.name).join(', ')} tienen temporada activa provisional y no entran en complete_scope.` : 'Bundesliga, Ligue 1 y Primeira Liga están pendientes por cuota.') : unavailableHistory('3 de 6 competiciones completas', 'ranking_not_available', 'No hay snapshot complete_scope válido en lab.'), officialReason, clubCardsStatus ? { included: clubCardsStatus.included, excluded: clubCardsStatus.excluded, provisional: clubCardsStatus.provisional } : undefined),
    buildCatalogCategory(definition('club-global-titles'), unavailableHistory('Títulos globales en clubes', 'ranking_not_available', 'Esta categoría todavía no tiene datos trazables disponibles.'), unavailableHistory('Títulos globales en clubes', 'ranking_not_available', 'Esta categoría todavía no tiene datos trazables disponibles.'), officialReason),
  ];
  return { runtimeMode, season, categories };
}

export function buildApp(options: { gameDb?: ContractDatabase; clock?: () => Date; runtimeMode?: RuntimeMode } = {}) {
  const app = Fastify({ logger: true, trustProxy: config.trustProxy });
  const appDb = options.gameDb ?? pool;
  const rateLimiter = new SlidingWindowRateLimiter();
  const runtimeMode = options.runtimeMode ?? config.runtimeMode;
  app.log.info({ runtimeMode }, 'Rango90 runtime mode configured');

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    if (config.nodeEnv === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return payload;
  });

  const allowedOrigins = new Set(corsOrigins());
  void app.register(cors, {
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
    allowedHeaders: ['Accept', 'Content-Type', 'Idempotency-Key'],
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    maxAge: 600
  });

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && origin && !allowedOrigins.has(origin)) {
      return reply.code(403).send({ error: 'csrf_origin_rejected', message: 'Request origin is not allowed' });
    }
    const policy = rateLimitPolicy(request, config);
    if (!policy) return;
    const result = rateLimiter.check(policy.key, policy);
    reply.header('X-RateLimit-Limit', policy.max);
    if (!result.allowed) {
      reply.header('Retry-After', result.retryAfterSeconds);
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many requests' });
    }
  });

  registerAuthRoutes(app);
  registerGameContractRoutes(app, { db: options.gameDb, clock: options.clock, runtimeMode });

  app.get('/v1/config', async () => ({
    service: 'rango90-backend',
    ...runtimeConfigPayload(runtimeMode)
  }));

  app.get('/health', async (_request, reply) => {
    const requiredTables = [
      'entities',
      'entity_game_profiles',
      'entity_identity_links',
      'ranking_entries',
      'ranking_snapshots',
      'category_definitions',
      'game_challenges',
      'game_challenge_categories',
      'game_challenge_decisions',
      'game_challenge_answers'
    ];
    try {
      const result = await pool.query<{ table_name: string }>(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])`,
        [requiredTables]
      );
      const existingTables = new Set(result.rows.map((row) => row.table_name));
      const missingTables = requiredTables.filter((table) => !existingTables.has(table));
      return {
        ok: missingTables.length === 0,
        service: 'rango90-backend',
        ...runtimeConfigPayload(runtimeMode),
        database: { connected: true, schemaReady: missingTables.length === 0, missingTables }
      };
    } catch {
      return reply.code(503).send({ ok: false, service: 'rango90-backend', ...runtimeConfigPayload(runtimeMode), database: { connected: false } });
    }
  });

  app.get('/v1/categories', async (request) => {
    z.object({}).parse(request.query);
    const result = await appDb.query(
      `SELECT c.id, c.slug, c.label_es, c.label_en, c.entity_type, c.metric_key, c.scope_kind, c.scope, c.ranking_direction, c.tie_policy, c.score_cap, c.definition_version, c.definition_md, c.status,
              latest.status AS snapshot_status, latest.id AS snapshot_id
       FROM category_definitions c
       JOIN LATERAL (
         SELECT rs.id, rs.status
           FROM ranking_snapshots rs
          WHERE rs.category_id = c.id
            AND rs.status IN ('published', 'draft')
          ORDER BY rs.generated_at DESC
          LIMIT 1
       ) latest ON TRUE
       WHERE c.status IN ('published', 'draft')
         AND c.slug <> $3
         AND NOT (c.slug = $1 AND EXISTS (
           SELECT 1 FROM champions_ranking_snapshots lab_champions
            WHERE lab_champions.category_slug = $1
              AND lab_champions.status IN ('lab_provisional', 'draft')
              AND lab_champions.coverage_complete = TRUE
         ))
         AND NOT (c.slug = $2 AND EXISTS (
           SELECT 1 FROM world_cup_ranking_snapshots lab_world_cup
            WHERE lab_world_cup.category_slug = $2
              AND lab_world_cup.status IN ('lab_provisional', 'draft')
              AND lab_world_cup.coverage_complete = TRUE
         ))
         ORDER BY c.slug`,
      [CHAMPIONS_CATEGORY_SLUG, WORLD_CUP_CATEGORY_SLUG, CLUB_CAREER_GOALS_CATEGORY_SLUG]
    );
    const categories = result.rows.map((row) => ({ ...row, availability: row.snapshot_status === 'draft' ? 'provisional' : 'official' }));
    {
      const candidate = await appDb.query(
        `SELECT id, category_slug AS slug, 'Goles históricos — UEFA Champions League' AS label_es,
                'All-time goals — UEFA Champions League' AS label_en,
                'player' AS entity_type, 'goals' AS metric_key, 'competition_all_time' AS scope_kind,
                '{}'::jsonb AS scope, 'desc' AS ranking_direction, 'competition' AS tie_policy,
                100 AS score_cap, 1 AS definition_version,
                'Hechos append-only de Copa de Europa y Champions; clasificación excluida.' AS definition_md,
                'draft' AS status, 'lab_provisional' AS snapshot_status, id AS snapshot_id
           FROM champions_ranking_snapshots
          WHERE category_slug = $1 AND dataset = 'active_season_weekly'
            AND status IN ('lab_provisional', 'draft') AND coverage_complete = TRUE
          ORDER BY generated_at DESC LIMIT 1`,
        [CHAMPIONS_CATEGORY_SLUG]
      );
      if (candidate.rows[0]) categories.push({ ...candidate.rows[0], availability: 'provisional' });
      const assistsCandidate = await appDb.query(
        `SELECT id, category_slug AS slug, 'Champions — temporada activa' AS label_es,
                'Champions — active season' AS label_en,
                'player' AS entity_type, 'assists' AS metric_key, 'competition_all_time' AS scope_kind,
                '{}'::jsonb AS scope, 'desc' AS ranking_direction, 'competition' AS tie_policy,
                100 AS score_cap, 1 AS definition_version,
                'Hechos append-only por partido y jugador; Copa de Europa y Champions; clasificación excluida.' AS definition_md,
                'draft' AS status, 'lab_provisional' AS snapshot_status, id AS snapshot_id
           FROM champions_ranking_snapshots
          WHERE category_slug = $1 AND dataset = 'active_season_weekly'
            AND status IN ('lab_provisional', 'draft') AND coverage_complete = TRUE
          ORDER BY generated_at DESC LIMIT 1`,
        [CHAMPIONS_ASSISTS_CATEGORY_SLUG]
      );
      if (assistsCandidate.rows[0]) categories.push({ ...assistsCandidate.rows[0], availability: 'provisional' });
      const worldCupCandidate = await appDb.query(
        `SELECT id, category_slug AS slug, 'Goles históricos — Mundial masculino' AS label_es,
                'All-time goals — Men''s World Cup' AS label_en, 'player' AS entity_type, 'goals' AS metric_key,
                'competition_all_time' AS scope_kind, '{}'::jsonb AS scope, 'desc' AS ranking_direction,
                'competition' AS tie_policy, 100 AS score_cap, 1 AS definition_version,
                'Hechos partido/jugador de fases finales masculinas; clasificatorias y tandas excluidas.' AS definition_md,
                'draft' AS status, 'lab_provisional' AS snapshot_status, id AS snapshot_id
           FROM world_cup_ranking_snapshots
          WHERE category_slug = $1 AND dataset = 'active_edition_weekly'
            AND status IN ('lab_provisional', 'draft') AND coverage_complete = TRUE
          ORDER BY generated_at DESC LIMIT 1`, [WORLD_CUP_CATEGORY_SLUG]
      );
      if (worldCupCandidate.rows[0]) categories.push({ ...worldCupCandidate.rows[0], availability: 'provisional' });
      const clubGoalsCandidate = await appDb.query(
        `SELECT id, category_slug AS slug, 'Goles globales en clubes — alcance observado' AS label_es,
                'Global club goals — observed scope' AS label_en, 'player' AS entity_type, 'goals' AS metric_key,
                'club_career_global' AS scope_kind, '{}'::jsonb AS scope, 'desc' AS ranking_direction,
                'competition' AS tie_policy, 100 AS score_cap, 1 AS definition_version,
                'Hechos estadísticos de competiciones de clubes observadas; selecciones, amistosos y juveniles excluidos.' AS definition_md,
                'draft' AS status, 'lab_provisional' AS snapshot_status, id AS snapshot_id
           FROM club_goal_ranking_snapshots
          WHERE category_slug = $1 AND dataset = 'active_weekly'
            AND status IN ('lab_provisional', 'draft')
          ORDER BY generated_at DESC LIMIT 1`, [CLUB_CAREER_GOALS_CATEGORY_SLUG]
      );
      if (clubGoalsCandidate.rows[0]) categories.push({ ...clubGoalsCandidate.rows[0], availability: 'provisional' });
      const clubCardsCandidates = await appDb.query(
        `SELECT DISTINCT ON (card_kind) id,
                category_slug AS slug,
                CASE WHEN card_kind = 'yellow' THEN 'Tarjetas amarillas globales en clubes — alcance observado' ELSE 'Tarjetas rojas globales en clubes — alcance observado' END AS label_es,
                CASE WHEN card_kind = 'yellow' THEN 'Global club yellow cards — observed scope' ELSE 'Global club red cards — observed scope' END AS label_en,
                'player' AS entity_type, 'cards' AS metric_key, 'club_career_global' AS scope_kind,
                '{}'::jsonb AS scope, 'desc' AS ranking_direction, 'competition' AS tie_policy,
                100 AS score_cap, 1 AS definition_version,
                'Hechos estadísticos de competiciones de clubes observadas; selecciones, amistosos y juveniles excluidos.' AS definition_md,
                'draft' AS status, 'lab_provisional' AS snapshot_status, id AS snapshot_id
           FROM club_card_ranking_snapshots
          WHERE card_kind IN ('yellow', 'red') AND dataset = 'active_weekly'
            AND status IN ('lab_provisional', 'draft')
          ORDER BY card_kind, generated_at DESC`,
        []
      );
      for (const candidateRow of clubCardsCandidates.rows) categories.push({ ...candidateRow, availability: 'provisional' });
    }
    return { categories };
  });

  app.get('/v1/rankings/catalog', async (request) => {
    const query = z.object({ season: z.coerce.number().int().min(1800).max(2100).default(2026) }).parse(request.query);
    return getRankingCatalog(appDb, runtimeMode, query.season);
  });

  app.get('/v1/rankings/club-cards/status', async (request) => {
    const query = z.object({ season: z.coerce.number().int().min(1800).max(2100).default(2026) }).parse(request.query);
    return getLabClubCardsScopeStatus(appDb, query.season);
  });

  app.get('/v1/rankings/:categorySlug', async (request, reply) => {
    const params = z.object({ categorySlug: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(200), dataset: z.enum(['historical_base', 'active_season_weekly', 'active_edition_weekly']).optional(), scope: z.enum(['active', 'active_season', 'historical']).optional(), season: z.coerce.number().int().min(1800).max(2100).optional(), competition: z.string().min(1).optional(), card: z.enum(['yellow', 'red']).optional() }).parse(request.query);
    const scopedCard = params.categorySlug.match(/^(club-career-(?:yellow|red)-cards):([0-9]+)$/u);
    const categorySlug = scopedCard?.[1] ?? params.categorySlug;
    const competition = query.competition ?? scopedCard?.[2];
    if (params.categorySlug === CHAMPIONS_CATEGORY_SLUG) {
      const candidate = await getLabChampionsRanking(appDb, (query.dataset === 'historical_base' ? 'historical_base' : 'active_season_weekly'), query.limit, runtimeMode);
      if (!candidate) return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, reason: 'no_available_snapshot' });
      return candidate;
    }
    if (params.categorySlug === CHAMPIONS_ASSISTS_CATEGORY_SLUG) {
      const requestedHistorical = query.scope === 'historical' || query.dataset === 'historical_base';
      if (requestedHistorical) return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, scope: 'historical', reason: 'historical_candidate_not_sufficient', message: 'El histórico completo de asistencias todavía no tiene cobertura suficiente.' });
      const candidate = await getLabChampionsAssistsRanking(appDb, 'active_season_weekly', query.limit, runtimeMode, query.season);
      if (!candidate) return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, scope: 'active_season', season: query.season ?? null, reason: query.season ? 'season_not_available' : 'no_available_snapshot' });
      return candidate;
    }
    if (params.categorySlug === WORLD_CUP_CATEGORY_SLUG) {
      const candidate = await getLabWorldCupRanking(appDb, (query.dataset === 'historical_base' ? 'historical_base' : 'active_edition_weekly'), query.limit, runtimeMode);
      if (!candidate) return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, reason: 'no_available_snapshot' });
      return candidate;
    }
    if (categorySlug === CLUB_CAREER_YELLOW_CARDS_CATEGORY_SLUG || categorySlug === CLUB_CAREER_RED_CARDS_CATEGORY_SLUG || categorySlug === CLUB_CARDS_CATEGORY_SLUG) {
      const cardKind = categorySlug === CLUB_CAREER_YELLOW_CARDS_CATEGORY_SLUG ? 'yellow' : categorySlug === CLUB_CAREER_RED_CARDS_CATEGORY_SLUG ? 'red' : query.card;
      if (!cardKind) return reply.code(400).send({ error: 'invalid_card', category: categorySlug, message: 'card debe ser yellow o red.' });
      if (query.scope === 'historical' || query.dataset === 'historical_base') return reply.code(404).send({ error: 'ranking_not_available', category: categorySlug, mode: runtimeMode, scope: 'historical', reason: 'historical_candidate_not_sufficient', message: 'El histórico completo de tarjetas de clubes todavía no tiene cobertura suficiente.' });
      const candidate = await getLabClubCardsRanking(appDb, cardKind, 'active_weekly', query.limit, runtimeMode, query.season, competition);
      if (!candidate) {
        const knownStatus = competition && /^\d+$/u.test(competition) ? getKnownClubCardsCompetitionStatus(competition) : null;
        if (knownStatus?.status === 'quota_insufficient') return reply.code(404).send({ error: 'quota_insufficient', category: categorySlug, mode: runtimeMode, scope: 'active', season: query.season ?? null, competition, status: 'quota_insufficient', snapshotState: 'snapshot_preserved', reason: 'quota_insufficient', message: `${knownStatus.name} no está disponible: la cuota de API-Football está agotada.` });
        return reply.code(404).send({ error: 'ranking_not_available', category: categorySlug, mode: runtimeMode, scope: 'active', season: query.season ?? null, competition: competition ?? null, status: 'ranking_not_available', reason: 'no_available_snapshot' });
      }
      return candidate;
    }
    if (params.categorySlug === CLUB_CAREER_GOALS_CATEGORY_SLUG) {
      if (query.scope === 'historical' || query.dataset === 'historical_base') return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, scope: 'historical', reason: 'historical_candidate_not_sufficient', message: 'El histórico global de goles de clubes no tiene cobertura suficiente.' });
      const candidate = await getLabClubCareerGoalsRanking(appDb, query.limit, runtimeMode, query.season, query.competition);
      if (!candidate) return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, scope: 'active', season: query.season ?? null, reason: 'no_available_snapshot' });
      return candidate;
    }
    if (params.categorySlug === 'club-global-titles') {
      return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, reason: 'no_traceable_facts', message: 'Esta categoría todavía no tiene datos trazables disponibles.' });
    }
    const result = await appDb.query(
      `WITH latest_snapshot AS (
         SELECT rs.* FROM ranking_snapshots rs
         JOIN category_definitions c0 ON c0.id = rs.category_id
         WHERE c0.slug = $1 AND c0.status <> 'retired'
           AND rs.status IN ('published', 'draft')
         ORDER BY rs.generated_at DESC LIMIT 1
       )
       SELECT c.slug, c.label_es, c.label_en, c.status AS category_status,
              rs.id AS snapshot_id, rs.status AS snapshot_status, rs.data_version, rs.generated_at,
              ce.id AS entity_id, re.entity_id AS source_entity_id,
              ce.entity_type, ce.canonical_name, ce.short_name, ce.is_goalkeeper,
              re.raw_value, re.rank, re.score_value, re.tie_group,
              (COALESCE(egp.playable_default, FALSE) AND ce.catalog_status = 'active') AS playable,
              COALESCE(egp.playable_default, FALSE) AS playable_default,
              CASE WHEN ia.id IS NOT NULL
                   THEN '/v1/media/' || ce.id || '/file'
                   ELSE '/v1/media/' || ce.id || '/fallback'
              END AS image_url,
              CASE WHEN ia.id IS NOT NULL THEN 'licensed' ELSE 'fallback' END AS image_status,
              COALESCE(media_state.review_status, 'missing') AS review_status,
              CASE
                WHEN ia.id IS NOT NULL THEN 'approved'
                WHEN media_state.review_status = 'pending' THEN 'review_required'
                WHEN media_state.review_status = 'rejected' THEN 'rejected'
                WHEN media_state.review_status = 'approved' THEN 'review_required'
                ELSE 'missing'
              END AS rights_status,
              (ia.id IS NOT NULL) AS is_publishable,
              COALESCE(ia.source_url, media_state.source_url) AS image_source_url,
              COALESCE(ia.provider, media_state.provider) AS image_provider,
              COALESCE(ia.license_name, media_state.license_name) AS image_license_name,
              COALESCE(ia.license_url, media_state.license_url) AS image_license_url,
              COALESCE(ia.metadata, media_state.metadata)->>'author' AS image_author
       FROM category_definitions c
       JOIN latest_snapshot rs ON rs.category_id = c.id
       JOIN ranking_entries re ON re.snapshot_id = rs.id AND re.rank <= $2
       JOIN entities e ON e.id = re.entity_id
       LEFT JOIN entity_identity_links eil ON eil.source_entity_id = re.entity_id
       JOIN entities ce ON ce.id = COALESCE(eil.canonical_entity_id, re.entity_id)
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = ce.id
       LEFT JOIN image_assets ia ON ia.entity_id = ce.id
         AND ia.asset_kind = CASE WHEN ce.entity_type = 'player' THEN 'portrait' ELSE 'badge' END
         AND ia.is_primary = TRUE AND ia.review_status = 'approved'
         AND ia.rights_basis <> 'unknown' AND ia.commercial_use = TRUE
         AND ia.rights_verified_at IS NOT NULL AND ia.rights_evidence_url IS NOT NULL
         AND jsonb_array_length(ia.usage_scope) > 0
         AND (ce.entity_type <> 'club' OR ia.trademark_status = 'cleared')
         AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
       LEFT JOIN LATERAL (
         SELECT candidate.review_status, candidate.source_url, candidate.provider, candidate.license_name, candidate.license_url, candidate.metadata
           FROM image_assets candidate
          WHERE candidate.entity_id = ce.id
            AND candidate.asset_kind = CASE WHEN ce.entity_type = 'player' THEN 'portrait' ELSE 'badge' END
          ORDER BY candidate.is_primary DESC, CASE candidate.review_status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END, candidate.id
          LIMIT 1
       ) media_state ON TRUE
       WHERE c.slug = $1
       ORDER BY rs.generated_at DESC, re.rank, e.canonical_name
       LIMIT $2`,
      [params.categorySlug, query.limit]
    );
    if (result.rows.length === 0) return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, reason: 'no_available_snapshot' });
    const snapshotId = result.rows[0]?.snapshot_id;
    const provisional = result.rows[0]?.snapshot_status !== 'published';
    return { category: result.rows[0]?.slug, rankingScope: 'historical_snapshot', snapshotId, mode: runtimeMode, status: provisional ? 'provisional' : 'official', entries: result.rows.map((row) => ({ ...row, imageStatus: row.image_status, reviewStatus: row.review_status, rightsStatus: row.rights_status, isPublishable: Boolean(row.is_publishable), playable: Boolean(row.playable), media: { status: row.image_status, imageStatus: row.image_status, reviewStatus: row.review_status, rightsStatus: row.rights_status, isPublishable: Boolean(row.is_publishable), url: row.image_url, sourceUrl: row.image_source_url, licenseName: row.image_license_name } })) };
  });

  app.get('/v1/entities/:entityId', async (request, reply) => {
    const params = z.object({ entityId: z.string().min(1) }).parse(request.params);
    const entity = await pool.query(
      `SELECT canonical_entity.*
       FROM entities requested
       LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = requested.id
       JOIN entities canonical_entity ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, requested.id)
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = canonical_entity.id
       WHERE requested.id = $1
         AND canonical_entity.catalog_status = 'active'
         AND ${playableTop200Predicate('canonical_entity', 'egp')}`,
      [params.entityId]
    );
    if (!entity.rows[0]) return reply.code(404).send({ error: 'Entity not found' });
    const rankings = await pool.query(
      `WITH resolved AS (
         SELECT COALESCE(identity_link.canonical_entity_id, requested.id) AS canonical_id
         FROM entities requested
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = requested.id
         WHERE requested.id = $1
       )
       SELECT c.slug, c.label_es, c.label_en, re.raw_value, re.rank, re.score_value, rs.id AS snapshot_id, rs.data_version
       FROM ranking_entries re
       JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status = 'published'
       JOIN category_definitions c ON c.id = rs.category_id
       LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = re.entity_id
       JOIN entities resolved_entity ON resolved_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = resolved_entity.id
       WHERE COALESCE(identity_link.canonical_entity_id, re.entity_id) = (SELECT canonical_id FROM resolved)
         AND re.rank <= ${MAX_GAME_RANKING_ENTRIES}
         AND resolved_entity.catalog_status = 'active'
         AND ${playableTop200Predicate('resolved_entity', 'egp')}
       ORDER BY c.slug`,
      [params.entityId]
    );
    return { entity: entity.rows[0], rankings: rankings.rows };
  });

  app.get('/v1/media/:entityId', async (request, reply) => {
    const params = z.object({ entityId: z.string().min(1) }).parse(request.params);
    const result = await pool.query(
      `WITH resolved AS (
         SELECT COALESCE(identity_link.canonical_entity_id, requested.id) AS canonical_id
         FROM entities requested
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = requested.id
         WHERE requested.id = $1
       )
       SELECT ia.id, e.id AS entity_id, e.entity_type, e.canonical_name, ia.asset_kind, ia.source_url, ia.provider, ia.license_name, ia.license_url, ia.width, ia.height, ia.mime_type, ia.review_status,
              ia.rights_basis, ia.commercial_use, ia.attribution_required, ia.attribution_text, ia.rights_evidence_url, ia.rights_verified_at, ia.rights_verified_by, ia.trademark_status, ia.usage_scope,
              ia.metadata->>'author' AS author,
              CASE WHEN ia.id IS NOT NULL THEN '/v1/media/' || e.id || '/file' ELSE '/v1/media/' || e.id || '/fallback' END AS image_url,
              CASE WHEN ia.id IS NOT NULL THEN 'licensed' ELSE 'fallback' END AS image_status
       FROM entities e
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = e.id
       LEFT JOIN image_assets ia ON ia.entity_id = e.id
         AND ia.asset_kind = CASE WHEN e.entity_type = 'player' THEN 'portrait' ELSE 'badge' END
         AND ia.is_primary = TRUE AND ia.review_status = 'approved'
         AND ia.rights_basis <> 'unknown' AND ia.commercial_use = TRUE
         AND ia.rights_verified_at IS NOT NULL AND ia.rights_evidence_url IS NOT NULL
         AND jsonb_array_length(ia.usage_scope) > 0
         AND (e.entity_type <> 'club' OR ia.trademark_status = 'cleared')
         AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
       WHERE e.id = (SELECT canonical_id FROM resolved)
         AND e.catalog_status = 'active'
         AND ${playableTop200Predicate('e', 'egp')}`,
      [params.entityId]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Entity not found' });
    return result.rows[0];
  });

  app.get('/v1/media/:entityId/fallback', async (request, reply) => {
    const params = z.object({ entityId: z.string().min(1) }).parse(request.params);
    const result = await pool.query<{
      id: string;
      canonical_name: string;
      entity_type: 'player' | 'club' | 'national_team';
    }>(
      `WITH resolved AS (
         SELECT COALESCE(identity_link.canonical_entity_id, requested.id) AS canonical_id
         FROM entities requested
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = requested.id
         WHERE requested.id = $1
       )
       SELECT e.id, e.canonical_name, e.entity_type
       FROM entities e
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = e.id
       WHERE e.id = (SELECT canonical_id FROM resolved)
         AND e.catalog_status = 'active'
         AND ${playableTop200Predicate('e', 'egp')}`,
      [params.entityId]
    );
    const entity = result.rows[0];
    if (!entity) return reply.code(404).send({ error: 'Entity not found' });
    const bytes = await renderMediaFallback(entity.canonical_name, entity.id, entity.entity_type);
    return reply.header('Cache-Control', 'public, max-age=86400').type('image/webp').send(bytes);
  });

  app.get('/v1/media/:entityId/file', async (request, reply) => {
    const params = z.object({ entityId: z.string().min(1) }).parse(request.params);
    const result = await pool.query<{ local_path: string | null; mime_type: string }>(
      `WITH resolved AS (
         SELECT COALESCE(identity_link.canonical_entity_id, requested.id) AS canonical_id
         FROM entities requested
         LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = requested.id
         WHERE requested.id = $1
       )
       SELECT ia.local_path, ia.mime_type FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = e.id
       WHERE ia.entity_id = (SELECT canonical_id FROM resolved) AND ia.is_primary = TRUE AND ia.review_status = 'approved'
         AND e.catalog_status = 'active'
         AND ${playableTop200Predicate('e', 'egp')}
         AND ia.rights_basis <> 'unknown' AND ia.commercial_use = TRUE
         AND ia.rights_verified_at IS NOT NULL AND ia.rights_evidence_url IS NOT NULL
         AND jsonb_array_length(ia.usage_scope) > 0
         AND (e.entity_type <> 'club' OR ia.trademark_status = 'cleared')
         AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)`,
      [params.entityId]
    );
    const asset = result.rows[0];
    if (!asset?.local_path) return reply.code(404).send({ error: 'Approved image not found' });
    const mediaRoot = resolve(config.mediaRoot);
    const filePath = resolve(mediaRoot, basename(asset.local_path));
    if (!filePath.startsWith(`${mediaRoot}/`)) return reply.code(404).send({ error: 'Image not found' });
    try {
      const bytes = await readFile(filePath);
      return reply.header('Cache-Control', 'public, max-age=31536000, immutable').type(asset.mime_type).send(bytes);
    } catch {
      return reply.code(404).send({ error: 'Image file not found' });
    }
  });

  app.get('/v1/attributions', async (request) => {
    const query = z.object({ kind: z.enum(['portrait', 'badge']).optional() }).parse(request.query);
    const result = await pool.query(
      `SELECT ia.id, ia.entity_id, e.canonical_name, ia.asset_kind, ia.provider,
              ia.source_url, ia.license_name, ia.license_url,
              ia.rights_basis, ia.commercial_use, ia.attribution_required, ia.attribution_text,
              ia.rights_evidence_url, ia.rights_verified_at, ia.rights_verified_by, ia.trademark_status, ia.usage_scope,
              ia.metadata->>'author' AS author
       FROM image_assets ia
       JOIN entities e ON e.id = ia.entity_id
       LEFT JOIN entity_game_profiles egp ON egp.entity_id = e.id
       WHERE ia.review_status = 'approved'
         AND ia.is_primary = TRUE
         AND ia.rights_basis <> 'unknown' AND ia.commercial_use = TRUE
         AND ia.rights_verified_at IS NOT NULL AND ia.rights_evidence_url IS NOT NULL
         AND jsonb_array_length(ia.usage_scope) > 0
         AND (e.entity_type <> 'club' OR ia.trademark_status = 'cleared')
         AND e.catalog_status = 'active'
         AND ${playableTop200Predicate('e', 'egp')}
         AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
         AND ($1::text IS NULL OR ia.asset_kind = $1)
       ORDER BY e.canonical_name, ia.asset_kind`,
      [query.kind ?? null]
    );
    return {
      attributions: result.rows.map((row) => ({
        ...row,
        changes: 'Redimensionada/recortada y convertida a WebP 512x512 por Rango 90'
      }))
    };
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'Invalid request', details: error.issues });
    if (error instanceof ContractError) return reply.code(error.statusCode).send({ error: error.code, message: error.message, details: error.details });
    app.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  return app;
}
