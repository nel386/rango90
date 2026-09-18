import assert from 'node:assert/strict';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
if (!isolatedUrl) { console.log(JSON.stringify({ status: 'not_run', integration: 'block30-club-goals-active', reason: 'RANGO90_ISOLATED_DATABASE_URL_missing' })); process.exit(0); }
const pool = new pg.Pool({ connectionString: isolatedUrl, max: 2, connectionTimeoutMillis: 5000 });
const lab = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'lab' });
const official = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'official' });
try {
  const active = await lab.inject({ method: 'GET', url: '/v1/rankings/club-career-goals?scope=active&season=2026' });
  assert.equal(active.statusCode, 200); const body = JSON.parse(active.body) as { scope: string; season: number; status: string; entries: unknown[]; provisionalWarningEs?: string };
  assert.equal(body.scope, 'active'); assert.equal(body.season, 2026); assert.equal(body.status, 'provisional'); assert.ok(body.entries.length > 0); assert.equal(typeof body.provisionalWarningEs, 'string');
  const historical = await lab.inject({ method: 'GET', url: '/v1/rankings/club-career-goals?scope=historical' }); assert.equal(historical.statusCode, 404); assert.equal(JSON.parse(historical.body).reason, 'historical_candidate_not_sufficient');
  const officialResponse = await official.inject({ method: 'GET', url: '/v1/rankings/club-career-goals?scope=active' }); assert.equal(officialResponse.statusCode, 404); assert.equal(JSON.parse(officialResponse.body).reason, 'no_published_snapshot');
  console.log(JSON.stringify({ status: 'passed', integration: 'block30-club-goals-active', active: true, historical: 'blocked', official: 'blocked' }));
} finally { await lab.close(); await official.close(); await pool.end(); }
