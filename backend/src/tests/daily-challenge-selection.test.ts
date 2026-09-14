import assert from 'node:assert/strict';
import { selectDailyCategoryEntity, type DailyChallengeRankingEntry } from '../dailyChallengeSelection.js';

const entries: DailyChallengeRankingEntry[] = [
  { snapshotId: 'a', entityId: 'common-a', rank: 1, scoreValue: 1 },
  { snapshotId: 'b', entityId: 'common-a', rank: 50, scoreValue: 50 },
  { snapshotId: 'c', entityId: 'common-a', rank: 150, scoreValue: 100 },
  { snapshotId: 'a', entityId: 'common-b', rank: 120, scoreValue: 100 },
  { snapshotId: 'b', entityId: 'common-b', rank: 2, scoreValue: 2 },
  { snapshotId: 'c', entityId: 'common-b', rank: 3, scoreValue: 3 },
  { snapshotId: 'c', entityId: 'category-c-only', rank: 4, scoreValue: 4 },
  { snapshotId: 'a', entityId: 'missing-c', rank: 1, scoreValue: 1 },
  { snapshotId: 'b', entityId: 'missing-c', rank: 1, scoreValue: 1 }
];

const selected = new Set<string>();
const first = selectDailyCategoryEntity(entries, 'a', 'seed', 90, selected);
assert.ok(first);
selected.add(first.entityId);
const second = selectDailyCategoryEntity(entries, 'b', 'seed', 90, selected);
assert.ok(second);
selected.add(second.entityId);
const third = selectDailyCategoryEntity(entries, 'c', 'seed', 90, selected);
assert.ok(third);
assert.notEqual(first.entityId, second.entityId);
assert.notEqual(second.entityId, third.entityId);
assert.equal(first.bySnapshot.get('a')?.scoreValue, 1);
assert.equal(third.bySnapshot.get('c')?.scoreValue, 4);
assert.equal(selectDailyCategoryEntity(entries, 'a', 'seed', 90, new Set(['common-a', 'missing-c'])), null);
console.log('daily challenge independent-category selection tests passed');
