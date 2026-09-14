import type { RankingInput } from '../imports/rankingInput.js';

export const faCupFinalsUrl = 'https://www.thefa.com/competitions/thefacup/fa-cup-finals';
export const faCupWinnersStoryUrl = 'https://thefa.shorthandstories.com/fa-cup-finals-the-winners-list/';

export type FaCupClubTitleEntry = {
  sourceRank: number;
  name: string;
  titles: number;
  winnerSeasons: number[];
};

type Final = { year: number; winner: string };

const stableClubIds: Record<string, string> = {
  Arsenal: 'pl:club:1',
  'Aston Villa': 'pl:club:2',
  'Blackburn Rovers': 'pl:club:blackburn-rovers',
  Chelsea: 'pl:club:4',
  'Coventry City': 'pl:club:5',
  'Crystal Palace': 'pl:club:6',
  Everton: 'pl:club:7',
  'Ipswich Town': 'pl:club:8',
  'Leeds United': 'pl:club:9',
  'Leicester City': 'pl:club:leicester-city',
  Liverpool: 'pl:club:10',
  'Manchester City': 'pl:club:11',
  'Manchester United': 'pl:club:12',
  'Newcastle United': 'pl:club:23',
  'Nottingham Forest': 'pl:club:15',
  Sunderland: 'pl:club:29',
  'Tottenham Hotspur': 'pl:club:21'
};

const expectedCounts: Record<string, number> = {
  Arsenal: 14,
  'Manchester United': 13,
  'Manchester City': 8,
  Chelsea: 8,
  Liverpool: 8,
  'Tottenham Hotspur': 8,
  'Aston Villa': 7,
  'Newcastle United': 6,
  'Blackburn Rovers': 6,
  Everton: 5,
  'West Bromwich Albion': 5,
  Wanderers: 5,
  'Bolton Wanderers': 4,
  'Wolverhampton Wanderers': 4,
  'West Ham United': 3,
  'Sheffield Wednesday': 3,
  'Sheffield United': 4,
  Bury: 2,
  'Nottingham Forest': 2,
  Portsmouth: 2,
  'Preston North End': 2,
  Sunderland: 2,
  'Old Etonians': 2,
  Barnsley: 1,
  'Blackburn Olympic': 1,
  Blackpool: 1,
  'Bradford City': 1,
  Burnley: 1,
  'Cardiff City': 1,
  'Charlton Athletic': 1,
  'Clapham Rovers': 1,
  'Coventry City': 1,
  'Crystal Palace': 1,
  'Derby County': 1,
  'Huddersfield Town': 1,
  'Ipswich Town': 1,
  'Leeds United': 1,
  'Leicester City': 1,
  'Old Carthusians': 1,
  'Oxford University': 1,
  'Notts County': 1,
  'Royal Engineers': 1,
  Southampton: 1,
  'Wigan Athletic': 1,
  Wimbledon: 1
};

const pageTeamNames = [
  ...Object.keys(expectedCounts),
  'Birmingham City',
  'Brighton and Hove Albion',
  'Bristol City',
  'Fulham',
  'Hull City',
  'Luton Town',
  'Millwall',
  'Middlesbrough',
  'Notts County',
  'Queens Park, Glasgow',
  'Queens Park Rangers',
  'Stoke City',
  'Watford'
].sort((a, b) => b.length - a.length);

const canonicalNames: Record<string, string> = {
  'Queens Park, Glasgow': 'Queens Park'
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

function htmlToLines(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map(decodeHtml)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeTeamName(value: string): string {
  const withoutMarkers = value.replace(/[*)]+$/g, '').trim();
  return canonicalNames[withoutMarkers] ?? withoutMarkers;
}

function parseScoreLine(value: string): { home: string; homeGoals: number; away: string; awayGoals: number } | null {
  const match = value.match(/^(?:Replay:\s*)?(.+?)\s+(\d+)\s*-\s*(\d+)\s*(.*)$/i);
  if (!match) return null;
  const home = normalizeTeamName(match[1] ?? '');
  const homeGoals = Number(match[2]);
  const awayGoals = Number(match[3]);
  const rest = (match[4] ?? '').trim();
  const rawAway = pageTeamNames.find((name) => rest.startsWith(name));
  if (!rawAway || !Number.isInteger(homeGoals) || !Number.isInteger(awayGoals)) return null;
  return { home, homeGoals, away: normalizeTeamName(rawAway), awayGoals };
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function winnerFromTie(line: string, nextLine: string | undefined, game: NonNullable<ReturnType<typeof parseScoreLine>>): string | null {
  if (game.homeGoals !== game.awayGoals) return game.homeGoals > game.awayGoals ? game.home : game.away;
  const replay = nextLine?.match(/^Replay:\s*(.*)$/i)?.[1];
  const replayGame = replay ? parseScoreLine(`Replay: ${replay}`) : null;
  if (replayGame && replayGame.homeGoals !== replayGame.awayGoals) {
    return replayGame.homeGoals > replayGame.awayGoals ? replayGame.home : replayGame.away;
  }
  const penaltyWinner = pageTeamNames.find((name) => new RegExp(`${escaped(name)}\\s+win\\b`, 'i').test(line));
  return penaltyWinner ? normalizeTeamName(penaltyWinner) : null;
}

function slugify(value: string): string {
  return value.toLocaleLowerCase('en-US').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function expectedFinalYears(): number[] {
  return Array.from({ length: 155 }, (_, index) => 2026 - index)
    .filter((year) => !(year >= 1916 && year <= 1919) && !(year >= 1940 && year <= 1945))
    .sort((a, b) => a - b);
}

export function parseFaCupFinals(html: string, validateComplete = true): FaCupClubTitleEntry[] {
  const lines = htmlToLines(html);
  const finalByYear = new Map<number, Final>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const yearMatch = line.match(/((?:18|19|20)\d{2})\s*:\s*(.+)$/);
    if (!yearMatch) continue;
    const year = Number(yearMatch[1]);
    if (year < 1872 || year > 2026) continue;
    const game = parseScoreLine(yearMatch[2] ?? '');
    if (!game) continue;
    const winner = winnerFromTie(line, lines[index + 1], game);
    if (!winner) throw new Error(`The FA: no se pudo determinar el ganador de ${year}`);
    finalByYear.set(year, { year, winner });
  }

  const finals = [...finalByYear.values()].sort((a, b) => a.year - b.year);
  const expectedYears = expectedFinalYears();
  if (validateComplete && (finals.length !== expectedYears.length || finals.some((final, index) => final.year !== expectedYears[index]))) {
    throw new Error(`The FA: historial incompleto o inesperado (${finals.length} finales; se esperaban ${expectedYears.length})`);
  }

  const seasons = new Map<string, number[]>();
  for (const final of finals) seasons.set(final.winner, [...(seasons.get(final.winner) ?? []), final.year]);
  const counts = Object.fromEntries([...seasons.entries()].map(([name, years]) => [name, years.length]));
  if (validateComplete) {
    const namesMatch = Object.keys(counts).length === Object.keys(expectedCounts).length
      && Object.entries(expectedCounts).every(([name, count]) => counts[name] === count);
    if (!namesMatch) throw new Error(`The FA: palmarés inesperado ${JSON.stringify(counts)}`);
  }

  return Object.entries(counts)
    .map(([name, titles]) => ({ sourceRank: 0, name, titles, winnerSeasons: seasons.get(name) ?? [] }))
    .sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name))
    .map((entry, index) => ({ ...entry, sourceRank: index + 1 }));
}

export async function fetchFaCupClubTitles(): Promise<RankingInput> {
  const response = await fetch(faCupWinnersStoryUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`The FA official FA Cup finals ${response.status}`);
  const rows = parseFaCupFinals(await response.text());
  return {
    categorySlug: 'fa-cup-club-titles',
    source: {
      key: 'fa-cup-official',
      name: 'The FA official FA Cup finals',
      sourceType: 'official',
      baseUrl: faCupFinalsUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `fa-cup-club-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: stableClubIds[row.name] ?? `fa:club:${slugify(row.name)}`,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: row.sourceRank,
        sourceUrl: faCupFinalsUrl,
        winnersStoryUrl: faCupWinnersStoryUrl,
        externalId: `fa-cup:club:${slugify(row.name)}`,
        winnerSeasons: row.winnerSeasons,
        scope: 'FA Cup masculina; finales oficiales desde 1872 hasta 2026; temporadas canceladas 1916-1919 y 1940-1945 excluidas',
        closedUniverse: true
      }
    }))
  };
}
