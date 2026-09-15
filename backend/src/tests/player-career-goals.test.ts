import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlayerCareerGoalsRanking, type PlayerCareerGoalsDbRow } from '../playerCareerGoals.js';

const row = (overrides: Partial<PlayerCareerGoalsDbRow> = {}): PlayerCareerGoalsDbRow => ({
  entity_id: 'player:test',
  canonical_name: 'Test Player',
  club_goals: null,
  national_goals: null,
  club_source_snapshots: null,
  national_source_snapshots: null,
  national_source_entities: null,
  national_min_goals: null,
  national_max_goals: null,
  ...overrides
});

test('no convierte un componente ausente en cero', () => {
  const result = buildPlayerCareerGoalsRanking([row({ club_goals: '120', club_source_snapshots: ['src-club'] })]);
  assert.equal(result.entries[0]?.observedGoals, 120);
  assert.equal(result.entries[0]?.clubGoals, 120);
  assert.equal(result.entries[0]?.nationalTeamGoals, null);
  assert.deepEqual(result.entries[0]?.unknownComponents, ['senior_national_team']);
  assert.equal(result.entries[0]?.evidence.totalKind, 'observed_lower_bound');
  assert.equal(result.entries[0]?.evidence.noUnknownComponentImputation, true);
});

test('suma clubes y selección cuando ambos componentes están observados', () => {
  const result = buildPlayerCareerGoalsRanking([row({
    entity_id: 'player:complete',
    canonical_name: 'Complete Player',
    club_goals: '80',
    national_goals: '20',
    club_source_snapshots: ['src-club'],
    national_source_snapshots: ['src-national']
  })]);
  assert.equal(result.entries[0]?.observedGoals, 100);
  assert.deepEqual(result.entries[0]?.unknownComponents, []);
  assert.equal(result.entries[0]?.evidence.totalKind, 'observed_components');
  assert.deepEqual(result.entries[0]?.sourceSnapshotIds, ['src-club', 'src-national']);
});

test('excluye conflictos de identidad nacionales en vez de elegir silenciosamente un valor', () => {
  const result = buildPlayerCareerGoalsRanking([row({ club_goals: '100', national_goals: '30', national_min_goals: '30', national_max_goals: '31' })]);
  assert.equal(result.entries.length, 0);
  assert.equal(result.audit.identityConflictRows, 1);
});

test('ordena de forma determinista y no crea filas de relleno', () => {
  const result = buildPlayerCareerGoalsRanking([
    row({ entity_id: 'player:b', canonical_name: 'B', club_goals: '8' }),
    row({ entity_id: 'player:a', canonical_name: 'A', club_goals: '8' }),
    row({ entity_id: 'player:empty', canonical_name: 'Empty', club_goals: '0', national_goals: null })
  ], 200);
  assert.deepEqual(result.entries.map((entry) => entry.entityId), ['player:a', 'player:b']);
  assert.equal(result.audit.outputRows, 2);
  assert.equal(result.audit.excludedEmptyRows, 1);
});
