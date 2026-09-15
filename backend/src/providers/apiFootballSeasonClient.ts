import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ApiFootballClient } from './apiFootballClient.js';

type ApiFootballPlayer = {
  id?: number;
  name?: string;
  firstname?: string;
  lastname?: string;
  age?: number;
  nationality?: string;
  height?: string;
  weight?: string;
  photo?: string;
  birth?: { date?: string; place?: string; country?: string };
};

type ApiFootballStatistic = {
  team?: { id?: number; name?: string; logo?: string };
  league?: { id?: number; name?: string; country?: string; season?: number };
  games?: { appearences?: number | null; minutes?: number | null; position?: string | null };
  goals?: { total?: number | null; conceded?: number | null; assists?: number | null; saves?: number | null };
  cards?: { yellow?: number | null; red?: number | null };
};

export type ApiFootballRow = { player?: ApiFootballPlayer; statistics?: ApiFootballStatistic[] };
export type ApiFootballPayload = { response?: ApiFootballRow[]; errors?: unknown; paging?: unknown };

export type ApiFootballSeasonCacheOptions = {
  /** Directory supplied by the operator; never contains credentials. */
  cacheDir?: string;
  /** Reuse only page files that pass the paging and payload checks. */
  resume?: boolean;
};

export type ApiFootballSeasonCacheStats = {
  resumed: boolean;
  pagesReused: number;
  pagesDownloaded: number;
  totalPages: number;
};

export type SeasonPlayerStat = {
  player: ApiFootballPlayer & { id: number; name: string };
  statistic: ApiFootballStatistic & {
    team: NonNullable<ApiFootballStatistic['team']>;
    league: NonNullable<ApiFootballStatistic['league']>;
  };
  observedFrom: string[];
};

export type ApiFootballSeasonResult = {
  leagueId: number;
  seasonYear: number;
  sourceUrl: string;
  retrievedAt: string;
  endpoints: Record<string, ApiFootballPayload>;
  rows: SeasonPlayerStat[];
  validationAnomalies: Array<{ endpoint: string; playerId: number; reason: string }>;
  cache?: ApiFootballSeasonCacheStats;
};

export async function fetchApiFootballPremierLeagueSeason(seasonYear: number): Promise<ApiFootballSeasonResult> {
  const client = new ApiFootballClient();
  const endpoints: Record<string, ApiFootballPayload> = {};
  for (const endpoint of ['topscorers', 'topassists']) {
    const payload = await client.request<ApiFootballPayload>(`/players/${endpoint}`, { league: 39, season: seasonYear });
    if (hasApiErrors(payload.errors)) throw new Error(`API-Football ${endpoint}: ${JSON.stringify(payload.errors)}`);
    endpoints[endpoint] = payload;
  }

  const merged = mergeApiFootballSeasonRows(endpoints, seasonYear, 39);
  return {
    leagueId: 39,
    seasonYear,
    sourceUrl: 'https://v3.football.api-sports.io/players',
    retrievedAt: new Date().toISOString(),
    endpoints,
    rows: merged.rows,
    validationAnomalies: merged.validationAnomalies
  };
}

export async function fetchApiFootballPremierLeagueCompleteSeason(
  seasonYear: number,
  options: ApiFootballSeasonCacheOptions = {}
): Promise<ApiFootballSeasonResult> {
  return fetchApiFootballLeagueCompleteSeason(39, seasonYear, options);
}

export async function fetchApiFootballLeagueCompleteSeason(
  leagueId: number,
  seasonYear: number,
  options: ApiFootballSeasonCacheOptions = {}
): Promise<ApiFootballSeasonResult> {
  const client = new ApiFootballClient();
  const endpoints: Record<string, ApiFootballPayload> = {};
  const cacheDirectory = options.cacheDir === undefined
    ? undefined
    : apiFootballSeasonCacheDirectory(options.cacheDir, leagueId, seasonYear);
  const resume = Boolean(options.resume);
  if (resume && !cacheDirectory) throw new Error('API-Football: --resume requiere --cache-dir');
  if (cacheDirectory) await mkdir(cacheDirectory, { recursive: true, mode: 0o700 });

  let pagesReused = 0;
  let pagesDownloaded = 0;
  const fetchPage = async (page: number, expectedTotal: number | undefined, allowEmpty: boolean): Promise<ApiFootballPayload> => {
    if (resume && cacheDirectory) {
      const cached = await readApiFootballSeasonPageCache(options.cacheDir!, leagueId, seasonYear, page, expectedTotal, allowEmpty);
      if (cached) {
        pagesReused += 1;
        return cached;
      }
    }
    if (page > 1) await waitForApiRateLimit();
    const payload = await client.request<ApiFootballPayload>('/players', { league: leagueId, season: seasonYear, page });
    if (hasApiErrors(payload.errors)) throw new Error(`API-Football players página ${page}: ${JSON.stringify(payload.errors)}`);
    const validated = validateApiFootballSeasonPage(payload, page, expectedTotal, allowEmpty);
    if (cacheDirectory) await writeApiFootballSeasonPageCache(options.cacheDir!, leagueId, seasonYear, page, validated);
    pagesDownloaded += 1;
    return validated;
  };

  const first = await fetchPage(1, undefined, true);
  // An empty first page is a valid, useful result for a season that the
  // provider does not cover. Keep the payload so the limitation can be
  // archived instead of turning a real "no data" response into an importer
  // failure. Any later page must still contain rows.
  const totalPages = validatePaging(first, 1, undefined, true);
  endpoints.playersPage1 = first;
  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await fetchPage(page, totalPages, false);
    endpoints[`playersPage${page}`] = payload;
  }
  const merged = mergeApiFootballSeasonRows(endpoints, seasonYear, leagueId);
  const rows = merged.rows;
  const sourceRowCount = Object.values(endpoints).reduce((sum, payload) => sum + (payload.response?.length ?? 0), 0);
  // A player can have one statistic row per team in the same season, so the
  // normalized player/team rows may legitimately exceed the source player
  // rows. The merge itself validates every team/league/statistic record.
  // Zero rows is an accepted source outcome when the provider explicitly
  // returns an empty first page. Non-empty payloads that normalize to zero
  // rows remain invalid and must not be archived as a successful import.
  if (sourceRowCount > 0 && rows.length === 0) {
    throw new Error(`API-Football: cobertura de jugadores inválida ${sourceRowCount}/${rows.length}`);
  }
  if (sourceRowCount === 0) {
    merged.validationAnomalies.push({ endpoint: 'playersPage1', playerId: 0, reason: 'empty_season_response' });
  }
  return {
    leagueId,
    seasonYear,
    sourceUrl: 'https://v3.football.api-sports.io/players',
    retrievedAt: new Date().toISOString(),
    endpoints,
    rows,
    validationAnomalies: merged.validationAnomalies,
    ...(cacheDirectory ? { cache: { resumed: resume, pagesReused, pagesDownloaded, totalPages } } : {})
  };
}

/**
 * Returns the cache directory for one competition/season. The path contains
 * only validated numeric identifiers and never an API key or request data.
 */
export function apiFootballSeasonCacheDirectory(cacheDir: string, leagueId: number, seasonYear: number): string {
  if (!cacheDir.trim()) throw new Error('API-Football: --cache-dir no puede estar vacío');
  if (!Number.isInteger(leagueId) || leagueId < 1 || leagueId > 10_000) throw new Error('API-Football: leagueId inválido para caché');
  if (!Number.isInteger(seasonYear) || seasonYear < 1900 || seasonYear > 2100) throw new Error('API-Football: seasonYear inválido para caché');
  return resolve(cacheDir, `league-${leagueId}`, `season-${seasonYear}`);
}

function apiFootballSeasonCachePagePath(cacheDirectory: string, page: number): string {
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw new Error('API-Football: página inválida para caché');
  return resolve(cacheDirectory, `page-${String(page).padStart(6, '0')}.json`);
}

/** Parses and validates a cached payload using the same paging contract as a network response. */
export function parseApiFootballSeasonPageCache(raw: string, expectedPage: number, expectedTotal?: number, allowEmpty = false): ApiFootballPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('API-Football: caché JSON inválida');
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { response?: unknown }).response)) {
    throw new Error('API-Football: caché sin respuesta de jugadores');
  }
  const payload = parsed as ApiFootballPayload;
  if (hasApiErrors(payload.errors)) throw new Error('API-Football: caché contiene errores del proveedor');
  return validateApiFootballSeasonPage(payload, expectedPage, expectedTotal, allowEmpty);
}

function validateApiFootballSeasonPage(
  payload: ApiFootballPayload,
  expectedPage: number,
  expectedTotal: number | undefined,
  allowEmpty: boolean
): ApiFootballPayload {
  if (!Array.isArray(payload.response)) throw new Error('API-Football: respuesta de jugadores inválida');
  validatePaging(payload, expectedPage, expectedTotal, allowEmpty);
  return payload;
}

export async function readApiFootballSeasonPageCache(
  cacheDir: string,
  leagueId: number,
  seasonYear: number,
  page: number,
  expectedTotal: number | undefined,
  allowEmpty: boolean
): Promise<ApiFootballPayload | null> {
  const seasonDirectory = apiFootballSeasonCacheDirectory(cacheDir, leagueId, seasonYear);
  try {
    const raw = await readFile(apiFootballSeasonCachePagePath(seasonDirectory, page), 'utf8');
    try {
      return parseApiFootballSeasonPageCache(raw, page, expectedTotal, allowEmpty);
    } catch {
      return null;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeApiFootballSeasonPageCache(
  cacheDir: string,
  leagueId: number,
  seasonYear: number,
  page: number,
  payload: ApiFootballPayload
): Promise<void> {
  const seasonDirectory = apiFootballSeasonCacheDirectory(cacheDir, leagueId, seasonYear);
  await mkdir(seasonDirectory, { recursive: true, mode: 0o700 });
  const targetPath = apiFootballSeasonCachePagePath(seasonDirectory, page);
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, JSON.stringify(payload), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await rename(temporaryPath, targetPath);
  } finally {
    try {
      await unlink(temporaryPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

/** Removes only page-cache files belonging to the requested season. */
export async function cleanupApiFootballSeasonCache(cacheDir: string, leagueId: number, seasonYear: number): Promise<void> {
  const seasonDirectory = apiFootballSeasonCacheDirectory(cacheDir, leagueId, seasonYear);
  let entries;
  try {
    entries = await readdir(seasonDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const pageFile = /^page-\d{6}\.json(?:\.tmp-[^/]+)?$/u;
  for (const entry of entries) {
    if (entry.isFile() && pageFile.test(entry.name)) await unlink(resolve(seasonDirectory, entry.name));
  }
}

export function mergeApiFootballSeasonRows(endpoints: Record<string, ApiFootballPayload>, seasonYear: number, leagueId: number): { rows: SeasonPlayerStat[]; validationAnomalies: Array<{ endpoint: string; playerId: number; reason: string }> } {
  const merged = new Map<string, SeasonPlayerStat>();
  const seenSourceKeys = new Set<string>();
  const validationAnomalies: Array<{ endpoint: string; playerId: number; reason: string }> = [];
  for (const [endpoint, payload] of Object.entries(endpoints)) {
    for (const row of payload.response ?? []) {
      const player = row.player;
      if (!player?.id || !Number.isInteger(player.id) || player.id < 1 || !player.name) {
        throw new Error(`API-Football ${endpoint}: jugador incompleto`);
      }
      if (!row.statistics || row.statistics.length === 0) {
        validationAnomalies.push({ endpoint, playerId: player.id, reason: 'missing_statistics_block' });
        continue;
      }
      for (const statistic of row.statistics) {
        const legacyNullLeagueId = statistic.league?.id == null && isKnownLeagueNameForId(statistic.league?.name, leagueId);
        if (legacyNullLeagueId) {
          validationAnomalies.push({ endpoint, playerId: player.id, reason: 'legacy_null_league_id_verified_by_name' });
        }
        const leagueMatches = statistic.league?.id === leagueId || legacyNullLeagueId;
        if (!statistic.league || !leagueMatches || statistic.league.season !== undefined && statistic.league.season !== seasonYear) {
          if (isZeroOrphanStatistic(statistic, leagueId, seasonYear)) {
            validationAnomalies.push({ endpoint, playerId: player.id, reason: 'orphan_zero_statistic_without_team' });
            continue;
          }
          throw new Error(`API-Football ${endpoint}: equipo, liga o temporada inválidos para ${player.id}`);
        }
        if (!statistic.team?.id) {
          if (hasNoRankingMetrics(statistic)) {
            validationAnomalies.push({ endpoint, playerId: player.id, reason: 'active_statistic_without_team_and_zero_ranking_metrics' });
            continue;
          }
          // Some old historical rows have positive cards/goals but no team
          // identifier. Preserve those metrics under the reserved team key
          // 0 rather than silently dropping them; the importer stores the
          // row with team_entity_id NULL and keeps the anomaly in the archive.
          validationAnomalies.push({ endpoint, playerId: player.id, reason: 'active_statistic_without_team_preserved_with_reserved_team_id' });
        }
        const key = `${player.id}:${statistic.team?.id ?? 0}`;
        const sourceKey = `${endpoint}:${key}`;
        if (seenSourceKeys.has(sourceKey)) {
          // The complete-season endpoint has occasionally repeated the same
          // player/team row inside one paginated response. It is not a second
          // appearance: merge the partial fields and preserve an explicit
          // anomaly instead of double-counting or aborting the season.
          const existing = merged.get(key);
          if (!existing) throw new Error(`API-Football ${endpoint}: duplicado sin fila acumulada ${key}`);
          existing.statistic = mergeStatistic(existing.statistic, statistic) as SeasonPlayerStat['statistic'];
          existing.observedFrom.push(endpoint);
          validationAnomalies.push({ endpoint, playerId: player.id, reason: 'duplicate_player_team_statistic_merged' });
          continue;
        }
        seenSourceKeys.add(sourceKey);
        const current = merged.get(key);
        if (current) {
          current.statistic = mergeStatistic(current.statistic, statistic) as SeasonPlayerStat['statistic'];
          current.observedFrom.push(endpoint);
        } else {
          merged.set(key, {
            player: player as SeasonPlayerStat['player'],
            statistic: statistic as SeasonPlayerStat['statistic'],
            observedFrom: [endpoint]
          });
        }
      }
    }
  }
  return { rows: [...merged.values()], validationAnomalies };
}

function isKnownLeagueNameForId(name: string | undefined, leagueId: number): boolean {
  if (!name) return false;
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('en-US');
  const expectedFragments: Record<number, string[]> = {
    1: ['world cup'],
    2: ['champions league', 'european cup'],
    4: ['uefa european championship', 'european championship', 'euro'],
    // API-Football legacy UEFA Cup rows can expose league.id as null while
    // retaining the historical competition name. Accept that exact normalized
    // fragment for league 3 only; other league validations remain unchanged.
    3: ['europa league', 'uefa cup'],
    9: ['copa america'],
    11: ['sudamericana'],
    13: ['libertadores'],
    15: ['club world cup', 'fifa club world cup'],
    5: ['nations league'],
    39: ['premier league'],
    61: ['ligue 1', 'ligue one'],
    78: ['bundesliga'],
    94: ['primeira liga'],
    135: ['serie a'],
    140: ['la liga', 'laliga', 'primera división', 'primera division', 'primera divisi']
  };
  return (expectedFragments[leagueId] ?? []).some((fragment) => normalized.includes(fragment));
}

function isZeroOrphanStatistic(statistic: ApiFootballStatistic, leagueId: number, seasonYear: number): boolean {
  const zeroOrNull = (value: number | null | undefined): boolean => value === null || value === undefined || value === 0;
  return !statistic.team?.id
    && statistic.league?.id === leagueId
    && statistic.league.season === seasonYear
    && zeroOrNull(statistic.games?.appearences)
    && zeroOrNull(statistic.games?.minutes)
    && zeroOrNull(statistic.goals?.total)
    && zeroOrNull(statistic.goals?.assists)
    && zeroOrNull(statistic.cards?.yellow)
    && zeroOrNull(statistic.cards?.red);
}

function hasNoRankingMetrics(statistic: ApiFootballStatistic): boolean {
  const zeroOrNull = (value: number | null | undefined): boolean => value === null || value === undefined || value === 0;
  return zeroOrNull(statistic.goals?.total)
    && zeroOrNull(statistic.goals?.assists)
    && zeroOrNull(statistic.cards?.yellow)
    && zeroOrNull(statistic.cards?.red);
}

function validatePaging(payload: ApiFootballPayload, expectedPage: number, expectedTotal?: number, allowEmpty = false): number {
  const paging = payload.paging as { current?: number; total?: number } | undefined;
  const total = paging?.total;
  if (paging?.current !== expectedPage || typeof total !== 'number' || !Number.isInteger(total) || total < 1 || total > 1000) {
    throw new Error(`API-Football: paginación inválida en página ${expectedPage}`);
  }
  if (expectedTotal !== undefined && total !== expectedTotal) {
    throw new Error('API-Football: el total de páginas cambió durante la descarga');
  }
  if (!allowEmpty && (!payload.response || payload.response.length === 0)) throw new Error(`API-Football: página vacía ${expectedPage}`);
  return total;
}

async function waitForApiRateLimit(): Promise<void> {
  // Pro allows 300 requests/minute. Keep a conservative gap between pages
  // while avoiding the old free-tier delay, which made complete imports take
  // several minutes and was no longer appropriate once the account was
  // upgraded. The value can be raised for a stricter deployment network.
  const configuredDelay = Number(process.env.API_FOOTBALL_PAGE_DELAY_MS ?? 300);
  const delayMs = Number.isFinite(configuredDelay) ? Math.min(Math.max(configuredDelay, 0), 10_000) : 300;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function mergeStatistic(left: ApiFootballStatistic, right: ApiFootballStatistic): ApiFootballStatistic {
  const same = (a: unknown, b: unknown): boolean => a === undefined || a === null || b === undefined || b === null || a === b;
  if (!same(left.team?.id, right.team?.id) || !same(left.league?.id, right.league?.id)) {
    throw new Error('API-Football devolvió estadísticas incompatibles para la misma pareja jugador/equipo');
  }
  return {
    ...left,
    ...right,
    games: { ...left.games, ...right.games },
    goals: { ...left.goals, ...right.goals },
    cards: {
      ...left.cards,
      ...right.cards,
      yellow: mergeNullableCount(left.cards?.yellow, right.cards?.yellow, 'yellow cards'),
      red: mergeNullableCount(left.cards?.red, right.cards?.red, 'red cards')
    }
  };
}

function mergeNullableCount(left: number | null | undefined, right: number | null | undefined, label: string): number | null | undefined {
  if (left === undefined) return right;
  if (right === undefined || right === null) return left;
  if (left === null) return right;
  if (left !== right) throw new Error(`API-Football devolvió ${label} incompatibles para la misma pareja jugador/equipo`);
  return left;
}

function hasApiErrors(errors: unknown): boolean {
  if (Array.isArray(errors)) return errors.length > 0;
  if (errors && typeof errors === 'object') return Object.keys(errors).length > 0;
  return Boolean(errors);
}
