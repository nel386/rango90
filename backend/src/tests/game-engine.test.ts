import assert from 'node:assert/strict';
import {
  GameRuleError,
  InMemoryResultSubmissionLedger,
  calculateGameResult,
  compareResults,
  expireGame,
  finishGame,
  getCurrentDecision,
  startGame,
  submitDecision,
  validateGameResult,
  type PublishedGameChallenge
} from '../game-engine.js';
import { gameChallengeFixture } from './fixtures/gameChallenge.js';

function errorCode(action: () => unknown, code: GameRuleError['code']): void {
  assert.throws(action, (error: unknown) => error instanceof GameRuleError && error.code === code);
}

const start = 1_000_000;
let state = startGame(gameChallengeFixture, start);
assert.equal(state.deadlineAtMs, start + 10_000);
assert.deepEqual(getCurrentDecision(gameChallengeFixture, state), {
  ordinal: 0,
  entityId: 'player-a',
  availableCategorySlugs: ['career-goals', 'ballon-dor', 'champions-titles']
});

state = submitDecision(gameChallengeFixture, state, { ordinal: 0, entityId: 'player-a', categorySlug: 'career-goals' }, start + 1_200);
assert.deepEqual(getCurrentDecision(gameChallengeFixture, state), {
  ordinal: 1,
  entityId: 'player-b',
  availableCategorySlugs: ['ballon-dor', 'champions-titles']
});
state = submitDecision(gameChallengeFixture, state, { ordinal: 1, entityId: 'player-b', categorySlug: 'ballon-dor' }, start + 2_400);
state = submitDecision(gameChallengeFixture, state, { ordinal: 2, entityId: 'player-c', categorySlug: 'champions-titles' }, start + 3_600);
const result = calculateGameResult(gameChallengeFixture, state);
assert.equal(result.totalScore, 4);
assert.equal(result.elapsedMilliseconds, 3_600);
assert.equal(result.elapsedSeconds, 3);
assert.equal(result.timedOut, false);
assert.equal(validateGameResult(gameChallengeFixture, result).valid, true);
assert.equal(getCurrentDecision(gameChallengeFixture, state), null);
assert.deepEqual(finishGame(gameChallengeFixture, state, result.finishedAtMs), state);
errorCode(() => finishGame(gameChallengeFixture, startGame(gameChallengeFixture, start), start + 1_000), 'result_incomplete');

// Fewer points wins; ties use exact elapsed time and then the canonical hash.
const slower = { ...result, finishedAtMs: result.finishedAtMs + 1, elapsedMilliseconds: result.elapsedMilliseconds + 1, elapsedSeconds: 3 };
assert.equal(compareResults(result, slower), -1);
const worseScore = { ...result, totalScore: result.totalScore + 1 };
assert.equal(compareResults(result, worseScore), -1);
const sameScoreAndTimeDifferentHash = { ...result, resultHash: `${result.resultHash.slice(0, -1)}0` };
assert.equal(compareResults(result, sameScoreAndTimeDifferentHash) !== 0, true);

// Invalid order, entity, unknown answer, and duplicate category are rejected.
errorCode(() => submitDecision(gameChallengeFixture, startGame(gameChallengeFixture, start), { ordinal: 1, entityId: 'player-b', categorySlug: 'career-goals' }, start + 1), 'decision_order_invalid');
errorCode(() => submitDecision(gameChallengeFixture, startGame(gameChallengeFixture, start), { ordinal: 0, entityId: 'player-b', categorySlug: 'career-goals' }, start + 1), 'entity_invalid');
errorCode(() => submitDecision(gameChallengeFixture, startGame(gameChallengeFixture, start), { ordinal: 0, entityId: 'player-a', categorySlug: 'not-a-category' }, start + 1), 'answer_invalid');
const duplicateState = submitDecision(gameChallengeFixture, startGame(gameChallengeFixture, start), { ordinal: 0, entityId: 'player-a', categorySlug: 'career-goals' }, start + 1);
errorCode(() => submitDecision(gameChallengeFixture, duplicateState, { ordinal: 1, entityId: 'player-b', categorySlug: 'career-goals' }, start + 2), 'category_already_used');
errorCode(() => submitDecision(gameChallengeFixture, state, { ordinal: 2, entityId: 'player-c', categorySlug: 'career-goals' }, start + 4_000), 'game_finished');

// A response at the exact deadline is too late. The remaining assignments are deterministic.
let timeoutState = submitDecision(gameChallengeFixture, startGame(gameChallengeFixture, start), { ordinal: 0, entityId: 'player-a', categorySlug: 'ballon-dor' }, start + 1_000);
timeoutState = submitDecision(gameChallengeFixture, timeoutState, { ordinal: 1, entityId: 'player-b', categorySlug: 'champions-titles' }, start + 9_000);
timeoutState = expireGame(gameChallengeFixture, timeoutState, start + 10_000);
assert.equal(timeoutState.phase, 'finished');
assert.equal(timeoutState.timedOut, true);
assert.equal(timeoutState.finishedAtMs, start + 10_000);
assert.deepEqual(timeoutState.assignments.slice(-2), [
  { ordinal: 1, entityId: 'player-b', categorySlug: 'champions-titles', scoreValue: 5, timedOut: false },
  { ordinal: 2, entityId: 'player-c', categorySlug: 'career-goals', scoreValue: 100, timedOut: true }
]);
const timeoutResult = calculateGameResult(gameChallengeFixture, timeoutState);
assert.equal(timeoutResult.totalScore, 108);
assert.equal(validateGameResult(gameChallengeFixture, timeoutResult).valid, true);
assert.deepEqual(expireGame(gameChallengeFixture, timeoutState, start + 20_000), timeoutState);
errorCode(() => expireGame(gameChallengeFixture, startGame(gameChallengeFixture, start), start + 9_999), 'time_not_expired');
const exactDeadlineState = submitDecision(gameChallengeFixture, startGame(gameChallengeFixture, start), { ordinal: 0, entityId: 'player-a', categorySlug: 'ballon-dor' }, start + 10_000);
assert.equal(exactDeadlineState.timedOut, true);

// Server validation detects score, timing, ordering, duplicate, timeout and hash tampering.
for (const tampered of [
  { ...result, totalScore: result.totalScore + 1 },
  { ...result, assignments: [{ ...result.assignments[0]!, scoreValue: 99 }, ...result.assignments.slice(1)] },
  { ...result, assignments: [result.assignments[1]!, result.assignments[0]!, result.assignments[2]!] },
  { ...result, assignments: [result.assignments[0]!, result.assignments[0]!, result.assignments[2]!] },
  { ...result, elapsedMilliseconds: 9_999 },
  { ...result, resultHash: 'tampered' }
]) {
  assert.equal(validateGameResult(gameChallengeFixture, tampered).valid, false);
}

const ledger = new InMemoryResultSubmissionLedger();
const firstReceipt = ledger.submit(gameChallengeFixture, { playerId: 'player-1', idempotencyKey: 'request-1', result });
assert.equal(firstReceipt.status, 'accepted');
assert.equal(ledger.submit(gameChallengeFixture, { playerId: 'player-1', idempotencyKey: 'request-1', result }).status, 'duplicate');
assert.equal(ledger.submit(gameChallengeFixture, { playerId: 'player-1', idempotencyKey: 'request-2', result }).status, 'duplicate');
errorCode(() => ledger.submit(gameChallengeFixture, { playerId: 'player-1', idempotencyKey: 'request-1', result: timeoutResult }), 'submission_conflict');
assert.equal(ledger.submit(gameChallengeFixture, { playerId: 'player-2', idempotencyKey: 'request-1', result }).status, 'accepted');

// Invalid published challenges are rejected before a game can start.
assert.throws(() => startGame({ ...gameChallengeFixture, categories: [...gameChallengeFixture.categories, { slug: 'extra' }] }, start), (error: unknown) => error instanceof GameRuleError && error.code === 'challenge_invalid');
assert.throws(() => startGame({ ...gameChallengeFixture, decisions: [{ ...gameChallengeFixture.decisions[0]!, entityId: 'player-b' }, ...gameChallengeFixture.decisions.slice(1)] }, start), (error: unknown) => error instanceof GameRuleError && error.code === 'challenge_invalid');

// Typed daily matrix: player decisions only see player categories and the club
// decision only sees club categories; the timeout keeps the same compatibility.
const typedChallenge: PublishedGameChallenge = {
  id: 'typed-challenge',
  sourceVersion: 'typed-fixture-v1',
  challengeSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  timeLimitSeconds: 10,
  scoreCap: 100,
  categories: [
    { slug: 'player-goals', entityType: 'player' as const },
    { slug: 'player-cards', entityType: 'player' as const },
    { slug: 'club-champions', entityType: 'club' as const }
  ],
  decisions: [
    { ordinal: 0, entityId: 'player-typed-a', entityType: 'player' as const, scoreByCategory: { 'player-goals': 1, 'player-cards': 2 } },
    { ordinal: 1, entityId: 'player-typed-b', entityType: 'player' as const, scoreByCategory: { 'player-goals': 3, 'player-cards': 4 } },
    { ordinal: 2, entityId: 'club-typed-a', entityType: 'club' as const, scoreByCategory: { 'club-champions': 5 } }
  ]
};
let typedState = startGame(typedChallenge, start);
assert.deepEqual(getCurrentDecision(typedChallenge, typedState)?.availableCategorySlugs, ['player-goals', 'player-cards']);
typedState = submitDecision(typedChallenge, typedState, { ordinal: 0, entityId: 'player-typed-a', categorySlug: 'player-goals' }, start + 1);
assert.deepEqual(getCurrentDecision(typedChallenge, typedState)?.availableCategorySlugs, ['player-cards']);
typedState = expireGame(typedChallenge, typedState, start + 10_000);
assert.deepEqual(typedState.assignments.slice(1), [
  { ordinal: 1, entityId: 'player-typed-b', categorySlug: 'player-cards', scoreValue: 100, timedOut: true },
  { ordinal: 2, entityId: 'club-typed-a', categorySlug: 'club-champions', scoreValue: 100, timedOut: true }
]);
assert.equal(validateGameResult(typedChallenge, calculateGameResult(typedChallenge, typedState)).valid, true);

console.log('game engine tests passed');
