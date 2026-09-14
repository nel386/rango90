import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const competitionConfig = {
  champions: {
    categoryPrefix: 'uefa-champions-league',
    sourceKey: 'uefa-champions-league-official',
    sourceName: 'UEFA Champions League official player statistics',
    path: 'uefachampionsleague'
  },
  conference: {
    categoryPrefix: 'uefa-conference-league',
    sourceKey: 'uefa-conference-league-official',
    sourceName: 'UEFA Conference League official player statistics',
    path: 'uefaconferenceleague'
  },
  europa: {
    categoryPrefix: 'uefa-cup-europa-league',
    sourceKey: 'uefa-europa-league-official',
    sourceName: 'UEFA Europa League official player statistics',
    path: 'uefaeuropaleague'
  },
  euro: {
    categoryPrefix: 'euro',
    sourceKey: 'uefa-euro-official',
    sourceName: 'UEFA EURO official player statistics',
    path: 'uefaeuro'
  }
} as const;
const pageCount = 10;
const pageSize = 10;

export type UefaCompetition = keyof typeof competitionConfig;
export type UefaPlayerRankingMetric = 'goals' | 'assists' | 'red_cards';

export function uefaCategorySlugForMetric(metric: UefaPlayerRankingMetric, competition: UefaCompetition = 'champions'): string {
  const metricSlug = competition === 'champions' && metric === 'red_cards' ? 'red-cards' : metric;
  return `${competitionConfig[competition].categoryPrefix}-${metricSlug}`;
}

export interface UefaPlayerRankingEntry {
  rank: number;
  name: string;
  teamName?: string;
  value: number;
  imageUrl: string;
  externalId: string;
  sourceUrl: string;
}

// UEFA's historical tables sometimes expose only a surname or a short name.
// Keep the provider identity (the image-path identifier) authoritative while
// expanding those labels before they reach the entity catalogue. This avoids
// Commons searches resolving to a different person (for example Pape Sané or
// Odell Beckham).
const canonicalNameByExternalId: Record<string, string> = {
  '/imgml/TP/players/2019/history/250162399.jpg': 'Amahl Pellegrino',
  '/imgml/TP/players/1/history/93649.jpg': 'Sergio Ramos',
  '/imgml/TP/players/1/history/1907998.jpg': 'Stefan Savić',
  '/imgml/TP/players/1/history/1906016.jpg': 'Arturo Vidal',
  '/imgml/TP/players/1/history/24729.jpg': 'Patrick Vieira',
  '/imgml/TP/players/1/history/250100014.jpg': 'Felipe Augusto de Almeida Monteiro',
  '/imgml/TP/players/1/history/3078.jpg': 'Giorgos Kalitzakis',
  '/imgml/TP/players/1/history/37623.jpg': 'Krzysztof Baszkiewicz',
  '/imgml/TP/players/1/history/15200.jpg': 'Serhiy Mizin',
  '/imgml/TP/players/1/history/250074376.jpg': 'Wendell Nascimento Borges',
  '/imgml/TP/players/1/history/26584.jpg': 'Miguel Ángel Angulo',
  '/imgml/TP/players/1/history/250008930.jpg': 'Yaroslav Rakitskyi',
  '/imgml/TP/players/1/history/98865.jpg': 'Kevin-Prince Boateng',
  '/imgml/TP/players/1/history/27918.jpg': 'Luís Vidigal',
  '/imgml/TP/players/1/history/26624.jpg': 'Akis Zikos',
  '/imgml/TP/players/1/history/29267.jpg': 'Darko Kovačević',
  '/imgml/TP/players/1/history/59142.jpg': 'Giorgio Chiellini',
  '/imgml/TP/players/1/history/250169706.jpg': 'Daizen Maeda',
  '/imgml/TP/players/1/history/250011210.jpg': 'Idrissa Gana Gueye',
  '/imgml/TP/players/1/history/33279.jpg': 'Eugen Cătălin Baciu',
  '/imgml/TP/players/1/history/250176453.jpg': 'Pau Cubarsí',
  '/imgml/TP/players/1/history/250134170.jpg': 'Ronald Araújo',
  '/imgml/TP/players/1/history/250008303.jpg': 'Geoffroy Serey Dié',
  '/imgml/TP/players/1/history/13897.jpg': 'Aarno Turpeinen',
  '/imgml/TP/players/1/history/250092613.jpg': 'Konstantinos Galanopoulos',
  '/imgml/TP/players/1/history/250063984.jpg': 'Leroy Sané',
  '/imgml/TP/players/1/history/13127.jpg': 'Clarence Seedorf',
  '/imgml/TP/players/1/history/250054949.jpg': 'Kingsley Coman',
  '/imgml/TP/players/1/history/14670.jpg': 'David Beckham',
  '/imgml/TP/players/1/history/91630.jpg': 'Alex de Souza',
  '/imgml/TP/players/1/history/71683.jpg': 'Ferenc Puskás',
  '/imgml/TP/players/1/history/1900739.jpg': 'Gonzalo Higuaín',
  '/imgml/TP/players/1/history/250118281.jpg': 'Lautaro Martínez',
  '/imgml/TP/players/1/history/250005343.jpg': 'Luuk de Jong',
  '/imgml/TP/players/1/history/38101.jpg': 'Francisco Gento',
  '/imgml/TP/players/1/history/19099.jpg': 'Serhiy Rebrov',
  '/imgml/TP/players/1/history/5535.jpg': 'Marco Simone',
  '/imgml/TP/players/1/history/51675.jpg': 'Claudio Pizarro',
  '/imgml/TP/players/1/history/50885.jpg': 'Maksim Shatskikh',
  '/imgml/TP/players/1/history/11845.jpg': 'Harald Brattbakk',
  '/imgml/TP/players/1/history/37711.jpg': 'José Augusto Torres',
  '/imgml/TP/players/1/history/40690.jpg': 'Fernando Cruz',
  '/imgml/TP/players/1/history/37700.jpg': 'José Augusto Pinto de Almeida',
  '/imgml/TP/players/3/history/5845.jpg': 'Petar Hubchev',
  '/imgml/TP/players/3/history/4730.jpg': 'Radoslav Látal',
  '/imgml/TP/players/3/history/1909229.jpg': 'Shane Duffy',
  '/imgml/TP/players/3/history/150021865.jpg': 'Gheorghe Hagi',
  '/imgml/TP/players/3/history/150004458.jpg': 'John Heitinga'
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirst(pattern: RegExp, html: string, label: string): string {
  const match = pattern.exec(html)?.[1];
  if (!match) throw new Error(`UEFA: falta ${label}`);
  return decodeHtml(match);
}

export function parseUefaPlayerRankingPage(html: string, sourceUrl: string): UefaPlayerRankingEntry[] {
  const items = [...html.matchAll(/<pk-list-item class="stats-data-item">([\s\S]*?)<\/pk-list-item>/g)].map((match) => {
    const item = match[1];
    if (!item) throw new Error('UEFA: bloque de jugador vacío');
    return item;
  });
  if (items.length !== pageSize) throw new Error(`UEFA: se esperaban ${pageSize} entradas y llegaron ${items.length}`);

  return items.map((item) => {
    const rank = Number(extractFirst(/<span slot="prefix-card">(\d+)<\/span>/, item, 'posición'));
    const name = extractFirst(/<span slot="primary">([\s\S]*?)<\/span>/, item, 'nombre');
    const teamNameMatch = /<span slot="secondary">([\s\S]*?)<\/span>/.exec(item)?.[1];
    const teamName = teamNameMatch ? decodeHtml(teamNameMatch) : undefined;
    const value = Number(extractFirst(/<div class="pk-font-size--l" slot="suffix-card">([\d.,]+)<\/div>/, item, 'valor'));
    const imageUrl = extractFirst(/<pk-avatar[^>]+src="(https:\/\/img\.uefa\.com\/imgml\/TP\/players\/[^" ]+)"/, item, 'imagen');
    const parsedImageUrl = new URL(imageUrl);
    const externalId = parsedImageUrl.pathname;
    if (!Number.isInteger(rank) || rank < 1 || !Number.isInteger(value) || value < 0 || !externalId) {
      throw new Error(`UEFA: valor inválido para ${name}`);
    }
    return { rank, name, ...(teamName ? { teamName } : {}), value, imageUrl, externalId, sourceUrl };
  });
}

function validateUefaTop100(rows: UefaPlayerRankingEntry[], metric: UefaPlayerRankingMetric, competition: UefaCompetition): void {
  if (rows.length !== pageCount * pageSize) {
    throw new Error(`UEFA ${competition} ${metric}: se esperaban 100 filas y llegaron ${rows.length}`);
  }
  const externalIds = new Set<string>();
  let previousValue = Number.POSITIVE_INFINITY;
  for (const [index, row] of rows.entries()) {
    if (externalIds.has(row.externalId)) throw new Error(`UEFA ${competition} ${metric}: jugador duplicado ${row.externalId}`);
    externalIds.add(row.externalId);
    if (row.rank < 1 || row.rank < (rows[index - 1]?.rank ?? 1)) {
      throw new Error(`UEFA ${competition} ${metric}: posición inválida en la fila ${index + 1}`);
    }
    if (row.value > previousValue) {
      throw new Error(`UEFA ${competition} ${metric}: valores fuera de orden en la fila ${index + 1}`);
    }
    previousValue = row.value;
  }
}

export async function fetchUefaPlayerRanking(competition: UefaCompetition, metric: UefaPlayerRankingMetric): Promise<RankingInput> {
  const competitionDetails = competitionConfig[competition];
  const rankingRoot = `https://www.uefa.com/${competitionDetails.path}/history/rankings/players/${metric === 'goals' ? 'goals_scored' : metric}/`;
  const rows: UefaPlayerRankingEntry[] = [];
  const seenExternalIds = new Set<string>();
  let lastRank = 0;

  let pagesFetched = 0;
  for (let page = 0; page < pageCount; page += 1) {
    const sourceUrl = page === 0 ? rankingRoot : `${rankingRoot}${page}/`;
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Rango90-data-import/0.1' },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`${competitionDetails.sourceName} ${response.status} en página ${page}`);
    const html = await response.text();
    const itemCount = html.match(/<pk-list-item class="stats-data-item">[\s\S]*?<\/pk-list-item>/g)?.length ?? 0;
    if (itemCount === 0) break;
    const pageRows = parseUefaPlayerRankingPage(html, sourceUrl);
    pagesFetched += 1;
    for (const row of pageRows) {
      if (seenExternalIds.has(row.externalId)) throw new Error(`UEFA: jugador duplicado ${row.externalId}`);
      if (row.rank < lastRank) throw new Error(`UEFA: posición fuera de orden ${row.rank} después de ${lastRank}`);
      seenExternalIds.add(row.externalId);
      lastRank = row.rank;
      rows.push(row);
    }
  }

  rows.sort((a, b) => a.rank - b.rank);
  const finalRank = rows.at(-1)?.rank ?? 0;
  if (rows[0]?.rank !== 1 || finalRank < 91 || finalRank > 100) {
    throw new Error(`UEFA: cobertura insuficiente para el top 100 (${rows.length} filas en ${pagesFetched} páginas; se requieren ${pageCount * pageSize})`);
  }
  validateUefaTop100(rows, metric, competition);

  return {
    categorySlug: uefaCategorySlugForMetric(metric, competition),
    source: {
      key: competitionDetails.sourceKey,
      name: competitionDetails.sourceName,
      sourceType: 'official',
      baseUrl: rankingRoot,
      rightsStatus: 'review_required'
    },
    dataVersion: `${competitionDetails.categoryPrefix}-${metric}-top-100-${new Date().toISOString().slice(0, 10)}`,
    // The official all-time ranking is paginated as ten pages of ten rows.
    // The importer validates the complete 1-100 slice; publication rights
    // remain an independent review gate below.
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `uefa:player:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: canonicalNameByExternalId[row.externalId] ?? row.name,
      rawValue: row.value,
      evidence: {
        sourceRank: row.rank,
        externalId: row.externalId,
        providerImageUrl: row.imageUrl,
        teamName: row.teamName,
        sourceUrl: row.sourceUrl,
        scope: `${competitionDetails.sourceName}; all-time ${metric} page; ranking rows 1-100`
      },
      image: {
        assetKind: 'portrait' as const,
        sourceUrl: row.imageUrl,
        provider: 'uefa-official'
      }
    }))
  };
}

export function fetchUefaChampionsLeagueRanking(metric: UefaPlayerRankingMetric): Promise<RankingInput> {
  return fetchUefaPlayerRanking('champions', metric);
}

export function fetchUefaConferenceLeagueRanking(metric: UefaPlayerRankingMetric): Promise<RankingInput> {
  return fetchUefaPlayerRanking('conference', metric);
}

export function fetchUefaEuropaLeagueRanking(metric: UefaPlayerRankingMetric): Promise<RankingInput> {
  return fetchUefaPlayerRanking('europa', metric);
}

export function fetchUefaEuroRanking(metric: UefaPlayerRankingMetric): Promise<RankingInput> {
  return fetchUefaPlayerRanking('euro', metric);
}

export async function fetchUefaEuroNationalTeamTitles(): Promise<RankingInput> {
  const sourceUrl = 'https://www.uefa.com/uefaeuro/history/winners/';
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`UEFA EURO official winners ${response.status}`);
  const rows = parseUefaWinnersPage(await response.text());
  return {
    categorySlug: 'euro-national_team-titles',
    source: {
      key: 'uefa-euro-official',
      name: 'UEFA EURO official winners',
      sourceType: 'official',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `euro-national-team-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row, index) => ({
      entityId: `uefa:euro:national-team:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'national_team' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: index + 1,
        externalId: row.externalId,
        providerBadgeUrl: row.badgeUrl,
        sourceUrl,
        scope: 'UEFA EURO; palmarés oficial completo de selecciones ganadoras'
      },
      image: {
        assetKind: 'badge' as const,
        sourceUrl: row.badgeUrl,
        provider: 'uefa-official'
      }
    }))
  };
}

const winnersConfig = {
  champions: {
    categorySlug: 'european-cup-champions-league-club-titles',
    sourceKey: 'uefa-champions-league-official',
    sourceName: 'UEFA Champions League official winners',
    path: 'uefachampionsleague'
  },
  europa: {
    categorySlug: 'uefa-cup-europa-league-club-titles',
    sourceKey: 'uefa-europa-league-official',
    sourceName: 'UEFA Europa League official winners',
    path: 'uefaeuropaleague'
  },
  conference: {
    categorySlug: 'uefa-conference-league-club-titles',
    sourceKey: 'uefa-conference-league-official',
    sourceName: 'UEFA Conference League official winners',
    path: 'uefaconferenceleague'
  }
} as const;

export type UefaWinnersCompetition = keyof typeof winnersConfig;

export interface UefaClubTitlesEntry {
  name: string;
  titles: number;
  badgeUrl: string;
  externalId: string;
}

export function parseUefaWinnersPage(html: string): UefaClubTitlesEntry[] {
  const rows = [...html.matchAll(/<pk-identifier class="history-winners__team-name[\s\S]*?<span slot="primary">([\s\S]*?)<\/span>[\s\S]*?<span class="history-winners__team-stat">(\d+)<\/span>/g)].map((match) => {
    const name = match[1] ? decodeHtml(match[1]) : undefined;
    const titlesText = match[2];
    if (!name || !titlesText) throw new Error('UEFA: ganador sin nombre o número de títulos');
    const badgeUrl = extractFirst(/<pk-badge[^>]+src="(https:\/\/img\.uefa\.com\/imgml\/(?:TP\/teams|flags)\/[^" ]+)"/, match[0], 'escudo o bandera');
    const titles = Number(titlesText);
    const externalId = new URL(badgeUrl).pathname;
    if (!Number.isInteger(titles) || titles < 1 || !externalId) throw new Error(`UEFA: títulos inválidos para ${name}`);
    return { name, titles, badgeUrl, externalId };
  });
  if (rows.length === 0) throw new Error('UEFA: página de ganadores vacía');
  const seenNames = new Set<string>();
  let previousTitles = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (seenNames.has(row.name)) throw new Error(`UEFA: club ganador duplicado ${row.name}`);
    if (row.titles > previousTitles) throw new Error(`UEFA: títulos fuera de orden para ${row.name}`);
    seenNames.add(row.name);
    previousTitles = row.titles;
  }
  return rows;
}

export async function fetchUefaClubTitles(competition: UefaWinnersCompetition): Promise<RankingInput> {
  const details = winnersConfig[competition];
  const sourceUrl = `https://www.uefa.com/${details.path}/history/winners/`;
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`${details.sourceName} ${response.status}`);
  const rows = parseUefaWinnersPage(await response.text());
  return {
    categorySlug: details.categorySlug,
    source: {
      key: details.sourceKey,
      name: details.sourceName,
      sourceType: 'official',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `${details.categorySlug}-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row, index) => ({
      entityId: `uefa:${competition}:club:${createHash('sha256').update(row.name).digest('hex').slice(0, 24)}`,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: index + 1,
        externalId: row.externalId,
        providerBadgeUrl: row.badgeUrl,
        sourceUrl,
        scope: `${details.sourceName}; exhaustive winners list`
      },
      image: {
        assetKind: 'badge' as const,
        sourceUrl: row.badgeUrl,
        provider: 'uefa-official'
      }
    }))
  };
}
