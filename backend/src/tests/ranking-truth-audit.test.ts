import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRankingTruthAudit, rankingTruthCsv, rankingTruthJson, rankingTruthMarkdown, type AuditCategoryInput, type AuditEntryInput } from '../rankingTruthAudit.js';

const category: AuditCategoryInput = {
  slug: 'test-career-goals', labelEs: 'Goles globales en la carrera', labelEn: 'Global career goals',
  definition: 'Fixture', entityType: 'player', metricKey: 'goals', scopeKind: 'career_global', scope: { officialOnly: true },
  categoryStatus: 'draft', snapshotId: 'snapshot-1', snapshotStatus: 'draft', dataVersion: 'data-1', algorithmVersion: 'algorithm-1',
  contentSha256: 'a'.repeat(64), generatedAt: '2026-09-16T00:00:00.000Z', coverageComplete: false, unresolvedConflicts: 0,
  eligibleCount: 3, scoreCap: 100, snapshotRowsTotal: 3, sourceSnapshotId: 'source-1', sourceKey: 'fixture', sourceName: 'Fixture source', sourceBaseUrl: 'https://example.test/source',
  sourceRightsStatus: 'review_required', sourceRetrievedAt: '2026-09-15T00:00:00.000Z', sourcePublishedAt: null, sourceStorageUri: null, sourceContentSha256: 'b'.repeat(64),
  sourceMetadata: { startSeason: '2000', endSeason: '2026', partial: true }, snapshotMetadata: {}, rankingDirection: 'desc'
};

const entry = (sourceEntityId: string, canonicalEntityId: string | null, value: number, rank: number, scoreValue = rank, tieGroup = rank): AuditEntryInput => ({
  categorySlug: category.slug, snapshotId: 'snapshot-1', sourceEntityId, sourceName: sourceEntityId, sourceEntityType: 'player', canonicalEntityId,
  canonicalName: canonicalEntityId ? `Player ${canonicalEntityId}` : null, canonicalEntityType: canonicalEntityId ? 'player' : null, rawValue: value, rank, scoreValue, tieGroup,
  evidence: { sourceSnapshotId: 'source-1', sourceUrl: 'https://example.test/row' }, playable: true, catalogStatus: 'active', externalIds: [], aliases: [], media: []
});

test('auditor detecta cobertura parcial, duplicados y conserva top 20 trazable', () => {
  const report = buildRankingTruthAudit(category ? [category] : [], [
    entry('source-a', 'player-a', 10, 1, 1, 1),
    entry('source-b', 'player-a', 9, 2, 2, 2),
    entry('source-c', null, 0, 3, 3, 3)
  ], [category.slug]);
  const result = report.categories[0];
  assert.ok(result);
  assert.equal(result.editorialStatus, 'provisional');
  assert.equal(result.counts.rowsAudited, 3);
  assert.equal(result.counts.snapshotRowsTotal, 3);
  assert.equal(result.counts.duplicateCanonicalEntries, 2);
  assert.equal(result.counts.rowsWithZeroOrNegativeValue, 1);
  assert.equal(result.definition.labelHonestForObservedScope, false);
  assert.deepEqual(result.top20[0]?.evidenceUrls, ['https://example.test/row', 'https://example.test/source']);
  assert.ok(result.anomalies.some((anomaly) => anomaly.code === 'global_label_overclaims_scope'));
});

test('renderizado y hashes son deterministas', () => {
  const reportA = buildRankingTruthAudit([category], [entry('source-a', 'player-a', 10, 1)], [category.slug]);
  const reportB = buildRankingTruthAudit([category], [entry('source-a', 'player-a', 10, 1)], [category.slug]);
  assert.equal(rankingTruthJson(reportA), rankingTruthJson(reportB));
  assert.equal(rankingTruthMarkdown(reportA), rankingTruthMarkdown(reportB));
  assert.equal(rankingTruthCsv(reportA), rankingTruthCsv(reportB));
  assert.deepEqual(reportA.hashes, reportB.hashes);
  assert.match(rankingTruthCsv(reportA), /record_type/);
  assert.match(rankingTruthMarkdown(reportA), /Top 20 trazable/);
});

test('las posiciones y scores inconsistentes quedan bloqueados', () => {
  const inconsistent = buildRankingTruthAudit([category], [entry('source-a', 'player-a', 10, 2, 99, 7)], [category.slug]);
  const codes = new Set(inconsistent.categories[0]?.anomalies.map((anomaly) => anomaly.code));
  assert.ok(codes.has('rank_mismatch'));
  assert.ok(codes.has('tie_group_mismatch'));
  assert.ok(codes.has('score_mismatch'));
});
