import type { RankingInput } from '../imports/rankingInput.js';

export const dfbPokalWinnersUrl = 'https://www.dfb.de/maenner/wettbewerbe/dfb-pokal/statistik/bisherige-sieger';

export type DfbPokalClubTitleEntry = {
  sourceRank: number;
  name: string;
  titles: number;
  winnerSeasons: string[];
};

type WinnerSeason = { season: string; name: string };

// The DFB page uses both the current and historical official club names.
// These two changes are the same sporting club and must not create duplicate
// rows in the title ranking.
const canonicalNames: Record<string, string> = {
  'SV Werder Bremen': 'Werder Bremen',
  'Bayer 04 Leverkusen': 'Bayer Leverkusen'
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

function textFromHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '));
}

function normalizeTeamName(value: string): string {
  const normalized = canonicalNames[value.trim()] ?? value.trim();
  return normalized;
}

function parseWinnerRows(html: string): WinnerSeason[] {
  const rows: WinnerSeason[] = [];
  for (const match of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(match[1] ?? '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((cell) => textFromHtml(cell[1] ?? ''));
    const season = cells[0]?.match(/^(\d{4})\/(\d{4})$/);
    const winner = cells[1];
    if (!season || !winner || winner.length === 0) continue;
    rows.push({ season: `${season[1]}/${season[2]}`, name: normalizeTeamName(winner) });
  }
  return rows.sort((a, b) => Number(a.season.slice(0, 4)) - Number(b.season.slice(0, 4)));
}

function seasonStartYear(season: string): number {
  return Number(season.slice(0, 4));
}

function validateWinnerSeasons(rows: WinnerSeason[]): void {
  if (rows.length < 83) throw new Error(`DFB-Pokal: historial incompleto (${rows.length} temporadas; se esperaban al menos 83)`);
  const seasons = rows.map((row) => row.season);
  if (new Set(seasons).size !== seasons.length) throw new Error('DFB-Pokal: temporada duplicada');
  if (seasons[0] !== '1934/1935') throw new Error(`DFB-Pokal: primera temporada inesperada ${seasons[0]}`);
  const latestStartYear = seasonStartYear(seasons.at(-1) ?? '0/0');
  if (latestStartYear < 2025) throw new Error(`DFB-Pokal: historial no actualizado, última temporada ${seasons.at(-1)}`);

  const expectedYears = [
    ...Array.from({ length: 9 }, (_, index) => 1934 + index),
    ...Array.from({ length: latestStartYear - 1952 + 1 }, (_, index) => 1952 + index)
  ];
  const actualYears = rows.map((row) => seasonStartYear(row.season)).sort((a, b) => a - b);
  if (actualYears.length !== expectedYears.length || actualYears.some((year, index) => year !== expectedYears[index])) {
    throw new Error(`DFB-Pokal: temporadas incompletas o inesperadas (${seasons.join(', ')})`);
  }
}

function slugify(value: string): string {
  return value.toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseDfbPokalWinners(html: string, validateComplete = true): DfbPokalClubTitleEntry[] {
  const seasons = parseWinnerRows(html);
  if (validateComplete) validateWinnerSeasons(seasons);
  const winnerSeasons = new Map<string, string[]>();
  for (const row of seasons) winnerSeasons.set(row.name, [...(winnerSeasons.get(row.name) ?? []), row.season]);
  return [...winnerSeasons.entries()]
    .map(([name, winnerSeasonList]) => ({ name, titles: winnerSeasonList.length, winnerSeasons: winnerSeasonList, sourceRank: 0 }))
    .sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
}

export async function fetchDfbPokalClubTitles(): Promise<RankingInput> {
  const response = await fetch(dfbPokalWinnersUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`DFB-Pokal official winners ${response.status}`);
  const rows = parseDfbPokalWinners(await response.text());
  const latestSeason = rows.flatMap((row) => row.winnerSeasons).sort().at(-1) ?? 'unknown';
  return {
    categorySlug: 'dfb-pokal-club-titles',
    source: {
      key: 'dfb-pokal-official',
      name: 'DFB official DFB-Pokal winners history',
      sourceType: 'official',
      baseUrl: dfbPokalWinnersUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `dfb-pokal-club-titles-${latestSeason}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `dfb:dfb-pokal:club:${slugify(row.name)}`,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: `dfb-pokal:club:${slugify(row.name)}`,
        sourceUrl: dfbPokalWinnersUrl,
        winnerSeasons: row.winnerSeasons,
        scope: 'Palmarés masculino que la DFB publica como DFB-Pokal desde 1934/35 hasta la última temporada completada; el período 1943/44–1951/52 no tuvo edición incluida en la tabla oficial',
        closedUniverse: true
      }
    }))
  };
}
