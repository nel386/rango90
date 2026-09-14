import type { RankingInput } from '../imports/rankingInput.js';

export const bundesligaChampionsHistoryUrl = 'https://www.bundesliga.com/en/bundesliga/news/german-champions-in-the-bundesliga-bayern-munich-borussia-dortmund-24221';
export const bundesliga2024TitleUrl = 'https://www.bundesliga.com/en/bundesliga/news/bayern-munich-win-2024-25-title-kane-kompany-alonso-leverkusen-31866';
export const bundesliga2025TitleUrl = 'https://www.bundesliga.com/en/bundesliga/news/bayern-munich-vfb-stuttgart-match-report-highlights-matchday-30-champions-davies-kane-36979';

type ChampionSeason = { season: string; name: string };

const stableClubIds: Record<string, string> = {
  'Bayern Munich': 'dfb:bundesliga:club:bayern-munich',
  'Borussia Mönchengladbach': 'dfb:bundesliga:club:borussia-monchengladbach',
  'Borussia Dortmund': 'dfb:bundesliga:club:borussia-dortmund',
  'Werder Bremen': 'dfb:bundesliga:club:werder-bremen',
  // Hamburg already exists in the UEFA club namespace with the same
  // TheSportsDB identity; reuse that canonical entity instead of creating a
  // second club record.
  Hamburg: 'uefa:champions:club:47afcff3dcb9e9891e7b329e',
  'VfB Stuttgart': 'dfb:bundesliga:club:vfb-stuttgart',
  Cologne: 'dfb:bundesliga:club:cologne',
  Kaiserslautern: 'dfb:bundesliga:club:kaiserslautern',
  '1860 Munich': 'dfb:bundesliga:club:1860-munich',
  'Eintracht Braunschweig': 'dfb:bundesliga:club:eintracht-braunschweig',
  Nuremberg: 'dfb:bundesliga:club:nuremberg',
  Wolfsburg: 'dfb:bundesliga:club:wolfsburg',
  'Bayer Leverkusen': 'dfb:bundesliga:club:bayer-leverkusen'
};

const expectedCounts: Record<string, number> = {
  'Bayern Munich': 34,
  'Borussia Mönchengladbach': 5,
  'Borussia Dortmund': 5,
  'Werder Bremen': 4,
  Hamburg: 3,
  'VfB Stuttgart': 3,
  Cologne: 2,
  Kaiserslautern: 2,
  '1860 Munich': 1,
  'Eintracht Braunschweig': 1,
  Nuremberg: 1,
  Wolfsburg: 1,
  'Bayer Leverkusen': 1
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseBundesligaChampionSeasons(articleBody: string): ChampionSeason[] {
  const rows = [...articleBody.matchAll(/(\d{4}\/\d{2,4})\s*[–-]\s*([^\t\n]+)/g)]
    .map((match) => ({
      season: match[1] ?? '',
      name: normalizeWhitespace((match[2] ?? '').replace(/\s*\([^)]*title[^)]*\)/i, ''))
    }))
    .filter((row) => row.season.length > 0 && row.name.length > 0);

  if (rows.length !== 61 || rows[0]?.season !== '1963/64' || rows.at(-1)?.season !== '2023/24') {
    throw new Error(`Bundesliga: historial incompleto o inesperado (${rows.length} temporadas)`);
  }
  for (let index = 0; index < rows.length; index += 1) {
    const startYear = Number(rows[index]?.season.slice(0, 4));
    if (startYear !== 1963 + index) throw new Error(`Bundesliga: falta o duplica la temporada ${rows[index]?.season}`);
    if (!stableClubIds[rows[index]?.name ?? '']) throw new Error(`Bundesliga: campeón no reconocido ${rows[index]?.name}`);
  }
  return rows;
}

function extractArticleBody(html: string): string {
  for (const match of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? '');
      if (parsed && typeof parsed === 'object' && 'articleBody' in parsed && typeof parsed.articleBody === 'string') {
        return parsed.articleBody;
      }
    } catch {
      // Other JSON-LD blocks are not necessarily valid standalone JSON.
    }
  }
  throw new Error('Bundesliga: no se encontró el articleBody estructurado');
}

export async function fetchBundesligaClubTitles(): Promise<RankingInput> {
  const response = await fetch(bundesligaChampionsHistoryUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      Referer: 'https://www.bundesliga.com/',
      'User-Agent': 'Mozilla/5.0 (compatible; Rango90-data-import/0.1)'
    },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Bundesliga official champions ${response.status}`);

  const seasons: ChampionSeason[] = parseBundesligaChampionSeasons(extractArticleBody(await response.text()));
  const currentUpdates: ChampionSeason[] = [
    { season: '2024/25', name: 'Bayern Munich' },
    { season: '2025/26', name: 'Bayern Munich' }
  ];
  const allSeasons = [...seasons, ...currentUpdates];
  const counts = new Map<string, number>();
  const winnerSeasons = new Map<string, string[]>();
  for (const row of allSeasons) {
    counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
    winnerSeasons.set(row.name, [...(winnerSeasons.get(row.name) ?? []), row.season]);
  }
  const countsMatch = Object.keys(expectedCounts).length === counts.size
    && Object.entries(expectedCounts).every(([name, expected]) => counts.get(name) === expected);
  if (!countsMatch) {
    throw new Error(`Bundesliga: palmarés inesperado ${JSON.stringify(Object.fromEntries(counts))}`);
  }

  const rows = Object.entries(expectedCounts)
    .sort(([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB));
  return {
    categorySlug: 'bundesliga-club-titles',
    source: {
      key: 'bundesliga-honours-official',
      name: 'Bundesliga official champions history',
      sourceType: 'official',
      baseUrl: bundesligaChampionsHistoryUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `bundesliga-club-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map(([name, titles], index) => ({
      entityId: stableClubIds[name]!,
      entityType: 'club' as const,
      name,
      rawValue: titles,
      evidence: {
        sourceRank: index + 1,
        sourceUrl: bundesligaChampionsHistoryUrl,
        externalId: `bundesliga:club:${name.toLocaleLowerCase('en-US').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`,
        currentUpdateSources: { '2024/25': bundesliga2024TitleUrl, '2025/26': bundesliga2025TitleUrl },
        scope: 'Títulos de Bundesliga desde 1963/64 hasta 2025/26; se excluyen campeonatos alemanes anteriores a la Bundesliga',
        winnerSeasons: winnerSeasons.get(name) ?? [],
        closedUniverse: true
      }
    }))
  };
}
