import assert from 'node:assert/strict';
import { fetchUefaEuroAllTimeRanking, parseUefaEuroHistoricalRanking, uefaEuroHistoricalCategorySlug } from '../providers/uefaEuroHistoricalClient.js';

const sourceUrl = 'https://compstats.uefa.com/v2/player-ranking-leader?competitionId=3&seasonYear=2004&stats=goals';
const fixture = [
  {
    name: 'goals',
    rankings: [
      {
        playerId: '101',
        player: {
          id: '101',
          internationalName: 'Jugador Uno',
          imageUrl: 'https://img.uefa.com/imgml/TP/players/3/2004/324x324/101.jpg'
        },
        statistics: [{ name: 'goals', value: '9' }],
        team: { id: '95', internationalName: 'Países Bajos' }
      },
      {
        playerId: '102',
        player: {
          id: '102',
          internationalName: 'Jugador Dos',
          imageUrl: 'https://img.uefa.com/imgml/TP/players/3/2004/324x324/102.jpg'
        },
        statistics: [{ name: 'goals', value: '4' }],
        team: { id: '96', internationalName: 'República Checa' }
      },
      {
        playerId: '103',
        player: {
          id: '103',
          internationalName: 'Jugador Tres',
          imageUrl: 'https://img.uefa.com/imgml/TP/players/3/2004/324x324/103.jpg'
        },
        statistics: [{ name: 'goals', value: '4' }]
      }
    ]
  }
];

const parsed = parseUefaEuroHistoricalRanking(fixture, 2004, 'goals', sourceUrl);
assert.deepEqual(parsed.map((row) => [row.sourceRank, row.playerId, row.name, row.value, row.teamName]), [
  [1, '101', 'Jugador Uno', 9, 'Países Bajos'],
  [2, '102', 'Jugador Dos', 4, 'República Checa'],
  [3, '103', 'Jugador Tres', 4, undefined]
]);
assert.equal(parsed[0]?.imageUrl, 'https://img.uefa.com/imgml/TP/players/3/history/101.jpg');
assert.equal(uefaEuroHistoricalCategorySlug(2004, 'assists'), 'euro-2004-assists');

assert.throws(
  () => parseUefaEuroHistoricalRanking([
    { name: 'goals', rankings: [fixture[0]!.rankings[1], fixture[0]!.rankings[0]] }
  ], 2004, 'goals', sourceUrl),
  /valores fuera de orden/
);

assert.throws(
  () => parseUefaEuroHistoricalRanking([
    { name: 'goals', rankings: [{ ...fixture[0]!.rankings[0], playerId: '101' }, fixture[0]!.rankings[0]] }
  ], 2004, 'goals', sourceUrl),
  /jugador duplicado/
);

const aggregate = await fetchUefaEuroAllTimeRanking('goals', {
  fetchImpl: async (url) => {
    const season = Number(new URL(String(url)).searchParams.get('seasonYear'));
    const rankings = Array.from({ length: 200 }, (_, index) => {
      const playerId = String(index + 1);
      return {
        playerId,
        player: {
          id: playerId,
          internationalName: `Jugador Euro ${playerId}`,
          imageUrl: `https://img.uefa.com/imgml/TP/players/3/${season}/324x324/${playerId}.jpg`
        },
        statistics: [{ name: 'goals', value: 1000 - index }]
      };
    });
    return new Response(JSON.stringify([{ name: 'goals', rankings }]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
});
assert.equal(aggregate.categorySlug, 'euro-goals');
assert.equal(aggregate.coverageComplete, true);
assert.equal(aggregate.entries.length, 200);
assert.equal(aggregate.entries[0]?.rawValue, 17_000);
assert.equal(aggregate.entries[0]?.evidence?.sourceEditionCount, 17);
assert.equal((aggregate.entries[0]?.evidence?.sourceEditions as unknown[]).length, 17);
assert.equal(new Set(aggregate.entries.map((entry) => entry.entityId)).size, 200);

const yellowAggregate = await fetchUefaEuroAllTimeRanking('yellow_cards', {
  fetchImpl: async (url) => {
    const season = Number(new URL(String(url)).searchParams.get('seasonYear'));
    if (season < 1972) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    const rankings = Array.from({ length: 200 }, (_, index) => {
      const playerId = String(index + 1);
      return {
        playerId,
        player: {
          id: playerId,
          internationalName: `Jugador Amarillo ${playerId}`,
          imageUrl: `https://img.uefa.com/imgml/TP/players/3/${season}/324x324/${playerId}.jpg`
        },
        statistics: [{ name: 'yellow_cards', value: 200 - index }]
      };
    });
    return new Response(JSON.stringify([{ name: 'yellow_cards', rankings }]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
});
assert.equal(yellowAggregate.categorySlug, 'euro-yellow_cards');
assert.equal(yellowAggregate.coverageComplete, false);
assert.equal(yellowAggregate.allowPartialDraft, true);
assert.equal(yellowAggregate.entries.length, 200);
assert.equal((yellowAggregate.entries[0]?.evidence?.sourceEditions as Array<{ rows: number }>)[0]?.rows, 0);
assert.equal((yellowAggregate.entries[0]?.evidence?.sourceEditions as Array<{ sourcePageUrl: string }>)[0]?.sourcePageUrl, 'https://www.uefa.com/uefaeuro/history/seasons/1960/statistics/players/yellow_cards/');

console.log('uefa-euro-historical.test.ts: OK');
