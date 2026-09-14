import { pool, closeDb } from './db.js';
import { config } from './config.js';
import { calculateChallengeSha256 } from './game-contract.js';
import { GAME_ENGINE_VERSION } from './game-engine.js';

const challengeId = 'integration-daily-v1';
const categoryA = { id: 'integration-category-goals', slug: 'integration-test-goals', snapshotId: 'integration-snapshot-goals' };
const categoryB = { id: 'integration-category-assists', slug: 'integration-test-assists', snapshotId: 'integration-snapshot-assists' };
const entityA = 'integration-entity-a';
const entityB = 'integration-entity-b';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('--date debe tener formato YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('--date no es una fecha válida');
  return value;
}

async function seed(): Promise<void> {
  if (config.nodeEnv === 'production') throw new Error('El reto de integración solo puede sembrarse fuera de production');
  const date = isoDate(argument('--date') ?? new Date().toISOString().slice(0, 10));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const collision = await client.query<{ id: string }>(
      `SELECT id FROM game_challenges
        WHERE challenge_kind = 'daily' AND challenge_date = $1 AND status = 'published' AND id <> $2`,
      [date, challengeId]
    );
    if (collision.rows[0]) throw new Error(`Ya existe otro reto diario publicado para ${date}: ${collision.rows[0].id}`);

    const existing = await client.query<{ status: string }>('SELECT status FROM game_challenges WHERE id = $1 FOR UPDATE', [challengeId]);
    if (existing.rows[0]?.status === 'published') throw new Error('El fixture de integración ya está publicado; no se modifica por seguridad');

    await client.query(
      `INSERT INTO category_definitions
         (id, slug, label_es, label_en, entity_type, metric_key, scope_kind, scope,
          ranking_direction, tie_policy, score_cap, definition_md, status)
       VALUES
         ($1, $2, 'Goles integración', 'Integration goals', 'player', 'goals', 'integration', '{}', 'desc', 'competition', 100, 'Fixture sintética exclusiva de integración.', 'draft'),
         ($3, $4, 'Asistencias integración', 'Integration assists', 'player', 'assists', 'integration', '{}', 'desc', 'competition', 100, 'Fixture sintética exclusiva de integración.', 'draft')
       ON CONFLICT (id) DO UPDATE SET status = 'draft', label_es = EXCLUDED.label_es, label_en = EXCLUDED.label_en`,
      [categoryA.id, categoryA.slug, categoryB.id, categoryB.slug]
    );
    await client.query(
      `INSERT INTO entities (id, entity_type, canonical_name, short_name, catalog_status)
       VALUES ($1, 'player', 'Integration Player A', 'IPA', 'active'),
              ($2, 'player', 'Integration Player B', 'IPB', 'active')
       ON CONFLICT (id) DO UPDATE SET catalog_status = 'active', canonical_name = EXCLUDED.canonical_name, short_name = EXCLUDED.short_name`,
      [entityA, entityB]
    );
    await client.query(
      `INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
       VALUES ($1, 'modern', TRUE, 'integration fixture', '{"fixture":true}'::jsonb),
              ($2, 'modern', TRUE, 'integration fixture', '{"fixture":true}'::jsonb)
       ON CONFLICT (entity_id) DO UPDATE SET playable_default = TRUE, reason = EXCLUDED.reason, metadata = EXCLUDED.metadata`,
      [entityA, entityB]
    );
    await client.query(
      `INSERT INTO ranking_snapshots
         (id, category_id, data_version, algorithm_version, content_sha256, status, coverage_complete, eligible_count, metadata)
       VALUES
         ($1, $3, 'integration-v1', 'ranking-v1', $5, 'draft', TRUE, 2, '{"fixture":true}'::jsonb),
         ($2, $4, 'integration-v1', 'ranking-v1', $6, 'draft', TRUE, 2, '{"fixture":true}'::jsonb)
       ON CONFLICT (id) DO UPDATE SET status = 'draft', coverage_complete = TRUE, eligible_count = 2`,
      [categoryA.snapshotId, categoryB.snapshotId, categoryA.id, categoryB.id, '1'.repeat(64), '2'.repeat(64)]
    );
    await client.query(
      `INSERT INTO ranking_entries (snapshot_id, entity_id, raw_value, rank, score_value, tie_group, evidence)
       VALUES
         ($1, $3, 100, 1, 1, 1, '{"fixture":true}'::jsonb),
         ($1, $4, 20, 2, 2, 2, '{"fixture":true}'::jsonb),
         ($2, $3, 10, 1, 1, 1, '{"fixture":true}'::jsonb),
         ($2, $4, 80, 2, 2, 2, '{"fixture":true}'::jsonb)
       ON CONFLICT (snapshot_id, entity_id) DO UPDATE SET raw_value = EXCLUDED.raw_value, rank = EXCLUDED.rank, score_value = EXCLUDED.score_value, tie_group = EXCLUDED.tie_group, evidence = EXCLUDED.evidence`,
      [categoryA.snapshotId, categoryB.snapshotId, entityA, entityB]
    );
    await client.query(
      `INSERT INTO game_challenges
         (id, challenge_kind, challenge_date, status, source_version, engine_version,
          time_limit_seconds, score_cap, challenge_sha256, published_at, metadata)
         VALUES ($1, 'daily', $2, 'draft', 'integration-v1', $4, 120, 100, $3, NULL, '{"fixture":true,"integrationOnly":true}'::jsonb)
       ON CONFLICT (id) DO UPDATE SET challenge_date = EXCLUDED.challenge_date, status = 'draft', published_at = NULL,
         source_version = EXCLUDED.source_version, engine_version = EXCLUDED.engine_version,
         challenge_sha256 = EXCLUDED.challenge_sha256, metadata = EXCLUDED.metadata`,
      [challengeId, date, '3'.repeat(64), GAME_ENGINE_VERSION]
    );
    await client.query('DELETE FROM game_challenge_answers WHERE game_challenge_id = $1', [challengeId]);
    await client.query('DELETE FROM game_challenge_decisions WHERE game_challenge_id = $1', [challengeId]);
    await client.query('DELETE FROM game_challenge_categories WHERE game_challenge_id = $1', [challengeId]);
    await client.query(
      `INSERT INTO game_challenge_categories (game_challenge_id, category_id, category_ordinal, ranking_snapshot_id)
       VALUES ($1, $2, 0, $4), ($1, $3, 1, $5)`,
      [challengeId, categoryA.id, categoryB.id, categoryA.snapshotId, categoryB.snapshotId]
    );
    await client.query(
      `INSERT INTO game_challenge_decisions (game_challenge_id, decision_ordinal, entity_id)
       VALUES ($1, 0, $2), ($1, 1, $3)`,
      [challengeId, entityA, entityB]
    );
    await client.query(
      `INSERT INTO game_challenge_answers (game_challenge_id, decision_ordinal, category_id, score_value)
       VALUES ($1, 0, $2, 1), ($1, 0, $3, 20), ($1, 1, $2, 10), ($1, 1, $3, 2)`,
      [challengeId, categoryA.id, categoryB.id]
    );
    const challengeSha256 = calculateChallengeSha256({
      id: challengeId,
      kind: 'daily',
      challengeDate: date,
      sourceVersion: 'integration-v1',
      engineVersion: GAME_ENGINE_VERSION,
      timeLimitSeconds: 120,
      scoreCap: 100,
      categories: [
        { ordinal: 0, categoryId: categoryA.id, rankingSnapshotId: categoryA.snapshotId, slug: categoryA.slug, entityType: 'player' },
        { ordinal: 1, categoryId: categoryB.id, rankingSnapshotId: categoryB.snapshotId, slug: categoryB.slug, entityType: 'player' }
      ],
      decisions: [
        { ordinal: 0, entityId: entityA, entityType: 'player' },
        { ordinal: 1, entityId: entityB, entityType: 'player' }
      ],
      answers: [
        { decisionOrdinal: 0, categoryId: categoryA.id, scoreValue: 1 },
        { decisionOrdinal: 0, categoryId: categoryB.id, scoreValue: 20 },
        { decisionOrdinal: 1, categoryId: categoryA.id, scoreValue: 10 },
        { decisionOrdinal: 1, categoryId: categoryB.id, scoreValue: 2 }
      ]
    });
    await client.query(`UPDATE game_challenges SET challenge_sha256 = $2 WHERE id = $1`, [challengeId, challengeSha256]);
    await client.query('COMMIT');
    console.log(JSON.stringify({ challengeId, status: 'draft', date, fixture: true, integrationOnly: true, note: 'No se publica ningún fixture sintético' }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

await seed().finally(() => closeDb());
