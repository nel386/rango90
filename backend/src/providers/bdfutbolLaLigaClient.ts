import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://www.bdfutbol.com/en/c/rankingG1.html';
const rankingCut = 200;

export type BdfutbolLaLigaGoalEntry = {
  sourceRank: number;
  displayedRank: number;
  shortName: string;
  fullName: string;
  goals: number;
  externalId: string;
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

export function parseBdfutbolLaLigaGoals(html: string): BdfutbolLaLigaGoalEntry[] {
  const rows: BdfutbolLaLigaGoalEntry[] = [];
  const rowPattern = /<tr\b[^>]*>[\s\S]*?<\/tr>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row = rowMatch[0];
    const rankMatch = /<td class="fit">\s*(\d+)\s*<\/td>/.exec(row);
    const playerLinks = [...row.matchAll(/<td class="text-left">\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/td>/g)];
    const goalsMatch = /<td class="text-nowrap">[\s\S]*?<a[^>]*>\s*(\d+)\s*<\/a>/.exec(row);
    if (!rankMatch || playerLinks.length < 2 || !goalsMatch) continue;
    const displayedRank = Number(rankMatch[1]);
    const externalId = new URL(playerLinks[0]?.[1] ?? '', sourceUrl).toString();
    const shortName = decodeHtml(playerLinks[0]?.[2] ?? '');
    const fullName = decodeHtml(playerLinks[1]?.[2] ?? '');
    const goals = Number(goalsMatch[1]);
    if (!externalId || !shortName || !fullName || !Number.isInteger(displayedRank) || !Number.isInteger(goals) || goals < 1) continue;
    rows.push({ sourceRank: rows.length + 1, displayedRank, shortName, fullName, goals, externalId });
  }
  return rows;
}

function validateTop200(rows: BdfutbolLaLigaGoalEntry[]): void {
  if (rows.length < rankingCut) throw new Error(`BDFutbol LaLiga: se esperaban al menos ${rankingCut} filas, llegaron ${rows.length}`);
  const ids = new Set<string>();
  let previousRank = 0;
  let previousGoals = Number.POSITIVE_INFINITY;
  for (const row of rows.slice(0, rankingCut)) {
    if (ids.has(row.externalId)) throw new Error(`BDFutbol LaLiga: jugador duplicado ${row.externalId}`);
    if (row.displayedRank < previousRank) throw new Error(`BDFutbol LaLiga: puesto fuera de orden ${row.displayedRank}`);
    if (row.goals > previousGoals) throw new Error(`BDFutbol LaLiga: goles fuera de orden en ${row.fullName}`);
    ids.add(row.externalId);
    previousRank = row.displayedRank;
    previousGoals = row.goals;
  }
}

export async function fetchBdfutbolLaLigaGoals(): Promise<RankingInput> {
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`BDFutbol LaLiga ${response.status}`);
  const parsed = parseBdfutbolLaLigaGoals(await response.text());
  if (parsed.length < rankingCut) throw new Error(`BDFutbol LaLiga: cobertura insuficiente para el top ${rankingCut} (${parsed.length} jugadores)`);
  const rows = parsed.slice(0, rankingCut);
  validateTop200(rows);
  return {
    categorySlug: 'la-liga-goals',
    source: {
      key: 'bdfutbol-la-liga-record-scorers',
      name: 'BDFutbol LaLiga first division goals',
      sourceType: 'reference',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `bdfutbol-la-liga-goals-top-${rankingCut}-${new Date().toISOString().slice(0, 10)}`,
    // The maintained table is validated as a complete ordered top-200 cut.
    // It is still a reference source and publication rights remain separate.
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `bdfutbol:la-liga:player:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.fullName,
      rawValue: row.goals,
      evidence: {
        sourceRank: row.sourceRank,
        sourceDisplayedRank: row.displayedRank,
        sourceName: row.shortName,
        externalId: row.externalId,
        sourceUrl,
        scope: 'Goles en Primera División española según el ranking histórico de BDFutbol; 200 jugadores únicos por orden de la tabla, conservando los empates del puesto visible'
      }
    }))
  };
}
