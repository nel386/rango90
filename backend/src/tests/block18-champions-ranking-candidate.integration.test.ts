import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';
import type { ChampionsSnapshot } from '../championsRankingEngine.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
const candidateRoot = process.env.BLOCK18_CANDIDATE_ROOT?.trim();
if (!isolatedUrl || !candidateRoot) {
  console.log(JSON.stringify({ status: 'not_run', integration: 'block18-champions-ranking-candidate', reason: 'isolated_database_or_candidate_missing' }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');

const historical = JSON.parse(await readFile(`${candidateRoot}/BLOCK17_HISTORICAL_SNAPSHOT_CANDIDATE.json`, 'utf8')) as ChampionsSnapshot;
const weekly = JSON.parse(await readFile(`${candidateRoot}/BLOCK17_WEEKLY_SNAPSHOT_CANDIDATE.json`, 'utf8')) as ChampionsSnapshot;
const pool = new pg.Pool({ connectionString: isolatedUrl, max: 2 });
const labApp = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'lab' });
const officialApp = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'official' });
try {
  const categories = await labApp.inject({ method: 'GET', url: '/v1/categories' });
  assert.equal(categories.statusCode, 200);
  assert.equal(JSON.parse(categories.body).categories.filter((row: { slug: string }) => row.slug === 'uefa-champions-league-goals').length, 1);
  const historicalResponse = await labApp.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-goals?dataset=historical_base&limit=200' });
  const weeklyResponse = await labApp.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-goals?dataset=active_season_weekly&limit=200' });
  assert.equal(historicalResponse.statusCode, 200);
  assert.equal(weeklyResponse.statusCode, 200);
  const historicalBody = JSON.parse(historicalResponse.body);
  const weeklyBody = JSON.parse(weeklyResponse.body);
  assert.equal(historicalBody.snapshotId, historical.id);
  assert.equal(weeklyBody.snapshotId, weekly.id);
  assert.equal(historicalBody.status, 'provisional');
  assert.equal(weeklyBody.status, 'provisional');
  const expectedHistorical = historical.ranking[0];
  const expectedWeekly = weekly.ranking[0];
  if (!expectedHistorical || !expectedWeekly) throw new Error('Los snapshots candidatos no contienen ranking');
  assert.equal(historicalBody.entries[0].raw_value, expectedHistorical.rawValue);
  assert.equal(historicalBody.entries[0].rank, expectedHistorical.rank);
  assert.equal(historicalBody.entries[0].tie_group, expectedHistorical.tieGroup);
  assert.equal(weeklyBody.entries[0].raw_value, expectedWeekly.rawValue);
  assert.equal(weeklyBody.factCount > 20_000, true);
  assert.equal(weeklyBody.entries.some((entry: { sources: unknown[] }) => entry.sources.length > 0), true);
  assert.equal(new Set(weeklyBody.entries.map((entry: { entity_id: string }) => entry.entity_id)).size, weeklyBody.entries.length);
  const officialResponse = await officialApp.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-goals' });
  assert.equal(officialResponse.statusCode, 404);
  assert.equal(JSON.parse(officialResponse.body).reason, 'no_published_snapshot');
  const missingResponse = await labApp.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals' });
  assert.equal(missingResponse.statusCode, 404);
  console.log(JSON.stringify({ status: 'passed', integration: 'block18-champions-ranking-candidate', historicalSnapshot: historical.id, weeklySnapshot: weekly.id, factCount: weeklyBody.factCount, official: 'blocked' }, null, 2));
} finally {
  await labApp.close();
  await officialApp.close();
  await pool.end();
}
