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

const CHAMPIONS_CATEGORY_SLUG = 'uefa-champions-league-goals';
const WORLD_CUP_CATEGORY_SLUG = 'world-cup-goals';
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
            AND (rs.status = 'published' OR ($1::text = 'lab' AND rs.status = 'draft'))
          ORDER BY rs.generated_at DESC
          LIMIT 1
       ) latest ON TRUE
       WHERE (c.status = 'published' OR ($1::text = 'lab' AND c.status = 'draft'))
         AND NOT ($1::text = 'lab' AND c.slug = $2 AND EXISTS (
           SELECT 1 FROM champions_ranking_snapshots lab_champions
            WHERE lab_champions.category_slug = $2
              AND lab_champions.status IN ('lab_provisional', 'draft')
              AND lab_champions.coverage_complete = TRUE
         ))
         AND NOT ($1::text = 'lab' AND c.slug = $3 AND EXISTS (
           SELECT 1 FROM world_cup_ranking_snapshots lab_world_cup
            WHERE lab_world_cup.category_slug = $3
              AND lab_world_cup.status IN ('lab_provisional', 'draft')
              AND lab_world_cup.coverage_complete = TRUE
         ))
         ORDER BY c.slug`,
      [runtimeMode, CHAMPIONS_CATEGORY_SLUG, WORLD_CUP_CATEGORY_SLUG]
    );
    const categories = result.rows.map((row) => ({ ...row, availability: row.snapshot_status === 'draft' ? 'provisional' : 'official' }));
    if (runtimeMode === 'lab') {
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
    }
    return { categories };
  });

  app.get('/v1/rankings/:categorySlug', async (request, reply) => {
    const params = z.object({ categorySlug: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(200), dataset: z.enum(['historical_base', 'active_season_weekly', 'active_edition_weekly']).optional() }).parse(request.query);
    if (runtimeMode === 'lab' && params.categorySlug === CHAMPIONS_CATEGORY_SLUG) {
      const candidate = await getLabChampionsRanking(appDb, (query.dataset === 'historical_base' ? 'historical_base' : 'active_season_weekly'), query.limit, runtimeMode);
      if (!candidate) return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, reason: 'no_available_snapshot' });
      return candidate;
    }
    if (runtimeMode === 'lab' && params.categorySlug === WORLD_CUP_CATEGORY_SLUG) {
      const candidate = await getLabWorldCupRanking(appDb, (query.dataset === 'historical_base' ? 'historical_base' : 'active_edition_weekly'), query.limit, runtimeMode);
      if (!candidate) return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, reason: 'no_available_snapshot' });
      return candidate;
    }
    const result = await appDb.query(
      `WITH latest_snapshot AS (
         SELECT rs.* FROM ranking_snapshots rs
         JOIN category_definitions c0 ON c0.id = rs.category_id
         WHERE c0.slug = $1 AND c0.status <> 'retired'
           AND (rs.status = 'published' OR ($3::text = 'lab' AND rs.status = 'draft'))
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
      [params.categorySlug, query.limit, runtimeMode]
    );
    if (result.rows.length === 0) return reply.code(404).send({ error: 'ranking_not_available', category: params.categorySlug, mode: runtimeMode, reason: runtimeMode === 'official' ? 'no_published_snapshot' : 'no_available_snapshot' });
    const snapshotId = result.rows[0]?.snapshot_id;
    const provisional = runtimeMode === 'lab' && result.rows[0]?.snapshot_status !== 'published';
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
