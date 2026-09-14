import assert from 'node:assert/strict';
import { selectCommonDailyEntities, type DailyChallengeRankingEntry } from '../dailyChallengeSelection.js';

const entries: DailyChallengeRankingEntry[] = [
  { snapshotId: 'a', entityId: 'common-a', rank: 1, scoreValue: 1 },
  { snapshotId: 'b', entityId: 'common-a', rank: 50, scoreValue: 50 },
  { snapshotId: 'c', entityId: 'common-a', rank: 150, scoreValue: 100 },
  { snapshotId: 'a', entityId: 'common-b', rank: 120, scoreValue: 100 },
  { snapshotId: 'b', entityId: 'common-b', rank: 2, scoreValue: 2 },
  { snapshotId: 'c', entityId: 'common-b', rank: 3, scoreValue: 3 },
  { snapshotId: 'a', entityId: 'missing-c', rank: 1, scoreValue: 1 },
  { snapshotId: 'b', entityId: 'missing-c', rank: 1, scoreValue: 1 }
];

const selected = selectCommonDailyEntities(entries, ['a', 'b', 'c'], 'seed', 90, 7);
assert.deepEqual(new Set(selected.map((candidate) => candidate.entityId)), new Set(['common-a', 'common-b']));
assert.equal(selected.every((candidate) => candidate.bySnapshot.size === 3), true);
assert.equal(selected.find((candidate) => candidate.entityId === 'common-a')?.bySnapshot.get('c')?.scoreValue, 100);
console.log('daily challenge common-entity selection tests passed');
