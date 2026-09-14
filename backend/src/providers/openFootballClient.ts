import type { RankingInput } from '../imports/rankingInput.js';

/**
 * OpenFootball publishes Football.TXT data under a public-domain dedication.
 * The parser is deliberately independent from the database so a downloaded
 * source snapshot can be validated before any entity or ranking is mutated.
 */
export const openFootballLicenseUrl = 'https://github.com/openfootball/leagues/blob/master/LICENSE.md';
export const openFootballLeaguesUrl = 'https://github.com/openfootball/leagues';

export type OpenFootballMatch = {
  date: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
};

export type OpenFootballTableRow = {
  team: string;
  played: number;
  points: number;
  goalDifference: number;
  goalsFor: number;
};

export type OpenFootballWinner = {
  winner: string | null;
  table: OpenFootballTableRow[];
  ambiguous: boolean;
};

export type OpenFootballSeasonSource = {
  competition: string;
  season: string;
  url: string;
};

const monthByName: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12
};

function parseSeasonStartYear(seasonLabel: string): number {
  const year = Number(seasonLabel.match(/\b(\d{4})\b/)?.[1]);
  if (!Number.isInteger(year) || year < 1800 || year > 2200) {
    throw new Error(`OpenFootball: etiqueta de temporada inválida: ${seasonLabel}`);
  }
  return year;
}

function parseDateLine(line: string, seasonStartYear: number): { month: number; day: number } | null {
  const match = line.trim().match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})$/);
  if (!match) return null;
  const month = monthByName[match[1]!];
  const day = Number(match[2]);
  if (!month || !Number.isInteger(day) || day < 1 || day > 31) return null;
  return { month, day };
}

function isoDate(dateParts: { month: number; day: number }, seasonStartYear: number): string {
  // Football.TXT seasonal files use the first year for July–December and the
  // second year for January–June. Calendar-year competitions pass a one-year
  // season label, for which this still produces the expected year.
  const year = dateParts.month < 7 ? seasonStartYear + 1 : seasonStartYear;
  const month = String(dateParts.month).padStart(2, '0');
  const day = String(dateParts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cleanTeamName(value: string): string {
  return value
    .replace(/^\s*\d{1,2}:\d{2}\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse match rows from a Football.TXT season file.
 *
 * It accepts both timed and untimed rows, ignores postponements and keeps
 * half-time scores out of the final result. A row without a preceding date is
 * rejected rather than assigned an invented date.
 */
export function parseFootballTxtResults(text: string, seasonLabel: string): OpenFootballMatch[] {
  const seasonStartYear = parseSeasonStartYear(seasonLabel);
  let currentDate: { month: number; day: number } | null = null;
  const matches: OpenFootballMatch[] = [];

  for (const [lineNumber, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trimEnd();
    const date = parseDateLine(line, seasonStartYear);
    if (date) {
      currentDate = date;
      continue;
    }
    if (!currentDate || line.trim().length === 0 || line.trimStart().startsWith('#') || line.includes('▪')) continue;

    // Football.TXT places the score between the home and away team names.
    // Require a final score with an optional half-time parenthesis; this
    // avoids accidentally parsing metadata, tables or postponed fixtures.
    const score = line.match(/^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s+(\d{1,3})-(\d{1,3})(?:\s+\([^)]*\))?\s+(.+?)\s*$/);
    if (!score) continue;
    const home = cleanTeamName(score[1]!);
    const homeGoals = Number(score[2]);
    const awayGoals = Number(score[3]);
    const away = cleanTeamName(score[4]!);
    if (!home || !away || home === away || !Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) {
      throw new Error(`OpenFootball: partido inválido en la línea ${lineNumber + 1}`);
    }
    matches.push({ date: isoDate(currentDate, seasonStartYear), home, away, homeGoals, awayGoals });
  }

  if (matches.length === 0) throw new Error(`OpenFootball: no se encontraron partidos para ${seasonLabel}`);
  return matches;
}

/**
 * Build a deterministic 3-points table. The result is only a candidate for
 * the title: historical competitions may use different point systems or
 * playoff rules, so callers must preserve this limitation in source evidence.
 */
export function calculateOpenFootballWinner(matches: OpenFootballMatch[]): OpenFootballWinner {
  if (matches.length === 0) throw new Error('OpenFootball: no se puede calcular una tabla vacía');
  const rows = new Map<string, OpenFootballTableRow>();
  const rowFor = (team: string): OpenFootballTableRow => {
    const existing = rows.get(team);
    if (existing) return existing;
    const created = { team, played: 0, points: 0, goalDifference: 0, goalsFor: 0 };
    rows.set(team, created);
    return created;
  };

  for (const match of matches) {
    const home = rowFor(match.home);
    const away = rowFor(match.away);
    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeGoals;
    away.goalsFor += match.awayGoals;
    home.goalDifference += match.homeGoals - match.awayGoals;
    away.goalDifference += match.awayGoals - match.homeGoals;
    if (match.homeGoals > match.awayGoals) home.points += 3;
    else if (match.homeGoals < match.awayGoals) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  const table = [...rows.values()].sort((left, right) =>
    right.points - left.points
      || right.goalDifference - left.goalDifference
      || right.goalsFor - left.goalsFor
      || left.team.localeCompare(right.team)
  );
  const first = table[0]!;
  const unresolved = table.filter((row) =>
    row.points === first.points && row.goalDifference === first.goalDifference && row.goalsFor === first.goalsFor
  );
  return { winner: unresolved.length === 1 ? first.team : null, table, ambiguous: unresolved.length > 1 };
}

export function buildOpenFootballClubTitleRanking(
  seasons: Array<{ competition: string; season: string; matches: OpenFootballMatch[]; sourceUrl?: string }>
): RankingInput {
  if (seasons.length === 0) throw new Error('OpenFootball: no hay temporadas para construir el ranking');
  const titleCounts = new Map<string, { clubName: string; titles: number; seasons: string[]; sourceUrls: string[]; competition: string }>();
  const ambiguousSeasons: string[] = [];
  for (const season of seasons) {
    const result = calculateOpenFootballWinner(season.matches);
    if (result.ambiguous || !result.winner) {
      ambiguousSeasons.push(`${season.competition}/${season.season}`);
      continue;
    }
    // Keep the source competition in the identity key. A name such as
    // "United" or "Rangers" can legitimately refer to different clubs in
    // different national competitions; merging them here would corrupt the
    // title total before identity review.
    const clubKey = `${season.competition}:${result.winner}`;
    const current = titleCounts.get(clubKey) ?? { clubName: result.winner, titles: 0, seasons: [], sourceUrls: [], competition: season.competition };
    current.titles += 1;
    current.seasons.push(season.season);
    if (season.sourceUrl) current.sourceUrls.push(season.sourceUrl);
    titleCounts.set(result.winner, current);
  }
  const entries = [...titleCounts.entries()]
    .sort((left, right) => right[1].titles - left[1].titles || left[0].localeCompare(right[0]))
    .map(([, value], index) => ({
      entityId: `openfootball:club:${value.competition}:${value.clubName.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-')}`,
      entityType: 'club' as const,
      name: value.clubName,
      rawValue: value.titles,
      evidence: {
        sourceRank: index + 1,
        competition: value.competition,
        titleSeasons: value.seasons,
        sourceUrls: value.sourceUrls,
        attributionRequired: false,
        calculation: 'Tabla 3 puntos: puntos, diferencia de goles, goles a favor; empates restantes excluidos para revisión manual.'
      }
    }));
  if (entries.length === 0) throw new Error('OpenFootball: no hay campeones deterministas');
  return {
    categorySlug: 'national-league-club-titles',
    source: {
      key: 'openfootball-leagues',
      name: 'OpenFootball leagues and Football.TXT',
      sourceType: 'reference',
      baseUrl: openFootballLeaguesUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `openfootball-domestic-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: false,
    allowPartialDraft: true,
    partialDraftReason: `Derivación experimental de resultados abiertos; faltan validar alcance mundial, sistema de puntos, playoffs, identidades y ${ambiguousSeasons.length} temporadas empatadas o no deterministas.`,
    reviewed: false,
    entries: entries.slice(0, 200)
  };
}
