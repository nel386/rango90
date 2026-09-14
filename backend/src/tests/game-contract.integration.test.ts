import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { calculateChallengeSha256 } from '../game-contract.js';
import { closeDb, pool } from '../db.js';

const suffix = randomUUID().slice(0, 8);
const challengeId = `it-challenge-${suffix}`;
const categoryA = `it-category-a-${suffix}`;
const categoryB = `it-category-b-${suffix}`;
const snapshotA = `it-snapshot-a-${suffix}`;
const snapshotB = `it-snapshot-b-${suffix}`;
const entityA = `it-entity-a-${suffix}`;
const entityB = `it-entity-b-${suffix}`;
const userId = `it-user-${suffix}`;
const eligibleUserId = `it-eligible-${suffix}`;
const cutoffUserId = `it-cutoff-${suffix}`;
const validationChallengeId = `it-validation-${suffix}`;
const missingRankingEntityId = `it-missing-ranking-entity-${suffix}`;
const thresholdSession249 = `it-session-249-${suffix}`;
const thresholdSession250 = `it-session-250-${suffix}`;
const authToken = `integration-auth-${suffix}-token`;
const startedAt = new Date('2026-09-09T12:00:00.000Z');
let clockTime = new Date(startedAt);

const cookie = `rango90_session=${authToken}`;
const resultClaims = {
  assignments: [
    { ordinal: 0, entityId: entityA, categorySlug: 'it-goals' },
    { ordinal: 1, entityId: entityB, categorySlug: 'it-assists' }
  ]
};

async function query(text: string, values: unknown[] = []): Promise<void> {
  await pool.query(text, values);
}

async function setup(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO category_definitions (id, slug, label_es, label_en, entity_type, metric_key, scope_kind, ranking_direction, tie_policy, score_cap, definition_md, status)
       VALUES ($1, 'it-goals', 'Goles IT', 'IT goals', 'player', 'goals', 'test', 'desc', 'competition', 100, 'integration fixture', 'published'),
              ($2, 'it-assists', 'Asistencias IT', 'IT assists', 'player', 'assists', 'test', 'desc', 'competition', 100, 'integration fixture', 'published')`,
      [categoryA, categoryB]
    );
    await client.query(
      `INSERT INTO entities (id, entity_type, canonical_name, short_name) VALUES
       ($1, 'player', 'Integration Player A', 'IPA'), ($2, 'player', 'Integration Player B', 'IPB')`,
      [entityA, entityB]
    );
    await client.query(
      `INSERT INTO entity_game_profiles (entity_id, legacy_tier, playable_default, reason)
       VALUES ($1, 'modern', TRUE, 'integration test'), ($2, 'modern', TRUE, 'integration test')`,
      [entityA, entityB]
    );
    await client.query(
      `INSERT INTO ranking_snapshots (id, category_id, data_version, algorithm_version, content_sha256, status, coverage_complete, eligible_count)
       VALUES ($1, $3, 'it-v1', 'ranking-v1', $5, 'draft', TRUE, 2),
              ($2, $4, 'it-v1', 'ranking-v1', $6, 'draft', TRUE, 2)`,
      [snapshotA, snapshotB, categoryA, categoryB, 'a'.repeat(64), 'b'.repeat(64)]
    );
    await client.query(
      `INSERT INTO ranking_entries (snapshot_id, entity_id, raw_value, rank, score_value, tie_group)
       VALUES ($1, $3, 10, 1, 1, 1), ($1, $4, 5, 2, 2, 2),
              ($2, $3, 20, 1, 1, 1), ($2, $4, 8, 2, 2, 2)`,
      [snapshotA, snapshotB, entityA, entityB]
    );
    await client.query(
      `UPDATE ranking_snapshots SET status = 'published' WHERE id IN ($1, $2)`,
      [snapshotA, snapshotB]
    );
    await client.query(
      `INSERT INTO game_challenges (id, challenge_kind, challenge_date, status, source_version, engine_version, time_limit_seconds, score_cap, challenge_sha256)
       VALUES ($1, 'daily', '2026-09-09', 'draft', 'it-v1', 'game-engine-v1', 10, 100, $2)`,
      [challengeId, 'c'.repeat(64)]
    );
    await client.query(
      `INSERT INTO game_challenge_categories (game_challenge_id, category_id, category_ordinal, ranking_snapshot_id)
       VALUES ($1, $2, 0, $4), ($1, $3, 1, $5)`,
      [challengeId, categoryA, categoryB, snapshotA, snapshotB]
    );
    await client.query(
      `INSERT INTO game_challenge_decisions (game_challenge_id, decision_ordinal, entity_id)
       VALUES ($1, 0, $2), ($1, 1, $3)`,
      [challengeId, entityA, entityB]
    );
    await client.query(
      `INSERT INTO game_challenge_answers (game_challenge_id, decision_ordinal, category_id, score_value)
       VALUES ($1, 0, $2, 1), ($1, 0, $3, 1), ($1, 1, $2, 2), ($1, 1, $3, 2)`,
      [challengeId, categoryA, categoryB]
    );
    const challengeSha256 = calculateChallengeSha256({
      id: challengeId,
      kind: 'daily',
      challengeDate: '2026-09-09',
      sourceVersion: 'it-v1',
      engineVersion: 'game-engine-v1',
      timeLimitSeconds: 10,
      scoreCap: 100,
      categories: [
        { ordinal: 0, categoryId: categoryA, rankingSnapshotId: snapshotA, slug: 'it-goals' },
        { ordinal: 1, categoryId: categoryB, rankingSnapshotId: snapshotB, slug: 'it-assists' }
      ],
      decisions: [
        { ordinal: 0, entityId: entityA },
        { ordinal: 1, entityId: entityB }
      ],
      answers: [
        { decisionOrdinal: 0, categoryId: categoryA, scoreValue: 1 },
        { decisionOrdinal: 0, categoryId: categoryB, scoreValue: 1 },
        { decisionOrdinal: 1, categoryId: categoryA, scoreValue: 2 },
        { decisionOrdinal: 1, categoryId: categoryB, scoreValue: 2 }
      ]
    });
    await client.query(`UPDATE game_challenges SET challenge_sha256 = $2 WHERE id = $1`, [challengeId, challengeSha256]);
    await client.query(`UPDATE game_challenges SET status = 'published', published_at = $2 WHERE id = $1`, [challengeId, startedAt]);
    await client.query(
      `INSERT INTO auth_users (id, email, google_subject, display_name, email_verified_at)
       VALUES ($1, $2, $3, 'Integration User', NOW()),
              ($4, $5, $6, 'Eligible Threshold User', NOW()),
              ($7, $8, $9, 'Cutoff Threshold User', NOW())`,
      [
        userId, `${userId}@example.test`, `google-${userId}`,
        eligibleUserId, `${eligibleUserId}@example.test`, `google-${eligibleUserId}`,
        cutoffUserId, `${cutoffUserId}@example.test`, `google-${cutoffUserId}`
      ]
    );
    await client.query(
      `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [`it-auth-session-${suffix}`, userId, createHash('sha256').update(authToken).digest('hex'), new Date(Date.now() + 86_400_000)]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cleanup(): Promise<void> {
  await query('DELETE FROM game_results WHERE game_challenge_id = $1', [challengeId]);
  await query('DELETE FROM game_sessions WHERE game_challenge_id = $1', [challengeId]);
  await query('DELETE FROM duel_participants WHERE duel_id IN (SELECT id FROM duels WHERE game_challenge_id = $1)', [challengeId]);
  await query('DELETE FROM duels WHERE game_challenge_id = $1', [challengeId]);
  await query(`UPDATE game_challenges SET status = 'retired', retired_at = NOW() WHERE id = $1`, [challengeId]);
  await query('DELETE FROM game_challenge_answers WHERE game_challenge_id = $1', [challengeId]);
  await query('DELETE FROM game_challenge_decisions WHERE game_challenge_id = $1', [challengeId]);
  await query('DELETE FROM game_challenge_categories WHERE game_challenge_id = $1', [challengeId]);
  await query('DELETE FROM game_challenges WHERE id = $1', [challengeId]);
  await query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
  await query('DELETE FROM auth_users WHERE id = ANY($1::text[])', [[userId, eligibleUserId, cutoffUserId]]);
  await query(`UPDATE ranking_snapshots SET status = 'superseded' WHERE id IN ($1, $2)`, [snapshotA, snapshotB]);
  await query('DELETE FROM ranking_entries WHERE snapshot_id IN ($1, $2)', [snapshotA, snapshotB]);
  await query('DELETE FROM ranking_snapshots WHERE id IN ($1, $2)', [snapshotA, snapshotB]);
  await query('DELETE FROM entity_game_profiles WHERE entity_id IN ($1, $2)', [entityA, entityB]);
  await query('DELETE FROM category_definitions WHERE id IN ($1, $2)', [categoryA, categoryB]);
  await query('DELETE FROM entities WHERE id IN ($1, $2)', [entityA, entityB]);
}

async function assertPublishedChallengeRejectsUnbackedEntity(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO entities (id, entity_type, canonical_name, short_name)
       VALUES ($1, 'player', 'Unbacked Integration Player', 'UIP')`,
      [missingRankingEntityId]
    );
    await client.query(
      `INSERT INTO game_challenges
         (id, challenge_kind, challenge_date, status, source_version, engine_version, time_limit_seconds, score_cap, challenge_sha256)
       VALUES ($1, 'daily', '2026-09-10', 'draft', 'it-v1', 'game-engine-v1', 10, 100, $2)`,
      [validationChallengeId, 'e'.repeat(64)]
    );
    await client.query(
      `INSERT INTO game_challenge_categories (game_challenge_id, category_id, category_ordinal, ranking_snapshot_id)
       VALUES ($1, $2, 0, $4), ($1, $3, 1, $5)`,
      [validationChallengeId, categoryA, categoryB, snapshotA, snapshotB]
    );
    await client.query(
      `INSERT INTO game_challenge_decisions (game_challenge_id, decision_ordinal, entity_id)
       VALUES ($1, 0, $2), ($1, 1, $3)`,
      [validationChallengeId, entityA, missingRankingEntityId]
    );
    await client.query(
      `INSERT INTO game_challenge_answers (game_challenge_id, decision_ordinal, category_id, score_value)
       VALUES ($1, 0, $2, 1), ($1, 0, $3, 1), ($1, 1, $2, 1), ($1, 1, $3, 1)`,
      [validationChallengeId, categoryA, categoryB]
    );
    await assert.rejects(
      async () => {
        await client.query(
          `UPDATE game_challenges SET status = 'published', published_at = $2 WHERE id = $1`,
          [validationChallengeId, startedAt]
        );
        await client.query('COMMIT');
      },
      /published game challenge requires every decision entity in every ranking snapshot/u
    );
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
}

async function run(): Promise<void> {
  await setup();
  await assertPublishedChallengeRejectsUnbackedEntity();
  let app: FastifyInstance | undefined;
  try {
    app = buildApp({ gameDb: pool, clock: () => clockTime });
    const malformedCookie = await app.inject({ method: 'GET', url: '/v1/auth/session', headers: { cookie: 'rango90_session=%' } });
    assert.equal(malformedCookie.statusCode, 200);
    assert.equal(JSON.parse(malformedCookie.body).user, null);
    const daily = await app.inject({ method: 'GET', url: '/v1/challenges/daily' });
    assert.equal(daily.statusCode, 200);
    const rejectedOrigin = await app.inject({ method: 'POST', url: '/v1/games', headers: { origin: 'https://attacker.example' }, payload: { challengeId } });
    assert.equal(rejectedOrigin.statusCode, 403);
    assert.equal((JSON.parse(rejectedOrigin.body) as { error: string }).error, 'csrf_origin_rejected');
    const dailyBody = JSON.parse(daily.body) as { challenge: { id: string; decisions: Array<Record<string, unknown>> } };
    assert.ok(dailyBody.challenge.id);
    assert.equal('scoreValue' in (dailyBody.challenge.decisions[0] ?? {}), false);
    assert.equal(dailyBody.challenge.decisions[0]?.imageStatus, 'fallback');
    assert.match(String(dailyBody.challenge.decisions[0]?.imageUrl), /\/v1\/media\/it-entity-[^/]+\/fallback$/u);
    const ranking = await app.inject({ method: 'GET', url: '/v1/rankings/it-goals' });
    assert.equal(ranking.statusCode, 200);
    const rankingBody = JSON.parse(ranking.body) as { entries: Array<Record<string, unknown>> };
    assert.equal(rankingBody.entries.length, 2);
    assert.equal(rankingBody.entries[0]?.image_status, 'fallback');
    assert.match(String(rankingBody.entries[0]?.image_url), /\/v1\/media\/it-entity-[^/]+\/fallback$/u);
    const media = await app.inject({ method: 'GET', url: `/v1/media/${entityA}` });
    assert.equal(media.statusCode, 200);
    const mediaBody = JSON.parse(media.body) as { image_status: string; image_url: string };
    assert.equal(mediaBody.image_status, 'fallback');
    assert.match(mediaBody.image_url, /\/v1\/media\/it-entity-[^/]+\/fallback$/u);
    const exactChallenge = await app.inject({ method: 'GET', url: `/v1/challenges/${challengeId}` });
    assert.equal(exactChallenge.statusCode, 200);
    assert.equal(JSON.parse(exactChallenge.body).challenge.id, challengeId);

    const game = await app.inject({ method: 'POST', url: '/v1/games', payload: { challengeId }, headers: { cookie } });
    assert.equal(game.statusCode, 201);
    const gameBody = JSON.parse(game.body) as { sessionToken: string; game: { id: string } };
    const result = await app.inject({
      method: 'POST',
      url: `/v1/games/${gameBody.game.id}/result`,
      headers: { 'idempotency-key': 'integration-result-1', cookie },
      payload: { sessionToken: gameBody.sessionToken, result: resultClaims }
    });
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).result.totalScore, 3);
    assert.equal(JSON.parse(result.body).leaderboardEligible, true);
    assert.equal(JSON.parse(result.body).result.assignments[0].scoreValue, 1);
    const duplicate = await app.inject({
      method: 'POST',
      url: `/v1/games/${gameBody.game.id}/result`,
      headers: { 'idempotency-key': 'integration-result-1', cookie },
      payload: { sessionToken: gameBody.sessionToken, result: resultClaims }
    });
    assert.equal(duplicate.statusCode, 200);
    assert.equal(JSON.parse(duplicate.body).duplicate, true);
    const resultConflict = await app.inject({
      method: 'POST',
      url: `/v1/games/${gameBody.game.id}/result`,
      headers: { 'idempotency-key': 'integration-result-conflict', cookie },
      payload: { sessionToken: gameBody.sessionToken, result: { assignments: [
        { ordinal: 0, entityId: entityA, categorySlug: 'it-assists' },
        { ordinal: 1, entityId: entityB, categorySlug: 'it-goals' }
      ] } }
    });
    assert.equal(resultConflict.statusCode, 409);
    assert.equal(JSON.parse(resultConflict.body).error, 'result_conflict');

    const invalidGame = await app.inject({ method: 'POST', url: '/v1/games', payload: { challengeId } });
    const invalidGameBody = JSON.parse(invalidGame.body) as { sessionToken: string; game: { id: string } };
    const invalidResult = await app.inject({
      method: 'POST',
      url: `/v1/games/${invalidGameBody.game.id}/result`,
      headers: { 'idempotency-key': 'integration-invalid-result' },
      payload: { sessionToken: invalidGameBody.sessionToken, result: { assignments: [
        { ordinal: 0, entityId: 'forged-entity', categorySlug: 'it-goals' },
        { ordinal: 1, entityId: entityB, categorySlug: 'it-assists' }
      ] } }
    });
    assert.equal(invalidResult.statusCode, 422);
    assert.equal(JSON.parse(invalidResult.body).error, 'result_invalid');

    const sameHashGame = await app.inject({ method: 'POST', url: '/v1/games', payload: { challengeId }, headers: { cookie } });
    const sameHashGameBody = JSON.parse(sameHashGame.body) as { sessionToken: string; game: { id: string } };
    const sameHash = await app.inject({
      method: 'POST',
      url: `/v1/games/${sameHashGameBody.game.id}/result`,
      headers: { 'idempotency-key': 'integration-result-2', cookie },
      payload: { sessionToken: sameHashGameBody.sessionToken, result: { assignments: [
        { ...resultClaims.assignments[0], scoreValue: 999, totalScore: 999 },
        resultClaims.assignments[1]
      ] } }
    });
    assert.equal(sameHash.statusCode, 200);
    assert.equal(JSON.parse(sameHash.body).duplicate, true);
    assert.equal(JSON.parse(sameHash.body).result.totalScore, 3);

    const guestGame = await app.inject({ method: 'POST', url: '/v1/games', payload: { challengeId } });
    const guestGameBody = JSON.parse(guestGame.body) as { sessionToken: string; game: { id: string } };
    const guestResult = await app.inject({
      method: 'POST',
      url: `/v1/games/${guestGameBody.game.id}/result`,
      headers: { 'idempotency-key': 'integration-guest-result' },
      payload: { sessionToken: guestGameBody.sessionToken, result: resultClaims }
    });
    assert.equal(guestResult.statusCode, 200);
    assert.equal(JSON.parse(guestResult.body).leaderboardEligible, false);

    await query(
      `INSERT INTO game_sessions
         (id, game_challenge_id, player_id, session_token_hash, status, started_at, deadline_at, finished_at)
       VALUES ($1, $3, $5, $7, 'completed', $9, $10, $10),
              ($2, $4, $6, $8, 'completed', $9, $10, $10)`,
      [
        thresholdSession249, thresholdSession250, challengeId, challengeId,
        eligibleUserId, cutoffUserId,
        createHash('sha256').update(`${thresholdSession249}-token`).digest('hex'),
        createHash('sha256').update(`${thresholdSession250}-token`).digest('hex'),
        startedAt, new Date(startedAt.getTime() + 10_000)
      ]
    );
    await query(
      `INSERT INTO game_results
         (id, game_challenge_id, game_session_id, player_id, submission_scope, idempotency_key,
          result_hash, source_version, engine_version, started_at, finished_at, elapsed_milliseconds,
          elapsed_seconds, total_score, timed_out, payload)
       VALUES ($1, $3, $5, $7, 'game', $9, $11, 'it-v1', 'game-engine-v1', $13, $14, 1000, 1, 249, FALSE, '{}'::jsonb),
              ($2, $4, $6, $8, 'game', $10, $12, 'it-v1', 'game-engine-v1', $13, $14, 1000, 1, 250, FALSE, '{}'::jsonb)`,
      [
        `it-result-249-${suffix}`, `it-result-250-${suffix}`, challengeId, challengeId,
        thresholdSession249, thresholdSession250, eligibleUserId, cutoffUserId,
        `it-result-249-${suffix}`, `it-result-250-${suffix}`,
        'd'.repeat(64), 'e'.repeat(64), startedAt, new Date(startedAt.getTime() + 10_000)
      ]
    );
    const leaderboard = await app.inject({ method: 'GET', url: `/v1/challenges/${challengeId}/leaderboard` });
    assert.equal(leaderboard.statusCode, 200);
    const leaderboardEntries = JSON.parse(leaderboard.body).entries as Array<{ playerId: string; totalScore: number }>;
    assert.equal(leaderboardEntries.length, 2);
    assert.ok(leaderboardEntries.some((entry) => entry.playerId === eligibleUserId && entry.totalScore === 249));
    assert.equal(leaderboardEntries.some((entry) => entry.playerId === cutoffUserId), false);

    clockTime = new Date(startedAt.getTime() + 10_000);
    const expiringGame = await app.inject({ method: 'POST', url: '/v1/games', headers: { cookie }, payload: { challengeId } });
    const expiringBody = JSON.parse(expiringGame.body) as { sessionToken: string; game: { id: string } };
    const earlyExpired = await app.inject({ method: 'POST', url: `/v1/games/${expiringBody.game.id}/expire`, headers: { cookie }, payload: { sessionToken: expiringBody.sessionToken } });
    assert.equal(earlyExpired.statusCode, 409, earlyExpired.body);
    assert.equal(JSON.parse(earlyExpired.body).error, 'time_not_expired');
    clockTime = new Date(clockTime.getTime() + 10_000);
    const expired = await app.inject({ method: 'POST', url: `/v1/games/${expiringBody.game.id}/expire`, headers: { cookie }, payload: { sessionToken: expiringBody.sessionToken, result: { assignments: [{ ordinal: 0, entityId: entityA, categorySlug: 'it-goals' }] } } });
    assert.equal(expired.statusCode, 200);
    assert.equal(JSON.parse(expired.body).result.timedOut, true);
    assert.equal(JSON.parse(expired.body).result.totalScore, 101);
    assert.equal(JSON.parse(expired.body).leaderboardEligible, false);
    const expiredDuplicate = await app.inject({ method: 'POST', url: `/v1/games/${expiringBody.game.id}/expire`, headers: { cookie }, payload: { sessionToken: expiringBody.sessionToken } });
    assert.equal(expiredDuplicate.statusCode, 200);
    assert.equal(JSON.parse(expiredDuplicate.body).duplicate, true);

    // A complete payload arriving through /expire after the deadline is still
    // late and must not become a zero-time normal result.
    const lateGame = await app.inject({ method: 'POST', url: '/v1/games', payload: { challengeId } });
    const lateGameBody = JSON.parse(lateGame.body) as { sessionToken: string; game: { id: string; deadlineAt: string } };
    clockTime = new Date(lateGameBody.game.deadlineAt);
    const lateComplete = await app.inject({
      method: 'POST',
      url: `/v1/games/${lateGameBody.game.id}/expire`,
      payload: { sessionToken: lateGameBody.sessionToken, result: resultClaims }
    });
    assert.equal(lateComplete.statusCode, 200);
    const lateCompleteBody = JSON.parse(lateComplete.body) as { result: { timedOut: boolean; elapsedMilliseconds: number; totalScore: number } };
    assert.equal(lateCompleteBody.result.timedOut, true);
    assert.equal(lateCompleteBody.result.elapsedMilliseconds, 10_000);
    assert.equal(lateCompleteBody.result.totalScore, 3);

    const leaderboardAfterAnonymous = await app.inject({ method: 'GET', url: `/v1/challenges/${challengeId}/leaderboard` });
    assert.equal(JSON.parse(leaderboardAfterAnonymous.body).entries.length, 2);

    clockTime = new Date(startedAt);
    const duel = await app.inject({ method: 'POST', url: '/v1/duels', payload: { challengeId }, headers: { cookie } });
    assert.equal(duel.statusCode, 201);
    const duelBody = JSON.parse(duel.body) as { duel: { code: string }; participantToken: string };
    const duelView = await app.inject({ method: 'GET', url: `/v1/duels/${duelBody.duel.code}` });
    assert.equal(duelView.statusCode, 200);
    assert.equal(JSON.parse(duelView.body).duel.joinable, true);
    const joined = await app.inject({ method: 'POST', url: `/v1/duels/${duelBody.duel.code}/join`, payload: {} });
    assert.equal(joined.statusCode, 201);
    const joinedBody = JSON.parse(joined.body) as { participantToken: string };
    const duelResult1 = await app.inject({
      method: 'POST', url: `/v1/duels/${duelBody.duel.code}/result`, headers: { 'idempotency-key': 'duel-result-1', cookie },
      payload: { participantToken: duelBody.participantToken, result: resultClaims }
    });
    assert.equal(duelResult1.statusCode, 200);
    const duelDuplicate = await app.inject({
      method: 'POST', url: `/v1/duels/${duelBody.duel.code}/result`, headers: { 'idempotency-key': 'duel-result-1', cookie },
      payload: { participantToken: duelBody.participantToken, result: resultClaims }
    });
    assert.equal(duelDuplicate.statusCode, 200);
    assert.equal(JSON.parse(duelDuplicate.body).duplicate, true);
    const duelResult2 = await app.inject({
      method: 'POST', url: `/v1/duels/${duelBody.duel.code}/result`, headers: { 'idempotency-key': 'duel-result-2' },
      payload: { participantToken: joinedBody.participantToken, result: resultClaims }
    });
    assert.equal(duelResult2.statusCode, 200);
    const completedDuel = await app.inject({ method: 'GET', url: `/v1/duels/${duelBody.duel.code}` });
    assert.equal(JSON.parse(completedDuel.body).duel.status, 'completed');
    const replay = await app.inject({ method: 'POST', url: `/v1/duels/${duelBody.duel.code}/replay`, headers: { cookie }, payload: { participantToken: duelBody.participantToken } });
    assert.equal(replay.statusCode, 201);
  } finally {
    if (app) await app.close();
    await cleanup();
    await closeDb();
  }
}

await run();
console.log('game contract integration tests passed');
