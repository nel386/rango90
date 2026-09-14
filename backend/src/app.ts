import Fastify from 'fastify';
import cors from '@fastify/cors';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { z } from 'zod';
import { config, corsOrigins } from './config.js';
import { pool } from './db.js';
import { registerAuthRoutes } from './auth.js';
import { ContractError, registerGameContractRoutes, type ContractDatabase } from './game-contract.js';
import { MAX_GAME_RANKING_ENTRIES } from './catalogCleanup.js';
import { renderMediaFallback } from './mediaFallback.js';
import { SlidingWindowRateLimiter, rateLimitPolicy } from './rateLimit.js';

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

export function buildApp(options: { gameDb?: ContractDatabase; clock?: () => Date } = {}) {
  const app = Fastify({ logger: true, trustProxy: config.trustProxy });
  const rateLimiter = new SlidingWindowRateLimiter();

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
  registerGameContractRoutes(app, { db: options.gameDb, clock: options.clock });

  app.get('/health', async () => ({ ok: true, service: 'rango90-backend' }));

  app.get('/v1/categories', async (request) => {
    z.object({}).parse(request.query);
    const result = await pool.query(
      `SELECT id, slug, label_es, label_en, entity_type, metric_key, scope_kind, scope, ranking_direction, tie_policy, score_cap, definition_version, definition_md, status
       FROM category_definitions
       WHERE status = 'published'
       ORDER BY slug`,
      []
    );
    return { categories: result.rows };
  });

  app.get('/v1/rankings/:categorySlug', async (request, reply) => {
    const params = z.object({ categorySlug: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(200) }).parse(request.query);
    const result = await pool.query(
      `WITH latest_snapshot AS (
         SELECT rs.* FROM ranking_snapshots rs
         JOIN category_definitions c0 ON c0.id = rs.category_id
         WHERE c0.slug = $1 AND rs.status = 'published'
         ORDER BY rs.generated_at DESC LIMIT 1
       )
       SELECT c.slug, c.label_es, c.label_en, rs.id AS snapshot_id, rs.data_version, rs.generated_at,
              ce.id AS entity_id, re.entity_id AS source_entity_id,
              ce.entity_type, ce.canonical_name, ce.short_name, ce.is_goalkeeper,
              re.raw_value, re.rank, re.score_value, re.tie_group,
              COALESCE(egp.playable_default, FALSE) AS playable_default,
              CASE WHEN ia.id IS NOT NULL
                   THEN '/v1/media/' || ce.id || '/file'
                   ELSE '/v1/media/' || ce.id || '/fallback'
              END AS image_url,
              CASE WHEN ia.id IS NOT NULL THEN 'licensed' ELSE 'fallback' END AS image_status,
              ia.source_url AS image_source_url,
              ia.provider AS image_provider,
              ia.license_name AS image_license_name,
              ia.license_url AS image_license_url,
              ia.metadata->>'author' AS image_author
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
       WHERE c.slug = $1
         AND ce.catalog_status = 'active'
         AND ${playableTop200Predicate('ce', 'egp')}
       ORDER BY rs.generated_at DESC, re.rank, e.canonical_name
       LIMIT $2`,
      [params.categorySlug, query.limit]
    );
    if (result.rows.length === 0) return reply.code(404).send({ error: 'Published ranking not found' });
    const snapshotId = result.rows[0]?.snapshot_id;
    return { category: result.rows[0]?.slug, snapshotId, entries: result.rows };
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
