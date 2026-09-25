import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { stableYellowJson } from '../clubYellowCardsCareerRankingEngine.js';

type JsonObject = Record<string, unknown>;
type Envelope = { response?: unknown[]; paging?: JsonObject };
type TeamHistory = { teamId: number | null; teamName: string; seasons: number[] };
type PlayerHistory = { status: 'complete' | 'provider_error'; seasons: number[]; teams: TeamHistory[]; responseSha256: string | null };
type RequestEvidence = { endpoint: string; status: number; responseSha256: string; dailyRemaining: number | null; dailyLimit: number | null; minuteRemaining: number | null; minuteLimit: number | null };
type CareerProgress = { artifactKind: 'block45_player_career_seasons'; version: '1'; sourceBaseRunId: string; sourceManifestHash: string; parentRunId: string | null; commitSha: string; workflowName: string; eligiblePlayerIds: string[]; players: Record<string, PlayerHistory>; requests: RequestEvidence[]; manifestHash: string };

const sourceDir = resolve(process.env.BLOCK45_CAREER_SOURCE_DIR?.trim() || '.block45-career/source');
const outputRoot = resolve(process.env.BLOCK45_OUTPUT_ROOT?.trim() || '.block45-career/output');
const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const maxRequests = Math.min(800, Math.max(1, Number(process.env.BLOCK45_MAX_REQUESTS ?? 800)));
const baseManifestCandidates = [resolve(sourceDir, 'provider/BLOCK45_BASE_MANIFEST.json'), resolve(sourceDir, 'BLOCK45_BASE_MANIFEST.json')];
const previousProgressCandidates = [resolve(sourceDir, 'BLOCK45_CAREER_SEASONS.json'), resolve(sourceDir, 'career/BLOCK45_CAREER_SEASONS.json')];
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const hashJson = (value: unknown) => sha256(stableYellowJson(value));
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const intHeader = (headers: Headers, name: string): number | null => { const value = Number(headers.get(name)); return Number.isInteger(value) && value >= 0 ? value : null; };

async function main(): Promise<void> {
  if (!apiKey) throw new Error('API_FOOTBALL_KEY ausente; no se realizaron peticiones.');
  const baseManifestPath = baseManifestCandidates.find(existsSync);
  if (!baseManifestPath) throw new Error('No se encontró BLOCK45_BASE_MANIFEST.json en el artefacto fuente.');
  const sourceManifest = JSON.parse(await readFile(baseManifestPath, 'utf8')) as JsonObject;
  const { manifestHash: sourceManifestHash } = sourceManifest;
  const { manifestHash: _ignored, ...unsignedSource } = sourceManifest;
  if (!sourceManifestHash || hashJson(unsignedSource) !== sourceManifestHash) throw new Error('El hash del manifiesto base no coincide.');
  if (sourceManifest.artifactKind !== 'block45_base_manifest' || sourceManifest.baseCoverageComplete !== true) throw new Error('La auditoría de carrera requiere un manifiesto base íntegro y completo.');

  const coverage = array(sourceManifest.coverage).map(object);
  const completeLeagueSeasons = new Set(coverage.filter((row) => ['complete', 'no_data'].includes(String(row.status)) && Number(row.pagesExpected) === Number(row.pagesRead)).map((row) => `${row.leagueId}|${row.season}`));
  const records = array(sourceManifest.basePlayerSeasonRecords).map(object);
  const seasonsByPlayerLeague = new Map<string, Set<number>>();
  for (const record of records) {
    const playerId = String(record.playerId ?? ''); const leagueId = Number(record.leagueId); const season = Number(record.season);
    if (!completeLeagueSeasons.has(`${leagueId}|${season}`)) continue;
    const key = `${playerId}|${leagueId}`; const years = seasonsByPlayerLeague.get(key) ?? new Set<number>(); years.add(season); seasonsByPlayerLeague.set(key, years);
  }
  const eligiblePlayerIds = [...new Set([...seasonsByPlayerLeague.entries()].filter(([, years]) => years.size >= 2).map(([key]) => key.split('|')[0] ?? '').filter(Boolean))].sort((a, b) => Number(a) - Number(b));

  const previousProgressPath = previousProgressCandidates.find(existsSync);
  let previous: CareerProgress | null = null;
  if (previousProgressPath) {
    previous = JSON.parse(await readFile(previousProgressPath, 'utf8')) as CareerProgress;
    const { manifestHash: previousHash, ...unsignedPrevious } = previous;
    if (previous.artifactKind !== 'block45_player_career_seasons' || previous.version !== '1' || hashJson(unsignedPrevious) !== previousHash) throw new Error('El hash del progreso de temporadas no coincide.');
    if (previous.sourceBaseRunId !== String(sourceManifest.baseRunId) || previous.sourceManifestHash !== sourceManifestHash) throw new Error('El progreso pertenece a otro manifiesto base.');
    if (hashJson(previous.eligiblePlayerIds) !== hashJson(eligiblePlayerIds)) throw new Error('La lista de elegibles cambió respecto al progreso guardado.');
  }
  const players: Record<string, PlayerHistory> = { ...(previous?.players ?? {}) };
  const requests = [...(previous?.requests ?? [])];
  const knownTerminal = new Set(Object.entries(players).filter(([, value]) => value.status === 'complete').map(([id]) => id));
  const pending = eligiblePlayerIds.filter((id) => !knownTerminal.has(id));
  const batch: RequestEvidence[] = [];
  let stoppedForRateLimit = false;
  let stoppedForBudget = false;
  let perMinuteLimit = 10;
  let lastStartedAt = 0;
  const inFlight = new Set<AbortController>();
  let nextPlayerIndex = 0;
  let scheduledRequests = 0;
  let scheduleLock = Promise.resolve();
  async function scheduleRequest(): Promise<boolean> {
    let release!: () => void;
    const previous = scheduleLock;
    scheduleLock = new Promise<void>((resolveLock) => { release = resolveLock; });
    await previous;
    try {
      if (stoppedForRateLimit || scheduledRequests >= maxRequests) return false;
      const intervalMs = Math.max(250, Math.ceil(60_000 / (Math.max(1, perMinuteLimit) * 0.8)));
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
      if (minuteLimit !== null && minuteLimit > 0) perMinuteLimit = Math.min(perMinuteLimit, minuteLimit);
    } catch { /* Keep redacted status-0 evidence; a later tranche retries this player. */ }
    finally { inFlight.delete(controller); }
    const evidence = { endpoint, status, responseSha256, dailyRemaining, dailyLimit, minuteRemaining, minuteLimit };
    batch.push(evidence); requests.push(evidence);
    if (status === 429) {
      stoppedForRateLimit = true;
      players[playerId] = { status: 'provider_error', seasons: [], teams: [], responseSha256 };
      for (const pendingController of inFlight) pendingController.abort();
      return;
    }
    if (status !== 200 || !Array.isArray(body.response)) { players[playerId] = { status: 'provider_error', seasons: [], teams: [], responseSha256 }; return; }
    const teams: TeamHistory[] = [];
    for (const entryValue of body.response) {
      const entry = object(entryValue); const team = object(entry.team);
      const seasons = [...new Set(array(entry.seasons).map(Number).filter((year) => Number.isInteger(year) && year > 0))].sort((a, b) => a - b);
      teams.push({ teamId: Number.isInteger(Number(team.id)) && Number(team.id) > 0 ? Number(team.id) : null, teamName: String(team.name ?? ''), seasons });
    }
    const allSeasons = [...new Set(teams.flatMap((team) => team.seasons))].sort((a, b) => a - b);
    players[playerId] = { status: 'complete', seasons: allSeasons, teams, responseSha256 };
  }
  async function worker(): Promise<void> {
    while (!stoppedForRateLimit && nextPlayerIndex < pending.length && scheduledRequests < maxRequests) {
      const playerId = pending[nextPlayerIndex++];
      if (playerId) await discoverOne(playerId);
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  if (!stoppedForRateLimit && pending.length > batch.length) stoppedForBudget = true;

  const completePlayerIds = eligiblePlayerIds.filter((id) => players[id]?.status === 'complete');
  const pendingPlayerIds = eligiblePlayerIds.filter((id) => players[id]?.status !== 'complete');
  const knownCareerSeasonPairs = completePlayerIds.reduce((sum, id) => sum + new Set(players[id]?.seasons ?? []).size, 0);
  const expectedStatsPairsWhenComplete = eligiblePlayerIds.length === completePlayerIds.length ? knownCareerSeasonPairs : null;
  const dailyValues = batch.map((entry) => entry.dailyRemaining).filter((value): value is number => value !== null);
  const minuteValues = batch.map((entry) => entry.minuteRemaining).filter((value): value is number => value !== null);
  const sourceRun = process.env.BLOCK45_SOURCE_RUN_ID?.trim() || '';
  const runId = process.env.GITHUB_RUN_ID?.trim() || `local-${Date.now()}`;
  const commitSha = process.env.GITHUB_SHA?.trim() || '';
  const workflowName = process.env.GITHUB_WORKFLOW?.trim() || 'BLOQUE 45 · descubrimiento de temporadas de carrera';
  const unsignedProgress = {
    artifactKind: 'block45_player_career_seasons' as const,
    version: '1' as const,
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
    status: pendingPlayerIds.length === 0 ? 'career_history_discovery_complete' : stoppedForRateLimit ? 'career_history_rate_limited' : 'career_history_discovery_partial',
    sourceBaseRunId: String(sourceManifest.baseRunId),
    sourceManifestHash: String(sourceManifestHash),
    basePlayerIds: array(sourceManifest.basePlayerNames).length,
    eligiblePlayerCount: eligiblePlayerIds.length,
    completePlayerHistoryCount: completePlayerIds.length,
    pendingPlayerHistoryCount: pendingPlayerIds.length,
    batchRequests: batch.length,
    batchSuccessfulResponses: batch.filter((entry) => entry.status === 200).length,
    batchRetries: 0,
    stoppedForBudget,
    stoppedForRateLimit,
    careerSeasonPairsDiscovered: knownCareerSeasonPairs,
    estimatedStatsRequests: expectedStatsPairsWhenComplete,
    totalStatsRequestsLowerBound: knownCareerSeasonPairs,
    totalCareerDiscoveryRequests: eligiblePlayerIds.length,
    totalRequestsEstimate: expectedStatsPairsWhenComplete === null ? null : eligiblePlayerIds.length + expectedStatsPairsWhenComplete,
    pendingStatsRequestsEstimate: expectedStatsPairsWhenComplete === null ? null : expectedStatsPairsWhenComplete,
    historicalAttempts: requests.length - batch.length,
    cumulativeAttempts: requests.length,
    quotaDaily: { initial: dailyValues[0] ?? null, final: dailyValues.at(-1) ?? null, headerDecrease: dailyValues.length > 1 ? dailyValues[0]! - dailyValues.at(-1)! : null, attemptsMinusHeaderDecrease: dailyValues.length > 1 ? batch.length - (dailyValues[0]! - dailyValues.at(-1)!) : null, headerValuesObserved: dailyValues.length },
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
