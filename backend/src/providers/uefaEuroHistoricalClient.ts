import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

/**
 * Historical UEFA EURO editions for which UEFA exposes the tournament
 * player-ranking service. The list is deliberately explicit: a missing
 * edition must never be silently treated as an empty season. UEFA's service
 * also exposes the early final tournaments, so keep the full final-tournament
 * set here rather than silently limiting the game to the modern era.
 */
export const UEFA_EURO_HISTORICAL_SEASONS = [1960, 1964, 1968, 1972, 1976, 1980, 1984, 1988, 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024] as const;
export type UefaEuroHistoricalSeason = (typeof UEFA_EURO_HISTORICAL_SEASONS)[number];
export type UefaEuroHistoricalMetric = 'goals' | 'assists' | 'yellow_cards';

const competitionId = '3';
const rankingLimit = 200;
const sourceKey = 'uefa-euro-official';
const sourceName = 'UEFA EURO official historical player statistics';
const apiRoot = 'https://compstats.uefa.com/v2/player-ranking-leader';

type UefaPlayer = {
  id?: string | number;
  imageUrl?: string;
  internationalName?: string;
  translations?: {
    name?: Record<string, string | undefined>;
    firstName?: Record<string, string | undefined>;
    lastName?: Record<string, string | undefined>;
  };
};

type UefaTeam = {
  id?: string | number;
  internationalName?: string;
  translations?: { displayName?: Record<string, string | undefined> };
};

type UefaRanking = {
  player?: UefaPlayer;
  playerId?: string | number;
  team?: UefaTeam;
  statistics?: Array<{ name?: string; value?: string | number }>;
};

type UefaRankingGroup = { name?: string; rankings?: UefaRanking[] };

export type UefaEuroHistoricalRow = {
  sourceRank: number;
  playerId: string;
  name: string;
  value: number;
  teamName?: string;
  imageUrl: string;
};

export type UefaEuroHistoricalFetchOptions = { fetchImpl?: typeof fetch };

function getEnglishName(player: UefaPlayer): string | undefined {
  return (player.internationalName ?? player.translations?.name?.EN)
    ?? ([player.translations?.firstName?.EN, player.translations?.lastName?.EN].filter(Boolean).join(' ') || undefined);
}

function getTeamName(team: UefaTeam | undefined): string | undefined {
  return team?.internationalName ?? team?.translations?.displayName?.EN ?? undefined;
}

function parsePositiveInteger(value: string | number | undefined, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`UEFA EURO: ${label} inválido`);
  return parsed;
}

function historicalPlayerImageUrl(playerId: string): string {
  // UEFA exposes a stable historical image path in addition to the edition
  // path.  Using it as the asset identity prevents one player acquiring one
  // pending portrait per edition during a multi-season import.
  return `https://img.uefa.com/imgml/TP/players/3/history/${encodeURIComponent(playerId)}.jpg`;
}

export function parseUefaEuroHistoricalRanking(
  payload: unknown,
  season: UefaEuroHistoricalSeason,
  metric: UefaEuroHistoricalMetric,
  sourceUrl: string
): UefaEuroHistoricalRow[] {
  // UEFA returns an empty array for the early editions where this statistic
  // is not exposed. That is evidence of an unavailable edition, not a zero
  // value for every player. Preserve the distinction for yellow cards so the
  // aggregate can remain explicitly partial instead of fabricating rows.
  if (metric === 'yellow_cards' && Array.isArray(payload) && payload.length === 0) return [];
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new Error(`UEFA EURO ${season} ${metric}: respuesta de ranking inválida`);
  }
  const group = payload[0] as UefaRankingGroup | undefined;
  if (group?.name !== metric || !Array.isArray(group.rankings)) {
    throw new Error(`UEFA EURO ${season} ${metric}: falta el bloque de estadísticas esperado`);
  }
  if (metric === 'yellow_cards' && group.rankings.length === 0) return [];
  if (group.rankings.length < 1 || group.rankings.length > rankingLimit) {
    throw new Error(`UEFA EURO ${season} ${metric}: número de filas inválido (${group.rankings.length})`);
  }

  const seenPlayers = new Set<string>();
  let previousValue = Number.POSITIVE_INFINITY;
  const rows = group.rankings.flatMap((ranking, index) => {
    const player = ranking.player;
    const playerId = String(ranking.playerId ?? player?.id ?? '');
    const name = player ? getEnglishName(player) : undefined;
    const statistic = ranking.statistics?.find((item) => item.name === metric);
    const value = parsePositiveInteger(statistic?.value, `${metric} para ${playerId || 'jugador'}`);
    // UEFA occasionally returns a ranked statistic with only the provider
    // id (the player object is absent). It is a real source row, but it is
    // not an identifiable footballer and must not create a fabricated entity.
    // Keep the remaining official rows and let the caller mark the snapshot
    // partial when this reduces the usable set below 200.
    if (!/^\d+$/.test(playerId) || !name) return [];
    if (!player?.imageUrl || !player.imageUrl.startsWith('https://img.uefa.com/imgml/TP/players/')) {
      throw new Error(`UEFA EURO ${season} ${metric}: imagen oficial ausente para ${playerId}`);
    }
    if (seenPlayers.has(playerId)) throw new Error(`UEFA EURO ${season} ${metric}: jugador duplicado ${playerId}`);
    if (value > previousValue) throw new Error(`UEFA EURO ${season} ${metric}: valores fuera de orden en fila ${index + 1}`);
    seenPlayers.add(playerId);
    previousValue = value;
    return [{
      sourceRank: index + 1,
      playerId,
      name,
      value,
      ...(getTeamName(ranking.team) ? { teamName: getTeamName(ranking.team) } : {}),
      imageUrl: historicalPlayerImageUrl(playerId)
    }];
  });

  // The API is asked for the first 200 rows.  A shorter response is valid for
  // a metric with fewer recorded players (notably historical assists); the
  // caller marks that input as a partial draft instead of padding it.
  void sourceUrl;
  return rows;
}

function buildApiUrl(season: UefaEuroHistoricalSeason, metric: UefaEuroHistoricalMetric): string {
  const url = new URL(apiRoot);
  url.searchParams.set('optionalFields', 'PLAYER,TEAM');
  url.searchParams.set('competitionId', competitionId);
  url.searchParams.set('seasonYear', String(season));
  url.searchParams.set('phase', 'TOURNAMENT');
  url.searchParams.set('stats', metric);
  url.searchParams.set('offset', '0');
  url.searchParams.set('limit', String(rankingLimit));
  url.searchParams.set('order', 'DESC');
  return url.toString();
}

export function uefaEuroHistoricalCategorySlug(season: UefaEuroHistoricalSeason, metric: UefaEuroHistoricalMetric): string {
  return `euro-${season}-${metric}`;
}

export async function fetchUefaEuroHistoricalRanking(
  season: UefaEuroHistoricalSeason,
  metric: UefaEuroHistoricalMetric,
  options: UefaEuroHistoricalFetchOptions = {}
): Promise<RankingInput> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiUrl = buildApiUrl(season, metric);
  const sourcePageUrl = `https://www.uefa.com/uefaeuro/history/seasons/${season}/statistics/players/${metric}/`;
  const response = await fetchImpl(apiUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Rango90-data-import/0.1'
    },
    signal: AbortSignal.timeout(30_000)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`UEFA EURO ${season} ${metric}: HTTP ${response.status} (${body.slice(0, 300)})`);

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`UEFA EURO ${season} ${metric}: respuesta no JSON`);
  }
  const rows = parseUefaEuroHistoricalRanking(payload, season, metric, apiUrl);
  const partial = rows.length < rankingLimit;

  return {
    categorySlug: uefaEuroHistoricalCategorySlug(season, metric),
    source: {
      key: sourceKey,
      name: sourceName,
      sourceType: 'official',
      baseUrl: sourcePageUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `uefa-euro-${season}-${metric}-top-${rows.length}-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: !partial,
    ...(partial ? {
      allowPartialDraft: true,
      partialDraftReason: `UEFA devuelve ${rows.length} filas reales para ${metric} en la edición ${season}; no se añaden filas de relleno.`
    } : {}),
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `uefa:player:${createHash('sha256').update(`/imgml/TP/players/3/history/${row.playerId}.jpg`).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.value,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: `/imgml/TP/players/3/history/${row.playerId}.jpg`,
        providerPlayerId: row.playerId,
        providerImageUrl: row.imageUrl,
        teamName: row.teamName,
        season,
        metric,
        sourcePageUrl,
        apiUrl,
        scope: `UEFA EURO ${season}; fase final; ranking oficial de ${metric}; primeras ${rankingLimit} filas disponibles`
      },
      image: {
        assetKind: 'portrait' as const,
        sourceUrl: row.imageUrl,
        provider: 'uefa-official'
      }
    }))
  };
}

/**
 * Build the all-time Euro ranking from every final-tournament edition that
 * UEFA exposes. A short edition response is valid when that edition has fewer
 * positive players; it must not be padded to 200 before the editions are
 * aggregated. Completeness here means that all 17 editions were fetched and
 * the requested global top-200 slice was built from real UEFA rows.
 */
export async function fetchUefaEuroAllTimeRanking(
  metric: UefaEuroHistoricalMetric,
  options: UefaEuroHistoricalFetchOptions = {}
): Promise<RankingInput> {
  const componentInputs: Array<{ season: UefaEuroHistoricalSeason; input: RankingInput }> = [];
  for (const season of UEFA_EURO_HISTORICAL_SEASONS) {
    const input = await fetchUefaEuroHistoricalRanking(season, metric, options);
    if (input.entries.length === 0 && metric !== 'yellow_cards') {
      throw new Error(`UEFA EURO all-time ${metric}: la edición ${season} no devolvió filas`);
    }
    componentInputs.push({ season, input });
  }

  type Aggregate = {
    playerId: string;
    name: string;
    imageUrl: string;
    value: number;
    editions: Set<number>;
    componentRanks: Array<{ season: number; rank: number; value: number }>;
  };
  const aggregates = new Map<string, Aggregate>();
  for (const { season, input } of componentInputs) {
    for (const entry of input.entries) {
      const playerId = String(entry.evidence?.providerPlayerId ?? '');
      if (!/^\d+$/.test(playerId)) throw new Error(`UEFA EURO all-time ${metric}: ID oficial inválido para ${entry.name}`);
      const value = Number(entry.rawValue);
      if (!Number.isInteger(value) || value < 0) throw new Error(`UEFA EURO all-time ${metric}: valor inválido para ${entry.name}`);
      const imageUrl = String(entry.image?.sourceUrl ?? entry.evidence?.providerImageUrl ?? '');
      if (!imageUrl.startsWith('https://img.uefa.com/imgml/TP/players/')) {
        throw new Error(`UEFA EURO all-time ${metric}: imagen oficial ausente para ${entry.name}`);
      }
      const aggregate = aggregates.get(playerId) ?? {
        playerId,
        name: entry.name,
        imageUrl,
        value: 0,
        editions: new Set<number>(),
        componentRanks: []
      };
      aggregate.value += value;
      aggregate.editions.add(season);
      aggregate.componentRanks.push({ season, rank: Number(entry.evidence?.sourceRank ?? 0), value });
      aggregates.set(playerId, aggregate);
    }
  }

  const top200 = [...aggregates.values()]
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'es') || left.playerId.localeCompare(right.playerId))
    .slice(0, 200);
  if (top200.length < 200) {
    throw new Error(`UEFA EURO all-time ${metric}: se necesitan 200 jugadores y solo hay ${top200.length}`);
  }

  return {
    categorySlug: `euro-${metric}`,
    source: {
      key: sourceKey,
      name: 'UEFA EURO official historical player statistics — all final-tournament editions',
      sourceType: 'official',
      baseUrl: `https://www.uefa.com/uefaeuro/history/rankings/players/${metric}/`,
      rightsStatus: 'review_required'
    },
    dataVersion: `uefa-euro-all-time-${metric}-${UEFA_EURO_HISTORICAL_SEASONS.join('-')}-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: metric !== 'yellow_cards',
    ...(metric === 'yellow_cards' ? {
      allowPartialDraft: true,
      partialDraftReason: 'UEFA no expone filas de tarjetas amarillas para las ediciones 1960, 1964 y 1968; no se convierten esas ausencias en ceros ni se declara cobertura histórica completa.'
    } : {}),
    reviewed: false,
    entries: top200.map((row, index) => ({
      entityId: `uefa:player:${createHash('sha256').update(`/imgml/TP/players/3/history/${row.playerId}.jpg`).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.value,
      evidence: {
        sourceRank: index + 1,
        providerPlayerId: row.playerId,
        providerImageUrl: row.imageUrl,
        metric,
        editions: [...row.editions].sort((left, right) => left - right),
        componentRanks: row.componentRanks.sort((left, right) => left.season - right.season),
        sourceEditionCount: componentInputs.length,
        sourceEditions: componentInputs.map(({ season, input }) => ({
          season,
          sourcePageUrl: input.entries[0]?.evidence?.sourcePageUrl
            ?? `https://www.uefa.com/uefaeuro/history/seasons/${season}/statistics/players/${metric}/`,
          apiUrl: input.entries[0]?.evidence?.apiUrl ?? buildApiUrl(season, metric),
          rows: input.entries.length
        })),
        scope: 'UEFA EURO masculina; las 17 ediciones de fase final de 1960 a 2024; suma de las filas positivas devueltas por el servicio histórico oficial de UEFA',
        definition: `Suma de ${metric} registradas por UEFA en cada edición de fase final; no se aplica padding y las identidades se agrupan por el ID oficial de jugador. Para tarjetas amarillas, las ediciones sin bloque estadístico permanecen como cobertura no demostrada.`
      },
      image: {
        assetKind: 'portrait' as const,
        sourceUrl: row.imageUrl,
        provider: 'uefa-official'
      }
    }))
  };
}

export async function fetchAllUefaEuroHistoricalRankings(
  seasons: readonly UefaEuroHistoricalSeason[] = UEFA_EURO_HISTORICAL_SEASONS,
  metrics: readonly UefaEuroHistoricalMetric[] = ['goals', 'assists']
): Promise<RankingInput[]> {
  const inputs: RankingInput[] = [];
  for (const season of seasons) {
    for (const metric of metrics) inputs.push(await fetchUefaEuroHistoricalRanking(season, metric));
  }
  return inputs;
}
