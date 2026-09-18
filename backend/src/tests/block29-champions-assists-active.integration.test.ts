import assert from 'node:assert/strict';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
if (!isolatedUrl) {
  console.log(JSON.stringify({ status: 'not_run', integration: 'block29-champions-assists-active', reason: 'RANGO90_ISOLATED_DATABASE_URL_missing' }));
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: isolatedUrl, max: 2, connectionTimeoutMillis: 5_000 });
const lab = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'lab' });
const official = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'official' });
try {
  const active = await lab.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-assists?scope=active_season&season=2026' });
  assert.equal(active.statusCode, 200);
  const activeBody = JSON.parse(active.body) as { scope: string; season: number; status: string; entries: unknown[]; factCount: number; coverageEstimated?: number | null; provisionalWarningEs?: string };
  assert.equal(activeBody.scope, 'active_season');
  assert.equal(activeBody.season, 2026);
  assert.equal(activeBody.status, 'provisional');
  assert.ok(activeBody.entries.length > 0);
  assert.ok(activeBody.factCount > 0);
  assert.equal(typeof activeBody.provisionalWarningEs, 'string');
  assert.ok(activeBody.coverageEstimated === null || typeof activeBody.coverageEstimated === 'number');

  const historical = await lab.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-assists?scope=historical' });
  assert.equal(historical.statusCode, 404);
  assert.equal(JSON.parse(historical.body).reason, 'historical_candidate_not_sufficient');

  const officialResponse = await official.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-assists?scope=active_season' });
  assert.equal(officialResponse.statusCode, 404);
  assert.equal(JSON.parse(officialResponse.body).reason, 'no_published_snapshot');
  console.log(JSON.stringify({ status: 'passed', integration: 'block29-champions-assists-active', active: true, historical: 'blocked', official: 'blocked' }, null, 2));
} finally {
  await lab.close();
  await official.close();
  await pool.end();
}
