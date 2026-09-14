import type { RankingInput } from '../imports/rankingInput.js';

export const dflSupercupTitlesUrl = 'https://www.bundesliga.com/en/bundesliga/news/history-of-supercup-records-goals-all-matches-bayern-dortmund-leipzig-20635';

export type DflSupercupTitleEntry = {
  sourceRank: number;
  name: string;
  titles: number;
  winnerYears: number[];
};

const canonicalNames: Record<string, string> = {
  'Bayern Munich': 'Bayern Munich',
  'Borussia Dortmund': 'Borussia Dortmund',
  'Werder Bremen': 'Werder Bremen',
  Kaiserslautern: 'Kaiserslautern',
  'VfB Stuttgart': 'VfB Stuttgart',
  Schalke: 'FC Schalke 04',
  Wolfsburg: 'Wolfsburg',
  'RB Leipzig': 'RB Leipzig',
  'Bayer Leverkusen': 'Bayer Leverkusen'
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
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

export function parseDflSupercupTitles(html: string, validateComplete = true): DflSupercupTitleEntry[] {
  const text = visibleText(html);
  const section = (text.match(/List of Supercup winners([\s\S]*?)(?=All Supercup matches since|$)/i)?.[1] ?? text)
    .replace(/[\u200b-\u200d\ufeff]/g, ' ');
  const rows: DflSupercupTitleEntry[] = [];
  const pattern = /([2-9]|[1-9]\d+) titles?:\s*([^()]+?)\s*\(([^)]+)\)/gi;
  for (const match of section.matchAll(pattern)) {
    const titles = Number(match[1]);
    const rawName = (match[2] ?? '').replace(/[\u200b\u200b]/g, '').trim();
    const name = canonicalNames[rawName] ?? rawName;
    const winnerYears = (match[3] ?? '').match(/\b(?:19|20)\d{2}\b/g)?.map(Number) ?? [];
    if (name && Number.isInteger(titles) && titles > 0 && winnerYears.length === titles) rows.push({ sourceRank: 0, name, titles, winnerYears });
  }
  const singleSection = section.match(/1 title:\s*([\s\S]*)/i)?.[1] ?? '';
  const singlePattern = /(?:^|,\s*)([^(),]+?)\s*\(\s*((?:19|20)\d{2})\s*\)/gi;
  for (const match of singleSection.matchAll(singlePattern)) {
    const rawName = (match[1] ?? '').replace(/[\u200b\u200b]/g, '').trim();
    const name = canonicalNames[rawName] ?? rawName;
    const winnerYears = match[2] ? [Number(match[2])] : [];
    if (name && winnerYears.length === 1) rows.push({ sourceRank: 0, name, titles: 1, winnerYears });
  }
  if (validateComplete) {
    if (rows.length !== 9) throw new Error(`DFL Supercup: se esperaban 9 clubes campeones, llegaron ${rows.length}`);
    if (new Set(rows.map((row) => row.name)).size !== rows.length) throw new Error('DFL Supercup: club campeón duplicado');
    if (rows.some((row) => row.winnerYears.length !== row.titles || new Set(row.winnerYears).size !== row.winnerYears.length)) {
      throw new Error('DFL Supercup: años de victoria inconsistentes');
    }
    if (rows.reduce((sum, row) => sum + row.titles, 0) !== 26) throw new Error('DFL Supercup: se esperaban 26 ediciones');
  }
  return rows
    .sort((left, right) => right.titles - left.titles || left.name.localeCompare(right.name))
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
}

function slugify(value: string): string {
  return value.toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function fetchDflSupercupTitles(): Promise<RankingInput> {
  const response = await fetch(dflSupercupTitlesUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Bundesliga official Supercup history ${response.status}`);
  const rows = parseDflSupercupTitles(await response.text());
  return {
    categorySlug: 'dfl-supercup-club-titles',
    source: {
      key: 'bundesliga-dfl-supercup-official',
      name: 'Bundesliga official DFL Supercup history',
      sourceType: 'official',
      baseUrl: dflSupercupTitlesUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `dfl-supercup-club-titles-${Math.max(...rows.flatMap((row) => row.winnerYears))}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `bundesliga:dfl-supercup:club:${slugify(row.name)}`,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: `bundesliga:dfl-supercup:club:${slugify(row.name)}`,
        sourceUrl: dflSupercupTitlesUrl,
        winnerYears: row.winnerYears,
        scope: 'Palmarés oficial completo del DFL/Franz Beckenbauer Supercup; ediciones 1987-1996 y 2010-2025, con la pausa 1997-2009 conservada en el alcance',
        closedUniverse: true
      }
    }))
  };
}
