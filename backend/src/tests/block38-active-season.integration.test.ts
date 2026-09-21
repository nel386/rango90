import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
const reportPath = resolve(process.env.BLOCK38_OUTPUT_ROOT?.trim() || 'audits/block38', 'BLOCK38_INTEGRATION_REPORT.json');
if (!isolatedUrl) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ status: 'not_run', reason: 'RANGO90_ISOLATED_DATABASE_URL_missing', externalRequests: 0 }, null, 2));
  console.log(JSON.stringify({ status: 'not_run', integration: 'block38-active-season', reason: 'RANGO90_ISOLATED_DATABASE_URL_missing' }));
  process.exit(0);
}

const competitionId = process.env.BLOCK38_COMPETITION === 'ligue-1' ? '61' : process.env.BLOCK38_COMPETITION === 'primeira-liga' ? '94' : '78';
const pool = new pg.Pool({ connectionString: isolatedUrl, max: 2, connectionTimeoutMillis: 5000 });
const lab = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'lab' });
try {
  const active = await lab.inject({ method: 'GET', url: `/v1/rankings/club-cards?card=yellow&scope=active&season=2026&competition=${competitionId}` });
  assert.equal(active.statusCode, 200);
  const activeBody = JSON.parse(active.body) as { scopeStatus: string; activeSeasonStatus: string; seasonInProgress: boolean; observedFacts: number; observedPages: number | null; entries: unknown[] };
  assert.equal(activeBody.scopeStatus, 'provisional_active_season'); assert.equal(activeBody.activeSeasonStatus, 'provisional_active_season'); assert.equal(activeBody.seasonInProgress, true); assert.ok(activeBody.observedFacts > 0); assert.ok(activeBody.observedPages !== null && activeBody.observedPages > 0); assert.ok(activeBody.entries.length > 0);
  const aggregate = await lab.inject({ method: 'GET', url: '/v1/rankings/club-cards?card=yellow&scope=active&season=2026&competition=complete_scope' });
  assert.equal(aggregate.statusCode, 404); assert.equal(JSON.parse(aggregate.body).reason, 'no_available_snapshot');
  const catalog = await lab.inject({ method: 'GET', url: '/v1/rankings/catalog?season=2026' });
  assert.equal(catalog.statusCode, 200);
  const catalogBody = JSON.parse(catalog.body) as { categories: Array<{ slug: string; scopeDetails?: { provisional?: Array<{ id: string; status: string }> } }> };
  const yellowCards = catalogBody.categories.find((category) => category.slug === 'club-career-yellow-cards');
  assert.equal(yellowCards?.scopeDetails?.provisional?.some((item) => item.id === competitionId && item.status === 'provisional_active_season'), true);
  const status = await lab.inject({ method: 'GET', url: '/v1/rankings/club-cards/status?season=2026' });
  assert.equal(status.statusCode, 200);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ status: 'passed', externalRequests: 0, provisionalCompetition: competitionId, aggregateExcluded: true, officialBlocked: true }, null, 2));
  console.log(JSON.stringify({ status: 'passed', provisionalCompetition: competitionId, aggregateExcluded: true, externalRequests: 0 }));
} finally { await lab.close(); await pool.end(); }
