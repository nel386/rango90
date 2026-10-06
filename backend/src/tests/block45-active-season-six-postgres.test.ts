import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { stableYellowJson } from '../clubYellowCardsCareerRankingEngine.js';

type Json = Record<string, any>;
const databaseUrl = process.env.DATABASE_URL ?? '';
assert.equal(process.env.BLOCK45_ISOLATED_POSTGRES, '1', 'explicit isolated database guard is required');
const parsedDatabaseUrl = new URL(databaseUrl);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedDatabaseUrl.hostname), 'PostgreSQL host must be loopback');
assert.match(parsedDatabaseUrl.pathname, /^\/rango90_block45(?:_|$)/u, 'database name must be a disposable BLOQUE 45 database');
const candidate = JSON.parse(await readFile(process.env.BLOCK45_ACTIVE_SEASON_SIX_CANDIDATE_FILE ?? '', 'utf8')) as Json;
const facts = JSON.parse(await readFile(process.env.BLOCK45_ACTIVE_SEASON_SIX_FACTS_FILE ?? '', 'utf8')) as Json[];
assert.equal(candidate.status, 'ready_for_isolated_validation');
assert.equal(candidate.scopeKind, 'club_active_season_observed');
assert.equal(candidate.careerComplete, false);
assert.equal(candidate.season, 2026);
assert.deepEqual(candidate.includedCompetitionIds, [39, 140, 135, 78, 61, 94]);
assert.deepEqual(candidate.excludedCompetitionIds, []);
assert.equal(candidate.rankingMode, 'one independent ranking per competition; no cross-league aggregate');
assert.equal(candidate.sourceRunId, '36574961077');
assert.match(candidate.sourceCommitSha, /^[a-f0-9]{40}$/u);
assert.match(candidate.sourceManifestHash, /^[a-f0-9]{64}$/u);
assert.match(candidate.sourceCoverageHash, /^[a-f0-9]{64}$/u);
assert.match(candidate.sourceFactsHash, /^[a-f0-9]{64}$/u);
for (const fact of facts) {
  assert.ok(candidate.includedCompetitionIds.includes(fact.leagueId), `fact league ${fact.leagueId} is in declared scope`);
  assert.equal(fact.season, 2026, 'all facts belong to the declared active season');
  assert.ok(fact.competitionName.trim());
  assert.ok(fact.competitionType.trim());
  assert.match(fact.responseSha256, /^[a-f0-9]{64}$/u);
  const sourceUrl = new URL(fact.sourceUrl);
  assert.equal(sourceUrl.pathname, '/players');
  assert.equal(sourceUrl.searchParams.get('season'), '2026');
  assert.ok(sourceUrl.searchParams.has('id') || (sourceUrl.searchParams.has('league') && sourceUrl.searchParams.has('page')));
}
assert.equal(createHash('sha256').update(stableYellowJson(candidate.rankings)).digest('hex'), candidate.rankingSha256);
assert.equal(createHash('sha256').update(stableYellowJson(facts)).digest('hex'), candidate.factSha256);

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`CREATE TEMP TABLE active_fact (
    fact_id TEXT PRIMARY KEY, league_id INTEGER NOT NULL, competition_name TEXT NOT NULL, competition_type TEXT NOT NULL, player_id TEXT NOT NULL, player_name TEXT NOT NULL,
    season INTEGER NOT NULL, club_id INTEGER NOT NULL, club_name TEXT NOT NULL, yellow_cards INTEGER NOT NULL CHECK(yellow_cards >= 0),
    source_page INTEGER NOT NULL, response_sha256 TEXT NOT NULL CHECK(response_sha256 ~ '^[a-f0-9]{64}$'),
    captured_at TIMESTAMPTZ NOT NULL, source_url TEXT NOT NULL
  ) ON COMMIT DROP`);
  await client.query(`CREATE TEMP TABLE coverage (
    league_id INTEGER PRIMARY KEY, pages_expected INTEGER NOT NULL, pages_read INTEGER NOT NULL,
    verified_fact_rows INTEGER NOT NULL, cutoff TIMESTAMPTZ
  ) ON COMMIT DROP`);
  await client.query(`CREATE TEMP TABLE candidate_entry (
    league_id INTEGER NOT NULL, player_id TEXT NOT NULL, player_name TEXT NOT NULL, yellow_cards INTEGER NOT NULL,
    rank INTEGER NOT NULL, tie_group INTEGER NOT NULL, evidence_ids TEXT[] NOT NULL,
    PRIMARY KEY (league_id, player_id)
  ) ON COMMIT DROP`);

  for (const fact of facts) await client.query(
    `INSERT INTO active_fact VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [fact.factId, fact.leagueId, fact.competitionName, fact.competitionType, fact.playerId, fact.playerName, fact.season, fact.clubId, fact.clubName, fact.yellowCards, fact.page, fact.responseSha256, fact.capturedAt, fact.sourceUrl]
  );
  for (const league of candidate.rankings as Json[]) {
    assert.equal(league.coverage.status, 'complete', `${league.leagueId} needs complete paging coverage`);
    assert.equal(league.coverage.pagesRead, league.coverage.pagesExpected, `${league.leagueId} must exhaust paging.total`);
    assert.equal(league.coverage.verifiedFactRows, facts.filter((fact) => fact.leagueId === league.leagueId).length, `${league.leagueId} fact count must reconcile`);
    await client.query('INSERT INTO coverage VALUES ($1,$2,$3,$4,$5)', [league.leagueId, league.coverage.pagesExpected, league.coverage.pagesRead, league.coverage.verifiedFactRows, league.coverage.latestFactCapturedAt]);
    for (const row of league.rows as Json[]) {
      const evidenceIds = (row.evidence as Json[]).map((evidence) => evidence.factId);
      assert.ok(evidenceIds.length > 0, `ranked row ${row.playerId} has source facts`);
      assert.equal((row.evidence as Json[]).reduce((sum, evidence) => sum + evidence.yellowCards, 0), row.yellowCards, `evidence sum matches ${row.playerId}`);
      for (const evidenceId of evidenceIds) {
        const sourceFact = facts.find((fact) => fact.factId === evidenceId);
        assert.ok(sourceFact, `evidence ${evidenceId} exists in the candidate fact artifact`);
        assert.equal(sourceFact.leagueId, league.leagueId);
        assert.equal(sourceFact.competitionName, league.leagueNameEn);
        assert.equal(`api-football:player:${sourceFact.playerId}`, row.playerId);
      }
      await client.query('INSERT INTO candidate_entry VALUES ($1,$2,$3,$4,$5,$6,$7)', [league.leagueId, row.playerId, row.playerName, row.yellowCards, row.rank, row.tieGroup, evidenceIds]);
    }
  }

  const coverageCount = await client.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM coverage WHERE pages_read=pages_expected');
  assert.equal(coverageCount.rows[0]?.count, 6, 'all six league page sets are complete');
  const rankedQuery = await client.query<{ league_id: number; player_id: string; player_name: string; yellow_cards: number; rank: string; tie_group: string }>(`
    WITH player_totals AS (
      SELECT league_id, player_id, MAX(player_name) AS player_name, SUM(yellow_cards)::int AS yellow_cards
        FROM active_fact GROUP BY league_id, player_id HAVING SUM(yellow_cards) > 0
    ), ranked AS (
      SELECT *, RANK() OVER (PARTITION BY league_id ORDER BY yellow_cards DESC) AS rank,
                DENSE_RANK() OVER (PARTITION BY league_id ORDER BY yellow_cards DESC) AS tie_group
        FROM player_totals
    )
    SELECT league_id, player_id, player_name, yellow_cards, rank::text, tie_group::text
      FROM ranked ORDER BY league_id, rank, player_name
  `);
  const actual = new Map((candidate.rankings as Json[]).flatMap((league) => (league.rows as Json[]).map((row) => [`${league.leagueId}|${row.playerId}`, row])));
  assert.equal(rankedQuery.rows.length, actual.size, 'SQL and JSON rankings have same number of players');
  for (const row of rankedQuery.rows) {
    const sourceId = `${row.league_id}|${row.player_id}`;
    const expected = actual.get(sourceId);
    assert.ok(expected, `JSON has SQL ranked player ${sourceId}`);
    assert.equal(expected.playerName, row.player_name);
    assert.equal(expected.yellowCards, row.yellow_cards);
    assert.equal(expected.rank, Number(row.rank));
    assert.equal(expected.tieGroup, Number(row.tie_group));
  }

  const marcos = actual.get('140|api-football:player:2278');
  assert.ok(marcos, 'Marcos Alonso is present in the La Liga ranking');
  assert.equal(marcos.playerName, 'Marcos Alonso');
  assert.equal(marcos.yellowCards, 2);
  assert.equal(marcos.rank, 20);
  assert.ok((candidate.rankings as Json[]).every((league) => league.coverage.latestFactCapturedAt), 'every league has a data cutoff');
  await client.query('COMMIT');
  console.log(JSON.stringify({ status: 'passed', database: parsedDatabaseUrl.pathname.slice(1), candidateSha256: candidate.rankingSha256, facts: facts.length, rankedPlayers: rankedQuery.rows.length, leagues: 6, marcosLaLiga: { rank: marcos.rank, yellowCards: marcos.yellowCards } }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
