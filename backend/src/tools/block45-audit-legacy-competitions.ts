import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizePlayerName, stableYellowJson } from '../clubYellowCardsCareerRankingEngine.js';

type JsonObject = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown };
type Sample = {
  leagueId: number;
  league: string;
  player: string;
  season: number;
  expectedTeamAliases: string[];
  expectedYellowCards: number;
  independentSource: string;
  independentSourceDescription: string;
};
type RequestEvidence = {
  endpoint: string;
  kind: 'player_search' | 'season_stats';
  status: number;
  responseSha256: string;
  responseClass: 'data' | 'valid_empty' | 'provider_error' | 'malformed_response';
  providerErrorCauses?: string[];
  dailyRemaining: number | null;
  dailyLimit: number | null;
  minuteRemaining: number | null;
  minuteLimit: number | null;
};

const samples: Sample[] = [
  { leagueId: 39, league: 'Premier League', player: 'Cristiano Ronaldo', season: 2007, expectedTeamAliases: ['Manchester United'], expectedYellowCards: 5, independentSource: 'https://www.statbunker.com/players/GetHistoryStats?comps_type=-1&dates=2007&player_id=17983', independentSourceDescription: 'Statbunker, Premier League 2007/08' },
  { leagueId: 140, league: 'La Liga', player: 'Dani Parejo', season: 2008, expectedTeamAliases: ['Real Madrid'], expectedYellowCards: 1, independentSource: 'https://theanalyst.com/players/1893/dani-parejo/career', independentSourceDescription: 'Opta Analyst, Primera División 2008/09' },
  { leagueId: 135, league: 'Serie A', player: 'Zlatan Ibrahimovic', season: 2008, expectedTeamAliases: ['Inter', 'Internazionale'], expectedYellowCards: 8, independentSource: 'https://www.statbunker.com/players/GetHistoryStats?comps_id=258&comps_type=SA&player_id=8695', independentSourceDescription: 'Statbunker, Serie A 2008/09' },
  { leagueId: 78, league: 'Bundesliga', player: 'Franck Ribery', season: 2008, expectedTeamAliases: ['Bayern Munich', 'FC Bayern München'], expectedYellowCards: 5, independentSource: 'https://www.statbunker.com/players/GetHistoryStats?comps_id=-1&comps_type=BL&player_id=18728', independentSourceDescription: 'Statbunker, Bundesliga 2008/09' },
  { leagueId: 61, league: 'Ligue 1', player: 'Juninho Pernambucano', season: 2008, expectedTeamAliases: ['Lyon', 'Olympique Lyonnais'], expectedYellowCards: 4, independentSource: 'https://www.worldfootball.net/player_summary/juninho-pernambucano/fra-ligue-1/2/', independentSourceDescription: 'worldfootball.net, Ligue 1 2008/09' },
  { leagueId: 39, league: 'Premier League', player: 'Luis Suarez', season: 2013, expectedTeamAliases: ['Liverpool'], expectedYellowCards: 6, independentSource: 'https://www.statbunker.com/players/GetHistoryStats?comps_id=-1&comps_type=EPL&player_id=23604', independentSourceDescription: 'Statbunker, Premier League 2013/14' },
  { leagueId: 140, league: 'La Liga', player: 'Dani Parejo', season: 2013, expectedTeamAliases: ['Valencia', 'Valencia CF'], expectedYellowCards: 7, independentSource: 'https://theanalyst.com/players/1893/dani-parejo/career', independentSourceDescription: 'Opta Analyst, Primera División 2013/14' },
  { leagueId: 135, league: 'Serie A', player: 'Andrea Pirlo', season: 2013, expectedTeamAliases: ['Juventus'], expectedYellowCards: 4, independentSource: 'https://statbunker.com/players/GetHistoryStats?comps_id=-1&comps_type=SA&player_id=4335', independentSourceDescription: 'Statbunker, Serie A 2013/14' },
  { leagueId: 78, league: 'Bundesliga', player: 'Franck Ribery', season: 2013, expectedTeamAliases: ['Bayern Munich', 'FC Bayern München'], expectedYellowCards: 2, independentSource: 'https://www.statbunker.com/competitions/TopYellowCards?club_id=99&comp_id=447', independentSourceDescription: 'Statbunker, Bundesliga 2013/14' },
  { leagueId: 61, league: 'Ligue 1', player: 'Zlatan Ibrahimovic', season: 2013, expectedTeamAliases: ['Paris Saint-Germain', 'Paris Saint Germain'], expectedYellowCards: 7, independentSource: 'https://www.statbunker.com/players/GetHistoryStats?comps_type=-1&dates=2013&player_id=8695', independentSourceDescription: 'Statbunker, Ligue 1 2013/14' }
];

const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const outputRoot = resolve(process.env.BLOCK45_OUTPUT_ROOT?.trim() || 'audits/block45/legacy-competition-audit');
const searchOnly = process.env.BLOCK45_AUDIT_SEARCH_ONLY?.trim().toLowerCase() !== 'false';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const intHeader = (headers: Headers, name: string): number | null => {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};
const hasProviderErrors = (errors: unknown): boolean => {
  if (errors === undefined || errors === null || errors === false || errors === '') return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors as JsonObject).length > 0;
  return true;
};
const normalize = (value: string): string => normalizePlayerName(value);
function redactedProviderErrorCauses(errors: unknown): string[] {
  const sanitize = (value: unknown): string => {
    let message = typeof value === 'string' ? value : JSON.stringify(value);
    if (!message) message = String(value ?? 'unknown');
    if (apiKey) message = message.split(apiKey).join('[REDACTED]');
    return message
      .replace(/(?:x-apisports-key|api[_ -]?key|authorization|bearer|token)\s*[:=]?\s*[^\s,;"']+/giu, '[REDACTED]')
      .replace(/https?:\/\/[^\s"']+/giu, '[URL]')
      .replace(/\b(player|team|league|search)=([^&\s"']+)/giu, '$1=[REDACTED]')
      .replace(/\s+/gu, ' ')
      .trim()
      .slice(0, 220);
  };
  if (errors === undefined || errors === null || errors === false || errors === '') return [];
  if (Array.isArray(errors)) return errors.map((value) => sanitize(value)).filter(Boolean).slice(0, 8);
  if (typeof errors === 'object') return Object.entries(errors as JsonObject).slice(0, 8).map(([key, value]) => `${key.replace(/[^a-z0-9_.-]/giu, '_').slice(0, 60)}: ${sanitize(value)}`);
  return [sanitize(errors)];
}

async function main(): Promise<void> {
  if (!apiKey) throw new Error('API_FOOTBALL_KEY ausente; no se realizaron peticiones.');
  const requests: RequestEvidence[] = [];
  const results: Array<Record<string, unknown>> = [];
  let stoppedForRateLimit = false;
  let minuteLimit: number | null = null;
  let lastStartedAt = 0;

  async function get(endpoint: string, kind: RequestEvidence['kind']): Promise<Envelope> {
    if (stoppedForRateLimit) return {};
    const safeRate = (minuteLimit ?? 10) * 0.8;
    const intervalMs = Math.max(250, Math.ceil(60_000 / safeRate));
    const delay = intervalMs - (Date.now() - lastStartedAt);
    if (lastStartedAt > 0 && delay > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    lastStartedAt = Date.now();
    const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    const raw = await response.text();
    let body: Envelope = {};
    try { body = object(JSON.parse(raw)) as Envelope; } catch { body = {}; }
    const hasData = Array.isArray(body.response) && body.response.length > 0;
    const responseClass: RequestEvidence['responseClass'] = response.status !== 200 || hasProviderErrors(body.errors)
      ? 'provider_error'
      : !Array.isArray(body.response) ? 'malformed_response'
        : hasData ? 'data' : 'valid_empty';
    const observedLimit = intHeader(response.headers, 'X-RateLimit-Limit');
    if (observedLimit !== null && observedLimit > 0) minuteLimit = observedLimit;
    const providerErrorCauses = hasProviderErrors(body.errors) ? redactedProviderErrorCauses(body.errors) : [];
    requests.push({ endpoint, kind, status: response.status, responseSha256: sha256(raw), responseClass, ...(providerErrorCauses.length ? { providerErrorCauses } : {}), dailyRemaining: intHeader(response.headers, 'x-ratelimit-requests-remaining'), dailyLimit: intHeader(response.headers, 'x-ratelimit-requests-limit'), minuteRemaining: intHeader(response.headers, 'X-RateLimit-Remaining'), minuteLimit: observedLimit });
    if (response.status === 429) stoppedForRateLimit = true;
    return body;
  }

  for (const sample of samples) {
    if (stoppedForRateLimit) break;
    const searchEndpoint = `/players?search=${encodeURIComponent(sample.player)}&season=${sample.season}`;
    const searchBody = await get(searchEndpoint, 'player_search');
    const searchEvidence = requests.at(-1);
    if (!searchEvidence || searchEvidence.status !== 200 || searchEvidence.responseClass !== 'data') {
      results.push({ ...sample, status: 'player_search_unverified', searchStatus: searchEvidence?.status ?? null, searchResponseClass: searchEvidence?.responseClass ?? null });
      continue;
    }
    const exactMatches = array(searchBody.response).map(object).filter((row) => normalize(String(object(row.player).name ?? '')) === normalize(sample.player));
    const playerIds = [...new Set(exactMatches.map((row) => String(object(row.player).id ?? '')).filter(Boolean))];
    if (playerIds.length !== 1) {
      results.push({ ...sample, status: 'player_identity_unresolved', matchedPlayerIds: playerIds, searchStatus: searchEvidence.status });
      continue;
    }
    const playerId = playerIds[0]!;
    if (searchOnly) {
      results.push({ ...sample, playerId, status: 'player_search_verified_stats_not_requested', searchStatus: searchEvidence.status, searchResponseClass: searchEvidence.responseClass });
      continue;
    }
    const statsEndpoint = `/players?id=${encodeURIComponent(playerId)}&season=${sample.season}`;
    const statsBody = await get(statsEndpoint, 'season_stats');
    const statsEvidence = requests.at(-1);
    if (!statsEvidence || statsEvidence.status !== 200 || !Array.isArray(statsBody.response) || hasProviderErrors(statsBody.errors)) {
      results.push({ ...sample, playerId, status: 'season_stats_unverified', statsStatus: statsEvidence?.status ?? null, statsResponseClass: statsEvidence?.responseClass ?? null });
      continue;
    }
    const statistics = array(statsBody.response).flatMap((rowValue) => array(object(rowValue).statistics).map(object));
    const exactLeagueRows = statistics.filter((stat) => normalize(String(object(stat.league).name ?? '')) === normalize(sample.league));
    const expectedTeamRows = exactLeagueRows.filter((stat) => sample.expectedTeamAliases.some((name) => normalize(String(object(stat.team).name ?? '')) === normalize(name)));
    const cardValues = expectedTeamRows.map((stat) => Number(object(stat.cards).yellow)).filter((value) => Number.isInteger(value) && value >= 0);
    const observedYellowCards = cardValues.length === expectedTeamRows.length && cardValues.length > 0 ? cardValues.reduce((sum, value) => sum + value, 0) : null;
    const selectedRows = expectedTeamRows.map((stat) => ({ leagueId: Number(object(stat.league).id), leagueName: String(object(stat.league).name ?? ''), country: String(object(stat.league).country ?? ''), teamId: Number(object(stat.team).id) || null, teamName: String(object(stat.team).name ?? ''), yellowCards: Number.isInteger(Number(object(stat.cards).yellow)) ? Number(object(stat.cards).yellow) : null }));
    const legacyRows = selectedRows.filter((row) => !Number.isInteger(row.leagueId) || row.leagueId <= 0);
    const independentMatch = observedYellowCards === sample.expectedYellowCards && expectedTeamRows.length > 0;
    results.push({ ...sample, playerId, status: independentMatch ? (legacyRows.length > 0 ? 'legacy_control_match_unmapped' : 'control_match_positive_id') : 'control_mismatch_or_unresolved', searchStatus: searchEvidence.status, statsStatus: statsEvidence.status, exactCompetitionRows: exactLeagueRows.length, expectedTeamRows: selectedRows, observedYellowCards, independentMatch, legacyIdRows: legacyRows, nameBasedMappingApproved: false });
  }

  const daily = requests.map((request) => request.dailyRemaining).filter((value): value is number => value !== null);
  const minute = requests.map((request) => request.minuteRemaining).filter((value): value is number => value !== null);
  const report = {
    artifactKind: 'block45_legacy_competition_control_audit',
    version: '1',
    status: stoppedForRateLimit ? 'audit_rate_limited' : results.length === samples.length ? searchOnly ? 'search_diagnostics_complete' : 'audit_complete' : 'audit_partial',
    scope: { sampling: '5 ligas × 2 temporadas; cohorte 2007/08 y cohorte 2013/14', controls: samples.length, liveRequests: requests.length, mode: searchOnly ? 'search_diagnostics_only' : 'player_search_and_season_stats_controls', noLoad: true, snapshotsCreated: 0 },
    results,
    summary: {
      expectedCases: samples.length,
      matchedIndependentControls: results.filter((row) => row.independentMatch === true).length,
      matchedLegacyIdZeroControls: results.filter((row) => row.status === 'legacy_control_match_unmapped').length,
      positiveIdControls: results.filter((row) => row.status === 'control_match_positive_id').length,
      unresolvedOrMismatchedControls: results.filter((row) => !['legacy_control_match_unmapped', 'control_match_positive_id'].includes(String(row.status))).length,
      searchProviderErrorRequests: requests.filter((request) => request.kind === 'player_search' && request.responseClass === 'provider_error').length,
      providerErrorCauseGroups: Object.entries(requests.flatMap((request) => (request.providerErrorCauses ?? []).map((cause) => `${request.kind}|${cause}`)).reduce<Record<string, number>>((counts, cause) => { counts[cause] = (counts[cause] ?? 0) + 1; return counts; }, {})).map(([cause, count]) => ({ cause, count })).sort((left, right) => right.count - left.count || left.cause.localeCompare(right.cause)),
      nameBasedMappingApproved: false,
      mappingDecision: 'Sin mapa aprobado: los casos con ID ausente/cero quedan fuera de facts y visibles como pendientes hasta contrastar nombre, país, equipo, temporada y fuente independiente.'
    },
    quota: {
      requestAttempts: requests.length,
      daily: { initial: daily[0] ?? null, final: daily.at(-1) ?? null, observedDecrease: daily.length > 1 ? daily[0]! - daily.at(-1)! : null, attemptsMinusObservedDecrease: daily.length > 1 ? requests.length - (daily[0]! - daily.at(-1)!) : null, headerValuesObserved: daily.length },
      perMinute: { initial: minute[0] ?? null, final: minute.at(-1) ?? null, limit: requests.find((request) => request.minuteLimit !== null)?.minuteLimit ?? null, headerValuesObserved: minute.length, note: 'Ventana móvil; no es consumo acumulado.' },
      unreconciledNote: 'Si los intentos y el descenso de la cabecera diaria difieren, esta auditoría no atribuye la diferencia a una causa externa o de proveedor sin evidencia.'
    },
    requests,
    rawPayloadsStored: false,
    secretPrinted: false,
    expansionExecuted: false,
    loadExecuted: false,
    snapshotsCreated: 0,
    reportHash: ''
  };
  const { reportHash: _emptyHash, ...unsignedReport } = report;
  report.reportHash = createHash('sha256').update(stableYellowJson(unsignedReport)).digest('hex');
  await mkdir(outputRoot, { recursive: true });
  await writeFile(resolve(outputRoot, 'BLOCK45_LEGACY_COMPETITION_AUDIT.json'), stableYellowJson(report), 'utf8');
}

await main();
