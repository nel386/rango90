import assert from 'node:assert/strict';
import { buildClubCardsSnapshot, compareClubCardsRankings, importClubCardFactsIdempotently, rollbackClubCardsSnapshot, type ClubCardFact } from '../clubCardsRankingEngine.js';

const base = (id: string, player: string, yellowCards: number | null, redCards: number | null, redSecondYellow: number | null = null, redDirect: number | null = null): ClubCardFact => ({
  id, canonicalPlayerId: `player:${player}`, sourcePlayerId: player, playerNameAtSource: player, clubProviderId: 1, clubNameAtSource: 'Club', competition: { id: 'league:1', providerId: 1, name: 'League', country: 'Test' }, seasonStart: 2026, seasonLabel: '2026/27', recordType: 'season_stat', matchId: null, matchDate: null, matchType: 'official_competition', yellowCards, redCards, redSecondYellow, redDirect, sourceKey: 'fixture', sourceCaptureId: `capture:${id}`, sourceRecordId: id, sourceType: 'primary', verificationStatus: 'confirmed', scopeEligible: true, evidence: { sourceUrl: 'https://example.test/cards', locator: id, contentSha256: id }, capturedAt: '2026-09-18T00:00:00.000Z'
});
const coverage = [{ competitionId: 'league:1', providerId: 1, name: 'League', country: 'Test', seasonStart: 2026, status: 'complete' as const, playerPages: 1, playerRecords: 3, yellowCards: 5, redCards: 2, reason: 'fixture' }];
const facts = [base('a', 'A', 3, 1, 0, 1), base('b', 'B', 3, 1, 1, 0), base('c', 'C', null, null)];
const yellow = buildClubCardsSnapshot({ facts, cardKind: 'yellow', dataset: 'active_weekly', seasonStart: 2026, seasonEnd: 2026, coverage, coverageComplete: true, generatedAt: '2026-09-18T00:00:00.000Z' });
const red = buildClubCardsSnapshot({ facts, cardKind: 'red', dataset: 'active_weekly', seasonStart: 2026, seasonEnd: 2026, coverage, coverageComplete: true, generatedAt: '2026-09-18T00:00:00.000Z', redTypesDifferentiated: true });
assert.equal(yellow.ranking.length, 2); assert.equal(yellow.ranking[0]?.rawValue, 3); assert.equal(yellow.ranking[0]?.tieGroup, yellow.ranking[1]?.tieGroup);
assert.equal(red.ranking.length, 2); assert.equal(red.ranking[0]?.rawValue, 1); assert.equal(red.metadata.redTypesDifferentiated, true);
assert.equal(importClubCardFactsIdempotently(facts, facts).added.length, 0); assert.equal(importClubCardFactsIdempotently(facts, [base('a', 'A', 4, 1, 0, 1)]).conflicts.length, 1);
const changed = buildClubCardsSnapshot({ facts: [...facts, base('d', 'D', 5, 0, 0, 0)], cardKind: 'yellow', dataset: 'active_weekly', seasonStart: 2026, seasonEnd: 2026, coverage, coverageComplete: true, generatedAt: '2026-09-19T00:00:00.000Z' });
assert.ok(compareClubCardsRankings(yellow.ranking, changed.ranking).some((entry) => entry.canonicalPlayerId === 'player:D'));
const rollback = rollbackClubCardsSnapshot({ target: yellow, parentSnapshotId: null, reason: 'fixture' }); assert.equal(rollback.snapshot.status, 'rolled_back'); assert.equal(rollback.snapshot.rollbackOf, yellow.id);
console.log(JSON.stringify({ status: 'passed', yellowEntries: yellow.ranking.length, redEntries: red.ranking.length, tie: true, idempotent: true, conflict: true, rollback: true }));
