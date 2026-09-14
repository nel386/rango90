import assert from 'node:assert/strict';
import { parseRsssfInternationalGoals } from '../providers/rsssfInternationalClient.js';

function makeFixture(count: number, duplicateAt?: number): string {
  const rows: string[] = [];
  let displayedRank = 1;
  for (let index = 0; index < count; index += 1) {
    const goals = index === 2 ? 299 : 300 - index;
    let rankToken = `${displayedRank}.`;
    if (index === 2) rankToken = '';
    if (index === 3) rankToken = '-.';
    if (index === 3) {
      // RSSSF's '-' rows are historical records retained in the list but
      // intentionally excluded from the numeric rank sequence.
    } else {
      displayedRank += 1;
    }
    const externalId = duplicateAt === index ? 'player-1-intlg.html' : `player-${index + 1}-intlg.html`;
    const player = index === 0
      ? `<A HREF="${externalId}"><i>Player One</i></A>`
      : index === 1
        ? 'Unlinked Player'
        : index === 3
          ? `<i><a href="${externalId}">Special Record</a></i>`
          : `<a href="${externalId}">Player ${index + 1}</a>`;
    rows.push(`  ${rankToken}${player} [<a href="test-recintlp.html"><i>Testland</i></a>] ${goals} (${100 + index}) (1900-2025)`);
  }
  return `<title>Players with 100+ Caps and 30+ International Goals</title>
<h2><a name="goals">International Goals</a></h2>
<h3>Players with 30 or More Goals</h3>
<pre><b>NB: the list below is up to date as of Jan 1, 2026.</b>
${rows.join('\n')}</pre>`;
}

const parsed = parseRsssfInternationalGoals(makeFixture(200));
assert.equal(parsed.length, 200);
assert.deepEqual(parsed.slice(0, 4).map((row) => [row.sourceRank, row.displayedRank, row.name, row.externalId]), [
  [1, 1, 'Player One', 'player-1-intlg.html'],
  [2, 2, 'Unlinked Player', 'name-country:unlinked-player|testland'],
  [3, null, 'Player 3', 'player-3-intlg.html'],
  [4, null, 'Special Record', 'player-4-intlg.html']
]);
assert.equal(parsed.at(-1)?.sourceRank, 200);
assert.equal(parsed.at(-1)?.name, 'Player 200');
assert.equal(new Set(parsed.map((row) => row.externalId)).size, 200);
assert.equal(parsed.every((row, index) => index === 0 || row.goals <= parsed[index - 1]!.goals), true);

assert.throws(() => parseRsssfInternationalGoals(makeFixture(199)), /cobertura insuficiente/iu);
assert.throws(() => parseRsssfInternationalGoals(makeFixture(200, 50)), /jugador duplicado/iu);

console.log('RSSSF international tests passed');
