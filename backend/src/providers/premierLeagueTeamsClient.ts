export interface PremierLeagueTeam {
  providerTeamId: number;
  name: string;
  shortName: string;
  abbreviation: string;
  teamType: string;
  grounds: Array<{ id: number; name: string; city?: string; capacity?: number }>;
}

interface TeamsResponse {
  pageInfo?: { numEntries?: number; numPages?: number };
  content?: Array<{
    name?: string;
    shortName?: string;
    teamType?: string;
    id?: number;
    club?: { id?: number; name?: string; shortName?: string; abbr?: string };
    grounds?: Array<{ id?: number; name?: string; city?: string; capacity?: number }>;
  }>;
}

interface SeasonsResponse {
  pageInfo?: { numEntries?: number; numPages?: number };
  content?: Array<{ id?: number; label?: string }>;
}

export interface PremierLeagueTeamsResult {
  compSeasonId: number;
  seasonLabel: string;
  sourceUrl: string;
  retrievedAt: string;
  teams: PremierLeagueTeam[];
}

export async function fetchPremierLeagueTeams(compSeasonId?: number): Promise<PremierLeagueTeamsResult> {
  const seasonsUrl = new URL('https://footballapi.pulselive.com/football/competitions/1/compseasons');
  seasonsUrl.searchParams.set('page', '0');
  seasonsUrl.searchParams.set('pageSize', '100');
  const seasons = await fetchJson<SeasonsResponse>(seasonsUrl);
  const selectedSeason = compSeasonId === undefined
    ? seasons.content?.[0]
    : seasons.content?.find((season) => season.id === compSeasonId);
  if (!selectedSeason?.id || !selectedSeason.label) {
    throw new Error(`Premier League no ha devuelto la temporada solicitada: ${compSeasonId ?? 'actual'}`);
  }
  const seasonId = selectedSeason.id;
  const seasonLabel = selectedSeason.label;

  const teamsUrl = new URL('https://footballapi.pulselive.com/football/teams');
  teamsUrl.searchParams.set('comps', '1');
  teamsUrl.searchParams.set('compSeasons', String(seasonId));
  teamsUrl.searchParams.set('page', '0');
  teamsUrl.searchParams.set('pageSize', '100');
  const payload = await fetchJson<TeamsResponse>(teamsUrl);
  const rows = payload.content ?? [];
  const expected = payload.pageInfo?.numEntries;
  if (!Number.isInteger(expected) || expected !== rows.length || rows.length !== 20) {
    throw new Error(`Cobertura inválida de clubes de Premier League: ${rows.length}/${expected ?? 'desconocido'}`);
  }

  const ids = new Set<number>();
  const teams = rows.map((row) => {
    const providerTeamId = row.club?.id ?? row.id;
    const name = row.club?.name ?? row.name;
    if (!providerTeamId || !Number.isInteger(providerTeamId) || !name || !row.shortName || !row.club?.abbr) {
      throw new Error('Club de Premier League sin identidad completa');
    }
    if (ids.has(providerTeamId)) throw new Error(`Club de Premier League duplicado: ${providerTeamId}`);
    ids.add(providerTeamId);
    return {
      providerTeamId,
      name,
      shortName: row.club?.shortName ?? row.shortName,
      abbreviation: row.club.abbr,
      teamType: row.teamType ?? 'UNKNOWN',
      grounds: (row.grounds ?? []).flatMap((ground) => ground.id && ground.name
        ? [{ id: ground.id, name: ground.name, city: ground.city, capacity: ground.capacity }]
        : [])
    } satisfies PremierLeagueTeam;
  });

  return {
    compSeasonId: seasonId,
    seasonLabel,
    sourceUrl: teamsUrl.toString(),
    retrievedAt: new Date().toISOString(),
    teams
  };
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Origin: 'https://www.premierleague.com',
      'User-Agent': 'Rango90-data-import/0.1'
    },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Premier League teams API ${response.status}`);
  return (await response.json()) as T;
}
