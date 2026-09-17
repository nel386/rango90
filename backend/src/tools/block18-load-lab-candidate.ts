import { readFile } from 'node:fs/promises';
import pg from 'pg';
import type { ChampionsGoalFact, ChampionsSnapshot } from '../championsRankingEngine.js';

const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const inputRoot = process.env.BLOCK18_CANDIDATE_ROOT?.trim() ?? '';
const runtimeMode = process.env.RANGO90_RUNTIME_MODE?.trim();
if (!databaseUrl || !inputRoot) throw new Error('BLOQUE 18 requiere DATABASE_URL y BLOCK18_CANDIDATE_ROOT');
if (!['lab', 'test'].includes(runtimeMode ?? '')) throw new Error('BLOQUE 18 solo permite cargar candidatos en lab/test');

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(`${inputRoot}/${name}`, 'utf8')) as T;
}

async function load(): Promise<void> {
  const facts = (await readJson<{ facts: ChampionsGoalFact[] }>('BLOCK17_FACTS_AFTER.json')).facts;
  const historical = await readJson<ChampionsSnapshot>('BLOCK17_HISTORICAL_SNAPSHOT_CANDIDATE.json');
  const weekly = await readJson<ChampionsSnapshot>('BLOCK17_WEEKLY_SNAPSHOT_CANDIDATE.json');
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  try {
    await pool.query('BEGIN');
    const sources = new Map<string, ChampionsGoalFact>();
    const captures = new Map<string, ChampionsGoalFact>();
    const editions = new Map<string, ChampionsGoalFact>();
    const entities = new Map<string, ChampionsGoalFact>();
    for (const fact of facts) {
      sources.set(fact.sourceKey, fact);
      captures.set(fact.sourceCaptureId, fact);
      editions.set(fact.edition.id, fact);
      entities.set(fact.player.canonicalId, fact);
    }
    for (const fact of sources.values()) await pool.query(`INSERT INTO sources (key, name, source_type, base_url, usage_notes, rights_status) VALUES ($1, $2, 'reference', $3, 'BLOQUE 18 lab candidate; no official publication.', 'review_required') ON CONFLICT (key) DO NOTHING`, [fact.sourceKey, `Champions ${fact.sourceKey}`, fact.evidence.sourceUrl]);
    for (const fact of captures.values()) await pool.query(`INSERT INTO champions_source_captures (id, source_key, captured_at, source_url, content_sha256, data_version, metadata) VALUES ($1, $2, $3, $4, $5, 'block17-facts-v1', $6) ON CONFLICT (id) DO NOTHING`, [fact.sourceCaptureId, fact.sourceKey, fact.capturedAt, fact.evidence.sourceUrl, fact.evidence.contentSha256 ?? fact.sourceCaptureId, { importedFrom: 'block17-candidate', rawPayloadStored: false }]);
    for (const fact of editions.values()) await pool.query(`INSERT INTO champions_editions (id, season_start, season_end, season_label, era, competition_name, include_qualifying, is_current_season, scope_version) VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8) ON CONFLICT (id) DO NOTHING`, [fact.edition.id, fact.edition.seasonStart, fact.edition.seasonEnd, fact.edition.seasonLabel, fact.edition.era, fact.edition.competitionName, fact.edition.isCurrentSeason, 'uefa-champions-league-goals-facts-v1']);
    for (const fact of entities.values()) await pool.query(`INSERT INTO entities (id, entity_type, canonical_name, catalog_status) VALUES ($1, 'player', $2, 'excluded_from_game') ON CONFLICT (id) DO NOTHING`, [fact.player.canonicalId, fact.player.displayName]);
    for (const fact of facts) await pool.query(`INSERT INTO champions_goal_facts (id, edition_id, canonical_player_id, source_player_id, player_name_at_source, match_id, match_date, home_team, away_team, phase, goals, source_key, source_capture_id, source_record_id, evidence, captured_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) ON CONFLICT (id) DO NOTHING`, [fact.id, fact.edition.id, fact.player.canonicalId, fact.player.sourcePlayerId, fact.player.displayName, fact.match.id, fact.match.date, fact.match.homeTeam, fact.match.awayTeam, fact.phase, fact.goals, fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId, fact.evidence, fact.capturedAt]);
    for (const snapshot of [historical, weekly]) {
      let parentSnapshotId = snapshot.parentSnapshotId;
      if (parentSnapshotId && !(await pool.query('SELECT 1 FROM champions_ranking_snapshots WHERE id = $1', [parentSnapshotId])).rowCount) parentSnapshotId = null;
      await pool.query(`INSERT INTO champions_ranking_snapshots (id, category_slug, scope_version, dataset, season_start, season_end, status, parent_snapshot_id, rollback_of, content_sha256, generated_at, coverage_complete, unresolved_conflicts, unresolved_identity_facts, excluded_unknown_phase_facts, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) ON CONFLICT (id) DO NOTHING`, [snapshot.id, snapshot.categorySlug, snapshot.scopeVersion, snapshot.dataset, snapshot.seasonStart, snapshot.seasonEnd, snapshot.status, parentSnapshotId, snapshot.rollbackOf, snapshot.contentSha256, snapshot.generatedAt, snapshot.coverageComplete, snapshot.conflicts.length, snapshot.unresolvedIdentityFacts.length, snapshot.excludedUnknownPhaseFacts.length, { lab: true, importedFrom: 'block17-candidate', parentReferencePreserved: snapshot.parentSnapshotId, factCount: snapshot.factIds.length }]);
      for (const entry of snapshot.ranking) await pool.query(`INSERT INTO champions_ranking_entries (snapshot_id, canonical_player_id, raw_value, rank, tie_group, fact_ids, eras) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (snapshot_id, canonical_player_id) DO NOTHING`, [snapshot.id, entry.canonicalPlayerId, entry.rawValue, entry.rank, entry.tieGroup, entry.factIds, entry.eras]);
    }
    await pool.query('COMMIT');
    console.log(JSON.stringify({ status: 'passed', facts: facts.length, snapshots: [historical.id, weekly.id], officialPublication: 'blocked' }, null, 2));
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

await load();
