import type { RankingInput } from '../imports/rankingInput.js';

export const premierLeagueTitlesSourceUrl = 'https://www.premierleague.com/en/news/4288492';

export type PremierLeagueClubTitleEntry = {
  sourceRank: number;
  name: string;
  titles: number;
};

const stableClubIds: Record<string, string> = {
  'Man Utd': 'pl:club:12',
  'Man City': 'pl:club:11',
  Chelsea: 'pl:club:4',
  Arsenal: 'pl:club:1',
  Liverpool: 'pl:club:10',
  'Blackburn Rovers': 'pl:club:blackburn-rovers',
  'Leicester City': 'pl:club:leicester-city'
};

const canonicalNames: Record<string, string> = {
  'Man Utd': 'Manchester United',
  'Man City': 'Manchester City'
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePremierLeagueClubTitles(html: string): PremierLeagueClubTitleEntry[] {
  const table = html.match(/<h6[^>]*>\s*Most Premier League titles\s*<\/h6>([\s\S]*?<\/table>)/i)?.[1];
  if (!table) throw new Error('Premier League: no se encontró la tabla oficial de títulos');

  const rows: PremierLeagueClubTitleEntry[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(table)) !== null) {
    const row = match[1] ?? '';
    const name = decodeHtml(row.match(/<th[^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? '');
    const titles = Number(row.match(/<td[^>]*>(\d+)<\/td>/i)?.[1]);
    if (!name || !Number.isInteger(titles) || titles < 1) continue;
    rows.push({ sourceRank: rows.length + 1, name, titles });
  }
  return rows;
}

export async function fetchPremierLeagueClubTitles(): Promise<RankingInput> {
  const response = await fetch(premierLeagueTitlesSourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Premier League official titles ${response.status}`);

  const rows = parsePremierLeagueClubTitles(await response.text());
  const expectedNames = Object.keys(stableClubIds);
  if (rows.length !== expectedNames.length || rows.map((row) => row.name).join('|') !== expectedNames.join('|')) {
    throw new Error(`Premier League: tabla de títulos inesperada (${rows.length} clubes)`);
  }
  let previousTitles = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (row.titles > previousTitles) throw new Error(`Premier League: títulos fuera de orden para ${row.name}`);
    previousTitles = row.titles;
    if (!stableClubIds[row.name]) throw new Error(`Premier League: club no reconocido ${row.name}`);
  }

  return {
    categorySlug: 'premier-league-club-titles',
    source: {
      // The official stats API already uses numeric IDs under the generic
      // premier-league-official namespace. Honours uses a different stable
      // identifier namespace, so keep it separate and avoid false collisions.
      key: 'premier-league-honours-official',
      name: 'Premier League official champions history',
      sourceType: 'official',
      baseUrl: premierLeagueTitlesSourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `premier-league-club-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: stableClubIds[row.name]!,
      entityType: 'club' as const,
      name: canonicalNames[row.name] ?? row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: row.sourceRank,
        sourceUrl: premierLeagueTitlesSourceUrl,
        externalId: `premier-league:club:${row.name.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-')}`,
        scope: 'Títulos de la Premier League desde 1992/93; tabla oficial completa de clubes campeones',
        historicalRule: 'Solo se cuentan títulos de Premier League, no First Division anterior a 1992/93'
      }
    }))
  };
}
