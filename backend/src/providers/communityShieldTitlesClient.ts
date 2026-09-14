import type { RankingInput } from '../imports/rankingInput.js';

/**
 * RSSSF maintains the complete historical match list. The FA's own history
 * page establishes the competition's origin and format, but does not expose a
 * machine-readable all-time winners table. Keep RSSSF as a reference source
 * and leave rights review separate from statistical validation.
 */
export const communityShieldTitlesSourceUrl = 'https://www.rsssf.org/tablese/engsupcuphist.html';
export const communityShieldOfficialContextUrl = 'https://www.thefa.com/competitions/the-fa-community-shield/more/history';

type Match = {
  year: number;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  shootoutWinner: 'home' | 'away' | null;
  shared: boolean;
};

export type CommunityShieldClubTitleEntry = {
  sourceRank: number;
  name: string;
  titles: number;
  winnerYears: number[];
};

// Use the already-known club namespaces where possible. Clubs which predate
// the Premier League use the FA Cup namespace created by the FA Cup import.
const clubIds: Record<string, string> = {
  Arsenal: 'pl:club:1',
  'Aston Villa': 'pl:club:2',
  'Blackburn Rovers': 'pl:club:blackburn-rovers',
  'Bolton Wanderers': 'fa:club:bolton-wanderers',
  Brighton: 'pl:club:131',
  'Brighton & Hove Albion': 'pl:club:131',
  Burnley: 'fa:club:burnley',
  'Cardiff City': 'fa:club:cardiff-city',
  Chelsea: 'pl:club:4',
  'Crystal Palace': 'pl:club:6',
  'Derby County': 'fa:club:derby-county',
  Everton: 'pl:club:7',
  'Huddersfield Town': 'fa:club:huddersfield-town',
  'Leeds United': 'pl:club:9',
  'Leicester City': 'pl:club:leicester-city',
  Liverpool: 'pl:club:10',
  'Manchester City': 'pl:club:11',
  'Manchester United': 'pl:club:12',
  'Newcastle United': 'pl:club:23',
  'Nottingham Forest': 'pl:club:15',
  Portsmouth: 'fa:club:portsmouth',
  'Sheffield Wednesday': 'fa:club:sheffield-wednesday',
  Sunderland: 'pl:club:29',
  'Tottenham Hotspur': 'pl:club:21',
  'West Bromwich Albion': 'fa:club:west-bromwich-albion',
  'West Ham United': 'fa:club:west-ham-united',
  'Wolverhampton Wanderers': 'fa:club:wolverhampton-wanderers'
};

const aliases: Record<string, string> = {
  'The Wednesday': 'Sheffield Wednesday'
};

const nonClubParticipants = new Set([
  'Amateurs',
  'Canadian Touring Team',
  'Corinthians',
  'FA XI',
  'Professionals',
  'World Cup Team'
]);

function normalizeName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean === 'World Cup Team') return 'World Cup Team';
  if (clean.startsWith('World Cup Team ')) return 'World Cup Team';
  if (clean.startsWith('Canadian Touring Team')) return 'Canadian Touring Team';
  return aliases[clean] ?? clean;
}

function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function parseScore(value: string): number {
  const score = value.split(':', 1)[0];
  const parsed = Number(score);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`Community Shield: marcador inválido ${value}`);
  return parsed;
}

function section(html: string, heading: string, nextHeading: string): string {
  const plain = stripMarkup(html);
  const lines = plain.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  const nextIndex = lines.findIndex((line, index) => index > headingIndex && line.trim().startsWith(nextHeading));
  if (headingIndex < 0 || nextIndex <= headingIndex) throw new Error(`RSSSF: no se encontró la sección ${heading}`);
  return lines.slice(headingIndex + 1, nextIndex).join('\n');
}

function parseMatchLines(block: string): Match[] {
  const matches: Match[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^(\d{4})(\*)?\s+(.+?)\s+(\d+(?::\d+)?)\s+(.+?)\s+(\d+(?::\d+)?)(?:\s+\(([^)]*)\))?\s*$/);
    if (!match) continue;
    const year = Number(match[1]);
    const home = normalizeName(match[3]!);
    const away = normalizeName(match[5]!);
    if (year < 1908 || year > 2100 || !home || !away) continue;

    // RSSSF renders the two 1908 matches on one line. The FA history confirms
    // that Manchester United won the replay, so represent the edition once.
    if (year === 1908) {
      matches.push({ year, home: 'Manchester United', away: "Queen's Park Rangers", homeScore: 4, awayScore: 0, shootoutWinner: null, shared: false });
      continue;
    }
    const homeScore = parseScore(match[4]!);
    const awayScore = parseScore(match[6]!);
    const detail = match[7] ?? '';
    const shootout = detail.match(/(\d+)\s*-\s*(\d+)\s*pen/i);
    const shootoutWinner = shootout ? (Number(shootout[1]) > Number(shootout[2]) ? 'home' : 'away') : null;
    matches.push({ year, home, away, homeScore, awayScore, shootoutWinner, shared: Boolean(match[2]) });
  }
  return matches;
}

function winnerNames(match: Match): string[] {
  if (match.shared && match.homeScore === match.awayScore && !match.shootoutWinner) return [match.home, match.away];
  if (match.homeScore === match.awayScore && match.shootoutWinner) return [match.shootoutWinner === 'home' ? match.home : match.away];
  if (match.homeScore === match.awayScore) throw new Error(`Community Shield: empate sin resolución en ${match.year}`);
  return [match.homeScore > match.awayScore ? match.home : match.away];
}

export function parseCommunityShieldMatches(html: string, validateComplete = true): Match[] {
  const charity = section(html, 'FA Charity Shield', 'FA Community Shield');
  const community = section(html, 'FA Community Shield', 'Summary');
  const matches = [...parseMatchLines(charity), ...parseMatchLines(community)].sort((a, b) => a.year - b.year);
  const expectedYears = Array.from({ length: 119 }, (_, index) => 1908 + index)
    .filter((year) => !(year >= 1914 && year <= 1919) && !(year >= 1939 && year <= 1947));
  if (validateComplete && (matches.length !== expectedYears.length || matches.some((match, index) => match.year !== expectedYears[index]))) {
    throw new Error(`RSSSF Community Shield: historial incompleto (${matches.length} ediciones; se esperaban ${expectedYears.length})`);
  }
  return matches;
}

export function buildCommunityShieldRanking(matches: Match[]): RankingInput {
  const winnerYears = new Map<string, number[]>();
  for (const match of matches) {
    for (const winner of winnerNames(match)) {
      if (nonClubParticipants.has(winner)) continue;
      const canonicalName = normalizeName(winner);
      const years = winnerYears.get(canonicalName) ?? [];
      years.push(match.year);
      winnerYears.set(canonicalName, years);
    }
  }
  const rows = [...winnerYears.entries()]
    .map(([name, years]) => ({ name, years }))
    .sort((a, b) => b.years.length - a.years.length || a.name.localeCompare(b.name, 'en'));
  if (rows.some((row) => !clubIds[row.name])) throw new Error(`Community Shield: club no reconocido (${rows.find((row) => !clubIds[row.name])?.name})`);
  return {
    categorySlug: 'community-shield-club-titles',
    source: {
      key: 'rsssf-fa-community-shield',
      name: 'RSSSF — FA Charity/Community Shield historical match list',
      sourceType: 'reference',
      baseUrl: communityShieldTitlesSourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: 'fa-community-shield-club-titles-2026',
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row, index) => ({
      entityId: clubIds[row.name]!,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.years.length,
      evidence: {
        sourceRank: index + 1,
        sourceUrl: communityShieldTitlesSourceUrl,
        officialContextUrl: communityShieldOfficialContextUrl,
        winnerYears: row.years,
        scope: 'FA Charity Shield / FA Community Shield, ediciones celebradas de 1908 a 2026; se excluyen equipos representativos y selecciones no club'
      }
    }))
  };
}

export async function fetchCommunityShieldClubTitles(): Promise<RankingInput> {
  const response = await fetch(communityShieldTitlesSourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`RSSSF Community Shield ${response.status}`);
  return buildCommunityShieldRanking(parseCommunityShieldMatches(await response.text()));
}
