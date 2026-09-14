import assert from 'node:assert/strict';
import {
  fetchApiFootballCopaSudamericanaCleanSheets,
  parseApiFootballCopaSudamericanaCleanSheetPage,
  parseApiFootballCopaSudamericanaSeasons
} from '../providers/apiFootballCopaSudamericanaCleanSheetsClient.js';

const leaguePayload = {
  get response() {
    return [{
      league: { id: 11, name: 'Copa Sudamericana' },
      seasons: [
        { year: 2022, coverage: { players: true } },
        { year: 2023, coverage: { players: false } },
        { year: 2024, coverage: { players: true } }
      ]
    }];
  }
};

const selection = parseApiFootballCopaSudamericanaSeasons(leaguePayload, 2022, 2024);
assert.deepEqual(selection.seasons, [
  { year: 2022, playersCoverage: true },
  { year: 2024, playersCoverage: true }
]);
assert.deepEqual(selection.missingYears, [2023]);

const standardApiFootballPage = {
  response: [{
    player: { id: 7, name: 'Portero API-Football' },
    statistics: [{
      team: { id: 100 },
      league: { id: 11, name: 'Copa Sudamericana', season: 2024 },
      games: { position: 'Goalkeeper', appearences: 5 },
      goals: { conceded: 2, saves: 8 }
    }]
  }],
  paging: { current: 1, total: 1 }
};
const unsupportedPage = parseApiFootballCopaSudamericanaCleanSheetPage(standardApiFootballPage, 2024);
assert.equal(unsupportedPage.explicitCleanSheetsFieldObserved, false);
assert.deepEqual(unsupportedPage.rows, []);
assert.equal(unsupportedPage.goalkeeperStatisticsInspected, 1);

const explicitPage = parseApiFootballCopaSudamericanaCleanSheetPage({
  response: [{
    player: { id: 7, name: 'Portero API-Football' },
    statistics: [{
      team: { id: 100 },
      league: { id: 11, season: 2024 },
      games: { position: 'Goalkeeper' },
      clean_sheets: 4,
      goals: { conceded: 2, saves: 8 }
    }]
  }],
  paging: { current: 1, total: 1 }
}, 2024);
assert.equal(explicitPage.explicitCleanSheetsFieldObserved, true);
assert.deepEqual(explicitPage.rows.map((row) => [row.playerId, row.teamId, row.cleanSheets]), [[7, 100, 4]]);

const calls: string[] = [];
const supportedFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  calls.push(`${url.pathname}${url.search}`);
  assert.equal(new Headers(init?.headers).get('x-apisports-key'), 'test-key');
  if (url.pathname.endsWith('/leagues')) return new Response(JSON.stringify(leaguePayload));
  const year = Number(url.searchParams.get('season'));
  const player = year === 2024
    ? { id: 7, name: 'Portero API-Football' }
    : { id: 7, name: 'Portero API-Football actualizado' };
  const cleanSheets = year === 2024 ? 4 : 3;
  return new Response(JSON.stringify({
    response: [{
      player,
      statistics: [{ team: { id: year }, league: { id: 11, season: year }, games: { position: 'Goalkeeper' }, clean_sheets: cleanSheets }]
    }],
    paging: { current: 1, total: 1 }
  }));
};

const input = await fetchApiFootballCopaSudamericanaCleanSheets({
  apiKey: 'test-key',
  baseUrl: 'https://api-football.test',
  startYear: 2022,
  endYear: 2024,
  httpFetch: supportedFetch
});
assert.equal(input.categorySlug, 'copa-sudamericana-clean_sheets');
assert.equal(input.coverageComplete, false);
assert.equal(input.allowPartialDraft, true);
assert.equal(input.entries.length, 1);
assert.equal(input.entries[0]?.entityId, 'api-football:player:7');
assert.equal(input.entries[0]?.rawValue, 7);
assert.deepEqual(input.entries[0]?.evidence?.missingHistoricalSeasons, [2023]);
assert.match(input.partialDraftReason ?? '', /2023/);
assert.equal(calls.length, 3);
assert.ok(calls[0]?.includes('/leagues?id=11'));

await assert.rejects(
  fetchApiFootballCopaSudamericanaCleanSheets({
    apiKey: 'test-key',
    baseUrl: 'https://api-football.test',
    startYear: 2024,
    endYear: 2024,
    httpFetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(new Headers(init?.headers).get('x-apisports-key'), 'test-key');
      if (url.pathname.endsWith('/leagues')) {
        return new Response(JSON.stringify({ response: [{ league: { id: 11, name: 'Copa Sudamericana' }, seasons: [{ year: 2024, coverage: { players: true } }] }] }));
      }
      return new Response(JSON.stringify(standardApiFootballPage));
    }
  }),
  /no expone un campo explícito[\s\S]*porterías a cero[\s\S]*no se usarán goals\.conceded/
);

assert.throws(
  () => parseApiFootballCopaSudamericanaCleanSheetPage({
    response: [{
      player: { id: 7, name: 'Portero' },
      statistics: [{ team: { id: 100 }, league: { id: 11, season: 2024 }, games: { position: 'Goalkeeper' }, clean_sheets: -1 }]
    }],
    paging: { current: 1, total: 1 }
  }, 2024),
  /clean_sheets inválido/
);

console.log('api-football copa sudamericana clean sheets tests passed');
