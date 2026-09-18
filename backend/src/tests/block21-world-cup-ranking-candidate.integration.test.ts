import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';
import type { WorldCupFact, WorldCupSnapshot } from '../worldCupRankingEngine.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
const inputRoot = process.env.BLOCK20_INPUT_ROOT?.trim();
if (!isolatedUrl || !inputRoot) {
  console.log(JSON.stringify({ status: 'not_run', integration: 'block21-world-cup-ranking-candidate', reason: 'isolated_database_or_block20_candidate_missing' }));
  process.exit(0);
}
if (isolatedUrl === process.env.DATABASE_URL?.trim()) throw new Error('RANGO90_ISOLATED_DATABASE_URL must not point to DATABASE_URL');

const candidate = JSON.parse(await readFile(`${inputRoot}/BLOCK20_SNAPSHOTS.json`, 'utf8')) as { historical: WorldCupSnapshot; active: WorldCupSnapshot };
const facts = (JSON.parse(await readFile(`${inputRoot}/BLOCK20_FACTS.json`, 'utf8')) as { facts: WorldCupFact[] }).facts;
const report = JSON.parse(await readFile(`${inputRoot}/BLOCK20_REPORT.json`, 'utf8')) as { facts: { allStored: number; contrast: number } };
const factById = new Map(facts.map((fact) => [fact.id, fact]));
const db = new pg.Pool({ connectionString: isolatedUrl, max: 2 });
const lab = buildApp({ gameDb: db as unknown as ContractDatabase, runtimeMode: 'lab' });
const official = buildApp({ gameDb: db as unknown as ContractDatabase, runtimeMode: 'official' });

function compareEndpointToMotor(body: Record<string, unknown>, snapshot: WorldCupSnapshot): void {
  assert.equal(body.snapshotId, snapshot.id);
  assert.equal(body.dataset, snapshot.dataset);
  assert.equal(body.editionStart, snapshot.editionStart);
  assert.equal(body.editionEnd, snapshot.editionEnd);
  assert.equal(body.status, 'provisional');
  assert.equal(body.mode, 'lab');
  assert.equal(body.coverageComplete, true);
  assert.equal(body.fixtureOnly, false);
  assert.equal(body.dataVersion, snapshot.scopeVersion);
  assert.equal(body.contentSha256, snapshot.contentSha256);
  assert.equal(body.generatedAt, snapshot.generatedAt);
  assert.equal(body.factCount, snapshot.factIds.length);
  assert.equal(body.sourceCount, snapshot.metadata.sourceCount);

  const expected = snapshot.ranking.filter((entry) => entry.rank <= 200);
  const actual = body.entries as Array<Record<string, unknown>>;
  assert.equal(actual.length, expected.length);
  for (const [index, expectedEntry] of expected.entries()) {
    const actualEntry = actual[index];
    assert.ok(actualEntry, `missing endpoint entry at ${index}`);
    assert.deepEqual({
      entityId: actualEntry.entity_id,
      rawValue: actualEntry.raw_value,
      rank: actualEntry.rank,
      scoreValue: actualEntry.score_value,
      tieGroup: actualEntry.tie_group,
      factIds: [...(actualEntry.fact_ids as string[])].sort()
    }, {
      entityId: expectedEntry.canonicalPlayerId,
      rawValue: expectedEntry.rawValue,
      rank: expectedEntry.rank,
      scoreValue: Math.min(expectedEntry.rank, 100),
      tieGroup: expectedEntry.tieGroup,
      factIds: [...expectedEntry.factIds].sort()
    });

    const expectedSources = expectedEntry.factIds.map((id) => factById.get(id)).filter((fact): fact is WorldCupFact => Boolean(fact)).map((fact) => `${fact.sourceKey}|${fact.sourceRecordId}`).sort();
    const actualSources = (actualEntry.sources as Array<{ sourceKey: string; sourceRecordId: string }>).map((source) => `${source.sourceKey}|${source.sourceRecordId}`).sort();
    assert.deepEqual(actualSources, expectedSources);
  }
}

try {
  const categories = await lab.inject({ method: 'GET', url: '/v1/categories' });
  assert.equal(categories.statusCode, 200);
  const worldCupCategory = (JSON.parse(categories.body).categories as Array<{ slug: string; availability: string }>).find((category) => category.slug === 'world-cup-goals');
  assert.equal(worldCupCategory?.availability, 'provisional');

  const historicalResponse = await lab.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals?dataset=historical_base&limit=200' });
  const activeResponse = await lab.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals?dataset=active_edition_weekly&limit=200' });
  assert.equal(historicalResponse.statusCode, 200);
  assert.equal(activeResponse.statusCode, 200);
  compareEndpointToMotor(JSON.parse(historicalResponse.body) as Record<string, unknown>, candidate.historical);
  compareEndpointToMotor(JSON.parse(activeResponse.body) as Record<string, unknown>, candidate.active);

  const databaseFacts = await db.query<{ total: string; distinct_ids: string; contrast: string; ranked_contrast: string }>(`SELECT COUNT(*)::text AS total, COUNT(DISTINCT id)::text AS distinct_ids, COUNT(*) FILTER (WHERE fact_role = 'contrast')::text AS contrast, COUNT(*) FILTER (WHERE fact_role = 'contrast' AND id = ANY($1::text[]))::text AS ranked_contrast FROM world_cup_goal_facts`, [candidate.active.factIds]);
  assert.equal(databaseFacts.rows[0]?.total, String(report.facts.allStored));
  assert.equal(databaseFacts.rows[0]?.distinct_ids, databaseFacts.rows[0]?.total);
  assert.equal(databaseFacts.rows[0]?.contrast, String(report.facts.contrast));
  assert.equal(databaseFacts.rows[0]?.ranked_contrast, '0');

  const snapshots = await db.query<{ total: string; rollback: string }>(`SELECT COUNT(*) FILTER (WHERE status IN ('lab_provisional', 'draft'))::text AS total, COUNT(*) FILTER (WHERE status = 'rolled_back')::text AS rollback FROM world_cup_ranking_snapshots WHERE category_slug = 'world-cup-goals'`);
  assert.equal(snapshots.rows[0]?.total, '2');
  assert.equal(snapshots.rows[0]?.rollback, '1');

  const officialResponse = await official.inject({ method: 'GET', url: '/v1/rankings/world-cup-goals' });
  assert.equal(officialResponse.statusCode, 404);
  assert.equal(JSON.parse(officialResponse.body).reason, 'no_published_snapshot');
  console.log(JSON.stringify({ status: 'passed', integration: 'block21-world-cup-ranking-candidate', editions: 23, facts: report.facts, endpointMatchesMotor: true, selector: 'provisional', idempotency: 'passed', rollback: 'passed', official: 'blocked' }, null, 2));
} finally {
  await lab.close();
  await official.close();
  await db.end();
}
