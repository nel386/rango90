import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildYellowCardSnapshots, CONTROL_NAMES, FIVE_MAJOR_LEAGUE_IDS, normalizePlayerName, stableYellowJson, type YellowCardFact } from '../clubYellowCardsCareerRankingEngine.js';
import { classifyClubCompetition, isOfficialClubCompetition } from './block45-provider-scope.js';

type JsonRecord = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown; paging?: JsonRecord };
type League = { id: number; name: string };
type RequestEvidence = { endpoint: string; status: number; responseSha256: string; dailyRemaining: number | null; dailyLimit: number | null; minuteRemaining: number | null; minuteLimit: number | null; pagingTotal: number | null; kind: 'coverage' | 'league_page' | 'player_season'; attempts: number; retryCount: number; attemptStatuses: number[] };
type BasePlayerSeasonRecord = { playerId: string; leagueId: number; season: number };
type CoverageRow = { leagueId: number; league: string; season: number; status: 'complete' | 'partial' | 'unavailable' | 'no_data'; pagesExpected: number | null; pagesRead: number; playersReturned: number; facts: number; reason: string };
type BaseManifest = { artifactKind: 'block45_base_manifest'; version: '1'; mode: 'plan'; planOnly: true; baseRunId: string; commitSha: string; workflowName: string; leagueIds: number[]; parameters: { fromSeason: number | null; toSeason: number | null; activeSeason: number }; selectedSeasons: number[]; activeSeason: number; discoveredSeasonsByLeague: Record<string, number[]>; coverage: CoverageRow[]; coverageHash: string; basePlayerSeasonRecords: BasePlayerSeasonRecord[]; basePlayerNames: Array<[string, string]>; facts: YellowCardFact[]; factsHash: string; requests: RequestEvidence[]; competitionDecisions: Array<Record<string, unknown>>; generatedAt: string; baseCoverageComplete: boolean; manifestHash: string };

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
const mode = process.env.BLOCK45_MODE === 'load' ? 'load' : 'plan';
const planOnly = mode === 'plan' || process.env.BLOCK45_PLAN_ONLY === '1';
const baseManifestInput = process.env.BLOCK45_BASE_MANIFEST_FILE?.trim() ?? '';
const baseRunId = process.env.BLOCK45_BASE_RUN_ID?.trim() || process.env.GITHUB_RUN_ID?.trim() || `local-${Date.now()}`;
const expectedBaseRunId = process.env.BLOCK45_BASE_RUN_ID?.trim() ?? '';
const commitSha = process.env.GITHUB_SHA?.trim() || process.env.BLOCK45_COMMIT_SHA?.trim() || '';
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
      finalEvidence = { endpoint, status: response.status, responseSha256: sha256(raw), dailyRemaining: headerInteger(response.headers, 'x-ratelimit-requests-remaining'), dailyLimit, minuteRemaining: headerInteger(response.headers, 'X-RateLimit-Remaining'), minuteLimit: observedPerMinuteLimit, pagingTotal: Number.isInteger(pagingTotal) && pagingTotal > 0 ? pagingTotal : null, kind, attempts: attempt + 1, retryCount: attempt, attemptStatuses: [...attemptStatuses] };
      if (response.status === 429) { stoppedForRateLimit = true; return { body, evidence: finalEvidence }; }
      if (response.status >= 500 && attempt < maxRetries && requestAttemptsUsed < maxRequests) { await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000 * (2 ** attempt))); continue; }
      return { body, evidence: finalEvidence };
    } catch {
      lastError = true;
      attemptStatuses.push(0);
      finalEvidence = { endpoint, status: 0, responseSha256: sha256('network_error'), dailyRemaining: null, dailyLimit: null, minuteRemaining: null, minuteLimit: perMinuteLimit, pagingTotal: null, kind, attempts: attempt + 1, retryCount: attempt, attemptStatuses: [...attemptStatuses] };
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

function assertBaseManifestIntegrity(manifest: BaseManifest): string[] {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object' || !manifest.parameters || !Array.isArray(manifest.leagueIds) || !Array.isArray(manifest.selectedSeasons) || !Array.isArray(manifest.coverage) || !Array.isArray(manifest.facts) || !Array.isArray(manifest.requests) || !Array.isArray(manifest.basePlayerSeasonRecords) || !Array.isArray(manifest.basePlayerNames) || !Array.isArray(manifest.competitionDecisions) || !manifest.discoveredSeasonsByLeague || typeof manifest.discoveredSeasonsByLeague !== 'object') return ['estructura del manifiesto inválida'];
  const { manifestHash, ...unsigned } = manifest;
  if (!manifestHash || hashJson(unsigned) !== manifestHash) errors.push('manifestHash no coincide');
  if (manifest.mode !== 'plan' || manifest.planOnly !== true) errors.push('el manifiesto no procede de una fase plan-only');
  if (!manifest.baseRunId || !expectedBaseRunId || manifest.baseRunId !== expectedBaseRunId) errors.push('baseRunId no coincide con el run solicitado');
  if (!manifest.commitSha || !commitSha || manifest.commitSha !== commitSha) errors.push('commitSha no coincide con el commit actual');
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
  if (manifest.baseCoverageComplete !== true || manifest.coverage.some((row) => !['complete', 'no_data'].includes(row.status) || row.pagesRead !== row.pagesExpected || row.pagesExpected === null)) errors.push('cobertura incompleta o páginas leídas distintas a paging.total');
  const leagueRequests = manifest.requests.filter((request) => request.kind === 'league_page');
  const pageHashes = new Set(leagueRequests.map((request) => request.responseSha256));
  for (const row of manifest.coverage) {
    const prefix = `/players?league=${row.leagueId}&season=${row.season}&page=`;
    const pages = leagueRequests.filter((request) => request.endpoint.startsWith(prefix));
    const pageNumbers = pages.map((request) => Number(request.endpoint.slice(prefix.length))).sort((a, b) => a - b);
    if (pages.length !== row.pagesRead || pageNumbers.some((page, index) => page !== index + 1) || pages.some((request) => request.status !== 200 || !request.pagingTotal || request.pagingTotal !== row.pagesExpected)) errors.push(`evidencia de páginas inválida para ${row.leagueId}|${row.season}`);
  }
  if (hashJson(Object.keys(manifest.discoveredSeasonsByLeague).map(Number).sort((a, b) => a - b)) !== hashJson(expectedLeagueIds)) errors.push('discoveredSeasonsByLeague no contiene las cinco ligas');
  if (manifest.facts.some((fact) => !pageHashes.has(fact.responseSha256))) errors.push('hay hechos cuyo response hash no está respaldado por una página registrada');
  if (manifest.requests.some((request) => !/^[a-f0-9]{64}$/u.test(request.responseSha256) || request.attempts < 1 || request.retryCount !== request.attempts - 1)) errors.push('evidencia de peticiones inválida');
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
  if (mode === 'load' && !baseManifestInput) { await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, mode, status: 'load_blocked_base_manifest_required', noSnapshotsCreated: true, noDatabaseTouched: true, reason: 'load requiere BLOCK45_BASE_MANIFEST_FILE de una fase plan/base completada; no se realizaron peticiones.' }); return; }
  if (!apiKey) { await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, status: 'not_run', reason: 'API_FOOTBALL_KEY ausente; no se realizaron peticiones.' }); return; }
  const requests: RequestEvidence[] = []; const baseRequests: RequestEvidence[] = []; const facts: YellowCardFact[] = []; const discoveredByLeague = new Map<number, number[]>(); const playerIds = new Set<string>(); const basePlayerNames = new Map<string, string>(); const basePlayerSeasonRecords: BasePlayerSeasonRecord[] = []; const competitionDecisions = new Map<string, Record<string, unknown>>(); const recordCompetitionDecision = (statistic: JsonRecord) => { const league = object(statistic.league); const id = Number(league.id); const name = String(league.name ?? `Competition ${id}`); const key = `${id}|${name}`; if (!competitionDecisions.has(key)) competitionDecisions.set(key, { providerId: Number.isInteger(id) ? id : null, name, type: String(league.type ?? ''), country: String(league.country ?? ''), ...classifyClubCompetition(statistic) }); }; let providerErrors = 0; let stoppedForBudget = false;

  let selectedSeasons: number[]; let activeSeason: number; let coverage: CoverageRow[];
  if (mode === 'load' && baseManifestInput) {
    const manifest = JSON.parse(await readFile(baseManifestInput, 'utf8')) as BaseManifest;
    if (manifest.artifactKind !== 'block45_base_manifest' || manifest.version !== '1') throw new Error('Manifiesto base BLOQUE 45 incompatible');
    const integrityErrors = assertBaseManifestIntegrity(manifest);
    if (integrityErrors.length) { await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, mode, status: 'load_blocked_base_manifest_integrity', noSnapshotsCreated: true, noDatabaseTouched: true, integrityErrors, reason: 'El manifiesto base no superó las validaciones criptográficas y contextuales; no se realizaron peticiones de expansión.' }); return; }
    selectedSeasons = manifest.selectedSeasons; activeSeason = manifest.activeSeason; coverage = manifest.coverage;
    for (const [id, years] of Object.entries(manifest.discoveredSeasonsByLeague)) discoveredByLeague.set(Number(id), years);
    for (const record of manifest.basePlayerSeasonRecords) basePlayerSeasonRecords.push(record);
    for (const [playerId, playerName] of manifest.basePlayerNames) { basePlayerNames.set(playerId, playerName); playerIds.add(playerId); }
    facts.push(...manifest.facts); baseRequests.push(...manifest.requests); for (const decision of manifest.competitionDecisions) competitionDecisions.set(`${String(decision.providerId)}|${String(decision.name)}`, decision);
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
    const querySeasons = [activeSeason, ...selectedSeasons.filter((season) => season !== activeSeason)];
    queryCoverage: for (const league of leagues) for (const season of querySeasons) {
      if (stoppedForRateLimit) break queryCoverage;
      const rowCoverage = coverage.find((row) => row.leagueId === league.id && row.season === season)!;
      let page = 1; let totalPages: number | null = null;
      for (;;) {
        if (requestAttemptsUsed >= maxRequests) { stoppedForBudget = true; rowCoverage.status = 'partial'; rowCoverage.reason = 'request_budget_reached'; break; }
        const endpoint = `/players?league=${league.id}&season=${season}&page=${page}`;
        try {
          const result = await request(endpoint, 'league_page'); baseRequests.push(result.evidence);
          const rows = array(result.body.response).map(object);
          if (result.evidence.status !== 200 || !Array.isArray(result.body.response)) { providerErrors += 1; rowCoverage.status = 'partial'; rowCoverage.reason = result.evidence.status === 429 ? 'minute_rate_limit_stopped_queue' : 'provider_response_incomplete'; break; }
          rowCoverage.playersReturned += rows.length;
          if (totalPages === null) totalPages = result.evidence.pagingTotal; rowCoverage.pagesExpected = totalPages; rowCoverage.pagesRead = page;
          for (const row of rows) { const player = object(row.player); const playerId = Number(player.id); if (Number.isInteger(playerId) && playerId > 0) { const playerIdText = String(playerId); playerIds.add(playerIdText); basePlayerNames.set(playerIdText, String(player.name ?? `Player ${playerId}`).replace(/\s+/gu, ' ').trim()); basePlayerSeasonRecords.push({ playerId: playerIdText, leagueId: league.id, season }); } for (const statistic of array(row.statistics).map(object)) { recordCompetitionDecision(statistic); const fact = factFromStats(player, statistic, season, `${baseUrl}${endpoint}`, page, result.evidence.responseSha256, league.id); if (fact) { facts.push(fact); rowCoverage.facts += 1; } } }
          if (totalPages === null || page >= totalPages) { rowCoverage.status = rowCoverage.facts > 0 ? 'complete' : 'no_data'; rowCoverage.reason = rowCoverage.facts > 0 ? 'all paging.total pages read' : 'provider returned no eligible club-card facts'; break; }
          page += 1;
        } catch { providerErrors += 1; rowCoverage.status = 'partial'; rowCoverage.reason = 'network_or_timeout'; break; }
      }
      if (stoppedForBudget) break;
    }
    for (const row of coverage) if (row.status === 'unavailable' && stoppedForRateLimit) row.reason = 'not_queried_after_429_queue_stop';
  }

  const completeBaseCoverage = coverage.length > 0 && coverage.length === leagues.length * selectedSeasons.length && coverage.every((row) => row.status === 'complete' || row.status === 'no_data');
  const completeBaseRows = new Set(coverage.filter((row) => row.status === 'complete').map((row) => `${row.leagueId}|${row.season}`));
  const seasonsByPlayerAndLeague = new Map<string, Set<number>>();
  for (const record of basePlayerSeasonRecords) if (completeBaseRows.has(`${record.leagueId}|${record.season}`)) {
    const key = `${record.playerId}|${record.leagueId}`; const seasons = seasonsByPlayerAndLeague.get(key) ?? new Set<number>(); seasons.add(record.season); seasonsByPlayerAndLeague.set(key, seasons);
  }
  const eligiblePlayerIds = new Set([...seasonsByPlayerAndLeague.entries()].filter(([, seasons]) => seasons.size >= 2).map(([key]) => key.split('|')[0] ?? '').filter(Boolean));
  const expansionEstimate = completeBaseCoverage ? eligiblePlayerIds.size * selectedSeasons.length : null;
  const manifestWithoutHash = { artifactKind: 'block45_base_manifest' as const, version: '1' as const, mode: 'plan' as const, planOnly: true as const, baseRunId, commitSha, workflowName, leagueIds: leagues.map(({ id }) => id), parameters: { fromSeason: fromInput ? Number(fromInput) : null, toSeason: toInput ? Number(toInput) : null, activeSeason }, selectedSeasons, activeSeason, discoveredSeasonsByLeague: Object.fromEntries([...discoveredByLeague.entries()].map(([id, years]) => [id, years])), coverage, coverageHash: hashJson(coverage), basePlayerSeasonRecords, basePlayerNames: [...basePlayerNames.entries()], facts, factsHash: hashJson(facts), requests: baseRequests, competitionDecisions: [...competitionDecisions.values()], generatedAt: new Date().toISOString(), baseCoverageComplete: completeBaseCoverage };
  const baseManifest: BaseManifest = { ...manifestWithoutHash, manifestHash: hashJson(manifestWithoutHash) };
  if (mode === 'plan') await writeJson(resolve(outputRoot, 'BLOCK45_BASE_MANIFEST.json'), baseManifest);
  const expansionBudgetInsufficient = mode === 'load' && expansionEstimate !== null && maxRequests < expansionEstimate;
  const playerCompetitionMap = new Map<string, Set<string>>();
  const playerSeasonCoverage: Record<string, { playerId: string; season: number; status: 'player_did_not_participate' | 'data_available' | 'provider_returned_no_eligible_club_stats' | 'provider_error'; competitions: string[] }> = {};
  for (const fact of facts) { const values = playerCompetitionMap.get(fact.sourcePlayerId) ?? new Set<string>(); values.add(`${fact.competitionProviderId}:${fact.competitionName}`); playerCompetitionMap.set(fact.sourcePlayerId, values); }
  const controlPlayerIds = new Set([...basePlayerNames.entries()].filter(([, playerName]) => CONTROL_NAMES.some((name) => normalizePlayerName(name) === normalizePlayerName(playerName))).map(([playerId]) => playerId));
  const expansionPlayerIds = [...controlPlayerIds].filter((playerId) => eligiblePlayerIds.has(playerId)).concat([...eligiblePlayerIds].filter((playerId) => !controlPlayerIds.has(playerId)));
  let expansionSkippedReason: string | null = null;
  if (planOnly) expansionSkippedReason = 'plan_only_base_phase';
  else if (expansionBudgetInsufficient) expansionSkippedReason = 'expansion_budget_insufficient';
  else if (stoppedForBudget) expansionSkippedReason = 'request_budget_reached_before_base_completion';
  else if (!completeBaseCoverage) expansionSkippedReason = 'base_coverage_incomplete';
  else {
    expansionLoop: for (const playerId of expansionPlayerIds) for (const season of selectedSeasons) {
      if (stoppedForRateLimit) break expansionLoop;
      if (requestAttemptsUsed >= maxRequests) { stoppedForBudget = true; break; }
      const endpoint = `/players?id=${playerId}&season=${season}`;
      try {
        const result = await request(endpoint, 'player_season'); requests.push(result.evidence);
        const rows = array(result.body.response).map(object);
        const coverageKey = `${playerId}|${season}`;
        if (result.evidence.status !== 200 || !Array.isArray(result.body.response)) { providerErrors += 1; playerSeasonCoverage[coverageKey] = { playerId, season, status: 'provider_error', competitions: [] }; if (stoppedForRateLimit) break expansionLoop; continue; }
        const returnedCompetitions = new Set<string>(); let expansionFactCount = 0;
        for (const row of rows) for (const statistic of array(row.statistics).map(object)) {
          recordCompetitionDecision(statistic);
          const leagueId = Number(object(statistic.league).id); const leagueName = String(object(statistic.league).name ?? `Competition ${leagueId}`); if (Number.isInteger(leagueId) && leagueId > 0) returnedCompetitions.add(`${leagueId}:${leagueName}`); const majorEligibility = FIVE_MAJOR_LEAGUE_IDS.includes(leagueId as (typeof FIVE_MAJOR_LEAGUE_IDS)[number]) ? leagueId : null;
          const fact = factFromStats(object(row.player), statistic, season, `${baseUrl}${endpoint}`, 1, result.evidence.responseSha256, majorEligibility);
          if (fact) { facts.push(fact); expansionFactCount += 1; const values = playerCompetitionMap.get(fact.sourcePlayerId) ?? new Set<string>(); values.add(`${fact.competitionProviderId}:${fact.competitionName}`); playerCompetitionMap.set(fact.sourcePlayerId, values); }
        }
        playerSeasonCoverage[coverageKey] = { playerId, season, status: rows.length === 0 ? 'player_did_not_participate' : expansionFactCount > 0 ? 'data_available' : 'provider_returned_no_eligible_club_stats', competitions: [...returnedCompetitions].sort() };
      } catch { providerErrors += 1; playerSeasonCoverage[`${playerId}|${season}`] = { playerId, season, status: 'provider_error', competitions: [] }; }
    }
  }

  const uniqueFacts = [...new Map(facts.map((fact) => [fact.id, fact])).values()];
  const requestedSeasons = selectedSeasons;
  const candidate = buildYellowCardSnapshots({ facts: uniqueFacts, activeSeason, requestedSeasons, coverageScope: `API-Football; carreras ampliadas por jugador; cinco grandes ligas como elegibilidad; temporadas descubiertas ${requestedSeasons[0] ?? '—'}-${requestedSeasons.at(-1) ?? '—'}`, generatedAt: new Date().toISOString() });
  const playerCoverage = Object.fromEntries([...playerCompetitionMap.entries()].map(([playerId, competitions]) => [playerId, [...competitions].sort()]));
  await writeJson(resolve(outputRoot, 'BLOCK45_FACTS.json'), { source: 'api-football', activeSeason, requestedSeasons, facts: uniqueFacts });
  await writeJson(resolve(outputRoot, 'BLOCK45_COVERAGE_MATRIX.json'), coverage);
  await writeJson(resolve(outputRoot, 'BLOCK45_PLAYER_COVERAGE.json'), playerCoverage);
  await writeJson(resolve(outputRoot, 'BLOCK45_PLAYER_SEASON_COVERAGE.json'), playerSeasonCoverage);
  const reportRequests = [...baseRequests, ...requests];
  const baseRequestAttempts = baseRequests.reduce((sum, request) => sum + request.attempts, 0);
  const expansionRequestAttempts = mode === 'load' ? requestAttemptsUsed : 0;
  const requestAttempts = mode === 'plan' ? requestAttemptsUsed : baseRequestAttempts + expansionRequestAttempts;
  const retryAttempts = reportRequests.reduce((sum, request) => sum + request.retryCount, 0);
  await writeJson(resolve(outputRoot, 'BLOCK45_REQUESTS.json'), { requests: reportRequests, summary: { recordedFinalResponses: reportRequests.length, actualAttempts: requestAttempts, baseAttempts: baseRequestAttempts, expansionAttempts: expansionRequestAttempts, retryAttempts, statusCounts: Object.fromEntries([...new Set(reportRequests.map((request) => request.status))].map((status) => [status, reportRequests.filter((request) => request.status === status).length])) } });
  await writeJson(resolve(outputRoot, 'BLOCK45_CANDIDATE_RANKING.json'), { career: candidate.snapshots.career.ranking.slice(0, 100), activeSeason: candidate.snapshots.active_season.ranking.slice(0, 100), activePlayersCareer: candidate.snapshots.active_players_career.ranking.slice(0, 100), controls: candidate.controls });
  const pagesEstimated = coverage.reduce((sum, row) => sum + (row.pagesExpected ?? 0), 0);
  const totalEstimated = completeBaseCoverage && expansionEstimate !== null ? discoveredByLeague.size + pagesEstimated + expansionEstimate : null;
  const lowerBoundEstimate = discoveredByLeague.size + pagesEstimated;
  const notQueried = coverage.filter((row) => row.status === 'unavailable').map((row) => ({ leagueId: row.leagueId, league: row.league, season: row.season, reason: row.reason }));
  for (const league of leagues) for (const season of discoveredByLeague.get(league.id) ?? []) if (!requestedSeasons.includes(season)) notQueried.push({ leagueId: league.id, league: league.name, season, reason: 'outside_requested_range' });
  const controlArtifact = Object.fromEntries(CONTROL_NAMES.map((name) => { const normalized = normalizePlayerName(name); const matchedPlayerIds = [...basePlayerNames.entries()].filter(([, playerName]) => normalizePlayerName(playerName) === normalized).map(([playerId]) => playerId); return [name, { validationStatus: completeBaseCoverage && !planOnly && !expansionBudgetInsufficient ? 'provisional_pending_review' : 'provisional_base_or_coverage_incomplete', summary: candidate.controls[name], matchedPlayerIds, baseRows: basePlayerSeasonRecords.filter((row) => matchedPlayerIds.includes(row.playerId)), facts: uniqueFacts.filter((fact) => matchedPlayerIds.includes(fact.sourcePlayerId)), expandedSeasonCoverage: Object.values(playerSeasonCoverage).filter((row) => matchedPlayerIds.includes(row.playerId)) }]; }));
  await writeJson(resolve(outputRoot, 'BLOCK45_CONTROL_CASES.json'), controlArtifact);
  const dailyQuotaValues = reportRequests.map((request) => request.dailyRemaining).filter((value): value is number => value !== null);
  const minuteQuotaValues = reportRequests.map((request) => request.minuteRemaining).filter((value): value is number => value !== null);
  const quotaDailyInitial = dailyQuotaValues[0] ?? null; const quotaDailyFinal = dailyQuotaValues.at(-1) ?? null;
  const quotaPerMinuteInitial = minuteQuotaValues[0] ?? null; const quotaPerMinuteFinal = minuteQuotaValues.at(-1) ?? null;
  const successfulResponses = reportRequests.filter((request) => request.status >= 200 && request.status < 300).length; const rateLimitedResponses = reportRequests.filter((request) => request.status === 429).length;
  const reportStatus = expansionBudgetInsufficient ? 'load_blocked_expansion_budget_insufficient' : stoppedForBudget ? 'plan_budget_insufficient' : providerErrors > 0 ? 'plan_partial' : mode === 'load' ? 'load_candidate_ready' : 'plan_ready';
  await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, mode, status: reportStatus, planOnly, noSnapshotsCreated: true, noDatabaseTouched: true, discoveredSeasonsByLeague: Object.fromEntries([...discoveredByLeague.entries()].map(([id, years]) => [id, years])), selectedSeasons: requestedSeasons, activeSeason, baseCoverageComplete: completeBaseCoverage, baseManifestFile: 'BLOCK45_BASE_MANIFEST.json', baseManifestReusable: mode === 'plan' && completeBaseCoverage && Boolean(commitSha && workflowName), baseManifestHashes: { coverageHash: baseManifest.coverageHash, factsHash: baseManifest.factsHash, manifestHash: baseManifest.manifestHash }, requestsEstimated: totalEstimated, requestsEstimatedLowerBound: lowerBoundEstimate, requestsEstimatedBreakdown: { leagueCoverage: discoveredByLeague.size, leaguePages: pagesEstimated, playerSeasonExpansion: expansionEstimate, expansionEligiblePlayers: eligiblePlayerIds.size, expansionStatus: completeBaseCoverage ? 'estimated_after_complete_base_coverage' : 'blocked_until_base_coverage_complete' }, requestsPerformed: reportRequests.length, requestAttempts, expansionAttempts: expansionRequestAttempts, retryAttempts, quotaDaily: { initial: quotaDailyInitial, final: quotaDailyFinal, limit: reportRequests.find((request) => request.dailyLimit !== null)?.dailyLimit ?? null }, quotaPerMinute: { initial: quotaPerMinuteInitial, final: quotaPerMinuteFinal, limit: reportRequests.find((request) => request.minuteLimit !== null)?.minuteLimit ?? null }, quotaReconciliation: { recordedFinalResponses: reportRequests.length, actualAttempts: requestAttempts, successfulResponses, rateLimitedResponses, retryAttempts, dailyHeaderValuesObserved: dailyQuotaValues.length, perMinuteHeaderValuesObserved: minuteQuotaValues.length, explanation: 'La cuota diaria y el límite por minuto se informan en campos separados. Los encabezados ausentes permanecen null y no se interpretan como cero.' }, pages: reportRequests.filter((request) => request.kind === 'league_page' && request.status === 200).length, pageResponses: reportRequests.filter((request) => request.kind === 'league_page').length, discoveredPlayers: playerIds.size, eligiblePlayers: eligiblePlayerIds.size, factsObserved: uniqueFacts.length, duplicatesRemoved: facts.length - new Set(facts.map((fact) => fact.id)).size, providerErrors, stoppedForBudget, stoppedForRateLimit, expansionSkippedReason, coverage, competitionsNotQueried: notQueried, competitionDecisions: [...competitionDecisions.values()], playerCompetitionCoverageFile: 'BLOCK45_PLAYER_COVERAGE.json', playerSeasonCoverageFile: 'BLOCK45_PLAYER_SEASON_COVERAGE.json', controlCasesFile: 'BLOCK45_CONTROL_CASES.json', controls: candidate.controls, controlValidationStatus: planOnly || !completeBaseCoverage || expansionBudgetInsufficient ? 'provisional' : 'pending_real_evidence_review', rankingCandidate: { careerTop100: candidate.snapshots.career.ranking.slice(0, 100), activeSeasonTop100: candidate.snapshots.active_season.ranking.slice(0, 100), activePlayersCareerTop100: candidate.snapshots.active_players_career.ranking.slice(0, 100) }, hashes: { facts: sha256(stableYellowJson(uniqueFacts.map((fact) => fact.id).sort())), requests: sha256(stableYellowJson(reportRequests.map((request) => request.responseSha256))) }, rawPayloadsStored: false, secretPrinted: false, snapshotsCreated: 0, officialSnapshotCreated: false });
}

await main();
