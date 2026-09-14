import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const baseUrl = 'https://www.bdfutbol.com/en/c/';
const rankingCut = 200;

export type BdfutbolLeague = 'la-liga' | 'premier-league' | 'bundesliga' | 'serie-a' | 'ligue-1' | 'primeira-liga';
export type BdfutbolLaLigaRankingMetric = 'goals' | 'clean_sheets' | 'yellow_cards' | 'red_cards';

const leagueConfig: Record<BdfutbolLeague, { label: string; suffix: string }> = {
  'la-liga': { label: 'LaLiga', suffix: '' },
  'premier-league': { label: 'Premier League', suffix: 'Eng' },
  bundesliga: { label: 'Bundesliga', suffix: 'Ger' },
  'serie-a': { label: 'Serie A', suffix: 'Ita' },
  'ligue-1': { label: 'Ligue 1', suffix: 'Fra' },
  'primeira-liga': { label: 'Primeira Liga', suffix: 'Por' }
};

export type BdfutbolLaLigaRankingEntry = {
  sourceRank: number;
  displayedRank: number;
  shortName: string;
  fullName: string;
  value: number;
  externalId: string;
  dateOfBirth: string | null;
  position: 'G' | 'OUTFIELD' | null;
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

function extractValue(row: string): number | null {
  const valueCell = /<td class="text-nowrap">([\s\S]*?)<\/td>/i.exec(row)?.[1];
  if (!valueCell) return null;
  const valueText = decodeHtml(valueCell).replace(/\./g, '').replace(/,/g, '.');
  const match = /^(\d+(?:\.\d+)?)$/.exec(valueText);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseBdfutbolLaLigaRanking(html: string, metric: BdfutbolLaLigaRankingMetric): BdfutbolLaLigaRankingEntry[] {
  const rows: BdfutbolLaLigaRankingEntry[] = [];
  const rowPattern = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row = rowMatch[0];
    const rankMatch = /<td class="fit">\s*(\d+)\s*<\/td>/i.exec(row);
    const playerLinks = [...row.matchAll(/<td class="text-left">\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/td>/gi)];
    const value = extractValue(row);
    if (!rankMatch || playerLinks.length < 2 || value === null) continue;

    const displayedRank = Number(rankMatch[1]);
    const externalId = new URL(playerLinks[0]?.[1] ?? '', baseUrl).toString();
    const shortName = decodeHtml(playerLinks[0]?.[2] ?? '');
    const fullName = decodeHtml(playerLinks[1]?.[2] ?? '');
    const dateOfBirth = /<td class="">(\d{2}\/\d{2}\/\d{4})<\/td>/i.exec(row)?.[1] ?? null;
    const position = /<div class="por"><\/div>/i.test(row) ? 'G' : 'OUTFIELD';
    if (!externalId || !shortName || !fullName || !Number.isInteger(displayedRank) || displayedRank < 1) continue;

    rows.push({
      sourceRank: rows.length + 1,
      displayedRank,
      shortName,
      fullName,
      value,
      externalId,
      dateOfBirth,
      position
    });
  }

  if (rows.length < rankingCut) throw new Error(`BDFutbol LaLiga ${metric}: cobertura insuficiente para el top ${rankingCut} (${rows.length} filas)`);
  const top200 = rows.slice(0, rankingCut);
  const externalIds = new Set<string>();
  for (const [index, row] of top200.entries()) {
    const expectedRank = index + 1;
    if (row.sourceRank !== expectedRank || row.displayedRank !== expectedRank) {
      throw new Error(`BDFutbol LaLiga ${metric}: orden de ranking inválido en la fila ${expectedRank}`);
    }
    if (externalIds.has(row.externalId)) throw new Error(`BDFutbol LaLiga ${metric}: jugador duplicado ${row.externalId}`);
    externalIds.add(row.externalId);
    const previous = top200[index - 1];
    if (previous && row.value > previous.value) {
      throw new Error(`BDFutbol LaLiga ${metric}: valores fuera de orden en la fila ${expectedRank}`);
    }
    if (metric === 'clean_sheets' && row.position !== 'G') {
      throw new Error(`BDFutbol LaLiga clean_sheets: la fila ${expectedRank} no es portero`);
    }
  }
  return top200;
}

export async function fetchBdfutbolLaLigaRanking(metric: BdfutbolLaLigaRankingMetric, league: BdfutbolLeague = 'la-liga'): Promise<RankingInput> {
  if (league === 'premier-league') {
    throw new Error('BDFutbol rankingGEng1 mezcla la máxima categoría inglesa anterior a 1992; no es un ranking válido de la era Premier League. Usa la fuente oficial premier-league-official.');
  }
  const leagueInfo = leagueConfig[league];
  const metricPath = metric === 'goals' ? 'rankingG' : metric === 'clean_sheets' ? 'rankingPJNoEnc' : metric === 'yellow_cards' ? 'rankingTG' : 'rankingTV';
  const sourceUrl = new URL(`${metricPath}${leagueInfo.suffix}1.html`, baseUrl).toString();
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`BDFutbol ${league} ${metric} ${response.status}`);
  const rows = parseBdfutbolLaLigaRanking(await response.text(), metric);
  return {
    categorySlug: `${league}-${metric}`,
    source: {
      key: `bdfutbol-${league}-records`,
      name: `BDFutbol ${leagueInfo.label} historical player rankings`,
      sourceType: 'reference',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `bdfutbol-${league}-${metric}-top-${rankingCut}-${new Date().toISOString().slice(0, 10)}`,
    // BDFutbol exposes a maintained 250-row historical table. The parser
    // validates the first 200 rows as a complete top-200 slice (rank order,
    // unique player IDs and non-increasing values). This is structural
    // coverage for the game's top-200 ranking, not an approval of source
    // rights or a claim that the provider's whole universe is exhaustive.
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `bdfutbol:${league}:player:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.fullName,
      rawValue: row.value,
      evidence: {
        sourceRank: row.sourceRank,
        sourceDisplayedRank: row.displayedRank,
        sourceName: row.shortName,
        externalId: row.externalId,
        dateOfBirth: row.dateOfBirth,
        position: row.position,
        sourceUrl,
        scope: `Ranking histórico de ${leagueInfo.label} según BDFutbol: ${metric}; se conserva el top ${rankingCut} visible de una tabla de 250 filas`
      }
    }))
  };
}
