import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScopeDecision, buildScopeDecisionBundle, type ScopeDecision } from '../rankingScopeDecisions.js';

const makeDecision = (categorySlug: string): ScopeDecision => buildScopeDecision({
  categorySlug,
  currentLabel: 'Etiqueta actual',
  proposedExactLabel: categorySlug === 'uefa-champions-league-goals' ? 'Goles históricos — Copa de Europa / UEFA Champions League (sin rondas de clasificación)' : 'Goles históricos — Copa Mundial masculina (fases finales)',
  decisionStatus: 'proposed_not_approved',
  whatItMeasures: 'Goles de jugadores en la competición masculina definida.',
  finalDefinition: {
    entityType: 'player', metric: 'goals', competition: 'competición masculina', temporalWindow: categorySlug === 'world-cup-goals' ? '1930–2026 inclusive' : '1955/56–2025/26', snapshotCutoff: '2026-09-12', tournamentPhase: categorySlug === 'world-cup-goals' ? 'solo fases finales' : 'torneo principal sin clasificación', gender: 'masculino', countingRule: 'goles oficiales; empates por valor exacto'
  },
  included: ['partidos oficiales de la competición'],
  excluded: ['clasificatorias', 'amistosos', 'juveniles', 'otras competiciones'],
  sourceAuthority: { semanticAuthority: 'fuente oficial', numericPrimarySource: 'fuente archivada provisional', conflictRule: 'no mezclar ni sobrescribir automáticamente' },
  lineage: { rankingSnapshotId: 'ranking-1', rankingDataVersion: 'data-v1', rankingAlgorithmVersion: 'algorithm-v1', rankingContentSha256: 'a'.repeat(64), primarySourceSnapshotId: 'source-1', primarySourceContentSha256: 'b'.repeat(64), officialContrastSnapshotId: null, officialContrastContentSha256: null },
  valueCheck: { top20Checked: 20, top20ValuesMatchArchivedPrimary: true, definitionScopeExplicit: true, note: 'solo consistencia archivada' },
  conflicts: [], abbreviatedIdentities: [], openDiscrepancies: ['derechos abiertos'], approvalGates: ['resolver derechos'], rightsStatus: 'review_required'
});

test('la decisión fija ventanas y exclusiones sin aprobar datos', () => {
  const uefa = makeDecision('uefa-champions-league-goals');
  const worldCup = makeDecision('world-cup-goals');
  assert.equal(uefa.finalDefinition.temporalWindow, '1955/56–2025/26');
  assert.match(uefa.finalDefinition.tournamentPhase, /sin clasificación/u);
  assert.equal(worldCup.finalDefinition.temporalWindow, '1930–2026 inclusive');
  assert.match(worldCup.finalDefinition.tournamentPhase, /fases finales/u);
  for (const decision of [uefa, worldCup]) {
    assert.equal(decision.decisionStatus, 'proposed_not_approved');
    assert.equal(decision.readOnly, true);
    assert.equal(decision.productionData, false);
    assert.equal(decision.editorialApproval, false);
    assert.equal(decision.rightsStatus, 'review_required');
  }
});

test('la huella del bundle y de las decisiones es determinista', () => {
  const first = buildScopeDecisionBundle([makeDecision('world-cup-goals'), makeDecision('uefa-champions-league-goals')]);
  const second = buildScopeDecisionBundle([makeDecision('world-cup-goals'), makeDecision('uefa-champions-league-goals')]);
  assert.deepEqual(first, second);
  assert.deepEqual(first.decisions.map((decision) => decision.categorySlug), ['uefa-champions-league-goals', 'world-cup-goals']);
  assert.equal(first.editorialApproval, false);
});
