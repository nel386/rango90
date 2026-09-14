import assert from 'node:assert/strict';
import { categories } from '../catalog.js';
import {
  fetchTransfermarktHistoricalLeagueAssists,
  parseTransfermarktLaLigaAssistsPage,
  transfermarktBundesligaAssistsDefinition,
  transfermarktBundesligaAssistsScope,
  transfermarktHistoricalLeagueAssistsConfigs,
  transfermarktLaLigaAssistsTargetSize
} from '../providers/transfermarktLaLigaAssistsClient.js';

const bundesligaConfig = transfermarktHistoricalLeagueAssistsConfigs.bundesliga;
const bundesligaCategory = categories.find((category) => category.slug === 'bundesliga-assists');
assert.ok(bundesligaCategory);
assert.equal(bundesligaCategory.scope.competitionId, 'bundesliga');
assert.equal(bundesligaCategory.scope.era, '1963-64_onwards');
assert.equal(bundesligaCategory.scope.assistDefinition, 'transfermarkt_historical_assist_column');

function pageFixture(firstRank: number, idForRank: (rank: number) => number = (rank) => rank, valueForRank: (rank: number) => number = (rank) => 1000 - rank): string {
  const rows = Array.from({ length: 25 }, (_, offset) => {
    const rank = firstRank + offset;
    const playerId = idForRank(rank);
    const name = `Jugador Bundesliga ${rank}`;
    const parity = rank % 2 === 0 ? 'even' : 'odd';
    return `<tr class="${parity}">
      <td class="zentriert">${rank}</td>
      <td><table class="inline-table"><tr><td><a title="${name}" href="https://www.transfermarkt.com/jugador-${rank}/profil/spieler/${playerId}">${name}</a></td></tr></table></td>
      <td class="zentriert">${100 + rank}</td>
      <td class="zentriert"><a href="https://www.transfermarkt.com/jugador-${rank}/leistungsdaten/spieler/${playerId}/saison//wettbewerb/L1">${20 + rank}</a></td>
      <td class="zentriert">${valueForRank(rank)}</td>
    </tr>`;
  }).join('');
  // Transfermarkt pages also contain unrelated rows with the same CSS
  // classes. They must not count as ranking entries.
  return `<table><tbody>${rows}<tr class="odd"><td class="zentriert">1</td><td>Publicidad</td></tr></tbody></table>`;
}

const parsedPage = parseTransfermarktLaLigaAssistsPage(pageFixture(1), 0, 'L1');
assert.equal(parsedPage.length, 25);
assert.deepEqual(parsedPage.slice(0, 2).map((row) => [row.sourceRank, row.sourceTableRank, row.providerPlayerId, row.assists]), [
  [1, 1, 1, 999],
  [2, 2, 2, 998]
]);

const calls: string[] = [];
const fetched = await fetchTransfermarktHistoricalLeagueAssists(bundesligaConfig, {
  fetchImpl: async (url) => {
    const requested = String(url);
    calls.push(requested);
    const page = Number(new URL(requested).searchParams.get('page') ?? 1);
    return new Response(pageFixture((page - 1) * 25 + 1), { status: 200 });
  }
});

assert.equal(fetched.categorySlug, 'bundesliga-assists');
assert.equal(fetched.entries.length, transfermarktLaLigaAssistsTargetSize);
assert.equal(fetched.coverageComplete, true);
assert.equal(fetched.allowPartialDraft, undefined);
assert.equal(fetched.reviewed, false);
assert.equal(fetched.source.key, 'transfermarkt-bundesliga-assists');
assert.equal(fetched.source.rightsStatus, 'review_required');
assert.equal(calls.length, 8);
assert.equal(calls[0], bundesligaConfig.sourceUrl);
assert.equal(calls[1], `${bundesligaConfig.sourceUrl}?page=2`);
assert.equal(calls[7], `${bundesligaConfig.sourceUrl}?page=8`);
assert.deepEqual(fetched.entries.slice(0, 2).map((entry) => [entry.evidence?.sourceRank, entry.evidence?.sourceTableRank, entry.rawValue]), [
  [1, 1, 999],
  [2, 2, 998]
]);
assert.deepEqual(fetched.entries.slice(-2).map((entry) => [entry.evidence?.sourceRank, entry.evidence?.sourceTableRank, entry.rawValue]), [
  [199, 199, 801],
  [200, 200, 800]
]);
assert.equal(new Set(fetched.entries.map((entry) => entry.evidence?.providerPlayerId)).size, 200);
assert.equal(new Set(fetched.entries.map((entry) => entry.entityId)).size, 200);
assert.ok(fetched.entries.every((entry, index) => entry.evidence?.sourceRank === index + 1));
assert.ok(fetched.entries.every((entry, index) => entry.evidence?.sourceTableRank === index + 1));
assert.equal(fetched.entries[0]?.evidence?.historicalStartSeason, '1963-64');
assert.equal(fetched.entries[0]?.evidence?.historicalEndSeason, 'current');
assert.equal(fetched.entries[0]?.evidence?.seasonParameter, 'saison_id/0 (all seasons)');
assert.equal(fetched.entries[0]?.evidence?.pagination, 'query_parameter_page');
assert.equal(fetched.entries[0]?.evidence?.sourcePageCount, 8);
assert.equal(fetched.entries[0]?.evidence?.sourcePageSize, 25);
assert.equal(fetched.entries[0]?.evidence?.sourceRowsObserved, 200);
assert.equal((fetched.entries[0]?.evidence?.sourcePageContentSha256 as string[]).length, 8);
assert.equal(fetched.entries[0]?.evidence?.assistDefinition, transfermarktBundesligaAssistsDefinition);
assert.equal(fetched.entries[0]?.evidence?.scope, transfermarktBundesligaAssistsScope);
assert.equal(fetched.entries[0]?.evidence?.rightsStatus, 'review_required');
assert.match(String(fetched.entries[0]?.evidence?.rightsNote), /independent from data coverage/);

await assert.rejects(
  () => fetchTransfermarktHistoricalLeagueAssists(bundesligaConfig, {
    fetchImpl: async (url) => {
      const page = Number(new URL(String(url)).searchParams.get('page') ?? 1);
      return new Response(pageFixture(
        page === 2 ? 26 : (page - 1) * 25 + 1,
        (rank) => page === 2 && rank === 26 ? 1 : rank
      ), { status: 200 });
    }
  }),
  /jugador duplicado 1/
);

await assert.rejects(
  () => fetchTransfermarktHistoricalLeagueAssists(bundesligaConfig, {
    fetchImpl: async (url) => {
      const page = Number(new URL(String(url)).searchParams.get('page') ?? 1);
      return new Response(pageFixture(page === 2 ? 27 : (page - 1) * 25 + 1), { status: 200 });
    }
  }),
  /rango de tabla no contiguo.*esperado 26, recibido 27/
);

await assert.rejects(
  () => fetchTransfermarktHistoricalLeagueAssists(bundesligaConfig, {
    fetchImpl: async (url) => {
      const page = Number(new URL(String(url)).searchParams.get('page') ?? 1);
      return new Response(pageFixture(
        (page - 1) * 25 + 1,
        (rank) => rank,
        (rank) => rank === 26 ? 2000 : 1000 - rank
      ), { status: 200 });
    }
  }),
  /orden descendente inválido/
);

console.log('bundesliga-assists provider tests passed');
