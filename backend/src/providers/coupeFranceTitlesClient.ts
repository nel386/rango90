import type { RankingInput } from '../imports/rankingInput.js';

export const coupeFranceClubTitlesUrl = 'https://www.fff.fr/448-les-clubs-les-plus-titres-en-coupe-de-france.html';
export const coupeFrancePalmaresUrl = 'https://www.fff.fr/473-palmares-de-la-coupe-de-france.html';
export const coupeFranceLatestWinnerUrl = 'https://www.fff.fr/article/16842-lens-enfin-en-or.html';

const officialReader = (url: string) => `https://r.jina.ai/${url}`;
type ParsedRow = { name: string; winnerYears: number[] };

const clubIds: Record<string, string> = {
  'Paris Saint-Germain': 'ligue1:club:paris-saint-germain',
  'Olympique de Marseille': 'ligue1:club:olympique-de-marseille',
  'AS Saint-Étienne': 'ligue1:club:as-saint-etienne',
  'Lille OSC': 'ligue1:club:losc',
  'AS Monaco FC': 'ligue1:club:as-monaco',
  'Olympique Lyonnais': 'ligue1:club:olympique-lyonnais',
  'FC Girondins de Bordeaux': 'ligue1:club:fc-girondins-de-bordeaux',
  'FC Nantes Atlantique': 'ligue1:club:fc-nantes',
  'AJ Auxerre': 'ligue1:club:aj-auxerre',
  'RC Strasbourg': 'ligue1:club:rc-strasbourg-alsace',
  'OGC Nice': 'ligue1:club:ogc-nice',
  'FC Sochaux Montbéliard': 'ligue1:club:fc-sochaux-montbeliard',
  'Stade de Reims': 'ligue1:club:stade-de-reims',
  'Montpellier HSC': 'ligue1:club:montpellier-herault-sc',
  'RC Lens': 'ligue1:club:rc-lens'
};

function normalizeText(value: string): string {
  return value.replaceAll('\u00a0', ' ').replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cleanName(value: string): string {
  return normalizeText(value.replaceAll('**', '').replaceAll('_', '').replace(/\s*\(\*\)\s*$/, ''));
}

export function parseCoupeFranceClubTitles(markdown: string): ParsedRow[] {
  const rows = [...markdown.matchAll(/^##\s+(.*?)\s*\n\n\(([^)]+)\)/gm)].map((match) => ({
    name: cleanName(match[1] ?? ''),
    winnerYears: [...(match[2] ?? '').matchAll(/\b(\d{4})\b/g)].map((year) => Number(year[1]))
  })).filter((row) => row.name.length > 0 && row.winnerYears.length > 0);

  if (rows.length !== 35) throw new Error(`FFF Coupe de France: se esperaban 35 clubes campeones y llegaron ${rows.length}`);
  if (rows.some((row) => row.winnerYears.some((year) => year < 1917 || year > 2026))) throw new Error('FFF Coupe de France: año fuera del intervalo oficial');
  const totalTitles = rows.reduce((sum, row) => sum + row.winnerYears.length, 0);
  if (totalTitles !== 107) throw new Error(`FFF Coupe de France: se esperaban 107 títulos hasta 2025 y llegaron ${totalTitles}`);
  const toulouseRows = rows.filter((row) => row.name === 'Toulouse FC');
  if (toulouseRows.length !== 2 || !toulouseRows.some((row) => row.winnerYears[0] === 1957) || !toulouseRows.some((row) => row.winnerYears[0] === 2023)) throw new Error('FFF Coupe de France: no se preservó la distinción entre los dos Toulouse FC');
  return rows;
}

function addCurrentWinner(rows: ParsedRow[], latestWinnerMarkdown: string): ParsedRow[] {
  if (!rows.some((row) => row.name === 'RC Lens' && row.winnerYears.includes(2026))) {
    const normalized = latestWinnerMarkdown.toLocaleLowerCase('fr');
    if (!normalized.includes('rc lens') || !normalized.includes('3-1') || !normalized.includes('première')) throw new Error('FFF Coupe de France: no se verificó oficialmente el campeón de 2026');
    rows = [...rows, { name: 'RC Lens', winnerYears: [2026] }];
  }
  const totalTitles = rows.reduce((sum, row) => sum + row.winnerYears.length, 0);
  if (totalTitles !== 108) throw new Error(`FFF Coupe de France: se esperaban 108 títulos hasta 2026 y llegaron ${totalTitles}`);
  return rows;
}

export function buildCoupeFranceRanking(rows: ParsedRow[]): RankingInput {
  const ordered = [...rows].sort((left, right) => right.winnerYears.length - left.winnerYears.length || Math.max(...right.winnerYears) - Math.max(...left.winnerYears) || left.name.localeCompare(right.name, 'fr'));
  return {
    categorySlug: 'coupe-de-france-club-titles',
    source: { key: 'fff-coupe-de-france-palmares', name: 'Fédération Française de Football official Coupe de France honours', sourceType: 'official', baseUrl: coupeFranceClubTitlesUrl, rightsStatus: 'review_required' },
    dataVersion: 'coupe-de-france-club-titles-2026',
    coverageComplete: true,
    reviewed: false,
    entries: ordered.map((row, index) => {
      const historicalToulouse = row.name === 'Toulouse FC' && row.winnerYears[0] === 1957;
      const displayName = row.name === 'Toulouse FC' ? `Toulouse FC (${historicalToulouse ? '1957, club desaparecido' : '2023, actual'})` : row.name;
      const entityId = row.name === 'Toulouse FC' ? `fff:coupe-de-france:club:toulouse-fc-${historicalToulouse ? '1957' : '2023'}` : clubIds[row.name] ?? `fff:coupe-de-france:club:${slugify(row.name)}`;
      return { entityId, entityType: 'club' as const, name: displayName, rawValue: row.winnerYears.length, evidence: { sourceRank: index + 1, sourceUrl: coupeFranceClubTitlesUrl, palmaresSourceUrl: coupeFrancePalmaresUrl, latestWinnerEvidenceUrl: coupeFranceLatestWinnerUrl, winnerYears: row.winnerYears, scope: 'Palmarés oficial de la Coupe de France desde 1917-18 hasta 2025-26; se excluye 1991-92 porque la final no se disputó; los dos Toulouse se mantienen separados conforme a la nota histórica de la FFF', closedUniverse: true } };
    })
  };
}

export async function fetchCoupeFranceClubTitles(): Promise<RankingInput> {
  const [main, latest] = await Promise.all([fetchOfficialMarkdown(coupeFranceClubTitlesUrl), fetchOfficialMarkdown(coupeFranceLatestWinnerUrl)]);
  return buildCoupeFranceRanking(addCurrentWinner(parseCoupeFranceClubTitles(main.markdown), latest.markdown));
}

async function fetchOfficialMarkdown(url: string): Promise<{ markdown: string; retrievalTransport: 'direct' | 'official-reader-fallback' }> {
  const headers = { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' };
  try {
    const direct = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (direct.ok) {
      const body = await direct.text();
      if (body.includes('## **Paris Saint-Germain**') || body.includes('## Toulouse FC')) return { markdown: body, retrievalTransport: 'direct' };
    }
  } catch {
    // The FFF page may be protected by its WAF; the reader is only a transport fallback.
  }
  const fallback = await fetch(officialReader(url), { headers: { Accept: 'text/markdown', 'User-Agent': headers['User-Agent'] }, signal: AbortSignal.timeout(60_000) });
  if (!fallback.ok) throw new Error(`FFF Coupe de France official page unavailable (${fallback.status})`);
  return { markdown: await fallback.text(), retrievalTransport: 'official-reader-fallback' };
}
