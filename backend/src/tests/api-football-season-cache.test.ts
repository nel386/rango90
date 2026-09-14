import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  apiFootballSeasonCacheDirectory,
  cleanupApiFootballSeasonCache,
  parseApiFootballSeasonPageCache,
  readApiFootballSeasonPageCache,
  writeApiFootballSeasonPageCache,
  type ApiFootballPayload
} from '../providers/apiFootballSeasonClient.js';

const cacheRoot = await mkdtemp(join(tmpdir(), 'rango90-api-football-cache-'));
try {
  const leagueId = 39;
  const season = 2024;
  const firstPage: ApiFootballPayload = { response: [], paging: { current: 1, total: 2 } };
  const secondPage: ApiFootballPayload = { response: [{ player: { id: 7, name: 'Jugador' }, statistics: [] }], paging: { current: 2, total: 2 } };

  assert.deepEqual(parseApiFootballSeasonPageCache(JSON.stringify(firstPage), 1, undefined, true), firstPage);
  assert.throws(() => parseApiFootballSeasonPageCache('{not-json', 1, undefined, true), /caché JSON inválida/);
  assert.throws(() => parseApiFootballSeasonPageCache(JSON.stringify(secondPage), 1, 2), /paginación inválida/);
  assert.throws(() => parseApiFootballSeasonPageCache(JSON.stringify({ response: [], paging: { current: 2, total: 3 } }), 2, 2), /total de páginas cambió/);

  await writeApiFootballSeasonPageCache(cacheRoot, leagueId, season, 1, firstPage);
  await writeApiFootballSeasonPageCache(cacheRoot, leagueId, season, 2, secondPage);
  const seasonDirectory = apiFootballSeasonCacheDirectory(cacheRoot, leagueId, season);
  assert.deepEqual(await readdir(seasonDirectory), ['page-000001.json', 'page-000002.json']);
  assert.deepEqual(await readApiFootballSeasonPageCache(cacheRoot, leagueId, season, 1, undefined, true), firstPage);
  assert.deepEqual(await readApiFootballSeasonPageCache(cacheRoot, leagueId, season, 2, 2, false), secondPage);

  await writeFile(join(seasonDirectory, 'page-000003.json'), JSON.stringify({ response: [], paging: { current: 3, total: 3 } }));
  assert.equal(await readApiFootballSeasonPageCache(cacheRoot, leagueId, season, 3, 2, false), null);
  await writeFile(join(seasonDirectory, 'keep.txt'), 'not a cache page');
  await writeFile(join(seasonDirectory, 'page-000004.json.tmp-stale'), 'stale temp');
  await cleanupApiFootballSeasonCache(cacheRoot, leagueId, season);
  assert.deepEqual(await readdir(seasonDirectory), ['keep.txt']);
  assert.equal(await readFile(join(seasonDirectory, 'keep.txt'), 'utf8'), 'not a cache page');

  console.log('api-football season cache tests passed');
} finally {
  await rm(cacheRoot, { recursive: true, force: true });
}
