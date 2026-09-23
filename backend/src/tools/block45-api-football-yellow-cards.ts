import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildYellowCardSnapshots, CONTROL_NAMES, FIVE_MAJOR_LEAGUE_IDS, normalizePlayerName, stableYellowJson, type YellowCardFact } from '../clubYellowCardsCareerRankingEngine.js';
import { isOfficialClubCompetition } from './block45-provider-scope.js';

type JsonRecord = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown; paging?: JsonRecord };
type League = { id: number; name: string };
type RequestEvidence = { endpoint: string; status: number; responseSha256: string; quotaRemaining: number | null; quotaLimit: number | null; pagingTotal: number | null; kind: 'coverage' | 'league_page' | 'player_season'; attempts: number; retryCount: number; attemptStatuses: number[] };

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
const planOnly = process.env.BLOCK45_PLAN_ONLY === '1';
let requestAttemptsUsed = 0;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const object = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
const writeJson = (path: string, value: unknown) => mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableYellowJson(value), 'utf8'));

function quota(headers: Headers): number | null {
  const value = Number(headers.get('x-ratelimit-requests-remaining'));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

async function request(endpoint: string, kind: RequestEvidence['kind']): Promise<{ body: Envelope; evidence: RequestEvidence }> {
  let lastError: unknown;
  const attemptStatuses: number[] = [];
  for (let attempt = 0; attempt <= maxRetries && requestAttemptsUsed < maxRequests; attempt += 1) {
    requestAttemptsUsed += 1;
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      const raw = await response.text();
      let body: Envelope = {};
      try { body = object(JSON.parse(raw)) as Envelope; } catch { body = { errors: { invalid_json: true } }; }
      const pagingTotal = Number(body.paging?.total);
      attemptStatuses.push(response.status);
      const quotaLimit = Number(response.headers.get('x-ratelimit-requests-limit'));
      const evidence = { endpoint, status: response.status, responseSha256: sha256(raw), quotaRemaining: quota(response.headers), quotaLimit: Number.isInteger(quotaLimit) && quotaLimit > 0 ? quotaLimit : null, pagingTotal: Number.isInteger(pagingTotal) && pagingTotal > 0 ? pagingTotal : null, kind, attempts: attempt + 1, retryCount: attempt, attemptStatuses: [...attemptStatuses] };
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries && requestAttemptsUsed < maxRequests) { await new Promise((resolveDelay) => setTimeout(resolveDelay, 750 * (attempt + 1))); continue; }
      return { body, evidence };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise((resolveDelay) => setTimeout(resolveDelay, 750 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(requestAttemptsUsed >= maxRequests ? 'API-Football request budget exhausted' : 'API-Football request failed');
}

function selectedSeason(year: number, discovered: number[]): boolean {
  const from = fromInput ? Number(fromInput) : Math.min(...discovered);
  const to = toInput ? Number(toInput) : Math.max(...discovered);
  return year >= from && year <= to;
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
  if (!apiKey) { await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, status: 'not_run', reason: 'API_FOOTBALL_KEY ausente; no se realizaron peticiones.' }); return; }
  const requests: RequestEvidence[] = []; const facts: YellowCardFact[] = []; const discoveredByLeague = new Map<number, number[]>(); const playerIds = new Set<string>(); const basePlayerNames = new Map<string, string>(); const basePlayerSeasonRecords: Array<{ playerId: string; leagueId: number; season: number }> = []; let providerErrors = 0; let stoppedForBudget = false;

  for (const league of leagues) {
    if (requestAttemptsUsed >= maxRequests) { stoppedForBudget = true; break; }
    try {
      const result = await request(`/leagues?id=${league.id}`, 'coverage'); requests.push(result.evidence);
      const years = array(object(array(result.body.response)[0]).seasons).map(object).map((row) => Number(row.year)).filter((year) => Number.isInteger(year)).sort((a, b) => a - b);
      discoveredByLeague.set(league.id, years);
    } catch { providerErrors += 1; discoveredByLeague.set(league.id, []); }
  }
  const discoveredSeasons = [...new Set([...discoveredByLeague.values()].flat())].sort((a, b) => a - b);
  const selectedSeasons = discoveredSeasons.filter((year) => selectedSeason(year, discoveredSeasons));
  const activeSeason = activeSeasonInput ? Number(activeSeasonInput) : selectedSeasons.at(-1) ?? discoveredSeasons.at(-1) ?? 0;
  const coverage = leagues.flatMap((league) => selectedSeasons.map((season) => ({ leagueId: league.id, league: league.name, season, status: 'unavailable' as 'complete' | 'partial' | 'unavailable' | 'no_data', pagesExpected: null as number | null, pagesRead: 0, playersReturned: 0, facts: 0, reason: 'not_queried' })));

  const querySeasons = [activeSeason, ...selectedSeasons.filter((season) => season !== activeSeason)];
  for (const league of leagues) for (const season of querySeasons) {
    const rowCoverage = coverage.find((row) => row.leagueId === league.id && row.season === season)!;
    let page = 1; let totalPages: number | null = null;
    for (;;) {
      if (requestAttemptsUsed >= maxRequests) { stoppedForBudget = true; rowCoverage.status = 'partial'; rowCoverage.reason = 'request_budget_reached'; break; }
      const endpoint = `/players?league=${league.id}&season=${season}&page=${page}`;
      try {
        const result = await request(endpoint, 'league_page'); requests.push(result.evidence); if (totalPages === null) totalPages = result.evidence.pagingTotal; rowCoverage.pagesExpected = totalPages; rowCoverage.pagesRead = page;
        const rows = array(result.body.response).map(object); rowCoverage.playersReturned += rows.length;
        if (result.evidence.status !== 200 || !Array.isArray(result.body.response)) { providerErrors += 1; rowCoverage.status = 'partial'; rowCoverage.reason = result.evidence.status === 429 ? 'quota_or_rate_limit' : 'provider_response_incomplete'; break; }
        for (const row of rows) { const player = object(row.player); const playerId = Number(player.id); if (Number.isInteger(playerId) && playerId > 0) { const playerIdText = String(playerId); playerIds.add(playerIdText); basePlayerNames.set(playerIdText, String(player.name ?? `Player ${playerId}`).replace(/\s+/gu, ' ').trim()); basePlayerSeasonRecords.push({ playerId: playerIdText, leagueId: league.id, season }); } for (const statistic of array(row.statistics).map(object)) { const fact = factFromStats(player, statistic, season, `${baseUrl}${endpoint}`, page, result.evidence.responseSha256, league.id); if (fact) { facts.push(fact); rowCoverage.facts += 1; } } }
        if (totalPages === null || page >= totalPages) { rowCoverage.status = rowCoverage.facts > 0 ? 'complete' : 'no_data'; rowCoverage.reason = rowCoverage.facts > 0 ? 'all paging.total pages read' : 'provider returned no eligible club-card facts'; break; }
        page += 1;
      } catch { providerErrors += 1; rowCoverage.status = 'partial'; rowCoverage.reason = 'network_or_timeout'; break; }
    }
    if (stoppedForBudget) break;
  }

  const completeBaseCoverage = coverage.every((row) => row.status === 'complete' || row.status === 'no_data');
  const completeBaseRows = new Set(coverage.filter((row) => row.status === 'complete').map((row) => `${row.leagueId}|${row.season}`));
  const seasonsByPlayerAndLeague = new Map<string, Set<number>>();
  for (const record of basePlayerSeasonRecords) if (completeBaseRows.has(`${record.leagueId}|${record.season}`)) {
    const key = `${record.playerId}|${record.leagueId}`; const seasons = seasonsByPlayerAndLeague.get(key) ?? new Set<number>(); seasons.add(record.season); seasonsByPlayerAndLeague.set(key, seasons);
  }
  const eligiblePlayerIds = new Set([...seasonsByPlayerAndLeague.entries()].filter(([, seasons]) => seasons.size >= 2).map(([key]) => key.split('|')[0] ?? '').filter(Boolean));
  const expansionEstimate = completeBaseCoverage ? eligiblePlayerIds.size * selectedSeasons.length : null;
  const playerCompetitionMap = new Map<string, Set<string>>();
  const playerSeasonCoverage: Record<string, { playerId: string; season: number; status: 'player_did_not_participate' | 'data_available' | 'provider_returned_no_eligible_club_stats' | 'provider_error'; competitions: string[] }> = {};
  for (const fact of facts) { const values = playerCompetitionMap.get(fact.sourcePlayerId) ?? new Set<string>(); values.add(`${fact.competitionProviderId}:${fact.competitionName}`); playerCompetitionMap.set(fact.sourcePlayerId, values); }
  const controlPlayerIds = new Set([...basePlayerNames.entries()].filter(([, playerName]) => CONTROL_NAMES.some((name) => normalizePlayerName(name) === normalizePlayerName(playerName))).map(([playerId]) => playerId));
  const expansionPlayerIds = [...controlPlayerIds].filter((playerId) => eligiblePlayerIds.has(playerId)).concat([...eligiblePlayerIds].filter((playerId) => !controlPlayerIds.has(playerId)));
  let expansionSkippedReason: string | null = null;
  if (stoppedForBudget) expansionSkippedReason = 'request_budget_reached_before_base_completion';
  else if (!completeBaseCoverage) expansionSkippedReason = 'base_coverage_incomplete';
  else {
    for (const playerId of expansionPlayerIds) for (const season of selectedSeasons) {
      if (requestAttemptsUsed >= maxRequests) { stoppedForBudget = true; break; }
      const endpoint = `/players?id=${playerId}&season=${season}`;
      try {
        const result = await request(endpoint, 'player_season'); requests.push(result.evidence);
        const rows = array(result.body.response).map(object);
        const coverageKey = `${playerId}|${season}`;
        if (result.evidence.status !== 200 || !Array.isArray(result.body.response)) { providerErrors += 1; playerSeasonCoverage[coverageKey] = { playerId, season, status: 'provider_error', competitions: [] }; continue; }
        const returnedCompetitions = new Set<string>(); let expansionFactCount = 0;
        for (const row of rows) for (const statistic of array(row.statistics).map(object)) {
          const leagueId = Number(object(statistic.league).id); const leagueName = String(object(statistic.league).name ?? `Competition ${leagueId}`); if (Number.isInteger(leagueId) && leagueId > 0) returnedCompetitions.add(`${leagueId}:${leagueName}`); const majorEligibility = FIVE_MAJOR_LEAGUE_IDS.includes(leagueId as (typeof FIVE_MAJOR_LEAGUE_IDS)[number]) ? leagueId : null;
          const fact = factFromStats(object(row.player), statistic, season, `${baseUrl}${endpoint}`, 1, result.evidence.responseSha256, majorEligibility);
          if (fact) { facts.push(fact); expansionFactCount += 1; const values = playerCompetitionMap.get(fact.sourcePlayerId) ?? new Set<string>(); values.add(`${fact.competitionProviderId}:${fact.competitionName}`); playerCompetitionMap.set(fact.sourcePlayerId, values); }
        }
        playerSeasonCoverage[coverageKey] = { playerId, season, status: rows.length === 0 ? 'player_did_not_participate' : expansionFactCount > 0 ? 'data_available' : 'provider_returned_no_eligible_club_stats', competitions: [...returnedCompetitions].sort() };
      } catch { providerErrors += 1; playerSeasonCoverage[`${playerId}|${season}`] = { playerId, season, status: 'provider_error', competitions: [] }; }
    }
  }

  const uniqueFacts = [...new Map(facts.map((fact) => [fact.id, fact])).values()];
  const requestedSeasons = selectedSeasons.length ? selectedSeasons : discoveredSeasons;
  const candidate = buildYellowCardSnapshots({ facts: uniqueFacts, activeSeason, requestedSeasons, coverageScope: `API-Football; carreras ampliadas por jugador; cinco grandes ligas como elegibilidad; temporadas descubiertas ${requestedSeasons[0] ?? '—'}-${requestedSeasons.at(-1) ?? '—'}`, generatedAt: new Date().toISOString() });
  const playerCoverage = Object.fromEntries([...playerCompetitionMap.entries()].map(([playerId, competitions]) => [playerId, [...competitions].sort()]));
  await writeJson(resolve(outputRoot, 'BLOCK45_FACTS.json'), { source: 'api-football', activeSeason, facts: uniqueFacts });
  await writeJson(resolve(outputRoot, 'BLOCK45_COVERAGE_MATRIX.json'), coverage);
  await writeJson(resolve(outputRoot, 'BLOCK45_PLAYER_COVERAGE.json'), playerCoverage);
  await writeJson(resolve(outputRoot, 'BLOCK45_PLAYER_SEASON_COVERAGE.json'), playerSeasonCoverage);
  const requestAttempts = requestAttemptsUsed;
  await writeJson(resolve(outputRoot, 'BLOCK45_REQUESTS.json'), { requests, summary: { recordedFinalResponses: requests.length, actualAttempts: requestAttempts, retryAttempts: requests.reduce((sum, request) => sum + request.retryCount, 0), statusCounts: Object.fromEntries([...new Set(requests.map((request) => request.status))].map((status) => [status, requests.filter((request) => request.status === status).length])) } });
  await writeJson(resolve(outputRoot, 'BLOCK45_CANDIDATE_RANKING.json'), { career: candidate.snapshots.career.ranking.slice(0, 100), activeSeason: candidate.snapshots.active_season.ranking.slice(0, 100), activePlayersCareer: candidate.snapshots.active_players_career.ranking.slice(0, 100), controls: candidate.controls });
  const pagesEstimated = coverage.reduce((sum, row) => sum + (row.pagesExpected ?? 0), 0);
  const totalEstimated = completeBaseCoverage && expansionEstimate !== null ? discoveredByLeague.size + pagesEstimated + expansionEstimate : null;
  const lowerBoundEstimate = discoveredByLeague.size + pagesEstimated;
  const notQueried = coverage.filter((row) => row.status === 'unavailable').map((row) => ({ leagueId: row.leagueId, league: row.league, season: row.season, reason: row.reason }));
  for (const league of leagues) for (const season of discoveredByLeague.get(league.id) ?? []) if (!requestedSeasons.includes(season)) notQueried.push({ leagueId: league.id, league: league.name, season, reason: 'outside_requested_range' });
  const controlArtifact = Object.fromEntries(CONTROL_NAMES.map((name) => { const normalized = normalizePlayerName(name); const matchedPlayerIds = [...basePlayerNames.entries()].filter(([, playerName]) => normalizePlayerName(playerName) === normalized).map(([playerId]) => playerId); return [name, { summary: candidate.controls[name], matchedPlayerIds, baseRows: basePlayerSeasonRecords.filter((row) => matchedPlayerIds.includes(row.playerId)), facts: uniqueFacts.filter((fact) => matchedPlayerIds.includes(fact.sourcePlayerId)), expandedSeasonCoverage: Object.values(playerSeasonCoverage).filter((row) => matchedPlayerIds.includes(row.playerId)) }]; }));
  await writeJson(resolve(outputRoot, 'BLOCK45_CONTROL_CASES.json'), controlArtifact);
  const quotaInitial = requests[0]?.quotaRemaining ?? null; const quotaFinal = requests.at(-1)?.quotaRemaining ?? null; const quotaHeaderDelta = quotaInitial !== null && quotaFinal !== null ? quotaInitial - quotaFinal : null; const successfulResponses = requests.filter((request) => request.status >= 200 && request.status < 300).length; const rateLimitedResponses = requests.filter((request) => request.status === 429).length; const retryAttempts = requests.reduce((sum, request) => sum + request.retryCount, 0);
  await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), { ...baseReport, status: stoppedForBudget ? 'plan_budget_insufficient' : providerErrors > 0 ? 'plan_partial' : 'plan_ready', planOnly, noSnapshotsCreated: true, noDatabaseTouched: true, discoveredSeasonsByLeague: Object.fromEntries([...discoveredByLeague.entries()].map(([id, years]) => [id, years])), selectedSeasons: requestedSeasons, activeSeason, baseCoverageComplete: completeBaseCoverage, requestsEstimated: totalEstimated, requestsEstimatedLowerBound: lowerBoundEstimate, requestsEstimatedBreakdown: { leagueCoverage: discoveredByLeague.size, leaguePages: pagesEstimated, playerSeasonExpansion: expansionEstimate, expansionEligiblePlayers: eligiblePlayerIds.size, expansionStatus: completeBaseCoverage ? 'estimated_after_complete_base_coverage' : 'blocked_until_base_coverage_complete' }, requestsPerformed: requests.length, requestAttempts, quotaInitial, quotaFinal, quotaReconciliation: { recordedRequestResponses: requests.length, actualAttempts: requestAttempts, successfulResponses, rateLimitedResponses, retryAttempts, headerDelta: quotaHeaderDelta, unaccountedDifference: quotaHeaderDelta === null ? null : requestAttempts - quotaHeaderDelta, explanation: 'La cabecera de cuota del proveedor no se asume como contador uno-a-uno de respuestas observadas; se conservan respuestas finales, intentos, reintentos y estados para reconciliación.' }, pages: requests.filter((request) => request.kind === 'league_page').length, discoveredPlayers: playerIds.size, eligiblePlayers: eligiblePlayerIds.size, factsObserved: uniqueFacts.length, duplicatesRemoved: facts.length - uniqueFacts.length, providerErrors, stoppedForBudget, expansionSkippedReason, coverage, competitionsNotQueried: notQueried, playerCompetitionCoverageFile: 'BLOCK45_PLAYER_COVERAGE.json', playerSeasonCoverageFile: 'BLOCK45_PLAYER_SEASON_COVERAGE.json', controlCasesFile: 'BLOCK45_CONTROL_CASES.json', controls: candidate.controls, rankingCandidate: { careerTop100: candidate.snapshots.career.ranking.slice(0, 100), activeSeasonTop100: candidate.snapshots.active_season.ranking.slice(0, 100), activePlayersCareerTop100: candidate.snapshots.active_players_career.ranking.slice(0, 100) }, hashes: { facts: sha256(stableYellowJson(uniqueFacts.map((fact) => fact.id).sort())), requests: sha256(stableYellowJson(requests.map((request) => request.responseSha256))) }, rawPayloadsStored: false, secretPrinted: false, snapshotsCreated: 0, officialSnapshotCreated: false });
}

await main();
