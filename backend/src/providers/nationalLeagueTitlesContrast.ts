import type { RankingInput } from '../imports/rankingInput.js';

export type NationalLeagueTitleObservation = {
  source: 'openfootball' | 'football-data' | 'official' | 'api-football';
  sourceUrl: string;
  competition: string;
  season: string;
  seasonStartYear: number;
  clubName: string;
  derivation: 'official_champions_list' | 'reconstructed_table';
  status?: 'deterministic' | 'ambiguous';
  ambiguityReason?: string;
};

export type ContrastedNationalLeagueSeason = {
  key: string;
  competition: string;
  seasonStartYear: number;
  observations: NationalLeagueTitleObservation[];
  status: 'confirmed' | 'single_source' | 'conflict' | 'ambiguous';
  clubName?: string;
};

export type NationalLeagueAlternative = {
  slug: string;
  label: string;
  equivalence: 'same_metric_open_universe' | 'different_metric_closed_universe' | 'different_scope_open_universe';
  reason: string;
};

export const nationalLeagueClubTitleAlternatives: readonly NationalLeagueAlternative[] = [
  {
    slug: 'club-global-titles',
    label: 'Títulos globales de clubes',
    equivalence: 'same_metric_open_universe',
    reason: 'Mantiene clubes y títulos, pero suma competiciones de clubes y no solo primeras divisiones nacionales; requiere completar el universo y deduplicar épocas.'
  },
  {
    slug: 'european-cup-champions-league-club-titles',
    label: 'Títulos de Copa de Europa / Champions League',
    equivalence: 'different_metric_closed_universe',
    reason: 'Es una alternativa de clubes ya contrastable con universo cerrado; no sustituye la semántica de títulos nacionales y actualmente tiene 24 ganadores.'
  },
  {
    slug: 'concacaf-champions-cup-club-titles',
    label: 'Títulos de Concacaf Champions Cup',
    equivalence: 'different_metric_closed_universe',
    reason: 'Alternativa continental de clubes con universo cerrado, no equivalente a títulos de liga nacional.'
  },
  {
    slug: 'caf-champions-league-club-titles',
    label: 'Títulos de CAF Champions League',
    equivalence: 'different_metric_closed_universe',
    reason: 'Alternativa continental de clubes con universo cerrado, no equivalente a títulos de liga nacional.'
  },
  {
    slug: 'afc-champions-league-club-titles',
    label: 'Títulos de AFC Champions League',
    equivalence: 'different_metric_closed_universe',
    reason: 'Alternativa continental de clubes con universo cerrado, no equivalente a títulos de liga nacional.'
  },
  {
    slug: 'ofc-champions-league-club-titles',
    label: 'Títulos de OFC Champions League',
    equivalence: 'different_metric_closed_universe',
    reason: 'Alternativa continental de clubes con universo cerrado, no equivalente a títulos de liga nacional.'
  }
];

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+\([^()]+\)$/u, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function competitionKey(value: string): string {
  return normalize(value).replace(/\s+/g, '-');
}

function observationKey(observation: NationalLeagueTitleObservation): string {
  return `${competitionKey(observation.competition)}:${observation.seasonStartYear}`;
}

function clubKey(value: string): string {
  return normalize(value);
}

/**
 * Compare season winners from independent result feeds. A reconstructed table
 * is never treated as an official title list: a season is `confirmed` only
 * when two independent deterministic feeds name the same club. Ambiguous or
 * conflicting seasons remain evidence and are excluded from confirmed totals.
 */
export function contrastNationalLeagueTitleObservations(
  observations: NationalLeagueTitleObservation[]
): ContrastedNationalLeagueSeason[] {
  const grouped = new Map<string, NationalLeagueTitleObservation[]>();
  for (const observation of observations) {
    if (!Number.isInteger(observation.seasonStartYear) || observation.seasonStartYear < 1800 || observation.seasonStartYear > 2200) {
      throw new Error(`Temporada inválida para ${observation.competition}: ${observation.seasonStartYear}`);
    }
    if (!observation.competition.trim() || (!observation.clubName.trim() && observation.status !== 'ambiguous') || !/^https:\/\//i.test(observation.sourceUrl)) {
      throw new Error('Cada observación de títulos nacionales requiere competencia, club (salvo ambigua) y URL HTTPS');
    }
    const key = observationKey(observation);
    const current = grouped.get(key) ?? [];
    current.push(observation);
    grouped.set(key, current);
  }

  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, seasonObservations]) => {
    const deterministic = seasonObservations.filter((observation) => observation.status !== 'ambiguous');
    const distinctClubs = new Set(deterministic.map((observation) => clubKey(observation.clubName)));
    const distinctSources = new Set(deterministic.map((observation) => observation.source));
    const sameWinner = distinctClubs.size === 1;
    const status: ContrastedNationalLeagueSeason['status'] = deterministic.length === 0
      ? 'ambiguous'
      : !sameWinner || (distinctClubs.size > 1 && distinctSources.size > 1)
        ? 'conflict'
        : distinctSources.size >= 2
          ? 'confirmed'
          : 'single_source';
    const winner = sameWinner ? deterministic[0]?.clubName : undefined;
    return {
      key,
      competition: seasonObservations[0]!.competition,
      seasonStartYear: seasonObservations[0]!.seasonStartYear,
      observations: seasonObservations,
      status,
      ...(winner ? { clubName: winner } : {})
    };
  });
}

export function buildContrastedNationalLeagueRanking(
  observations: NationalLeagueTitleObservation[],
  options: { sourceVersion?: string; now?: Date } = {}
): RankingInput {
  const seasons = contrastNationalLeagueTitleObservations(observations);
  const titleCounts = new Map<string, {
    clubName: string;
    competition: string;
    titles: number;
    seasons: number[];
    observations: NationalLeagueTitleObservation[];
    statuses: string[];
  }>();
  for (const season of seasons) {
    if (!season.clubName || !['confirmed', 'single_source'].includes(season.status)) continue;
    const key = `${competitionKey(season.competition)}:${clubKey(season.clubName)}`;
    const current = titleCounts.get(key) ?? {
      clubName: season.clubName,
      competition: season.competition,
      titles: 0,
      seasons: [],
      observations: [],
      statuses: []
    };
    current.titles += 1;
    current.seasons.push(season.seasonStartYear);
    current.observations.push(...season.observations);
    current.statuses.push(season.status);
    titleCounts.set(key, current);
  }

  const entries = [...titleCounts.values()]
    .sort((left, right) => right.titles - left.titles || `${left.competition}:${left.clubName}`.localeCompare(`${right.competition}:${right.clubName}`))
    .slice(0, 200)
    .map((value, index) => ({
      entityId: `national-league:club:${competitionKey(value.competition)}:${clubKey(value.clubName).replace(/\s+/g, '-')}`,
      entityType: 'club' as const,
      name: value.clubName,
      rawValue: value.titles,
      evidence: {
        externalId: `national-league:${competitionKey(value.competition)}:${clubKey(value.clubName).replace(/\s+/g, '-')}`,
        identityStatus: 'candidate_unresolved',
        identityReviewPolicy: 'No se enlaza automáticamente con otra entidad por nombre; revisar el club canónico con contexto de competición, temporadas y fuente oficial.',
        sourceRank: index + 1,
        competition: value.competition,
        titleSeasons: value.seasons,
        sourceUrls: [...new Set(value.observations.map((observation) => observation.sourceUrl))],
        sourceNames: [...new Set(value.observations.map((observation) => observation.source))],
        validationStatuses: value.statuses,
        definition: 'Solo se cuentan temporadas con campeón determinista. confirmed exige coincidencia entre al menos dos fuentes; single_source se conserva únicamente como candidato draft y sigue pendiente de contraste oficial.',
        unknownValuesPolicy: 'Las temporadas incompletas, ambiguas o conflictivas se excluyen del total y permanecen en la evidencia de auditoría; no se convierten en cero.'
      }
    }));
  const counts = {
    confirmed: seasons.filter((season) => season.status === 'confirmed').length,
    single_source: seasons.filter((season) => season.status === 'single_source').length,
    conflict: seasons.filter((season) => season.status === 'conflict').length,
    ambiguous: seasons.filter((season) => season.status === 'ambiguous').length
  };
  const now = options.now ?? new Date();
  return {
    categorySlug: 'national-league-club-titles',
    source: {
      key: 'rango90-national-league-titles-contrast',
      name: 'Contraste de campeones nacionales: OpenFootball + football-data',
      sourceType: 'reference',
      baseUrl: 'https://github.com/openfootball/leagues',
      rightsStatus: 'review_required'
    },
    dataVersion: `rango90-national-league-titles-contrast-${options.sourceVersion ?? now.toISOString().slice(0, 10)}`,
    coverageComplete: false,
    allowPartialDraft: true,
    partialDraftReason: `Candidato draft con ${counts.confirmed} temporadas confirmadas por dos feeds y ${counts.single_source} temporadas de una sola fuente; las temporadas ambiguas o en conflicto (${counts.ambiguous + counts.conflict}) no se cuentan. Falta contraste con campeones oficiales y cobertura mundial completa.`,
    reviewed: false,
    audit: {
      sourceRepositories: ['https://github.com/openfootball/leagues', 'https://github.com/schochastics/football-data'],
      sourceLicenses: {
        openfootball: 'CC0-1.0/public-domain dedication; revisión legal pendiente',
        footballData: 'ODbL-1.0; revisión legal pendiente'
      },
      sourceVersion: options.sourceVersion ?? null,
      seasonStatuses: counts,
      observationCount: observations.length,
      outputEntries: entries.length,
      confirmedOnlyCount: seasons.filter((season) => season.status === 'confirmed' && season.clubName).length,
      independentCategorySelection: true,
      noPadding: true
    },
    entries
  };
}
