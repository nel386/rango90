import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { stableClubCardsJson, type ClubCardFact } from '../clubCardsRankingEngine.js';
import { backoffDelayMs, classifyClubCardProviderFailure } from '../clubCardsBatchPlanner.js';

type JsonRecord = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown; paging?: JsonRecord };
type Competition = { id: number; name: string; country: string };
type RequestEvidence = { endpoint: string; httpStatus: number | null; ok: boolean; resultCount: number; responseSha256: string; quotaRemaining: number | null };
const COMPETITIONS: Competition[] = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 135, name: 'Serie A', country: 'Italy' },
  { id: 78, name: 'Bundesliga', country: 'Germany' },
  { id: 61, name: 'Ligue 1', country: 'France' },
  { id: 94, name: 'Primeira Liga', country: 'Portugal' }
];
const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const outputRoot = resolve(process.env.BLOCK31_OUTPUT_ROOT?.trim() || 'audits/block31');
const activeSeason = Number(process.env.BLOCK31_ACTIVE_SEASON_START ?? 2026);
const quotaReserve = Math.max(Number(process.env.BLOCK31_QUOTA_RESERVE ?? 10) || 10, 0);
const planOnly = process.env.BLOCK31_PLAN_ONLY === '1';
const planFile = process.env.BLOCK31_COVERAGE_PLAN_FILE?.trim() ?? '';
// BLOQUE 32: el operador puede fijar el último estado conocido de cuota. Un cero
// es una barrera dura: no se hace ni siquiera la petición de planificación.
const knownQuotaRemaining = process.env.BLOCK32_KNOWN_QUOTA_REMAINING?.trim();
const maxRetries = Math.max(0, Math.min(3, Number(process.env.BLOCK32_MAX_RETRIES ?? 2) || 0));
const selectedCompetition = process.env.BLOCK32_COMPETITION?.trim() || 'all';
const scopedCompetitions = selectedCompetition === 'all' ? COMPETITIONS : COMPETITIONS.filter((competition) => String(competition.id) === selectedCompetition || competition.name.toLowerCase().replaceAll(' ', '-') === selectedCompetition);
function artifact(name: string): string { return `BLOCK31_${name}`; }
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function object(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function quota(headers: Headers): number | null { const value = Number(headers.get('x-ratelimit-requests-remaining')); return Number.isFinite(value) ? value : null; }
function writeJson(path: string, value: unknown): Promise<void> { return mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableClubCardsJson(value), 'utf8')); }
function numberOrNull(value: unknown): number | null { return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null; }

async function request(endpoint: string): Promise<{ body: Envelope; evidence: RequestEvidence; rawHash: string }> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      const raw = await response.text(); let body: Envelope = {};
      try { body = object(JSON.parse(raw)) as Envelope; } catch { body = { errors: { invalid_json: true } }; }
      const rawHash = sha256(raw);
      const retryable = classifyClubCardProviderFailure({ status: response.status, incomplete: !response.ok || !Array.isArray(body.response) });
      if (attempt < maxRetries && ['rate_limited', 'temporary', 'incomplete'].includes(retryable)) { await new Promise((resolveDelay) => setTimeout(resolveDelay, backoffDelayMs(attempt))); continue; }
      return { body, rawHash, evidence: { endpoint, httpStatus: response.status, ok: response.ok, resultCount: array(body.response).length, responseSha256: rawHash, quotaRemaining: quota(response.headers) } };
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, backoffDelayMs(attempt)));
    }
  }
}

function coverageFromLeague(competition: Competition, body: Envelope) {
  const league = object(array(body.response).map(object)[0]);
  const seasons = array(league.seasons).map(object).map((row) => ({ year: Number(row.year), start: typeof row.start === 'string' ? row.start : null, end: typeof row.end === 'string' ? row.end : null, events: object(object(row.coverage).fixtures).events === true })).filter((row) => Number.isInteger(row.year));
  return { competition, seasons };
}

function factFromStats(competition: Competition, season: number, page: number, row: JsonRecord, statistic: JsonRecord, contentSha256: string): ClubCardFact | null {
  const player = object(row.player); const team = object(statistic.team); const cards = object(statistic.cards);
  const playerId = Number(player.id); const teamId = Number(team.id);
  const yellowCards = numberOrNull(cards.yellow); const redDirect = numberOrNull(cards.red); const redSecondYellow = numberOrNull(cards.second_yellow);
  const redCards = redDirect === null && redSecondYellow === null ? null : (redDirect ?? 0) + (redSecondYellow ?? 0);
  if (!Number.isInteger(playerId) || playerId < 1 || !Number.isInteger(teamId) || teamId < 1 || yellowCards === null && redCards === null) return null;
  const sourceRecordId = `league:${competition.id}:season:${season}:player:${playerId}:team:${teamId}`;
  return { id: `club-card-fact-${sha256(`${competition.id}|${season}|${playerId}|${teamId}|${sourceRecordId}`).slice(0, 32)}`, canonicalPlayerId: `clubcards:api-football:player:${playerId}`, sourcePlayerId: String(playerId), playerNameAtSource: String(player.name ?? `Player ${playerId}`), clubProviderId: teamId, clubNameAtSource: String(team.name ?? `Club ${teamId}`), competition: { id: `api-football:club-competition:${competition.id}`, providerId: competition.id, name: competition.name, country: competition.country }, seasonStart: season, seasonLabel: `${season}/${String(season + 1).slice(-2)}`, recordType: 'season_stat', matchId: null, matchDate: null, matchType: 'official_competition', yellowCards, redCards, redSecondYellow, redDirect, sourceKey: 'api-football', sourceCaptureId: `block31-api-${competition.id}-${season}-${page}`, sourceRecordId, sourceType: 'primary', verificationStatus: 'confirmed', scopeEligible: true, evidence: { sourceUrl: `${baseUrl}/players?league=${competition.id}&season=${season}&page=${page}`, locator: `response.player.id=${playerId}.statistics[league=${competition.id},season=${season}].team.id=${teamId}.cards`, contentSha256 }, capturedAt: new Date().toISOString() };
}

async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true }); const requests: RequestEvidence[] = [];
  if (!apiKey) { await writeJson(resolve(outputRoot, artifact('REPORT.json')), { artifactKind: 'block31_api_football_club_cards', status: 'not_run', reason: 'API key ausente; no se realizaron peticiones.', requestsPerformed: 0, rawPayloadsStored: false, secretPrinted: false }); return; }
  if (knownQuotaRemaining !== undefined && Number(knownQuotaRemaining) === 0) {
    const coverageMatrix = scopedCompetitions.map((competition) => ({ competitionId: `api-football:club-competition:${competition.id}`, providerId: competition.id, competition: competition.name, country: competition.country, seasonStart: activeSeason, status: 'unavailable', playerPages: 0, playerRecords: 0, yellowCards: 0, redCards: 0, reason: 'quota_insufficient: presupuesto conocido agotado; no se inició la tanda ni se consultó API-Football.' }));
    await writeJson(resolve(outputRoot, artifact('COVERAGE_PLAN.json')), { source: 'api-football', activeSeason, competitions: scopedCompetitions, coverageMatrix, requestsEstimated: scopedCompetitions.length, requestsPerformed: 0, requestsSkipped: scopedCompetitions.length, quotaRemaining: 0, rawPayloadsStored: false, secretPrinted: false });
    await writeJson(resolve(outputRoot, artifact('REPORT.json')), { artifactKind: 'block32_api_football_club_cards', status: 'quota_insufficient', quotaInitial: 0, quotaReserve, requestsEstimated: scopedCompetitions.length, requestsPerformed: 0, requestsSkipped: scopedCompetitions.length, coverageMatrix, snapshotsPreserved: true, newSnapshotCreated: false, rawPayloadsStored: false, secretPrinted: false });
    return;
  }
  try {
    let plans: Array<{ competition: Competition; seasons: Array<{ year: number; start: string | null; end: string | null; events: boolean }> }> = [];
    if (planFile) { try { plans = JSON.parse(await readFile(planFile, 'utf8')).plans ?? []; } catch { plans = []; } }
    if (plans.length === 0) for (const competition of scopedCompetitions) { const result = await request(`/leagues?id=${competition.id}`); requests.push(result.evidence); plans.push(coverageFromLeague(competition, result.body)); }
    const coverageMatrix = plans.flatMap((plan) => plan.seasons.map((season) => ({ competitionId: `api-football:club-competition:${plan.competition.id}`, providerId: plan.competition.id, competition: plan.competition.name, country: plan.competition.country, seasonStart: season.year, status: season.year === activeSeason ? (season.events ? 'partial' : 'unavailable') : 'unavailable', playerPages: 0, playerRecords: 0, yellowCards: 0, redCards: 0, reason: season.year === activeSeason ? (season.events ? 'Se ha confirmado la cobertura de eventos; se consultarán estadísticas de jugadores.' : 'API no confirma cobertura de eventos para la temporada activa.') : 'Plan de cobertura solamente; no se descargan temporadas históricas en este workflow.' })));
    await writeJson(resolve(outputRoot, artifact('COVERAGE_PLAN.json')), { source: 'api-football', competitions: scopedCompetitions, activeSeason, plans, coverageMatrix, requestsPerformed: requests.length, quotaRemaining: requests.at(-1)?.quotaRemaining ?? null, rawPayloadsStored: false, secretPrinted: false });
    if (planOnly) { await writeJson(resolve(outputRoot, artifact('REPORT.json')), { artifactKind: 'block31_api_football_club_cards', status: 'plan_ready', activeSeason, requestsPerformed: requests.length, quotaRemaining: requests.at(-1)?.quotaRemaining ?? null, competitions: scopedCompetitions, coverageMatrix, factsImported: 0, rawPayloadsStored: false, secretPrinted: false }); return; }
    const facts: ClubCardFact[] = []; let stoppedForQuota = false;
    for (const plan of plans) {
      const season = plan.seasons.find((row) => row.year === activeSeason); if (!season?.events) continue;
      for (let page = 1; ; page += 1) {
        const remaining = requests.at(-1)?.quotaRemaining;
        if (remaining !== null && remaining !== undefined && remaining <= quotaReserve) { stoppedForQuota = true; break; }
        const result = await request(`/players?league=${plan.competition.id}&season=${activeSeason}&page=${page}`); requests.push(result.evidence);
        const pageRows = array(result.body.response).map(object); const matrix = coverageMatrix.find((row) => row.providerId === plan.competition.id && row.seasonStart === activeSeason);
        if (matrix) { matrix.playerPages = page; matrix.playerRecords += pageRows.length; }
        for (const row of pageRows) for (const statistic of array(row.statistics).map(object)) { if (Number(object(statistic.league).id) !== plan.competition.id || Number(object(statistic.league).season) !== activeSeason) continue; const fact = factFromStats(plan.competition, activeSeason, page, row, statistic, result.rawHash); if (fact) facts.push(fact); }
        if (!result.evidence.ok || pageRows.length === 0 || page >= Number(result.body.paging?.total ?? page)) break;
      }
      const matrix = coverageMatrix.find((row) => row.providerId === plan.competition.id && row.seasonStart === activeSeason);
      if (matrix) { matrix.yellowCards = facts.filter((fact) => fact.competition.providerId === plan.competition.id).reduce((sum, fact) => sum + (fact.yellowCards ?? 0), 0); matrix.redCards = facts.filter((fact) => fact.competition.providerId === plan.competition.id).reduce((sum, fact) => sum + (fact.redCards ?? 0), 0); matrix.status = matrix.playerPages > 0 && !stoppedForQuota ? 'complete' : 'partial'; matrix.reason = matrix.status === 'complete' ? 'Todas las páginas de estadísticas de jugadores de la temporada activa fueron consultadas.' : 'La respuesta fue parcial o la cuota impidió completar las páginas.'; }
      if (stoppedForQuota) break;
    }
    const report = { artifactKind: 'block31_api_football_club_cards', status: stoppedForQuota ? 'partial' : facts.length > 0 ? 'ready_for_lab_load' : 'not_sufficient', activeSeason, requestsPerformed: requests.length, quotaRemaining: requests.at(-1)?.quotaRemaining ?? null, quotaReserve, competitions: scopedCompetitions, coverageMatrix, factsImported: facts.length, playersWithFacts: new Set(facts.map((fact) => fact.canonicalPlayerId)).size, unresolvedFacts: facts.filter((fact) => !fact.canonicalPlayerId).length, sourceType: 'primary', rawPayloadsStored: false, secretPrinted: false, officialSnapshotCreated: false, redTypesDifferentiated: facts.some((fact) => fact.redSecondYellow !== null || fact.redDirect !== null) };
    await writeJson(resolve(outputRoot, artifact('FACTS.json')), { source: 'api-football', activeSeason, facts }); await writeJson(resolve(outputRoot, artifact('REPORT.json')), report);
  } catch (error) { await writeJson(resolve(outputRoot, artifact('REPORT.json')), { artifactKind: 'block31_api_football_club_cards', status: 'failed', requestsPerformed: requests.length, quotaRemaining: requests.at(-1)?.quotaRemaining ?? null, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown_error', rawPayloadsStored: false, secretPrinted: false }); process.exitCode = 1; }
}
await main();
