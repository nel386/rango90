import type { RankingInput } from '../imports/rankingInput.js';

interface PremierLeagueResponse {
  stats?: {
    pageInfo?: { page?: number; numPages?: number; numEntries?: number; pageSize?: number };
    content?: Array<{
      owner?: {
        id?: number;
        playerId?: number;
        name?: { display?: string };
        nationalTeam?: { isoCode?: string };
        info?: { position?: string };
      };
      value?: number;
      rank?: number;
    }>;
  };
}

const metricPaths = {
  goals: 'goals',
  assists: 'goal_assist',
  clean_sheets: 'clean_sheet',
  yellow_cards: 'yellow_card',
  red_cards: 'red_card'
} as const;

const publicMetricPaths = {
  goals: 'goals',
  assists: 'goal-assists',
  clean_sheets: 'clean-sheets',
  yellow_cards: 'yellow-cards',
  red_cards: 'red-cards'
} as const;

export type PremierLeagueMetric = keyof typeof metricPaths;

export const PREMIER_LEAGUE_TOP_N = 200;

type PremierLeagueStatRow = NonNullable<NonNullable<PremierLeagueResponse['stats']>['content']>[number];

/**
 * Selects the product cut from the official all-seasons table.
 *
 * The source exposes the whole historical universe, including players with
 * an explicit zero in the current response. Those are real source rows, but
 * they are not eligible entries for an all-time goals ranking. Keep the
 * provider order/rank and take exactly the first 200 positive rows so the
 * boundary remains reproducible even when the provider assigns one rank to a
 * tie group larger than the remaining product slots.
 */
export function selectPremierLeagueGoalsTop200(entries: PremierLeagueStatRow[], expectedEntries: number): PremierLeagueStatRow[] {
  if (expectedEntries < PREMIER_LEAGUE_TOP_N) {
    throw new Error(`La fuente oficial de Premier League no alcanza ${PREMIER_LEAGUE_TOP_N} entradas: ${expectedEntries}`);
  }
  const positiveEntries = entries.filter((entry) => typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value > 0);
  if (positiveEntries.length < PREMIER_LEAGUE_TOP_N) {
    throw new Error(`La fuente oficial de Premier League solo devuelve ${positiveEntries.length} goleadores con valor positivo`);
  }
  return positiveEntries.slice(0, PREMIER_LEAGUE_TOP_N);
}

function selectPremierLeagueTop200(entries: PremierLeagueStatRow[], expectedEntries: number, metric: PremierLeagueMetric): PremierLeagueStatRow[] {
  if (expectedEntries < PREMIER_LEAGUE_TOP_N || entries.length < PREMIER_LEAGUE_TOP_N) {
    throw new Error(`La fuente oficial de Premier League no alcanza ${PREMIER_LEAGUE_TOP_N} entradas para ${metric}: ${entries.length}`);
  }
  return entries.slice(0, PREMIER_LEAGUE_TOP_N);
}

export async function fetchPremierLeagueRanking(metric: PremierLeagueMetric): Promise<RankingInput> {
  const path = metricPaths[metric];
  const pageSize = 100;
  const maxEntries = 100_000;
  const entries: NonNullable<NonNullable<PremierLeagueResponse['stats']>['content']> = [];
  const seenPlayerIds = new Set<number>();
  let page = 0;
  let expectedEntries = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const url = new URL(`https://footballapi.pulselive.com/football/stats/ranked/players/${path}`);
    url.searchParams.set('comps', '1');
    url.searchParams.set('comp', '1');
    url.searchParams.set('compsCodeForSort', 'PL');
    url.searchParams.set('altIds', 'true');
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));

    const response = await fetch(url, {
      headers: {
        Origin: 'https://www.premierleague.com',
        'User-Agent': 'Rango90-data-import/0.1'
      }
    });
    if (!response.ok) throw new Error(`Premier League API ${response.status}`);
    const payload = (await response.json()) as PremierLeagueResponse;
    const pageInfo = payload.stats?.pageInfo;
    const content = payload.stats?.content ?? [];
    if (!pageInfo || content.length === 0) throw new Error(`Respuesta vacía de Premier League en página ${page}`);
    const numPages = pageInfo.numPages;
    if (typeof numPages !== 'number' || !Number.isInteger(numPages) || numPages < 1 || numPages > maxEntries) {
      throw new Error(`Paginación inválida de Premier League en página ${page}`);
    }
    if (pageInfo.numEntries !== undefined && (!Number.isInteger(pageInfo.numEntries) || pageInfo.numEntries < 100 || pageInfo.numEntries > maxEntries)) {
      throw new Error(`Total de entradas inválido de Premier League: ${pageInfo.numEntries}`);
    }
    if (content.length > pageSize) throw new Error(`Página de Premier League demasiado grande: ${content.length}`);
    let previousValue: number | undefined;
    let previousRank: number | undefined;
    for (const row of content) {
      const playerId = row.owner?.id;
      if (typeof playerId !== 'number' || !Number.isInteger(playerId) || playerId < 1) throw new Error(`Jugador inválido en página ${page}`);
      if (seenPlayerIds.has(playerId)) throw new Error(`Jugador duplicado en Premier League: ${playerId}`);
      if (typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0) throw new Error(`Valor inválido para el jugador ${playerId} en página ${page}`);
      if (row.rank !== undefined && (!Number.isInteger(row.rank) || row.rank < 1)) throw new Error(`Rank inválido para el jugador ${playerId}`);
      if (previousValue !== undefined && row.value > previousValue) throw new Error(`Orden de valores inválido en página ${page} para el jugador ${playerId}`);
      if (previousRank !== undefined && row.rank !== undefined && row.rank < previousRank) throw new Error(`Orden de puestos inválido en página ${page} para el jugador ${playerId}`);
      seenPlayerIds.add(playerId);
      previousValue = row.value;
      previousRank = row.rank;
    }
    entries.push(...content);
    if (page === 0) {
      expectedEntries = pageInfo.numEntries ?? entries.length;
      totalPages = numPages;
    } else if (pageInfo.numEntries !== undefined && pageInfo.numEntries !== expectedEntries) {
      throw new Error('El total de entradas de Premier League cambia durante la paginación');
    }
    page += 1;
  }

  if (entries.length !== expectedEntries) {
    throw new Error(`Cobertura incompleta de Premier League: ${entries.length}/${expectedEntries}`);
  }

  const rankingEntries = metric === 'goals'
    ? selectPremierLeagueGoalsTop200(entries, expectedEntries)
    : metric === 'clean_sheets'
      ? selectPremierLeagueTop200(entries.filter((entry) => entry.owner?.info?.position === 'G'), expectedEntries, metric)
      : selectPremierLeagueTop200(entries, expectedEntries, metric);
  if (metric === 'clean_sheets' && rankingEntries.length < 100) {
    throw new Error(`Cobertura insuficiente de porteros en Premier League: ${rankingEntries.length}`);
  }

  return {
    categorySlug: `premier-league-${metric}`,
    source: {
      key: 'premier-league-official',
      name: 'Premier League official statistics',
      sourceType: 'official',
      baseUrl: `https://www.premierleague.com/en/stats/top/players/${publicMetricPaths[metric]}/all-seasons`,
      rightsStatus: 'review_required'
    },
    dataVersion: `premier-league-all-time-${metric}-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rankingEntries.map((entry) => {
      const owner = entry.owner;
      if (!owner?.id || !owner.name?.display || typeof entry.value !== 'number' || !Number.isFinite(entry.value) || entry.value < 0) {
        throw new Error('Entrada de Premier League sin identidad o valor válido');
      }
      if (entry.rank !== undefined && (!Number.isInteger(entry.rank) || entry.rank < 1)) {
        throw new Error(`Rank inválido de Premier League para ${owner.id}`);
      }
      return {
        entityId: `pl:player:${owner.id}`,
        entityType: 'player' as const,
        name: owner.name.display,
        rawValue: entry.value,
        evidence: {
          sourceRank: entry.rank,
          providerPlayerId: owner.playerId,
          nationalTeamCode: owner.nationalTeam?.isoCode,
          position: owner.info?.position,
          sourceUrl: `https://www.premierleague.com/en/stats/top/players/${publicMetricPaths[metric]}/all-seasons`,
          competition: 'Premier League',
          historicalScope: 'all-seasons',
          sourceEntriesObserved: expectedEntries,
          sourcePositiveEntries: metric === 'goals' ? entries.filter((candidate) => (candidate.value ?? 0) > 0).length : undefined,
          productCut: PREMIER_LEAGUE_TOP_N
        }
      };
    })
  };
}
