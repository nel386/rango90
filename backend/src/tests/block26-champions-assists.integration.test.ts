import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../app.js';
import { buildChampionsAssistsSnapshot, createChampionsAssistFact } from '../championsAssistsRankingEngine.js';
import { editionForSeason, resolvePlayerIdentity } from '../championsRankingEngine.js';
import type { ContractDatabase } from '../game-contract.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
if (!isolatedUrl) {
  console.log(JSON.stringify({ status: 'not_run', integration: 'block26-champions-assists', reason: 'RANGO90_ISOLATED_DATABASE_URL_missing' }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');

const suffix = randomUUID().slice(0, 8); const pool = new pg.Pool({ connectionString: isolatedUrl, max: 2, connectionTimeoutMillis: 5_000 });
const sourceKey = `block26-fixture-${suffix}`; const captureId = `block26-capture-${suffix}`; const playerId = `block26-player-${suffix}`; const factId = `block26-fact-${suffix}`;
const edition = editionForSeason(2025, 2025); const player = resolvePlayerIdentity({ sourceKey: 'fixture', sourcePlayerId: playerId, displayName: 'Block 26 Assist Player' }, { sourceIds: { [`fixture:${playerId}`]: playerId } });
const fact = createChampionsAssistFact({ id: factId, edition, player, match: { id: `fixture-match-${suffix}`, date: '2025-09-01', homeTeam: 'Home', awayTeam: 'Away' }, eventId: `fixture-event-${suffix}`, phase: 'group', assists: 2, sourceKey, sourceCaptureId: captureId, sourceRecordId: `assist-record-${suffix}`, sourceType: 'primary', verificationStatus: 'confirmed', evidence: { sourceUrl: 'https://fixture.example/block26', locator: 'fixture.events[0].assist', contentSha256: 'f'.repeat(64) }, capturedAt: '2026-09-18T00:00:00Z' });
const snapshot = buildChampionsAssistsSnapshot({ facts: [fact], dataset: 'active_season_weekly', seasonStart: 2025, seasonEnd: 2025, coverage: [{ sourceKey, coveredSeasons: [2025], missingSeasons: [], complete: true, reason: 'isolated fixture' }], generatedAt: '2026-09-18T00:00:00Z' });

await pool.query(`INSERT INTO sources (key,name,source_type,base_url,usage_notes,rights_status) VALUES ($1,'Block 26 fixture','reference','https://fixture.example/block26','isolated only','review_required') ON CONFLICT DO NOTHING`, [sourceKey]);
await pool.query(`INSERT INTO champions_source_captures (id,source_key,captured_at,source_url,content_sha256,data_version) VALUES ($1,$2,$3,$4,$5,'block26-fixture') ON CONFLICT DO NOTHING`, [captureId, sourceKey, fact.capturedAt, fact.evidence.sourceUrl, fact.evidence.contentSha256]);
await pool.query(`INSERT INTO champions_editions (id,season_start,season_end,season_label,era,competition_name,include_qualifying,is_current_season,scope_version) VALUES ($1,2025,2026,'2025/26','champions_league','UEFA Champions League',FALSE,TRUE,'block26-fixture') ON CONFLICT DO NOTHING`, [edition.id]);
await pool.query(`INSERT INTO entities (id,entity_type,canonical_name,catalog_status) VALUES ($1,'player','Block 26 Assist Player','active') ON CONFLICT DO NOTHING`, [playerId]);
await pool.query(`INSERT INTO entity_game_profiles (entity_id,playable_default,reason) VALUES ($1,TRUE,'block26 fixture') ON CONFLICT DO NOTHING`, [playerId]);
const inserted = await pool.query(`INSERT INTO champions_assist_facts (id,edition_id,canonical_player_id,source_player_id,player_name_at_source,match_id,event_id,match_date,home_team,away_team,phase,assists,source_key,source_capture_id,source_record_id,source_type,verification_status,evidence,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT DO NOTHING`, [fact.id, fact.edition.id, fact.player.canonicalId, fact.player.sourcePlayerId, fact.player.displayName, fact.match.id, fact.eventId, fact.match.date, fact.match.homeTeam, fact.match.awayTeam, fact.phase, fact.assists, fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId, fact.sourceType, fact.verificationStatus, fact.evidence, fact.capturedAt]);
assert.equal(inserted.rowCount, 1);
const duplicate = await pool.query(`INSERT INTO champions_assist_facts (id,edition_id,canonical_player_id,source_player_id,player_name_at_source,match_id,event_id,match_date,home_team,away_team,phase,assists,source_key,source_capture_id,source_record_id,source_type,verification_status,evidence,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT DO NOTHING`, [fact.id, fact.edition.id, fact.player.canonicalId, fact.player.sourcePlayerId, fact.player.displayName, fact.match.id, fact.eventId, fact.match.date, fact.match.homeTeam, fact.match.awayTeam, fact.phase, fact.assists, fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId, fact.sourceType, fact.verificationStatus, fact.evidence, fact.capturedAt]);
assert.equal(duplicate.rowCount, 0);
await pool.query(`INSERT INTO champions_ranking_snapshots (id,category_slug,scope_version,dataset,season_start,season_end,status,content_sha256,generated_at,coverage_complete,metadata) VALUES ($1,'uefa-champions-league-assists','block26-fixture','active_season_weekly',2025,2025,'lab_provisional',$2,$3,TRUE,$4)`, [snapshot.id, snapshot.contentSha256, snapshot.generatedAt, { lab: true, metric: 'assists', factCount: 1, sourceCount: 1, published: false }]);
for (const entry of snapshot.ranking) await pool.query(`INSERT INTO champions_ranking_entries (snapshot_id,canonical_player_id,raw_value,rank,tie_group,fact_ids,eras) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [snapshot.id, entry.canonicalPlayerId, entry.rawValue, entry.rank, entry.tieGroup, entry.factIds, entry.eras]);

const lab = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'lab' }); const official = buildApp({ gameDb: pool as unknown as ContractDatabase, runtimeMode: 'official' });
try {
  const categories = await lab.inject({ method: 'GET', url: '/v1/categories' }); assert.equal(categories.statusCode, 200); assert.equal(JSON.parse(categories.body).categories.some((row: { slug: string }) => row.slug === 'uefa-champions-league-assists'), true);
  const active = await lab.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-assists?dataset=active_season_weekly' }); assert.equal(active.statusCode, 200); const body = JSON.parse(active.body); assert.equal(body.entries[0].raw_value, 2); assert.equal(body.entries[0].score_value, 1); assert.equal(body.factCount, 1); assert.equal(body.entries[0].sources[0].contentSha256, 'f'.repeat(64)); assert.equal(body.status, 'provisional'); assert.equal(body.snapshotId, snapshot.id);
  const activeScope = await lab.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-assists?scope=active_season&season=2025' }); assert.equal(activeScope.statusCode, 200); assert.equal(JSON.parse(activeScope.body).scope, 'active_season');
  const historical = await lab.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-assists?scope=historical' }); assert.equal(historical.statusCode, 404); assert.equal(JSON.parse(historical.body).reason, 'historical_candidate_not_sufficient');
  const historicalDataset = await lab.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-assists?dataset=historical_base' }); assert.equal(historicalDataset.statusCode, 404);
  const officialResponse = await official.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-assists' }); assert.equal(officialResponse.statusCode, 404);
  console.log(JSON.stringify({ status: 'passed', integration: 'block26-champions-assists', endpointMatchesSnapshot: true, idempotency: true, historicalGate: 'candidate_not_sufficient', official: 'blocked' }, null, 2));
} finally { await lab.close(); await official.close(); await pool.end(); }
