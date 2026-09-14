import type { RankingInput } from '../imports/rankingInput.js';

export const supercoppaItalianaTitlesUrl = 'https://www.legaseriea.it/supercoppa/albo';

export type SupercoppaItalianaTitleEntry = {
  sourceRank: number;
  name: string;
  titles: number;
  winnerSeasons: string[];
};

type ParsedClub = { name: string; titles: number; winnerSeasons: string[] };

const canonicalNames: Record<string, string> = {
  JUVENTUS: 'Juventus',
  INTER: 'Inter',
  MILAN: 'Milan',
  LAZIO: 'Lazio',
  NAPOLI: 'Napoli',
  ROMA: 'Roma',
  SAMPDORIA: 'Sampdoria',
  PARMA: 'Parma',
  FIORENTINA: 'Fiorentina'
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

function parseClubBlocks(html: string): ParsedClub[] {
  const text = visibleText(html);
  const marker = /(?:^|\s)([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 .'-]{1,40}?)\s+Totale vittorie:\s+(\d+)\s+Tutte le vittorie:\s+([\d -]+?)(?=\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 .'-]{1,40}?\s+Totale vittorie:|\s+Lega Serie A)/g;
  const clubs: ParsedClub[] = [];
  for (const match of text.matchAll(marker)) {
    const rawName = (match[1] ?? '').trim();
    const name = canonicalNames[rawName] ?? rawName;
    const titles = Number(match[2]);
    const winnerSeasons = (match[3] ?? '').match(/\d{4}-\d{2,4}/g) ?? [];
    if (!name || !Number.isInteger(titles) || titles <= 0) continue;
    clubs.push({ name, titles, winnerSeasons });
  }
  return clubs;
}

export function parseSupercoppaItalianaTitles(html: string, validateComplete = true): SupercoppaItalianaTitleEntry[] {
  const clubs = parseClubBlocks(html);
  if (validateComplete) {
    if (clubs.length !== 9) throw new Error(`Supercoppa Italiana: se esperaban 9 clubes campeones, llegaron ${clubs.length}`);
    if (new Set(clubs.map((club) => club.name)).size !== clubs.length) throw new Error('Supercoppa Italiana: club campeón duplicado');
    for (const club of clubs) {
      if (club.winnerSeasons.length !== club.titles) {
        throw new Error(`Supercoppa Italiana: temporadas inconsistentes para ${club.name} (${club.winnerSeasons.length}/${club.titles})`);
      }
      if (new Set(club.winnerSeasons).size !== club.winnerSeasons.length) {
        throw new Error(`Supercoppa Italiana: temporada duplicada para ${club.name}`);
      }
    }
    const totalTitles = clubs.reduce((sum, club) => sum + club.titles, 0);
    if (totalTitles !== 38) throw new Error(`Supercoppa Italiana: se esperaban 38 ediciones, llegaron ${totalTitles}`);
  }
  return clubs
    .sort((left, right) => right.titles - left.titles || left.name.localeCompare(right.name))
    .map((club, index) => ({ sourceRank: index + 1, ...club }));
}

function slugify(value: string): string {
  return value.toLocaleLowerCase('it-IT').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function fetchSupercoppaItalianaTitles(): Promise<RankingInput> {
  const response = await fetch(supercoppaItalianaTitlesUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Lega Serie A official Supercoppa palmares ${response.status}`);
  const rows = parseSupercoppaItalianaTitles(await response.text());
  const latestSeason = rows.flatMap((row) => row.winnerSeasons).sort().at(-1) ?? 'unknown';
  return {
    categorySlug: 'supercoppa-italiana-club-titles',
    source: {
      key: 'legaseriea-supercoppa-official',
      name: 'Lega Serie A official Supercoppa Italiana winners',
      sourceType: 'official',
      baseUrl: supercoppaItalianaTitlesUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `supercoppa-italiana-club-titles-${latestSeason}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `legaseriea:supercoppa:club:${slugify(row.name)}`,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: `legaseriea:supercoppa:club:${slugify(row.name)}`,
        sourceUrl: supercoppaItalianaTitlesUrl,
        winnerSeasons: row.winnerSeasons,
        scope: 'Palmarés oficial completo de la Supercoppa Italiana desde 1988/89 hasta la última edición publicada por la Lega Serie A',
        closedUniverse: true
      }
    }))
  };
}
