import assert from 'node:assert/strict';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
if (!isolatedUrl) {
  console.log(JSON.stringify({
    status: 'integration_pending',
    integration: 'rankings-route',
    reason: 'RANGO90_ISOLATED_DATABASE_URL_missing',
  }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) {
  throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');
}

const { Pool } = pg;
const isolatedPool = new Pool({ connectionString: isolatedUrl, max: 2, connectionTimeoutMillis: 5_000 });
await isolatedPool.query('SELECT 1');
const app = buildApp({ gameDb: isolatedPool as unknown as ContractDatabase, runtimeMode: 'official' });
try {
  const response = await app.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals' });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(JSON.parse(response.body), { error: 'ranking_not_available', category: 'world-cup-goals', mode: 'official', reason: 'no_published_snapshot' });
  console.log('rankings isolated integration passed');
} finally {
  await app.close();
  await isolatedPool.end();
}
