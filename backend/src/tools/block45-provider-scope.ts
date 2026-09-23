type JsonRecord = Record<string, unknown>;

const object = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};

export function classifyClubCompetition(statistic: JsonRecord): { decision: 'accepted' | 'excluded'; reason: string } {
  const team = object(statistic.team); const league = object(statistic.league);
  if (!Number.isInteger(Number(team.id)) || Number(team.id) < 1) return { decision: 'excluded', reason: 'missing_or_invalid_club_team_id' };
  if (team.national === true || String(team.type ?? '').toLowerCase() === 'national') return { decision: 'excluded', reason: 'national_team' };
  const type = String(league.type ?? '').toLowerCase(); const name = String(league.name ?? '').toLowerCase(); const country = String(league.country ?? '').toLowerCase();
  const officialClubInternational = /champions league|europa league|conference league|libertadores|sudamericana|club world cup|concacaf champions|afc champions|caf champions|copa libertadores|copa sudamericana/u.test(name);
  const nationalCompetition = /world cup|euro(?:pean championship)?|copa america|nations league|afcon|asian cup|gold cup|concacaf gold|oceania nations|copa africana/u.test(name);
  const nonOfficialClub = /friendly|friendlies|youth|reserve|premier league 2|2\. bundesliga|segunda división|segunda division|u(?:17|18|19|20|21|23)|under[- ]?(?:17|18|19|20|21|23)|women|feminine/u.test(`${type} ${name}`);
  if (nonOfficialClub) return { decision: 'excluded', reason: 'friendly_youth_reserve_or_womens_competition' };
  if (nationalCompetition) return { decision: 'excluded', reason: 'national_competition' };
  if (type === 'international' && !officialClubInternational) return { decision: 'excluded', reason: 'international_competition_not_identified_as_club_competition' };
  if (['world', 'europe'].includes(country) && !officialClubInternational) return { decision: 'excluded', reason: 'world_or_europe_competition_not_identified_as_club_competition' };
  return { decision: 'accepted', reason: officialClubInternational ? 'official_international_club_competition' : 'official_club_competition' };
}

export function isOfficialClubCompetition(statistic: JsonRecord): boolean {
  return classifyClubCompetition(statistic).decision === 'accepted';
}
