import type { RankingInput } from '../imports/rankingInput.js';

export const supercopaEspanaTitlesUrl = 'https://rfef.es/es/noticias/una-supercopa-mas-y-ya-van-16-para-el-fc-barcelona';
const officialReaderUrl = `https://r.jina.ai/${supercopaEspanaTitlesUrl}`;

export type SupercopaEspanaTitleEntry = {
  sourceRank: number;
  year: number;
  name: string;
  titles: number;
  winnerYears: number[];
};

const winnerToClubId: Record<string, string> = {
  'Real Sociedad': 'laliga:club:real-sociedad',
  'FC Barcelona': 'uefa:champions:club:062dda15f8838576019a50b0',
  'Athletic Club': 'wikipedia-es:copa-del-rey:club:88b4a5a6cc824a59401f6406',
  'Club Atlético de Madrid': 'laliga:club:atletico-de-madrid',
  'Real Madrid CF': 'uefa:champions:club:4bea3ac923fc47dcf0b15d66',
  'RC Deportivo de La Coruña': 'laliga:club:rc-deportivo',
  'RCD Mallorca': 'wikipedia-es:copa-del-rey:club:ecd925b4b3381c55a72376dd',
  'Valencia CF': 'uefa:europa:club:a66b6c078db27b114adbc579',
  'RCD Espanyol': 'wikipedia-es:copa-del-rey:club:83db240e09e478e34bbae2cb',
  'Real Zaragoza': 'wikipedia-es:copa-del-rey:club:819a5507d747ae5ee3fc2071',
  'Sevilla FC': 'uefa:europa:club:69d2280dea38ba7afcecc8b3'
};

function cleanCell(value: string): string {
  return value.replaceAll('**', '').replaceAll('*', '').replace(/\s+/g, ' ').trim();
}

export function parseSupercopaEspanaTitles(markdown: string): SupercopaEspanaTitleEntry[] {
  const rows = [...markdown.matchAll(/^\|\s*[^|]+\s*\|\s*(\d{4})\s*\|\s*([^|]+?)\s*\|/gm)]
    .map((match) => ({ year: Number(match[1]), name: cleanCell(match[2] ?? '') }))
    .filter((row) => Number.isInteger(row.year) && row.name.length > 0);

  if (rows.length !== 42) throw new Error(`Supercopa de España: se esperaban 42 ediciones y llegaron ${rows.length}`);
  const years = rows.map((row) => row.year);
  if (new Set(years).size !== years.length || years[0] !== 1982 || years.at(-1) !== 2026) {
    throw new Error('Supercopa de España: años duplicados o límites históricos incorrectos');
  }
  if (years.includes(1986) || years.includes(1987) || years.includes(2019)) {
    throw new Error('Supercopa de España: aparecen ediciones que la fuente oficial declara no disputadas');
  }
  const unknownWinner = rows.find((row) => !winnerToClubId[row.name]);
  if (unknownWinner) throw new Error(`Supercopa de España: campeón no reconocido (${unknownWinner.name})`);

  const byWinner = new Map<string, number[]>();
  for (const row of rows) byWinner.set(row.name, [...(byWinner.get(row.name) ?? []), row.year]);
  const result = [...byWinner.entries()]
    .map(([name, winnerYears]) => ({ sourceRank: 0, year: winnerYears.at(-1)!, name, titles: winnerYears.length, winnerYears }))
    .sort((left, right) => right.titles - left.titles || right.year - left.year || left.name.localeCompare(right.name))
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
  const totalTitles = result.reduce((sum, row) => sum + row.titles, 0);
  if (result.length !== 10 || totalTitles !== 42) {
    throw new Error(`Supercopa de España: universo de campeones incompleto (${result.length} clubes / ${totalTitles} títulos)`);
  }
  return result;
}

export async function fetchSupercopaEspanaTitles(): Promise<RankingInput> {
  const { markdown, retrievalTransport } = await fetchOfficialMarkdown();
  const rows = parseSupercopaEspanaTitles(markdown);
  return {
    categorySlug: 'supercopa-espana-club-titles',
    source: {
      key: 'rfef-supercopa-espana-palmares',
      name: 'RFEF official Supercopa de España winners',
      sourceType: 'official',
      baseUrl: supercopaEspanaTitlesUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `supercopa-espana-club-titles-${rows.at(-1)?.year ?? 'unknown'}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: winnerToClubId[row.name]!,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: row.sourceRank,
        sourceUrl: supercopaEspanaTitlesUrl,
        retrievalTransport,
        winnerYears: row.winnerYears,
        scope: 'Palmarés oficial completo de la Supercopa de España desde 1982 hasta 2026; se excluyen 1986, 1987 y 2019 por no existir edición disputada según la RFEF',
        closedUniverse: true
      }
    }))
  };
}

async function fetchOfficialMarkdown(): Promise<{ markdown: string; retrievalTransport: 'direct' | 'official-reader-fallback' }> {
  const direct = await fetch(supercopaEspanaTitlesUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (direct.ok) {
    const body = await direct.text();
    if (body.includes('| EDICIÓN') && body.includes('| XLII |') && body.includes('| 2026 |')) {
      return { markdown: body, retrievalTransport: 'direct' };
    }
  }

  const fallback = await fetch(officialReaderUrl, {
    headers: { Accept: 'text/markdown,text/plain', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!fallback.ok) throw new Error(`RFEF Supercopa de España no disponible (${fallback.status})`);
  return { markdown: await fallback.text(), retrievalTransport: 'official-reader-fallback' };
}
