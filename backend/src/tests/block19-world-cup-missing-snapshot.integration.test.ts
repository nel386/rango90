import assert from 'node:assert/strict';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
if (!isolatedUrl) {
  console.log(JSON.stringify({ status: 'not_run', integration: 'block19-world-cup-missing-snapshot', reason: 'RANGO90_ISOLATED_DATABASE_URL_missing' }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');
const db = new pg.Pool({ connectionString: isolatedUrl, max: 2 });
const app = buildApp({ gameDb: db as unknown as ContractDatabase, runtimeMode: 'lab' });
try {
  const response = await app.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals' });
  assert.equal(response.statusCode, 404);
  assert.equal(JSON.parse(response.body).reason, 'no_available_snapshot');
  console.log(JSON.stringify({ status: 'passed', integration: 'block19-world-cup-missing-snapshot', fallback: 'none' }, null, 2));
} finally {
  await app.close();
  await db.end();
}
