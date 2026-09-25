import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { stableYellowJson } from '../clubYellowCardsCareerRankingEngine.js';

type JsonObject = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown; paging?: JsonObject };
type TeamHistory = { teamId: number | null; teamName: string; seasons: number[] };
type PlayerHistory = { status: 'complete_with_data' | 'complete_empty' | 'legacy_unverified' | 'provider_error'; seasons: number[]; teams: TeamHistory[]; responseSha256: string | null };
type RequestEvidence = { endpoint: string; status: number; outcome?: 'data' | 'valid_empty' | 'provider_error' | 'malformed_response'; responseSha256: string; dailyRemaining: number | null; dailyLimit: number | null; minuteRemaining: number | null; minuteLimit: number | null };
type CareerProgress = { artifactKind: 'block45_player_career_seasons'; version: '1' | '2'; sourceBaseRunId: string; sourceManifestHash: string; parentRunId: string | null; commitSha: string; workflowName: string; eligiblePlayerIds: string[]; players: Record<string, PlayerHistory>; requests: RequestEvidence[]; manifestHash: string };
type HistoricalStatsAuditIndex = {
  artifactKind: 'block45_historical_stats_audit_index';
  version: '1';
  seasonStatsAttempts: number;
  uniqueValidPlayerSeasonPairs: number;
  pairs: Array<{ playerId: string; season: number; attempts: number; http200Attempts: number; errorsFieldChecked?: boolean }>;
  sourceReports: Array<{ runId: string; reportSha256: string; requestAttempts: number; seasonStatsAttempts: number; validSeasonStatsAttempts: number; http200SeasonStatsAttempts: number }>;
  unreconciledProviderRuns?: Array<{ runId: string; workflow: string; conclusion: string; requestAttempts: number | null; reason: string }>;
  indexHash: string;
};

const sourceDir = resolve(process.env.BLOCK45_CAREER_SOURCE_DIR?.trim() || '.block45-career/source');
const outputRoot = resolve(process.env.BLOCK45_OUTPUT_ROOT?.trim() || '.block45-career/output');
const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const maxRequests = Math.min(200, Math.max(1, Number(process.env.BLOCK45_MAX_REQUESTS ?? 200)));
const baseManifestCandidates = [resolve(sourceDir, 'provider/BLOCK45_BASE_MANIFEST.json'), resolve(sourceDir, 'BLOCK45_BASE_MANIFEST.json')];
const previousProgressCandidates = [resolve(sourceDir, 'BLOCK45_CAREER_SEASONS.json'), resolve(sourceDir, 'career/BLOCK45_CAREER_SEASONS.json')];
const historicalStatsAuditCandidates = [resolve(process.cwd(), 'audits/block45/BLOCK45_HISTORICAL_STATS_AUDIT_INDEX.json'), resolve(process.cwd(), 'backend/audits/block45/BLOCK45_HISTORICAL_STATS_AUDIT_INDEX.json')];
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const hashJson = (value: unknown) => sha256(stableYellowJson(value));
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const intHeader = (headers: Headers, name: string): number | null => { const value = Number(headers.get(name)); return Number.isInteger(value) && value >= 0 ? value : null; };
const hasProviderErrors = (errors: unknown): boolean => {
  if (errors === undefined || errors === null || errors === false || errors === '') return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors as JsonObject).length > 0;
  return true;
};
const isVerifiedHistory = (history: PlayerHistory | undefined): boolean => history?.status === 'complete_with_data' || history?.status === 'complete_empty';

async function main(): Promise<void> {
  if (!apiKey) throw new Error('API_FOOTBALL_KEY ausente; no se realizaron peticiones.');
  const baseManifestCandidate = baseManifestCandidates.find(existsSync);
  if (!baseManifestCandidate) throw new Error('No se encontró BLOCK45_BASE_MANIFEST.json en el artefacto fuente.');
  const baseManifestPath: string = baseManifestCandidate;
  const sourceManifest = JSON.parse(await readFile(baseManifestPath, 'utf8')) as JsonObject;
  const { manifestHash: sourceManifestHash } = sourceManifest;
  const { manifestHash: _ignored, ...unsignedSource } = sourceManifest;
  if (!sourceManifestHash || hashJson(unsignedSource) !== sourceManifestHash) throw new Error('El hash del manifiesto base no coincide.');
  if (sourceManifest.artifactKind !== 'block45_base_manifest' || sourceManifest.baseCoverageComplete !== true) throw new Error('La auditoría de carrera requiere un manifiesto base íntegro y completo.');

  const historicalStatsAuditPath = historicalStatsAuditCandidates.find(existsSync);
  if (!historicalStatsAuditPath) throw new Error('Falta el índice de consultas históricas ya realizadas.');
  const historicalStatsAudit = JSON.parse(await readFile(historicalStatsAuditPath, 'utf8')) as HistoricalStatsAuditIndex;
  const { indexHash: historicalStatsIndexHash, ...unsignedHistoricalStatsAudit } = historicalStatsAudit;
  if (historicalStatsAudit.artifactKind !== 'block45_historical_stats_audit_index' || historicalStatsAudit.version !== '1' || !historicalStatsIndexHash || hashJson(unsignedHistoricalStatsAudit) !== historicalStatsIndexHash) throw new Error('El índice de auditoría histórica no es íntegro.');

  const coverage = array(sourceManifest.coverage).map(object);
  const completeLeagueSeasons = new Set(coverage.filter((row) => ['complete', 'no_data'].includes(String(row.status)) && Number(row.pagesExpected) === Number(row.pagesRead)).map((row) => `${row.leagueId}|${row.season}`));
  const records = array(sourceManifest.basePlayerSeasonRecords).map(object);
  const seasonsByPlayerLeague = new Map<string, Set<number>>();
  const baseSeasonsByPlayer = new Map<string, Set<number>>();
  for (const record of records) {
    const playerId = String(record.playerId ?? ''); const leagueId = Number(record.leagueId); const season = Number(record.season);
    if (!completeLeagueSeasons.has(`${leagueId}|${season}`)) continue;
    const baseSeasons = baseSeasonsByPlayer.get(playerId) ?? new Set<number>(); baseSeasons.add(season); baseSeasonsByPlayer.set(playerId, baseSeasons);
    const key = `${playerId}|${leagueId}`; const years = seasonsByPlayerLeague.get(key) ?? new Set<number>(); years.add(season); seasonsByPlayerLeague.set(key, years);
  }
  const eligiblePlayerIds = [...new Set([...seasonsByPlayerLeague.entries()].filter(([, years]) => years.size >= 2).map(([key]) => key.split('|')[0] ?? '').filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  const exactBasePlayerSeasonPairs = eligiblePlayerIds.reduce((sum, id) => sum + (baseSeasonsByPlayer.get(id)?.size ?? 0), 0);
  const eligibleIdSet = new Set(eligiblePlayerIds);
  const previouslyQueriedAdditionalStatsPairs = new Set(historicalStatsAudit.pairs.filter((pair) => eligibleIdSet.has(pair.playerId) && !(baseSeasonsByPlayer.get(pair.playerId)?.has(pair.season) ?? false)).map((pair) => `${pair.playerId}|${pair.season}`));
  const previouslyValidatedAdditionalStatsPairs = new Set(historicalStatsAudit.pairs.filter((pair) => pair.errorsFieldChecked === true && eligibleIdSet.has(pair.playerId) && !(baseSeasonsByPlayer.get(pair.playerId)?.has(pair.season) ?? false)).map((pair) => `${pair.playerId}|${pair.season}`));
  const baseRequestAttemptsAlreadySpent = array(sourceManifest.requests).reduce<number>((sum, value) => sum + Math.max(1, Number(object(value).attempts) || 1), 0);
  const historicalAuditRequestAttempts = historicalStatsAudit.sourceReports.reduce((sum, report) => sum + report.requestAttempts, 0);
  const historicalAuditNonStatsAttempts = Math.max(0, historicalAuditRequestAttempts - historicalStatsAudit.seasonStatsAttempts);

  const previousProgressPath = previousProgressCandidates.find(existsSync);
  let previous: CareerProgress | null = null;
  if (previousProgressPath) {
    previous = JSON.parse(await readFile(previousProgressPath, 'utf8')) as CareerProgress;
    const { manifestHash: previousHash, ...unsignedPrevious } = previous;
    if (previous.artifactKind !== 'block45_player_career_seasons' || !['1', '2'].includes(previous.version) || hashJson(unsignedPrevious) !== previousHash) throw new Error('El hash del progreso de temporadas no coincide.');
    if (previous.sourceBaseRunId !== String(sourceManifest.baseRunId) || previous.sourceManifestHash !== sourceManifestHash) throw new Error('El progreso pertenece a otro manifiesto base.');
    if (hashJson(previous.eligiblePlayerIds) !== hashJson(eligiblePlayerIds)) throw new Error('La lista de elegibles cambió respecto al progreso guardado.');
  }
  const players: Record<string, PlayerHistory> = { ...(previous?.players ?? {}) };
  for (const [playerId, history] of Object.entries(players)) {
    if (String((history as PlayerHistory).status) === 'complete') players[playerId] = { ...history, status: 'legacy_unverified' };
  }
  const requests = [...(previous?.requests ?? [])];
  const knownTerminal = new Set(Object.entries(players).filter(([, value]) => isVerifiedHistory(value)).map(([id]) => id));
  const pending = eligiblePlayerIds.filter((id) => !knownTerminal.has(id)).sort((left, right) => sha256(left).localeCompare(sha256(right)));
  const batch: RequestEvidence[] = [];
  let stoppedForRateLimit = false;
  let stoppedForBudget = false;
  let perMinuteLimit: number | null = null;
  let lastStartedAt = 0;
  const deadlineAt = Date.now() + 38 * 60_000;
  const inFlight = new Set<AbortController>();
  let nextPlayerIndex = 0;
  let scheduledRequests = 0;
  let scheduleLock = Promise.resolve();
  let checkpointLock: Promise<void> = Promise.resolve();
  let checkpointCount = 0;
  const sourceRun = process.env.BLOCK45_SOURCE_RUN_ID?.trim() || '';
  const runId = process.env.GITHUB_RUN_ID?.trim() || `local-${Date.now()}`;
  const commitSha = process.env.GITHUB_SHA?.trim() || '';
  const workflowName = process.env.GITHUB_WORKFLOW?.trim() || 'BLOQUE 45 · descubrimiento de temporadas de carrera';
  async function checkpoint(): Promise<void> {
    checkpointCount += 1;
    if (checkpointCount % 10 !== 0 && checkpointCount !== 1) return;
    checkpointLock = checkpointLock.then(async () => {
      const unsignedProgress = {
        artifactKind: 'block45_player_career_seasons' as const,
        version: '2' as const,
        sourceBaseRunId: String(sourceManifest.baseRunId),
        sourceManifestHash: String(sourceManifestHash),
        parentRunId: sourceRun || null,
        commitSha,
        workflowName,
        eligiblePlayerIds,
        players: { ...players },
        requests: [...requests]
      };
      const progress: CareerProgress = { ...unsignedProgress, manifestHash: hashJson(unsignedProgress) };
      await mkdir(outputRoot, { recursive: true });
      await copyFile(baseManifestPath, resolve(outputRoot, 'BLOCK45_BASE_MANIFEST.json'));
      await writeFile(resolve(outputRoot, 'BLOCK45_CAREER_SEASONS.json'), stableYellowJson(progress), 'utf8');
      await writeFile(resolve(outputRoot, 'BLOCK45_CAREER_DISCOVERY_REPORT.json'), stableYellowJson({
        artifactKind: 'block45_player_career_discovery_report',
        classificationVersion: 'errors_empty_and_validated_data_v2',
        status: 'career_history_discovery_partial',
        sourceBaseRunId: String(sourceManifest.baseRunId),
        sourceManifestHash: String(sourceManifestHash),
        eligiblePlayerCount: eligiblePlayerIds.length,
        completePlayerHistoryCount: Object.values(players).filter((value) => value.status === 'complete_with_data').length,
        validEmptyPlayerHistoryCount: Object.values(players).filter((value) => value.status === 'complete_empty').length,
        legacyUnverifiedPlayerHistoryCount: Object.values(players).filter((value) => value.status === 'legacy_unverified').length,
        providerErrorPlayerHistoryCount: Object.values(players).filter((value) => value.status === 'provider_error').length,
        pendingPlayerHistoryCount: eligiblePlayerIds.length - Object.values(players).filter(isVerifiedHistory).length,
        batchRequests: batch.length,
        batchSuccessfulResponses: batch.filter((entry) => entry.status === 200).length,
        checkpoint: true,
        checkpointRunId: runId,
        rawPayloadsStored: false,
        secretPrinted: false,
        loadExecuted: false,
        snapshotsCreated: 0
      }), 'utf8');
    });
    await checkpointLock;
  }
  async function scheduleRequest(): Promise<boolean> {
    let release!: () => void;
    const previous = scheduleLock;
    scheduleLock = new Promise<void>((resolveLock) => { release = resolveLock; });
    await previous;
    try {
      if (stoppedForRateLimit || scheduledRequests >= maxRequests) return false;
      const intervalMs = Math.max(250, Math.ceil(60_000 / (Math.max(1, perMinuteLimit ?? 10) * 0.8)));
      if (Date.now() + intervalMs >= deadlineAt) return false;
      const waitMs = intervalMs - (Date.now() - lastStartedAt);
      if (waitMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, waitMs));
      if (stoppedForRateLimit || scheduledRequests >= maxRequests) return false;
      lastStartedAt = Date.now();
      scheduledRequests += 1;
      return true;
    } finally { release(); }
  }
  async function discoverOne(playerId: string): Promise<void> {
    if (!await scheduleRequest()) return;
    const endpoint = `/players/teams?player=${encodeURIComponent(playerId)}`;
    let status = 0; let responseSha256 = sha256('network_error'); let body: Envelope = {};
    let dailyRemaining: number | null = null; let dailyLimit: number | null = null; let minuteRemaining: number | null = null; let minuteLimit: number | null = null;
    const controller = new AbortController(); inFlight.add(controller);
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey }, signal: controller.signal });
      status = response.status;
      const raw = await response.text();
      responseSha256 = sha256(raw);
      try { body = object(JSON.parse(raw)) as Envelope; } catch { body = {}; }
      dailyRemaining = intHeader(response.headers, 'x-ratelimit-requests-remaining');
      dailyLimit = intHeader(response.headers, 'x-ratelimit-requests-limit');
      minuteRemaining = intHeader(response.headers, 'X-RateLimit-Remaining');
      minuteLimit = intHeader(response.headers, 'X-RateLimit-Limit');
      if (minuteLimit !== null && minuteLimit > 0) perMinuteLimit = minuteLimit;
    } catch { /* Keep redacted status-0 evidence; a later tranche retries this player. */ }
    finally { inFlight.delete(controller); }
    const recordOutcome = (outcome: RequestEvidence['outcome']) => {
      const evidence: RequestEvidence = { endpoint, status, outcome, responseSha256, dailyRemaining, dailyLimit, minuteRemaining, minuteLimit };
      batch.push(evidence); requests.push(evidence);
    };
    if (status === 429) {
      stoppedForRateLimit = true;
      recordOutcome('provider_error');
      players[playerId] = { status: 'provider_error', seasons: [], teams: [], responseSha256 };
      await checkpoint();
      for (const pendingController of inFlight) pendingController.abort();
      return;
    }
    if (status !== 200 || hasProviderErrors(body.errors)) {
      recordOutcome('provider_error');
      players[playerId] = { status: 'provider_error', seasons: [], teams: [], responseSha256 };
      await checkpoint();
      return;
    }
    if (!Array.isArray(body.response)) {
      recordOutcome('malformed_response');
      players[playerId] = { status: 'provider_error', seasons: [], teams: [], responseSha256 };
      await checkpoint();
      return;
    }
    if (body.response.length === 0) {
      recordOutcome('valid_empty');
      players[playerId] = { status: 'complete_empty', seasons: [], teams: [], responseSha256 };
      await checkpoint();
      return;
    }
    const teams: TeamHistory[] = [];
    let malformed = false;
    for (const entryValue of body.response) {
      const entry = object(entryValue); const team = object(entry.team);
      const teamId = Number(team.id); const teamName = String(team.name ?? '').trim();
      const rawSeasons = entry.seasons;
      const seasons = [...new Set(array(rawSeasons).map(Number).filter((year) => Number.isInteger(year) && year > 0))].sort((a, b) => a - b);
      if (!Number.isInteger(teamId) || teamId < 1 || !teamName || !Array.isArray(rawSeasons) || seasons.length === 0) malformed = true;
      teams.push({ teamId: Number.isInteger(teamId) && teamId > 0 ? teamId : null, teamName, seasons });
    }
    const allSeasons = [...new Set(teams.flatMap((team) => team.seasons))].sort((a, b) => a - b);
    if (malformed || allSeasons.length === 0) {
      recordOutcome('malformed_response');
      players[playerId] = { status: 'provider_error', seasons: [], teams: [], responseSha256 };
      await checkpoint();
      return;
    }
    recordOutcome('data');
    players[playerId] = { status: 'complete_with_data', seasons: allSeasons, teams, responseSha256 };
    await checkpoint();
  }
  async function worker(): Promise<void> {
    while (!stoppedForRateLimit && nextPlayerIndex < pending.length && scheduledRequests < maxRequests) {
      const playerId = pending[nextPlayerIndex++];
      if (playerId) await discoverOne(playerId);
    }
  }
  // Una sola petición en vuelo permite parar la cola exactamente en el primer 429.
  await worker();
  if (!stoppedForRateLimit && pending.length > batch.length) stoppedForBudget = true;

  const completePlayerIds = eligiblePlayerIds.filter((id) => players[id]?.status === 'complete_with_data');
  const validEmptyPlayerIds = eligiblePlayerIds.filter((id) => players[id]?.status === 'complete_empty');
  const legacyUnverifiedPlayerIds = eligiblePlayerIds.filter((id) => players[id]?.status === 'legacy_unverified');
  const providerErrorPlayerIds = eligiblePlayerIds.filter((id) => players[id]?.status === 'provider_error');
  const pendingPlayerIds = eligiblePlayerIds.filter((id) => !isVerifiedHistory(players[id]));
  const knownCareerSeasonPairs = completePlayerIds.reduce((sum, id) => sum + new Set(players[id]?.seasons ?? []).size, 0);
  const observedAdditionalCareerSeasonPairs = completePlayerIds.reduce((sum, id) => {
    const career = new Set(players[id]?.seasons ?? []); const base = baseSeasonsByPlayer.get(id) ?? new Set<number>();
    return sum + [...career].filter((season) => !base.has(season)).length;
  }, 0);
  const observedMeanAdditionalSeasonsPerPlayer = completePlayerIds.length > 0 ? observedAdditionalCareerSeasonPairs / completePlayerIds.length : null;
  const projectedAdditionalCareerStatsRequests = observedMeanAdditionalSeasonsPerPlayer === null ? null : Math.ceil(observedMeanAdditionalSeasonsPerPlayer * eligiblePlayerIds.length);
  const alreadyAuditedAdditionalStatsPairCount = previouslyValidatedAdditionalStatsPairs.size;
  const projectedPendingCareerStatsRequests = projectedAdditionalCareerStatsRequests === null ? null : Math.max(0, projectedAdditionalCareerStatsRequests - alreadyAuditedAdditionalStatsPairCount);
  const projectedStatsRequestsFromObservedSample = projectedAdditionalCareerStatsRequests === null ? null : exactBasePlayerSeasonPairs + projectedAdditionalCareerStatsRequests;
  const expectedStatsPairsWhenComplete = pendingPlayerIds.length === 0 ? exactBasePlayerSeasonPairs + observedAdditionalCareerSeasonPairs : null;
  const dailyValues = batch.map((entry) => entry.dailyRemaining).filter((value): value is number => value !== null);
  const minuteValues = batch.map((entry) => entry.minuteRemaining).filter((value): value is number => value !== null);
  const unsignedProgress = {
    artifactKind: 'block45_player_career_seasons' as const,
    version: '2' as const,
    sourceBaseRunId: String(sourceManifest.baseRunId),
    sourceManifestHash: String(sourceManifestHash),
    parentRunId: sourceRun || null,
    commitSha,
    workflowName,
    eligiblePlayerIds,
    players,
    requests
  };
  const progress: CareerProgress = { ...unsignedProgress, manifestHash: hashJson(unsignedProgress) };
  const report = {
    artifactKind: 'block45_player_career_discovery_report',
    classificationVersion: 'errors_empty_and_validated_data_v2',
    status: pendingPlayerIds.length === 0 ? 'career_history_discovery_complete' : stoppedForRateLimit ? 'career_history_rate_limited' : 'career_history_discovery_partial',
    sourceBaseRunId: String(sourceManifest.baseRunId),
    sourceManifestHash: String(sourceManifestHash),
    basePlayerIds: array(sourceManifest.basePlayerNames).length,
    eligiblePlayerCount: eligiblePlayerIds.length,
    completePlayerHistoryCount: completePlayerIds.length,
    validEmptyPlayerHistoryCount: validEmptyPlayerIds.length,
    legacyUnverifiedPlayerHistoryCount: legacyUnverifiedPlayerIds.length,
    providerErrorPlayerHistoryCount: providerErrorPlayerIds.length,
    pendingPlayerHistoryCount: pendingPlayerIds.length,
    batchRequests: batch.length,
    batchSuccessfulResponses: batch.filter((entry) => entry.status === 200).length,
    batchValidatedWithData: batch.filter((entry) => entry.outcome === 'data').length,
    batchValidEmptyResponses: batch.filter((entry) => entry.outcome === 'valid_empty').length,
    batchProviderErrorResponses: batch.filter((entry) => entry.outcome === 'provider_error').length,
    batchMalformedResponses: batch.filter((entry) => entry.outcome === 'malformed_response').length,
    batchRetries: 0,
    stoppedForBudget,
    stoppedForRateLimit,
    careerSeasonPairsDiscovered: knownCareerSeasonPairs,
    sampledPlayerHistoryCount: completePlayerIds.length,
    samplingOrder: 'Deterministic hash of player ID; legacy unclassified checkpoints are excluded until revalidated.',
    exactBasePlayerSeasonPairs,
    observedAdditionalCareerSeasonPairs,
    observedMeanAdditionalSeasonsPerPlayer,
    projectedAdditionalCareerStatsRequests,
    alreadyAuditedAdditionalStatsPairCount,
    previouslyQueriedAdditionalStatsPairCount: previouslyQueriedAdditionalStatsPairs.size,
    projectedPendingCareerStatsRequests,
    projectedCareerStatsPlayerSeasonPairsFromBaseAndSample: projectedStatsRequestsFromObservedSample,
    projectionMethodNote: 'Pares exactos de la base completa más proyección lineal del exceso de temporadas únicas fuera de base entre historiales revalidados; la muestra determinista por hash reduce sesgo de orden por ID, pero sigue siendo una estimación y no valida estadísticas por competición.',
    careerStatsPlayerSeasonPairsIfDiscoveryCompletes: expectedStatsPairsWhenComplete,
    costAccounting: {
      alreadySpentAttempts: {
        completedBaseAcquisition: baseRequestAttemptsAlreadySpent,
        careerHistoryDiscovery: requests.length,
        controlAudits: historicalAuditRequestAttempts,
        ofWhichHistoricalStats: historicalStatsAudit.seasonStatsAttempts,
        ofWhichPlayerSearches: historicalAuditNonStatsAttempts,
        knownSubtotal: baseRequestAttemptsAlreadySpent + requests.length + historicalAuditRequestAttempts
      },
      basePlayerSeasonPairsAlreadyCovered: exactBasePlayerSeasonPairs,
      eligibleHistoricalStatsPairsAlreadyQueried: previouslyQueriedAdditionalStatsPairs.size,
      eligibleHistoricalStatsPairsWithErrorsRevalidated: previouslyValidatedAdditionalStatsPairs.size,
      potentialStatsCallsSavedAfterRevalidation: previouslyQueriedAdditionalStatsPairs.size - previouslyValidatedAdditionalStatsPairs.size,
      pendingEstimate: {
        careerHistoryRequests: pendingPlayerIds.length,
        additionalStatsRequests: projectedPendingCareerStatsRequests,
        totalRequests: projectedPendingCareerStatsRequests === null ? null : pendingPlayerIds.length + projectedPendingCareerStatsRequests
      },
      historicalAuditAttempts: historicalStatsAudit.seasonStatsAttempts,
      historicalAuditUniquePlayerSeasonPairs: historicalStatsAudit.uniqueValidPlayerSeasonPairs,
      historicalAuditSources: historicalStatsAudit.sourceReports.map(({ runId, reportSha256, requestAttempts, seasonStatsAttempts, validSeasonStatsAttempts }) => ({ runId, reportSha256, requestAttempts, seasonStatsAttempts, validSeasonStatsAttempts })),
      unreconciledProviderRuns: historicalStatsAudit.unreconciledProviderRuns ?? [],
      note: 'El coste pendiente resta pares históricos ya consultados cuando son candidato elegible y temporada fuera de la base. Los intentos duplicados cuentan como gasto, no como pares reutilizables. El subtotal ya gastado no incluye runs sin artefacto ni actividad ajena a estos manifiestos.'
    },
    historicalAttempts: requests.length - batch.length,
    cumulativeAttempts: requests.length,
    quotaDaily: {
      initial: dailyValues[0] ?? null,
      final: dailyValues.at(-1) ?? null,
      headerDecrease: dailyValues.length > 1 ? dailyValues[0]! - dailyValues.at(-1)! : null,
      attemptsMinusHeaderDecrease: dailyValues.length > 1 ? batch.length - (dailyValues[0]! - dailyValues.at(-1)!) : null,
      headerValuesObserved: dailyValues.length,
      reconciliationNote: dailyValues.length > 1 && batch.length !== dailyValues[0]! - dailyValues.at(-1)!
        ? 'La cabecera diaria y los intentos de este run no coinciden; la API no permite atribuir la diferencia a este lote. El contador por minuto es una ventana independiente.'
        : 'Comparación limitada a los valores de cabecera observados en este lote.'
    },
    quotaPerMinute: { initial: minuteValues[0] ?? null, final: minuteValues.at(-1) ?? null, limit: batch.find((entry) => entry.minuteLimit !== null)?.minuteLimit ?? null, headerValuesObserved: minuteValues.length, note: 'Ventana móvil, no representa consumo acumulado.' },
    requests: batch,
    rawPayloadsStored: false,
    secretPrinted: false,
    loadExecuted: false,
    snapshotsCreated: 0
  };
  await mkdir(outputRoot, { recursive: true });
  await copyFile(baseManifestPath, resolve(outputRoot, 'BLOCK45_BASE_MANIFEST.json'));
  await writeFile(resolve(outputRoot, 'BLOCK45_CAREER_SEASONS.json'), stableYellowJson(progress), 'utf8');
  await writeFile(resolve(outputRoot, 'BLOCK45_CAREER_DISCOVERY_REPORT.json'), stableYellowJson(report), 'utf8');
}

await main();
