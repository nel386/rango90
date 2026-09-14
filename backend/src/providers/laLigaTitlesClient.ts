import type { RankingInput } from '../imports/rankingInput.js';

export const laLigaHonoursUrl = 'https://www.laliga.com/sala-de-prensa/palmares';

type ParsedTitleRow = { name: string; titles: number };

const sourceNames = [
  'Atlético de Madrid',
  'Real Sociedad',
  'Athletic Club',
  'FC Barcelona',
  'Real Madrid',
  'RC Deportivo',
  'Valencia',
  'Sevilla',
  'Betis'
];

const displayNames: Record<string, string> = {
  'FC Barcelona': 'Barcelona'
};

// Reuse identities already reviewed in the catalogue where the equivalence is
// unambiguous. The remaining clubs receive stable LaLiga IDs and can be
// consolidated later only with an explicit identity review.
const stableClubIds: Record<string, string> = {
  'Real Madrid': 'uefa:champions:club:4bea3ac923fc47dcf0b15d66',
  'FC Barcelona': 'uefa:champions:club:062dda15f8838576019a50b0',
  'Athletic Club': 'wikipedia-es:copa-del-rey:club:88b4a5a6cc824a59401f6406',
  Valencia: 'uefa:europa:club:a66b6c078db27b114adbc579',
  Sevilla: 'uefa:europa:club:69d2280dea38ba7afcecc8b3',
  'Atlético de Madrid': 'laliga:club:atletico-de-madrid',
  'Real Sociedad': 'laliga:club:real-sociedad',
  'RC Deportivo': 'laliga:club:rc-deportivo',
  Betis: 'laliga:club:betis'
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleText(html: string): string {
  return decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

export function parseLaLigaClubTitles(html: string): ParsedTitleRow[] {
  const text = visibleText(html).replace(/\s+/g, ' ').trim();
  const start = text.indexOf('Títulos');
  const end = text.indexOf('¿AÚN NO TE HAS REGISTRADO', start);
  if (start < 0 || end <= start) throw new Error('LaLiga: no se encontró el bloque oficial de palmarés');
  const section = text.slice(start, end);
  const namesPattern = sourceNames
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const rows = [...section.matchAll(new RegExp(`(${namesPattern})\\s+(\\d+)`, 'g'))]
    .map((match) => ({ name: match[1] ?? '', titles: Number(match[2]) }))
    .filter((row) => sourceNames.includes(row.name) && Number.isInteger(row.titles) && row.titles > 0);
  if (rows.length !== sourceNames.length || new Set(rows.map((row) => row.name)).size !== rows.length) {
    throw new Error(`LaLiga: palmarés incompleto o duplicado (${rows.length}/${sourceNames.length})`);
  }
  for (const row of rows) {
    if (!stableClubIds[row.name]) throw new Error(`LaLiga: club no reconocido ${row.name}`);
  }
  return rows.sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name));
}

export async function fetchLaLigaClubTitles(): Promise<RankingInput> {
  const response = await fetch(laLigaHonoursUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`LaLiga official palmares ${response.status}`);
  const rows = parseLaLigaClubTitles(await response.text());
  return {
    categorySlug: 'la-liga-club-titles',
    source: {
      key: 'laliga-official-palmares',
      name: 'LALIGA official club honours',
      sourceType: 'official',
      baseUrl: laLigaHonoursUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `la-liga-club-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row, index) => ({
      entityId: stableClubIds[row.name]!,
      entityType: 'club' as const,
      name: displayNames[row.name] ?? row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: index + 1,
        sourceName: row.name,
        sourceUrl: laLigaHonoursUrl,
        externalId: `laliga:club:${row.name.toLocaleLowerCase('es-ES').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`,
        scope: 'Títulos de Primera División de España según el palmarés oficial publicado por LALIGA; universo cerrado de clubes campeones',
        closedUniverse: true
      }
    }))
  };
}
