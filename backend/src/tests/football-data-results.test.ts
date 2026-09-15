import assert from 'node:assert/strict';
import { buildFootballDataNationalLeagueRanking, deriveFootballDataSeasonWinners, normalizeFootballDataResult } from '../providers/footballDataResultsClient.js';
import { buildContrastedNationalLeagueRanking, contrastNationalLeagueTitleObservations, nationalLeagueClubTitleAlternatives } from '../providers/nationalLeagueTitlesContrast.js';

assert.deepEqual(normalizeFootballDataResult({
  date: '2024-08-10', competition: 'testland', level: 'national', home_ident: 'Alpha (Testland)', away_ident: 'Beta (Testland)', gh: 2, ga: 0
}), {
  date: '2024-08-10', competition: 'testland', level: 'national', home: 'Alpha (Testland)', away: 'Beta (Testland)', homeGoals: 2, awayGoals: 0
});
assert.equal(normalizeFootballDataResult({ date: 'bad', competition: 'testland', level: 'national', home_ident: 'A', away_ident: 'B', gh: 1, ga: 0 }), null);

const teams = ['Alpha (Testland)', 'Beta (Testland)', 'Gamma (Testland)', 'Delta (Testland)'];
const matches = [];
for (let round = 0; round < 5; round += 1) {
  for (let index = 0; index < teams.length; index += 1) {
    const home = teams[index]!;
    const away = teams[(index + round + 1) % teams.length]!;
    matches.push({
      date: `2024-${String(8 + Math.floor(round / 2)).padStart(2, '0')}-${String(10 + round).padStart(2, '0')}`,
      competition: 'testland',
      level: 'national',
      home,
      away,
      homeGoals: index === 0 ? 3 : 1,
      awayGoals: 0
    });
  }
}
const ranking = buildFootballDataNationalLeagueRanking(matches, { sourceVersion: 'fixture-1', now: new Date('2026-09-14T00:00:00Z') });
assert.equal(ranking.categorySlug, 'national-league-club-titles');
assert.equal(ranking.source.key, 'schochastics-football-data');
assert.equal(ranking.coverageComplete, false);
assert.equal(ranking.reviewed, false);
assert.ok(ranking.entries.length > 0);
assert.ok(ranking.entries.every((entry) => entry.entityType === 'club' && entry.rawValue === 1));
assert.equal(ranking.audit?.['acceptedSeasons'], 1);

const winners = deriveFootballDataSeasonWinners(matches, { now: new Date('2026-09-14T00:00:00Z'), sourceUrl: 'https://example.test/games.parquet' });
assert.equal(winners.length, 1);
assert.equal(winners[0]?.status, 'deterministic');
assert.equal(winners[0]?.clubName, 'Alpha (Testland)');

const contrasted = contrastNationalLeagueTitleObservations([
  { source: 'openfootball', sourceUrl: 'https://example.test/open.txt', competition: 'Testland', season: '2024-25', seasonStartYear: 2024, clubName: 'Alpha FC', derivation: 'reconstructed_table', status: 'deterministic' },
  { source: 'football-data', sourceUrl: 'https://example.test/results.parquet', competition: 'testland', season: '2024', seasonStartYear: 2024, clubName: 'Alpha FC (Testland)', derivation: 'reconstructed_table', status: 'deterministic' },
  { source: 'openfootball', sourceUrl: 'https://example.test/open-ambiguous.txt', competition: 'Testland', season: '2023-24', seasonStartYear: 2023, clubName: '', derivation: 'reconstructed_table', status: 'ambiguous', ambiguityReason: 'tie' }
]);
assert.equal(contrasted.find((season) => season.seasonStartYear === 2024)?.status, 'confirmed');
assert.equal(contrasted.find((season) => season.seasonStartYear === 2023)?.status, 'ambiguous');
const contrastedRanking = buildContrastedNationalLeagueRanking([
  { source: 'openfootball', sourceUrl: 'https://example.test/open.txt', competition: 'Testland', season: '2024-25', seasonStartYear: 2024, clubName: 'Alpha FC', derivation: 'reconstructed_table', status: 'deterministic' },
  { source: 'football-data', sourceUrl: 'https://example.test/results.parquet', competition: 'testland', season: '2024', seasonStartYear: 2024, clubName: 'Alpha FC (Testland)', derivation: 'reconstructed_table', status: 'deterministic' }
], { sourceVersion: 'fixture-contrast', now: new Date('2026-09-14T00:00:00Z') });
assert.equal(contrastedRanking.entries.length, 1);
assert.equal(contrastedRanking.entries[0]?.rawValue, 1);
assert.equal(contrastedRanking.coverageComplete, false);
assert.equal(contrastedRanking.reviewed, false);
assert.equal(contrastedRanking.source.rightsStatus, 'review_required');
assert.ok(nationalLeagueClubTitleAlternatives.some((alternative) => alternative.slug === 'european-cup-champions-league-club-titles' && alternative.equivalence === 'different_metric_closed_universe'));
assert.equal(nationalLeagueClubTitleAlternatives.some((alternative) => alternative.slug === 'national-league-club-titles'), false);

console.log('football-data results provider tests passed');
