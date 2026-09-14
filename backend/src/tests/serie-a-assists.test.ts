import assert from 'node:assert/strict';
import {
  fetchTransfermarktHistoricalLeagueAssists,
  transfermarktHistoricalLeagueAssistsConfigs,
  transfermarktSerieAAssistsDefinition,
  transfermarktSerieAAssistsScope,
  transfermarktLaLigaAssistsTargetSize
} from '../providers/transfermarktLaLigaAssistsClient.js';

const config = transfermarktHistoricalLeagueAssistsConfigs.serieA;

function pageFixture(firstRank: number, includeScope = false): string {
  const rows = Array.from({ length: 25 }, (_, offset) => {
    const rank = firstRank + offset;
    const parity = rank % 2 === 0 ? 'even' : 'odd';
    return `<tr class="${parity}">
      <td class="zentriert">${rank}</td>
      <td><a title="Jugador Serie A ${rank}" href="https://www.transfermarkt.com/jugador-${rank}/profil/spieler/${30_000 + rank}">Jugador Serie A ${rank}</a></td>
      <td class="zentriert">${100 + rank}</td>
      <td class="zentriert"><a href="https://www.transfermarkt.com/jugador-${rank}/leistungsdaten/spieler/${30_000 + rank}/saison//wettbewerb/IT1">${20 + rank}</a></td>
      <td class="zentriert">${1000 - rank}</td>
    </tr>`;
  }).join('');
  const scope = includeScope
    ? '<select name="saison_id"><option value="0">Ewige Vorlagengeberliste</option><option value="1929">1929/30</option></select>'
    : '';
  return `${scope}<table><tbody>${rows}</tbody></table>`;
}

const calls: string[] = [];
const fetched = await fetchTransfermarktHistoricalLeagueAssists(config, {
  fetchImpl: async (url) => {
    const requested = String(url);
    calls.push(requested);
    const page = Number(new URL(requested).searchParams.get('page') ?? 1);
    return new Response(pageFixture((page - 1) * 25 + 1, page === 1), { status: 200 });
  }
});

assert.equal(fetched.categorySlug, 'serie-a-assists');
assert.equal(fetched.entries.length, transfermarktLaLigaAssistsTargetSize);
assert.equal(fetched.coverageComplete, true);
assert.equal(fetched.allowPartialDraft, undefined);
assert.equal(fetched.source.key, 'transfermarkt-serie-a-assists');
assert.equal(calls.length, 8);
assert.equal(calls[0], config.sourceUrl);
assert.equal(calls[7], `${config.sourceUrl}?page=8`);
assert.equal(fetched.entries[0]?.evidence?.historicalStartSeason, '1929-30');
assert.equal(fetched.entries[0]?.evidence?.seasonParameter, 'saison_id/0 (Ewige Vorlagengeberliste)');
assert.equal(fetched.entries[0]?.evidence?.sourcePageCount, 8);
assert.equal(fetched.entries[0]?.evidence?.sourcePageSize, 25);
assert.equal(fetched.entries[0]?.evidence?.sourceRowsObserved, 200);
assert.equal(fetched.entries[0]?.evidence?.assistDefinition, transfermarktSerieAAssistsDefinition);
assert.equal(fetched.entries[0]?.evidence?.scope, transfermarktSerieAAssistsScope);
const pageEvidence = fetched.entries[0]?.evidence?.sourcePageEvidence as Array<Record<string, unknown>>;
assert.equal(pageEvidence.length, 8);
assert.equal(pageEvidence[0]?.firstSourceTableRank, 1);
assert.equal(pageEvidence[7]?.lastSourceTableRank, 200);
assert.equal(new Set(fetched.entries.map((entry) => entry.evidence?.providerPlayerId)).size, 200);
assert.ok(fetched.entries.every((entry, index) => entry.evidence?.sourceRank === index + 1));
assert.ok(fetched.entries.every((entry, index) => entry.evidence?.sourceTableRank === index + 1));

await assert.rejects(
  () => fetchTransfermarktHistoricalLeagueAssists(config, {
    fetchImpl: async () => new Response(pageFixture(1), { status: 200 })
  }),
  /no acredita el selector histórico/
);

console.log('serie-a-assists provider tests passed');
