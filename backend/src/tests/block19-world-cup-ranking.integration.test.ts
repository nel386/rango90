import assert from 'node:assert/strict';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
if (!isolatedUrl) {
  console.log(JSON.stringify({ status: 'not_run', integration: 'block19-world-cup-ranking', reason: 'RANGO90_ISOLATED_DATABASE_URL_missing' }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');
const db = new pg.Pool({ connectionString: isolatedUrl, max: 2 });
const lab = buildApp({ gameDb: db as unknown as ContractDatabase, runtimeMode: 'lab' });
const official = buildApp({ gameDb: db as unknown as ContractDatabase, runtimeMode: 'official' });
try {
  const categories = await lab.inject({ method: 'GET', url: '/v1/categories' });
  assert.equal(categories.statusCode, 200);
  assert.equal(JSON.parse(categories.body).categories.filter((row: { slug: string }) => row.slug === 'world-cup-goals').length, 1);
  const historical = await lab.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals?dataset=historical_base&limit=200' });
  const active = await lab.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals?dataset=active_edition_weekly&limit=200' });
  assert.equal(historical.statusCode, 200);
  assert.equal(active.statusCode, 200);
  const historicalBody = JSON.parse(historical.body);
  const activeBody = JSON.parse(active.body);
  assert.equal(historicalBody.status, 'provisional');
  assert.equal(historicalBody.scopeLabelEs, 'Fixture controlado de lab; no es cobertura histórica');
  assert.equal(activeBody.factCount, 4);
  assert.equal(activeBody.entries.length, 2);
  assert.equal(activeBody.entries[0].sources.length > 0, true);
  assert.equal(new Set(activeBody.entries.map((entry: { entity_id: string }) => entry.entity_id)).size, activeBody.entries.length);
  assert.equal(activeBody.entries.some((entry: { raw_value: number }) => entry.raw_value === 3), true);
  const officialResponse = await official.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals' });
  assert.equal(officialResponse.statusCode, 404);
  assert.equal(JSON.parse(officialResponse.body).reason, 'no_published_snapshot');
  console.log(JSON.stringify({ status: 'passed', integration: 'block19-world-cup-ranking', factCount: activeBody.factCount, ownGoals: 1, official: 'blocked', fixtureOnly: true }, null, 2));
} finally {
  await lab.close();
  await official.close();
  await db.end();
}
