import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from './db.js';
import { getCurrentUser } from './auth.js';
import { MAX_GAME_RANKING_ENTRIES } from './catalogCleanup.js';
import { selectDailyCategoryEntity, type DailyChallengeRankingEntry } from './dailyChallengeSelection.js';
import { type RuntimeMode } from './runtimeMode.js';
import {
  GameRuleError,
  buildOfficialGameResult,
  calculateGameResult,
  expireGame,
  GAME_ENGINE_VERSION,
  startGame,
  submitDecision,
  type GameEntityType,
  type GameResult,
  type PublishedGameChallenge,
  type SubmittedAssignment
} from './game-engine.js';

type QueryExecutor = Pick<PoolClient, 'query'>;
export type ContractDatabase = Pick<Pool, 'query' | 'connect'>;

export class ContractError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

type ChallengeCategoryRow = {
  category_ordinal: number;
  category_id: string;
  ranking_snapshot_id: string;
  slug: string;
  label_es: string;
  label_en: string;
  entity_type: GameEntityType;
  category_status?: string;
  snapshot_status?: string;
  coverage_complete?: boolean;
  unresolved_conflicts?: number;
  rights_status?: string;
  score_mismatches?: number;
  image_policy_required?: boolean;
  non_publishable_images?: number;
  category_scope?: unknown;
  snapshot_metadata?: unknown;
};

type ChallengeDecisionRow = {
  decision_ordinal: number;
  entity_id: string;
  canonical_name: string;
  short_name: string | null;
  entity_type: GameEntityType;
  image_url: string;
  image_status: 'licensed' | 'unlicensed' | 'fallback';
};

type ChallengeAnswerRow = {
  decision_ordinal: number;
  category_id: string;
  slug: string;
  score_value: number;
};

type LoadedChallenge = {
  id: string;
  kind: 'daily' | 'weekly' | 'duel';
  challengeDate: string | null;
  sourceVersion: string;
  engineVersion: string;
  timeLimitSeconds: number;
  scoreCap: number;
  challengeSha256: string;
  testOnly: boolean;
  runtimeMode: RuntimeMode;
  engine: PublishedGameChallenge;
  categories: readonly ChallengeCategoryRow[];
  decisions: readonly ChallengeDecisionRow[];
};

type SessionRow = {
  id: string;
  game_challenge_id: string;
  player_id: string | null;
  status: 'active' | 'completed' | 'expired' | 'abandoned';
  started_at: Date | string;
  deadline_at: Date | string;
  current_ordinal: number;
  state_version: number;
  variant_sha256: string | null;
  variant_decisions: unknown;
};

type StoredResult = { id: string; result_hash: string; payload: GameResult };

export type ChallengeHashInput = {
  id: string;
  kind: 'daily' | 'weekly' | 'duel';
  challengeDate: string | null;
  sourceVersion: string;
  engineVersion: string;
  timeLimitSeconds: number;
  scoreCap: number;
  categories: Array<{ ordinal: number; categoryId: string; rankingSnapshotId: string; slug: string; entityType?: GameEntityType }>;
  decisions: Array<{ ordinal: number; entityId: string; entityType?: GameEntityType }>;
  answers: Array<{ decisionOrdinal: number; categoryId: string; scoreValue: number }>;
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

export function calculateChallengeSha256(input: ChallengeHashInput): string {
  const canonical = {
    ...input,
    categories: [...input.categories].sort((left, right) => left.ordinal - right.ordinal || left.categoryId.localeCompare(right.categoryId)),
    decisions: [...input.decisions].sort((left, right) => left.ordinal - right.ordinal || left.entityId.localeCompare(right.entityId)),
    answers: [...input.answers].sort((left, right) => left.decisionOrdinal - right.decisionOrdinal || left.categoryId.localeCompare(right.categoryId))
  };
  return createHash('sha256').update(stableSerialize(canonical)).digest('hex');
}

const resultAssignmentSchema = z.object({
  ordinal: z.number().int().nonnegative(),
  entityId: z.string().min(1).max(200),
  categorySlug: z.string().min(1).max(200),
  timedOut: z.boolean().optional()
});

const resultClaimsSchema = z.object({
  assignments: z.array(resultAssignmentSchema).min(1).max(500),
  clientResultHash: z.string().regex(/^[0-9a-f]{64}$/).optional()
});

const sessionTokenSchema = z.string().min(20).max(200);

const decisionRequestSchema = z.object({
  sessionToken: sessionTokenSchema,
  decision: resultAssignmentSchema,
  previousAssignments: z.array(resultAssignmentSchema).max(7).default([])
});

const storedVariantDecisionSchema = z.object({
  ordinal: z.number().int().nonnegative(),
  entityId: z.string().min(1),
  entityType: z.enum(['player', 'club', 'national_team']),
  scoreByCategory: z.record(z.string(), z.number().int().positive())
});
const storedVariantSchema = z.array(storedVariantDecisionSchema).min(1).max(500);

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function nowMs(clock: () => Date): number {
  const value = clock().getTime();
  if (!Number.isSafeInteger(value)) throw new ContractError(500, 'clock_invalid', 'Server clock is invalid');
  return value;
}

function epoch(value: Date | string): number {
  const milliseconds = new Date(value).getTime();
  if (!Number.isSafeInteger(milliseconds)) throw new ContractError(500, 'data_invalid', 'Stored timestamp is invalid');
  return milliseconds;
}

function challengeDateValue(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toNumber(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new ContractError(500, 'data_invalid', 'Stored integer is invalid');
  return parsed;
}

async function loadPublishedChallenge(db: QueryExecutor, challengeId?: string, kind?: 'daily' | 'weekly' | 'duel', runtimeMode: RuntimeMode = 'lab'): Promise<LoadedChallenge | null> {
  const challenge = await db.query<{
    id: string;
    challenge_kind: 'daily' | 'weekly' | 'duel';
    challenge_date: Date | string | null;
    source_version: string;
    engine_version: string;
    time_limit_seconds: number | string;
    score_cap: number | string;
    challenge_sha256: string;
    test_only: boolean;
  }>(
    `SELECT id, challenge_kind, challenge_date, source_version, engine_version,
            time_limit_seconds, score_cap, challenge_sha256,
            (status = 'draft' AND metadata->>'testOnly' = 'true') AS test_only
       FROM game_challenges
      WHERE (status = 'published' OR (status = 'draft' AND metadata->>'testOnly' = 'true'))
        AND ($1::text IS NULL OR id = $1)
        AND ($2::text IS NULL OR challenge_kind = $2)
      ORDER BY (status = 'published') DESC, challenge_date DESC NULLS LAST,
               published_at DESC NULLS LAST, updated_at DESC, created_at DESC, id
      LIMIT 1`,
    [challengeId ?? null, kind ?? null]
  );
  const row = challenge.rows[0];
  if (!row) return null;
  const challengeDate = challengeDateValue(row.challenge_date);

  const categoriesResult = await db.query<ChallengeCategoryRow>(
    `SELECT gcc.category_ordinal, gcc.category_id, gcc.ranking_snapshot_id,
            cd.slug, cd.label_es, cd.label_en, cd.entity_type,
            cd.status AS category_status,
            rs.status AS snapshot_status,
            rs.coverage_complete,
            rs.unresolved_conflicts,
            cd.scope AS category_scope,
            rs.metadata AS snapshot_metadata,
            cd.scope AS category_scope,
            rs.metadata AS snapshot_metadata,
            COALESCE(source.rights_status, 'unknown') AS rights_status,
            COALESCE((cd.scope->>'imagesRequired')::boolean, (rs.metadata->>'imagesRequired')::boolean, FALSE) AS image_policy_required,
            (
              SELECT COUNT(*)::int
              FROM game_challenge_decisions score_decision
              JOIN game_challenge_answers score_answer
                ON score_answer.game_challenge_id = score_decision.game_challenge_id
               AND score_answer.decision_ordinal = score_decision.decision_ordinal
               AND score_answer.category_id = gcc.category_id
              LEFT JOIN LATERAL (
                SELECT re.score_value
                  FROM ranking_entries re
                  LEFT JOIN entity_identity_links score_identity ON score_identity.source_entity_id = re.entity_id
                 WHERE re.snapshot_id = gcc.ranking_snapshot_id
                   AND COALESCE(score_identity.canonical_entity_id, re.entity_id) = score_decision.entity_id
                 ORDER BY re.rank, re.entity_id
                 LIMIT 1
              ) expected_score ON TRUE
             WHERE score_decision.game_challenge_id = gcc.game_challenge_id
               AND score_answer.score_value IS DISTINCT FROM COALESCE(expected_score.score_value, (SELECT score_cap FROM game_challenges WHERE id = gcc.game_challenge_id))
            ) AS score_mismatches,
            (
              SELECT COUNT(*)::int
                FROM game_challenge_decisions image_decision
                LEFT JOIN entity_identity_links image_identity ON image_identity.source_entity_id = image_decision.entity_id
                JOIN entities image_entity ON image_entity.id = COALESCE(image_identity.canonical_entity_id, image_decision.entity_id)
                LEFT JOIN image_assets image_asset
                  ON image_asset.entity_id = image_entity.id
                 AND image_asset.asset_kind = CASE WHEN image_entity.entity_type = 'player' THEN 'portrait' ELSE 'badge' END
                 AND image_asset.is_primary = TRUE
                 AND image_asset.review_status = 'approved'
                 AND image_asset.rights_basis <> 'unknown'
                 AND image_asset.commercial_use = TRUE
                 AND image_asset.rights_verified_at IS NOT NULL
                 AND image_asset.rights_evidence_url IS NOT NULL
                 AND jsonb_array_length(image_asset.usage_scope) > 0
                 AND (image_entity.entity_type <> 'club' OR image_asset.trademark_status = 'cleared')
                 AND (image_asset.attribution_required = FALSE OR NULLIF(image_asset.attribution_text, '') IS NOT NULL)
               WHERE image_decision.game_challenge_id = gcc.game_challenge_id
                 AND image_asset.id IS NULL
            )::int AS non_publishable_images
       FROM game_challenge_categories gcc
       JOIN category_definitions cd ON cd.id = gcc.category_id
       JOIN ranking_snapshots rs ON rs.id = gcc.ranking_snapshot_id
       LEFT JOIN source_snapshots source_snapshot ON source_snapshot.id = rs.metadata->>'sourceSnapshotId'
       LEFT JOIN sources source ON source.key = source_snapshot.source_key
      WHERE gcc.game_challenge_id = $1
      ORDER BY gcc.category_ordinal`,
    [row.id]
  );
  const decisionsResult = await db.query<ChallengeDecisionRow>(
    `SELECT gcd.decision_ordinal, gcd.entity_id, e.canonical_name, e.short_name, e.entity_type,
            CASE
              WHEN ia.id IS NOT NULL THEN '/v1/media/' || e.id || '/file'
              WHEN $2::boolean
                AND e.metadata->>'provider' = 'api-football'
                AND NULLIF(e.metadata->>'photoUrl', '') IS NOT NULL
                THEN e.metadata->>'photoUrl'
              ELSE '/v1/media/' || e.id || '/fallback'
            END AS image_url,
            CASE
              WHEN ia.id IS NOT NULL THEN 'licensed'
              WHEN $2::boolean
                AND e.metadata->>'provider' = 'api-football'
                AND NULLIF(e.metadata->>'photoUrl', '') IS NOT NULL
                THEN 'unlicensed'
              ELSE 'fallback'
            END AS image_status
       FROM game_challenge_decisions gcd
       LEFT JOIN entity_identity_links decision_identity
         ON decision_identity.source_entity_id = gcd.entity_id
       JOIN entities e
         ON e.id = COALESCE(decision_identity.canonical_entity_id, gcd.entity_id)
       LEFT JOIN image_assets ia
         ON ia.entity_id = e.id
        AND ia.asset_kind = CASE WHEN e.entity_type = 'player' THEN 'portrait' ELSE 'badge' END
        AND ia.is_primary = TRUE
        AND ia.review_status = 'approved'
        AND ia.rights_basis <> 'unknown'
        AND ia.commercial_use = TRUE
        AND ia.rights_verified_at IS NOT NULL
        AND ia.rights_evidence_url IS NOT NULL
        AND jsonb_array_length(ia.usage_scope) > 0
        AND (e.entity_type <> 'club' OR ia.trademark_status = 'cleared')
        AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
      WHERE gcd.game_challenge_id = $1
      ORDER BY gcd.decision_ordinal`,
    [row.id, row.test_only]
  );
  const answersResult = await db.query<ChallengeAnswerRow>(
    `SELECT gca.decision_ordinal, gca.category_id, cd.slug, gca.score_value
       FROM game_challenge_answers gca
       JOIN category_definitions cd ON cd.id = gca.category_id
      WHERE gca.game_challenge_id = $1
      ORDER BY gca.decision_ordinal, gca.category_id`,
    [row.id]
  );

  const categories = categoriesResult.rows;
  const expectedChallengeSha256 = calculateChallengeSha256({
    id: row.id,
    kind: row.challenge_kind,
    challengeDate,
    sourceVersion: row.source_version,
    engineVersion: row.engine_version,
    timeLimitSeconds: toNumber(row.time_limit_seconds),
    scoreCap: toNumber(row.score_cap),
    categories: categories.map((category) => ({ ordinal: category.category_ordinal, categoryId: category.category_id, rankingSnapshotId: category.ranking_snapshot_id, slug: category.slug, entityType: category.entity_type })),
    decisions: decisionsResult.rows.map((decision) => ({ ordinal: decision.decision_ordinal, entityId: decision.entity_id, entityType: decision.entity_type })),
    answers: answersResult.rows.map((answer) => ({ decisionOrdinal: answer.decision_ordinal, categoryId: answer.category_id, scoreValue: toNumber(answer.score_value) }))
  });
  if (row.challenge_sha256 !== expectedChallengeSha256) {
    throw new ContractError(503, 'challenge_hash_mismatch', 'Published challenge content hash does not match persisted content');
  }
  const answersByDecision = new Map<number, Record<string, number>>();
  for (const answer of answersResult.rows) {
    const scores = answersByDecision.get(answer.decision_ordinal) ?? {};
    scores[answer.slug] = toNumber(answer.score_value);
    answersByDecision.set(answer.decision_ordinal, scores);
  }
  const engine: PublishedGameChallenge = {
    id: row.id,
    sourceVersion: row.source_version,
    challengeSha256: row.challenge_sha256,
    timeLimitSeconds: toNumber(row.time_limit_seconds),
    scoreCap: toNumber(row.score_cap),
    categories: categories.map((category) => ({ slug: category.slug, entityType: category.entity_type })),
    decisions: decisionsResult.rows.map((decision) => ({
      ordinal: decision.decision_ordinal,
      entityId: decision.entity_id,
      entityType: decision.entity_type,
      scoreByCategory: answersByDecision.get(decision.decision_ordinal) ?? {}
    }))
  };
  if (row.engine_version !== GAME_ENGINE_VERSION) {
    throw new ContractError(503, 'engine_version_unsupported', 'Published challenge uses an unsupported game engine version');
  }
  try {
    startGame(engine, 0);
  } catch (error) {
    if (error instanceof GameRuleError) throw new ContractError(503, 'challenge_invalid', error.message);
    throw error;
  }
  return {
    id: row.id,
    kind: row.challenge_kind,
    challengeDate,
    sourceVersion: row.source_version,
    engineVersion: row.engine_version,
    timeLimitSeconds: engine.timeLimitSeconds,
    scoreCap: engine.scoreCap,
    challengeSha256: row.challenge_sha256,
    testOnly: row.test_only,
    runtimeMode,
    engine,
    categories,
    decisions: decisionsResult.rows
  };
}

type VariantEntryRow = DailyChallengeRankingEntry & {
  canonicalName: string;
  shortName: string | null;
  entityType: GameEntityType;
  imageUrl: string;
  imageStatus: 'licensed' | 'unlicensed' | 'fallback';
};

async function buildDailyVariant(db: QueryExecutor, challenge: LoadedChallenge, selectionSeed: string): Promise<LoadedChallenge> {
  if (challenge.kind !== 'daily') return challenge;
  // A provisional/test-only board already contains its audited real-player
  // decisions. Do not rebuild it from legacy ranking_entries: that table may
  // not contain the append-only candidate snapshots, and rebuilding would
  // incorrectly turn a valid challenge into daily_variant_unavailable.
  if (challenge.testOnly) return challenge;
  // Non-test daily boards use the independent player draw below.
  if (challenge.categories.length !== 7 || challenge.categories.some((category) => category.entity_type !== 'player')) return challenge;
  const snapshotIds = challenge.categories.map((category) => category.ranking_snapshot_id);
  const entries = await db.query<VariantEntryRow>(
    `SELECT DISTINCT ON (re.snapshot_id, canonical_entity.id)
            re.snapshot_id AS "snapshotId", canonical_entity.id AS "entityId", re.rank, re.score_value AS "scoreValue",
            canonical_entity.canonical_name AS "canonicalName", canonical_entity.short_name AS "shortName", canonical_entity.entity_type AS "entityType",
            CASE
              WHEN ia.id IS NOT NULL THEN '/v1/media/' || canonical_entity.id || '/file'
              WHEN $3::boolean AND canonical_entity.metadata->>'provider' = 'api-football'
                AND NULLIF(canonical_entity.metadata->>'photoUrl', '') IS NOT NULL
                THEN canonical_entity.metadata->>'photoUrl'
              ELSE '/v1/media/' || canonical_entity.id || '/fallback'
            END AS "imageUrl",
            CASE
              WHEN ia.id IS NOT NULL THEN 'licensed'
              WHEN $3::boolean AND canonical_entity.metadata->>'provider' = 'api-football'
                AND NULLIF(canonical_entity.metadata->>'photoUrl', '') IS NOT NULL
                THEN 'unlicensed'
              ELSE 'fallback'
            END AS "imageStatus"
       FROM ranking_entries re
       JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
       JOIN category_definitions category ON category.id = rs.category_id
       LEFT JOIN entity_identity_links identity_link ON identity_link.source_entity_id = re.entity_id
       JOIN entities canonical_entity ON canonical_entity.id = COALESCE(identity_link.canonical_entity_id, re.entity_id)
       LEFT JOIN image_assets ia
         ON ia.entity_id = canonical_entity.id
        AND ia.asset_kind = 'portrait'
        AND ia.is_primary = TRUE
        AND ia.review_status = 'approved'
        AND ia.rights_basis <> 'unknown'
        AND ia.commercial_use = TRUE
        AND ia.rights_verified_at IS NOT NULL
        AND ia.rights_evidence_url IS NOT NULL
        AND jsonb_array_length(ia.usage_scope) > 0
        AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
      WHERE re.snapshot_id = ANY($1::text[])
        AND re.rank <= $2
        AND canonical_entity.catalog_status = 'active'
        AND canonical_entity.entity_type = category.entity_type
        AND canonical_entity.entity_type = 'player'
        AND EXISTS (
          SELECT 1 FROM entity_game_profiles playable_profile
           WHERE playable_profile.entity_id = canonical_entity.id
             AND playable_profile.playable_default = TRUE
        )
      ORDER BY re.snapshot_id, canonical_entity.id, re.rank, re.entity_id`,
    [snapshotIds, MAX_GAME_RANKING_ENTRIES, challenge.testOnly]
  );
  const selectedIds = new Set<string>();
  const selected: VariantEntryRow[] = [];
  for (const category of challenge.categories) {
    const candidate = selectDailyCategoryEntity(entries.rows, category.ranking_snapshot_id, `${selectionSeed}|${category.slug}`, 90, selectedIds);
    if (!candidate) throw new ContractError(503, 'daily_variant_unavailable', `No hay siete jugadores jugables disponibles para ${category.slug}`);
    const row = entries.rows.find((entry) => entry.snapshotId === category.ranking_snapshot_id && entry.entityId === candidate.entityId);
    if (!row) throw new ContractError(503, 'daily_variant_unavailable', 'No se pudo completar la variante diaria');
    selectedIds.add(candidate.entityId);
    selected.push(row);
  }
  const decisions = selected.map((entry, ordinal) => ({
    ordinal,
    entityId: entry.entityId,
    entityType: entry.entityType,
    scoreByCategory: Object.fromEntries(challenge.categories.map((category) => [
      category.slug,
      entries.rows.find((candidate) => candidate.entityId === entry.entityId && candidate.snapshotId === category.ranking_snapshot_id)?.scoreValue ?? challenge.scoreCap
    ]))
  }));
  const challengeSha256 = calculateChallengeSha256({
    id: challenge.id,
    kind: challenge.kind,
    challengeDate: challenge.challengeDate,
    sourceVersion: challenge.sourceVersion,
    engineVersion: challenge.engineVersion,
    timeLimitSeconds: challenge.timeLimitSeconds,
    scoreCap: challenge.scoreCap,
    categories: challenge.categories.map((category) => ({ ordinal: category.category_ordinal, categoryId: category.category_id, rankingSnapshotId: category.ranking_snapshot_id, slug: category.slug, entityType: category.entity_type })),
    decisions: decisions.map((decision) => ({ ordinal: decision.ordinal, entityId: decision.entityId, entityType: decision.entityType })),
    answers: decisions.flatMap((decision) => challenge.categories.map((category) => ({ decisionOrdinal: decision.ordinal, categoryId: category.category_id, scoreValue: decision.scoreByCategory[category.slug] ?? challenge.scoreCap })))
  });
  const engine: PublishedGameChallenge = { ...challenge.engine, challengeSha256, decisions };
  return {
    ...challenge,
    challengeSha256,
    engine,
    decisions: selected.map((entry, ordinal) => ({
      decision_ordinal: ordinal,
      entity_id: entry.entityId,
      canonical_name: entry.canonicalName,
      short_name: entry.shortName,
      entity_type: entry.entityType,
      image_url: entry.imageUrl,
      image_status: entry.imageStatus
    }))
  };
}

function storedVariantChallenge(challenge: LoadedChallenge, session: SessionRow): LoadedChallenge {
  if (!session.variant_sha256 || !session.variant_decisions) return challenge;
  const stored = storedVariantSchema.parse(session.variant_decisions);
  if (stored.length !== challenge.engine.decisions.length) throw new ContractError(503, 'daily_variant_invalid', 'La variante de la sesión no es válida');
  const engine: PublishedGameChallenge = { ...challenge.engine, challengeSha256: session.variant_sha256, decisions: stored };
  return { ...challenge, challengeSha256: session.variant_sha256, engine };
}

function publicChallenge(challenge: LoadedChallenge) {
  return {
    id: challenge.id,
    kind: challenge.kind,
    challengeDate: challenge.challengeDate,
    sourceVersion: challenge.sourceVersion,
    challengeSha256: challenge.challengeSha256,
    engineVersion: challenge.engineVersion,
    timeLimitSeconds: challenge.timeLimitSeconds,
    scoreCap: challenge.scoreCap,
    testOnly: challenge.testOnly,
    runtimeMode: challenge.runtimeMode,
    provisionalData: challenge.runtimeMode === 'lab' || challenge.testOnly,
    decisionCount: challenge.decisions.length,
    categories: challenge.categories.map((category) => ({
      ordinal: category.category_ordinal,
      id: category.category_id,
      rankingSnapshotId: category.ranking_snapshot_id,
      slug: category.slug,
      entityType: category.entity_type,
      labelEs: category.label_es,
      labelEn: category.label_en
    })),
    decisions: challenge.decisions.map((decision) => ({
      ordinal: decision.decision_ordinal,
      entityId: decision.entity_id,
      name: decision.canonical_name,
      shortName: decision.short_name,
      entityType: decision.entity_type,
      imageUrl: decision.image_url,
      imageStatus: decision.image_status
    }))
  };
}

function sessionResponse(session: { id: string; challengeId: string; status: string; startedAtMs: number; deadlineAtMs: number; currentOrdinal: number }, sessionToken: string) {
  return {
    sessionToken,
    game: {
      id: session.id,
      challengeId: session.challengeId,
      status: session.status,
      startedAt: new Date(session.startedAtMs).toISOString(),
      deadlineAt: new Date(session.deadlineAtMs).toISOString(),
      currentOrdinal: session.currentOrdinal
    }
  };
}

function isLeaderboardEligible(result: GameResult, authenticated: boolean): boolean {
  return authenticated && !result.timedOut && result.totalScore < 250;
}

function resultResponse(result: GameResult, resultId: string, status: 'accepted' | 'duplicate', authenticated: boolean) {
  return {
    accepted: status === 'accepted',
    duplicate: status === 'duplicate',
    leaderboardEligible: isLeaderboardEligible(result, authenticated),
    resultId,
    result
  };
}

async function getSession(db: QueryExecutor, gameId: string, token: string, forUpdate = false): Promise<SessionRow | null> {
  const result = await db.query<SessionRow>(
    `SELECT id, game_challenge_id, player_id, status, started_at, deadline_at, current_ordinal, state_version, variant_sha256, variant_decisions
       FROM game_sessions
      WHERE id = $1 AND session_token_hash = $2
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [gameId, hashToken(token)]
  );
  return result.rows[0] ?? null;
}

async function createGameSession(db: QueryExecutor, challenge: LoadedChallenge, userId: string | null, startedAtMsValue: number, replayOfSessionId: string | null = null) {
  const sessionChallenge = await buildDailyVariant(db, challenge, `${startedAtMsValue}|${randomBytes(16).toString('hex')}`);
  const id = `gs_${randomUUID()}`;
  const token = randomBytes(32).toString('base64url');
  const deadlineAtMsValue = startedAtMsValue + challenge.timeLimitSeconds * 1000;
  await db.query(
    `INSERT INTO game_sessions
       (id, game_challenge_id, player_id, session_token_hash, started_at, deadline_at, replay_of_session_id, variant_sha256, variant_decisions)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [id, challenge.id, userId, hashToken(token), new Date(startedAtMsValue), new Date(deadlineAtMsValue), replayOfSessionId, sessionChallenge.challengeSha256, JSON.stringify(sessionChallenge.engine.decisions)]
  );
  return { id, token, startedAtMs: startedAtMsValue, deadlineAtMs: deadlineAtMsValue, challenge: sessionChallenge };
}

function assertUserCanUseSession(session: SessionRow, userId: string | null): void {
  if (session.player_id && session.player_id !== userId) {
    throw new ContractError(403, 'session_forbidden', 'This game session belongs to another player');
  }
}

function asSubmittedAssignments(value: z.infer<typeof resultClaimsSchema>): SubmittedAssignment[] {
  return value.assignments.map((assignment) => ({
    ordinal: assignment.ordinal,
    entityId: assignment.entityId,
    categorySlug: assignment.categorySlug,
    ...(assignment.timedOut === undefined ? {} : { timedOut: assignment.timedOut })
  }));
}

function replayDecisionState(challenge: LoadedChallenge, session: SessionRow, previousAssignments: Array<z.infer<typeof resultAssignmentSchema>>): ReturnType<typeof startGame> {
  let state = startGame(challenge.engine, epoch(session.started_at));
  for (const assignment of previousAssignments.sort((left, right) => left.ordinal - right.ordinal)) {
    if (assignment.timedOut) break;
    state = submitDecision(challenge.engine, state, {
      ordinal: assignment.ordinal,
      entityId: assignment.entityId,
      categorySlug: assignment.categorySlug
    }, epoch(session.started_at));
  }
  return state;
}

function officialResultFromClaims(challenge: LoadedChallenge, sessionStartedAtMs: number, deadlineAtMs: number, claims: z.infer<typeof resultClaimsSchema>, serverNowMs: number): GameResult {
  const assignments = asSubmittedAssignments(claims);
  const claimsTimeout = assignments.some((assignment) => assignment.timedOut === true);
  if (claimsTimeout && serverNowMs < deadlineAtMs) throw new ContractError(409, 'time_not_expired', 'A timeout result cannot be submitted before the deadline');
  if (!claimsTimeout && serverNowMs >= deadlineAtMs) throw new ContractError(409, 'time_expired', 'The deadline has passed; expire the game instead');
  try {
    return buildOfficialGameResult(challenge.engine, {
      startedAtMs: sessionStartedAtMs,
      finishedAtMs: claimsTimeout ? deadlineAtMs : serverNowMs,
      assignments
    });
  } catch (error) {
    if (error instanceof GameRuleError) throw new ContractError(422, error.code, error.message, error.details);
    throw error;
  }
}

function officialExpiredResultFromClaims(
  challenge: LoadedChallenge,
  sessionStartedAtMs: number,
  deadlineAtMs: number,
  claims: z.infer<typeof resultClaimsSchema> | undefined,
  serverNowMs: number
): GameResult {
  if (serverNowMs < deadlineAtMs) throw new ContractError(409, 'time_not_expired', 'The game deadline has not passed');
  let state = startGame(challenge.engine, sessionStartedAtMs);
  for (const assignment of claims?.assignments ?? []) {
    if (assignment.timedOut) break;
    try {
      state = submitDecision(challenge.engine, state, {
        ordinal: assignment.ordinal,
        entityId: assignment.entityId,
        categorySlug: assignment.categorySlug
      }, sessionStartedAtMs);
    } catch (error) {
      if (error instanceof GameRuleError) throw new ContractError(422, error.code, error.message, error.details);
      throw error;
    }
  }
  try {
    const expired = expireGame(challenge.engine, state, serverNowMs);
    if (expired.phase === 'finished' && expired.timedOut === false) {
      // A complete client payload arriving through /expire is still late. It
      // must never become a zero-time normal result eligible for the ranking.
      return calculateGameResult(challenge.engine, { ...expired, timedOut: true, finishedAtMs: deadlineAtMs });
    }
    return calculateGameResult(challenge.engine, expired);
  } catch (error) {
    if (error instanceof GameRuleError) throw new ContractError(409, error.code, error.message, error.details);
    throw error;
  }
}

async function existingResult(db: QueryExecutor, where: 'game_session_id' | 'duel_participant_id', id: string): Promise<StoredResult | null> {
  const result = await db.query<{ id: string; result_hash: string; payload: GameResult }>(
    `SELECT id, result_hash, payload FROM game_results WHERE ${where} = $1`,
    [id]
  );
  const row = result.rows[0];
  return row ? { id: row.id, result_hash: row.result_hash, payload: row.payload } : null;
}

async function storeResult(
  db: QueryExecutor,
  challenge: LoadedChallenge,
  result: GameResult,
  input: { sessionId?: string; duelParticipantId?: string; playerId: string | null; submissionScope: string; idempotencyKey: string }
): Promise<{ status: 'accepted' | 'duplicate'; resultId: string; result: GameResult }> {
  const linkedResult = input.sessionId
    ? await existingResult(db, 'game_session_id', input.sessionId)
    : input.duelParticipantId
      ? await existingResult(db, 'duel_participant_id', input.duelParticipantId)
      : null;
  if (linkedResult) {
    if (linkedResult.result_hash !== result.resultHash) throw new ContractError(409, 'result_conflict', 'This game already has a different result');
    return { status: 'duplicate', resultId: linkedResult.id, result: linkedResult.payload };
  }

  const byKey = await db.query<{ id: string; result_hash: string; payload: GameResult }>(
    `SELECT id, result_hash, payload FROM game_results
      WHERE submission_scope = $1 AND game_challenge_id = $2 AND idempotency_key = $3`,
    [input.submissionScope, challenge.id, input.idempotencyKey]
  );
  if (byKey.rows[0]) {
    if (byKey.rows[0].result_hash !== result.resultHash) throw new ContractError(409, 'submission_conflict', 'The idempotency key was used with another result');
    return { status: 'duplicate', resultId: byKey.rows[0].id, result: byKey.rows[0].payload };
  }
  const byHash = await db.query<{ id: string; result_hash: string; payload: GameResult }>(
    `SELECT id, result_hash, payload FROM game_results
      WHERE submission_scope = $1 AND game_challenge_id = $2 AND result_hash = $3`,
    [input.submissionScope, challenge.id, result.resultHash]
  );
  if (byHash.rows[0]) return { status: 'duplicate', resultId: byHash.rows[0].id, result: byHash.rows[0].payload };

  const resultId = `gr_${randomUUID()}`;
  await db.query(
    `INSERT INTO game_results
       (id, game_challenge_id, game_session_id, duel_participant_id, player_id,
        submission_scope, idempotency_key, result_hash, source_version, engine_version,
        started_at, finished_at, elapsed_milliseconds, elapsed_seconds, total_score,
        timed_out, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)`,
    [
      resultId, challenge.id, input.sessionId ?? null, input.duelParticipantId ?? null, input.playerId,
      input.submissionScope, input.idempotencyKey, result.resultHash, result.sourceVersion, result.engineVersion,
      new Date(result.startedAtMs), new Date(result.finishedAtMs), result.elapsedMilliseconds,
      result.elapsedSeconds, result.totalScore, result.timedOut, JSON.stringify(result)
    ]
  );
  const categoryIds = new Map(challenge.categories.map((category) => [category.slug, category.category_id]));
  for (const assignment of result.assignments) {
    const categoryId = categoryIds.get(assignment.categorySlug);
    if (!categoryId) throw new ContractError(500, 'data_invalid', 'Result category is not part of the published challenge');
    await db.query(
      `INSERT INTO game_result_assignments (game_result_id, ordinal, entity_id, category_id, score_value, timed_out)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [resultId, assignment.ordinal, assignment.entityId, categoryId, assignment.scoreValue, assignment.timedOut]
    );
    if (input.sessionId) {
      await db.query(
        `INSERT INTO game_session_assignments (game_session_id, ordinal, entity_id, category_id, score_value, timed_out)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [input.sessionId, assignment.ordinal, assignment.entityId, categoryId, assignment.scoreValue, assignment.timedOut]
      );
    }
  }
  return { status: 'accepted', resultId, result };
}

async function withTransaction<T>(db: ContractDatabase, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const output = await work(client);
    await client.query('COMMIT');
    return output;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function requireHeaderIdempotency(request: FastifyRequest): string {
  const value = request.headers['idempotency-key'];
  if (typeof value !== 'string' || value.length < 8 || value.length > 200) {
    throw new ContractError(400, 'idempotency_required', 'Idempotency-Key header is required');
  }
  return value;
}

function mapContractError(error: unknown): never {
  if (error instanceof ContractError) throw error;
  if (error instanceof GameRuleError) throw new ContractError(422, error.code, error.message, error.details);
  throw error;
}

export function registerGameContractRoutes(app: FastifyInstance, options: { db?: ContractDatabase; clock?: () => Date; runtimeMode?: RuntimeMode } = {}): void {
  const db = options.db ?? pool;
  const clock = options.clock ?? (() => new Date());
  const runtimeMode = options.runtimeMode ?? 'lab';
  const loadChallenge = (challengeId?: string, kind?: 'daily' | 'weekly' | 'duel') => loadPublishedChallenge(db, challengeId, kind, runtimeMode);

  app.get('/v1/challenges/daily', async (_request, reply) => {
    const challenge = await loadChallenge(undefined, 'daily');
    if (!challenge) return reply.code(404).send({ error: 'daily_challenge_not_found' });
    return { challenge: publicChallenge(challenge) };
  });

  app.get('/v1/challenges/:challengeId', async (request, reply) => {
    const params = z.object({ challengeId: z.string().min(1).max(200) }).parse(request.params);
    const challenge = await loadChallenge(params.challengeId);
    if (!challenge) return reply.code(404).send({ error: 'challenge_not_found' });
    return { challenge: publicChallenge(challenge) };
  });

  app.post('/v1/games', async (request, reply) => {
    const body = z.object({ challengeId: z.string().min(1).max(200) }).parse(request.body);
    const challenge = await loadChallenge(body.challengeId);
    if (!challenge) return reply.code(404).send({ error: 'challenge_not_found' });
    const user = await getCurrentUser(request);
    const startedAtMsValue = nowMs(clock);
    const session = await createGameSession(db, challenge, user?.id ?? null, startedAtMsValue);
    return reply.code(201).send({
      ...sessionResponse({ id: session.id, challengeId: challenge.id, status: 'active', startedAtMs: session.startedAtMs, deadlineAtMs: session.deadlineAtMs, currentOrdinal: 0 }, session.token),
      challenge: publicChallenge(session.challenge)
    });
  });

  app.post('/v1/games/:gameId/decision', async (request, reply) => {
    try {
      const params = z.object({ gameId: z.string().min(1).max(200) }).parse(request.params);
      const body = decisionRequestSchema.parse(request.body);
      const user = await getCurrentUser(request);
      const session = await getSession(db, params.gameId, body.sessionToken);
      if (!session) return reply.code(404).send({ error: 'game_session_not_found' });
      assertUserCanUseSession(session, user?.id ?? null);
      const baseChallenge = await loadPublishedChallenge(db, session.game_challenge_id, undefined, runtimeMode);
      if (!baseChallenge) return reply.code(409).send({ error: 'challenge_unavailable' });
      const challenge = storedVariantChallenge(baseChallenge, session);
      const state = replayDecisionState(challenge, session, body.previousAssignments);
      const next = submitDecision(challenge.engine, state, {
        ordinal: body.decision.ordinal,
        entityId: body.decision.entityId,
        categorySlug: body.decision.categorySlug
      }, nowMs(clock));
      const assignment = next.assignments[next.assignments.length - 1];
      if (!assignment) throw new ContractError(422, 'result_invalid', 'No se ha podido evaluar la jugada');
      const decision = challenge.engine.decisions[body.decision.ordinal];
      if (!decision) throw new ContractError(422, 'decision_order_invalid', 'La decisión no existe');
      const bestCategory = challenge.engine.categories
        .filter((category) => decision.scoreByCategory[category.slug] !== undefined)
        .sort((left, right) => (decision.scoreByCategory[left.slug] ?? challenge.scoreCap) - (decision.scoreByCategory[right.slug] ?? challenge.scoreCap))[0];
      const ranks = await db.query<{ slug: string; rank: number | string }>(
        `SELECT cd.slug, MIN(re.rank)::int AS rank
           FROM game_challenge_categories gcc
           JOIN category_definitions cd ON cd.id = gcc.category_id
           JOIN ranking_entries re ON re.snapshot_id = gcc.ranking_snapshot_id
           LEFT JOIN entity_identity_links link ON link.source_entity_id = re.entity_id
          WHERE gcc.game_challenge_id = $1
            AND COALESCE(link.canonical_entity_id, re.entity_id) = $2
          GROUP BY cd.slug`,
        [challenge.id, body.decision.entityId]
      );
      const rankBySlug = new Map(ranks.rows.map((row) => [row.slug, Number(row.rank)]));
      return {
        assignment: { ordinal: assignment.ordinal, entityId: assignment.entityId, categorySlug: assignment.categorySlug, scoreValue: assignment.scoreValue },
        selectedRank: rankBySlug.get(assignment.categorySlug) ?? null,
        bestCategorySlug: bestCategory?.slug ?? assignment.categorySlug,
        bestRank: bestCategory ? rankBySlug.get(bestCategory.slug) ?? null : null,
        complete: next.phase === 'finished'
      };
    } catch (error) {
      return mapContractError(error);
    }
  });

  app.post('/v1/games/:gameId/result', async (request, reply) => {
    try {
      const params = z.object({ gameId: z.string().min(1).max(200) }).parse(request.params);
      const body = z.object({ sessionToken: sessionTokenSchema, result: resultClaimsSchema }).parse(request.body);
      const user = await getCurrentUser(request);
      const session = await getSession(db, params.gameId, body.sessionToken);
      if (!session) return reply.code(404).send({ error: 'game_session_not_found' });
      assertUserCanUseSession(session, user?.id ?? null);
      const baseChallenge = await loadPublishedChallenge(db, session.game_challenge_id, undefined, runtimeMode);
      if (!baseChallenge) return reply.code(409).send({ error: 'challenge_unavailable' });
      const challenge = storedVariantChallenge(baseChallenge, session);
      const stored = await withTransaction(db, async (client) => {
        const lockedSession = await getSession(client, params.gameId, body.sessionToken, true);
        if (!lockedSession) throw new ContractError(404, 'game_session_not_found', 'Game session not found');
        assertUserCanUseSession(lockedSession, user?.id ?? null);
        const lockedChallenge = storedVariantChallenge(baseChallenge, lockedSession);
        const result = officialResultFromClaims(lockedChallenge, epoch(lockedSession.started_at), epoch(lockedSession.deadline_at), body.result, nowMs(clock));
        const persisted = await storeResult(client, challenge, result, {
          sessionId: lockedSession.id,
          playerId: user?.id ?? lockedSession.player_id,
          submissionScope: user ? `user:${user.id}` : `session:${lockedSession.id}`,
          idempotencyKey: requireHeaderIdempotency(request)
        });
        await client.query(
          `UPDATE game_sessions
              SET player_id = COALESCE(player_id, $2), status = $3, current_ordinal = $4,
                  state_version = state_version + 1, finished_at = $5, updated_at = NOW()
            WHERE id = $1`,
          [lockedSession.id, user?.id ?? null, result.timedOut ? 'expired' : 'completed', result.assignments.length, new Date(result.finishedAtMs)]
        );
        return persisted;
      });
      return resultResponse(stored.result, stored.resultId, stored.status, Boolean(user));
    } catch (error) {
      return mapContractError(error);
    }
  });

  app.post('/v1/games/:gameId/expire', async (request) => {
    try {
      const params = z.object({ gameId: z.string().min(1).max(200) }).parse(request.params);
      const body = z.object({ sessionToken: sessionTokenSchema, result: resultClaimsSchema.optional() }).parse(request.body);
      const user = await getCurrentUser(request);
      const stored = await withTransaction(db, async (client) => {
        const session = await getSession(client, params.gameId, body.sessionToken, true);
        if (!session) throw new ContractError(404, 'game_session_not_found', 'Game session not found');
        assertUserCanUseSession(session, user?.id ?? null);
        const baseChallenge = await loadPublishedChallenge(client, session.game_challenge_id, undefined, runtimeMode);
        if (!baseChallenge) throw new ContractError(409, 'challenge_unavailable', 'Challenge is unavailable');
        const challenge = storedVariantChallenge(baseChallenge, session);
        const existing = await existingResult(client, 'game_session_id', session.id);
        if (existing) return { status: 'duplicate' as const, resultId: existing.id, result: existing.payload };
        let result: GameResult;
        try {
          result = officialExpiredResultFromClaims(challenge, epoch(session.started_at), epoch(session.deadline_at), body.result, nowMs(clock));
        } catch (error) {
          if (error instanceof GameRuleError) throw new ContractError(409, error.code, error.message, error.details);
          throw error;
        }
        const persisted = await storeResult(client, challenge, result, {
          sessionId: session.id,
          playerId: user?.id ?? session.player_id,
          submissionScope: user ? `user:${user.id}` : `session:${session.id}`,
          idempotencyKey: `timeout-${session.id}`
        });
        await client.query(
          `UPDATE game_sessions SET player_id = COALESCE(player_id, $2), status = 'expired',
                  current_ordinal = $3, state_version = state_version + 1,
                  finished_at = $4, updated_at = NOW() WHERE id = $1`,
          [session.id, user?.id ?? null, result.assignments.length, new Date(result.finishedAtMs)]
        );
        return persisted;
      });
      return resultResponse(stored.result, stored.resultId, stored.status, Boolean(user));
    } catch (error) {
      return mapContractError(error);
    }
  });

  app.post('/v1/games/:gameId/replay', async (request, reply) => {
    const params = z.object({ gameId: z.string().min(1).max(200) }).parse(request.params);
    const body = z.object({ sessionToken: sessionTokenSchema }).parse(request.body);
    const user = await getCurrentUser(request);
    const oldSession = await getSession(db, params.gameId, body.sessionToken);
    if (!oldSession) return reply.code(404).send({ error: 'game_session_not_found' });
    assertUserCanUseSession(oldSession, user?.id ?? null);
    if (oldSession.status === 'active') return reply.code(409).send({ error: 'game_still_active' });
    const challenge = await loadPublishedChallenge(db, oldSession.game_challenge_id, undefined, runtimeMode);
    if (!challenge) return reply.code(409).send({ error: 'challenge_unavailable' });
    const session = await createGameSession(db, challenge, user?.id ?? oldSession.player_id, nowMs(clock), oldSession.id);
    return reply.code(201).send({
      ...sessionResponse({ id: session.id, challengeId: challenge.id, status: 'active', startedAtMs: session.startedAtMs, deadlineAtMs: session.deadlineAtMs, currentOrdinal: 0 }, session.token),
      challenge: publicChallenge(session.challenge)
    });
  });

  app.get('/v1/challenges/:challengeId/leaderboard', async (request, reply) => {
    const params = z.object({ challengeId: z.string().min(1).max(200) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(100) }).parse(request.query);
    const challenge = await loadPublishedChallenge(db, params.challengeId, undefined, runtimeMode);
    if (!challenge) return reply.code(404).send({ error: 'challenge_not_found' });
    const rows = await db.query(
      `WITH best_per_player AS (
         SELECT gr.*, ROW_NUMBER() OVER (
           PARTITION BY gr.player_id
           ORDER BY gr.total_score, gr.elapsed_milliseconds, gr.result_hash
         ) AS best_row
           FROM game_results gr
          WHERE gr.game_challenge_id = $1 AND gr.player_id IS NOT NULL
            AND gr.timed_out = FALSE AND gr.total_score < 250
       ), ranked AS (
         SELECT b.*, RANK() OVER (
           ORDER BY b.total_score, b.elapsed_milliseconds, b.result_hash
         ) AS rank
           FROM best_per_player b
          WHERE b.best_row = 1
       )
       SELECT r.rank, r.player_id, u.display_name, r.total_score, r.elapsed_milliseconds,
              r.elapsed_seconds, r.result_hash, r.timed_out, r.submitted_at
         FROM ranked r JOIN auth_users u ON u.id = r.player_id
        ORDER BY r.total_score, r.elapsed_milliseconds, r.result_hash
        LIMIT $2`,
      [challenge.id, query.limit]
    );
    return {
      challengeId: challenge.id,
      entries: rows.rows.map((row) => ({
        rank: Number(row.rank),
        playerId: row.player_id,
        displayName: row.display_name,
        totalScore: Number(row.total_score),
        elapsedMilliseconds: Number(row.elapsed_milliseconds),
        elapsedSeconds: Number(row.elapsed_seconds),
        resultHash: row.result_hash,
        timedOut: row.timed_out,
        submittedAt: row.submitted_at
      }))
    };
  });

  app.post('/v1/duels', async (request, reply) => {
    const body = z.object({ challengeId: z.string().min(1).max(200) }).parse(request.body);
    const challenge = await loadPublishedChallenge(db, body.challengeId, undefined, runtimeMode);
    if (!challenge) return reply.code(404).send({ error: 'challenge_not_found' });
    const user = await getCurrentUser(request);
    const startedAtMsValue = nowMs(clock);
    const participantToken = randomBytes(32).toString('base64url');
    const participantId = `dp_${randomUUID()}`;
    const duelId = `duel_${randomUUID()}`;
    const expiresAtMs = startedAtMsValue + 7 * 24 * 60 * 60 * 1000;
    let code = '';
    await withTransaction(db, async (client) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        code = randomBytes(8).toString('hex').toUpperCase();
        try {
          await client.query(
            `INSERT INTO duels (id, code, game_challenge_id, status, created_by_user_id, expires_at)
             VALUES ($1, $2, $3, 'open', $4, $5)`,
            [duelId, code, challenge.id, user?.id ?? null, new Date(expiresAtMs)]
          );
          break;
        } catch (error) {
          if ((error as { code?: string }).code !== '23505' || attempt === 4) throw error;
        }
      }
      await client.query(
        `INSERT INTO duel_participants
           (id, duel_id, slot, player_id, participant_token_hash, status, started_at, deadline_at)
         VALUES ($1, $2, 1, $3, $4, 'active', $5, $6)`,
        [participantId, duelId, user?.id ?? null, hashToken(participantToken), new Date(startedAtMsValue), new Date(startedAtMsValue + challenge.timeLimitSeconds * 1000)]
      );
    });
    return reply.code(201).send({
      duel: { id: duelId, code, status: 'open', challengeId: challenge.id, expiresAt: new Date(expiresAtMs).toISOString() },
      participantToken,
      joinUrl: `/v1/duels/${code}`
    });
  });

  app.get('/v1/duels/:code', async (request, reply) => {
    const params = z.object({ code: z.string().regex(/^[A-Za-z0-9]{8,20}$/) }).parse(request.params);
    await db.query(`UPDATE duels SET status = 'expired' WHERE code = $1 AND status IN ('open', 'active') AND expires_at <= NOW()`, [params.code.toUpperCase()]);
    await db.query(`UPDATE duel_participants SET status = 'expired' WHERE duel_id IN (SELECT id FROM duels WHERE code = $1 AND status = 'expired') AND status IN ('waiting', 'active')`, [params.code.toUpperCase()]);
    const duel = await db.query<{ id: string; code: string; status: string; game_challenge_id: string; expires_at: Date; created_at: Date }>(
      `SELECT id, code, status, game_challenge_id, expires_at, created_at FROM duels WHERE code = $1`,
      [params.code.toUpperCase()]
    );
    const row = duel.rows[0];
    if (!row) return reply.code(404).send({ error: 'duel_not_found' });
    const challenge = await loadPublishedChallenge(db, row.game_challenge_id, undefined, runtimeMode);
    if (!challenge) return reply.code(409).send({ error: 'challenge_unavailable' });
    const participants = await db.query(
      `SELECT dp.slot, dp.status, dp.joined_at,
              (gr.id IS NOT NULL) AS has_result, gr.total_score, gr.elapsed_seconds, gr.timed_out
         FROM duel_participants dp
         LEFT JOIN game_results gr ON gr.duel_participant_id = dp.id
        WHERE dp.duel_id = $1 ORDER BY dp.slot`,
      [row.id]
    );
    return {
      duel: {
        id: row.id,
        code: row.code,
        status: row.status,
        challengeId: row.game_challenge_id,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        joinable: row.status === 'open' && participants.rows.length < 2
      },
      challenge: publicChallenge(challenge),
      participants: participants.rows.map((participant) => ({
        slot: participant.slot,
        status: participant.status,
        joinedAt: participant.joined_at,
        hasResult: participant.has_result,
        totalScore: participant.total_score === null ? null : Number(participant.total_score),
        elapsedSeconds: participant.elapsed_seconds === null ? null : Number(participant.elapsed_seconds),
        timedOut: participant.timed_out ?? null
      }))
    };
  });

  app.post('/v1/duels/:code/join', async (request, reply) => {
    const params = z.object({ code: z.string().regex(/^[A-Za-z0-9]{8,20}$/) }).parse(request.params);
    const user = await getCurrentUser(request);
    const participantToken = randomBytes(32).toString('base64url');
    const participantId = `dp_${randomUUID()}`;
    const joinedAtMsValue = nowMs(clock);
    const output = await withTransaction(db, async (client) => {
      const duel = await client.query<{ id: string; status: string; game_challenge_id: string; expires_at: Date }>(
        `SELECT id, status, game_challenge_id, expires_at FROM duels WHERE code = $1 FOR UPDATE`,
        [params.code.toUpperCase()]
      );
      const row = duel.rows[0];
      if (!row) throw new ContractError(404, 'duel_not_found', 'Duel not found');
      if (row.status === 'open' && row.expires_at.getTime() <= joinedAtMsValue) {
        await client.query(`UPDATE duels SET status = 'expired' WHERE id = $1`, [row.id]);
        throw new ContractError(410, 'duel_expired', 'Duel has expired');
      }
      if (row.status !== 'open') throw new ContractError(409, 'duel_not_joinable', 'Duel is not joinable');
      const slots = await client.query<{ slot: number; player_id: string | null }>(`SELECT slot, player_id FROM duel_participants WHERE duel_id = $1`, [row.id]);
      if (slots.rows.length >= 2) throw new ContractError(409, 'duel_full', 'Duel already has two participants');
      if (user && slots.rows.some((slot) => slot.player_id === user.id)) throw new ContractError(409, 'duel_participant_exists', 'Player is already in this duel');
      const challenge = await loadPublishedChallenge(client, row.game_challenge_id, undefined, runtimeMode);
      if (!challenge) throw new ContractError(409, 'challenge_unavailable', 'Challenge is unavailable');
      await client.query(
        `INSERT INTO duel_participants
           (id, duel_id, slot, player_id, participant_token_hash, status, started_at, deadline_at)
         VALUES ($1, $2, 2, $3, $4, 'active', $5, $6)`,
        [participantId, row.id, user?.id ?? null, hashToken(participantToken), new Date(joinedAtMsValue), new Date(joinedAtMsValue + challenge.timeLimitSeconds * 1000)]
      );
      await client.query(`UPDATE duels SET status = 'active' WHERE id = $1`, [row.id]);
      return { duelId: row.id, challengeId: row.game_challenge_id };
    });
    return reply.code(201).send({ duelId: output.duelId, challengeId: output.challengeId, participantToken });
  });

  app.post('/v1/duels/:code/result', async (request) => {
    try {
      const params = z.object({ code: z.string().regex(/^[A-Za-z0-9]{8,20}$/) }).parse(request.params);
      const body = z.object({ participantToken: sessionTokenSchema, result: resultClaimsSchema }).parse(request.body);
      const user = await getCurrentUser(request);
      const serverNowMs = nowMs(clock);
      const stored = await withTransaction(db, async (client) => {
        const participant = await client.query<{
          id: string; duel_id: string; player_id: string | null; status: string; started_at: Date; deadline_at: Date;
          game_challenge_id: string; duel_status: string; expires_at: Date;
        }>(
          `SELECT dp.id, dp.duel_id, dp.player_id, dp.status, dp.started_at, dp.deadline_at,
                  d.game_challenge_id, d.status AS duel_status, d.expires_at
             FROM duel_participants dp JOIN duels d ON d.id = dp.duel_id
            WHERE d.code = $1 AND dp.participant_token_hash = $2
            FOR UPDATE OF dp`,
          [params.code.toUpperCase(), hashToken(body.participantToken)]
        );
        const row = participant.rows[0];
        if (!row) throw new ContractError(404, 'duel_participant_not_found', 'Duel participant not found');
        if (row.player_id && row.player_id !== (user?.id ?? null)) throw new ContractError(403, 'duel_forbidden', 'This participant belongs to another player');
        const alreadyStored = await existingResult(client, 'duel_participant_id', row.id);
        if (alreadyStored) return { duelId: row.duel_id, status: 'duplicate' as const, resultId: alreadyStored.id, result: alreadyStored.payload };
        if (row.duel_status === 'expired' || row.expires_at.getTime() <= serverNowMs) throw new ContractError(410, 'duel_expired', 'Duel has expired');
        const challenge = await loadPublishedChallenge(client, row.game_challenge_id, undefined, runtimeMode);
        if (!challenge) throw new ContractError(409, 'challenge_unavailable', 'Challenge is unavailable');
        const result = officialResultFromClaims(challenge, epoch(row.started_at), epoch(row.deadline_at), body.result, serverNowMs);
        const persisted = await storeResult(client, challenge, result, {
          duelParticipantId: row.id,
          playerId: user?.id ?? row.player_id,
          submissionScope: `participant:${row.id}`,
          idempotencyKey: requireHeaderIdempotency(request)
        });
        await client.query(`UPDATE duel_participants SET player_id = COALESCE(player_id, $2), status = $3 WHERE id = $1`, [row.id, user?.id ?? null, result.timedOut ? 'expired' : 'completed']);
        const resultCount = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM game_results WHERE game_challenge_id = $1 AND duel_participant_id IN (SELECT id FROM duel_participants WHERE duel_id = $2)`, [row.game_challenge_id, row.duel_id]);
        if (Number(resultCount.rows[0]?.count ?? 0) >= 2) await client.query(`UPDATE duels SET status = 'completed', completed_at = NOW() WHERE id = $1`, [row.duel_id]);
        return { ...persisted, duelId: row.duel_id };
      });
      return { duelId: stored.duelId, ...resultResponse(stored.result, stored.resultId, stored.status, Boolean(user)) };
    } catch (error) {
      return mapContractError(error);
    }
  });

  app.post('/v1/duels/:code/replay', async (request, reply) => {
    const params = z.object({ code: z.string().regex(/^[A-Za-z0-9]{8,20}$/) }).parse(request.params);
    const body = z.object({ participantToken: sessionTokenSchema }).parse(request.body);
    const user = await getCurrentUser(request);
    const old = await db.query<{ duel_id: string; game_challenge_id: string; status: string; participant_player_id: string | null }>(
      `SELECT d.id AS duel_id, d.game_challenge_id, d.status, dp.player_id AS participant_player_id
         FROM duels d JOIN duel_participants dp ON dp.duel_id = d.id
        WHERE d.code = $1 AND dp.participant_token_hash = $2`,
      [params.code.toUpperCase(), hashToken(body.participantToken)]
    );
    const oldRow = old.rows[0];
    if (!oldRow) return reply.code(404).send({ error: 'duel_participant_not_found' });
    if (oldRow.participant_player_id && oldRow.participant_player_id !== (user?.id ?? null)) return reply.code(403).send({ error: 'duel_forbidden' });
    if (!['completed', 'expired'].includes(oldRow.status)) return reply.code(409).send({ error: 'duel_still_active' });
    const challenge = await loadPublishedChallenge(db, oldRow.game_challenge_id, undefined, runtimeMode);
    if (!challenge) return reply.code(409).send({ error: 'challenge_unavailable' });
    const startedAtMsValue = nowMs(clock);
    const newDuelId = `duel_${randomUUID()}`;
    const newCode = randomBytes(8).toString('hex').toUpperCase();
    const token = randomBytes(32).toString('base64url');
    await withTransaction(db, async (client) => {
      await client.query(
        `INSERT INTO duels (id, code, game_challenge_id, status, created_by_user_id, replay_of_duel_id, expires_at)
         VALUES ($1, $2, $3, 'open', $4, $5, $6)`,
        [newDuelId, newCode, challenge.id, user?.id ?? null, oldRow.duel_id, new Date(startedAtMsValue + 7 * 24 * 60 * 60 * 1000)]
      );
      await client.query(
        `INSERT INTO duel_participants (id, duel_id, slot, player_id, participant_token_hash, status, started_at, deadline_at)
         VALUES ($1, $2, 1, $3, $4, 'active', $5, $6)`,
        [`dp_${randomUUID()}`, newDuelId, user?.id ?? oldRow.participant_player_id, hashToken(token), new Date(startedAtMsValue), new Date(startedAtMsValue + challenge.timeLimitSeconds * 1000)]
      );
    });
    return reply.code(201).send({ duel: { id: newDuelId, code: newCode, status: 'open', challengeId: challenge.id }, participantToken: token, joinUrl: `/v1/duels/${newCode}` });
  });
}
