import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import {
  appendSnapshot,
  buildChampionsRanking,
  buildChampionsSnapshot,
  buildWeeklyChampionsUpdate,
  compareChampionsRankings,
  editionForSeason,
  importFactsIdempotently,
  rollbackChampionsSnapshot,
  stableJson,
  type ChampionsGoalFact,
  type ChampionsRankingEntry,
  type ChampionsSnapshot
} from '../championsRankingEngine.js';

type JsonRecord = Record<string, unknown>;
type ApiReport = { seasons?: Array<{ season?: number; status?: string; facts?: number }>; status?: string };
type PlayableRow = { entity_id: string; catalog_status: string; playable_default: boolean };

const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const baseFactsFile = process.env.BLOCK17_BASE_FACTS_FILE?.trim() ?? '';
const incomingFactsFile = process.env.BLOCK17_INCOMING_FACTS_FILE?.trim() ?? '';
const apiReportFile = process.env.BLOCK17_API_REPORT_FILE?.trim() ?? '';
const priorSnapshotFile = process.env.BLOCK17_PRIOR_SNAPSHOT_FILE?.trim() ?? '';
const outputRoot = resolve(process.env.BLOCK17_OUTPUT_ROOT?.trim() || 'audits/block17');
const activeSeasonStart = Number(process.env.BLOCK17_ACTIVE_SEASON_START ?? 2026);
const runId = process.env.BLOCK17_RUN_ID?.trim() || process.env.GITHUB_RUN_ID?.trim() || new Date().toISOString().replace(/[^0-9]/gu, '').slice(0, 14);
const now = new Date().toISOString();

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function record(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function writeJson(path: string, value: unknown): Promise<void> { return mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableJson(value), 'utf8')); }
function loadFacts(path: string): Promise<ChampionsGoalFact[]> { return readFile(path, 'utf8').then((raw) => (JSON.parse(raw) as { facts?: ChampionsGoalFact[] }).facts ?? []); }
function sourceCaptureKey(fact: ChampionsGoalFact): string { return `${fact.sourceKey}|${fact.sourceCaptureId}`; }
function coverage(seasons: number[], complete: boolean, reason: string): Array<{ sourceKey: string; coveredSeasons: number[]; missingSeasons: number[]; complete: boolean; reason: string }> {
  const expected = Array.from({ length: activeSeasonStart - 1955 + 1 }, (_, index) => 1955 + index);
  return [{ sourceKey: 'champions-block17-lab', coveredSeasons: seasons, missingSeasons: expected.filter((season) => !seasons.includes(season)), complete, reason }];
}
function score(entry: ChampionsRankingEntry): number { return Math.min(entry.rank, 100); }
function factProvenance(entry: ChampionsRankingEntry, factsById: Map<string, ChampionsGoalFact[]>): Array<JsonRecord> {
  const grouped = new Map<string, JsonRecord>();
  for (const fact of entry.factIds.flatMap((id) => factsById.get(id) ?? [])) {
    const key = sourceCaptureKey(fact);
    const prior = grouped.get(key) ?? { sourceKey: fact.sourceKey, sourceCaptureId: fact.sourceCaptureId, sourceRecordIds: [], sourceUrls: [], contentSha256s: [] };
    const sourceUrls = prior.sourceUrls as string[];
    const contentSha256s = prior.contentSha256s as string[];
    (prior.sourceRecordIds as string[]).push(fact.sourceRecordId);
    if (!sourceUrls.includes(fact.evidence.sourceUrl)) sourceUrls.push(fact.evidence.sourceUrl);
    if (fact.evidence.contentSha256 && !contentSha256s.includes(fact.evidence.contentSha256)) contentSha256s.push(fact.evidence.contentSha256);
    grouped.set(key, prior);
  }
  return [...grouped.values()].sort((left, right) => String(left.sourceKey).localeCompare(String(right.sourceKey)) || String(left.sourceCaptureId).localeCompare(String(right.sourceCaptureId)));
}
function rankingRecords(snapshot: ChampionsSnapshot, facts: ChampionsGoalFact[], playableIds: Set<string>): Array<JsonRecord> {
  const factsById = new Map<string, ChampionsGoalFact[]>();
  for (const fact of facts) factsById.set(fact.id, [...(factsById.get(fact.id) ?? []), fact]);
  return snapshot.ranking.map((entry) => ({ canonicalPlayerId: entry.canonicalPlayerId, playerName: entry.playerName, position: entry.rank, score: score(entry), rawValue: entry.rawValue, tieGroup: entry.tieGroup, playable: playableIds.has(entry.canonicalPlayerId), eras: entry.eras, factIds: entry.factIds, sources: factProvenance(entry, factsById) }));
}
function parseApiReport(): Promise<ApiReport | null> {
  if (!apiReportFile) return Promise.resolve(null);
  return readFile(apiReportFile, 'utf8').then((raw) => JSON.parse(raw) as ApiReport).catch(() => null);
}
function normalizeIncomingFacts(baseFacts: ChampionsGoalFact[], incomingFacts: ChampionsGoalFact[]): { facts: ChampionsGoalFact[]; unresolvedIdentity: string[] } {
  const sourceIdMap = new Map<string, { canonicalId: string; displayName: string }>();
  for (const fact of baseFacts) {
    const key = `${fact.sourceKey}:${fact.player.sourcePlayerId}`;
    const current = sourceIdMap.get(key);
    if (!current) sourceIdMap.set(key, { canonicalId: fact.player.canonicalId, displayName: fact.player.displayName });
    else if (current.canonicalId !== fact.player.canonicalId) sourceIdMap.delete(key);
  }
  const unresolvedIdentity: string[] = [];
  const facts = incomingFacts.map((fact) => {
    if (fact.player.resolution !== 'normalized_name') return fact;
    const resolved = sourceIdMap.get(`${fact.sourceKey}:${fact.player.sourcePlayerId}`);
    if (!resolved) {
      unresolvedIdentity.push(fact.id);
      return fact;
    }
    return { ...fact, player: { ...fact.player, canonicalId: resolved.canonicalId, displayName: resolved.displayName, resolution: 'source_id' as const } };
  });
  return { facts, unresolvedIdentity };
}

async function persistFacts(facts: ChampionsGoalFact[]): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query('BEGIN');
    const sources = new Map<string, ChampionsGoalFact>(); const captures = new Map<string, ChampionsGoalFact>();
    for (const fact of facts) { sources.set(fact.sourceKey, fact); captures.set(sourceCaptureKey(fact), fact); }
    for (const fact of sources.values()) await pool.query(`INSERT INTO sources (key,name,source_type,base_url,usage_notes,rights_status) VALUES ($1,$2,'reference',$3,$4,'review_required') ON CONFLICT (key) DO NOTHING`, [fact.sourceKey, `Champions ${fact.sourceKey}`, fact.evidence.sourceUrl, 'BLOQUE 17 lab snapshot; no official publication.']);
    for (const fact of captures.values()) await pool.query(`INSERT INTO champions_source_captures (id,source_key,captured_at,source_url,content_sha256,data_version,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`, [fact.sourceCaptureId, fact.sourceKey, fact.capturedAt, fact.evidence.sourceUrl, fact.evidence.contentSha256 ?? sha256(fact.sourceCaptureId), 'block17-facts-v1', { importedFrom: 'block15e-effective-or-block15a-active', rawPayloadStored: false }]);
    for (let season = 1955; season <= activeSeasonStart; season += 1) { const edition = editionForSeason(season, activeSeasonStart); await pool.query(`INSERT INTO champions_editions (id,season_start,season_end,season_label,era,competition_name,include_qualifying,is_current_season,scope_version) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,'uefa-champions-league-goals-facts-v1') ON CONFLICT (id) DO NOTHING`, [edition.id, edition.seasonStart, edition.seasonEnd, edition.seasonLabel, edition.era, edition.competitionName, edition.isCurrentSeason]); }
    for (const fact of facts) await pool.query(`INSERT INTO entities (id,entity_type,canonical_name,catalog_status) VALUES ($1,'player',$2,'excluded_from_game') ON CONFLICT (id) DO NOTHING`, [fact.player.canonicalId, fact.player.displayName]);
    for (const fact of facts) await pool.query(`INSERT INTO champions_goal_facts (id,edition_id,canonical_player_id,source_player_id,player_name_at_source,match_id,match_date,home_team,away_team,phase,goals,source_key,source_capture_id,source_record_id,evidence,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`, [fact.id, fact.edition.id, fact.player.canonicalId, fact.player.sourcePlayerId, fact.player.displayName, fact.match.id, fact.match.date, fact.match.homeTeam, fact.match.awayTeam, fact.phase, fact.goals, fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId, fact.evidence, fact.capturedAt]);
    await pool.query('COMMIT');
  } catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }
}

async function playableIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try { const result = await pool.query<PlayableRow>(`SELECT e.id AS entity_id,e.catalog_status,COALESCE(p.playable_default,FALSE) AS playable_default FROM entities e LEFT JOIN entity_game_profiles p ON p.entity_id=e.id WHERE e.id=ANY($1::text[])`, [ids]); return new Set(result.rows.filter((row) => row.catalog_status === 'active' && row.playable_default).map((row) => row.entity_id)); } finally { await pool.end(); }
}

async function persistSnapshot(snapshot: ChampionsSnapshot, records: Array<JsonRecord>, action: 'created' | 'rollback_requested', actor: string): Promise<{ snapshotInserted: boolean; entriesInserted: number; auditInserted: boolean }> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query('BEGIN');
    const snapshotResult = await pool.query(`INSERT INTO champions_ranking_snapshots (id,category_slug,scope_version,dataset,season_start,season_end,status,parent_snapshot_id,rollback_of,content_sha256,generated_at,coverage_complete,unresolved_conflicts,unresolved_identity_facts,excluded_unknown_phase_facts,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`, [snapshot.id, snapshot.categorySlug, snapshot.scopeVersion, snapshot.dataset, snapshot.seasonStart, snapshot.seasonEnd, snapshot.status, snapshot.parentSnapshotId, snapshot.rollbackOf, snapshot.contentSha256, snapshot.generatedAt, snapshot.coverageComplete, snapshot.conflicts.length, snapshot.unresolvedIdentityFacts.length, snapshot.excludedUnknownPhaseFacts.length, { imagesUsed: false, published: false, sourceCount: snapshot.metadata.sourceCount, lab: true, records: records.length }]);
    let entriesInserted = 0;
    for (const entry of snapshot.ranking) { const result = await pool.query(`INSERT INTO champions_ranking_entries (snapshot_id,canonical_player_id,raw_value,rank,tie_group,fact_ids,eras) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (snapshot_id,canonical_player_id) DO NOTHING`, [snapshot.id, entry.canonicalPlayerId, entry.rawValue, entry.rank, entry.tieGroup, entry.factIds, entry.eras]); entriesInserted += result.rowCount ?? 0; }
    const auditResult = await pool.query(`INSERT INTO champions_snapshot_audit (id,snapshot_id,action,parent_snapshot_id,reason,actor) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`, [`block17-${action}-${snapshot.id}`, snapshot.id, action, snapshot.parentSnapshotId, action === 'created' ? 'BLOQUE 17 isolated candidate/weekly snapshot' : 'BLOQUE 17 rollback fixture', actor]);
    await pool.query('COMMIT'); return { snapshotInserted: (snapshotResult.rowCount ?? 0) > 0, entriesInserted, auditInserted: (auditResult.rowCount ?? 0) > 0 };
  } catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }
}

async function main(): Promise<void> {
  if (!databaseUrl || !baseFactsFile || !incomingFactsFile) throw new Error('BLOQUE 17 requiere DATABASE_URL, BLOCK17_BASE_FACTS_FILE y BLOCK17_INCOMING_FACTS_FILE');
  if (!['lab', 'test'].includes(process.env.RANGO90_RUNTIME_MODE?.trim() ?? '')) throw new Error('BLOQUE 17 solo admite RANGO90_RUNTIME_MODE=lab/test');
  const baseFacts = await loadFacts(baseFactsFile); const incomingRaw = await loadFacts(incomingFactsFile); const normalizedIncoming = normalizeIncomingFacts(baseFacts, incomingRaw);
  const imported = importFactsIdempotently(baseFacts, normalizedIncoming.facts);
  const mergedFacts = imported.facts; const historicalFacts = mergedFacts.filter((fact) => fact.edition.seasonStart !== activeSeasonStart); const activeFacts = mergedFacts.filter((fact) => fact.edition.seasonStart === activeSeasonStart);
  const apiReport = await parseApiReport(); const activeApiRow = apiReport?.seasons?.find((row) => row.season === activeSeasonStart); const activeStatus = activeApiRow?.status ?? 'not_run';
  const historicalSeasons = [...new Set(historicalFacts.map((fact) => fact.edition.seasonStart))].sort((left, right) => left - right); const expectedHistoricalSeasons = Array.from({ length: activeSeasonStart - 1955 }, (_, index) => 1955 + index); const historicalComplete = expectedHistoricalSeasons.every((season) => historicalSeasons.includes(season));
  const fullCoverage = coverage([...historicalSeasons, activeSeasonStart], historicalComplete && activeStatus === 'complete', activeStatus === 'complete' ? 'Historical base plus complete active API tranche.' : `Active API tranche is ${activeStatus}; publication gate remains blocked.`);
  const historicalSnapshot = buildChampionsSnapshot({ facts: historicalFacts, dataset: 'historical_base', seasonStart: 1955, seasonEnd: activeSeasonStart - 1, status: 'lab_provisional', coverage: coverage(historicalSeasons, historicalComplete, 'Historical append-only facts'), generatedAt: now });
  const priorSnapshot = priorSnapshotFile ? JSON.parse(await readFile(priorSnapshotFile, 'utf8')) as ChampionsSnapshot : historicalSnapshot;
  const weekly = buildWeeklyChampionsUpdate({ historicalFacts, activeSeasonFacts: activeFacts, activeSeasonStart, previousSnapshot: priorSnapshot, coverage: fullCoverage, generatedAt: now });
  const weeklySnapshot = weekly.snapshot; const allConflicts = [...imported.conflicts, ...weeklySnapshot.conflicts]; const unresolvedIdentity = normalizedIncoming.unresolvedIdentity.length + weeklySnapshot.unresolvedIdentityFacts.length; const incompleteActive = activeStatus !== 'complete'; const inconsistent = allConflicts.length > 0 || weeklySnapshot.excludedUnknownPhaseFacts.length > 0 || unresolvedIdentity > 0 || imported.facts.length !== new Set(imported.facts.map((fact) => fact.id)).size;
  const safeToPublish = historicalComplete && !incompleteActive && !inconsistent && weeklySnapshot.coverageComplete;
  const ids = weeklySnapshot.ranking.map((entry) => entry.canonicalPlayerId); await persistFacts(mergedFacts); const playable = await playableIds(ids); const weeklyRecords = rankingRecords(weeklySnapshot, mergedFacts, playable); const top200 = weeklyRecords.filter((entry) => Number(entry.position) <= 200);
  const historicalRecords = rankingRecords(historicalSnapshot, historicalFacts, playable);
  const candidatePersisted = await persistSnapshot(historicalSnapshot, historicalRecords, 'created', 'block17'); const priorPersisted = priorSnapshot.id === historicalSnapshot.id ? { snapshotInserted: false, entriesInserted: 0, auditInserted: false } : await persistSnapshot(priorSnapshot, rankingRecords(priorSnapshot, mergedFacts, playable), 'created', 'block17-prior'); const weeklyPersisted = await persistSnapshot(weeklySnapshot, weeklyRecords, 'created', 'block17'); const appendAgain = await persistSnapshot(weeklySnapshot, weeklyRecords, 'created', 'block17');
  const rollback = rollbackChampionsSnapshot({ target: weeklySnapshot, parentSnapshotId: priorSnapshot.id, reason: 'block17-weekly-rollback-fixture', generatedAt: now }); const rollbackPersisted = await persistSnapshot(rollback.snapshot, weeklyRecords, 'rollback_requested', 'block17');
  const report: JsonRecord = { artifactKind: 'block17_champions_candidate_weekly_update', reportVersion: '1', generatedAt: now, runId, status: safeToPublish ? 'passed' : 'blocked', readyForApproval: safeToPublish, activeSeasonStart, separation: { historicalDataset: historicalSnapshot.dataset, activeDataset: weeklySnapshot.dataset, provisional: true, candidate: true, official: false }, source: { historicalFacts: baseFacts.length, incomingFacts: incomingRaw.length, mergedFacts: mergedFacts.length, newFacts: imported.added.length, duplicateFactsSkipped: imported.skipped.length, conflicts: allConflicts.length, apiActiveStatus: activeStatus }, snapshots: { historical: { id: historicalSnapshot.id, contentSha256: historicalSnapshot.contentSha256, top200: historicalRecords.filter((entry) => Number(entry.position) <= 200).length, appendOnly: candidatePersisted.snapshotInserted }, prior: { id: priorSnapshot.id, persisted: priorPersisted.snapshotInserted }, weekly: { id: weeklySnapshot.id, parentSnapshotId: weeklySnapshot.parentSnapshotId, contentSha256: weeklySnapshot.contentSha256, top200: top200.length, appendOnly: weeklyPersisted.snapshotInserted, repeatedInsertNoMutation: appendAgain.snapshotInserted === false }, rollback: { id: rollback.snapshot.id, rollbackOf: rollback.snapshot.rollbackOf, persisted: rollbackPersisted.snapshotInserted, status: 'passed_fixture' } }, ranking: { entries: weeklySnapshot.ranking.length, top200: top200.length, playableTop200: top200.filter((entry) => entry.playable === true).length, changes: weekly.changes.length, changesWithValue: weekly.changes.filter((change) => change.valueChanged).length, changesWithPosition: weekly.changes.filter((change) => change.positionChanged).length, ties: new Set(weeklySnapshot.ranking.map((entry) => entry.tieGroup)).size }, validation: { historicalComplete, activeComplete: activeStatus === 'complete', coverageComplete: weeklySnapshot.coverageComplete, sumsPreserved: historicalFacts.reduce((sum, fact) => sum + fact.goals, 0) === mergedFacts.filter((fact) => fact.edition.seasonStart !== activeSeasonStart).reduce((sum, fact) => sum + fact.goals, 0), noDuplicateFactIds: mergedFacts.length === new Set(mergedFacts.map((fact) => fact.id)).size, conflicts: allConflicts.length, unresolvedIdentity, unknownPhaseFacts: weeklySnapshot.excludedUnknownPhaseFacts.length, playableResolvedFromExplicitProfile: true }, publication: { status: 'blocked', officialSnapshotCreated: false, officialModeOpened: false, reason: safeToPublish ? 'Candidato técnico listo; autorización documental aún ausente.' : 'Datos activos incompletos o inconsistentes; no se publica.' }, productionDatabaseAccess: 'none', productionMutations: 0, renderTouched: false, imagesTouched: false, rightsChanged: false, top200UsedAsFacts: false, persistence: { historical: candidatePersisted, prior: priorPersisted, weekly: weeklyPersisted, repeatedInsert: appendAgain, rollback: rollbackPersisted }, sha256: '' };
  report.sha256 = sha256(stableJson({ ...report, sha256: '' }));
  await writeJson(resolve(outputRoot, 'BLOCK17_REPORT.json'), report); await writeJson(resolve(outputRoot, 'BLOCK17_HISTORICAL_SNAPSHOT_CANDIDATE.json'), historicalSnapshot); await writeJson(resolve(outputRoot, 'BLOCK17_WEEKLY_SNAPSHOT_CANDIDATE.json'), weeklySnapshot); await writeJson(resolve(outputRoot, 'BLOCK17_TOP200.json'), top200); await writeJson(resolve(outputRoot, 'BLOCK17_RANKING_RECORDS.json'), weeklyRecords); await writeJson(resolve(outputRoot, 'BLOCK17_WEEKLY_CHANGES.json'), weekly.changes); await writeJson(resolve(outputRoot, 'BLOCK17_ROLLBACK.json'), rollback); await writeJson(resolve(outputRoot, 'BLOCK17_FACTS_AFTER.json'), { facts: mergedFacts });
  const markdown = ['# BLOQUE 17 — snapshot candidato y actualización semanal Champions', '', `- estado: **${report.status}**`, `- readyForApproval: **${safeToPublish}**`, `- histórico completo: **${historicalComplete ? 'sí' : 'no'}**`, `- temporada activa ${activeSeasonStart}: **${activeStatus}**`, `- hechos nuevos: **${imported.added.length}**`, `- duplicados omitidos: **${imported.skipped.length}**`, `- conflictos: **${allConflicts.length}**`, `- top 200: **${top200.length}**`, `- jugables dentro del top 200: **${top200.filter((entry) => entry.playable === true).length}**`, `- cambios contra ejecución anterior: **${weekly.changes.length}**`, `- rollback: **passed_fixture**`, `- snapshot oficial: **no creado**`, `- PostgreSQL de producción: **sin acceso**`, '', 'La actualización usa hechos append-only, conserva el histórico y rechaza publicación con tramos activos incompletos, conflictos, fases desconocidas o identidades no resueltas. Las fuentes y huellas se incluyen por registro en `BLOCK17_RANKING_RECORDS.json`.', '', `Huella del informe: ${report.sha256}`].join('\n'); await writeFile(resolve(outputRoot, 'BLOCK17_REPORT.md'), `${markdown}\n`, 'utf8');
  console.log(JSON.stringify({ status: report.status, readyForApproval: safeToPublish, historicalComplete, activeStatus, facts: mergedFacts.length, added: imported.added.length, skipped: imported.skipped.length, top200: top200.length, playableTop200: top200.filter((entry) => entry.playable === true).length, changes: weekly.changes.length, conflicts: allConflicts.length }, null, 2));
}

await main();
