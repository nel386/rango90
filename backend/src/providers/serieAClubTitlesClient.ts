import type { RankingInput } from '../imports/rankingInput.js';

export const serieAClubTitlesUrl = 'https://www.legaseriea.it/serie-a/albo';
export const bolognaPalmaresUrl = 'https://en.legaseriea.it/team/bologna/palmares';

export type SerieAClubTitleEntry = {
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
  GENOA: 'Genoa',
  BOL0GNA: 'Bologna',
  TORINO: 'Torino',
  'PRO VERCELLI': 'Pro Vercelli',
  NAPOLI: 'Napoli',
  ROMA: 'Roma',
  LAZIO: 'Lazio',
  FIORENTINA: 'Fiorentina',
  SAMPDORIA: 'Sampdoria',
  'HELLAS VERONA': 'Hellas Verona',
  CAGLIARI: 'Cagliari',
  CASALE: 'Casale',
  NOVESE: 'Novese'
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
  const marker = /\s([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 .'-]{1,40}?)\s+Totale vittorie:\s+(\d+)\s+Tutte le vittorie:\s+([\d -]+?)(?=\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 .'-]{1,40}?\s+Totale vittorie:|\s+Lega Serie A)/g;
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

export function parseSerieAClubTitles(html: string, validateComplete = true): SerieAClubTitleEntry[] {
  const clubs = parseClubBlocks(html);
  if (validateComplete) {
    if (clubs.length !== 16) throw new Error(`Serie A: se esperaban 16 clubes campeones, llegaron ${clubs.length}`);
    const names = new Set(clubs.map((club) => club.name));
    if (names.size !== clubs.length) throw new Error('Serie A: club campeón duplicado');
    for (const club of clubs) {
      if (club.winnerSeasons.length !== club.titles) {
        throw new Error(`Serie A: temporadas inconsistentes para ${club.name} (${club.winnerSeasons.length}/${club.titles})`);
      }
      if (new Set(club.winnerSeasons).size !== club.winnerSeasons.length) throw new Error(`Serie A: temporada duplicada para ${club.name}`);
    }
  }
  return clubs
    .sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name))
    .map((club, index) => ({ sourceRank: index + 1, ...club }));
}

function slugify(value: string): string {
  return value.toLocaleLowerCase('it-IT').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function bolognaCorrectionIsConfirmed(html: string): boolean {
  const text = visibleText(html);
  return /Bologna[\s\S]{0,500}\b7\s+Serie A\b[\s\S]{0,500}1963-64/.test(text);
}

export async function fetchSerieAClubTitles(): Promise<RankingInput> {
  const response = await fetch(serieAClubTitlesUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Lega Serie A official palmares ${response.status}`);
  const mainHtml = await response.text();
  const bolognaResponse = await fetch(bolognaPalmaresUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!bolognaResponse.ok) throw new Error(`Lega Serie A Bologna palmares ${bolognaResponse.status}`);
  const bolognaHtml = await bolognaResponse.text();
  if (!bolognaCorrectionIsConfirmed(bolognaHtml)) throw new Error('Serie A: no se pudo corroborar el séptimo título de Bologna de 1963/64');

  const rows = parseSerieAClubTitles(mainHtml, false);
  const bologna = rows.find((row) => row.name === 'Bologna');
  if (!bologna || bologna.titles !== 7 || bologna.winnerSeasons.length !== 6) {
    throw new Error(`Serie A: corrección esperada de Bologna no detectada (${JSON.stringify(bologna)})`);
  }
  bologna.winnerSeasons = [...bologna.winnerSeasons, '1963-64'].sort();
  const validated = parseSerieAClubTitles(mainHtml.replace(/1963-6\b/, '1963-64'), true);
  const latestSeason = validated.flatMap((row) => row.winnerSeasons).sort().at(-1) ?? 'unknown';
  return {
    categorySlug: 'serie-a-club-titles',
    source: {
      key: 'legaseriea-official-palmares',
      name: 'Lega Serie A official club palmares',
      sourceType: 'official',
      baseUrl: serieAClubTitlesUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `serie-a-club-titles-${latestSeason}`,
    coverageComplete: true,
    reviewed: false,
    entries: validated.map((row) => ({
      entityId: `legaseriea:club:${slugify(row.name)}`,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: `legaseriea:club:${slugify(row.name)}`,
        sourceUrl: serieAClubTitlesUrl,
        winnerSeasons: row.winnerSeasons,
        scope: 'Palmarés de clubes campeones de la Serie A italiana desde 1897/98 hasta la última temporada completada publicada por la Lega Serie A',
        closedUniverse: true,
        corroboration: row.name === 'Bologna' ? { sourceUrl: bolognaPalmaresUrl, note: 'La página general muestra 1963-6; la ficha oficial de Bologna confirma 1963-64 y siete títulos.' } : undefined
      }
    }))
  };
}
