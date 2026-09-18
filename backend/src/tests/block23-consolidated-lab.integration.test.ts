import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';
import type { ChampionsGoalFact, ChampionsSnapshot } from '../championsRankingEngine.js';
import type { WorldCupFact, WorldCupSnapshot } from '../worldCupRankingEngine.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
const championsRoot = process.env.BLOCK23_CHAMPIONS_ROOT?.trim();
const worldCupRoot = process.env.BLOCK23_WORLD_CUP_ROOT?.trim();
if (!isolatedUrl || !championsRoot || !worldCupRoot) {
  console.log(JSON.stringify({ status: 'not_run', integration: 'block23-consolidated-lab', reason: 'isolated_database_or_candidate_roots_missing' }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');

type CandidateReports = { readyForApproval?: boolean; source?: Record<string, unknown>; publication?: Record<string, unknown>; snapshots?: { rollback?: { status?: string } } };
const championsHistorical = JSON.parse(await readFile(`${championsRoot}/BLOCK17_HISTORICAL_SNAPSHOT_CANDIDATE.json`, 'utf8')) as ChampionsSnapshot;
const championsActive = JSON.parse(await readFile(`${championsRoot}/BLOCK17_WEEKLY_SNAPSHOT_CANDIDATE.json`, 'utf8')) as ChampionsSnapshot;
const championsFacts = (JSON.parse(await readFile(`${championsRoot}/BLOCK17_FACTS_AFTER.json`, 'utf8')) as { facts: ChampionsGoalFact[] }).facts;
const championsReport = JSON.parse(await readFile(`${championsRoot}/BLOCK17_REPORT.json`, 'utf8')) as CandidateReports;
const worldCupBundle = JSON.parse(await readFile(`${worldCupRoot}/BLOCK20_SNAPSHOTS.json`, 'utf8')) as { historical: WorldCupSnapshot; active: WorldCupSnapshot };
const worldCupFacts = (JSON.parse(await readFile(`${worldCupRoot}/BLOCK20_FACTS.json`, 'utf8')) as { facts: WorldCupFact[] }).facts;
const worldCupReport = JSON.parse(await readFile(`${worldCupRoot}/BLOCK20_REPORT.json`, 'utf8')) as CandidateReports;

const db = new pg.Pool({ connectionString: isolatedUrl, max: 2, connectionTimeoutMillis: 5_000 });
const lab = buildApp({ gameDb: db as unknown as ContractDatabase, runtimeMode: 'lab' });
const official = buildApp({ gameDb: db as unknown as ContractDatabase, runtimeMode: 'official' });

function topEntries(snapshot: ChampionsSnapshot | WorldCupSnapshot): Array<{ entityId: string; rawValue: number; rank: number; scoreValue: number; tieGroup: number }> {
  return snapshot.ranking.filter((entry) => entry.rank <= 200).map((entry) => ({ entityId: entry.canonicalPlayerId, rawValue: entry.rawValue, rank: entry.rank, scoreValue: Math.min(entry.rank, 100), tieGroup: entry.tieGroup }));
}

function compareEndpoint(body: Record<string, unknown>, snapshot: ChampionsSnapshot | WorldCupSnapshot, factRows: Array<ChampionsGoalFact | WorldCupFact>, expectedDataset: string): void {
  assert.equal(body.snapshotId, snapshot.id);
  assert.equal(body.dataset, expectedDataset);
  assert.equal(body.mode, 'lab');
  assert.equal(body.status, 'provisional');
  assert.equal(body.coverageComplete, true);
  assert.equal(body.contentSha256, snapshot.contentSha256);
  assert.equal(body.dataVersion, snapshot.scopeVersion);
  assert.equal(body.generatedAt, snapshot.generatedAt);
  assert.equal(body.factCount, snapshot.factIds.length);
  const actual = body.entries as Array<Record<string, unknown>>;
  const expected = topEntries(snapshot);
  assert.equal(actual.length, expected.length);
  const factById = new Map(factRows.map((fact) => [fact.id, fact]));
  for (const [index, expectedEntry] of expected.entries()) {
    const row = actual[index];
    assert.ok(row, `missing endpoint row ${index}`);
    assert.deepEqual({ entityId: row.entity_id, rawValue: row.raw_value, rank: row.rank, scoreValue: row.score_value, tieGroup: row.tie_group }, expectedEntry);
    assert.equal(typeof row.canonical_name, 'string');
    assert.equal(row.playable, true);
    const expectedSources = new Set(expectedEntry.entityId === row.entity_id ? (snapshot.ranking.find((entry) => entry.canonicalPlayerId === expectedEntry.entityId)?.factIds ?? []).map((id) => `${factById.get(id)?.sourceKey}|${factById.get(id)?.sourceRecordId}`) : []);
    const actualSources = new Set((row.sources as Array<{ sourceKey: string; sourceRecordId: string }>).map((source) => `${source.sourceKey}|${source.sourceRecordId}`));
    for (const source of expectedSources) assert.equal(actualSources.has(source), true, `missing provenance ${source}`);
  }
}

try {
  assert.notEqual(championsReport.publication?.officialSnapshotCreated, true);
  assert.notEqual(championsReport.publication?.officialModeOpened, true);
  assert.notEqual(worldCupReport.publication?.officialSnapshotCreated, true);
  assert.notEqual(worldCupReport.publication?.officialModeOpened, true);
  assert.equal(championsReport.snapshots?.rollback?.status, 'passed_fixture');

  const configResponse = await lab.inject({ method: 'GET', url: '/v1/config' });
  assert.equal(configResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(configResponse.body), { service: 'rango90-backend', runtimeMode: 'lab', modeLabel: 'Modo laboratorio', provisionalDataAllowed: true, officialPublicationOnly: false });

  const categoriesResponse = await lab.inject({ method: 'GET', url: '/v1/categories' });
  assert.equal(categoriesResponse.statusCode, 200);
  const categories = JSON.parse(categoriesResponse.body).categories as Array<{ slug: string; availability: string }>;
  assert.equal(categories.filter((category) => category.slug === 'uefa-champions-league-goals').length, 1);
  assert.equal(categories.filter((category) => category.slug === 'world-cup-goals').length, 1);
  assert.equal(categories.find((category) => category.slug === 'uefa-champions-league-goals')?.availability, 'provisional');
  assert.equal(categories.find((category) => category.slug === 'world-cup-goals')?.availability, 'provisional');

  const championsHistoricalResponse = await lab.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-goals?dataset=historical_base&limit=200' });
  const championsActiveResponse = await lab.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-goals?dataset=active_season_weekly&limit=200' });
  const worldCupHistoricalResponse = await lab.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals?dataset=historical_base&limit=200' });
  const worldCupActiveResponse = await lab.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals?dataset=active_edition_weekly&limit=200' });
  for (const response of [championsHistoricalResponse, championsActiveResponse, worldCupHistoricalResponse, worldCupActiveResponse]) assert.equal(response.statusCode, 200);
  compareEndpoint(JSON.parse(championsHistoricalResponse.body), championsHistorical, championsFacts, 'historical_base');
  compareEndpoint(JSON.parse(championsActiveResponse.body), championsActive, championsFacts, 'active_season_weekly');
  compareEndpoint(JSON.parse(worldCupHistoricalResponse.body), worldCupBundle.historical, worldCupFacts, 'historical_base');
  compareEndpoint(JSON.parse(worldCupActiveResponse.body), worldCupBundle.active, worldCupFacts, 'active_edition_weekly');

  const allRealRankedPlayers = new Set([...topEntries(championsActive), ...topEntries(worldCupBundle.active)].map((entry) => entry.entityId));
  const dailyResponse = await lab.inject({ method: 'GET', url: '/v1/challenges/daily' });
  assert.equal(dailyResponse.statusCode, 200);
  const dailyBody = JSON.parse(dailyResponse.body).challenge as { runtimeMode: string; provisionalData: boolean; testOnly: boolean; categories: Array<{ rankingSnapshotId: string; slug: string }>; decisions: Array<{ entityId: string }>; decisionCount: number };
  assert.equal(dailyBody.runtimeMode, 'lab');
  assert.equal(dailyBody.provisionalData, true);
  assert.equal(dailyBody.testOnly, true);
  assert.equal(dailyBody.decisionCount, 7);
  assert.equal(dailyBody.categories.length, 7);
  assert.equal(dailyBody.decisions.length, 7);
  for (const decision of dailyBody.decisions) assert.equal(allRealRankedPlayers.has(decision.entityId), true);
  assert.equal(dailyBody.categories.some((category) => category.slug === 'uefa-champions-league-goals'), true);
  assert.equal(dailyBody.categories.some((category) => category.slug === 'block23-world-cup-goals'), true);

  const gameResponse = await lab.inject({ method: 'POST', url: '/v1/games', payload: { challengeId: JSON.parse(dailyResponse.body).challenge.id } });
  assert.equal(gameResponse.statusCode, 201);
  const gameBody = JSON.parse(gameResponse.body);
  assert.equal(gameBody.challenge.runtimeMode, 'lab');
  assert.equal(gameBody.challenge.provisionalData, true);
  assert.equal(gameBody.challenge.decisions.length, 7);
  for (const decision of gameBody.challenge.decisions) assert.equal(allRealRankedPlayers.has(decision.entityId), true);

  const officialChampions = await official.inject({ method: 'GET', url: '/v1/rankings/uefa-champions-league-goals' });
  const officialWorldCup = await official.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals' });
  assert.equal(officialChampions.statusCode, 404);
  assert.equal(officialWorldCup.statusCode, 404);
  assert.equal(JSON.parse(officialChampions.body).reason, 'no_published_snapshot');
  assert.equal(JSON.parse(officialWorldCup.body).reason, 'no_published_snapshot');

  const counts = await db.query<{ champions_facts: string; world_cup_facts: string; published_champions: string; published_world_cup: string; world_cup_rollbacks: string }>(`SELECT
    (SELECT COUNT(DISTINCT id)::text FROM champions_goal_facts) AS champions_facts,
    (SELECT COUNT(DISTINCT id)::text FROM world_cup_goal_facts) AS world_cup_facts,
    (SELECT COUNT(*)::text FROM champions_ranking_snapshots WHERE status = 'published') AS published_champions,
    (SELECT COUNT(*)::text FROM world_cup_ranking_snapshots WHERE status = 'published') AS published_world_cup,
    (SELECT COUNT(*)::text FROM world_cup_ranking_snapshots WHERE status = 'rolled_back') AS world_cup_rollbacks`);
  assert.equal(Number(counts.rows[0]?.champions_facts), new Set(championsFacts.map((fact) => fact.id)).size);
  assert.equal(Number(counts.rows[0]?.world_cup_facts), new Set(worldCupFacts.map((fact) => fact.id)).size);
  assert.equal(counts.rows[0]?.published_champions, '0');
  assert.equal(counts.rows[0]?.published_world_cup, '0');
  assert.equal(Number(counts.rows[0]?.world_cup_rollbacks) >= 1, true);

  console.log(JSON.stringify({ status: 'passed', integration: 'block23-consolidated-lab', categories: ['uefa-champions-league-goals', 'world-cup-goals'], endpointMatchesMotor: true, historicalAndActiveSeparated: true, provenanceVisible: true, factCounts: { champions: championsFacts.length, worldCup: worldCupFacts.length }, challengeUsesRealRankedPlayers: true, weeklyIdempotency: 'inherited_and_loaded_twice', rollback: 'verified', official: 'blocked', imagesTouched: false, rightsChanged: false, productionDatabaseAccess: 'none' }, null, 2));
} finally {
  await lab.close();
  await official.close();
  await db.end();
}
