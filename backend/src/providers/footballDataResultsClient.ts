import { asyncBufferFromUrl, parquetReadObjects } from 'hyparquet';
import type { RankingInput } from '../imports/rankingInput.js';
import { calculateOpenFootballWinner, type OpenFootballMatch } from './openFootballClient.js';

export const footballDataResultsUrl = 'https://raw.githubusercontent.com/schochastics/football-data/master/data/results/games.parquet';
export const footballDataRepositoryUrl = 'https://github.com/schochastics/football-data';
export const footballDataLicenseUrl = 'https://opendatacommons.org/licenses/odbl/1-0/';

export type FootballDataResult = OpenFootballMatch & {
  competition: string;
  level: string;
};

export type FootballDataSeasonWinner = {
  competition: string;
  season: string;
  seasonStartYear: number;
  clubName: string;
  sourceUrl: string;
  derivation: 'reconstructed_table';
  status: 'deterministic' | 'ambiguous';
  ambiguityReason?: string;
};

type ParquetResult = {
  date?: unknown;
  competition?: unknown;
  level?: unknown;
  home_ident?: unknown;
  away_ident?: unknown;
  gh?: unknown;
  ga?: unknown;
};

const excludedCompetitions = new Set(['copa sud', 'ofc cc', 'null', 'ddr']);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function score(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function date(value: unknown): string | null {
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function normalizeFootballDataResult(row: ParquetResult): FootballDataResult | null {
  const competition = text(row.competition);
  const level = text(row.level);
  const home = text(row.home_ident);
  const away = text(row.away_ident);
  const matchDate = date(row.date);
  const homeGoals = score(row.gh);
  const awayGoals = score(row.ga);
  if (!competition || !level || !home || !away || !matchDate || homeGoals === null || awayGoals === null) return null;
  return { date: matchDate, competition, level, home, away, homeGoals, awayGoals };
}

export async function fetchFootballDataResults(url = footballDataResultsUrl): Promise<FootballDataResult[]> {
  const file = await asyncBufferFromUrl({
    url,
    requestInit: { headers: { 'User-Agent': 'Rango90-football-data-import/0.1' } }
  });
  const rows = await parquetReadObjects({
    file,
    columns: ['date', 'competition', 'level', 'home_ident', 'away_ident', 'gh', 'ga']
  });
  return rows.map((row) => normalizeFootballDataResult(row as ParquetResult)).filter((row): row is FootballDataResult => row !== null);
}

function seasonStartYear(season: string): number {
  return Number(season);
}

function seasonGroups(matches: FootballDataResult[], mode: 'calendar' | 'july-to-june'): Map<string, FootballDataResult[]> {
  const groups = new Map<string, FootballDataResult[]>();
  for (const match of matches) {
    const year = Number(match.date.slice(0, 4));
    const month = Number(match.date.slice(5, 7));
    const season = mode === 'calendar' ? year : month >= 7 ? year : year - 1;
    const key = String(season);
    const group = groups.get(key) ?? [];
    group.push(match);
    groups.set(key, group);
  }
  return groups;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]!;
}

function selectSeasonMode(matches: FootballDataResult[]): 'calendar' | 'july-to-june' {
  const calendar = seasonGroups(matches, 'calendar');
  const julyToJune = seasonGroups(matches, 'july-to-june');
  return median([...julyToJune.values()].map((group) => group.length)) > median([...calendar.values()].map((group) => group.length))
    ? 'july-to-june'
    : 'calendar';
}

function isDomesticTopFlightCandidate(match: FootballDataResult): boolean {
  return match.level === 'national' && !excludedCompetitions.has(match.competition.toLocaleLowerCase('en-US'));
}

function slug(value: string): string {
  return value.toLocaleLowerCase('en-US').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buildFootballDataNationalLeagueRanking(
  matches: FootballDataResult[],
  options: { sourceVersion?: string; sourceUrl?: string; now?: Date } = {}
): RankingInput {
  const now = options.now ?? new Date();
  const currentYear = now.getUTCFullYear();
  const domesticByCompetition = new Map<string, FootballDataResult[]>();
  for (const match of matches.filter(isDomesticTopFlightCandidate)) {
    const group = domesticByCompetition.get(match.competition) ?? [];
    group.push(match);
    domesticByCompetition.set(match.competition, group);
  }

  const titleCounts = new Map<string, { clubName: string; competition: string; titles: number; seasons: string[] }>();
  const diagnostics = { domesticRows: 0, competitions: domesticByCompetition.size, candidateSeasons: 0, acceptedSeasons: 0, skippedIncompleteSeasons: 0 };
  for (const [competition, competitionMatches] of domesticByCompetition) {
    const mode = selectSeasonMode(competitionMatches);
    for (const [season, seasonMatches] of seasonGroups(competitionMatches, mode)) {
      diagnostics.candidateSeasons += 1;
      const seasonYear = seasonStartYear(season);
      const completeByDate = mode === 'july-to-june' ? seasonYear < currentYear - 1 : seasonYear < currentYear;
      const teams = new Set(seasonMatches.flatMap((match) => [match.home, match.away]));
      if (!completeByDate || seasonMatches.length < 20 || teams.size < 4) {
        diagnostics.skippedIncompleteSeasons += 1;
        continue;
      }
      diagnostics.domesticRows += seasonMatches.length;
      const winner = calculateOpenFootballWinner(seasonMatches);
      if (!winner.winner) {
        diagnostics.skippedIncompleteSeasons += 1;
        continue;
      }
      diagnostics.acceptedSeasons += 1;
      const key = `${competition}:${winner.winner}`;
      const current = titleCounts.get(key) ?? { clubName: winner.winner, competition, titles: 0, seasons: [] };
      current.titles += 1;
      current.seasons.push(season);
      titleCounts.set(key, current);
    }
  }

  const entries = [...titleCounts.values()]
    .sort((left, right) => right.titles - left.titles || `${left.competition}:${left.clubName}`.localeCompare(`${right.competition}:${right.clubName}`))
    .slice(0, 200)
    .map((value, index) => ({
      entityId: `football-data:club:${slug(value.competition)}:${slug(value.clubName)}`,
      entityType: 'club' as const,
      name: value.clubName,
      rawValue: value.titles,
      evidence: {
        sourceRank: index + 1,
        competition: value.competition,
        titleSeasons: value.seasons,
        sourceUrl: options.sourceUrl ?? footballDataResultsUrl,
        calculation: 'Candidato derivado de resultados: 3 puntos por victoria, 1 por empate, diferencia de goles y goles a favor. Requiere contraste con la clasificación oficial y resolución de cambios de identidad.'
      }
    }));

  return {
    categorySlug: 'national-league-club-titles',
    source: {
      key: 'schochastics-football-data',
      name: 'schochastics football-data results',
      sourceType: 'reference',
      baseUrl: options.sourceUrl ?? footballDataRepositoryUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `schochastics-football-data-domestic-titles-${options.sourceVersion ?? now.toISOString().slice(0, 10)}`,
    coverageComplete: false,
    allowPartialDraft: true,
    partialDraftReason: 'Ranking candidato derivado de resultados con licencia de atribución: faltan contrastar campeones históricos, sistemas de desempate, identidades de clubes, cobertura de ligas y derechos de redistribución.',
    reviewed: false,
    audit: {
      sourceRepository: footballDataRepositoryUrl,
      sourceLicenseUrl: footballDataLicenseUrl,
      sourceVersion: options.sourceVersion ?? null,
      ...diagnostics,
      outputEntries: entries.length
    },
    entries
  };
}

/**
 * Expose the season-level observations used by the ranking builder so a
 * second provider can contrast them before totals are accumulated. No row is
 * invented for an incomplete or ambiguous season.
 */
export function deriveFootballDataSeasonWinners(
  matches: FootballDataResult[],
  options: { now?: Date; sourceUrl?: string } = {}
): FootballDataSeasonWinner[] {
  const now = options.now ?? new Date();
  const currentYear = now.getUTCFullYear();
  const winners: FootballDataSeasonWinner[] = [];
  const domesticByCompetition = new Map<string, FootballDataResult[]>();
  for (const match of matches.filter(isDomesticTopFlightCandidate)) {
    const group = domesticByCompetition.get(match.competition) ?? [];
    group.push(match);
    domesticByCompetition.set(match.competition, group);
  }
  for (const [competition, competitionMatches] of domesticByCompetition) {
    const mode = selectSeasonMode(competitionMatches);
    for (const [season, seasonMatches] of seasonGroups(competitionMatches, mode)) {
      const startYear = seasonStartYear(season);
      const completeByDate = mode === 'july-to-june' ? startYear < currentYear - 1 : startYear < currentYear;
      const teams = new Set(seasonMatches.flatMap((match) => [match.home, match.away]));
      if (!completeByDate || seasonMatches.length < 20 || teams.size < 4) continue;
      const winner = calculateOpenFootballWinner(seasonMatches);
      if (!winner.winner) {
        winners.push({
          competition,
          season,
          seasonStartYear: startYear,
          clubName: '',
          sourceUrl: options.sourceUrl ?? footballDataResultsUrl,
          derivation: 'reconstructed_table',
          status: 'ambiguous',
          ambiguityReason: 'El desempate reconstruido no produce un campeón único'
        });
        continue;
      }
      winners.push({
        competition,
        season,
        seasonStartYear: startYear,
        clubName: winner.winner,
        sourceUrl: options.sourceUrl ?? footballDataResultsUrl,
        derivation: 'reconstructed_table',
        status: 'deterministic'
      });
    }
  }
  return winners.sort((left, right) => left.competition.localeCompare(right.competition) || left.seasonStartYear - right.seasonStartYear || left.season.localeCompare(right.season));
}
