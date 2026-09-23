type JsonRecord = Record<string, unknown>;

const object = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};

export function isOfficialClubCompetition(statistic: JsonRecord): boolean {
  const team = object(statistic.team); const league = object(statistic.league);
  if (!Number.isInteger(Number(team.id)) || Number(team.id) < 1) return false;
  if (team.national === true || String(team.type ?? '').toLowerCase() === 'national') return false;
  const type = String(league.type ?? '').toLowerCase(); const name = String(league.name ?? '').toLowerCase(); const country = String(league.country ?? '').toLowerCase();
  const officialClubInternational = /champions league|europa league|conference league|libertadores|sudamericana|club world cup|concacaf champions|afc champions|caf champions|copa libertadores|copa sudamericana/u.test(name);
  const nationalCompetition = /world cup|euro(?:pean championship)?|copa america|nations league|afcon|asian cup|gold cup|concacaf gold|oceania nations|copa africana/u.test(name);
  const nonOfficialClub = /friendly|friendlies|youth|reserve|premier league 2|2\. bundesliga|segunda división|segunda division|u(?:17|18|19|20|21|23)|under[- ]?(?:17|18|19|20|21|23)|women|feminine/u.test(`${type} ${name}`);
  if (nonOfficialClub || nationalCompetition || (type === 'international' && !officialClubInternational) || (['world', 'europe'].includes(country) && !officialClubInternational)) return false;
  return true;
}
