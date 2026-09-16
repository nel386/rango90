import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePriorityRanking, type PriorityCurrentEntry, type PriorityIdentityContext, type PrioritySourceSnapshot } from '../priorityRankingValidation.js';

const source: PrioritySourceSnapshot = {
  categorySlug: 'world-cup-goals',
  source: { key: 'fixture', name: 'Fixture', baseUrl: 'https://source.test/ranking', rightsStatus: 'approved' },
  dataVersion: 'fixture-data-v1', coverageComplete: true, reviewed: true,
  entries: [
    { entityId: 'src-a', entityType: 'player', name: 'Ronaldo', rawValue: 15, evidence: { profileUrl: 'https://source.test/ronaldo', sourceUrl: 'https://source.test/ranking', sourceRank: 1 } },
    { entityId: 'src-b', entityType: 'player', name: 'Player Two', rawValue: 10, evidence: { profileUrl: 'https://source.test/player-two', sourceUrl: 'https://source.test/ranking', sourceRank: 2 } },
    { entityId: 'src-c', entityType: 'player', name: 'Player Three', rawValue: 10, evidence: { profileUrl: 'https://source.test/player-three', sourceUrl: 'https://source.test/ranking', sourceRank: 3 } }
  ]
};

const current = (entityId: string, value: number, rank: number, tieGroup: number, profileUrl: string, mediaStatus: PriorityCurrentEntry['mediaStatus'] = 'licensed'): PriorityCurrentEntry => ({
  entityId, sourceEntityId: entityId, sourceName: entityId, canonicalName: entityId, value, rank, score: rank, tieGroup,
  identityStatus: 'canonical', playable: true, mediaStatus, evidenceUrls: ['https://source.test/ranking', profileUrl]
});

const context: PriorityIdentityContext = {
  profileUrlsByEntity: {
    'player-a': ['https://source.test/ronaldo'],
    'player-b': ['https://source.test/player-two'],
    'player-c': ['https://source.test/player-three']
  },
  entitiesByProfileUrl: {
    'https://source.test/ronaldo': ['player-a'],
    'https://source.test/player-two': ['player-b'],
    'https://source.test/player-three': ['player-c']
  },
  imageByEntity: {
    'player-a': [{ provider: 'owned', reviewStatus: 'approved', rightsEvidenceUrl: 'https://rights.test/a', rightsVerifiedAt: '2026-09-16T00:00:00.000Z', sourceUrl: 'https://images.test/a', localPath: 'portraits/a.jpg' }],
    'player-b': [],
    'player-c': [{ provider: 'owned', reviewStatus: 'approved', rightsEvidenceUrl: 'https://rights.test/c', rightsVerifiedAt: '2026-09-16T00:00:00.000Z', sourceUrl: 'https://images.test/c', localPath: 'portraits/c.jpg' }]
  }
};

const baseCurrent = {
  categorySlug: source.categorySlug,
  rankingSnapshotId: 'ranking-1', sourceSnapshotId: 'source-1', source: source.source,
  snapshot: { dataVersion: 'ranking-data-v1', algorithmVersion: 'ranking-v1', contentSha256: 'a'.repeat(64), generatedAt: '2026-09-16T00:00:00.000Z', coverageComplete: true, reviewed: true, sourceContentSha256: 'b'.repeat(64), sourceStorageUri: 'storage/source-snapshots/fixture.json' },
  sourceAudit: source.audit
};

test('valida identidad por perfil, detecta valor/ranking/empate e imagen faltante', () => {
  const report = validatePriorityRanking({ ...baseCurrent, top20: [
    current('player-a', 15, 1, 1, 'https://source.test/ronaldo'),
    current('player-b', 9, 3, 3, 'https://source.test/player-two', 'fallback'),
    current('player-c', 10, 2, 2, 'https://source.test/player-three')
  ] }, source, context, []);
  assert.equal(report.entries[0]?.identityStatus, 'confirmado');
  assert.ok(report.entries[0]?.issues.some((item) => item.code === 'short_or_ambiguous_source_name'));
  assert.ok(report.discrepancies.some((item) => item.code === 'source_value_mismatch' && item.type === 'error de fuente'));
  assert.ok(report.discrepancies.some((item) => item.code === 'rank_mismatch_against_source' && item.type === 'error de cálculo'));
  assert.ok(report.discrepancies.some((item) => item.code === 'tie_group_mismatch_against_source' && item.type === 'error de cálculo'));
  assert.ok(report.discrepancies.some((item) => item.code === 'image_unavailable' && item.type === 'problema de imagen'));
  assert.equal(report.editorialApproval, false);
  assert.equal(report.readOnly, true);
});

test('la validación es determinista y conserva la regla de empates', () => {
  const input = { ...baseCurrent, top20: [current('player-a', 15, 1, 1, 'https://source.test/ronaldo'), current('player-b', 10, 2, 2, 'https://source.test/player-two'), current('player-c', 10, 2, 2, 'https://source.test/player-three')] };
  const reportA = validatePriorityRanking(input, source, context, []);
  const reportB = validatePriorityRanking(input, source, context, []);
  assert.deepEqual(reportA, reportB);
  assert.equal(reportA.entries[1]?.expectedTieGroupFromSource, reportA.entries[2]?.expectedTieGroupFromSource);
  assert.equal(reportA.entries[1]?.tieStatus, 'confirmado');
  assert.equal(reportA.entries[2]?.tieStatus, 'confirmado');
  assert.match(reportA.recommendation, /No aprobar ni publicar/u);
});
