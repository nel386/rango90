export type ApiFootballRefreshFrequency = 'daily' | 'weekly';

export type ApiFootballRefreshCompetition = {
  id: string;
  name: string;
  leagueId: number;
  frequency: ApiFootballRefreshFrequency;
  reason: string;
};

/**
 * Operational cadence for the API-Football feed. This is deliberately kept
 * separate from publication rights: a refresh may archive and validate a
 * provider snapshot, but it never approves a source or publishes a ranking.
 */
export const API_FOOTBALL_REFRESH_COMPETITIONS: readonly ApiFootballRefreshCompetition[] = [
  { id: 'premier-league', name: 'Premier League', leagueId: 39, frequency: 'daily', reason: 'liga activa con cambios frecuentes' },
  { id: 'la-liga', name: 'LaLiga', leagueId: 140, frequency: 'daily', reason: 'liga activa con cambios frecuentes' },
  { id: 'bundesliga', name: 'Bundesliga', leagueId: 78, frequency: 'daily', reason: 'liga activa con cambios frecuentes' },
  { id: 'serie-a', name: 'Serie A', leagueId: 135, frequency: 'daily', reason: 'liga activa con cambios frecuentes' },
  { id: 'ligue-1', name: 'Ligue 1', leagueId: 61, frequency: 'daily', reason: 'liga activa con cambios frecuentes' },
  { id: 'primeira-liga', name: 'Primeira Liga', leagueId: 94, frequency: 'daily', reason: 'liga activa con cambios frecuentes' },
  { id: 'european-cup-champions-league', name: 'European Cup / Champions League', leagueId: 2, frequency: 'weekly', reason: 'competición de calendario discontinuo y consolidación semanal' },
  { id: 'world-cup', name: 'FIFA World Cup', leagueId: 1, frequency: 'weekly', reason: 'torneo episódico; se revisa semanalmente cuando hay edición' }
];

export const API_FOOTBALL_REFRESH_METRICS = ['goals', 'assists', 'yellow_cards', 'red_cards'] as const;

export function apiFootballRefreshCompetitions(frequency: ApiFootballRefreshFrequency): ApiFootballRefreshCompetition[] {
  return API_FOOTBALL_REFRESH_COMPETITIONS.filter((competition) => competition.frequency === frequency);
}

export function apiFootballRefreshSeason(frequency: ApiFootballRefreshFrequency, date = new Date()): number {
  const year = date.getUTCFullYear();
  return frequency === 'daily' ? year : year - 1;
}

export function apiFootballRefreshPlan(frequency: ApiFootballRefreshFrequency, date = new Date()) {
  const competitions = apiFootballRefreshCompetitions(frequency);
  return {
    provider: 'api-football',
    frequency,
    timezone: 'UTC',
    season: apiFootballRefreshSeason(frequency, date),
    competitions,
    metrics: [...API_FOOTBALL_REFRESH_METRICS],
    safeguards: {
      skipMedia: true,
      snapshotStatus: 'validated_then_draft_until_review',
      sourceRights: 'review_required',
      autoApprove: false,
      autoPublish: false,
      globalCareerGoalsNeedsSeniorNationalTeamFeed: true
    }
  } as const;
}
