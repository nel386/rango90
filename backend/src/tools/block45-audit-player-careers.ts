import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FIVE_MAJOR_LEAGUE_IDS, stableYellowJson } from '../clubYellowCardsCareerRankingEngine.js';

type JsonObject = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown; paging?: JsonObject };
type CareerPlayer = { id: string; name: string; controlName: string };
type TeamSeason = { teamId: number | null; teamName: string; season: number };
type RequestEvidence = {
  endpoint: string;
  kind: 'player_search' | 'career_teams' | 'season_stats';
  status: number;
  responseSha256: string;
  responseComplete: boolean;
  dailyRemaining: number | null;
  dailyLimit: number | null;
  minuteRemaining: number | null;
  minuteLimit: number | null;
};

const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const outputRoot = resolve(process.env.BLOCK45_OUTPUT_ROOT?.trim() || 'audits/block45/career-audit');
const maxRequests = Math.min(80, Math.max(1, Number(process.env.BLOCK45_CAREER_AUDIT_MAX_REQUESTS ?? 50)));
const knownPlayers: CareerPlayer[] = [
  { id: '928', name: 'Dani Parejo', controlName: 'Dani Parejo' },
  { id: '2278', name: 'Marcos Alonso', controlName: 'Marcos Alonso' },
  { id: '146751', name: 'Raúl García', controlName: 'Raúl García (ID 146751)' },
  { id: '47282', name: 'Raúl García', controlName: 'Raúl García (ID 47282)' },
  { id: '738', name: 'Sergio Ramos', controlName: 'Sergio Ramos' },
  { id: '144', name: 'Sergio Busquets', controlName: 'Sergio Busquets' }
];
const controls = ['Alberto Lopo', ...new Set(knownPlayers.map((player) => player.controlName.replace(/ \(ID .*\)$/u, '')))];
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const intHeader = (headers: Headers, name: string): number | null => {
  const parsed = Number(headers.get(name));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim().replace(/\s+/gu, ' ');

async function main(): Promise<void> {
  if (!apiKey) throw new Error('API_FOOTBALL_KEY ausente; no se realizaron peticiones.');
  const requests: RequestEvidence[] = [];
  const lastByPlayer = new Map<string, { teams: TeamSeason[]; seasons: number[]; coverageNotes: string[] }>();
  const seasonResults: Array<Record<string, unknown>> = [];
  let stoppedForRateLimit = false;
  let budgetExhausted = false;
  let perMinuteLimit = 10;
  let lastStartedAt = 0;

  async function get(endpoint: string, kind: RequestEvidence['kind']): Promise<Envelope> {
    if (requests.length >= maxRequests) { budgetExhausted = true; return {}; }
    const intervalMs = Math.max(1000, Math.ceil(60_000 / (Math.max(1, perMinuteLimit) * 0.8)));
    const waitMs = intervalMs - (Date.now() - lastStartedAt);
    if (waitMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, waitMs));
    lastStartedAt = Date.now();
    const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey } });
    const raw = await response.text();
    let body: Envelope = {};
    try { body = object(JSON.parse(raw)) as Envelope; } catch { body = {}; }
    const observedLimit = intHeader(response.headers, 'X-RateLimit-Limit');
    if (observedLimit !== null && observedLimit > 0) perMinuteLimit = Math.min(perMinuteLimit, observedLimit);
    requests.push({
      endpoint,
      kind,
      status: response.status,
      responseSha256: sha256(raw),
      responseComplete: response.status === 200 && Array.isArray(body.response),
      dailyRemaining: intHeader(response.headers, 'x-ratelimit-requests-remaining'),
      dailyLimit: intHeader(response.headers, 'x-ratelimit-requests-limit'),
      minuteRemaining: intHeader(response.headers, 'X-RateLimit-Remaining'),
      minuteLimit: observedLimit
    });
    if (response.status === 429) { stoppedForRateLimit = true; return body; }
    return body;
  }

  // Lopo is not in the completed five-league base; a single season-scoped lookup
  // can resolve the control without widening the audit to a league crawl.
  const lopoSearch = await get('/players?search=Alberto%20Lopo&season=2009', 'player_search');
  const lopoMatches = array(lopoSearch.response).map((row) => object(row)).filter((row) => normalize(String(object(row.player).name ?? '')) === normalize('Alberto Lopo'));
  const players = [...knownPlayers];
  for (const row of lopoMatches) {
    const player = object(row.player);
    const id = String(player.id ?? '');
    if (id && !players.some((known) => known.id === id)) players.push({ id, name: String(player.name ?? 'Alberto Lopo'), controlName: 'Alberto Lopo' });
  }

  for (const player of players) {
    if (stoppedForRateLimit || budgetExhausted) break;
    const body = await get(`/players/teams?player=${encodeURIComponent(player.id)}`, 'career_teams');
    if (requests.at(-1)?.status !== 200 || !Array.isArray(body.response)) continue;
    const teams: TeamSeason[] = [];
    for (const entryValue of body.response) {
      const entry = object(entryValue);
      const team = object(entry.team);
      for (const rawSeason of array(entry.seasons)) {
        const season = Number(rawSeason);
        if (Number.isInteger(season)) teams.push({ teamId: Number.isInteger(Number(team.id)) ? Number(team.id) : null, teamName: String(team.name ?? ''), season });
      }
    }
    const unique = [...new Map(teams.map((row) => [`${row.teamId}|${row.season}`, row])).values()];
    lastByPlayer.set(player.id, { teams: unique, seasons: [...new Set(unique.map((row) => row.season))].sort((a, b) => a - b), coverageNotes: [] });
  }

  const historicalPairs = players.flatMap((player) => (lastByPlayer.get(player.id)?.seasons ?? []).filter((season) => season < 2010).map((season) => ({ player, season })));
  for (const { player, season } of historicalPairs) {
    if (stoppedForRateLimit || budgetExhausted) break;
    const body = await get(`/players?id=${encodeURIComponent(player.id)}&season=${season}`, 'season_stats');
    const evidence = requests.at(-1);
    if (!evidence || evidence.status !== 200 || !Array.isArray(body.response)) {
      seasonResults.push({ playerId: player.id, playerName: player.name, controlName: player.controlName, season, requestStatus: evidence?.status ?? null, statsReturned: false, eligibleCompetitionRows: 0, yellowCardRows: 0, yellowCardsTotal: null, competitions: [] });
      continue;
    }
    const responseRows = body.response.map((row) => object(row));
    const statistics = responseRows.flatMap((row) => array(row.statistics).map((stat) => ({ player: object(row.player), stat: object(stat) })));
    const eligible = statistics.filter(({ stat }) => FIVE_MAJOR_LEAGUE_IDS.includes(Number(object(stat.league).id) as (typeof FIVE_MAJOR_LEAGUE_IDS)[number]));
    const cardRows = eligible.map(({ stat }) => ({
      leagueId: Number(object(stat.league).id),
      league: String(object(stat.league).name ?? ''),
      teamId: Number(object(stat.team).id) || null,
      team: String(object(stat.team).name ?? ''),
      yellowCards: Number(object(stat.cards).yellow)
    })).filter((row) => Number.isFinite(row.yellowCards));
    seasonResults.push({
      playerId: player.id,
      playerName: player.name,
      controlName: player.controlName,
      season,
      requestStatus: evidence.status,
      statsReturned: statistics.length > 0,
      totalCompetitionRows: statistics.length,
      eligibleCompetitionRows: eligible.length,
      yellowCardRows: cardRows.length,
      yellowCardsTotal: cardRows.length ? cardRows.reduce((sum, row) => sum + row.yellowCards, 0) : null,
      competitions: cardRows
    });
  }

  const seasonUnion = [...new Set(players.flatMap((player) => lastByPlayer.get(player.id)?.seasons ?? []))].sort((a, b) => a - b);
  const pre2010Seasons = seasonUnion.filter((season) => season < 2010);
  const dailyValues = requests.map((request) => request.dailyRemaining).filter((value): value is number => value !== null);
  const minuteValues = requests.map((request) => request.minuteRemaining).filter((value): value is number => value !== null);
  const completeHistoricalStatsCheck = !stoppedForRateLimit && !budgetExhausted && historicalPairs.length === seasonResults.length;
  const report = {
    artifactKind: 'block45_player_career_seasons_audit',
    generatedAt: new Date().toISOString(),
    commitSha: process.env.GITHUB_SHA ?? process.env.BLOCK45_COMMIT_SHA ?? null,
    workflowName: process.env.GITHUB_WORKFLOW ?? 'BLOQUE 45 · auditoría de temporadas de carrera',
    endpointContract: {
      careerTeams: '/players/teams?player={id}',
      seasonStats: '/players?id={id}&season={year}',
      officialContract: 'players/teams identifica equipos y temporadas; las estadísticas de temporada se obtienen por separado desde players.'
    },
    scope: { controls, knownPlayerIds: knownPlayers.map(({ id, name, controlName }) => ({ id, name, controlName })), lopoExactSearchMatches: lopoMatches.map((row) => ({ id: String(object(row.player).id), name: String(object(row.player).name) })), maxRequests },
    players: players.map((player) => ({ ...player, teamsAndSeasons: lastByPlayer.get(player.id)?.teams ?? [], seasons: lastByPlayer.get(player.id)?.seasons ?? [], pre2010Seasons: (lastByPlayer.get(player.id)?.seasons ?? []).filter((season) => season < 2010) })),
    statsSample: seasonResults,
    seasonCoverage: { discoveredSeasons: seasonUnion, pre2010Seasons, historicalPairs: historicalPairs.length, historicalPairsChecked: seasonResults.length, completeHistoricalStatsCheck, stoppedForRateLimit, budgetExhausted },
    quota: {
      requestAttempts: requests.length,
      dailyRemaining: { initial: dailyValues[0] ?? null, final: dailyValues.at(-1) ?? null, observedDecrease: dailyValues.length > 1 ? dailyValues[0]! - dailyValues.at(-1)! : null, headerValuesObserved: dailyValues.length },
      perMinute: { initial: minuteValues[0] ?? null, final: minuteValues.at(-1) ?? null, limit: requests.find((request) => request.minuteLimit !== null)?.minuteLimit ?? null, headerValuesObserved: minuteValues.length, note: 'Ventana móvil, no representa consumo acumulado.' },
      dailyHeaderVersusAttemptsDifference: dailyValues.length > 1 ? requests.length - (dailyValues[0]! - dailyValues.at(-1)!) : null,
      dailyDiscrepancyNote: 'La diferencia entre intentos observados y variación de la cabecera diaria queda registrada; no se atribuye a consumo de esta auditoría sin evidencia del proveedor.'
    },
    requests,
    rawPayloadsStored: false,
    secretPrinted: false,
    loadExecuted: false,
    snapshotsCreated: 0
  };
  await mkdir(outputRoot, { recursive: true });
  await writeFile(resolve(outputRoot, 'BLOCK45_CAREER_AUDIT.json'), stableYellowJson(report), 'utf8');
}

await main();
