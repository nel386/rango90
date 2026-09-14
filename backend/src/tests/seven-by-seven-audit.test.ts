import assert from 'node:assert/strict';
import { auditSevenBySeven } from '../sevenBySevenAudit.js';

const categories = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((slug, index) => ({
  slug,
  snapshotId: `snapshot-${slug}`,
  top200EntityIds: new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', `unique-${index}`]),
  candidateBandEntityIds: new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'])
}));

const result = auditSevenBySeven(categories, 7, 7, 90, 3);
assert.equal(result.categoryCount, 8);
assert.equal(result.matchingCombinationCount, 8);
assert.equal(result.matches.length, 3);
assert.deepEqual(result.matches[0]?.commonCandidateBandEntityIds, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);

const insufficientBand = auditSevenBySeven(categories.slice(0, 7).map((category, index) => ({
  ...category,
  candidateBandEntityIds: index === 6 ? new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) : category.candidateBandEntityIds
})));
assert.equal(insufficientBand.matches.length, 0);

console.log('seven-by-seven audit tests passed');
