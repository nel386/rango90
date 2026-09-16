import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../app.js';
import { calculateChallengeSha256, type ContractDatabase } from '../game-contract.js';
import { GAME_ENGINE_VERSION } from '../game-engine.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
const fixtureEnabled = process.env.RANGO90_BLOCK6_OFFICIAL_FIXTURE === '1';

if (!isolatedUrl || !fixtureEnabled) {
  console.log(JSON.stringify({
    status: 'integration_pending',
    integration: 'block6-official-fixture',
    reason: !isolatedUrl ? 'RANGO90_ISOLATED_DATABASE_URL_missing' : 'RANGO90_BLOCK6_OFFICIAL_FIXTURE_not_enabled'
  }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) {
  throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const challengeId = `block6-official-${suffix}`;
const invalidChallengeId = `block6-invalid-${suffix}`;
const categoryIds = Array.from({ length: 7 }, (_, index) => `block6-category-${suffix}-${index}`);
const snapshotIds = Array.from({ length: 7 }, (_, index) => `block6-snapshot-${suffix}-${index}`);
const sourceKeys = Array.from({ length: 7 }, (_, index) => `block6-source-${suffix}-${index}`);
const sourceSnapshotIds = Array.from({ length: 7 }, (_, index) => `block6-source-snapshot-${suffix}-${index}`);
const entityIds = Array.from({ length: 7 }, (_, index) => `block6-entity-${suffix}-${index}`);
const imageIds = Array.from({ length: 7 }, (_, index) => `block6-image-${suffix}-${index}`);
const slugs = Array.from({ length: 7 }, (_, index) => `block6-official-category-${suffix}-${index}`);

const { Pool } = pg;
const database = new Pool({ connectionString: isolatedUrl, max: 2, connectionTimeoutMillis: 5_000 });
await database.query('SELECT 1');

function challengeData() {
  const categories = categoryIds.map((categoryId, ordinal) => ({
    ordinal,
    categoryId,
    rankingSnapshotId: snapshotIds[ordinal]!,
    slug: slugs[ordinal]!,
    entityType: 'player' as const
  }));
  const decisions = entityIds.map((entityId, ordinal) => ({ ordinal, entityId, entityType: 'player' as const }));
  const answers = decisions.flatMap((decision) => categories.map((category) => ({
    decisionOrdinal: decision.ordinal,
    categoryId: category.categoryId,
    scoreValue: decision.ordinal + 1
  })));
  return { categories, decisions, answers };
}

async function setup(): Promise<void> {
  const client = await database.connect();
  const createdAt = new Date('2026-09-16T12:00:00.000Z');
  try {
    await client.query('BEGIN');
    for (let index = 0; index < 7; index += 1) {
      const evidenceUrl = `https://example.com/block6/${sourceKeys[index]}`;
      await client.query(
        `INSERT INTO sources
           (key, name, source_type, base_url, rights_status, rights_basis, commercial_use,
            rights_evidence_url, rights_verified_at, rights_verified_by, rights_usage_scope, rights_notes)
         VALUES ($1, $2, 'official', 'https://example.com/block6', 'review_required', 'open_license', TRUE,
                 $3, $4, 'block6-qa', '["web","pwa","android","local_storage"]'::jsonb, 'Synthetic isolated QA evidence')`,
        [sourceKeys[index], `Block6 synthetic source ${index}`, evidenceUrl, createdAt]
      );
      await client.query(
        `INSERT INTO source_rights_reviews
           (id, source_key, decision, rights_basis, commercial_use, evidence_url, reviewer, usage_scope, notes)
         VALUES ($1, $2, 'approved', 'open_license', TRUE, $3, 'block6-qa',
                 '["web","pwa","android","local_storage"]'::jsonb, 'Synthetic isolated QA fixture')`,
        [`block6-rights-review-${suffix}-${index}`, sourceKeys[index], evidenceUrl]
      );
      await client.query(
        `UPDATE sources
            SET rights_status = 'approved'
          WHERE key = $1`,
        [sourceKeys[index]]
      );
      await client.query(
        `INSERT INTO source_snapshots
           (id, source_key, retrieved_at, content_type, content_sha256, metadata)
         VALUES ($1, $2, $3, 'application/json', $4, $5::jsonb)`,
        [sourceSnapshotIds[index], sourceKeys[index], createdAt, `${String(index).repeat(64)}`, JSON.stringify({ fixture: true, run: suffix })]
      );
      await client.query(
        `INSERT INTO category_definitions
           (id, slug, label_es, label_en, entity_type, metric_key, scope_kind, scope,
            ranking_direction, tie_policy, score_cap, definition_md, status)
         VALUES ($1, $2, $3, $4, 'player', 'goals', 'fixture', $5::jsonb, 'desc', 'competition', 100,
                 'Synthetic isolated category for Block 6 QA.', 'approved')`,
        [categoryIds[index], slugs[index], `Fixture ${index}`, `Fixture ${index}`, JSON.stringify({ fixture: true, imagesRequired: false })]
      );
      await client.query(
        `INSERT INTO ranking_snapshots
           (id, category_id, data_version, algorithm_version, content_sha256, generated_at, status,
            coverage_complete, eligible_count, unresolved_conflicts, metadata)
         VALUES ($1, $2, 'block6-fixture-v1', 'ranking-v1', $3, $4, 'draft', TRUE, 7, 0, $5::jsonb)`,
        [snapshotIds[index], categoryIds[index], `${String(index + 1).repeat(64)}`, createdAt, JSON.stringify({ fixture: true, sourceSnapshotId: sourceSnapshotIds[index], imagesRequired: false })]
      );
    }
    for (let index = 0; index < 7; index += 1) {
      await client.query(
        `INSERT INTO entities (id, entity_type, canonical_name, short_name, catalog_status)
         VALUES ($1, 'player', $2, $3, 'active')`,
        [entityIds[index], `Block6 Player ${index}`, `B6P${index}`]
      );
      await client.query(
        `INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason, metadata)
         VALUES ($1, 'modern', TRUE, 'Block6 isolated QA fixture', '{"fixture":true}'::jsonb)`,
        [entityIds[index]]
      );
      await client.query(
        `INSERT INTO image_assets
           (id, entity_id, asset_kind, source_url, provider, license_name, license_url, width, height,
            mime_type, sha256, is_primary, review_status, usage_scope, rights_basis, commercial_use,
            rights_evidence_url, rights_verified_at, rights_verified_by, rights_notes, trademark_status, metadata)
         VALUES ($1, $2, 'portrait', $3, 'block6-synthetic', 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/',
                 1, 1, 'image/png', $4, TRUE, 'approved', '["web","pwa","android","local_storage"]'::jsonb,
                 'public_domain', TRUE, $5, $6, 'block6-qa', 'Synthetic isolated QA fixture', 'not_applicable', '{"fixture":true}'::jsonb)`,
        [imageIds[index], entityIds[index], `https://example.com/block6/${imageIds[index]}.png`, `${String(index + 1).repeat(64)}`, `https://example.com/block6/${imageIds[index]}`, createdAt]
      );
      for (let categoryIndex = 0; categoryIndex < 7; categoryIndex += 1) {
        const rank = index + 1;
        await client.query(
          `INSERT INTO ranking_entries
             (snapshot_id, entity_id, raw_value, rank, score_value, tie_group, evidence)
           VALUES ($1, $2, $3, $4, $4, $4, '{"fixture":true}'::jsonb)`,
          [snapshotIds[categoryIndex], entityIds[index], 100 - index, rank]
        );
      }
    }
    await client.query(
      `INSERT INTO game_challenges
         (id, challenge_kind, challenge_date, status, source_version, engine_version,
          time_limit_seconds, score_cap, challenge_sha256, published_at, metadata)
       VALUES ($1, 'daily', '2099-01-01', 'draft', 'block6-fixture-v1', $2, 120, 100, $3, NULL, '{"fixture":true,"testOnly":false}'::jsonb),
              ($4, 'daily', '2099-01-02', 'draft', 'block6-fixture-v1', $2, 120, 100, $5, NULL, '{"fixture":true,"testOnly":false}'::jsonb)`,
      [challengeId, GAME_ENGINE_VERSION, '0'.repeat(64), invalidChallengeId, 'f'.repeat(64)]
    );
    const data = challengeData();
    for (const category of data.categories) {
      await client.query(
        `INSERT INTO game_challenge_categories (game_challenge_id, category_id, category_ordinal, ranking_snapshot_id)
         VALUES ($1, $2, $3, $4)`,
        [challengeId, category.categoryId, category.ordinal, category.rankingSnapshotId]
      );
      await client.query(
        `INSERT INTO game_challenge_categories (game_challenge_id, category_id, category_ordinal, ranking_snapshot_id)
         VALUES ($1, $2, $3, $4)`,
        [invalidChallengeId, category.categoryId, category.ordinal, category.rankingSnapshotId]
      );
    }
    for (const decision of data.decisions) {
      await client.query(
        `INSERT INTO game_challenge_decisions (game_challenge_id, decision_ordinal, entity_id)
         VALUES ($1, $2, $3), ($4, $2, $3)`,
        [challengeId, decision.ordinal, decision.entityId, invalidChallengeId]
      );
    }
    await client.query(`UPDATE ranking_snapshots SET status = 'published' WHERE id = ANY($1::text[])`, [snapshotIds]);
    for (const answer of data.answers) {
      await client.query(
        `INSERT INTO game_challenge_answers (game_challenge_id, decision_ordinal, category_id, score_value)
         VALUES ($1, $2, $3, $4)`,
        [challengeId, answer.decisionOrdinal, answer.categoryId, answer.scoreValue]
      );
    }
    const hash = calculateChallengeSha256({
      id: challengeId,
      kind: 'daily',
      challengeDate: '2099-01-01',
      sourceVersion: 'block6-fixture-v1',
      engineVersion: GAME_ENGINE_VERSION,
      timeLimitSeconds: 120,
      scoreCap: 100,
      categories: data.categories,
      decisions: data.decisions,
      answers: data.answers
    });
    await client.query(`UPDATE game_challenges SET challenge_sha256 = $2, status = 'published', published_at = $3 WHERE id = $1`, [challengeId, hash, createdAt]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cleanup(): Promise<void> {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE game_challenges SET status = 'retired', retired_at = NOW() WHERE id IN ($1, $2)`, [challengeId, invalidChallengeId]);
    await client.query(`DELETE FROM game_challenge_answers WHERE game_challenge_id IN ($1, $2)`, [challengeId, invalidChallengeId]);
    await client.query(`DELETE FROM game_challenge_decisions WHERE game_challenge_id IN ($1, $2)`, [challengeId, invalidChallengeId]);
    await client.query(`DELETE FROM game_challenge_categories WHERE game_challenge_id IN ($1, $2)`, [challengeId, invalidChallengeId]);
    await client.query(`DELETE FROM game_challenges WHERE id IN ($1, $2)`, [challengeId, invalidChallengeId]);
    await client.query(`UPDATE ranking_snapshots SET status = 'superseded' WHERE id = ANY($1::text[])`, [snapshotIds]);
    await client.query(`DELETE FROM ranking_entries WHERE snapshot_id = ANY($1::text[])`, [snapshotIds]);
    await client.query(`DELETE FROM ranking_snapshots WHERE id = ANY($1::text[])`, [snapshotIds]);
    await client.query(`DELETE FROM image_assets WHERE id = ANY($1::text[])`, [imageIds]);
    await client.query(`DELETE FROM source_snapshots WHERE id = ANY($1::text[])`, [sourceSnapshotIds]);
    await client.query(`DELETE FROM source_rights_reviews WHERE source_key = ANY($1::text[])`, [sourceKeys]);
    await client.query(`DELETE FROM sources WHERE key = ANY($1::text[])`, [sourceKeys]);
    await client.query(`DELETE FROM entity_game_profiles WHERE entity_id = ANY($1::text[])`, [entityIds]);
    await client.query(`DELETE FROM category_definitions WHERE id = ANY($1::text[])`, [categoryIds]);
    await client.query(`DELETE FROM entities WHERE id = ANY($1::text[])`, [entityIds]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

await setup();
const app = buildApp({ gameDb: database as unknown as ContractDatabase, runtimeMode: 'official' });
try {
  const challenge = await app.inject({ method: 'GET', url: '/v1/challenges/daily' });
  assert.equal(challenge.statusCode, 200);
  const challengeBody = JSON.parse(challenge.body).challenge;
  assert.equal(challengeBody.runtimeMode, 'official');
  assert.equal(challengeBody.testOnly, false);
  assert.equal(challengeBody.categories.length, 7);
  assert.equal(challengeBody.decisions.length, 7);

  const ranking = await app.inject({ method: 'GET', url: `/v1/rankings/${slugs[0]}` });
  assert.equal(ranking.statusCode, 200);
  const rankingBody = JSON.parse(ranking.body);
  assert.equal(rankingBody.status, 'official');
  assert.equal(rankingBody.snapshotId, snapshotIds[0]);
  assert.equal(rankingBody.entries.length, 7);
  assert.equal(Number(rankingBody.entries[0].raw_value), 100);

  const draftRanking = await app.inject({ method: 'GET', url: '/v1/rankings/integration-test-goals' });
  assert.equal(draftRanking.statusCode, 404);
  assert.deepEqual(JSON.parse(draftRanking.body), { error: 'ranking_not_available', category: 'integration-test-goals', mode: 'official', reason: 'no_published_snapshot' });

  const invalid = await app.inject({ method: 'GET', url: `/v1/challenges/${invalidChallengeId}` });
  assert.equal(invalid.statusCode, 503);
  assert.equal(JSON.parse(invalid.body).error, 'official_not_ready');

  console.log(JSON.stringify({ status: 'passed', integration: 'block6-official-fixture', challengeId, ranking: slugs[0], syntheticOnly: true }));
} finally {
  await app.close();
  await cleanup();
  await database.end();
}
