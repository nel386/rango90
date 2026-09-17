import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
if (!isolatedUrl) {
  console.log(JSON.stringify({ status: 'not_run', integration: 'block18-champions-ranking', reason: 'RANGO90_ISOLATED_DATABASE_URL_missing' }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');

const suffix = randomUUID().slice(0, 8);
const pool = new pg.Pool({ connectionString: isolatedUrl, max: 2, connectionTimeoutMillis: 5_000 });
const sourceKey = `block18-source-${suffix}`;
const captureId = `block18-capture-${suffix}`;
const editionId = `champions:block18:${suffix}`;
const playerA = `block18-player-a-${suffix}`;
const playerB = `block18-player-b-${suffix}`;
const historicalFactA = `block18-historical-fact-a-${suffix}`;
const historicalFactB = `block18-historical-fact-b-${suffix}`;
const activeFactA = `block18-active-fact-a-${suffix}`;
const historicalSnapshotId = `block18-historical-snapshot-${suffix}`;
const weeklySnapshotId = `block18-weekly-snapshot-${suffix}`;
const weeklySnapshotUpdatedId = `block18-weekly-snapshot-updated-${suffix}`;

async function setup(): Promise<void> {
  await pool.query('BEGIN');
  try {
    await pool.query(`INSERT INTO sources (key, name, source_type, base_url, usage_notes, rights_status) VALUES ($1, 'Block 18 fixture source', 'reference', 'https://fixture.example/block18', 'isolated only', 'review_required')`, [sourceKey]);
    await pool.query(`INSERT INTO champions_source_captures (id, source_key, captured_at, source_url, content_sha256, data_version) VALUES ($1, $2, '2026-09-17T00:00:00Z', 'https://fixture.example/block18/capture', $3, 'block18-fixture')`, [captureId, sourceKey, 'a'.repeat(64)]);
    await pool.query(`INSERT INTO champions_editions (id, season_start, season_end, season_label, era, competition_name, include_qualifying, is_current_season, scope_version) VALUES ($1, 2025, 2026, '2025/26', 'champions_league', 'UEFA Champions League', FALSE, FALSE, 'block18-fixture')`, [editionId]);
    await pool.query(`INSERT INTO entities (id, entity_type, canonical_name, catalog_status) VALUES ($1, 'player', 'Block 18 Player A', 'active'), ($2, 'player', 'Block 18 Player B', 'excluded_from_game')`, [playerA, playerB]);
    await pool.query(`INSERT INTO entity_game_profiles (entity_id, playable_default, reason) VALUES ($1, TRUE, 'block18 fixture'), ($2, FALSE, 'historical only')`, [playerA, playerB]);
    const facts = [
      [historicalFactA, playerA, '2025-10-01', 'fixture:historical:a', 10],
      [historicalFactB, playerB, '2025-10-02', 'fixture:historical:b', 10],
      [activeFactA, playerA, '2026-09-01', 'fixture:active:a', 1]
    ] as const;
    for (const [id, playerId, date, recordId, goals] of facts) {
      await pool.query(`INSERT INTO champions_goal_facts (id, edition_id, canonical_player_id, source_player_id, player_name_at_source, match_id, match_date, home_team, away_team, phase, goals, source_key, source_capture_id, source_record_id, evidence, captured_at) VALUES ($1, $2, $3, $3, $4, $5, $6, 'Home', 'Away', 'group', $7, $8, $9, $10, $11, '2026-09-17T00:00:00Z')`, [id, editionId, playerId, playerId, `match:${recordId}`, date, goals, sourceKey, captureId, recordId, JSON.stringify({ sourceUrl: 'https://fixture.example/block18/match', locator: `fixture=${recordId}`, contentSha256: 'a'.repeat(64) })]);
    }
    await pool.query(`INSERT INTO champions_ranking_snapshots (id, category_slug, scope_version, dataset, season_start, season_end, status, content_sha256, generated_at, coverage_complete) VALUES ($1, 'uefa-champions-league-goals', 'block18-fixture', 'historical_base', 1955, 2025, 'lab_provisional', $2, '2026-09-17T01:00:00Z', TRUE), ($3, 'uefa-champions-league-goals', 'block18-fixture', 'active_season_weekly', 1955, 2026, 'lab_provisional', $4, '2026-09-17T02:00:00Z', TRUE), ($5, 'uefa-champions-league-goals', 'block18-fixture', 'active_season_weekly', 1955, 2026, 'lab_provisional', $6, '2026-09-17T03:00:00Z', TRUE)`, [historicalSnapshotId, 'b'.repeat(64), weeklySnapshotId, 'c'.repeat(64), weeklySnapshotUpdatedId, 'd'.repeat(64)]);
    await pool.query(`INSERT INTO champions_ranking_entries (snapshot_id, canonical_player_id, raw_value, rank, tie_group, fact_ids, eras) VALUES ($1, $3, 10, 1, 1, $5, ARRAY['champions_league']), ($1, $4, 10, 1, 1, $6, ARRAY['champions_league']), ($2, $3, 11, 1, 1, $7, ARRAY['champions_league']), ($2, $4, 10, 2, 2, $6, ARRAY['champions_league']), ($8, $3, 12, 1, 1, $9, ARRAY['champions_league']), ($8, $4, 10, 2, 2, $6, ARRAY['champions_league'])`, [historicalSnapshotId, weeklySnapshotId, playerA, playerB, [historicalFactA], [historicalFactB], [historicalFactA, activeFactA], weeklySnapshotUpdatedId, [historicalFactA, activeFactA]]);
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

await setup();
const labApp = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'lab' });
const officialApp = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'official' });
try {
  const categories = await labApp.inject({ method: 'GET', url: '/v1/categories' });
  assert.equal(categories.statusCode, 200);
  assert.equal(JSON.parse(categories.body).categories.filter((row: { slug: string }) => row.slug === 'uefa-champions-league-goals').length, 1);

  const historical = await labApp.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-goals?dataset=historical_base&limit=200' });
  assert.equal(historical.statusCode, 200);
  const historicalBody = JSON.parse(historical.body);
  assert.equal(historicalBody.snapshotId, historicalSnapshotId);
  assert.equal(historicalBody.rankingScope, 'historical_snapshot');
  assert.equal(historicalBody.entries[0].raw_value, 10);
  assert.equal(historicalBody.entries[0].score_value, 1);
  assert.equal(historicalBody.entries[0].tie_group, 1);
  assert.equal(historicalBody.entries[0].sources[0].contentSha256, 'a'.repeat(64));
  assert.equal(historicalBody.entries[0].playable, true);
  assert.equal(historicalBody.entries[1].playable, false);

  const weekly = await labApp.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-goals?limit=200' });
  assert.equal(weekly.statusCode, 200);
  const weeklyBody = JSON.parse(weekly.body);
  assert.equal(weeklyBody.snapshotId, weeklySnapshotUpdatedId);
  assert.equal(weeklyBody.rankingScope, 'active_season_weekly');
  assert.equal(weeklyBody.entries[0].raw_value, 12);
  assert.equal(weeklyBody.factCount, 3);
  assert.equal(weeklyBody.status, 'provisional');

  const official = await officialApp.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-goals' });
  assert.equal(official.statusCode, 404);
  assert.equal(JSON.parse(official.body).reason, 'no_published_snapshot');

  const missing = await labApp.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals' });
  assert.equal(missing.statusCode, 404);
  console.log(JSON.stringify({ status: 'passed', integration: 'block18-champions-ranking', historicalSnapshotId, weeklySnapshotId: weeklySnapshotUpdatedId, officialMode: 'no_candidate_fallback' }, null, 2));
} finally {
  await labApp.close();
  await officialApp.close();
  await pool.end();
}
