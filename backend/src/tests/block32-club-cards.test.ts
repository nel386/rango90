import assert from 'node:assert/strict';
import { classifyClubCardProviderFailure, planClubCardBatches } from '../clubCardsBatchPlanner.js';

const competitions = [
  { key: 'premier-league', providerId: 39, name: 'Premier League', estimatedRequests: 3 },
  { key: 'la-liga', providerId: 140, name: 'La Liga', estimatedRequests: 3 },
  { key: 'serie-a', providerId: 135, name: 'Serie A', estimatedRequests: 3 },
  { key: 'bundesliga', providerId: 78, name: 'Bundesliga', estimatedRequests: 3 }
];

const zero = planClubCardBatches({ quotaInitial: 0, quotaReserve: 0, batches: competitions });
assert.equal(zero.plannedRequests, 0);
assert.equal(zero.batches.every((batch) => batch.status === 'quota_insufficient' && batch.snapshotAction === 'preserve'), true);

const partialBudget = planClubCardBatches({ quotaInitial: 7, quotaReserve: 1, maxRequests: 6, batches: competitions });
assert.deepEqual(partialBudget.batches.map((batch) => batch.status), ['planned', 'planned', 'quota_insufficient', 'quota_insufficient']);

const resumed = planClubCardBatches({ quotaInitial: 4, batches: competitions.map((batch, index) => ({ ...batch, alreadyUpdated: index === 0 })) });
assert.equal(resumed.batches[0]!.status, 'skipped');
assert.equal(resumed.batches[1]!.status, 'planned');

assert.equal(classifyClubCardProviderFailure({ status: 429 }), 'rate_limited');
assert.equal(classifyClubCardProviderFailure({ status: 504 }), 'temporary');
assert.equal(classifyClubCardProviderFailure({ incomplete: true }), 'incomplete');
console.log('block32-club-cards: quota, batches, retry classification and resume: ok');
