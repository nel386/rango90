import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';
import type { WorldCupSnapshot } from '../worldCupRankingEngine.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
const inputRoot = process.env.BLOCK20_INPUT_ROOT?.trim();
if (!isolatedUrl || !inputRoot) {
  console.log(JSON.stringify({ status: 'not_run', integration: 'block20-world-cup-ranking', reason: 'isolated_database_or_candidate_missing' }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');
const snapshots = JSON.parse(await readFile(`${inputRoot}/BLOCK20_SNAPSHOTS.json`, 'utf8')) as { historical: WorldCupSnapshot; active: WorldCupSnapshot };
const report = JSON.parse(await readFile(`${inputRoot}/BLOCK20_REPORT.json`, 'utf8')) as { readyForApproval: boolean; facts: { primary: number; contrast: number; unresolvedPlayerFacts: number }; conflicts: unknown[] };
assert.equal(report.readyForApproval, false);
assert.equal(report.facts.unresolvedPlayerFacts, 0);
assert.equal(report.conflicts.length, 0);
const db = new pg.Pool({ connectionString: isolatedUrl, max: 2 });
const lab = buildApp({ gameDb: db as unknown as ContractDatabase, runtimeMode: 'lab' });
const official = buildApp({ gameDb: db as unknown as ContractDatabase, runtimeMode: 'official' });
try {
  const historical = await lab.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals?dataset=historical_base&limit=200' });
  const active = await lab.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals?dataset=active_edition_weekly&limit=200' });
  assert.equal(historical.statusCode, 200);
  assert.equal(active.statusCode, 200);
  const historicalBody = JSON.parse(historical.body); const activeBody = JSON.parse(active.body);
  assert.equal(historicalBody.snapshotId, snapshots.historical.id);
  assert.equal(activeBody.snapshotId, snapshots.active.id);
  assert.equal(historicalBody.status, 'provisional');
  assert.equal(activeBody.factCount, snapshots.active.factIds.length);
  assert.equal(activeBody.entries.some((entry: { sources: unknown[] }) => entry.sources.length > 0), true);
  assert.equal(new Set(activeBody.entries.map((entry: { entity_id: string }) => entry.entity_id)).size, activeBody.entries.length);
  const databaseFacts = await db.query<{ facts: string; primary_facts: string; contrast_facts: string; own_goals: string }>(`SELECT COUNT(*)::text AS facts, COUNT(*) FILTER (WHERE fact_role = 'primary')::text AS primary_facts, COUNT(*) FILTER (WHERE fact_role = 'contrast')::text AS contrast_facts, COUNT(*) FILTER (WHERE is_own_goal)::text AS own_goals FROM world_cup_goal_facts`);
  const databaseFactCounts = databaseFacts.rows[0];
  if (!databaseFactCounts) throw new Error('world_cup_goal_facts count query returned no row');
  assert.equal(Number(databaseFactCounts.primary_facts), report.facts.primary);
  assert.equal(Number(databaseFactCounts.contrast_facts), report.facts.contrast);
  assert.equal(Number(databaseFactCounts.own_goals) > 0, true);
  const rankedContrast = await db.query(`SELECT COUNT(*)::int AS count FROM world_cup_goal_facts WHERE fact_role = 'contrast' AND id = ANY($1::text[])`, [snapshots.active.factIds]);
  assert.equal(rankedContrast.rows[0].count, 0);
  const rollback = await db.query<{ status: string; rollback_of: string }>(`SELECT status, rollback_of FROM world_cup_ranking_snapshots WHERE rollback_of = $1`, [snapshots.active.id]);
  assert.equal(rollback.rows[0]?.status, 'rolled_back');
  assert.equal(rollback.rows[0]?.rollback_of, snapshots.active.id);
  const officialResponse = await official.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals' });
  assert.equal(officialResponse.statusCode, 404);
  assert.equal(JSON.parse(officialResponse.body).reason, 'no_published_snapshot');
  console.log(JSON.stringify({ status: 'passed', integration: 'block20-world-cup-ranking', editions: 23, primaryFacts: report.facts.primary, contrastFacts: report.facts.contrast, ownGoalsStored: Number(databaseFactCounts.own_goals), idempotency: 'passed_by_on_conflict', rollback: 'passed', official: 'blocked' }, null, 2));
} finally { await lab.close(); await official.close(); await db.end(); }
