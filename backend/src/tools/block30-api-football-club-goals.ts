import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { stableClubGoalsJson, type ClubGoalFact } from '../clubCareerGoalsRankingEngine.js';

type JsonRecord = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown; results?: number; paging?: JsonRecord };
type RequestEvidence = { endpoint: string; httpStatus: number | null; ok: boolean; resultCount: number; responseSha256: string; quotaRemaining: number | null };
type Competition = { id: number; name: string; country: string };
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
const outputRoot = resolve(process.env.BLOCK30_OUTPUT_ROOT?.trim() || 'audits/block30');
const activeSeason = Number(process.env.BLOCK30_ACTIVE_SEASON_START ?? 2026);
const quotaReserve = Math.max(Number(process.env.BLOCK30_QUOTA_RESERVE ?? 10) || 10, 0);
const planOnly = process.env.BLOCK30_PLAN_ONLY === '1';
const planFile = process.env.BLOCK30_COVERAGE_PLAN_FILE?.trim() ?? '';
function artifact(name: string): string { return `BLOCK30_${name}`; }
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function object(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function quota(headers: Headers): number | null { const value = Number(headers.get('x-ratelimit-requests-remaining')); return Number.isFinite(value) ? value : null; }
function writeJson(path: string, value: unknown): Promise<void> { return mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableClubGoalsJson(value), 'utf8')); }

async function request(endpoint: string): Promise<{ body: Envelope; evidence: RequestEvidence; rawHash: string }> {
  const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' } });
  const raw = await response.text();
  let body: Envelope = {};
  try { body = object(JSON.parse(raw)) as Envelope; } catch { body = { errors: { invalid_json: true } }; }
  const rawHash = sha256(raw);
  return { body, rawHash, evidence: { endpoint, httpStatus: response.status, ok: response.ok, resultCount: array(body.response).length, responseSha256: rawHash, quotaRemaining: quota(response.headers) } };
}

function coverageFromLeague(competition: Competition, body: Envelope) {
  const rows = array(body.response).map(object);
  const league = object(rows[0]);
  const seasons = array(league.seasons).map(object).map((row) => ({ year: Number(row.year), start: typeof row.start === 'string' ? row.start : null, end: typeof row.end === 'string' ? row.end : null, events: object(object(row.coverage).fixtures).events === true })).filter((row) => Number.isInteger(row.year));
  return { competition, seasons };
}

function factFromStats(competition: Competition, season: number, page: number, row: JsonRecord, statistic: JsonRecord, contentSha256: string): ClubGoalFact | null {
  const player = object(row.player); const team = object(statistic.team); const goals = Number(object(statistic.goals).total ?? 0);
  const playerId = Number(player.id); const teamId = Number(team.id);
  if (!Number.isInteger(playerId) || playerId < 1 || !Number.isInteger(teamId) || teamId < 1 || !Number.isInteger(goals) || goals <= 0) return null;
  const sourceRecordId = `league:${competition.id}:season:${season}:player:${playerId}:team:${teamId}`;
  return { id: `club-goal-fact-${sha256(`${competition.id}|${season}|${playerId}|${teamId}|${sourceRecordId}`).slice(0, 32)}`, canonicalPlayerId: `clubgoals:api-football:player:${playerId}`, sourcePlayerId: String(playerId), playerNameAtSource: String(player.name ?? `Player ${playerId}`), clubProviderId: teamId, clubNameAtSource: String(team.name ?? `Club ${teamId}`), competition: { id: `api-football:club-competition:${competition.id}`, providerId: competition.id, name: competition.name, country: competition.country }, seasonStart: season, seasonLabel: `${season}/${String(season + 1).slice(-2)}`, recordType: 'season_stat', matchId: null, matchDate: null, matchType: 'official_competition', goals, sourceKey: 'api-football', sourceCaptureId: `block30-api-${competition.id}-${season}-${page}`, sourceRecordId, sourceType: 'primary', verificationStatus: 'confirmed', scopeEligible: true, evidence: { sourceUrl: `${baseUrl}/players?league=${competition.id}&season=${season}&page=${page}`, locator: `response.player.id=${playerId}.statistics[league=${competition.id},season=${season}].team.id=${teamId}`, contentSha256 }, capturedAt: new Date().toISOString() };
}

async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  const requests: RequestEvidence[] = [];
  if (!apiKey) {
    await writeJson(resolve(outputRoot, artifact('REPORT.json')), { artifactKind: 'block30_api_football_club_goals', status: 'not_run', reason: 'API key ausente; no se realizaron peticiones.', requestsPerformed: 0, rawPayloadsStored: false, secretPrinted: false });
    return;
  }
  try {
    let plans: Array<{ competition: Competition; seasons: Array<{ year: number; start: string | null; end: string | null; events: boolean }> }> = [];
    if (planFile) {
      try { plans = JSON.parse(await readFile(planFile, 'utf8')).plans ?? []; } catch { plans = []; }
    }
    if (plans.length === 0) {
      for (const competition of COMPETITIONS) { const result = await request(`/leagues?id=${competition.id}`); requests.push(result.evidence); plans.push(coverageFromLeague(competition, result.body)); }
    }
    const coverageMatrix = plans.flatMap((plan) => plan.seasons.map((season) => ({ competitionId: `api-football:club-competition:${plan.competition.id}`, providerId: plan.competition.id, competition: plan.competition.name, country: plan.competition.country, seasonStart: season.year, status: season.year === activeSeason ? (season.events ? 'available' : 'partial') : 'unavailable', playerPages: 0, playerRecords: 0, facts: 0, reason: season.year === activeSeason ? (season.events ? 'API declara cobertura de eventos; se descargan estadísticas de jugadores de la temporada activa.' : 'API no confirma cobertura de eventos para la temporada activa.') : 'Plan de cobertura solamente; no se descargan temporadas históricas en este workflow.' })));
    await writeJson(resolve(outputRoot, artifact('COVERAGE_PLAN.json')), { source: 'api-football', competitions: COMPETITIONS, activeSeason, plans, coverageMatrix, requestsPerformed: requests.length, quotaRemaining: requests.at(-1)?.quotaRemaining ?? null, rawPayloadsStored: false, secretPrinted: false });
    if (planOnly) {
      await writeJson(resolve(outputRoot, artifact('REPORT.json')), { artifactKind: 'block30_api_football_club_goals', status: 'plan_ready', activeSeason, requestsPerformed: requests.length, quotaRemaining: requests.at(-1)?.quotaRemaining ?? null, competitions: COMPETITIONS, coverageMatrix, factsImported: 0, rawPayloadsStored: false, secretPrinted: false });
      return;
    }
    const facts: ClubGoalFact[] = [];
    let stoppedForQuota = false;
    for (const plan of plans) {
      const season = plan.seasons.find((row) => row.year === activeSeason);
      if (!season?.events) continue;
      for (let page = 1; ; page += 1) {
        const remaining = requests.at(-1)?.quotaRemaining;
        if (remaining !== null && remaining !== undefined && remaining <= quotaReserve) { stoppedForQuota = true; break; }
        const result = await request(`/players?league=${plan.competition.id}&season=${activeSeason}&page=${page}`); requests.push(result.evidence);
        const pageRows = array(result.body.response).map(object);
        const matrix = coverageMatrix.find((row) => row.providerId === plan.competition.id && row.seasonStart === activeSeason);
        if (matrix) { matrix.playerPages = page; matrix.playerRecords += pageRows.length; }
        for (const row of pageRows) for (const statistic of array(row.statistics).map(object)) {
          if (Number(object(statistic.league).id) !== plan.competition.id || Number(object(statistic.league).season) !== activeSeason) continue;
          const fact = factFromStats(plan.competition, activeSeason, page, row, statistic, result.rawHash); if (fact) facts.push(fact);
        }
        if (result.evidence.ok === false || pageRows.length === 0 || page >= Number(result.body.paging?.total ?? page)) break;
      }
      const matrix = coverageMatrix.find((row) => row.providerId === plan.competition.id && row.seasonStart === activeSeason);
      if (matrix) { matrix.facts = facts.filter((fact) => fact.competition.providerId === plan.competition.id).length; matrix.status = matrix.playerPages > 0 && !stoppedForQuota ? 'covered' : 'partial'; matrix.reason = matrix.status === 'covered' ? 'Todas las páginas de estadísticas de jugadores de la temporada activa fueron consultadas.' : 'La respuesta fue parcial o la cuota impidió completar las páginas.'; }
      if (stoppedForQuota) break;
    }
    const report = { artifactKind: 'block30_api_football_club_goals', status: stoppedForQuota ? 'partial' : facts.length > 0 ? 'ready_for_lab_load' : 'not_sufficient', activeSeason, requestsPerformed: requests.length, quotaRemaining: requests.at(-1)?.quotaRemaining ?? null, quotaReserve, competitions: COMPETITIONS, coverageMatrix, factsImported: facts.length, playersWithFacts: new Set(facts.map((fact) => fact.canonicalPlayerId)).size, unresolvedFacts: facts.filter((fact) => !fact.canonicalPlayerId).length, excludedMatchTypes: ['friendly', 'youth', 'reserve', 'testimonial', 'national_team'], sourceType: 'primary', rawPayloadsStored: false, secretPrinted: false, officialSnapshotCreated: false };
    await writeJson(resolve(outputRoot, artifact('FACTS.json')), { source: 'api-football', activeSeason, facts });
    await writeJson(resolve(outputRoot, artifact('REPORT.json')), report);
  } catch (error) {
    await writeJson(resolve(outputRoot, artifact('REPORT.json')), { artifactKind: 'block30_api_football_club_goals', status: 'failed', requestsPerformed: requests.length, quotaRemaining: requests.at(-1)?.quotaRemaining ?? null, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown_error', rawPayloadsStored: false, secretPrinted: false });
    process.exitCode = 1;
  }
}
await main();
