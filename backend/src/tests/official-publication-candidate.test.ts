import assert from 'node:assert/strict';
import { buildOfficialPublicationCandidateReport, renderOfficialPublicationCandidateMarkdown, stableJson } from '../officialPublicationCandidate.js';

const slugs = ['uefa-champions-league-goals', 'world-cup-goals'];
const top20 = (slug: string) => Array.from({ length: 20 }, (_, index) => ({
  entityId: `${slug}:player:${index + 1}`,
  sourceEntityId: `${slug}:player:${index + 1}`,
  sourceName: `Player ${index + 1}`,
  canonicalName: `Player ${index + 1}`,
  value: 100 - index,
  rank: index + 1,
  score: index + 1,
  tieGroup: index + 1,
  identityStatus: 'canonical',
  playable: true,
  mediaStatus: 'licensed',
  evidenceUrls: ['https://source.test/ranking']
}));
const truth = {
  generatedAt: '2026-09-15T00:00:00.000Z',
  categories: slugs.map((slug) => ({
    slug,
    editorialStatus: 'provisional',
    snapshots: {
      ranking: { id: `rs-${slug}`, status: 'draft', dataVersion: 'data-v1', algorithmVersion: 'ranking-v1', contentSha256: 'a'.repeat(64), generatedAt: '2026-09-15T00:00:00.000Z' },
      source: { id: `src-${slug}`, key: `source-${slug}`, name: 'Fixture source', rightsStatus: 'review_required', contentSha256: 'b'.repeat(64), evidenceUrls: ['https://source.test/ranking'] }
    },
    observedScope: { coverageComplete: true },
    counts: { rowsAudited: 200, snapshotRowsTotal: 200, uniqueCanonicalEntities: 200, conflictingIdentityRows: 0, rowsWithZeroOrNegativeValue: 0 },
    rankingChecks: { deterministicRanks: true, deterministicScores: true, duplicateCanonicalEntities: true, tiedPositions: [] },
    top20: top20(slug)
  }))
};
const scope = { decisions: slugs.map((categorySlug) => ({ categorySlug, decisionStatus: 'proposed_not_approved', finalDefinition: { temporalWindow: 'test window' }, included: ['official matches'], excluded: ['qualifiers'], conflicts: categorySlug === slugs[0] ? [{ player: 'Player 1', primaryValue: 10, officialValue: 11, storedValue: 10, classification: 'diferencia de alcance', evidenceUrls: ['https://source.test/contrast'] }] : [] })) };
const validation = { categories: [], discrepancies: [] };
const media = { entries: slugs.flatMap((categorySlug) => top20(categorySlug).map((entry) => ({ ...entry, categorySlug, priority: false, isPublishable: true }))) };
const sourceArtifacts = [{ path: 'audits/ranking-truth/ranking-truth.json', sha256: '1'.repeat(64) }];

const first = buildOfficialPublicationCandidateReport({ truth, scope, validation, media, sourceArtifacts });
const second = buildOfficialPublicationCandidateReport({ truth, scope, validation, media, sourceArtifacts });
assert.deepEqual(first, second);
assert.equal(first.readOnly, true);
assert.equal(first.productionData, false);
assert.equal(first.execution.mutationCount, 0);
assert.equal(first.readyForApproval, false);
assert.equal(first.readyForPublication, false);
assert.equal(first.publicationProcedure.status, 'documented_not_executed');
assert.equal(first.publicationProcedure.requiresExplicitApproval, true);
assert.ok(first.blockingReasons.includes('uefa-champions-league-goals:source_rights'));
assert.ok(first.blockingReasons.includes('world-cup-goals:snapshot_status'));
assert.equal(first.categories[0]?.scope.openConflicts.length, 1);
assert.match(renderOfficialPublicationCandidateMarkdown(first), /no publica snapshots/u);
assert.equal(first.sha256, first.sha256);
assert.equal(stableJson(first), stableJson(second));

console.log('official publication candidate tests passed');
