import assert from 'node:assert/strict';
import { buildCommunityShieldRanking, parseCommunityShieldMatches } from '../providers/communityShieldTitlesClient.js';

const fixture = `
<h4>FA Charity Shield</h4>
<pre>
1908  Manchester United       1:4  Queen's Park Rangers    1:0
1909  Newcastle United          2  Northampton Town          0
1949* Portsmouth                1  Wolverhampton Wanderers   1
1950  World Cup Team            4  Canadian Touring Team     2
2001  Liverpool                 2  Manchester United         1
</pre>
<h4>FA Community Shield</h4>
<pre>
2002  Arsenal                   1  Liverpool                 0
2003  Manchester United         1  Arsenal                   1  (4-3 pen)
2026  Arsenal                   3  Manchester City             0
</pre>
<h4>Summary (7 matches)</h4>`;

const matches = parseCommunityShieldMatches(fixture, false);
assert.equal(matches.length, 8);
assert.equal(matches[0]?.year, 1908);
assert.equal(matches[0]?.home, 'Manchester United');
assert.equal(matches[0]?.homeScore, 4);
assert.equal(matches[2]?.shared, true);
assert.equal(matches[6]?.shootoutWinner, 'home');

const ranking = buildCommunityShieldRanking(matches);
assert.equal(ranking.categorySlug, 'community-shield-club-titles');
assert.equal(ranking.coverageComplete, true);
assert.equal(ranking.entries.find((entry) => entry.name === 'Arsenal')?.rawValue, 2);
assert.equal(ranking.entries.find((entry) => entry.name === 'Portsmouth')?.rawValue, 1);
assert.equal(ranking.entries.some((entry) => entry.name === 'World Cup Team'), false);
console.log('community shield titles tests passed');
