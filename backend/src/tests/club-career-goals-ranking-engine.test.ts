import assert from 'node:assert/strict';
import { buildClubGoalsSnapshot, compareClubGoalsRankings, importClubGoalFactsIdempotently, type ClubGoalFact } from '../clubCareerGoalsRankingEngine.js';

const base = (id: string, player: string, goals: number, competition = 'api-football:club-competition:39'): ClubGoalFact => ({
  id, canonicalPlayerId: `clubgoals:player:${player}`, sourcePlayerId: player, playerNameAtSource: player,
  clubProviderId: 1, clubNameAtSource: 'Fixture FC', competition: { id: competition, providerId: 39, name: 'Premier League', country: 'England' }, seasonStart: 2026, seasonLabel: '2026/27', recordType: 'season_stat', matchId: null, matchDate: null, matchType: 'official_competition', goals, sourceKey: 'fixture', sourceCaptureId: 'fixture-capture', sourceRecordId: id, sourceType: 'primary', verificationStatus: 'confirmed', scopeEligible: true, evidence: { sourceUrl: 'https://fixture.invalid/club-goals', locator: `fixture.${id}` }, capturedAt: '2026-09-18T00:00:00.000Z'
});
const facts = [base('a', 'player-a', 5), base('b', 'player-b', 5), base('c', 'player-c', 2)];
const first = importClubGoalFactsIdempotently([], facts);
const second = importClubGoalFactsIdempotently(facts, facts);
assert.equal(first.added.length, 3); assert.equal(second.added.length, 0); assert.equal(second.skipped.length, 3); assert.equal(second.conflicts.length, 0);
const snapshot = buildClubGoalsSnapshot({ facts, dataset: 'active_weekly', seasonStart: 2026, seasonEnd: 2026, coverage: [{ competitionId: 'api-football:club-competition:39', providerId: 39, name: 'Premier League', country: 'England', seasonStart: 2026, status: 'covered', playerPages: 1, playerRecords: 3, facts: 3, reason: 'fixture' }], coverageComplete: true });
assert.equal(snapshot.ranking[0]?.rawValue, 5); assert.equal(snapshot.ranking[0]?.tieGroup, snapshot.ranking[1]?.tieGroup); assert.equal(snapshot.ranking[0]?.rank, 1); assert.equal(snapshot.ranking[1]?.rank, 1);
const updated = buildClubGoalsSnapshot({ facts: [...facts, base('d', 'player-d', 7)], dataset: 'active_weekly', seasonStart: 2026, seasonEnd: 2026, coverage: snapshot.coverage, coverageComplete: true });
const changes = compareClubGoalsRankings(snapshot.ranking, updated.ranking); assert.ok(changes.some((change) => change.canonicalPlayerId === 'clubgoals:player:player-d' && change.nextRank === 1));
const conflict = importClubGoalFactsIdempotently(facts, [{ ...facts[0]!, goals: 6 }]); assert.equal(conflict.conflicts.length, 1);
console.log(JSON.stringify({ status: 'passed', facts: facts.length, idempotent: second.added.length === 0, tie: true, update: true, conflict: true }));
