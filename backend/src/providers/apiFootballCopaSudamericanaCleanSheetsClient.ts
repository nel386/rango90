import { createHash } from 'node:crypto';
import { config } from '../config.js';
import type { RankingInput } from '../imports/rankingInput.js';

/** API-Football v3's stable competition identifier for Copa Sudamericana. */
export const apiFootballCopaSudamericanaLeagueId = 11;
export const apiFootballCopaSudamericanaPlayersUrl = 'https://v3.football.api-sports.io/players';
export const apiFootballCopaSudamericanaLeaguesUrl = 'https://v3.football.api-sports.io/leagues';
export const apiFootballCopaSudamericanaDocumentationUrl = 'https://www.api-football.com/documentation-v3#tag/Players/operation/get-players';
export const apiFootballCopaSudamericanaHistoricalStartYear = 2002;

type JsonRecord = Record<string, unknown>;

export type ApiFootballCopaSudamericanaSeason = {
  year: number;
  playersCoverage: boolean | null;
};

export type ApiFootballCopaSudamericanaCleanSheetRow = {
  playerId: number;
  name: string;
  teamId: number;
  seasonYear: number;
  cleanSheets: number;
  fieldPath: string;
};

export type ApiFootballCopaSudamericanaCleanSheetPage = {
  currentPage: number;
  totalPages: number;
  rows: ApiFootballCopaSudamericanaCleanSheetRow[];
  /** True only when the response contains an explicit clean-sheet field. */
  explicitCleanSheetsFieldObserved: boolean;
  goalkeeperStatisticsInspected: number;
};

export type ApiFootballCopaSudamericanaOptions = {
  apiKey?: string;
  baseUrl?: string;
  startYear?: number;
  endYear?: number;
  /** Only intended for deterministic tests and local provider probes. */
  httpFetch?: typeof fetch;
};

type ApiFootballPayload = {
  response?: unknown[];
  errors?: unknown;
  paging?: unknown;
};

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nonNegativeInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value)
      : NaN;
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`API-Football Copa Sudamericana: ${field} inválido (${String(value)})`);
  }
  return parsed;
}

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('en-US');
}

function hasApiErrors(errors: unknown): boolean {
  if (Array.isArray(errors)) return errors.length > 0;
  if (errors && typeof errors === 'object') return Object.keys(errors).length > 0;
  return Boolean(errors);
}

function payloadBody(payload: unknown, endpoint: string): ApiFootballPayload {
  const body = object(payload) as ApiFootballPayload | null;
  if (!body) throw new Error(`API-Football Copa Sudamericana: respuesta inválida en ${endpoint}`);
  if (hasApiErrors(body.errors)) {
    throw new Error(`API-Football Copa Sudamericana ${endpoint}: ${JSON.stringify(body.errors)}`);
  }
  return body;
}

function responseArray(body: ApiFootballPayload, endpoint: string): unknown[] {
  if (!Array.isArray(body.response)) throw new Error(`API-Football Copa Sudamericana: response no es un array en ${endpoint}`);
  return body.response;
}

function pageInfo(body: ApiFootballPayload, endpoint: string): { currentPage: number; totalPages: number } {
  const paging = object(body.paging);
  if (!paging) throw new Error(`API-Football Copa Sudamericana: paginación ausente en ${endpoint}`);
  const currentPage = nonNegativeInteger(paging.current, 'paging.current');
  const totalPages = nonNegativeInteger(paging.total, 'paging.total');
  if (currentPage === null || totalPages === null || currentPage < 1 || totalPages < 0 || totalPages > 1_000 || currentPage > Math.max(totalPages, 1)) {
    throw new Error(`API-Football Copa Sudamericana: paginación inválida en ${endpoint}`);
  }
  return { currentPage, totalPages };
}

/**
 * Reads only the league metadata returned by API-Football. A season whose
 * player coverage is explicitly false is treated as unavailable, not as a
 * season full of zeroes.
 */
export function parseApiFootballCopaSudamericanaSeasons(
  payload: unknown,
  startYear = apiFootballCopaSudamericanaHistoricalStartYear,
  endYear = new Date().getUTCFullYear() - 1
): { seasons: ApiFootballCopaSudamericanaSeason[]; missingYears: number[] } {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 2002 || endYear < startYear) {
    throw new Error(`API-Football Copa Sudamericana: intervalo de temporadas inválido (${startYear}-${endYear})`);
  }
  const body = payloadBody(payload, 'leagues');
  const candidates = responseArray(body, 'leagues').filter((raw) => {
    const row = object(raw);
    const league = object(row?.league);
    const id = nonNegativeInteger(league?.id, 'league.id');
    const name = normalized(text(league?.name) ?? '');
    return id === apiFootballCopaSudamericanaLeagueId && name.includes('copa sudamericana');
  });
  if (candidates.length !== 1) {
    throw new Error(`API-Football Copa Sudamericana: se esperaba una competición, llegaron ${candidates.length}`);
  }

  const competition = object(candidates[0]);
  const rawSeasons = competition && Array.isArray(competition.seasons) ? competition.seasons : null;
  if (!rawSeasons) throw new Error('API-Football Copa Sudamericana: competición sin temporadas');

  const byYear = new Map<number, ApiFootballCopaSudamericanaSeason>();
  for (const rawSeason of rawSeasons) {
    const season = object(rawSeason);
    const year = nonNegativeInteger(season?.year, 'season.year');
    if (year === null || year < startYear || year > endYear) continue;
    const coverage = object(season?.coverage);
    const playersCoverage = coverage && typeof coverage.players === 'boolean' ? coverage.players : null;
    if (playersCoverage === false) continue;
    const current = byYear.get(year);
    if (current && current.playersCoverage !== playersCoverage) {
      throw new Error(`API-Football Copa Sudamericana: cobertura de jugadores contradictoria en ${year}`);
    }
    byYear.set(year, { year, playersCoverage });
  }

  const seasons = [...byYear.values()].sort((left, right) => left.year - right.year);
  if (seasons.length === 0) throw new Error('API-Football Copa Sudamericana: no hay temporadas de jugadores disponibles');
  const missingYears = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index)
    .filter((year) => !byYear.has(year));
  return { seasons, missingYears };
}

function playerName(player: JsonRecord): string | null {
  const direct = text(player.name);
  if (direct) return direct;
  const first = text(player.firstname);
  const last = text(player.lastname);
  return first || last ? [first, last].filter(Boolean).join(' ') : null;
}

function isGoalkeeper(position: unknown): boolean {
  const value = normalized(text(position) ?? '');
  return value === 'goalkeeper' || value === 'gk' || value === 'g';
}

type ExplicitCleanSheets = { present: boolean; value: number | null; fieldPath: string | null };

/**
 * API-Football's documented player-statistics shape currently exposes
 * `goals.conceded` and `goals.saves`, not clean sheets. Those fields are
 * deliberately excluded here: they cannot be converted into goalkeeper
 * clean sheets without match-level attribution.
 *
 * The two explicit spellings below are accepted only to keep this provider
 * usable if API-Football adds the metric in a future response. Conflicting
 * explicit fields are rejected rather than guessed.
 */
function explicitCleanSheets(statistic: JsonRecord): ExplicitCleanSheets {
  const candidates: Array<{ path: string; value: unknown }> = [
    { path: 'clean_sheets', value: statistic.clean_sheets },
    { path: 'cleanSheets', value: statistic.cleanSheets }
  ].filter(({ path }) => Object.prototype.hasOwnProperty.call(statistic, path));
  if (candidates.length === 0) return { present: false, value: null, fieldPath: null };
  const parsed = candidates.map(({ path, value }) => ({ path, value: nonNegativeInteger(value, path) }));
  const first = parsed[0]!;
  if (parsed.some((candidate) => candidate.value !== first.value)) {
    throw new Error('API-Football Copa Sudamericana: campos explícitos de porterías a cero contradictorios');
  }
  return { present: true, value: first.value, fieldPath: first.path };
}

/**
 * Parses one API-Football `/players` page. A missing clean-sheet field is a
 * capability signal, not a zero. Only goalkeeper statistics with an explicit
 * non-null metric become rows.
 */
export function parseApiFootballCopaSudamericanaCleanSheetPage(
  payload: unknown,
  seasonYear: number
): ApiFootballCopaSudamericanaCleanSheetPage {
  if (!Number.isInteger(seasonYear) || seasonYear < 2002) throw new Error(`API-Football Copa Sudamericana: temporada inválida (${seasonYear})`);
  const body = payloadBody(payload, 'players');
  const players = responseArray(body, 'players');
  const { currentPage, totalPages } = pageInfo(body, 'players');
  const rows: ApiFootballCopaSudamericanaCleanSheetRow[] = [];
  const seenPlayerTeams = new Set<string>();
  let explicitCleanSheetsFieldObserved = false;
  let goalkeeperStatisticsInspected = 0;

  for (const rawPlayer of players) {
    const player = object(rawPlayer);
    if (!player) throw new Error('API-Football Copa Sudamericana: fila de jugador inválida');
    const profile = object(player.player);
    const playerId = nonNegativeInteger(profile?.id, 'player.id');
    const name = profile ? playerName(profile) : null;
    if (playerId === null || playerId < 1 || !name) throw new Error('API-Football Copa Sudamericana: jugador sin identidad');
    if (!Array.isArray(player.statistics)) throw new Error(`API-Football Copa Sudamericana: estadísticas ausentes para ${playerId}`);

    for (const rawStatistic of player.statistics) {
      const statistic = object(rawStatistic);
      if (!statistic) throw new Error(`API-Football Copa Sudamericana: estadística inválida para ${playerId}`);
      const league = object(statistic.league);
      const leagueId = nonNegativeInteger(league?.id, 'league.id');
      const statisticSeason = nonNegativeInteger(league?.season, 'league.season');
      if (leagueId !== apiFootballCopaSudamericanaLeagueId || statisticSeason !== null && statisticSeason !== seasonYear) {
        throw new Error(`API-Football Copa Sudamericana: estadística fuera de competición/temporada para ${playerId}`);
      }
      const games = object(statistic.games);
      if (!isGoalkeeper(games?.position)) continue;
      goalkeeperStatisticsInspected += 1;
      const explicit = explicitCleanSheets(statistic);
      if (!explicit.present) continue;
      explicitCleanSheetsFieldObserved = true;
      if (explicit.value === null || explicit.value === 0) continue;

      const team = object(statistic.team);
      const teamId = nonNegativeInteger(team?.id, 'team.id');
      if (teamId === null || teamId < 1) throw new Error(`API-Football Copa Sudamericana: portero ${playerId} sin equipo estable`);
      const pair = `${playerId}:${teamId}`;
      if (seenPlayerTeams.has(pair)) throw new Error(`API-Football Copa Sudamericana: pareja jugador/equipo duplicada ${pair}`);
      seenPlayerTeams.add(pair);
      rows.push({ playerId, name, teamId, seasonYear, cleanSheets: explicit.value, fieldPath: explicit.fieldPath! });
    }
  }
  return { currentPage, totalPages, rows, explicitCleanSheetsFieldObserved, goalkeeperStatisticsInspected };
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string | number>): URL {
  const url = new URL(`${baseUrl.replace(/\/$/u, '')}/${path.replace(/^\//u, '')}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url;
}

async function requestJson(url: URL, apiKey: string, fetcher: typeof fetch): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json', 'x-apisports-key': apiKey },
      signal: AbortSignal.timeout(config.apiFootballTimeoutMs)
    });
    if (response.ok) return response.json() as Promise<unknown>;
    const body = (await response.text()).replace(/\s+/gu, ' ').trim().slice(0, 240);
    lastError = new Error(`API-Football Copa Sudamericana ${response.status}${body ? `: ${body}` : ''}`);
    if (response.status !== 429 && response.status < 500) throw lastError;
    if (attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 1_000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 30_000)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('API-Football Copa Sudamericana: petición fallida');
}

async function fetchSeasonRows(
  season: ApiFootballCopaSudamericanaSeason,
  baseUrl: string,
  apiKey: string,
  fetcher: typeof fetch
): Promise<{ season: ApiFootballCopaSudamericanaSeason; rows: ApiFootballCopaSudamericanaCleanSheetRow[]; explicitCleanSheetsFieldObserved: boolean; dataAvailable: boolean }> {
  const rows: ApiFootballCopaSudamericanaCleanSheetRow[] = [];
  const seenPlayerTeams = new Set<string>();
  let page = 1;
  let totalPages = 1;
  let explicitCleanSheetsFieldObserved = false;
  let dataAvailable = false;
  do {
    const payload = await requestJson(buildUrl(baseUrl, '/players', { league: apiFootballCopaSudamericanaLeagueId, season: season.year, page }), apiKey, fetcher);
    const parsed = parseApiFootballCopaSudamericanaCleanSheetPage(payload, season.year);
    if (parsed.currentPage !== page) throw new Error(`API-Football Copa Sudamericana: página esperada ${page}, recibida ${parsed.currentPage}`);
    totalPages = parsed.totalPages;
    dataAvailable ||= parsed.goalkeeperStatisticsInspected > 0 || (Array.isArray((payload as JsonRecord | null)?.response) && ((payload as JsonRecord).response as unknown[]).length > 0);
    explicitCleanSheetsFieldObserved ||= parsed.explicitCleanSheetsFieldObserved;
    for (const row of parsed.rows) {
      const pair = `${row.playerId}:${row.teamId}`;
      if (seenPlayerTeams.has(pair)) throw new Error(`API-Football Copa Sudamericana: jugador/equipo duplicado entre páginas ${pair}`);
      seenPlayerTeams.add(pair);
      rows.push(row);
    }
    page += 1;
  } while (page <= totalPages);
  return { season, rows, explicitCleanSheetsFieldObserved, dataAvailable };
}

type AggregatedRow = {
  playerId: number;
  name: string;
  cleanSheets: number;
  seasons: Array<{ year: number; cleanSheets: number; teamId: number; fieldPath: string }>;
};

function aggregate(rowsBySeason: Array<{ season: ApiFootballCopaSudamericanaSeason; rows: ApiFootballCopaSudamericanaCleanSheetRow[] }>): AggregatedRow[] {
  const totals = new Map<number, AggregatedRow>();
  for (const { season, rows } of rowsBySeason) {
    for (const row of rows) {
      if (row.seasonYear !== season.year) throw new Error(`API-Football Copa Sudamericana: fila fuera de temporada ${season.year}`);
      const current = totals.get(row.playerId);
      if (current) {
        current.cleanSheets += row.cleanSheets;
        current.seasons.push({ year: season.year, cleanSheets: row.cleanSheets, teamId: row.teamId, fieldPath: row.fieldPath });
      } else {
        totals.set(row.playerId, {
          playerId: row.playerId,
          name: row.name,
          cleanSheets: row.cleanSheets,
          seasons: [{ year: season.year, cleanSheets: row.cleanSheets, teamId: row.teamId, fieldPath: row.fieldPath }]
        });
      }
    }
  }
  return [...totals.values()].sort((left, right) => right.cleanSheets - left.cleanSheets || left.name.localeCompare(right.name, 'es'));
}

/**
 * Builds a draft ranking only when the API has supplied an explicit
 * goalkeeper clean-sheet metric. With today's documented API-Football player
 * statistics this function rejects honestly, because `goals.conceded` and
 * `goals.saves` are not clean sheets.
 */
export async function fetchApiFootballCopaSudamericanaCleanSheets(
  options: ApiFootballCopaSudamericanaOptions = {}
): Promise<RankingInput> {
  const apiKey = options.apiKey ?? config.apiFootballKey;
  if (!apiKey?.trim()) throw new Error('API-Football Copa Sudamericana: falta API_FOOTBALL_KEY');
  const baseUrl = options.baseUrl ?? config.apiFootballBaseUrl;
  const fetcher = options.httpFetch ?? fetch;
  const startYear = options.startYear ?? apiFootballCopaSudamericanaHistoricalStartYear;
  const endYear = options.endYear ?? new Date().getUTCFullYear() - 1;
  const leaguePayload = await requestJson(
    buildUrl(baseUrl, '/leagues', { id: apiFootballCopaSudamericanaLeagueId }),
    apiKey,
    fetcher
  );
  const selection = parseApiFootballCopaSudamericanaSeasons(leaguePayload, startYear, endYear);

  // Probe the newest available season completely first. This avoids spending
  // the quota over every historical season when the API has no such field at
  // all, while still checking every player page in the probe season.
  const newest = selection.seasons[selection.seasons.length - 1]!;
  const newestResult = await fetchSeasonRows(newest, baseUrl, apiKey, fetcher);
  if (!newestResult.explicitCleanSheetsFieldObserved) {
    throw new Error(
      'API-Football Copa Sudamericana: la respuesta de /players no expone un campo explícito de porterías a cero para porteros; ' +
      'no se usarán goals.conceded, goals.saves ni ceros imputados'
    );
  }

  const seasonResults = new Map<number, Awaited<ReturnType<typeof fetchSeasonRows>>>();
  seasonResults.set(newest.year, newestResult);
  for (const season of selection.seasons) {
    if (season.year === newest.year) continue;
    seasonResults.set(season.year, await fetchSeasonRows(season, baseUrl, apiKey, fetcher));
  }
  const orderedResults = selection.seasons.map((season) => seasonResults.get(season.year)!);
  const aggregateRows = aggregate(orderedResults);
  if (aggregateRows.length === 0) {
    throw new Error('API-Football Copa Sudamericana: el campo explícito existe, pero no hay porterías a cero positivas');
  }

  const seasonsWithoutData = orderedResults.filter((result) => !result.dataAvailable).map((result) => result.season.year);
  const missingYears = [...new Set([...selection.missingYears, ...seasonsWithoutData])].sort((left, right) => left - right);
  const coverageComplete = missingYears.length === 0 && aggregateRows.length >= 200;
  const top = aggregateRows.slice(0, 200);
  const partialReasons: string[] = [];
  if (missingYears.length > 0) partialReasons.push(`faltan temporadas o cobertura de jugadores: ${missingYears.join(', ')}`);
  if (aggregateRows.length < 200) partialReasons.push(`solo hay ${aggregateRows.length} porteros con un valor positivo explícito, no 200`);
  const sourceUrl = apiFootballCopaSudamericanaPlayersUrl;

  return {
    categorySlug: 'copa-sudamericana-clean_sheets',
    source: {
      key: 'api-football-copa-sudamericana-clean-sheets',
      name: 'API-Football — Copa Sudamericana goalkeeper clean sheets (explicit player field only)',
      sourceType: 'api',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `api-football-copa-sudamericana-clean-sheets-${startYear}-${endYear}-${createHash('sha256').update(JSON.stringify(top)).digest('hex').slice(0, 16)}`,
    coverageComplete,
    allowPartialDraft: !coverageComplete,
    partialDraftReason: !coverageComplete
      ? `Cobertura parcial: ${partialReasons.join('; ')}.`
      : undefined,
    reviewed: false,
    entries: top.map((row, index) => ({
      entityId: `api-football:player:${row.playerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.cleanSheets,
      evidence: {
        sourceRank: index + 1,
        providerPlayerId: row.playerId,
        sourceUrl,
        seasons: row.seasons,
        scope: `Porterías a cero explícitas del portero en la Copa Sudamericana masculina, agregadas por ID estable API-Football (${startYear}-${endYear}); no se derivan de goles encajados, paradas ni estadísticas del equipo`,
        sourceCoverage: selection.seasons.map((season) => season.year),
        missingHistoricalSeasons: missingYears
      }
    }))
  };
}
