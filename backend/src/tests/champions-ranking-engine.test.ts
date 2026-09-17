import assert from 'node:assert/strict';
import {
  CHAMPIONS_CATEGORY_SLUG,
  adaptApiFootballChampionsMatches,
  appendSnapshot,
  buildChampionsRanking,
  buildChampionsSnapshot,
  buildWeeklyChampionsUpdate,
  compareChampionsRankings,
  createGoalFact,
  detectChampionsConflicts,
  editionForSeason,
  importFactsIdempotently,
  normalizeChampionsPhase,
  publishChampionsSnapshot,
  resolvePlayerIdentity,
  rollbackChampionsSnapshot,
  type ChampionsGoalFact
} from '../championsRankingEngine.js';

const scopeCoverage = [{ sourceKey: 'manual-history', coveredSeasons: [1955, 1991], missingSeasons: [], complete: true, reason: 'fixture complete' }];
const oldEdition = editionForSeason(1955);
const modernEdition = editionForSeason(2025);
const sharedPlayer = resolvePlayerIdentity({ sourceKey: 'manual-history', sourcePlayerId: 'old-1', displayName: 'Alfredo Di Stéfano' }, { aliases: { 'alfredo di stefano': 'player:di-stefano' }, displayNames: { 'player:di-stefano': 'Alfredo Di Stéfano' } });
const modernSharedPlayer = resolvePlayerIdentity({ sourceKey: 'api-football', sourcePlayerId: 'modern-10', displayName: 'A. Di Stefano' }, { sourceIds: { 'api-football:modern-10': 'player:di-stefano' }, displayNames: { 'player:di-stefano': 'Alfredo Di Stéfano' } });

function fixtureFact(input: {
  id: string;
  edition: ReturnType<typeof editionForSeason>;
  player: ReturnType<typeof resolvePlayerIdentity>;
  matchId: string;
  phase?: ReturnType<typeof normalizeChampionsPhase>;
  goals?: number;
  sourceKey?: string;
  sourceCaptureId?: string;
  sourceRecordId?: string;
}): ChampionsGoalFact {
  return createGoalFact({
    id: input.id,
    edition: input.edition,
    player: input.player,
    match: { id: input.matchId, date: '1956-06-13', homeTeam: 'Real Madrid', awayTeam: 'Stade de Reims' },
    phase: input.phase ?? 'final',
    goals: input.goals ?? 1,
    sourceKey: input.sourceKey ?? 'manual-history',
    sourceCaptureId: input.sourceCaptureId ?? 'capture-1',
    sourceRecordId: input.sourceRecordId ?? input.id,
    evidence: { sourceUrl: 'https://example.test/champions-fixture', locator: `fixture:${input.matchId}` },
    capturedAt: '2026-09-17T00:00:00.000Z'
  });
}

assert.equal(oldEdition.competitionName, 'Copa de Europa');
assert.equal(oldEdition.era, 'european_cup');
assert.equal(modernEdition.competitionName, 'UEFA Champions League');
assert.equal(modernEdition.era, 'champions_league');
assert.equal(normalizeChampionsPhase('First qualifying round'), 'qualifying');
assert.equal(normalizeChampionsPhase('Quarter-finals'), 'quarter_final');

const facts = [
  fixtureFact({ id: 'old-goal-1', edition: oldEdition, player: sharedPlayer, matchId: 'old-final', goals: 2 }),
  fixtureFact({ id: 'modern-goal-1', edition: modernEdition, player: modernSharedPlayer, matchId: 'modern-semi', goals: 3, sourceKey: 'api-football', sourceCaptureId: 'capture-modern' }),
  fixtureFact({ id: 'tie-a', edition: modernEdition, player: resolvePlayerIdentity({ sourceKey: 'manual-history', sourcePlayerId: 'tie-a', displayName: 'Player A' }), matchId: 'modern-a' }),
  fixtureFact({ id: 'tie-b', edition: modernEdition, player: resolvePlayerIdentity({ sourceKey: 'manual-history', sourcePlayerId: 'tie-b', displayName: 'Player B' }), matchId: 'modern-b' }),
  fixtureFact({ id: 'qualifying-goal', edition: modernEdition, player: resolvePlayerIdentity({ sourceKey: 'api-football', sourcePlayerId: 'qual-1', displayName: 'Qualifying Player' }), matchId: 'qualifying-match', phase: 'qualifying', sourceKey: 'api-football', sourceCaptureId: 'capture-modern' })
];

const ranking = buildChampionsRanking({ facts, coverage: scopeCoverage });
assert.equal(ranking.entries.find((entry) => entry.canonicalPlayerId === 'player:di-stefano')?.rawValue, 5);
assert.equal(ranking.entries.filter((entry) => entry.playerName === 'Qualifying Player').length, 0);
assert.equal(ranking.entries.find((entry) => entry.playerName === 'Player A')?.rank, ranking.entries.find((entry) => entry.playerName === 'Player B')?.rank);
assert.equal(ranking.coverageComplete, true);
assert.equal(ranking.entries.find((entry) => entry.canonicalPlayerId === 'player:di-stefano')?.eras.length, 2);
assert.equal(ranking.unresolvedIdentityFacts.length > 0, true);

const update = fixtureFact({ id: 'modern-goal-2', edition: modernEdition, player: modernSharedPlayer, matchId: 'modern-new-match', goals: 1, sourceKey: 'api-football', sourceCaptureId: 'capture-week-2' });
const updatedRanking = buildChampionsRanking({ facts: [...facts, update], coverage: scopeCoverage });
const changes = compareChampionsRankings(ranking.entries, updatedRanking.entries);
assert.equal(changes.find((change) => change.canonicalPlayerId === 'player:di-stefano')?.nextValue, 6);
const incompleteCoverage = buildChampionsRanking({ facts, coverage: [{ sourceKey: 'partial-source', coveredSeasons: [2025], missingSeasons: [1955, 1956], complete: false, reason: 'fixture source only covers the modern season' }] });
assert.equal(incompleteCoverage.coverageComplete, false);

const conflictA = fixtureFact({ id: 'conflict-a', edition: modernEdition, player: modernSharedPlayer, matchId: 'conflict-match', goals: 1, sourceKey: 'api-football', sourceCaptureId: 'capture-conflict-a' });
const conflictB = fixtureFact({ id: 'conflict-b', edition: modernEdition, player: modernSharedPlayer, matchId: 'conflict-match', goals: 2, sourceKey: 'historical-source-b', sourceCaptureId: 'capture-conflict-b' });
assert.equal(detectChampionsConflicts([conflictA, conflictB]).length, 1);
const conflictRanking = buildChampionsRanking({ facts: [conflictA, conflictB], coverage: scopeCoverage });
assert.equal(conflictRanking.entries.length, 0);
assert.equal(conflictRanking.conflicts.length, 1);

const imported = importFactsIdempotently([facts[0]!], [facts[0]!, facts[1]!]);
assert.equal(imported.skipped.length, 1);
assert.equal(imported.added.length, 1);
assert.equal(imported.facts.length, 2);

const api = adaptApiFootballChampionsMatches({
  sourceCaptureId: 'api-capture',
  capturedAt: '2026-09-17T00:00:00.000Z',
  sourceUrl: 'https://v3.football.api-sports.io/fixtures?league=2&season=2025',
  resolver: { sourceIds: { 'api-football:10': 'player:di-stefano' } },
  matches: [{
    fixture: { id: 9001, date: '2026-03-01T20:00:00+00:00' },
    league: { season: 2025, round: 'Round 16' },
    teams: { home: { name: 'Club A' }, away: { name: 'Club B' } },
    events: [
      { type: 'Goal', player: { id: 10, name: 'A. Di Stefano' }, team: { id: 1, name: 'Club A' }, detail: 'Normal Goal' },
      { type: 'Goal', player: { id: 11, name: 'Own Goal Player' }, team: { id: 2, name: 'Club B' }, detail: 'Own Goal' }
    ]
  }, {
    fixture: { id: 9002, date: '2026-03-08T20:00:00+00:00' },
    league: { season: 2025, round: 'First qualifying round' },
    events: [{ type: 'Goal', player: { id: 11, name: 'Excluded Player' } }]
  }]
});
assert.equal(api.facts.length, 2);
assert.equal(api.facts[0]?.phase, 'round_of_16');
assert.equal(api.facts[1]?.phase, 'qualifying');
assert.equal(api.anomalies.length, 0);

const historicalSnapshot = buildChampionsSnapshot({ facts, dataset: 'historical_base', seasonStart: 1955, seasonEnd: 2025, coverage: scopeCoverage, generatedAt: '2026-09-17T00:00:00.000Z' });
const weeklySnapshot = buildChampionsSnapshot({ facts: [...facts, update], dataset: 'active_season_weekly', seasonStart: 2025, seasonEnd: 2025, parentSnapshotId: historicalSnapshot.id, coverage: scopeCoverage, generatedAt: '2026-09-17T01:00:00.000Z' });
const weeklyUpdate = buildWeeklyChampionsUpdate({ historicalFacts: facts, activeSeasonFacts: [update], activeSeasonStart: 2025, previousSnapshot: historicalSnapshot, coverage: scopeCoverage, generatedAt: '2026-09-17T01:00:00.000Z' });
assert.equal(weeklyUpdate.snapshot.dataset, 'active_season_weekly');
assert.equal(weeklyUpdate.changes.some((change) => change.canonicalPlayerId === 'player:di-stefano'), true);
assert.equal(historicalSnapshot.categorySlug, CHAMPIONS_CATEGORY_SLUG);
assert.equal(historicalSnapshot.metadata.imagesUsed, false);
assert.equal(historicalSnapshot.unresolvedIdentityFacts.length > 0, true);
assert.equal(appendSnapshot([historicalSnapshot], historicalSnapshot).length, 1);
assert.equal(appendSnapshot([historicalSnapshot], weeklySnapshot).length, 2);
const rollback = rollbackChampionsSnapshot({ target: weeklySnapshot, parentSnapshotId: historicalSnapshot.id, reason: 'fixture rollback', generatedAt: '2026-09-17T02:00:00.000Z' });
assert.equal(rollback.snapshot.rollbackOf, weeklySnapshot.id);
assert.equal(rollback.snapshot.ranking.length, weeklySnapshot.ranking.length);
const divergentImport = importFactsIdempotently([facts[0]!], [{ ...facts[0]!, goals: 9 }]);
assert.equal(divergentImport.conflicts[0]?.reason, 'duplicate_source_record_with_different_value');
assert.throws(() => publishChampionsSnapshot({ snapshot: historicalSnapshot, authorization: { written: false } }), /autorización escrita/iu);
assert.throws(() => publishChampionsSnapshot({ snapshot: historicalSnapshot, authorization: { written: true, reviewedBy: 'qa' } }), /identidades resueltas/iu);

console.log('champions ranking engine tests passed');
