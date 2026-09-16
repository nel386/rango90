import assert from 'node:assert/strict';
import { GameRuleError, expireGame, startGame, submitDecision } from '../game-engine.js';
import { gameChallengeFixture } from './fixtures/gameChallenge.js';

const start = 2_000_000;
const session = startGame(gameChallengeFixture, start);
assert.equal(session.phase, 'playing');
assert.throws(
  () => submitDecision(gameChallengeFixture, session, { ordinal: 1, entityId: 'player-b', categorySlug: 'career-goals' }, start + 1),
  (error: unknown) => error instanceof GameRuleError && error.code === 'decision_order_invalid'
);

const firstDecision = submitDecision(gameChallengeFixture, session, { ordinal: 0, entityId: 'player-a', categorySlug: 'career-goals' }, start + 1);
assert.throws(
  () => submitDecision(gameChallengeFixture, firstDecision, { ordinal: 1, entityId: 'player-b', categorySlug: 'career-goals' }, start + 2),
  (error: unknown) => error instanceof GameRuleError && error.code === 'category_already_used'
);
assert.throws(() => expireGame(gameChallengeFixture, session, start + 9_999), (error: unknown) => error instanceof GameRuleError && error.code === 'time_not_expired');
const expired = expireGame(gameChallengeFixture, firstDecision, start + 10_000);
assert.equal(expired.phase, 'finished');
assert.equal(expired.timedOut, true);
assert.deepEqual(expireGame(gameChallengeFixture, expired, start + 20_000), expired);
console.log('game-flow-boundaries tests passed');
