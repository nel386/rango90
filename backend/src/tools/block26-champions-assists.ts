import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import {
  CHAMPIONS_ASSISTS_CATEGORY_SLUG,
  CHAMPIONS_ASSISTS_HISTORICAL_END,
  CHAMPIONS_ASSISTS_HISTORICAL_START,
  CHAMPIONS_ASSISTS_SCOPE_VERSION,
  buildChampionsAssistsSnapshot,
  compareChampionsAssistsRankings,
  importChampionsAssistsIdempotently,
  rollbackChampionsAssistsSnapshot,
  stableAssistJson,
  type ChampionsAssistFact,
  type ChampionsAssistRankingEntry,
  type ChampionsAssistSnapshot
} from '../championsAssistsRankingEngine.js';
import { editionForSeason, type ChampionsEdition, type ChampionsPhase, type PlayerIdentity } from '../championsRankingEngine.js';

type InputFile = { facts?: ChampionsAssistFact[]; activeCoverageComplete?: boolean; sourceKey?: string; sourceCaptureId?: string };
type JsonRecord = Record<string, unknown>;
const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const runtimeMode = process.env.RANGO90_RUNTIME_MODE?.trim() ?? '';
const outputRoot = resolve(process.env.BLOCK26_OUTPUT_ROOT?.trim() || 'audits/block26');
const artifactPrefix = process.env.BLOCK29_RUN === '1' ? 'BLOCK29' : process.env.BLOCK28_RUN === '1' ? 'BLOCK28' : process.env.BLOCK27_RUN === '1' ? 'BLOCK27' : 'BLOCK26';
const blockLabel = process.env.BLOCK29_RUN === '1' ? 'BLOQUE 29' : process.env.BLOCK28_RUN === '1' ? 'BLOQUE 28' : process.env.BLOCK27_RUN === '1' ? 'BLOQUE 27' : 'BLOQUE 26';
function artifact(name: string): string { return `${artifactPrefix}_${name}`; }
const historicalFactsFile = process.env.BLOCK26_HISTORICAL_FACTS_FILE?.trim() ?? '';
const activeFactsFile = process.env.BLOCK26_ACTIVE_FACTS_FILE?.trim() ?? '';
const seedFactsFile = process.env.BLOCK29_SEED_FACTS_FILE?.trim() ?? '';
const previousSnapshotFile = process.env.BLOCK29_PREVIOUS_SNAPSHOT_FILE?.trim() ?? '';
const previousReportFile = process.env.BLOCK29_PREVIOUS_REPORT_FILE?.trim() ?? '';
const apiReportFile = process.env.BLOCK29_API_REPORT_FILE?.trim() || process.env.BLOCK28_API_REPORT_FILE?.trim() || process.env.BLOCK27_API_REPORT_FILE?.trim() || process.env.BLOCK26_API_REPORT_FILE?.trim() || '';
const activeSeasonStart = Number(process.env.BLOCK26_ACTIVE_SEASON_START ?? 2026);
const activeCoverageComplete = process.env.BLOCK26_ACTIVE_COVERAGE_COMPLETE === 'true';
const now = new Date().toISOString();

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function json(value: unknown): string { return stableAssistJson(value); }
function writeJson(path: string, value: unknown): Promise<void> { return mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, json(value), 'utf8')); }
async function readInput(path: string): Promise<{ facts: ChampionsAssistFact[]; activeCoverageComplete?: boolean }> {
  if (!path) return { facts: [] };
  let parsed: InputFile | ChampionsAssistFact[];
  try { parsed = JSON.parse(await readFile(path, 'utf8')) as InputFile | ChampionsAssistFact[]; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { facts: [] }; throw error; }
  return Array.isArray(parsed) ? { facts: parsed } : { facts: parsed.facts ?? [], activeCoverageComplete: parsed.activeCoverageComplete };
}
async function readOptionalJson(path: string): Promise<JsonRecord> {
  if (!path) return {};
  try { return JSON.parse(await readFile(path, 'utf8')) as JsonRecord; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
}
function assertIsolatedDatabase(): void {
  if (!databaseUrl) throw new Error('BLOQUE 26 requiere DATABASE_URL aislada');
  const explicitTargetLoad = process.env.RANGO90_ALLOW_TARGET_DATABASE_LOAD === 'true' && process.env.RANGO90_TARGET_DATABASE_CONFIRMATION === 'RANGO90_BETA_LAB_2026';
  if (!['lab', 'test'].includes(runtimeMode) && !explicitTargetLoad) throw new Error('BLOQUE 26 solo admite RANGO90_RUNTIME_MODE=lab/test o confirmación explícita del destino beta');
  const parsed = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) && !explicitTargetLoad) throw new Error('BLOQUE 26 solo admite PostgreSQL localhost/efímero o confirmación explícita del destino beta');
}
function rowFact(row: Record<string, unknown>): ChampionsAssistFact {
  const edition: ChampionsEdition = editionForSeason(Number(row.season_start), activeSeasonStart);
  const player: PlayerIdentity = {
    canonicalId: String(row.canonical_player_id), displayName: String(row.canonical_name), normalizedName: String(row.canonical_name).toLocaleLowerCase('en-US'),
    sourceKey: String(row.source_key), sourcePlayerId: String(row.source_player_id), resolution: String(row.canonical_player_id).startsWith('champions:api-football:', 0) ? 'source_id' : 'explicit'
  };
  return {
    id: String(row.id), edition, player,
    match: { id: String(row.match_id), date: row.match_date ? (row.match_date instanceof Date ? row.match_date.toISOString().slice(0, 10) : String(row.match_date).slice(0, 10)) : null, homeTeam: String(row.home_team), awayTeam: String(row.away_team) }, eventId: String(row.event_id || row.source_record_id),
    phase: String(row.phase) as ChampionsPhase, assists: Number(row.assists), sourceKey: String(row.source_key), sourceCaptureId: String(row.source_capture_id), sourceRecordId: String(row.source_record_id), sourceType: (String(row.source_type || 'primary') as ChampionsAssistFact['sourceType']), verificationStatus: (String(row.verification_status || 'confirmed') as ChampionsAssistFact['verificationStatus']),
    evidence: (row.evidence ?? {}) as ChampionsAssistFact['evidence'], capturedAt: new Date(String(row.captured_at)).toISOString()
  };
}
async function existingFacts(pool: pg.Pool): Promise<ChampionsAssistFact[]> {
  const result = await pool.query(`SELECT f.*, e.canonical_name, ce.season_start
    FROM champions_assist_facts f JOIN entities e ON e.id=f.canonical_player_id JOIN champions_editions ce ON ce.id=f.edition_id`);
  return result.rows.map((row) => rowFact(row));
}
async function insertFacts(pool: pg.Pool, facts: ChampionsAssistFact[]): Promise<{ added: number; skipped: number }> {
  let added = 0; let skipped = 0;
  const sources = new Map<string, ChampionsAssistFact>(); const captures = new Map<string, ChampionsAssistFact>(); const editions = new Map<string, ChampionsAssistFact>(); const entities = new Map<string, ChampionsAssistFact>();
  for (const fact of facts) { sources.set(fact.sourceKey, fact); captures.set(fact.sourceCaptureId, fact); editions.set(fact.edition.id, fact); entities.set(fact.player.canonicalId, fact); }
  for (const fact of sources.values()) await pool.query(`INSERT INTO sources (key,name,source_type,base_url,usage_notes,rights_status) VALUES ($1,$2,'reference',$3,'BLOQUE 26 laboratorio; sin publicación oficial.','review_required') ON CONFLICT (key) DO NOTHING`, [fact.sourceKey, `Champions assists ${fact.sourceKey}`, fact.evidence.sourceUrl]);
  for (const fact of captures.values()) await pool.query(`INSERT INTO champions_source_captures (id,source_key,captured_at,source_url,content_sha256,data_version,metadata) VALUES ($1,$2,$3,$4,$5,'block26-assists-v1',$6) ON CONFLICT (id) DO NOTHING`, [fact.sourceCaptureId, fact.sourceKey, fact.capturedAt, fact.evidence.sourceUrl, fact.evidence.contentSha256 ?? sha256(fact.sourceCaptureId), { rawPayloadStored: false, metric: 'assists' }]);
  for (const fact of editions.values()) await pool.query(`INSERT INTO champions_editions (id,season_start,season_end,season_label,era,competition_name,include_qualifying,is_current_season,scope_version) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,$8) ON CONFLICT (id) DO NOTHING`, [fact.edition.id, fact.edition.seasonStart, fact.edition.seasonEnd, fact.edition.seasonLabel, fact.edition.era, fact.edition.competitionName, fact.edition.isCurrentSeason, CHAMPIONS_ASSISTS_SCOPE_VERSION]);
  for (const fact of entities.values()) {
    await pool.query(`INSERT INTO entities (id,entity_type,canonical_name,catalog_status) VALUES ($1,'player',$2,'excluded_from_game') ON CONFLICT (id) DO NOTHING`, [fact.player.canonicalId, fact.player.displayName]);
    await pool.query(`INSERT INTO entity_game_profiles (entity_id,playable_default,reason,metadata) VALUES ($1,FALSE,'BLOQUE 26 ranking fact', $2) ON CONFLICT (entity_id) DO NOTHING`, [fact.player.canonicalId, { source: 'block26', metric: 'assists' }]);
  }
  for (const fact of facts) {
    const matchDate = fact.match.date && /^\d{4}-\d{2}-\d{2}$/u.test(fact.match.date) ? fact.match.date : null;
    const result = await pool.query(`INSERT INTO champions_assist_facts (id,edition_id,canonical_player_id,source_player_id,player_name_at_source,match_id,event_id,match_date,home_team,away_team,phase,assists,source_key,source_capture_id,source_record_id,source_type,verification_status,evidence,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT DO NOTHING`, [fact.id, fact.edition.id, fact.player.canonicalId, fact.player.sourcePlayerId, fact.player.displayName, fact.match.id, fact.eventId, matchDate, fact.match.homeTeam, fact.match.awayTeam, fact.phase, fact.assists, fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId, fact.sourceType, fact.verificationStatus, fact.evidence, fact.capturedAt]);
    if ((result.rowCount ?? 0) > 0) added += 1; else skipped += 1;
  }
  return { added, skipped };
}
async function persistSnapshot(pool: pg.Pool, snapshot: ChampionsAssistSnapshot, action: 'created' | 'rollback_requested' = 'created', metadataExtra: JsonRecord = {}): Promise<{ inserted: boolean; entries: number }> {
  const result = await pool.query(`INSERT INTO champions_ranking_snapshots (id,category_slug,scope_version,dataset,season_start,season_end,status,parent_snapshot_id,rollback_of,content_sha256,generated_at,coverage_complete,unresolved_conflicts,unresolved_identity_facts,excluded_unknown_phase_facts,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT DO NOTHING`, [snapshot.id, snapshot.categorySlug, snapshot.scopeVersion, snapshot.dataset, snapshot.seasonStart, snapshot.seasonEnd, snapshot.status, snapshot.parentSnapshotId, snapshot.rollbackOf, snapshot.contentSha256, snapshot.generatedAt, snapshot.coverageComplete, snapshot.conflicts.length, snapshot.unresolvedIdentityFacts.length, snapshot.excludedUnknownPhaseFacts.length, { lab: true, metric: 'assists', factCount: snapshot.factIds.length, sourceCount: snapshot.metadata.sourceCount, candidateStatus: snapshot.metadata.candidateStatus, published: false, ...metadataExtra }]);
  let entries = 0;
  for (const entry of snapshot.ranking) {
    const inserted = await pool.query(`INSERT INTO champions_ranking_entries (snapshot_id,canonical_player_id,raw_value,rank,tie_group,fact_ids,eras) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [snapshot.id, entry.canonicalPlayerId, entry.rawValue, entry.rank, entry.tieGroup, entry.factIds, entry.eras]);
    entries += inserted.rowCount ?? 0;
  }
  await pool.query(`INSERT INTO champions_snapshot_audit (id,snapshot_id,action,parent_snapshot_id,reason,actor) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [`${artifactPrefix.toLocaleLowerCase()}-${action}-${snapshot.id}`, snapshot.id, action, snapshot.parentSnapshotId, `${blockLabel} isolated assists ${action}`, artifactPrefix.toLocaleLowerCase()]);
  return { inserted: (result.rowCount ?? 0) > 0, entries };
}
function historicalCoverage(facts: ChampionsAssistFact[]) {
  const covered = [...new Set(facts.map((fact) => fact.edition.seasonStart))].sort((a, b) => a - b);
  const expected = Array.from({ length: CHAMPIONS_ASSISTS_HISTORICAL_END - CHAMPIONS_ASSISTS_HISTORICAL_START + 1 }, (_, i) => CHAMPIONS_ASSISTS_HISTORICAL_START + i);
  return [{ sourceKey: 'block26-combined', coveredSeasons: covered, missingSeasons: expected.filter((season) => !covered.includes(season)), complete: expected.every((season) => covered.includes(season)), reason: 'La cobertura histórica solo se considera completa si existe al menos un hecho trazable por temporada; faltan verificaciones partido a partido donde no hay hechos.' }];
}
async function main(): Promise<void> {
  assertIsolatedDatabase();
  const historical = await readInput(historicalFactsFile); const active = await readInput(activeFactsFile); const seed = await readInput(seedFactsFile); const apiReport = await readOptionalJson(apiReportFile); const localPreviousReport = await readOptionalJson(resolve(outputRoot, artifact('REPORT.json'))); const externalPreviousReport = await readOptionalJson(previousReportFile); const previousReport = Object.keys(externalPreviousReport).length ? externalPreviousReport : localPreviousReport; const previousSnapshotRecord = await readOptionalJson(previousSnapshotFile);
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5_000 });
  try {
    await pool.query('BEGIN');
    const incoming = [...seed.facts, ...historical.facts, ...active.facts];
    const before = await existingFacts(pool);
    const imported = importChampionsAssistsIdempotently(before, incoming);
    const persistence = await insertFacts(pool, imported.added);
    const facts = await existingFacts(pool);
    const historicalFacts = facts.filter((fact) => fact.edition.seasonStart <= CHAMPIONS_ASSISTS_HISTORICAL_END);
    const activeFacts = facts.filter((fact) => fact.edition.seasonStart === activeSeasonStart);
    const apiSeasonMatrix = (Array.isArray(apiReport.seasonMatrix) ? apiReport.seasonMatrix : Array.isArray(apiReport.seasons) ? apiReport.seasons : []).map((row) => row as JsonRecord);
    const historicalSnapshot = buildChampionsAssistsSnapshot({ facts: historicalFacts, dataset: 'historical_base', seasonStart: CHAMPIONS_ASSISTS_HISTORICAL_START, seasonEnd: CHAMPIONS_ASSISTS_HISTORICAL_END, coverage: historicalCoverage(historicalFacts), generatedAt: now });
    const providerReady = apiReport.status === 'ready_for_lab_load';
    const activeCoverageWasConfirmed = active.activeCoverageComplete ?? (providerReady && activeCoverageComplete);
    const activeCoverage = [{ sourceKey: activeFacts[0]?.sourceKey ?? 'api-football', coveredSeasons: activeFacts.length ? [activeSeasonStart] : [], missingSeasons: activeFacts.length ? [] : [activeSeasonStart], complete: activeCoverageWasConfirmed && activeFacts.length > 0, reason: activeCoverageWasConfirmed ? 'API confirmó la temporada activa; los hechos sin crédito se conservan como ausencia de asistencia, no se infieren.' : 'La API no confirmó cobertura completa de la temporada activa.' }];
    const priorActiveResult = await pool.query<{ id: string; content_sha256: string }>(`SELECT id, content_sha256 FROM champions_ranking_snapshots WHERE category_slug=$1 AND dataset='active_season_weekly' AND status IN ('lab_provisional','draft') ORDER BY generated_at DESC LIMIT 1`, [CHAMPIONS_ASSISTS_CATEGORY_SLUG]);
    const priorActive = priorActiveResult.rows[0];
    const currentCoverageEstimated = typeof apiReport.coverageEstimated === 'number' ? apiReport.coverageEstimated : null;
    const previousMetadata = (previousSnapshotRecord.metadata ?? {}) as JsonRecord;
    const previousCoverageEstimated = typeof previousReport.activeCoverageEstimated === 'number' ? previousReport.activeCoverageEstimated : (typeof previousMetadata.coverageEstimated === 'number' ? previousMetadata.coverageEstimated : null);
    const degraded = artifactPrefix === 'BLOCK29' && typeof previousSnapshotRecord.id === 'string' && (!providerReady || (currentCoverageEstimated !== null && previousCoverageEstimated !== null && currentCoverageEstimated < previousCoverageEstimated));
    let activeSnapshot = buildChampionsAssistsSnapshot({ facts: activeFacts, dataset: 'active_season_weekly', seasonStart: activeSeasonStart, seasonEnd: activeSeasonStart, coverage: activeCoverage, generatedAt: now });
    if (degraded) activeSnapshot = { ...(previousSnapshotRecord as unknown as ChampionsAssistSnapshot), generatedAt: now, status: 'lab_provisional', metadata: { ...((previousSnapshotRecord.metadata ?? {}) as ChampionsAssistSnapshot['metadata']), published: false } };
    if (priorActive && priorActive.id !== activeSnapshot.id) activeSnapshot = buildChampionsAssistsSnapshot({ facts: activeFacts, dataset: 'active_season_weekly', seasonStart: activeSeasonStart, seasonEnd: activeSeasonStart, coverage: activeCoverage, parentSnapshotId: priorActive.id, generatedAt: now });
    const previousEntries = Array.isArray(previousSnapshotRecord.ranking) ? previousSnapshotRecord.ranking as unknown as ChampionsAssistRankingEntry[] : (priorActive ? (await pool.query(`SELECT re.canonical_player_id AS "canonicalPlayerId", e.canonical_name AS "playerName", re.raw_value AS "rawValue", re.rank, re.tie_group AS "tieGroup", re.fact_ids AS "factIds", re.eras FROM champions_ranking_entries re JOIN entities e ON e.id=re.canonical_player_id WHERE re.snapshot_id=$1`, [priorActive.id])).rows as ChampionsAssistRankingEntry[] : []);
    const historicalPersisted = await persistSnapshot(pool, historicalSnapshot);
    const activePersisted = await persistSnapshot(pool, activeSnapshot, 'created', { coverageEstimated: degraded ? previousCoverageEstimated : currentCoverageEstimated, providerStatus: apiReport.status ?? 'unknown', degraded, provisionalWarning: 'Ranking provisional de la temporada activa; el histórico completo todavía no tiene cobertura suficiente.', updatedAt: now });
    const seasonRankings: JsonRecord[] = [];
    for (const row of apiSeasonMatrix.filter((item) => item.status === 'complete')) {
      const season = Number(row.season);
      const seasonFacts = historicalFacts.filter((fact) => fact.edition.seasonStart === season);
      if (!Number.isInteger(season) || seasonFacts.length === 0) continue;
      const seasonSnapshot = buildChampionsAssistsSnapshot({ facts: seasonFacts, dataset: 'historical_base', seasonStart: season, seasonEnd: season, coverage: [{ sourceKey: String(row.source ?? 'api-football'), coveredSeasons: [season], missingSeasons: [], complete: true, reason: String(row.reason ?? 'Cobertura completa de eventos con asistente explícito.') }], generatedAt: now });
      const seasonPersisted = await persistSnapshot(pool, seasonSnapshot);
      seasonRankings.push({ season, status: seasonSnapshot.metadata.candidateStatus, snapshot: { id: seasonSnapshot.id, contentSha256: seasonSnapshot.contentSha256, entries: seasonSnapshot.ranking.length, persisted: seasonPersisted } });
    }
    const rerun = importChampionsAssistsIdempotently(facts, incoming);
    const rollback = rollbackChampionsAssistsSnapshot({ target: activeSnapshot, parentSnapshotId: historicalSnapshot.id, reason: 'block26-rollback-fixture', generatedAt: now });
    const rollbackPersisted = await persistSnapshot(pool, rollback.snapshot, 'rollback_requested');
    const changes = compareChampionsAssistsRankings(previousEntries, activeSnapshot.ranking);
    const historicalSeasons = new Set(historicalFacts.map((fact) => fact.edition.seasonStart));
    const coverageMatrix = [...Array.from({ length: CHAMPIONS_ASSISTS_HISTORICAL_END - CHAMPIONS_ASSISTS_HISTORICAL_START + 1 }, (_, index) => CHAMPIONS_ASSISTS_HISTORICAL_START + index), activeSeasonStart].map((season) => {
      const sourceRow = apiSeasonMatrix.find((row) => Number(row.season) === season);
      const rawStatus = String(sourceRow?.status ?? '');
      const status = season === activeSeasonStart ? (activeSnapshot.coverageComplete ? 'covered' : rawStatus.includes('partial') ? 'partial' : 'unavailable') : (rawStatus.includes('confirmed') ? 'partial' : historicalSeasons.has(season) ? 'partial' : 'unavailable');
      const reason = season === activeSeasonStart ? (activeSnapshot.coverageComplete ? 'API confirmó eventos de la temporada activa; las asistencias sin crédito explícito permanecen desconocidas.' : 'La cobertura activa es parcial o no fue confirmada por el proveedor.') : (sourceRow ? `API-Football: ${rawStatus || 'estado no especificado'}; no se descargaron eventos históricos en este workflow.` : historicalSeasons.has(season) ? 'Hechos existentes sin matriz de cobertura detallada.' : 'No hay hechos trazables para esta temporada.');
      return { season, dataset: season === activeSeasonStart ? 'active_season_weekly' : 'historical_base', status, reason, facts: facts.filter((fact) => fact.edition.seasonStart === season).length };
    });
    const primaryFacts = facts.filter((fact) => fact.sourceType === 'primary').length;
    const contrastFacts = facts.filter((fact) => fact.sourceType === 'contrast').length;
    const baselineFacts = artifactPrefix === 'BLOCK29' ? seed.facts.length : Number(previousReport.previousFacts ?? before.length);
    const loadedNewFacts = artifactPrefix === 'BLOCK29' ? importChampionsAssistsIdempotently(seed.facts, active.facts).added.length : Number(previousReport.newFacts ?? persistence.added);
    const changedPlayers = { new: changes.filter((change) => change.previousValue === null).length, removed: changes.filter((change) => change.nextValue === null).length, valueOrPosition: changes.filter((change) => change.previousValue !== null && change.nextValue !== null).length };
    const report: JsonRecord = { artifactKind: `${artifactPrefix.toLocaleLowerCase()}_champions_assists`, reportVersion: '1', generatedAt: now, commit: process.env.GITHUB_SHA ?? 'local', workflowRun: process.env.GITHUB_RUN_ID ?? null, status: providerReady && activeFacts.length > 0 ? 'passed_with_gates' : 'not_sufficient', readyForApproval: false, category: CHAMPIONS_ASSISTS_CATEGORY_SLUG, metric: 'assists', facts: { before: baselineFacts, incoming: incoming.length, added: loadedNewFacts, skipped: Math.max(0, facts.length - baselineFacts - loadedNewFacts), after: facts.length, totalAssists: facts.reduce((sum, fact) => sum + fact.assists, 0), primary: primaryFacts, contrast: contrastFacts, conflicts: imported.conflicts.length, unresolvedIdentities: activeSnapshot.unresolvedIdentityFacts.length + historicalSnapshot.unresolvedIdentityFacts.length, unverified: activeSnapshot.excludedUnverifiedFacts.length + historicalSnapshot.excludedUnverifiedFacts.length }, previousFacts: baselineFacts, newFacts: loadedNewFacts, combinedFacts: facts.length, playersNormalized: new Set(facts.map((fact) => fact.player.canonicalId)).size, sources: [...new Set(facts.map((fact) => fact.sourceKey))].sort(), conflicts: imported.conflicts, apiFootball: apiReport, activeSeason: activeSeasonStart, providerReady, degraded, previousCoverageEstimated, activeCoverageEstimated: degraded ? previousCoverageEstimated : currentCoverageEstimated, eventsWithoutPlayer: apiReport.uncreditedGoalEvents ?? apiSeasonMatrix.reduce((total, row) => total + Number(row.eventsWithoutAssist ?? 0), 0), coverage: { historical: historicalSnapshot.coverage, historicalCandidateStatus: historicalSnapshot.metadata.candidateStatus, active: activeSnapshot.coverage, activeCandidateStatus: activeSnapshot.metadata.candidateStatus }, coverageMatrix, seasonRankings, snapshots: { historical: { id: historicalSnapshot.id, contentSha256: historicalSnapshot.contentSha256, persisted: historicalPersisted }, active: { id: activeSnapshot.id, contentSha256: activeSnapshot.contentSha256, parentSnapshotId: activeSnapshot.parentSnapshotId, persisted: activePersisted } }, weeklyChanges: changes, changeSummary: changedPlayers, idempotency: { addedOnRerun: rerun.added.length, skippedOnRerun: rerun.skipped.length, conflictsOnRerun: rerun.conflicts.length, sameSnapshotHash: Boolean((priorActive && priorActive.id === activeSnapshot.id) || (typeof previousSnapshotRecord.id === 'string' && previousSnapshotRecord.id === activeSnapshot.id)), duplicateNewFacts: rerun.added.length }, rollback: { id: rollback.snapshot.id, rollbackOf: rollback.snapshot.rollbackOf, persisted: rollbackPersisted, status: 'passed_fixture' }, official: { status: 'blocked', snapshotCreated: false }, production: { databaseAccess: 'none', renderTouched: false, imagesTouched: false, rightsChanged: false }, rawPayloadsStored: false };
    report.loadHash = sha256(json({ factIds: facts.map((fact) => fact.id).sort(), historicalSnapshot: historicalSnapshot.contentSha256, activeSnapshot: activeSnapshot.contentSha256 }));
    (report.idempotency as JsonRecord).previousLoadHash = previousReport.loadHash ?? null;
    (report.idempotency as JsonRecord).sameLoadHash = previousReport.loadHash === report.loadHash && previousReport.loadHash !== undefined;
    report.sha256 = sha256(json({ ...report, sha256: '' }));
    await writeJson(resolve(outputRoot, artifact('REPORT.json')), report);
    await writeJson(resolve(outputRoot, artifact('HISTORICAL_SNAPSHOT_CANDIDATE.json')), historicalSnapshot);
    await writeJson(resolve(outputRoot, artifact('ACTIVE_SNAPSHOT_CANDIDATE.json')), activeSnapshot);
    await writeJson(resolve(outputRoot, artifact('ACTIVE_CHANGES.json')), changes);
    await writeJson(resolve(outputRoot, artifact('ROLLBACK.json')), rollback);
    await writeJson(resolve(outputRoot, artifact('FACTS_AFTER.json')), { facts });
    await writeJson(resolve(outputRoot, artifact('COVERAGE_MATRIX.json')), coverageMatrix);
    await writeFile(resolve(outputRoot, artifact('REPORT.md')), `# ${blockLabel} — asistencias de Champions\n\n- estado: **${report.status}**\n- histórico: **${historicalSnapshot.metadata.candidateStatus}**\n- temporada activa: **${activeSnapshot.metadata.candidateStatus}**\n- hechos combinados: **${facts.length}**\n- temporadas completas: **${coverageMatrix.filter((row) => row.status === 'complete').length}**\n- temporadas parciales: **${coverageMatrix.filter((row) => row.status === 'partial').length}**\n- temporadas sin datos: **${coverageMatrix.filter((row) => row.status === 'unavailable').length}**\n- idempotencia, rollback y publicación oficial: **ver ${artifact('REPORT.json')}; official bloqueado**\n\nNo se guardan payloads de API. Las asistencias no disponibles permanecen desconocidas; no se inventan.\n\nHuella: ${report.sha256}\n`, 'utf8');
    await pool.query('COMMIT');
    console.log(JSON.stringify({ status: report.status, historicalCandidateStatus: historicalSnapshot.metadata.candidateStatus, activeCandidateStatus: activeSnapshot.metadata.candidateStatus, facts: facts.length, added: persistence.added, skipped: persistence.skipped, official: 'blocked' }, null, 2));
  } catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }
}
await main();
