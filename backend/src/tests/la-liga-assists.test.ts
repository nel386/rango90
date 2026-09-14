import assert from 'node:assert/strict';
import { categories } from '../catalog.js';
import {
  buildStatbunkerLaLigaAssistsRanking,
  fetchStatbunkerLaLigaAssists,
  parseStatbunkerLaLigaAssists,
  statbunkerLaLigaAssistsScope,
  statbunkerLaLigaAssistsTargetSize
} from '../providers/statbunkerLaLigaAssistsClient.js';
import {
  fetchTransfermarktHistoricalLeagueAssists,
  parseTransfermarktLaLigaAssistsPage,
  transfermarktHistoricalLeagueAssistsConfigs,
  transfermarktLaLigaAssistsDefinition,
  transfermarktLaLigaAssistsScope,
  transfermarktLaLigaAssistsTargetSize
} from '../providers/transfermarktLaLigaAssistsClient.js';

const fixture = `<table>
<tr><td class="tdInline mob"><a href="/players/player.php?player_id=101"><p>Jugador Dos</p></a></td><td class="mob">Forward</td><td class="mob">300</td><td class="mob">20</td><td class="mob">8</td><td>More</td></tr>
<tr><td class="tdInline mob"><a href="/players/player.php?player_id=102"><p>Jugador Uno &amp; Más</p></a></td><td class="mob">Midfielder</td><td class="mob">350</td><td class="mob">30</td><td class="mob">12</td><td>More</td></tr>
<tr><td class="tdInline mob"><a href="/players/player.php?player_id=103"><p>Jugador Cero</p></a></td><td class="mob">Defender</td><td class="mob">250</td><td class="mob">2</td><td class="mob">-</td><td>More</td></tr>
</table>`;

const parsed = parseStatbunkerLaLigaAssists(fixture, 2);
assert.deepEqual(parsed.map((row) => [row.sourceRank, row.providerPlayerId, row.name, row.assists]), [
  [1, 102, 'Jugador Uno & Más', 12],
  [2, 101, 'Jugador Dos', 8]
]);
assert.equal(parsed[0]?.sourceTableRank, 2);

const built = buildStatbunkerLaLigaAssistsRanking(parsed, 2);
assert.equal(built.categorySlug, 'la-liga-assists');
assert.equal(built.source.key, 'statbunker-la-liga-assists');
assert.equal(built.source.rightsStatus, 'review_required');
assert.equal(built.coverageComplete, false);
assert.equal(built.allowPartialDraft, true);
assert.equal(built.entries.length, 2);
assert.equal(built.entries[0]?.rawValue, 12);
assert.equal(built.entries[0]?.evidence?.scope, statbunkerLaLigaAssistsScope);
assert.equal(built.entries[0]?.evidence?.assistsColumn, 'A');

const mockFetch: typeof fetch = async () => new Response(fixture, { status: 200 });
const fetched = await fetchStatbunkerLaLigaAssists({ fetchImpl: mockFetch, minimumEntries: 2 });
assert.equal(fetched.categorySlug, 'la-liga-assists');
assert.equal(fetched.entries.length, 2);

assert.throws(
  () => parseStatbunkerLaLigaAssists(fixture, statbunkerLaLigaAssistsTargetSize),
  /cobertura insuficiente \(2\/200 filas positivas\)/
);

const transfermarktFixture = `<table><tbody>
<tr class="odd"><td class="zentriert">1</td><td><table class="inline-table"><tr><td><a title="Jugador Histórico" href="https://www-transfermarkt-com.translate.goog/jugador-historico/profil/spieler/9001?_x_tr_sl=auto">Jugador Histórico</a></td></tr></table></td><td class="zentriert">38</td><td class="zentriert"><a href="https://www-transfermarkt-com.translate.goog/jugador-historico/leistungsdaten/spieler/9001/saison//wettbewerb/ES1">120</a></td><td class="zentriert">55</td></tr>
<tr class="even"><td class="zentriert">2</td><td><table class="inline-table"><tr><td><a title="Segundo Histórico" href="https://www-transfermarkt.com/segundo-historico/profil/spieler/9002">Segundo Histórico</a></td></tr></table></td><td class="zentriert">36</td><td class="zentriert"><a href="https://www.transfermarkt.com/segundo-historico/leistungsdaten/spieler/9002/saison//wettbewerb/ES1">100</a></td><td class="zentriert">44</td></tr>
</tbody></table>`;
const transfermarktParsed = parseTransfermarktLaLigaAssistsPage(transfermarktFixture);
assert.deepEqual(transfermarktParsed.map((row) => [row.sourceTableRank, row.providerPlayerId, row.name, row.assists]), [
  [1, 9001, 'Jugador Histórico', 55],
  [2, 9002, 'Segundo Histórico', 44]
]);
assert.equal(transfermarktLaLigaAssistsScope.includes('Ewige Vorlagengeberliste'), true);
assert.equal(transfermarktHistoricalLeagueAssistsConfigs.bundesliga.competitionCode, 'L1');
assert.equal(transfermarktHistoricalLeagueAssistsConfigs.serieA.competitionCode, 'IT1');
assert.equal(parseTransfermarktLaLigaAssistsPage(transfermarktFixture.replaceAll('/ES1', '/L1'), 0, 'L1').length, 2);

const laLigaCategory = categories.find((category) => category.slug === 'la-liga-assists');
assert.ok(laLigaCategory);
assert.equal(laLigaCategory.scope.era, '1928-29_onwards');
assert.equal(laLigaCategory.scope.historicalSource, 'transfermarkt_ewige_vorlagengeberliste');
assert.equal(laLigaCategory.scope.seasonParameter, 'saison_id/0');

function historicalLaLigaPageFixture(firstRank: number, includeScope = false): string {
  const rows = Array.from({ length: 25 }, (_, offset) => {
    const rank = firstRank + offset;
    const playerId = 20_000 + rank;
    const name = `Jugador LaLiga Histórico ${rank}`;
    const parity = rank % 2 === 0 ? 'even' : 'odd';
    return `<tr class="${parity}">
      <td class="zentriert">${rank}</td>
      <td><table class="inline-table"><tr><td><a title="${name}" href="https://www.transfermarkt.com/jugador-${rank}/profil/spieler/${playerId}">${name}</a></td></tr></table></td>
      <td class="zentriert">${100 + rank}</td>
      <td class="zentriert"><a href="https://www.transfermarkt.com/jugador-${rank}/leistungsdaten/spieler/${playerId}/saison//wettbewerb/ES1">${20 + rank}</a></td>
      <td class="zentriert">${1000 - rank}</td>
    </tr>`;
  }).join('');
  const scope = includeScope
    ? '<select name="saison_id"><option value="0">Ewige Vorlagengeberliste</option><option value="1928">1928/29</option></select>'
    : '';
  return `${scope}<table><tbody>${rows}</tbody></table>`;
}

const laLigaConfig = transfermarktHistoricalLeagueAssistsConfigs.laLiga;
const laLigaCalls: string[] = [];
const laLigaFetched = await fetchTransfermarktHistoricalLeagueAssists(laLigaConfig, {
  fetchImpl: async (url) => {
    const requested = String(url);
    laLigaCalls.push(requested);
    const page = Number(new URL(requested).searchParams.get('page') ?? 1);
    return new Response(historicalLaLigaPageFixture((page - 1) * 25 + 1, page === 1), { status: 200 });
  }
});
assert.equal(laLigaFetched.entries.length, transfermarktLaLigaAssistsTargetSize);
assert.equal(laLigaFetched.coverageComplete, true);
assert.equal(laLigaFetched.allowPartialDraft, undefined);
assert.equal(laLigaFetched.source.key, 'transfermarkt-la-liga-assists');
assert.equal(laLigaFetched.source.rightsStatus, 'review_required');
assert.equal(laLigaCalls.length, 8);
assert.equal(laLigaCalls[0], laLigaConfig.sourceUrl);
assert.equal(laLigaCalls[7], `${laLigaConfig.sourceUrl}?page=8`);
assert.equal(laLigaFetched.entries[0]?.evidence?.historicalStartSeason, '1928-29');
assert.equal(laLigaFetched.entries[0]?.evidence?.historicalEndSeason, 'current');
assert.equal(laLigaFetched.entries[0]?.evidence?.seasonParameter, 'saison_id/0 (Ewige Vorlagengeberliste)');
assert.equal(laLigaFetched.entries[0]?.evidence?.sourcePageCount, 8);
assert.equal(laLigaFetched.entries[0]?.evidence?.sourcePageSize, 25);
assert.equal(laLigaFetched.entries[0]?.evidence?.sourceRowsObserved, 200);
assert.equal(laLigaFetched.entries[0]?.evidence?.assistDefinition, transfermarktLaLigaAssistsDefinition);
const laLigaPageEvidence = laLigaFetched.entries[0]?.evidence?.sourcePageEvidence as Array<Record<string, unknown>>;
assert.equal(laLigaPageEvidence.length, 8);
assert.deepEqual(laLigaPageEvidence[0], {
  page: 1,
  url: laLigaConfig.sourceUrl,
  contentSha256: laLigaPageEvidence[0]?.contentSha256,
  rows: 25,
  firstSourceTableRank: 1,
  lastSourceTableRank: 25
});
assert.equal(laLigaPageEvidence[7]?.page, 8);
assert.equal(laLigaPageEvidence[7]?.firstSourceTableRank, 176);
assert.equal(laLigaPageEvidence[7]?.lastSourceTableRank, 200);
assert.equal(new Set(laLigaFetched.entries.map((entry) => entry.evidence?.providerPlayerId)).size, 200);
assert.ok(laLigaFetched.entries.every((entry, index) => entry.evidence?.sourceRank === index + 1));
assert.ok(laLigaFetched.entries.every((entry, index) => entry.evidence?.sourceTableRank === index + 1));

await assert.rejects(
  () => fetchTransfermarktHistoricalLeagueAssists(laLigaConfig, {
    fetchImpl: async () => new Response(historicalLaLigaPageFixture(1), { status: 200 })
  }),
  /no acredita el selector histórico/
);

await assert.rejects(
  () => fetchTransfermarktHistoricalLeagueAssists(laLigaConfig, {
    fetchImpl: async (url) => {
      const page = Number(new URL(String(url)).searchParams.get('page') ?? 1);
      return new Response(historicalLaLigaPageFixture(page === 2 ? 27 : (page - 1) * 25 + 1, page === 1), { status: 200 });
    }
  }),
  /no continúa el rango esperado 26-50/
);

assert.throws(
  () => parseStatbunkerLaLigaAssists(fixture.replace('player_id=103', 'player_id=102'), 1),
  /jugador duplicado 102/
);
assert.throws(
  () => parseStatbunkerLaLigaAssists('<table><tr><td>Player</td></tr></table>', 1),
  /cobertura insuficiente \(0\/1 filas positivas\)/
);

console.log('la-liga-assists provider tests passed');
