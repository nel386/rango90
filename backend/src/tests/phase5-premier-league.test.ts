import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRanking } from '../ranking.js';
import { parsePremierLeagueClubTitles } from '../providers/premierLeagueTitlesClient.js';

const fixturePath = new URL('../../data/fixtures/premier-league-club-titles-2026-09-08.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as {
  categorySlug: string;
  dataVersion: string;
  coverageComplete: boolean;
  entries: Array<{ entityId: string; entityType: string; rawValue: number; evidence?: { sourceRank?: number; externalId?: string } }>;
};

assert.equal(fixture.categorySlug, 'premier-league-club-titles');
assert.equal(fixture.dataVersion, 'premier-league-club-titles-2026-09-08');
assert.equal(fixture.coverageComplete, true);
assert.equal(fixture.entries.length, 7);
assert.equal(new Set(fixture.entries.map((entry) => entry.entityId)).size, 7);
assert.equal(new Set(fixture.entries.map((entry) => entry.evidence?.externalId)).size, 7);
assert.ok(fixture.entries.every((entry) => entry.entityType === 'club'));
assert.deepEqual(fixture.entries.map((entry) => entry.rawValue), [13, 8, 5, 4, 2, 1, 1]);

const ranking = buildRanking(fixture.entries.map((entry) => ({
  entityId: entry.entityId,
  rawValue: entry.rawValue,
  evidence: entry.evidence
})), { direction: 'desc', scoreCap: 100 });
assert.deepEqual(ranking.map((entry) => [entry.entityId, entry.rank, entry.scoreValue, entry.tieGroup]), [
  ['pl:club:12', 1, 1, 1],
  ['pl:club:11', 2, 2, 2],
  ['pl:club:4', 3, 3, 3],
  ['pl:club:1', 4, 4, 4],
  ['pl:club:10', 5, 5, 5],
  ['pl:club:blackburn-rovers', 6, 6, 6],
  ['pl:club:leicester-city', 6, 6, 6]
]);

const officialTableFixture = `
<h6>Most Premier League titles</h6>
<table>
  <tr><th>Man Utd</th><td>13</td></tr>
  <tr><th>Man City</th><td>8</td></tr>
  <tr><th>Chelsea</th><td>5</td></tr>
  <tr><th>Arsenal</th><td>4</td></tr>
  <tr><th>Liverpool</th><td>2</td></tr>
  <tr><th>Blackburn Rovers</th><td>1</td></tr>
  <tr><th>Leicester City</th><td>1</td></tr>
</table>`;
assert.deepEqual(parsePremierLeagueClubTitles(officialTableFixture), [
  { sourceRank: 1, name: 'Man Utd', titles: 13 },
  { sourceRank: 2, name: 'Man City', titles: 8 },
  { sourceRank: 3, name: 'Chelsea', titles: 5 },
  { sourceRank: 4, name: 'Arsenal', titles: 4 },
  { sourceRank: 5, name: 'Liverpool', titles: 2 },
  { sourceRank: 6, name: 'Blackburn Rovers', titles: 1 },
  { sourceRank: 7, name: 'Leicester City', titles: 1 }
]);

assert.throws(() => buildRanking([
  { entityId: 'pl:club:12', rawValue: 13 },
  { entityId: 'pl:club:12', rawValue: 13 }
], { direction: 'desc', scoreCap: 100 }), /Entidad duplicada/);

console.log('phase 5 premier league tests passed');
