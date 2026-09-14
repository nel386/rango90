import type { RankingInput } from '../imports/rankingInput.js';

export const footballDataIncidentsRepositoryUrl = 'https://github.com/schochastics/football-data';
export const footballDataIncidentsLicenseUrl = 'https://opendatacommons.org/licenses/odbl/1-0/';
const githubContentsUrl = 'https://api.github.com/repos/schochastics/football-data/contents/data/goals_time2';
const githubCommitsUrl = 'https://api.github.com/repos/schochastics/football-data/commits/master';
const rawBaseUrl = 'https://raw.githubusercontent.com/schochastics/football-data';

export type FootballDataCardMetric = 'yellow_cards' | 'red_cards';

export type FootballDataIncident = {
  competition: string;
  season: string;
  date: string;
  metric: FootballDataCardMetric;
  playerName: string;
  team: 'home' | 'away' | null;
  sourceUrl: string;
};

export type FootballDataIncidentManifest = {
  commitSha: string;
  files: Array<{ path: string; sourceUrl: string }>;
};

type RawIncident = {
  team?: unknown;
  incident_type?: unknown;
  player_name?: unknown;
};

type RawMatch = {
  league?: unknown;
  date?: unknown;
  incident?: { incidents?: unknown };
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function metric(value: unknown): FootballDataCardMetric | null {
  if (value === 'Yellow Card') return 'yellow_cards';
  if (value === 'Red Card') return 'red_cards';
  return null;
}

function validDate(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  return candidate;
}

function seasonFromFile(path: string): string {
  const match = path.match(/-(\d{4}-\d{4})\.json$/u);
  return match?.[1] ?? 'unknown';
}

/**
 * Parse only explicit player card incidents. Second-yellow events are not
 * silently converted into red cards: the source must label them exactly as
 * `Red Card` for this candidate feed to count them as direct reds.
 */
export function parseFootballDataIncidentFile(content: string, sourceUrl: string, filePath = ''): FootballDataIncident[] {
  const parsed: unknown = JSON.parse(content);
  if (!Array.isArray(parsed)) return [];
  const season = seasonFromFile(filePath || sourceUrl);
  const incidents: FootballDataIncident[] = [];
  for (const rawMatch of parsed) {
    if (!rawMatch || typeof rawMatch !== 'object') continue;
    const match = rawMatch as RawMatch;
    const competition = text(match.league);
    const date = validDate(match.date);
    const rawIncidents = match.incident && typeof match.incident === 'object' && Array.isArray(match.incident.incidents)
      ? match.incident.incidents
      : [];
    if (!competition || !date) continue;
    for (const rawIncident of rawIncidents) {
      if (!rawIncident || typeof rawIncident !== 'object') continue;
      const incident = rawIncident as RawIncident;
      const cardMetric = metric(incident.incident_type);
      const playerName = text(incident.player_name);
      if (!cardMetric || !playerName) continue;
      const team = incident.team === 'home' || incident.team === 'away' ? incident.team : null;
      incidents.push({ competition, season, date, metric: cardMetric, playerName, team, sourceUrl });
    }
  }
  return incidents;
}

export async function fetchFootballDataIncidentManifest(ref = 'master'): Promise<FootballDataIncidentManifest> {
  const headers = { 'User-Agent': 'Rango90-football-data-import/0.1', Accept: 'application/vnd.github+json' };
  const commitResponse = await fetch(ref === 'master' ? githubCommitsUrl : `https://api.github.com/repos/schochastics/football-data/commits/${encodeURIComponent(ref)}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!commitResponse.ok) throw new Error(`football-data commit manifest: HTTP ${commitResponse.status}`);
  const commitPayload = await commitResponse.json() as { sha?: unknown };
  const commitSha = text(commitPayload.sha);
  if (!commitSha || !/^[0-9a-f]{40}$/iu.test(commitSha)) throw new Error('football-data no devolvió un commit SHA válido');
  const contentsResponse = await fetch(`${githubContentsUrl}?ref=${encodeURIComponent(commitSha)}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!contentsResponse.ok) throw new Error(`football-data incidents manifest: HTTP ${contentsResponse.status}`);
  const contents = await contentsResponse.json() as Array<{ type?: unknown; path?: unknown }>;
  const files = contents
    .filter((entry) => entry.type === 'file' && typeof entry.path === 'string' && entry.path.endsWith('.json'))
    .map((entry) => {
      const path = typeof entry.path === 'string' ? entry.path : '';
      if (!path) return null;
      return { path, sourceUrl: `${rawBaseUrl}/${commitSha}/${path}` };
    })
    .filter((file): file is { path: string; sourceUrl: string } => file !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
  if (files.length === 0) throw new Error('football-data no tiene archivos de incidentes JSON');
  return { commitSha, files };
}

export async function fetchFootballDataIncidents(manifest?: FootballDataIncidentManifest): Promise<{ manifest: FootballDataIncidentManifest; incidents: FootballDataIncident[] }> {
  const resolvedManifest = manifest ?? await fetchFootballDataIncidentManifest();
  const incidents: FootballDataIncident[] = [];
  for (const file of resolvedManifest.files) {
    const response = await fetch(file.sourceUrl, {
      headers: { 'User-Agent': 'Rango90-football-data-import/0.1' },
      signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok) throw new Error(`football-data ${file.path}: HTTP ${response.status}`);
    incidents.push(...parseFootballDataIncidentFile(await response.text(), file.sourceUrl, file.path));
  }
  return { manifest: resolvedManifest, incidents };
}

function slug(value: string): string {
  return value.toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildMetricRanking(
  incidents: FootballDataIncident[],
  selectedMetric: FootballDataCardMetric,
  options: { sourceVersion: string; sourceFiles: number; now?: Date }
): RankingInput {
  const counts = new Map<string, { playerName: string; value: number; sourceUrls: Set<string>; competitions: Set<string>; seasons: Set<string> }>();
  for (const incident of incidents) {
    if (incident.metric !== selectedMetric) continue;
    const key = slug(incident.playerName);
    if (!key) continue;
    const current = counts.get(key) ?? {
      playerName: incident.playerName,
      value: 0,
      sourceUrls: new Set<string>(),
      competitions: new Set<string>(),
      seasons: new Set<string>()
    };
    current.value += 1;
    current.sourceUrls.add(incident.sourceUrl);
    current.competitions.add(incident.competition);
    current.seasons.add(incident.season);
    counts.set(key, current);
  }
  const entries = [...counts.values()]
    .sort((left, right) => right.value - left.value || left.playerName.localeCompare(right.playerName))
    .slice(0, 200)
    .map((player, index) => ({
      entityId: `football-data:player:${slug(player.playerName)}`,
      entityType: 'player' as const,
      name: player.playerName,
      rawValue: player.value,
      evidence: {
        sourceRank: index + 1,
        sourceVersion: options.sourceVersion,
        sourceFiles: options.sourceFiles,
        sourceUrls: [...player.sourceUrls].sort(),
        competitions: [...player.competitions].sort(),
        seasons: [...player.seasons].sort(),
        definition: selectedMetric === 'yellow_cards'
          ? 'Recuento de incidentes etiquetados exactamente como Yellow Card en los archivos goals_time2 de football-data; el nombre de jugador es una etiqueta Surname Initial sin identificador estable.'
          : 'Recuento de incidentes etiquetados exactamente como Red Card en los archivos goals_time2 de football-data; no se convierte automáticamente una segunda amarilla y el nombre de jugador es una etiqueta sin identificador estable.'
      }
    }));
  return {
    categorySlug: selectedMetric === 'yellow_cards' ? 'club-career-yellow-cards' : 'club-career-red-cards',
    source: {
      key: 'schochastics-football-data-incidents',
      name: 'schochastics football-data match incidents',
      sourceType: 'reference',
      baseUrl: footballDataIncidentsRepositoryUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `schochastics-football-data-incidents-${selectedMetric}-${options.sourceVersion}`,
    coverageComplete: false,
    allowPartialDraft: true,
    partialDraftReason: 'Candidato histórico: los archivos no cubren todas las competiciones/temporadas, usan etiquetas de jugador sin ID estable y requieren auditoría de nombres, cobertura y tratamiento de segundos amarillos.',
    reviewed: false,
    audit: {
      sourceRepository: footballDataIncidentsRepositoryUrl,
      sourceLicenseUrl: footballDataIncidentsLicenseUrl,
      sourceVersion: options.sourceVersion,
      sourceFiles: options.sourceFiles,
      sourceIncidentCount: incidents.filter((incident) => incident.metric === selectedMetric).length,
      outputEntries: entries.length,
      generatedAt: (options.now ?? new Date()).toISOString()
    },
    entries
  };
}

export function buildFootballDataCareerCardsRankings(
  incidents: FootballDataIncident[],
  options: { sourceVersion: string; sourceFiles: number; now?: Date }
): Record<FootballDataCardMetric, RankingInput> {
  return {
    yellow_cards: buildMetricRanking(incidents, 'yellow_cards', options),
    red_cards: buildMetricRanking(incidents, 'red_cards', options)
  };
}
