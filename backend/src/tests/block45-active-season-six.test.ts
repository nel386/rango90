import assert from 'node:assert/strict';

process.env.BLOCK45_SEASON_SIX_TEST_ONLY = '1';
const { extractFacts, rankFacts, validatePlayers } = await import('../tools/block45-active-season-six.js');
const league = { id: 94, name: 'Primeira Liga', type: 'League', season: 2026 };

const rows = [
  { player: { id: 10, name: 'A. Player' }, statistics: [
    { league, team: { id: 20, name: 'Porto' }, cards: { yellow: 2 } },
    { league, team: { id: 21, name: 'Braga' }, cards: { yellow: 0 } },
  ] },
  { player: { id: 11, name: 'B. Player' }, statistics: [
    { league, team: { id: 20, name: 'Porto' }, cards: { yellow: 2 } },
  ] },
  { player: { id: 12, name: 'C. Player' }, statistics: [
    { league, team: { id: 21, name: 'Braga' }, cards: { yellow: 1 } },
  ] },
  { player: { id: 13, name: 'Zero Player' }, statistics: [
    { league, team: { id: 21, name: 'Braga' }, cards: { yellow: 0 } },
  ] },
];

assert.deepEqual(validatePlayers(rows, 1), []);
assert.match(validatePlayers([{ player: { id: 14, name: 'Bad' }, statistics: [{ league, team: {}, cards: { yellow: null } }] }], 2)[0] ?? '', /identity_season_team_or_yellow_invalid/u);
const facts = extractFacts(rows, 1, 'a'.repeat(64), '/players?league=94&season=2026&page=1');
assert.equal(facts.length, 5, 'explicit zero facts are retained in evidence');
assert.ok(facts.every((fact) => fact.competitionName === 'Primeira Liga' && fact.competitionType === 'League'));

const coverage = [{ facts: facts.length, league: 'Primeira Liga', leagueId: 94, pagesExpected: 1, pagesRead: 1, playersReturned: 4, reason: 'fixture', season: 2026, status: 'complete' }];
const ranking = rankFacts(facts, coverage).find((league) => league.leagueId === 94)!;
assert.equal(ranking.coverage.verifiedFactRows, 5);
assert.equal(ranking.coverage.explicitZeroCardFacts, 2);
assert.equal(ranking.rows.length, 3, 'zero-only player is not ranked');
assert.deepEqual(ranking.rows.slice(0, 2).map((row) => [row.yellowCards, row.rank, row.tieGroup]), [[2, 1, 1], [2, 1, 1]]);
assert.deepEqual(ranking.rows[0]?.evidence.map((fact) => fact.yellowCards), [2, 0]);
assert.equal(ranking.rows[2]?.rank, 3, 'competition ranking leaves a gap after tied first place');
assert.equal(ranking.rows[2]?.tieGroup, 2);

console.log('block45 active season six tests passed');
