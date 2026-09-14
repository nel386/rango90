import assert from 'node:assert/strict';
import {
  aggregateCopaSudamericanaCleanSheets,
  fetchCopaSudamericanaCleanSheets,
  parseCopaSudamericanaCleanSheetPage,
  parseCopaSudamericanaSeasons
} from '../providers/copaSudamericanaCleanSheetsClient.js';

const seasonsPayload = {
  success: true,
  data: [
    {
      name: 'South America Copa Sudamericana',
      league_name: 'Copa Sudamericana',
      season: [{ id: 2016, year: 2016 }, { id: 2017, year: 2017 }, { id: 2019, year: 2019 }]
    },
    { name: 'South America CONMEBOL Recopa Sudamericana', season: [{ id: 1, year: 2020 }] }
  ]
};

const selected = parseCopaSudamericanaSeasons(seasonsPayload, 2016, 2019);
assert.equal(selected.competitionName, 'South America Copa Sudamericana');
assert.deepEqual(selected.seasons, [{ seasonId: 2016, year: 2016 }, { seasonId: 2017, year: 2017 }, { seasonId: 2019, year: 2019 }]);
assert.deepEqual(selected.missingYears, [2018]);

const season = { seasonId: 2016, year: 2016 };
const page = parseCopaSudamericanaCleanSheetPage({
  success: true,
  pager: { current_page: 1, max_page: 1, total_results: 4 },
  data: [
    { id: 10, full_name: 'Portero Uno', position: 'Goalkeeper', appearances_overall: 7, clean_sheets_overall: 3 },
    { id: 11, full_name: 'Portero Cero', position: 'Goalkeeper', appearances_overall: 2, clean_sheets_overall: 0 },
    { id: 12, full_name: 'Portero Sin Dato', position: 'Goalkeeper', appearances_overall: 1 },
    { id: 20, full_name: 'Jugador de Campo', position: 'Defender', clean_sheets_overall: 99 }
  ]
}, season);
assert.deepEqual(page.rows.map((row) => [row.providerPlayerId, row.cleanSheets]), [[10, 3]]);
assert.equal(page.totalResults, 4);

const aggregate = aggregateCopaSudamericanaCleanSheets([
  {
    season,
    rows: page.rows
  },
  {
    season: { seasonId: 2017, year: 2017 },
    rows: [{
      ...page.rows[0]!,
      seasonId: 2017,
      seasonYear: 2017,
      cleanSheets: 4,
      appearances: 8,
      name: 'Portero Uno actualizado'
    }]
  }
]);
assert.deepEqual(aggregate, [{
  providerPlayerId: 10,
  name: 'Portero Uno actualizado',
  cleanSheets: 7,
  seasons: [
    { seasonId: 2016, year: 2016, cleanSheets: 3, appearances: 7 },
    { seasonId: 2017, year: 2017, cleanSheets: 4, appearances: 8 }
  ]
}]);

assert.throws(() => parseCopaSudamericanaSeasons({ success: true, data: [{ name: 'Copa Sudamericana', season: [{ id: 1, year: 2024 }] }] }, 2024, 2024), /al menos dos temporadas/);
assert.throws(() => parseCopaSudamericanaCleanSheetPage({
  success: true,
  pager: { current_page: 1, max_page: 1, total_results: 1 },
  data: [
    { id: 10, full_name: 'Portero Uno', position: 'Goalkeeper', clean_sheets_overall: 2 },
    { id: 10, full_name: 'Portero Uno', position: 'Goalkeeper', clean_sheets_overall: 1 }
  ]
}, season), /jugador duplicado/);

const calls: string[] = [];
const mockFetch: typeof fetch = async (input) => {
  const url = new URL(String(input));
  calls.push(url.pathname + url.search);
  if (url.pathname.endsWith('/league-list')) return new Response(JSON.stringify(seasonsPayload));
  const requestedSeason = Number(url.searchParams.get('season_id'));
  const seasonYear = requestedSeason === 2016 ? 2016 : 2017;
  return new Response(JSON.stringify({
    success: true,
    pager: { current_page: 1, max_page: 1, total_results: 1 },
    data: [{ id: 10, full_name: 'Portero Uno', position: 'Goalkeeper', clean_sheets_overall: seasonYear === 2016 ? 3 : 4 }]
  }));
};
const input = await fetchCopaSudamericanaCleanSheets({
  apiKey: 'test-key',
  startYear: 2016,
  endYear: 2017,
  minimumEntries: 1,
  httpFetch: mockFetch
});
assert.equal(input.categorySlug, 'copa-sudamericana-clean_sheets');
assert.equal(input.coverageComplete, true);
assert.equal(input.entries.length, 1);
assert.equal(input.entries[0]?.rawValue, 7);
assert.deepEqual(input.entries[0]?.evidence?.sourceCoverage, [2016, 2017]);
assert.equal(calls.length, 3);
assert.ok(calls.every((call) => call.includes('key=test-key')));

console.log('copa sudamericana clean sheets tests passed');
