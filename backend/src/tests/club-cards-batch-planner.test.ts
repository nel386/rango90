import assert from 'node:assert/strict';
import { backoffDelayMs, classifyClubCardProviderFailure, estimateClubCardBatchRequests, planClubCardBatches, preserveBatchSnapshot } from '../clubCardsBatchPlanner.js';

const base = [
  { key: 'premier-league', providerId: 39, name: 'Premier League', estimatedRequests: 8 },
  { key: 'la-liga', providerId: 140, name: 'La Liga', estimatedRequests: 8 },
  { key: 'serie-a', providerId: 135, name: 'Serie A', estimatedRequests: 8 }
];

const sufficient = planClubCardBatches({ quotaInitial: 30, quotaReserve: 2, maxRequests: 20, batches: base });
assert.deepEqual(sufficient.batches.map((batch) => batch.status), ['planned', 'planned', 'quota_insufficient']);
assert.equal(sufficient.plannedRequests, 16);
assert.equal(sufficient.batches[2]!.snapshotAction, 'preserve');

const exhausted = planClubCardBatches({ quotaInitial: 0, quotaReserve: 0, batches: base });
assert.deepEqual(exhausted.batches.map((batch) => batch.status), ['quota_insufficient', 'quota_insufficient', 'quota_insufficient']);
assert.equal(exhausted.plannedRequests, 0);
assert.equal(exhausted.batches.every((batch) => preserveBatchSnapshot(batch.status)), true);

const resumed = planClubCardBatches({ quotaInitial: 12, quotaReserve: 0, batches: base.map((batch, index) => ({ ...batch, alreadyUpdated: index === 0 })) });
assert.equal(resumed.batches[0]!.status, 'skipped');
assert.equal(resumed.batches[1]!.status, 'planned');
assert.equal(resumed.batches[2]!.status, 'quota_insufficient');

assert.equal(estimateClubCardBatchRequests({ planRequests: 1, playerPages: 3, retryBudget: 1 }), 7);
assert.equal(backoffDelayMs(0), 1000);
assert.equal(backoffDelayMs(4), 16000);
assert.equal(classifyClubCardProviderFailure({ status: 429 }), 'rate_limited');
assert.equal(classifyClubCardProviderFailure({ timedOut: true }), 'timeout');
assert.equal(classifyClubCardProviderFailure({ incomplete: true }), 'incomplete');
assert.equal(classifyClubCardProviderFailure({ status: 503 }), 'temporary');
assert.equal(classifyClubCardProviderFailure({ status: 401 }), 'fatal');
console.log('club-cards-batch-planner: ok');
