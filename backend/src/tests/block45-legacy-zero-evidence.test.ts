import assert from 'node:assert/strict';
import { eligibleYellowCardPlayerIds } from '../clubYellowCardsCareerRankingEngine.js';
import {
  BLOCK45E_RESOLVED_LEAGUE_ZERO_ROWS,
  resolveBlock45LegacyZeroRow
} from '../tools/block45-legacy-zero-evidence.js';
import { factFromStats } from '../tools/block45-yellow-card-fact.js';
import { computeBlock45AttemptBudget } from '../tools/block45-quota-budget.js';

const responseHash = 'a'.repeat(64);
const sourceUrl = 'https://api-football.test/players?id=1&season=2007';

function statFor(row: typeof BLOCK45E_RESOLVED_LEAGUE_ZERO_ROWS[number]) {
  return {
    league: { id: 0, name: row.competitionName, season: row.season },
    team: { id: row.teamId, name: row.caseId },
    games: { appearences: 30, minutes: 2400 },
    cards: { yellow: row.yellowCards }
  };
}

function playerFor(row: typeof BLOCK45E_RESOLVED_LEAGUE_ZERO_ROWS[number]) {
  return { id: row.playerId, name: row.caseId };
}

for (const row of BLOCK45E_RESOLVED_LEAGUE_ZERO_ROWS) {
  const statistic = statFor(row);
  const player = playerFor(row);

  for (const eligibilityMajorLeagueId of [null, row.attributedCompetitionId]) {
    const fact = factFromStats(player, statistic, row.season, sourceUrl, 1, responseHash, eligibilityMajorLeagueId);
    assert.ok(fact, `${row.caseId} exact evidence should produce an attributed fact`);
    assert.equal(fact.competitionProviderId, row.attributedCompetitionId);
    assert.equal(fact.competitionAttribution?.caseId, row.caseId);
    assert.equal(fact.competitionAttribution?.auditResponseSha256, row.auditResponseSha256);
    assert.equal(fact.eligibilityMajorLeagueId, eligibilityMajorLeagueId,
      'competition attribution must not change independent ranking eligibility');
  }

  const mutations: Array<{ label: string; playerId?: number; season?: number; league?: Record<string, unknown>; team?: Record<string, unknown>; cards?: Record<string, unknown> }> = [
    { label: 'player', playerId: row.playerId + 1 },
    { label: 'season', season: row.season + 1 },
    { label: 'competition name', league: { ...statistic.league, name: `${row.competitionName} changed` } },
    { label: 'competition ID', league: { ...statistic.league, id: 9 } },
    { label: 'team', team: { ...statistic.team, id: row.teamId + 1 } },
    { label: 'yellow cards', cards: { yellow: row.yellowCards + 1 } }
  ];
  for (const mutation of mutations) {
    const mutated = {
      ...statistic,
      ...(mutation.league ? { league: mutation.league } : {}),
      ...(mutation.team ? { team: mutation.team } : {}),
      ...(mutation.cards ? { cards: mutation.cards } : {})
    };
    const resolved = resolveBlock45LegacyZeroRow({
      playerId: mutation.playerId ?? row.playerId,
      season: mutation.season ?? row.season,
      eligibilityMajorLeagueId: null,
      statistic: mutated
    });
    assert.equal(resolved, null, `${row.caseId} changed ${mutation.label} must not match its exact evidence row`);
    if (mutation.label !== 'competition ID') {
      assert.equal(factFromStats(
        { ...player, id: mutation.playerId ?? row.playerId },
        mutated,
        mutation.season ?? row.season,
        sourceUrl,
        1,
        responseHash,
        null
      ), null, `${row.caseId} changed ${mutation.label} must not be admitted as a fact`);
    } else {
      const fact = factFromStats(player, mutated, row.season, sourceUrl, 1, responseHash, null);
      assert.ok(fact, 'a positive provider competition can still be represented as its own source fact');
      assert.equal(fact.competitionAttribution, undefined, 'a different competition ID must not inherit the exact zero-ID attribution');
      assert.equal(fact.competitionProviderId, 9);
    }
  }
  assert.equal(resolveBlock45LegacyZeroRow({
    playerId: row.playerId,
    season: row.season,
    eligibilityMajorLeagueId: row.attributedCompetitionId === 140 ? 78 : 140,
    statistic
  }), null, `${row.caseId} must reject an independently recorded eligibility league mismatch`);
}

const riberyRows = BLOCK45E_RESOLVED_LEAGUE_ZERO_ROWS.filter((row) => row.playerId === 515);
const ineligibleAttributedFacts = riberyRows.map((row) => {
  const fact = factFromStats(playerFor(row), statFor(row), row.season, sourceUrl, 1, responseHash, null);
  assert.ok(fact);
  assert.equal(fact.competitionAttribution?.caseId, row.caseId);
  return fact;
});
assert.equal(eligibleYellowCardPlayerIds(ineligibleAttributedFacts, [2007, 2009]).has('api-football:player:515'), false,
  'two attributed seasons with null independent eligibility must not make the player eligible');

const independentlyEligibleFacts = ineligibleAttributedFacts.map((fact) => ({
  ...fact,
  eligibilityMajorLeagueId: 78
}));
assert.equal(eligibleYellowCardPlayerIds(independentlyEligibleFacts, [2007, 2009]).has('api-football:player:515'), true,
  'eligibility is determined by the independent eligibility field, not the attribution metadata');

assert.equal(computeBlock45AttemptBudget({
  dailyRemainingAfterPreflight: 500, perMinuteLimit: 300, requestedMaxAttempts: 0, pendingWork: 185_978
}).effectiveAttemptBudget, 451, 'auto batch size must use observed daily quota, keep a 10% reserve and count /status');
assert.equal(computeBlock45AttemptBudget({
  dailyRemainingAfterPreflight: 10, perMinuteLimit: 300, requestedMaxAttempts: 800, pendingWork: 50
}).effectiveAttemptBudget, 10, 'batch size must shrink to the current quota even when the caller supplies a larger ceiling');
assert.equal(computeBlock45AttemptBudget({
  dailyRemainingAfterPreflight: 1_000, perMinuteLimit: null, requestedMaxAttempts: 0, pendingWork: 20
}).effectiveAttemptBudget, 21, 'batch size must stop at the remaining pending work');
assert.equal(computeBlock45AttemptBudget({
  dailyRemainingAfterPreflight: 1_000, perMinuteLimit: null, requestedMaxAttempts: 0, pendingWork: 10_000
}).effectiveAttemptBudget, 400, 'unknown minute limits must use the conservative runtime ceiling');

console.log('BLOCK45 exact attribution, independent eligibility and quota-aware batch tests passed');
