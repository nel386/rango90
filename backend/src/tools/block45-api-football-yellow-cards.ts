import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildYellowCardSnapshots, CONTROL_NAMES, FIVE_MAJOR_LEAGUE_IDS, normalizePlayerName, stableYellowJson, type YellowCardFact } from '../clubYellowCardsCareerRankingEngine.js';
import { classifyClubCompetition, isOfficialClubCompetition } from './block45-provider-scope.js';

type JsonRecord = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown; paging?: JsonRecord };
type League = { id: number; name: string };
type RequestEvidence = { endpoint: string; status: number; responseSha256: string; responseComplete?: boolean; dailyRemaining: number | null; dailyLimit: number | null; minuteRemaining: number | null; minuteLimit: number | null; pagingTotal: number | null; kind: 'coverage' | 'league_page' | 'player_season'; attempts: number; retryCount: number; attemptStatuses: number[] };
type BasePlayerSeasonRecord = { playerId: string; leagueId: number; season: number };
type CoverageRow = { leagueId: number; league: string; season: number; status: 'complete' | 'partial' | 'unavailable' | 'no_data'; pagesExpected: number | null; pagesRead: number; playersReturned: number; facts: number; reason: string };
type PlayerSeasonEvidence = { playerId: string; season: number; status: 'player_did_not_participate' | 'data_available' | 'provider_returned_no_eligible_club_stats' | 'provider_error'; competitions: string[] };
type BaseManifest = { artifactKind: 'block45_base_manifest'; version: '1'; mode: 'plan'; planOnly: true; phase?: 'plan' | 'continue' | 'expand'; baseRunId: string; parentRunId?: string | null; commitSha: string; workflowName: string; leagueIds: number[]; parameters: { fromSeason: number | null; toSeason: number | null; activeSeason: number }; selectedSeasons: number[]; activeSeason: number; discoveredSeasonsByLeague: Record<string, number[]>; coverage: CoverageRow[]; coverageHash: string; basePlayerSeasonRecords: BasePlayerSeasonRecord[]; basePlayerNames: Array<[string, string]>; facts: YellowCardFact[]; factsHash: string; requests: RequestEvidence[]; competitionDecisions: Array<Record<string, unknown>>; playerSeasonCoverage?: Record<string, PlayerSeasonEvidence>; generatedAt: string; baseCoverageComplete: boolean; manifestHash: string };

const leagues: League[] = [
  { id: 39, name: 'Premier League' }, { id: 140, name: 'LaLiga' }, { id: 135, name: 'Serie A' },
  { id: 78, name: 'Bundesliga' }, { id: 61, name: 'Ligue 1' }
];
const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const outputRoot = resolve(process.env.BLOCK45_OUTPUT_ROOT?.trim() || 'audits/block45/provider');
const fromInput = process.env.BLOCK45_FROM_SEASON?.trim() ?? '';
const toInput = process.env.BLOCK45_TO_SEASON?.trim() ?? '';
const activeSeasonInput = process.env.BLOCK45_ACTIVE_SEASON?.trim() ?? '';
const maxRequests = Math.max(1, Number(process.env.BLOCK45_MAX_REQUESTS ?? 500));
const maxRetries = Math.max(0, Math.min(3, Number(process.env.BLOCK45_MAX_RETRIES ?? 2)));
const requestedMode = process.env.BLOCK45_MODE?.trim() ?? 'plan';
const mode: 'plan' | 'continue' | 'expand' | 'load' = ['plan', 'continue', 'expand', 'load'].includes(requestedMode) ? requestedMode as 'plan' | 'continue' | 'expand' | 'load' : 'plan';
const planOnly = mode === 'plan' || mode === 'continue' || process.env.BLOCK45_PLAN_ONLY === '1';
const expansionMode = mode === 'expand' || mode === 'load';
const baseManifestInput = process.env.BLOCK45_BASE_MANIFEST_FILE?.trim() ?? '';
const baseRunId = process.env.GITHUB_RUN_ID?.trim() || `local-${Date.now()}`;
const expectedBaseRunId = process.env.BLOCK45_BASE_RUN_ID?.trim() ?? '';
const commitSha = process.env.GITHUB_SHA?.trim() || process.env.BLOCK45_COMMIT_SHA?.trim() || '';
const expectedSourceCommitSha = process.env.BLOCK45_SOURCE_COMMIT_SHA?.trim() || commitSha;
const workflowName = process.env.GITHUB_WORKFLOW?.trim() || process.env.BLOCK45_WORKFLOW_NAME?.trim() || '';
let requestAttemptsUsed = 0;
let perMinuteLimit: number | null = null;
let lastRequestStartedAt = 0;
let stoppedForRateLimit = false;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const hashJson = (value: unknown) => sha256(stableYellowJson(value));
const object = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
const writeJson = (path: string, value: unknown) => mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableYellowJson(value), 'utf8'));

function headerInteger(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

async function waitForRequestSlot(): Promise<void> {
  const safePerMinuteRate = perMinuteLimit ? perMinuteLimit * 0.8 : 10;
  const minIntervalMs = Math.ceil(60_000 / safePerMinuteRate);
  const delay = minIntervalMs - (Date.now() - lastRequestStartedAt);
  if (lastRequestStartedAt > 0 && delay > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
  lastRequestStartedAt = Date.now();
}

async function request(endpoint: string, kind: RequestEvidence['kind']): Promise<{ body: Envelope; evidence: RequestEvidence }> {
  let lastError = false;
  const attemptStatuses: number[] = [];
  let finalEvidence: RequestEvidence | null = null;
  for (let attempt = 0; attempt <= maxRetries && requestAttemptsUsed < maxRequests; attempt += 1) {
    if (stoppedForRateLimit) break;
    await waitForRequestSlot();
    requestAttemptsUsed += 1;
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      const raw = await response.text();
      let body: Envelope = {};
      try { body = object(JSON.parse(raw)) as Envelope; } catch { body = { errors: { invalid_json: true } }; }
      const pagingTotal = Number(body.paging?.total);
      attemptStatuses.push(response.status);
      const dailyLimit = headerInteger(response.headers, 'x-ratelimit-requests-limit');
      const observedPerMinuteLimit = headerInteger(response.headers, 'X-RateLimit-Limit');
      if (observedPerMinuteLimit !== null && observedPerMinuteLimit > 0) perMinuteLimit = perMinuteLimit === null ? observedPerMinuteLimit : Math.min(perMinuteLimit, observedPerMinuteLimit);
      finalEvidence = { endpoint, status: response.status, responseSha256: sha256(raw), responseComplete: response.status === 200 && Array.isArray(body.response), dailyRemaining: headerInteger(response.headers, 'x-ratelimit-requests-remaining'), dailyLimit, minuteRemaining: headerInteger(response.headers, 'X-RateLimit-Remaining'), minuteLimit: observedPerMinuteLimit, pagingTotal: Number.isInteger(pagingTotal) && pagingTotal > 0 ? pagingTotal : null, kind, attempts: attempt + 1, retryCount: attempt, attemptStatuses: [...attemptStatuses] };
      if (response.status === 429) { stoppedForRateLimit = true; return { body, evidence: finalEvidence }; }
      if (response.status >= 500 && attempt < maxRetries && requestAttemptsUsed < maxRequests) { await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000 * (2 ** attempt))); continue; }
      return { body, evidence: finalEvidence };
    } catch {
      lastError = true;
      attemptStatuses.push(0);
      finalEvidence = { endpoint, status: 0, responseSha256: sha256('network_error'), responseComplete: false, dailyRemaining: null, dailyLimit: null, minuteRemaining: null, minuteLimit: perMinuteLimit, pagingTotal: null, kind, attempts: attempt + 1, retryCount: attempt, attemptStatuses: [...attemptStatuses] };
      if (attempt < maxRetries && requestAttemptsUsed < maxRequests) await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000 * (2 ** attempt)));
    }
  }
  if (finalEvidence) return { body: {}, evidence: finalEvidence };
  throw new Error(lastError ? 'API-Football request failed' : 'API-Football request budget exhausted');
}

function selectedSeason(year: number, discovered: number[]): boolean {
  const from = fromInput ? Number(fromInput) : Math.min(...discovered);
  const to = toInput ? Number(toInput) : Math.max(...discovered);
  return year >= from && year <= to;
}

function assertBaseManifestIntegrity(manifest: BaseManifest, requireCompleteCoverage: boolean): string[] {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object' || !manifest.parameters || !Array.isArray(manifest.leagueIds) || !Array.isArray(manifest.selectedSeasons) || !Array.isArray(manifest.coverage) || !Array.isArray(manifest.facts) || !Array.isArray(manifest.requests) || !Array.isArray(manifest.basePlayerSeasonRecords) || !Array.isArray(manifest.basePlayerNames) || !Array.isArray(manifest.competitionDecisions) || !manifest.discoveredSeasonsByLeague || typeof manifest.discoveredSeasonsByLeague !== 'object') return ['estructura del manifiesto inválida'];
  const { manifestHash, ...unsigned } = manifest;
  if (!manifestHash || hashJson(unsigned) !== manifestHash) errors.push('manifestHash no coincide');
  if (manifest.mode !== 'plan' || manifest.planOnly !== true) errors.push('el manifiesto no procede de una fase plan-only');
  if (!manifest.baseRunId || !expectedBaseRunId || manifest.baseRunId !== expectedBaseRunId) errors.push('baseRunId no coincide con el run solicitado');
  if (!manifest.commitSha || !expectedSourceCommitSha || manifest.commitSha !== expectedSourceCommitSha) errors.push('commitSha no coincide con el run origen descargado');
  if (!manifest.workflowName || !workflowName || manifest.workflowName !== workflowName) errors.push('workflowName no coincide con el workflow actual');
  const expectedLeagueIds = leagues.map(({ id }) => id).sort((a, b) => a - b);
  if (hashJson([...manifest.leagueIds].sort((a, b) => a - b)) !== hashJson(expectedLeagueIds)) errors.push('leagueIds no son las cinco ligas esperadas');
  if (!Array.isArray(manifest.selectedSeasons) || !manifest.selectedSeasons.length || new Set(manifest.selectedSeasons).size !== manifest.selectedSeasons.length || manifest.selectedSeasons.some((year) => !Number.isInteger(year))) errors.push('selectedSeasons inválidas');
  if (fromInput && manifest.selectedSeasons[0] !== Number(fromInput)) errors.push('temporada inicial distinta a la solicitada');
  if (toInput && manifest.selectedSeasons.at(-1) !== Number(toInput)) errors.push('temporada final distinta a la solicitada');
  if (activeSeasonInput && manifest.activeSeason !== Number(activeSeasonInput)) errors.push('activeSeason distinta a la solicitada');
  const expectedParameters = { fromSeason: fromInput ? Number(fromInput) : null, toSeason: toInput ? Number(toInput) : null, activeSeason: activeSeasonInput ? Number(activeSeasonInput) : manifest.selectedSeasons.at(-1) };
  if (hashJson(manifest.parameters) !== hashJson(expectedParameters)) errors.push('parámetros from/to/active distintos a los usados en el plan');
  if (hashJson(manifest.coverage) !== manifest.coverageHash) errors.push('coverageHash no coincide');
  if (hashJson(manifest.facts) !== manifest.factsHash) errors.push('factsHash no coincide');
  const expectedKeys = new Set(expectedLeagueIds.flatMap((leagueId) => manifest.selectedSeasons.map((season) => `${leagueId}|${season}`)));
  const actualKeys = manifest.coverage.map((row) => `${row.leagueId}|${row.season}`);
  if (actualKeys.length !== 85 || expectedKeys.size !== 85 || new Set(actualKeys).size !== 85 || actualKeys.some((key) => !expectedKeys.has(key))) errors.push('coverage no contiene exactamente las 85 combinaciones league/season esperadas');
  const coverageCompleteByRows = manifest.coverage.length === 85 && manifest.coverage.every((row) => ['complete', 'no_data'].includes(row.status) && row.pagesExpected !== null && row.pagesRead === row.pagesExpected);
  if (manifest.baseCoverageComplete !== coverageCompleteByRows) errors.push('baseCoverageComplete no coincide con la cobertura y evidencia de páginas');
  if (requireCompleteCoverage && !coverageCompleteByRows) errors.push('la cobertura base todavía está incompleta');
  const leagueRequests = manifest.requests.filter((request) => request.kind === 'league_page');
  const requestHashes = new Set(manifest.requests.map((request) => request.responseSha256));
  for (const row of manifest.coverage) {
    const prefix = `/players?league=${row.leagueId}&season=${row.season}&page=`;
    const pages = leagueRequests.filter((request) => request.endpoint.startsWith(prefix));
    const successfulPages = pages.filter((request) => request.responseComplete ?? (request.status === 200));
    const pageNumbers = successfulPages.map((request) => Number(request.endpoint.slice(prefix.length))).sort((a, b) => a - b);
    if (successfulPages.length !== row.pagesRead || pageNumbers.some((page, index) => page !== index + 1) || successfulPages.some((request) => !request.pagingTotal || (row.pagesExpected !== null && request.pagingTotal !== row.pagesExpected))) errors.push(`evidencia de páginas inválida para ${row.leagueId}|${row.season}`);
    if (['complete', 'no_data'].includes(row.status) && (row.pagesExpected === null || row.pagesRead !== row.pagesExpected)) errors.push(`cobertura declarada completa sin agotar paging.total para ${row.leagueId}|${row.season}`);
    if (row.status === 'unavailable' && row.pagesRead !== 0) errors.push(`combinación sin consultar con páginas leídas para ${row.leagueId}|${row.season}`);
  }
  if (hashJson(Object.keys(manifest.discoveredSeasonsByLeague).map(Number).sort((a, b) => a - b)) !== hashJson(expectedLeagueIds)) errors.push('discoveredSeasonsByLeague no contiene las cinco ligas');
  if (manifest.facts.some((fact) => !requestHashes.has(fact.responseSha256))) errors.push('hay hechos cuyo response hash no está respaldado por una petición registrada');
  if (manifest.requests.some((request) => !/^[a-f0-9]{64}$/u.test(request.responseSha256) || request.attempts < 1 || request.retryCount !== request.attempts - 1)) errors.push('evidencia de peticiones inválida');
  if (manifest.playerSeasonCoverage && (typeof manifest.playerSeasonCoverage !== 'object' || Array.isArray(manifest.playerSeasonCoverage))) errors.push('playerSeasonCoverage inválido');
  return [...new Set(errors)];
}


function factFromStats(player: JsonRecord, statistic: JsonRecord, season: number, sourceUrl: string, page: number, responseSha256: string, eligibilityMajorLeagueId: number | null): YellowCardFact | null {
  if (!isOfficialClubCompetition(statistic)) return null;
  const team = object(statistic.team); const league = object(statistic.league); const games = object(statistic.games); const cards = object(statistic.cards);
  const playerId = Number(player.id); const clubId = Number(team.id); const competitionId = Number(league.id); const yellow = numberOrNull(cards.yellow);
  if (!Number.isInteger(playerId) || playerId < 1 || !Number.isInteger(clubId) || clubId < 1 || !Number.isInteger(competitionId) || competitionId < 1 || yellow === null) return null;
  const name = String(player.name ?? `Player ${playerId}`).replace(/\s+/gu, ' ').trim();
  const sourceRecord = `${season}|${playerId}|${clubId}|${competitionId}`;
  return { id: `club-yellow-card-fact-${sha256(sourceRecord).slice(0, 32)}`, sourcePlayerId: String(playerId), playerNameOriginal: name, canonicalPlayerId: `api-football:player:${playerId}`, canonicalName: name, clubProviderId: clubId, clubName: String(team.name ?? `Club ${clubId}`), competitionProviderId: competitionId, competitionName: String(league.name ?? `Competition ${competitionId}`), competitionType: 'official_club_competition', eligibilityMajorLeagueId, seasonStart: season, appearances: numberOrNull(games.appearences), minutes: numberOrNull(games.minutes), yellowCards: yellow, sourceKey: 'api-football', sourceUrl, sourcePage: page, locator: `response.player.id=${playerId}.statistics[league=${competitionId},season=${season}].team.id=${clubId}.cards.yellow`, responseSha256, capturedAt: new Date().toISOString(), sourceType: 'primary', verificationStatus: 'confirmed', coverageStatus: 'coverage_partial' };
}

async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  const baseReport = { artifactKind: 'block45_api_football_yellow_cards', source: 'api-football', leagues, rawPayloadsStored: false, secretPrinted: false, topYellowCardsEndpointUsed: false, oldRankingUsed: false, allPagesUsePagingTotal: true, careerExpansionEndpoint: '/players?id={playerId}&season={season}', exclusions: ['national teams', 'friendlies', 'youth', 'unresolved team statistics'] };
  if (mode !== 'plan' && !baseManifestInput) { await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, mode, status: `${mode}_blocked_base_manifest_required`, noSnapshotsCreated: true, noDatabaseTouched: true, reason: `${mode} requiere el manifiesto del run base_run_id.` }); return; }
  if (mode !== 'load' && !apiKey) { await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, mode, status: 'not_run', reason: 'API_FOOTBALL_KEY ausente; no se realizaron peticiones.' }); return; }
  const requests: RequestEvidence[] = []; const baseRequests: RequestEvidence[] = []; const facts: YellowCardFact[] = []; const discoveredByLeague = new Map<number, number[]>(); const playerIds = new Set<string>(); const basePlayerNames = new Map<string, string>(); const basePlayerSeasonRecords: BasePlayerSeasonRecord[] = []; const competitionDecisions = new Map<string, Record<string, unknown>>(); const playerSeasonCoverage: Record<string, PlayerSeasonEvidence> = {}; const recordCompetitionDecision = (statistic: JsonRecord) => { const league = object(statistic.league); const id = Number(league.id); const name = String(league.name ?? `Competition ${id}`); const key = `${id}|${name}`; if (!competitionDecisions.has(key)) competitionDecisions.set(key, { providerId: Number.isInteger(id) ? id : null, name, type: String(league.type ?? ''), country: String(league.country ?? ''), ...classifyClubCompetition(statistic) }); }; let providerErrors = 0; let stoppedForBudget = false;

  let selectedSeasons: number[]; let activeSeason: number; let coverage: CoverageRow[]; let sourceManifest: BaseManifest | null = null;
  if (mode !== 'plan') {
    sourceManifest = JSON.parse(await readFile(baseManifestInput, 'utf8')) as BaseManifest;
    if (sourceManifest.artifactKind !== 'block45_base_manifest' || sourceManifest.version !== '1') throw new Error('Manifiesto base BLOQUE 45 incompatible');
    const integrityErrors = assertBaseManifestIntegrity(sourceManifest, mode === 'expand' || mode === 'load');
    if (integrityErrors.length) { await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, mode, status: `${mode}_blocked_base_manifest_integrity`, noSnapshotsCreated: true, noDatabaseTouched: true, integrityErrors, reason: 'El manifiesto del run base no superó las validaciones criptográficas y contextuales; no se realizaron peticiones.' }); return; }
    if ((mode === 'expand' || mode === 'load') && !sourceManifest.baseCoverageComplete) { await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, mode, status: `${mode}_blocked_base_coverage_incomplete`, noSnapshotsCreated: true, noDatabaseTouched: true, baseCoverageComplete: false, reason: 'La cobertura base no está completa; no se realizaron peticiones de expansión ni de base de datos.' }); return; }
    selectedSeasons = sourceManifest.selectedSeasons; activeSeason = sourceManifest.activeSeason; coverage = sourceManifest.coverage;
    for (const [id, years] of Object.entries(sourceManifest.discoveredSeasonsByLeague)) discoveredByLeague.set(Number(id), years);
    for (const record of sourceManifest.basePlayerSeasonRecords) basePlayerSeasonRecords.push(record);
    for (const [playerId, playerName] of sourceManifest.basePlayerNames) { basePlayerNames.set(playerId, playerName); playerIds.add(playerId); }
    facts.push(...sourceManifest.facts); baseRequests.push(...sourceManifest.requests);
    for (const decision of sourceManifest.competitionDecisions) competitionDecisions.set(`${String(decision.providerId)}|${String(decision.name)}`, decision);
    Object.assign(playerSeasonCoverage, sourceManifest.playerSeasonCoverage ?? {});
  } else {
    for (const league of leagues) {
      if (stoppedForRateLimit) break;
      if (requestAttemptsUsed >= maxRequests) { stoppedForBudget = true; break; }
      try {
        const result = await request(`/leagues?id=${league.id}`, 'coverage'); baseRequests.push(result.evidence);
        if (result.evidence.status !== 200 || !Array.isArray(result.body.response)) { providerErrors += 1; discoveredByLeague.set(league.id, []); continue; }
        const years = array(object(array(result.body.response)[0]).seasons).map(object).map((row) => Number(row.year)).filter((year) => Number.isInteger(year)).sort((a, b) => a - b);
        discoveredByLeague.set(league.id, years);
      } catch { providerErrors += 1; discoveredByLeague.set(league.id, []); }
    }
    for (const league of leagues) if (!discoveredByLeague.has(league.id)) discoveredByLeague.set(league.id, []);
    const discoveredSeasons = [...new Set([...discoveredByLeague.values()].flat())].sort((a, b) => a - b);
    selectedSeasons = discoveredSeasons.filter((year) => selectedSeason(year, discoveredSeasons));
    activeSeason = activeSeasonInput ? Number(activeSeasonInput) : selectedSeasons.at(-1) ?? discoveredSeasons.at(-1) ?? 0;
    coverage = leagues.flatMap((league) => selectedSeasons.map((season) => ({ leagueId: league.id, league: league.name, season, status: 'unavailable' as 'complete' | 'partial' | 'unavailable' | 'no_data', pagesExpected: null as number | null, pagesRead: 0, playersReturned: 0, facts: 0, reason: 'not_queried' })));
  }

  if (mode === 'plan' || mode === 'continue') {
    const queryRows = mode === 'plan' ? coverage : coverage.filter((row) => row.status !== 'complete' && row.status !== 'no_data');
    queryCoverage: for (const rowCoverage of queryRows) {
      if (stoppedForRateLimit) break queryCoverage;
      const league = leagues.find((candidateLeague) => candidateLeague.id === rowCoverage.leagueId)!;
      const season = rowCoverage.season;
      let page = rowCoverage.pagesRead + 1;
      let totalPages = rowCoverage.pagesExpected;
      if (mode === 'plan') { page = 1; totalPages = null; }
      rowCoverage.status = 'partial';
      for (;;) {
        if (requestAttemptsUsed >= maxRequests) { stoppedForBudget = true; rowCoverage.reason = 'request_budget_reached'; break; }
        const endpoint = `/players?league=${league.id}&season=${season}&page=${page}`;
        const result = await request(endpoint, 'league_page'); (mode === 'plan' ? baseRequests : requests).push(result.evidence);
        if (result.evidence.status !== 200 || !Array.isArray(result.body.response)) { providerErrors += 1; rowCoverage.reason = result.evidence.status === 429 ? 'minute_rate_limit_stopped_queue' : 'provider_response_incomplete'; break; }
        const rows = array(result.body.response);
        rowCoverage.playersReturned += rows.length;
        rowCoverage.pagesRead = page;
        totalPages ??= result.evidence.pagingTotal;
        rowCoverage.pagesExpected = totalPages;
        for (const rowValue of rows) {
          const row = object(rowValue); const player = object(row.player); const playerId = Number(player.id);
          if (Number.isInteger(playerId) && playerId > 0) { const playerIdText = String(playerId); playerIds.add(playerIdText); basePlayerNames.set(playerIdText, String(player.name ?? `Player ${playerId}`).replace(/\s+/gu, ' ').trim()); basePlayerSeasonRecords.push({ playerId: playerIdText, leagueId: league.id, season }); }
          for (const statistic of array(row.statistics).map(object)) { recordCompetitionDecision(statistic); const fact = factFromStats(player, statistic, season, `${baseUrl}${endpoint}`, page, result.evidence.responseSha256, league.id); if (fact) { facts.push(fact); rowCoverage.facts += 1; } }
        }
        if (totalPages === null) { rowCoverage.reason = 'provider_missing_paging_total'; break; }
        if (page >= totalPages) { rowCoverage.status = rowCoverage.facts > 0 ? 'complete' : 'no_data'; rowCoverage.reason = rowCoverage.facts > 0 ? 'all paging.total pages read' : 'provider returned no eligible club-card facts'; break; }
        page += 1;
      }
      if (stoppedForBudget || stoppedForRateLimit) break queryCoverage;
    }
    for (const row of coverage) if (row.status === 'unavailable' && stoppedForRateLimit) row.reason = 'not_queried_after_429_queue_stop';
  }

  const completeBaseCoverage = coverage.length === 85 && coverage.every((row) => (row.status === 'complete' || row.status === 'no_data') && row.pagesExpected !== null && row.pagesRead === row.pagesExpected);
  const completeBaseRows = new Set(coverage.filter((row) => row.status === 'complete').map((row) => `${row.leagueId}|${row.season}`));
  const seasonsByPlayerAndLeague = new Map<string, Set<number>>();
  for (const record of basePlayerSeasonRecords) if (completeBaseRows.has(`${record.leagueId}|${record.season}`)) {
    const key = `${record.playerId}|${record.leagueId}`; const seasons = seasonsByPlayerAndLeague.get(key) ?? new Set<number>(); seasons.add(record.season); seasonsByPlayerAndLeague.set(key, seasons);
  }
  const eligiblePlayerIds = new Set([...seasonsByPlayerAndLeague.entries()].filter(([, seasons]) => seasons.size >= 2).map(([key]) => key.split('|')[0] ?? '').filter(Boolean));
  const expansionEstimate = completeBaseCoverage ? eligiblePlayerIds.size * selectedSeasons.length : null;
  const playerCompetitionMap = new Map<string, Set<string>>();
  for (const fact of facts) { const values = playerCompetitionMap.get(fact.sourcePlayerId) ?? new Set<string>(); values.add(`${fact.competitionProviderId}:${fact.competitionName}`); playerCompetitionMap.set(fact.sourcePlayerId, values); }
  const expansionPairs = expansionEstimate === null ? [] : [...eligiblePlayerIds].flatMap((playerId) => selectedSeasons.map((season) => ({ playerId, season, key: `${playerId}|${season}` })));
  const terminalExpansionStatuses = new Set<string>(['player_did_not_participate', 'data_available', 'provider_returned_no_eligible_club_stats']);
  const pendingExpansionPairs = expansionPairs.filter(({ key }) => !terminalExpansionStatuses.has(playerSeasonCoverage[key]?.status ?? ''));
  let expansionSkippedReason: string | null = null;
  if (mode === 'plan') expansionSkippedReason = 'plan_only_base_phase';
  else if (mode === 'continue') expansionSkippedReason = 'base_continuation_does_not_expand_players';
  else if (mode === 'expand' && !completeBaseCoverage) expansionSkippedReason = 'base_coverage_incomplete';
  else if (mode === 'load' && !completeBaseCoverage) expansionSkippedReason = 'base_coverage_incomplete';
  else if (mode === 'load' && pendingExpansionPairs.length > 0) expansionSkippedReason = 'expansion_batches_incomplete';
  else if (mode === 'load') expansionSkippedReason = 'load_from_complete_expansion_manifest';
  if (mode === 'expand' && completeBaseCoverage) {
    expansionLoop: for (const { playerId, season, key: coverageKey } of pendingExpansionPairs) {
      if (stoppedForRateLimit) break expansionLoop;
      if (requestAttemptsUsed >= maxRequests) { stoppedForBudget = true; break; }
      const endpoint = `/players?id=${playerId}&season=${season}`;
      const result = await request(endpoint, 'player_season'); requests.push(result.evidence);
      const rows = array(result.body.response).map(object);
      if (result.evidence.status !== 200 || !Array.isArray(result.body.response)) { providerErrors += 1; playerSeasonCoverage[coverageKey] = { playerId, season, status: 'provider_error', competitions: [] }; if (stoppedForRateLimit) break expansionLoop; continue; }
      const returnedCompetitions = new Set<string>(); let expansionFactCount = 0;
      for (const row of rows) for (const statistic of array(row.statistics).map(object)) {
        recordCompetitionDecision(statistic);
        const leagueId = Number(object(statistic.league).id); const leagueName = String(object(statistic.league).name ?? `Competition ${leagueId}`); if (Number.isInteger(leagueId) && leagueId > 0) returnedCompetitions.add(`${leagueId}:${leagueName}`); const majorEligibility = FIVE_MAJOR_LEAGUE_IDS.includes(leagueId as (typeof FIVE_MAJOR_LEAGUE_IDS)[number]) ? leagueId : null;
        const fact = factFromStats(object(row.player), statistic, season, `${baseUrl}${endpoint}`, 1, result.evidence.responseSha256, majorEligibility);
        if (fact) { facts.push(fact); expansionFactCount += 1; const values = playerCompetitionMap.get(fact.sourcePlayerId) ?? new Set<string>(); values.add(`${fact.competitionProviderId}:${fact.competitionName}`); playerCompetitionMap.set(fact.sourcePlayerId, values); }
      }
      playerSeasonCoverage[coverageKey] = { playerId, season, status: rows.length === 0 ? 'player_did_not_participate' : expansionFactCount > 0 ? 'data_available' : 'provider_returned_no_eligible_club_stats', competitions: [...returnedCompetitions].sort() };
    }
  }
  const completedExpansionPairs = expansionPairs.length - pendingExpansionPairs.filter(({ key }) => !terminalExpansionStatuses.has(playerSeasonCoverage[key]?.status ?? '')).length;
  const expansionComplete = completeBaseCoverage && pendingExpansionPairs.every(({ key }) => terminalExpansionStatuses.has(playerSeasonCoverage[key]?.status ?? ''));

  const uniqueFacts = [...new Map(facts.map((fact) => [fact.id, fact])).values()];
  const requestedSeasons = selectedSeasons;
  const candidate = mode === 'load' && expansionComplete ? buildYellowCardSnapshots({ facts: uniqueFacts, activeSeason, requestedSeasons, coverageScope: `API-Football; carreras ampliadas por jugador; cinco grandes ligas como elegibilidad; temporadas descubiertas ${requestedSeasons[0] ?? '—'}-${requestedSeasons.at(-1) ?? '—'}`, generatedAt: new Date().toISOString() }) : null;
  const playerCoverage = Object.fromEntries([...playerCompetitionMap.entries()].map(([playerId, competitions]) => [playerId, [...competitions].sort()]));
  const manifestRequests = [...baseRequests, ...requests];
  const manifestWithoutHash = { artifactKind: 'block45_base_manifest' as const, version: '1' as const, mode: 'plan' as const, planOnly: true as const, phase: (mode === 'load' ? sourceManifest?.phase ?? 'plan' : mode) as 'plan' | 'continue' | 'expand', baseRunId, parentRunId: sourceManifest?.baseRunId ?? null, commitSha, workflowName, leagueIds: leagues.map(({ id }) => id), parameters: sourceManifest?.parameters ?? { fromSeason: fromInput ? Number(fromInput) : null, toSeason: toInput ? Number(toInput) : null, activeSeason }, selectedSeasons, activeSeason, discoveredSeasonsByLeague: Object.fromEntries([...discoveredByLeague.entries()].map(([id, years]) => [id, years])), coverage, coverageHash: hashJson(coverage), basePlayerSeasonRecords, basePlayerNames: [...basePlayerNames.entries()], facts: uniqueFacts, factsHash: hashJson(uniqueFacts), requests: manifestRequests, competitionDecisions: [...competitionDecisions.values()], playerSeasonCoverage, generatedAt: new Date().toISOString(), baseCoverageComplete: completeBaseCoverage };
  const generatedManifest: BaseManifest = { ...manifestWithoutHash, manifestHash: hashJson(manifestWithoutHash) };
  const baseManifest = mode === 'load' ? sourceManifest! : generatedManifest;
  if (mode === 'plan' || mode === 'continue' || mode === 'expand') await writeJson(resolve(outputRoot, 'BLOCK45_BASE_MANIFEST.json'), generatedManifest);
  await writeJson(resolve(outputRoot, 'BLOCK45_FACTS.json'), { source: 'api-football', activeSeason, requestedSeasons, facts: uniqueFacts });
  await writeJson(resolve(outputRoot, 'BLOCK45_COVERAGE_MATRIX.json'), coverage);
  await writeJson(resolve(outputRoot, 'BLOCK45_PLAYER_COVERAGE.json'), playerCoverage);
  await writeJson(resolve(outputRoot, 'BLOCK45_PLAYER_SEASON_COVERAGE.json'), playerSeasonCoverage);
  const reportRequests = manifestRequests;
  const baseRequestAttempts = baseRequests.reduce((sum, request) => sum + request.attempts, 0);
  const expansionRequestAttempts = mode === 'expand' ? requestAttemptsUsed : 0;
  const requestAttempts = mode === 'plan' ? requestAttemptsUsed : baseRequestAttempts + requestAttemptsUsed;
  const retryAttempts = reportRequests.reduce((sum, request) => sum + request.retryCount, 0);
  await writeJson(resolve(outputRoot, 'BLOCK45_REQUESTS.json'), { requests: reportRequests, summary: { recordedFinalResponses: reportRequests.length, actualAttempts: requestAttempts, batchAttempts: requestAttemptsUsed, historicalAttempts: baseRequestAttempts, expansionAttempts: expansionRequestAttempts, retryAttempts, statusCounts: Object.fromEntries([...new Set(reportRequests.map((request) => request.status))].map((status) => [status, reportRequests.filter((request) => request.status === status).length])) } });
  if (candidate) await writeJson(resolve(outputRoot, 'BLOCK45_CANDIDATE_RANKING.json'), { career: candidate.snapshots.career.ranking.slice(0, 100), activeSeason: candidate.snapshots.active_season.ranking.slice(0, 100), activePlayersCareer: candidate.snapshots.active_players_career.ranking.slice(0, 100), controls: candidate.controls });
  const pagesEstimated = coverage.reduce((sum, row) => sum + (row.pagesExpected ?? 0), 0);
  const totalEstimated = completeBaseCoverage && expansionEstimate !== null ? discoveredByLeague.size + pagesEstimated + expansionEstimate : null;
  const pagesLowerBound = coverage.reduce((sum, row) => sum + Math.max(row.pagesExpected ?? 0, row.pagesRead, row.pagesExpected === null && row.pagesRead === 0 ? 1 : 0), 0);
  const lowerBoundEstimate = discoveredByLeague.size + pagesLowerBound;
  const notQueried = coverage.filter((row) => row.status === 'unavailable').map((row) => ({ leagueId: row.leagueId, league: row.league, season: row.season, reason: row.reason }));
  for (const league of leagues) for (const season of discoveredByLeague.get(league.id) ?? []) if (!requestedSeasons.includes(season)) notQueried.push({ leagueId: league.id, league: league.name, season, reason: 'outside_requested_range' });
  const controlArtifact = Object.fromEntries(CONTROL_NAMES.map((name) => { const normalized = normalizePlayerName(name); const matchedPlayerIds = [...basePlayerNames.entries()].filter(([, playerName]) => normalizePlayerName(playerName) === normalized).map(([playerId]) => playerId); return [name, { validationStatus: candidate ? 'provisional_pending_review' : 'provisional_base_or_expansion_incomplete', summary: candidate?.controls[name] ?? null, matchedPlayerIds, baseRows: basePlayerSeasonRecords.filter((row) => matchedPlayerIds.includes(row.playerId)), facts: uniqueFacts.filter((fact) => matchedPlayerIds.includes(fact.sourcePlayerId)), expandedSeasonCoverage: Object.values(playerSeasonCoverage).filter((row) => matchedPlayerIds.includes(row.playerId)) }]; }));
  await writeJson(resolve(outputRoot, 'BLOCK45_CONTROL_CASES.json'), controlArtifact);
  const dailyQuotaValues = reportRequests.map((request) => request.dailyRemaining).filter((value): value is number => value !== null);
  const minuteQuotaValues = reportRequests.map((request) => request.minuteRemaining).filter((value): value is number => value !== null);
  const quotaDailyInitial = dailyQuotaValues[0] ?? null; const quotaDailyFinal = dailyQuotaValues.at(-1) ?? null;
  const quotaPerMinuteInitial = minuteQuotaValues[0] ?? null; const quotaPerMinuteFinal = minuteQuotaValues.at(-1) ?? null;
  const successfulResponses = reportRequests.filter((request) => request.status >= 200 && request.status < 300).length; const rateLimitedResponses = reportRequests.filter((request) => request.status === 429).length;
  const reportStatus = mode === 'plan' ? (stoppedForBudget ? 'plan_budget_insufficient' : providerErrors > 0 ? 'plan_partial' : 'plan_ready') : mode === 'continue' ? (completeBaseCoverage ? 'base_complete_expansion_estimate_ready' : stoppedForRateLimit ? 'continue_rate_limited' : stoppedForBudget || providerErrors > 0 ? 'continue_partial' : 'continue_ready') : mode === 'expand' ? (expansionComplete ? 'expansion_complete_ready_for_load' : stoppedForRateLimit ? 'expansion_batch_rate_limited' : 'expansion_batch_partial') : expansionComplete ? 'load_candidate_ready' : 'load_blocked_expansion_incomplete';
  const reportBatchRequests = mode === 'plan' ? baseRequests : requests;
  const batchDailyValues = reportBatchRequests.map((request) => request.dailyRemaining).filter((value): value is number => value !== null);
  const batchMinuteValues = reportBatchRequests.map((request) => request.minuteRemaining).filter((value): value is number => value !== null);
  const reportRanking = candidate ? { careerTop100: candidate.snapshots.career.ranking.slice(0, 100), activeSeasonTop100: candidate.snapshots.active_season.ranking.slice(0, 100), activePlayersCareerTop100: candidate.snapshots.active_players_career.ranking.slice(0, 100) } : null;
  await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, mode, status: reportStatus, planOnly, noSnapshotsCreated: !candidate, noDatabaseTouched: true, discoveredSeasonsByLeague: Object.fromEntries([...discoveredByLeague.entries()].map(([id, years]) => [id, years])), selectedSeasons: requestedSeasons, activeSeason, baseCoverageComplete: completeBaseCoverage, baseManifestFile: 'BLOCK45_BASE_MANIFEST.json', baseManifestReusable: completeBaseCoverage && Boolean(commitSha && workflowName), baseManifestHashes: { coverageHash: baseManifest.coverageHash, factsHash: baseManifest.factsHash, manifestHash: baseManifest.manifestHash }, requestsEstimated: totalEstimated, requestsEstimatedLowerBound: lowerBoundEstimate, requestsEstimatedBreakdown: { leagueCoverage: discoveredByLeague.size, leaguePages: pagesEstimated, playerSeasonExpansion: expansionEstimate, expansionEligiblePlayers: eligiblePlayerIds.size, expansionCompletedPairs: completedExpansionPairs, expansionTotalPairs: expansionPairs.length, expansionPendingPairs: expansionPairs.length - completedExpansionPairs, expansionStatus: !completeBaseCoverage ? 'blocked_until_base_coverage_complete' : expansionComplete ? 'complete' : 'pending_batches' }, requestsPerformed: reportRequests.length, batchRequestsPerformed: reportBatchRequests.length, requestAttempts, batchRequestAttempts: requestAttemptsUsed, expansionAttempts: expansionRequestAttempts, retryAttempts, quotaDaily: { initial: batchDailyValues[0] ?? null, final: batchDailyValues.at(-1) ?? null, limit: reportBatchRequests.find((request) => request.dailyLimit !== null)?.dailyLimit ?? null }, quotaPerMinute: { initial: batchMinuteValues[0] ?? null, final: batchMinuteValues.at(-1) ?? null, limit: reportBatchRequests.find((request) => request.minuteLimit !== null)?.minuteLimit ?? null }, quotaReconciliation: { cumulativeFinalResponses: reportRequests.length, cumulativeAttempts: requestAttempts, batchFinalResponses: reportBatchRequests.length, batchAttempts: requestAttemptsUsed, successfulResponses: reportRequests.filter((request) => request.status >= 200 && request.status < 300).length, rateLimitedResponses: reportRequests.filter((request) => request.status === 429).length, retryAttempts, dailyBatchHeaderValuesObserved: batchDailyValues.length, perMinuteBatchHeaderValuesObserved: batchMinuteValues.length, dailyBatchHeaderDecrease: batchDailyValues.length > 1 ? batchDailyValues[0]! - batchDailyValues.at(-1)! : null, dailyBatchUnreconciledDifference: batchDailyValues.length > 1 ? requestAttemptsUsed - (batchDailyValues[0]! - batchDailyValues.at(-1)!) : null, perMinuteWindowNote: 'El contador por minuto se renueva; sus valores inicial y final no son consumo acumulado. La cuota diaria se registra por separado; la diferencia con intentos queda explícita.' }, pages: reportRequests.filter((request) => request.kind === 'league_page' && (request.responseComplete ?? request.status === 200)).length, batchPagesRead: reportBatchRequests.filter((request) => request.kind === 'league_page' && (request.responseComplete ?? request.status === 200)).length, pageResponses: reportRequests.filter((request) => request.kind === 'league_page').length, discoveredPlayers: playerIds.size, eligiblePlayers: eligiblePlayerIds.size, factsObserved: uniqueFacts.length, duplicatesRemoved: facts.length - new Set(facts.map((fact) => fact.id)).size, providerErrors, stoppedForBudget, stoppedForRateLimit, expansionSkippedReason, coverage, competitionsNotQueried: notQueried, competitionDecisions: [...competitionDecisions.values()], playerCompetitionCoverageFile: 'BLOCK45_PLAYER_COVERAGE.json', playerSeasonCoverageFile: 'BLOCK45_PLAYER_SEASON_COVERAGE.json', controlCasesFile: 'BLOCK45_CONTROL_CASES.json', controls: candidate?.controls ?? null, controlValidationStatus: candidate ? 'provisional_pending_real_evidence_review' : 'provisional', rankingCandidate: reportRanking, hashes: { facts: sha256(stableYellowJson(uniqueFacts.map((fact) => fact.id).sort())), requests: sha256(stableYellowJson(reportRequests.map((request) => request.responseSha256))) }, rawPayloadsStored: false, secretPrinted: false, snapshotsCreated: candidate ? 3 : 0, officialSnapshotCreated: false });
}

await main();
