import assert from 'node:assert/strict';
import {
  MAX_GAME_RANKING_ENTRIES,
  decideIdentityReview,
  isAllowedInChallenge,
  isPlayableWithExplicitProfile,
  isSnapshotEligibleForCatalog,
  mediaRequirement,
  selectCanonicalRankingCut
} from '../catalogCleanup.js';

const entries = Array.from({ length: 205 }, (_, index) => ({
  snapshotId: 'snapshot',
  entityId: `source-${index}`,
  canonicalEntityId: `player-${index}`,
  rawValue: String(500 - index),
  rank: index + 1,
  scoreValue: Math.min(index + 1, 100),
  tieGroup: index + 1,
  sourceRank: index + 1,
  rankingPosition: index + 1,
  entryOrder: index + 1,
  evidence: {}
}));

const cut = selectCanonicalRankingCut(entries);
assert.equal(MAX_GAME_RANKING_ENTRIES, 200);
assert.equal(cut.length, 200);
assert.equal(new Set(cut.map((entry) => entry.canonicalEntityId)).size, 200);
assert.equal(cut[0]?.canonicalEntityId, 'player-0');
assert.equal(cut.at(-1)?.canonicalEntityId, 'player-199');

const tied = selectCanonicalRankingCut([
  { ...entries[0]!, entityId: 'a', canonicalEntityId: 'same', rank: 1, tieGroup: 1, entryOrder: 1 },
  { ...entries[1]!, entityId: 'b', canonicalEntityId: 'same', rank: 1, tieGroup: 1, entryOrder: 2 },
  { ...entries[2]!, entityId: 'c', canonicalEntityId: 'other', rank: 2, tieGroup: 2, entryOrder: 3 }
]);
assert.deepEqual(tied.map((entry) => entry.canonicalEntityId), ['same', 'other']);

assert.equal(isSnapshotEligibleForCatalog('superseded', 'published'), false);
assert.equal(isSnapshotEligibleForCatalog('draft', 'retired'), false);
assert.equal(isSnapshotEligibleForCatalog('draft', 'published'), true);
assert.equal(mediaRequirement('player', 'excluded_from_game', false), 'media_not_required');
assert.equal(mediaRequirement('player', 'active', false), 'media_not_required');
assert.equal(mediaRequirement('player', 'active', true), 'required');
assert.equal(mediaRequirement('club', 'active', false), 'required');
assert.equal(isAllowedInChallenge('excluded_from_game'), false);
assert.equal(isAllowedInChallenge('superseded'), false);
assert.equal(isAllowedInChallenge('active'), true);
assert.equal(isPlayableWithExplicitProfile('active', false), false);
assert.equal(isPlayableWithExplicitProfile('active', true), true);
assert.equal(isPlayableWithExplicitProfile('excluded_from_game', true), false);
assert.deepEqual(decideIdentityReview(1), { resolutionStatus: 'confirmed_existing_canonical', autoCorrected: false });
assert.deepEqual(decideIdentityReview(0), { resolutionStatus: 'not_found', autoCorrected: false });
assert.deepEqual(decideIdentityReview(2), { resolutionStatus: 'not_found', autoCorrected: false });

console.log('catalog cleanup tests passed');
