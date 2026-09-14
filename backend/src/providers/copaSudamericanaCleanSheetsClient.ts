import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

/**
 * FootyStats/Football Data API exposes clean_sheets_overall for each player
 * and each competition season.  The provider deliberately aggregates every
 * completed season returned by the league list; it never treats one season as
 * an all-time table and never turns a missing statistic into zero.
 */
export const copaSudamericanaLeagueListUrl = 'https://api.football-data-api.com/league-list';
export const copaSudamericanaLeaguePlayersUrl = 'https://api.football-data-api.com/league-players';
export const copaSudamericanaApiDocumentationUrl = 'https://footystats.org/api/documentations/league-players';
export const copaSudamericanaHistoricalStartYear = 2002;

type JsonRecord = Record<string, unknown>;

export type CopaSudamericanaSeason = {
  seasonId: number;
  year: number;
};

export type CopaSudamericanaSeasonCleanSheetEntry = {
  providerPlayerId: number;
  name: string;
  position: string;
  seasonId: number;
  seasonYear: number;
  cleanSheets: number;
  appearances: number | null;
  playerUrl: string | null;
};

export type CopaSudamericanaAggregatedCleanSheetEntry = {
  providerPlayerId: number;
  name: string;
  cleanSheets: number;
  seasons: Array<{ seasonId: number; year: number; cleanSheets: number; appearances: number | null }>;
};

export type CopaSudamericanaCleanSheetsOptions = {
  apiKey?: string;
  startYear?: number;
  endYear?: number;
  /** Only intended for deterministic tests; production keeps the default of 200. */
  minimumEntries?: number;
  httpFetch?: typeof fetch;
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function integer(value: unknown, field: string, { minimum = 0 }: { minimum?: number } = {}): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < minimum) {
    if (value === undefined || value === null || value === '') return null;
    throw new Error(`FootyStats Copa Sudamericana: ${field} inválido (${String(value)})`);
  }
  return parsed;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('en-US');
}

function dataArray(payload: unknown, endpoint: string): unknown[] {
  const body = record(payload);
  if (body?.success !== true) throw new Error(`FootyStats Copa Sudamericana: respuesta no válida en ${endpoint}`);
  if (!Array.isArray(body.data)) throw new Error(`FootyStats Copa Sudamericana: data no es un array en ${endpoint}`);
  return body.data;
}

/**
 * Selects the exact South America Copa Sudamericana competition and its
 * season IDs.  The API only has season IDs, so deriving them from league-list
 * avoids hard-coding IDs that can change between provider databases.
 */
export function parseCopaSudamericanaSeasons(
  payload: unknown,
  startYear = copaSudamericanaHistoricalStartYear,
  endYear = new Date().getUTCFullYear() - 1
): { seasons: CopaSudamericanaSeason[]; missingYears: number[]; competitionName: string } {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 2002 || endYear < startYear) {
    throw new Error(`FootyStats Copa Sudamericana: intervalo de temporadas inválido (${startYear}-${endYear})`);
  }
  const competitions = dataArray(payload, 'league-list');
  const candidates = competitions
    .map(record)
    .filter((item): item is JsonRecord => item !== null)
    .filter((item) => {
      const name = text(item.name);
      const leagueName = text(item.league_name);
      const normalizedName = normalized(name ?? '');
      const normalizedLeagueName = normalized(leagueName ?? '');
      return normalizedLeagueName === 'copa sudamericana'
        || /(?:^|\s)copa sudamericana$/u.test(normalizedName);
    });
  if (candidates.length !== 1) {
    throw new Error(`FootyStats Copa Sudamericana: se esperaban 1 competición, llegaron ${candidates.length}`);
  }
  const competition = candidates[0]!;
  const seasonsValue = competition.season;
  if (!Array.isArray(seasonsValue)) throw new Error('FootyStats Copa Sudamericana: competición sin temporadas');

  const byYear = new Map<number, CopaSudamericanaSeason>();
  for (const rawSeason of seasonsValue) {
    const season = record(rawSeason);
    if (!season) continue;
    const seasonId = integer(season.id, 'season.id', { minimum: 1 });
    const year = integer(season.year, 'season.year', { minimum: 2002 });
    if (seasonId === null || year === null || year < startYear || year > endYear) continue;
    if (byYear.has(year) && byYear.get(year)!.seasonId !== seasonId) {
      throw new Error(`FootyStats Copa Sudamericana: dos IDs para la temporada ${year}`);
    }
    byYear.set(year, { seasonId, year });
  }
  const seasons = [...byYear.values()].sort((left, right) => left.year - right.year);
  const missingYears = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index)
    .filter((year) => !byYear.has(year));
  if (seasons.length < 2) {
    throw new Error('FootyStats Copa Sudamericana: se requieren al menos dos temporadas para un agregado histórico');
  }
  return { seasons, missingYears, competitionName: text(competition.name) ?? 'South America Copa Sudamericana' };
}

function playerStat(row: JsonRecord, stats: JsonRecord | null, key: string): unknown {
  return row[key] ?? stats?.[key];
}

/** Parses one paginated league-players response without inventing zeroes. */
export function parseCopaSudamericanaCleanSheetPage(
  payload: unknown,
  season: CopaSudamericanaSeason
): { rows: CopaSudamericanaSeasonCleanSheetEntry[]; currentPage: number; maxPage: number; totalResults: number } {
  const players = dataArray(payload, 'league-players');
  const body = record(payload)!;
  const pager = record(body.pager);
  if (!pager) throw new Error('FootyStats Copa Sudamericana: respuesta de jugadores sin pager');
  const currentPage = integer(pager.current_page, 'pager.current_page', { minimum: 1 });
  const maxPage = integer(pager.max_page, 'pager.max_page', { minimum: 1 });
  const totalResults = integer(pager.total_results, 'pager.total_results', { minimum: 0 });
  if (currentPage === null || maxPage === null || totalResults === null || currentPage > maxPage) {
    throw new Error('FootyStats Copa Sudamericana: paginación inválida');
  }

  const rows: CopaSudamericanaSeasonCleanSheetEntry[] = [];
  const seen = new Set<number>();
  for (const rawPlayer of players) {
    const player = record(rawPlayer);
    if (!player) throw new Error('FootyStats Copa Sudamericana: jugador no es un objeto');
    const playerId = integer(player.id, 'player.id', { minimum: 1 });
    const name = text(player.full_name) ?? text(player.known_as);
    const position = text(player.position);
    const stats = record(player.stats);
    if (playerId === null || !name || !position) throw new Error('FootyStats Copa Sudamericana: jugador sin identidad o posición');
    if (normalized(position) !== 'goalkeeper' && normalized(position) !== 'gk') continue;
    if (seen.has(playerId)) throw new Error(`FootyStats Copa Sudamericana: jugador duplicado en temporada ${season.year}: ${playerId}`);
    seen.add(playerId);

    const rawCleanSheets = playerStat(player, stats, 'clean_sheets_overall');
    const cleanSheets = integer(rawCleanSheets, `clean_sheets_overall (${name})`, { minimum: 0 });
    // A missing field is not evidence of zero and is intentionally omitted.
    if (cleanSheets === null || cleanSheets === 0) continue;
    const appearances = integer(playerStat(player, stats, 'appearances_overall'), `appearances_overall (${name})`, { minimum: 0 });
    rows.push({
      providerPlayerId: playerId,
      name,
      position,
      seasonId: season.seasonId,
      seasonYear: season.year,
      cleanSheets,
      appearances,
      playerUrl: text(player.url)
    });
  }
  if (players.length > 200) throw new Error(`FootyStats Copa Sudamericana: página demasiado grande (${players.length})`);
  return { rows, currentPage, maxPage, totalResults };
}

/** Aggregates season rows by the provider's stable player ID. */
export function aggregateCopaSudamericanaCleanSheets(
  seasonRows: Array<{ season: CopaSudamericanaSeason; rows: CopaSudamericanaSeasonCleanSheetEntry[] }>
): CopaSudamericanaAggregatedCleanSheetEntry[] {
  const totals = new Map<number, CopaSudamericanaAggregatedCleanSheetEntry>();
  for (const { season, rows } of seasonRows) {
    for (const row of rows) {
      if (row.seasonId !== season.seasonId || row.seasonYear !== season.year) {
        throw new Error(`FootyStats Copa Sudamericana: fila fuera de su temporada ${season.year}`);
      }
      const current = totals.get(row.providerPlayerId);
      if (current) {
        if (current.seasons.some((entry) => entry.seasonId === season.seasonId)) {
          throw new Error(`FootyStats Copa Sudamericana: temporada duplicada para ${row.providerPlayerId}`);
        }
        current.cleanSheets += row.cleanSheets;
        current.seasons.push({ seasonId: season.seasonId, year: season.year, cleanSheets: row.cleanSheets, appearances: row.appearances });
        if (season.year >= Math.max(...current.seasons.map((entry) => entry.year))) current.name = row.name;
      } else {
        totals.set(row.providerPlayerId, {
          providerPlayerId: row.providerPlayerId,
          name: row.name,
          cleanSheets: row.cleanSheets,
          seasons: [{ seasonId: season.seasonId, year: season.year, cleanSheets: row.cleanSheets, appearances: row.appearances }]
        });
      }
    }
  }
  return [...totals.values()]
    .sort((left, right) => right.cleanSheets - left.cleanSheets || left.name.localeCompare(right.name, 'es'));
}

async function fetchJson(url: URL, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    const body = (await response.text()).replace(/\s+/gu, ' ').trim().slice(0, 240);
    throw new Error(`FootyStats Copa Sudamericana ${response.status} (${url.pathname})${body ? `: ${body}` : ''}`);
  }
  return response.json() as Promise<unknown>;
}

async function fetchSeasonRows(
  season: CopaSudamericanaSeason,
  apiKey: string,
  fetcher: typeof fetch
): Promise<{ season: CopaSudamericanaSeason; rows: CopaSudamericanaSeasonCleanSheetEntry[] }> {
  const rows: CopaSudamericanaSeasonCleanSheetEntry[] = [];
  let page = 1;
  let maxPage = 1;
  let expectedTotal: number | null = null;
  const seen = new Set<number>();
  do {
    const url = new URL(copaSudamericanaLeaguePlayersUrl);
    url.search = new URLSearchParams({ key: apiKey, season_id: String(season.seasonId), include: 'stats', page: String(page) }).toString();
    const parsed = parseCopaSudamericanaCleanSheetPage(await fetchJson(url, fetcher), season);
    if (parsed.currentPage !== page) throw new Error(`FootyStats Copa Sudamericana: página esperada ${page}, recibida ${parsed.currentPage}`);
    if (expectedTotal === null) expectedTotal = parsed.totalResults;
    if (parsed.totalResults !== expectedTotal) throw new Error(`FootyStats Copa Sudamericana: total cambió durante la paginación de ${season.year}`);
    maxPage = parsed.maxPage;
    for (const row of parsed.rows) {
      if (seen.has(row.providerPlayerId)) throw new Error(`FootyStats Copa Sudamericana: jugador duplicado entre páginas de ${season.year}: ${row.providerPlayerId}`);
      seen.add(row.providerPlayerId);
      rows.push(row);
    }
    page += 1;
  } while (page <= maxPage);
  return { season, rows };
}

export async function fetchCopaSudamericanaCleanSheets(
  options: CopaSudamericanaCleanSheetsOptions = {}
): Promise<RankingInput> {
  const apiKey = options.apiKey ?? process.env.FOOTYSTATS_API_KEY;
  if (!apiKey?.trim()) throw new Error('FootyStats Copa Sudamericana: falta FOOTYSTATS_API_KEY');
  const fetcher = options.httpFetch ?? fetch;
  const startYear = options.startYear ?? copaSudamericanaHistoricalStartYear;
  const endYear = options.endYear ?? new Date().getUTCFullYear() - 1;
  const listUrl = new URL(copaSudamericanaLeagueListUrl);
  listUrl.search = new URLSearchParams({ key: apiKey }).toString();
  const selection = parseCopaSudamericanaSeasons(await fetchJson(listUrl, fetcher), startYear, endYear);
  const seasonRows: Array<{ season: CopaSudamericanaSeason; rows: CopaSudamericanaSeasonCleanSheetEntry[] }> = [];
  for (const season of selection.seasons) seasonRows.push(await fetchSeasonRows(season, apiKey, fetcher));
  const aggregate = aggregateCopaSudamericanaCleanSheets(seasonRows);
  const minimumEntries = options.minimumEntries ?? 200;
  if (!Number.isInteger(minimumEntries) || minimumEntries < 1) throw new Error(`FootyStats Copa Sudamericana: mínimo inválido (${minimumEntries})`);
  if (aggregate.length < minimumEntries) {
    throw new Error(`FootyStats Copa Sudamericana: solo hay ${aggregate.length} porteros con porterías a cero positivas; no se rellenará hasta ${minimumEntries}`);
  }
  const top = aggregate.slice(0, 200);
  const sourceRankById = new Map(top.map((row, index) => [row.providerPlayerId, index + 1]));
  const sourceUrl = copaSudamericanaApiDocumentationUrl;
  const sourceSeasonIds = selection.seasons.map((season) => season.seasonId);
  return {
    categorySlug: 'copa-sudamericana-clean_sheets',
    source: {
      key: 'footystats-copa-sudamericana-clean-sheets',
      name: 'FootyStats Football Data API — Copa Sudamericana goalkeeper clean sheets by season',
      sourceType: 'api',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `footystats-copa-sudamericana-clean-sheets-${startYear}-${endYear}-${sourceSeasonIds.join('-')}-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: selection.missingYears.length === 0,
    allowPartialDraft: selection.missingYears.length > 0,
    partialDraftReason: selection.missingYears.length > 0
      ? `FootyStats devuelve temporadas verificables ${selection.seasons.map((season) => season.year).join(', ')}; faltan ${selection.missingYears.join(', ')} desde el inicio histórico de la competición (2002), por lo que este snapshot es parcial y no se publica como all-time completo.`
      : undefined,
    reviewed: false,
    entries: top.map((row) => ({
      entityId: `footystats:copa-sudamericana:player:${createHash('sha256').update(String(row.providerPlayerId)).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.cleanSheets,
      evidence: {
        sourceRank: sourceRankById.get(row.providerPlayerId),
        providerPlayerId: row.providerPlayerId,
        sourceUrl,
        seasons: row.seasons,
        seasonIds: sourceSeasonIds,
        scope: `Porterías a cero del portero en la Copa Sudamericana masculina, agregadas por ID a partir de todas las temporadas verificables recuperadas (${startYear}-${endYear}); solo se suman valores positivos explícitos de la API, nunca ceros imputados`,
        sourceCoverage: selection.seasons.map((season) => season.year),
        missingHistoricalSeasons: selection.missingYears
      }
    }))
  };
}
