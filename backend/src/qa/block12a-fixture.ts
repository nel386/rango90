import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { calculateChallengeSha256 } from '../game-contract.js';
import { GAME_ENGINE_VERSION } from '../game-engine.js';

const { Pool } = pg;
const runId = (process.env.BLOCK12_QA_RUN_ID ?? randomUUID().replaceAll('-', '').slice(0, 12)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'local';
const prefix = `block12-qa-${runId}`;
const challengeId = `${prefix}-challenge`;
const categoryIds = Array.from({ length: 7 }, (_, index) => `${prefix}-category-${index}`);
const snapshotIds = Array.from({ length: 7 }, (_, index) => `${prefix}-snapshot-${index}`);
const entityIds = Array.from({ length: 8 }, (_, index) => `${prefix}-entity-${index}`);
const categorySlugs = Array.from({ length: 7 }, (_, index) => `${prefix}-category-slug-${index}`);

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required for the Block 12A fixture');
  if (process.env.NODE_ENV === 'production') throw new Error('Block 12A fixture cannot run in production');
  const parsed = new URL(value);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('Block 12A fixture only accepts a localhost PostgreSQL URL');
  }
  if (!parsed.pathname.includes('rango90_qa')) {
    throw new Error('Block 12A fixture requires a database name containing rango90_qa');
  }
  return value;
}

function score(entityIndex: number, categoryIndex: number): number {
  return ((entityIndex + categoryIndex) % 7) + 1;
}

function challengeData() {
  const categories = categoryIds.map((categoryId, ordinal) => ({
    ordinal,
    categoryId,
    rankingSnapshotId: snapshotIds[ordinal]!,
    slug: categorySlugs[ordinal]!,
    entityType: 'player' as const
  }));
  const decisions = entityIds.slice(0, 7).map((entityId, ordinal) => ({ ordinal, entityId, entityType: 'player' as const }));
  const answers = decisions.flatMap((decision) => categories.map((category) => ({
    decisionOrdinal: decision.ordinal,
    categoryId: category.categoryId,
    scoreValue: score(decision.ordinal, category.ordinal)
  })));
  return { categories, decisions, answers };
}

async function withDatabase<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: databaseUrl(), max: 2, connectionTimeoutMillis: 5_000 });
  const client = await pool.connect();
  try {
    return await work(client);
  } finally {
    client.release();
    await pool.end();
  }
}

async function seed(): Promise<void> {
  await withDatabase(async (client) => {
    const createdAt = new Date('2026-09-17T12:00:00.000Z');
    const data = challengeData();
    await client.query('BEGIN');
    try {
      for (let index = 0; index < 7; index += 1) {
        await client.query(
          `INSERT INTO category_definitions
             (id, slug, label_es, label_en, entity_type, metric_key, scope_kind, scope,
              ranking_direction, tie_policy, score_cap, definition_md, status)
           VALUES ($1, $2, $3, $4, 'player', 'goals', 'block12a-fixture', $5::jsonb,
                   'asc', 'competition', 100, 'Fixture sintética efímera de QA. No es una fuente oficial.', 'draft')`,
          [categoryIds[index], categorySlugs[index], `QA categoría ${index + 1}`, `QA category ${index + 1}`, JSON.stringify({ fixture: true, block: '12A' })]
        );
        await client.query(
          `INSERT INTO ranking_snapshots
             (id, category_id, data_version, algorithm_version, content_sha256, generated_at,
              status, coverage_complete, eligible_count, unresolved_conflicts, metadata)
           VALUES ($1, $2, 'block12a-fixture-v1', 'qa-fixture-v1', $3, $4, 'draft', TRUE, 8, 0, $5::jsonb)`,
          [snapshotIds[index], categoryIds[index], `${String(index + 1).repeat(64)}`, createdAt, JSON.stringify({ fixture: true, block: '12A' })]
        );
      }

      for (let index = 0; index < 8; index += 1) {
        const playable = index < 7;
        await client.query(
          `INSERT INTO entities (id, entity_type, canonical_name, short_name, catalog_status)
           VALUES ($1, 'player', $2, $3, 'active')`,
          [entityIds[index], playable ? `QA Player ${index}` : 'QA Historical Ranking Only', playable ? `Q${index}` : 'HRO']
        );
        await client.query(
          `INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [entityIds[index], playable ? 'modern' : 'classic_legacy', playable, playable ? 'Block 12A playable fixture' : 'Block 12A historical ranking-only fixture', JSON.stringify({ fixture: true, block: '12A' })]
        );
        for (let categoryIndex = 0; categoryIndex < 7; categoryIndex += 1) {
          const rank = playable ? score(index, categoryIndex) : 8;
          await client.query(
            `INSERT INTO ranking_entries (snapshot_id, entity_id, raw_value, rank, score_value, tie_group, evidence)
             VALUES ($1, $2, $3, $4, $4, $4, $5::jsonb)`,
            [snapshotIds[categoryIndex], entityIds[index], 100 - rank, rank, JSON.stringify({ fixture: true, block: '12A' })]
          );
        }
      }

      const challengeSha256 = calculateChallengeSha256({
        id: challengeId,
        kind: 'daily',
        challengeDate: '2099-12-31',
        sourceVersion: 'block12a-fixture-v1',
        engineVersion: GAME_ENGINE_VERSION,
        timeLimitSeconds: 20,
        scoreCap: 100,
        categories: data.categories,
        decisions: data.decisions,
        answers: data.answers
      });
      await client.query(
        `INSERT INTO game_challenges
           (id, challenge_kind, challenge_date, status, source_version, engine_version,
            time_limit_seconds, score_cap, challenge_sha256, metadata)
         VALUES ($1, 'daily', '2099-12-31', 'draft', 'block12a-fixture-v1', $2, 20, 100, $3, $4::jsonb)`,
        [challengeId, GAME_ENGINE_VERSION, challengeSha256, JSON.stringify({ fixture: true, block: '12A', testOnly: true, noOfficialPublication: true })]
      );
      for (const category of data.categories) {
        await client.query(
          `INSERT INTO game_challenge_categories (game_challenge_id, category_id, category_ordinal, ranking_snapshot_id)
           VALUES ($1, $2, $3, $4)`,
          [challengeId, category.categoryId, category.ordinal, category.rankingSnapshotId]
        );
      }
      for (const decision of data.decisions) {
        await client.query(
          `INSERT INTO game_challenge_decisions (game_challenge_id, decision_ordinal, entity_id)
           VALUES ($1, $2, $3)`,
          [challengeId, decision.ordinal, decision.entityId]
        );
      }
      for (const answer of data.answers) {
        await client.query(
          `INSERT INTO game_challenge_answers (game_challenge_id, decision_ordinal, category_id, score_value)
           VALUES ($1, $2, $3, $4)`,
          [challengeId, answer.decisionOrdinal, answer.categoryId, answer.scoreValue]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
  console.log(JSON.stringify({ status: 'passed', fixture: 'block12a-lab', challengeId, categorySlugs, playableEntityCount: 7, historicalRankingOnlyEntityCount: 1, officialPublication: 'blocked' }, null, 2));
}

async function cleanup(): Promise<void> {
  await withDatabase(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`DELETE FROM game_result_assignments WHERE game_result_id IN (SELECT id FROM game_results WHERE game_challenge_id = $1)`, [challengeId]);
      await client.query(`DELETE FROM game_results WHERE game_challenge_id = $1`, [challengeId]);
      await client.query(`DELETE FROM game_sessions WHERE game_challenge_id = $1`, [challengeId]);
      await client.query(`DELETE FROM game_challenge_answers WHERE game_challenge_id = $1`, [challengeId]);
      await client.query(`DELETE FROM game_challenge_decisions WHERE game_challenge_id = $1`, [challengeId]);
      await client.query(`DELETE FROM game_challenge_categories WHERE game_challenge_id = $1`, [challengeId]);
      await client.query(`DELETE FROM game_challenges WHERE id = $1`, [challengeId]);
      await client.query(`DELETE FROM ranking_entries WHERE snapshot_id = ANY($1::text[])`, [snapshotIds]);
      await client.query(`DELETE FROM ranking_snapshots WHERE id = ANY($1::text[])`, [snapshotIds]);
      await client.query(`DELETE FROM entity_game_profiles WHERE entity_id = ANY($1::text[])`, [entityIds]);
      await client.query(`DELETE FROM category_definitions WHERE id = ANY($1::text[])`, [categoryIds]);
      await client.query(`DELETE FROM entities WHERE id = ANY($1::text[])`, [entityIds]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  });
  console.log(JSON.stringify({ status: 'passed', fixture: 'block12a-lab', action: 'cleanup', challengeId }, null, 2));
}

const action = process.argv[2] ?? 'seed';
if (action === 'seed') await seed();
else if (action === 'cleanup') await cleanup();
else throw new Error(`Unknown Block 12A fixture action: ${action}`);
