import assert from 'node:assert/strict';
import { buildClubCardsSnapshot, type ClubCardFact } from '../clubCardsRankingEngine.js';
import { planClubCardBatches } from '../clubCardsBatchPlanner.js';

const fact: ClubCardFact = {
  id: 'block38-fact-1', canonicalPlayerId: 'player-block38', sourcePlayerId: 'provider-1', playerNameAtSource: 'Block 38 Player',
  clubProviderId: 78, clubNameAtSource: 'Bundesliga Club', competition: { id: '78', providerId: 78, name: 'Bundesliga', country: 'Germany' },
  seasonStart: 2026, seasonLabel: '2026/27', recordType: 'season_stat', matchId: null, matchDate: null, matchType: 'official_competition',
  yellowCards: 4, redCards: 1, redSecondYellow: 0, redDirect: 1, sourceKey: 'block38-provider', sourceCaptureId: 'block38-capture', sourceRecordId: 'block38-record',
  sourceType: 'primary', verificationStatus: 'confirmed', scopeEligible: true,
  evidence: { sourceUrl: 'https://fixture.invalid/block38', locator: 'fixture.active-season', contentSha256: 'block38-hash' }, capturedAt: '2026-09-21T00:00:00.000Z'
};

const coverage = [{ competitionId: '78', providerId: 78, name: 'Bundesliga', country: 'Germany', seasonStart: 2026, status: 'partial' as const, playerPages: 8, playerRecords: 1, yellowCards: 4, redCards: 1, reason: 'La temporada activa continúa.' }];
for (const cardKind of ['yellow', 'red'] as const) {
  const snapshot = buildClubCardsSnapshot({ facts: [fact], cardKind, dataset: 'active_weekly', seasonStart: 2026, seasonEnd: 2026, coverage, coverageComplete: false, activeSeasonStatus: 'provisional_active_season', seasonInProgress: true, observedFacts: 140, observedPages: 8 });
  assert.equal(snapshot.metadata.candidateStatus, 'candidate');
  assert.equal(snapshot.metadata.activeSeasonStatus, 'provisional_active_season');
  assert.equal(snapshot.metadata.seasonInProgress, true);
  assert.equal(snapshot.coverageComplete, false);
  assert.equal(snapshot.ranking[0]?.rawValue, cardKind === 'yellow' ? 4 : 1);
}

for (const batch of [{ key: 'bundesliga', providerId: 78, name: 'Bundesliga' }, { key: 'ligue-1', providerId: 61, name: 'Ligue 1' }, { key: 'primeira-liga', providerId: 94, name: 'Primeira Liga' }]) {
  const independentPlan = planClubCardBatches({ quotaInitial: 7319, quotaReserve: 2, maxRequests: 8, batches: [{ ...batch, estimatedRequests: 8 }] });
  assert.equal(independentPlan.batches[0]?.status, 'planned');
}
console.log('block38-active-season: provisional snapshots accept valid in-progress data and batches remain independent: ok');
