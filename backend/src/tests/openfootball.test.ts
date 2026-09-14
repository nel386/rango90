import assert from 'node:assert/strict';
import { buildOpenFootballClubTitleRanking, calculateOpenFootballWinner, parseFootballTxtResults } from '../providers/openFootballClient.js';

const fixture = `
= Example League 2023/24
# Teams 4

▪ Matchday 1
Sat Aug 12
  15:00  Alpha FC  2-0 (1-0)  Beta FC
         Gamma FC  1-1  Delta FC

▪ Matchday 2
Sat Jan 13
  15:00  Beta FC  0-3  Gamma FC
         Delta FC  1-2  Alpha FC
`;

const matches = parseFootballTxtResults(fixture, '2023-24');
assert.deepEqual(matches, [
  { date: '2023-08-12', home: 'Alpha FC', away: 'Beta FC', homeGoals: 2, awayGoals: 0 },
  { date: '2023-08-12', home: 'Gamma FC', away: 'Delta FC', homeGoals: 1, awayGoals: 1 },
  { date: '2024-01-13', home: 'Beta FC', away: 'Gamma FC', homeGoals: 0, awayGoals: 3 },
  { date: '2024-01-13', home: 'Delta FC', away: 'Alpha FC', homeGoals: 1, awayGoals: 2 }
]);

const explicitDateMatches = parseFootballTxtResults(`
= Example League 2024/25
  Sat Sep 7 2024
           Dreams FC                  v FC Samartex 1996           0-0
           Vision FC                  v Berekum Chelsea FC         0-0
  Sun Jun 8 2025
           FC Samartex 1996           v Dreams FC                   1-2
`, '2024-25');
assert.deepEqual(explicitDateMatches, [
  { date: '2024-09-07', home: 'Dreams FC', away: 'FC Samartex 1996', homeGoals: 0, awayGoals: 0 },
  { date: '2024-09-07', home: 'Vision FC', away: 'Berekum Chelsea FC', homeGoals: 0, awayGoals: 0 },
  { date: '2025-06-08', home: 'FC Samartex 1996', away: 'Dreams FC', homeGoals: 1, awayGoals: 2 }
]);

const winner = calculateOpenFootballWinner(matches);
assert.equal(winner.winner, 'Alpha FC');
assert.equal(winner.ambiguous, false);
assert.deepEqual(winner.table.map((row) => [row.team, row.points, row.goalDifference, row.goalsFor]), [
  ['Alpha FC', 6, 3, 4],
  ['Gamma FC', 4, 3, 4],
  ['Beta FC', 0, -5, 0],
  ['Delta FC', 1, -1, 2]
].sort((left, right) => (right[1] as number) - (left[1] as number) || String(left[0]).localeCompare(String(right[0]))));

const ranking = buildOpenFootballClubTitleRanking([
  { competition: 'example', season: '2023-24', matches },
  {
    competition: 'example',
    season: '2024-25',
    matches: [
      { date: '2024-08-10', home: 'Gamma FC', away: 'Alpha FC', homeGoals: 1, awayGoals: 0 },
      { date: '2024-08-10', home: 'Delta FC', away: 'Beta FC', homeGoals: 0, awayGoals: 0 }
    ]
  }
]);
assert.equal(ranking.categorySlug, 'national-league-club-titles');
assert.equal(ranking.source.key, 'openfootball-leagues');
assert.equal(ranking.coverageComplete, false);
assert.equal(ranking.reviewed, false);
assert.equal(ranking.entries[0]?.name, 'Alpha FC');
assert.equal(ranking.entries[0]?.rawValue, 1);
assert.ok(ranking.partialDraftReason?.includes('sistema de puntos'));

const homonymRanking = buildOpenFootballClubTitleRanking([
  {
    competition: 'england',
    season: '2023-24',
    matches: [{ date: '2023-08-12', home: 'United FC', away: 'Other FC', homeGoals: 2, awayGoals: 0 }]
  },
  {
    competition: 'scotland',
    season: '2023-24',
    matches: [{ date: '2023-08-12', home: 'United FC', away: 'Other FC', homeGoals: 2, awayGoals: 0 }]
  }
]);
assert.equal(homonymRanking.entries.length, 2);
assert.notEqual(homonymRanking.entries[0]?.entityId, homonymRanking.entries[1]?.entityId);

assert.throws(() => parseFootballTxtResults('no matches', 'not-a-season'), /etiqueta de temporada inválida/);
assert.throws(() => calculateOpenFootballWinner([]), /tabla vacía/);

console.log('openfootball provider tests passed');
