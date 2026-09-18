import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { buildWorldCupSnapshot, type WorldCupFact, type WorldCupSnapshot } from '../worldCupRankingEngine.js';

const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const inputFile = process.env.BLOCK19_FACTS_FILE?.trim() || 'data/examples/block19-world-cup-facts.json';
const runtimeMode = process.env.RANGO90_RUNTIME_MODE?.trim();
if (!databaseUrl || !['lab', 'test'].includes(runtimeMode ?? '')) throw new Error('BLOQUE 19 solo permite cargar candidatos con DATABASE_URL en lab/test');

const input = JSON.parse(await readFile(inputFile, 'utf8')) as { kind?: string; facts?: WorldCupFact[] };
if (input.kind !== 'controlled_fixture_only' || !input.facts?.length) throw new Error('BLOQUE 19 exige un fixture explícitamente controlado');
const facts = input.facts;
const coverage = [{ sourceKey: 'block19-fixture', coveredEditions: [2022, 2026], missingEditions: [], complete: true, reason: 'controlled fixture coverage; not historical coverage' }];
const historical = buildWorldCupSnapshot({ facts: facts.filter((fact) => fact.edition.year === 2022), dataset: 'historical_base', editionStart: 2022, editionEnd: 2022, coverage, generatedAt: '2026-09-18T00:00:00.000Z', fixtureOnly: true });
const weekly = buildWorldCupSnapshot({ facts, dataset: 'active_edition_weekly', editionStart: 2022, editionEnd: 2026, parentSnapshotId: historical.id, coverage, generatedAt: '2026-09-18T00:01:00.000Z', fixtureOnly: true });

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
async function insertSnapshot(snapshot: WorldCupSnapshot): Promise<void> {
  await pool.query(`INSERT INTO world_cup_ranking_snapshots (id, category_slug, scope_version, dataset, edition_start, edition_end, status, parent_snapshot_id, rollback_of, content_sha256, generated_at, coverage_complete, unresolved_conflicts, unresolved_identity_facts, excluded_own_goal_facts, excluded_unknown_phase_facts, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT (id) DO NOTHING`, [snapshot.id, snapshot.categorySlug, snapshot.scopeVersion, snapshot.dataset, snapshot.editionStart, snapshot.editionEnd, snapshot.status, snapshot.parentSnapshotId, snapshot.rollbackOf, snapshot.contentSha256, snapshot.generatedAt, snapshot.coverageComplete, snapshot.conflicts.length, snapshot.unresolvedIdentityFacts.length, snapshot.excludedOwnGoalFacts.length, snapshot.excludedUnknownPhaseFacts.length, { ...snapshot.metadata, fixtureOnly: true, factCount: snapshot.factIds.length }]);
  for (const entry of snapshot.ranking) await pool.query(`INSERT INTO world_cup_ranking_entries (snapshot_id, canonical_player_id, raw_value, rank, tie_group, fact_ids) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (snapshot_id, canonical_player_id) DO NOTHING`, [snapshot.id, entry.canonicalPlayerId, entry.rawValue, entry.rank, entry.tieGroup, entry.factIds]);
  await pool.query(`INSERT INTO world_cup_snapshot_audit (id, snapshot_id, action, parent_snapshot_id, reason, actor) VALUES ($1,$2,'created',$3,$4,'block19-lab-loader') ON CONFLICT (id) DO NOTHING`, [`audit:${snapshot.id}`, snapshot.id, snapshot.parentSnapshotId, 'controlled fixture candidate; official publication blocked']);
}
try {
  await pool.query('BEGIN');
  await pool.query(`INSERT INTO sources (key,name,source_type,base_url,usage_notes,rights_status) VALUES ('block19-fixture','BLOQUE 19 controlled fixture','reference','https://fixture.invalid/block19/world-cup','Isolated QA only; not a historical source.','review_required') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO world_cup_source_captures (id,source_key,captured_at,source_url,content_sha256,data_version,metadata) VALUES ('block19-capture-v1','block19-fixture','2026-09-18T00:00:00Z','https://fixture.invalid/block19/world-cup',$1,'block19-fixture-v1',$2) ON CONFLICT (id) DO NOTHING`, ['a'.repeat(64), { fixtureOnly: true, rawPayloadStored: false }]);
  for (const fact of facts) {
    await pool.query(`INSERT INTO world_cup_editions (id,edition_year,edition_label,tournament_phase_scope,is_current_edition,scope_version) VALUES ($1,$2,$3,'final_tournament',$4,'world-cup-goals-final-tournaments-v1') ON CONFLICT (id) DO NOTHING`, [fact.edition.id, fact.edition.year, fact.edition.label, fact.edition.isCurrentEdition]);
    if (fact.player) {
      await pool.query(`INSERT INTO entities (id,entity_type,canonical_name,catalog_status) VALUES ($1,'player',$2,'active') ON CONFLICT (id) DO NOTHING`, [fact.player.canonicalId, fact.player.displayName]);
      await pool.query(`INSERT INTO entity_game_profiles (entity_id,playable_default,reason) VALUES ($1,TRUE,'BLOQUE 19 isolated fixture') ON CONFLICT (entity_id) DO NOTHING`, [fact.player.canonicalId]);
    }
    await pool.query(`INSERT INTO world_cup_goal_facts (id,edition_id,canonical_player_id,source_player_id,player_name_at_source,match_id,match_date,home_team,away_team,phase,goals,is_own_goal,is_shootout,scope_eligible,source_key,source_capture_id,source_record_id,evidence,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE,$13,$14,$15,$16,$17,$18) ON CONFLICT (id) DO NOTHING`, [fact.id, fact.edition.id, fact.player?.canonicalId ?? null, fact.player?.sourcePlayerId ?? null, fact.player?.displayName ?? null, fact.match.id, fact.match.date, fact.match.homeTeam, fact.match.awayTeam, fact.phase, fact.goals, fact.isOwnGoal, fact.scopeEligible !== false, fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId, fact.evidence, fact.capturedAt]);
  }
  await insertSnapshot(historical); await insertSnapshot(weekly);
  await pool.query('COMMIT');
  console.log(JSON.stringify({ status: 'passed', candidateKind: 'controlled_fixture_only', facts: facts.length, rankingFacts: weekly.factIds.length, ownGoalsStoredButExcluded: weekly.excludedOwnGoalFacts.length, snapshots: { historical: historical.id, activeEdition: weekly.id }, officialPublication: 'blocked', productionDatabaseAccess: 'none', renderTouched: false, imagesTouched: false }, null, 2));
} catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }
