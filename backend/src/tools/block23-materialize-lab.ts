import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import { calculateChallengeSha256 } from '../game-contract.js';
import { GAME_ENGINE_VERSION } from '../game-engine.js';
import type { ChampionsSnapshot } from '../championsRankingEngine.js';
import type { WorldCupSnapshot } from '../worldCupRankingEngine.js';

const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const runtimeMode = process.env.RANGO90_RUNTIME_MODE?.trim() ?? '';
const championsRoot = resolve(process.env.BLOCK23_CHAMPIONS_ROOT?.trim() || '.block23/champions');
const worldCupRoot = resolve(process.env.BLOCK23_WORLD_CUP_ROOT?.trim() || '.block23/world-cup');
const outputRoot = resolve(process.env.BLOCK23_OUTPUT_ROOT?.trim() || 'audits/block23');
const runId = (process.env.GITHUB_RUN_ID?.trim() || 'local').replace(/[^a-zA-Z0-9_-]/g, '-');

type CandidateFact = { id: string; sourceKey: string; sourceCaptureId: string; sourceRecordId: string; evidence?: { sourceUrl?: string; locator?: string; contentSha256?: string } };
type CandidateReport = { readyForApproval?: boolean; facts?: Record<string, unknown>; conflicts?: unknown[]; publication?: Record<string, unknown> };
type Candidate = ChampionsSnapshot | WorldCupSnapshot;
type BridgeCategory = { id: string; slug: string; labelEs: string; labelEn: string; source: Candidate; sourceKind: 'champions' | 'world_cup'; sourceDataset: string };

function assertIsolatedDatabase(): void {
  if (!['lab', 'test'].includes(runtimeMode)) throw new Error('BLOQUE 23 solo permite RANGO90_RUNTIME_MODE=lab/test');
  if (!databaseUrl) throw new Error('BLOQUE 23 requiere DATABASE_URL');
  const parsed = new URL(databaseUrl);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) throw new Error('BLOQUE 23 solo acepta PostgreSQL local aislado');
}

async function json<T>(path: string): Promise<T> { return JSON.parse(await readFile(path, 'utf8')) as T; }
function sha(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function isChampions(snapshot: Candidate): snapshot is ChampionsSnapshot { return 'seasonStart' in snapshot; }
function candidateFactIds(snapshot: Candidate): string[] { return snapshot.factIds; }
function rankingRows(snapshot: Candidate): Array<{ entityId: string; playerName: string; rawValue: number; rank: number; scoreValue: number; tieGroup: number; factIds: string[] }> {
  return snapshot.ranking.filter((entry) => entry.rank <= 200).map((entry) => ({ entityId: entry.canonicalPlayerId, playerName: entry.playerName, rawValue: entry.rawValue, rank: entry.rank, scoreValue: Math.min(entry.rank, 100), tieGroup: entry.tieGroup, factIds: entry.factIds }));
}
function sourceSnapshotId(snapshot: Candidate): string { return snapshot.id; }

async function main(): Promise<void> {
  assertIsolatedDatabase();
  const championsHistorical = await json<ChampionsSnapshot>(resolve(championsRoot, 'BLOCK17_HISTORICAL_SNAPSHOT_CANDIDATE.json'));
  const championsActive = await json<ChampionsSnapshot>(resolve(championsRoot, 'BLOCK17_WEEKLY_SNAPSHOT_CANDIDATE.json'));
  const worldCupBundle = await json<{ historical: WorldCupSnapshot; active: WorldCupSnapshot }>(resolve(worldCupRoot, 'BLOCK20_SNAPSHOTS.json'));
  const championsReport = await json<CandidateReport>(resolve(championsRoot, 'BLOCK17_REPORT.json'));
  const worldCupReport = await json<CandidateReport>(resolve(worldCupRoot, 'BLOCK20_REPORT.json'));
  if (championsHistorical.dataset !== 'historical_base' || championsActive.dataset !== 'active_season_weekly') throw new Error('Champions candidate datasets are not separated');
  if (worldCupBundle.historical.dataset !== 'historical_base' || worldCupBundle.active.dataset !== 'active_edition_weekly') throw new Error('World Cup candidate datasets are not separated');
  if (championsReport.readyForApproval === true || worldCupReport.readyForApproval === true) throw new Error('A lab candidate must not be promoted by BLOQUE 23');

  const categories: BridgeCategory[] = [
    { id: 'category-uefa-champions-league-goals', slug: 'uefa-champions-league-goals', labelEs: 'Goles históricos — UEFA Champions League', labelEn: 'All-time goals — UEFA Champions League', source: championsActive, sourceKind: 'champions', sourceDataset: championsActive.dataset },
    { id: 'block23-category-world-cup-goals', slug: 'block23-world-cup-goals', labelEs: 'QA lab — Goles Mundial', labelEn: 'QA lab — World Cup goals', source: worldCupBundle.active, sourceKind: 'world_cup', sourceDataset: worldCupBundle.active.dataset },
    { id: 'block23-category-champions-historical', slug: 'block23-champions-historical', labelEs: 'QA lab — Champions histórico', labelEn: 'QA lab — historical Champions', source: championsHistorical, sourceKind: 'champions', sourceDataset: championsHistorical.dataset },
    { id: 'block23-category-world-cup-historical', slug: 'block23-world-cup-historical', labelEs: 'QA lab — Mundial histórico', labelEn: 'QA lab — historical World Cup', source: worldCupBundle.historical, sourceKind: 'world_cup', sourceDataset: worldCupBundle.historical.dataset },
    { id: 'block23-category-champions-active-2', slug: 'block23-champions-active-slot-2', labelEs: 'QA lab — Champions activo 2', labelEn: 'QA lab — active Champions 2', source: championsActive, sourceKind: 'champions', sourceDataset: championsActive.dataset },
    { id: 'block23-category-world-cup-active-2', slug: 'block23-world-cup-active-slot-2', labelEs: 'QA lab — Mundial activo 2', labelEn: 'QA lab — active World Cup 2', source: worldCupBundle.active, sourceKind: 'world_cup', sourceDataset: worldCupBundle.active.dataset },
    { id: 'block23-category-champions-historical-2', slug: 'block23-champions-historical-slot-2', labelEs: 'QA lab — Champions histórico 2', labelEn: 'QA lab — historical Champions 2', source: championsHistorical, sourceKind: 'champions', sourceDataset: championsHistorical.dataset }
  ];
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5_000 });
  const bridgeSnapshots = new Map<string, { id: string; categoryId: string; categorySlug: string; sourceSnapshotId: string; sourceKind: string; factCount: number; rows: ReturnType<typeof rankingRows> }>();
  const allPlayerIds = new Set<string>();
  try {
    await pool.query('BEGIN');
    for (const category of categories) {
      const rows = rankingRows(category.source);
      if (rows.length < 7) throw new Error(`candidate_has_fewer_than_7_top200_players:${category.slug}`);
      const snapshotId = `block23-bridge-${category.slug}-${sha({ source: sourceSnapshotId(category.source), category: category.slug }).slice(0, 16)}`;
      await pool.query(`INSERT INTO category_definitions (id,slug,label_es,label_en,entity_type,metric_key,scope_kind,scope,ranking_direction,tie_policy,score_cap,definition_md,status) VALUES ($1,$2,$3,$4,'player','goals','block23_lab_bridge',$5,'desc','competition',100,$6,'retired') ON CONFLICT (id) DO NOTHING`, [category.id, category.slug, category.labelEs, category.labelEn, { block: '23', labOnly: true, sourceKind: category.sourceKind }, 'BLOQUE 23: puente efímero desde snapshot especializado; no es una categoría publicable.']);
      await pool.query(`INSERT INTO ranking_snapshots (id,category_id,data_version,algorithm_version,content_sha256,generated_at,status,coverage_complete,eligible_count,unresolved_conflicts,metadata) VALUES ($1,$2,$3,'block23-lab-bridge-v1',$4,$5,'draft',TRUE,$6,0,$7) ON CONFLICT (id) DO NOTHING`, [snapshotId, category.id, category.source.scopeVersion, category.source.contentSha256, category.source.generatedAt, rows.length, { block: '23', labBridge: true, published: false, sourceKind: category.sourceKind, sourceCandidateSnapshotId: category.source.id, sourceDataset: category.sourceDataset, factCount: candidateFactIds(category.source).length }]);
      const facts = new Map<string, CandidateFact>();
      const factBundle = category.sourceKind === 'champions' ? await json<{ facts: CandidateFact[] }>(resolve(championsRoot, 'BLOCK17_FACTS_AFTER.json')) : await json<{ facts: CandidateFact[] }>(resolve(worldCupRoot, 'BLOCK20_FACTS.json'));
      for (const fact of factBundle.facts) facts.set(fact.id, fact);
      for (const row of rows) {
        allPlayerIds.add(row.entityId);
        const evidence = row.factIds.map((id) => facts.get(id)).filter((fact): fact is CandidateFact => Boolean(fact)).map((fact) => ({ sourceKey: fact.sourceKey, sourceCaptureId: fact.sourceCaptureId, sourceRecordId: fact.sourceRecordId, sourceUrl: fact.evidence?.sourceUrl, locator: fact.evidence?.locator, contentSha256: fact.evidence?.contentSha256 }));
        await pool.query(`INSERT INTO ranking_entries (snapshot_id,entity_id,raw_value,rank,score_value,tie_group,evidence) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (snapshot_id,entity_id) DO NOTHING`, [snapshotId, row.entityId, row.rawValue, row.rank, row.scoreValue, row.tieGroup, { block: '23', labBridge: true, sourceCandidateSnapshotId: category.source.id, factIds: row.factIds, sources: evidence }]);
      }
      bridgeSnapshots.set(category.slug, { id: snapshotId, categoryId: category.id, categorySlug: category.slug, sourceSnapshotId: category.source.id, sourceKind: category.sourceKind, factCount: candidateFactIds(category.source).length, rows });
    }
    const playerIds = [...allPlayerIds];
    await pool.query(`UPDATE entities SET catalog_status = 'active', updated_at = NOW() WHERE id = ANY($1::text[])`, [playerIds]);
    for (const entityId of playerIds) await pool.query(`INSERT INTO entity_game_profiles (entity_id,legacy_tier,playable_default,reason,metadata) VALUES ($1,'block23_lab',TRUE,'BLOQUE 23 isolated lab candidate player',$2) ON CONFLICT (entity_id) DO UPDATE SET playable_default = TRUE, reason = EXCLUDED.reason, metadata = entity_game_profiles.metadata || EXCLUDED.metadata, reviewed_at = NOW()`, [entityId, { block: '23', isolatedLab: true, noProductionMutation: true }]);

    const challengeId = `block23-lab-daily-${sha({ runId, categories: categories.map((category) => category.slug), snapshots: [...bridgeSnapshots.values()].map((snapshot) => snapshot.id) }).slice(0, 16)}`;
    const decisionIds = [...new Map(categories.flatMap((category) => bridgeSnapshots.get(category.slug)?.rows ?? []).map((row) => [row.entityId, row])).values()].slice(0, 7).map((row) => row.entityId);
    if (decisionIds.length !== 7) throw new Error('block23_lab_challenge_needs_7_distinct_real_ranked_players');
    const decisions = decisionIds.map((entityId, ordinal) => ({ ordinal, entityId, entityType: 'player' as const }));
    const challengeCategories = categories.map((category, ordinal) => ({ ordinal, categoryId: category.id, rankingSnapshotId: bridgeSnapshots.get(category.slug)!.id, slug: category.slug, entityType: 'player' as const }));
    const answers = decisions.flatMap((decision) => challengeCategories.map((category) => ({ decisionOrdinal: decision.ordinal, categoryId: category.categoryId, scoreValue: bridgeSnapshots.get(category.slug)!.rows.find((row) => row.entityId === decision.entityId)?.scoreValue ?? 100 })));
    const challengeSha256 = calculateChallengeSha256({ id: challengeId, kind: 'daily', challengeDate: '2099-12-31', sourceVersion: 'block23-real-ranking-lab-v1', engineVersion: GAME_ENGINE_VERSION, timeLimitSeconds: 90, scoreCap: 100, categories: challengeCategories, decisions, answers });
    await pool.query(`INSERT INTO game_challenges (id,challenge_kind,challenge_date,status,source_version,engine_version,time_limit_seconds,score_cap,challenge_sha256,metadata) VALUES ($1,'daily','2099-12-31','draft','block23-real-ranking-lab-v1',$2,90,100,$3,$4) ON CONFLICT (id) DO UPDATE SET status='draft', challenge_sha256=EXCLUDED.challenge_sha256, metadata=EXCLUDED.metadata, updated_at=NOW()`, [challengeId, GAME_ENGINE_VERSION, challengeSha256, { block: '23', testOnly: true, labOnly: true, sourceSnapshots: [...bridgeSnapshots.values()].map((snapshot) => snapshot.sourceSnapshotId), noOfficialPublication: true }]);
    await pool.query('DELETE FROM game_challenge_answers WHERE game_challenge_id = $1', [challengeId]);
    await pool.query('DELETE FROM game_challenge_decisions WHERE game_challenge_id = $1', [challengeId]);
    await pool.query('DELETE FROM game_challenge_categories WHERE game_challenge_id = $1', [challengeId]);
    for (const category of challengeCategories) await pool.query(`INSERT INTO game_challenge_categories (game_challenge_id,category_id,category_ordinal,ranking_snapshot_id) VALUES ($1,$2,$3,$4)`, [challengeId, category.categoryId, category.ordinal, category.rankingSnapshotId]);
    for (const decision of decisions) await pool.query(`INSERT INTO game_challenge_decisions (game_challenge_id,decision_ordinal,entity_id) VALUES ($1,$2,$3)`, [challengeId, decision.ordinal, decision.entityId]);
    for (const answer of answers) await pool.query(`INSERT INTO game_challenge_answers (game_challenge_id,decision_ordinal,category_id,score_value) VALUES ($1,$2,$3,$4)`, [challengeId, answer.decisionOrdinal, answer.categoryId, answer.scoreValue]);
    await pool.query('COMMIT');
    await mkdir(outputRoot, { recursive: true });
    const report = { report: 'BLOCK23_LAB_MATERIALIZATION', generatedAt: new Date().toISOString(), challengeId, challengeDecisionCount: decisions.length, bridgeSnapshots: [...bridgeSnapshots.values()].map(({ rows: _rows, ...snapshot }) => snapshot), sourceCandidateSnapshots: { championsHistorical: championsHistorical.id, championsActive: championsActive.id, worldCupHistorical: worldCupBundle.historical.id, worldCupActive: worldCupBundle.active.id }, playableRankedPlayers: playerIds.length, allLabOnly: true, officialPublication: 'blocked', productionDatabaseAccess: 'none', productionMutations: 0, renderTouched: false, imagesTouched: false, rightsChanged: false };
    await writeFile(resolve(outputRoot, 'BLOCK23_LAB_MATERIALIZATION.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

await main();
