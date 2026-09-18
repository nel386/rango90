import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  adaptApiFootballChampionsAssists,
  stableAssistJson,
  type ApiFootballChampionsAssistMatch,
  type ChampionsAssistFact
} from '../championsAssistsRankingEngine.js';

type RecordValue = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown; results?: number; paging?: RecordValue };
type RequestEvidence = { endpoint: string; httpStatus: number | null; ok: boolean; resultCount: number; responseSha256: string; quotaRemaining: number | null };
const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const outputRoot = resolve(process.env.BLOCK26_OUTPUT_ROOT?.trim() || 'audits/block26');
const artifactPrefix = process.env.BLOCK27_RUN === '1' ? 'BLOCK27' : 'BLOCK26';
const blockLabel = process.env.BLOCK27_RUN === '1' ? 'BLOQUE 27' : 'BLOQUE 26';
function artifact(name: string): string { return `${artifactPrefix}_${name}`; }
const activeSeason = Number(process.env.BLOCK26_ACTIVE_SEASON_START ?? 2026);
const quotaReserve = Math.max(Number(process.env.BLOCK26_QUOTA_RESERVE ?? 5) || 5, 0);
const timeoutMs = Math.min(Math.max(Number(process.env.API_FOOTBALL_TIMEOUT_MS ?? 15_000) || 15_000, 1_000), 60_000);
function object(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function writeJson(path: string, value: unknown): Promise<void> { return mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableAssistJson(value), 'utf8')); }
function quota(headers: Headers): number | null { const value = Number(headers.get('x-ratelimit-requests-remaining')); return Number.isFinite(value) ? value : null; }
function fixtureIds(body: Envelope): number[] { return [...new Set(array(body.response).map(object).map((row) => Number(object(row.fixture).id)).filter((id) => Number.isInteger(id) && id > 0))]; }
function matches(body: Envelope): ApiFootballChampionsAssistMatch[] { return array(body.response).map(object) as ApiFootballChampionsAssistMatch[]; }
async function request(endpoint: string): Promise<{ body: Envelope; evidence: RequestEvidence; rawHash: string }> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' }, signal: controller.signal });
    const raw = await response.text(); let body: Envelope = {};
    try { body = object(JSON.parse(raw)) as Envelope; } catch { body = { errors: { invalid_json: true } }; }
    return { body, rawHash: sha256(raw), evidence: { endpoint, httpStatus: response.status, ok: response.ok, resultCount: array(body.response).length, responseSha256: sha256(raw), quotaRemaining: quota(response.headers) } };
  } finally { clearTimeout(timer); }
}
function reportFile(status: string, reason: string, requests: RequestEvidence[], facts: ChampionsAssistFact[], extra: RecordValue = {}): RecordValue {
  return { artifactKind: `${artifactPrefix.toLocaleLowerCase()}_api_football_champions_assists`, reportVersion: '1', generatedAt: new Date().toISOString(), status, reason, categorySlug: 'uefa-champions-league-assists', competition: { leagueId: 2, season: activeSeason, qualifyingExcluded: true, penaltyShootoutsExcluded: true }, requests, requestsPerformed: requests.length, factsImported: facts.length, seasons: extra.seasons ?? (facts.length ? [activeSeason] : []), uncreditedGoalEvents: extra.uncreditedGoalEvents ?? 0, anomalies: extra.anomalies ?? [], quotaRemaining: requests.at(-1)?.quotaRemaining ?? null, quotaReserve, apiKeyUsed: Boolean(apiKey), rawPayloadsStored: false, secretPrinted: false, productionDatabaseAccess: 'none', officialSnapshotCreated: false, ...extra };
}
async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  if (!apiKey) {
    const report = reportFile('not_run', 'API_FOOTBALL_KEY ausente; no se realizó ninguna petición.', [], []);
    await writeJson(resolve(outputRoot, artifact('API_ASSISTS_REPORT.json')), report);
    await writeFile(resolve(outputRoot, artifact('API_ASSISTS_REPORT.md'),), `# ${blockLabel} — API-Football asistencias\n\n- estado: **not_run**\n- peticiones: **0**\n- payloads guardados: **no**\n`, 'utf8');
    console.log(JSON.stringify({ status: 'not_run', requestsPerformed: 0, factsImported: 0 }, null, 2)); return;
  }
  const requests: RequestEvidence[] = []; const facts: ChampionsAssistFact[] = []; const anomalies: Array<RecordValue> = [];
  let uncreditedGoalEvents = 0; let goalEvents = 0; let stoppedForQuota = false;
  try {
    const league = await request('/leagues?id=2'); requests.push(league.evidence);
    const seasonRows = array(object(array(league.body.response)[0]).seasons).map(object);
    const seasonRow = seasonRows.find((row) => Number(row.year) === activeSeason);
    const requestedSeasons = Array.from({ length: activeSeason - 1955 + 1 }, (_, index) => 1955 + index);
    const seasons = requestedSeasons.map((season) => {
      const row = seasonRows.find((candidate) => Number(candidate.year) === season);
      const eventsCovered = object(object(object(row).coverage).fixtures).events === true;
      return { season, status: !row ? 'absent_in_api' : eventsCovered ? (season === activeSeason ? 'active_events_confirmed' : 'available_events_confirmed_not_downloaded') : 'available_without_event_coverage', eventsDownloaded: false };
    });
    if (!league.evidence.ok || !seasonRow || object(object(seasonRow.coverage).fixtures).events !== true) {
      const report = reportFile('not_run', 'La cobertura de eventos de la temporada activa no fue confirmada por API-Football.', requests, facts, { seasons, seasonsConsulted: requestedSeasons, anomalies: [{ reason: 'active_season_events_not_confirmed' }] });
      await writeJson(resolve(outputRoot, artifact('API_ASSISTS_REPORT.json')), report); console.log(JSON.stringify({ status: 'not_run', requestsPerformed: requests.length, factsImported: 0 }, null, 2)); return;
    }
    const fixtures = await request(`/fixtures?league=2&season=${activeSeason}&status=FT-AET-PEN`); requests.push(fixtures.evidence);
    const ids = fixtureIds(fixtures.body);
    for (let offset = 0; offset < ids.length; offset += 20) {
      const remaining = requests.at(-1)?.quotaRemaining;
      if (remaining !== null && remaining !== undefined && remaining <= quotaReserve) { stoppedForQuota = true; break; }
      const batch = ids.slice(offset, offset + 20); const detail = await request(`/fixtures?ids=${batch.join('-')}`); requests.push(detail.evidence);
      if (!detail.evidence.ok) { anomalies.push({ reason: 'fixture_detail_failed', batchStart: offset, httpStatus: detail.evidence.httpStatus }); continue; }
      const detailMatches = matches(detail.body);
      goalEvents += detailMatches.flatMap((match) => (match.events ?? []).filter((event) => event.type?.toLocaleLowerCase('en-US') === 'goal' && !String(event.detail ?? '').toLocaleLowerCase('en-US').includes('own goal'))).length;
      const adapted = adaptApiFootballChampionsAssists({ sourceCaptureId: `${artifactPrefix.toLocaleLowerCase()}-api-${activeSeason}-${offset}`, capturedAt: new Date().toISOString(), sourceUrl: `${baseUrl}/fixtures?ids=${batch.join('-')}`, matches: detailMatches, activeSeasonStart: activeSeason });
      facts.push(...adapted.facts.map((fact) => ({ ...fact, evidence: { ...fact.evidence, contentSha256: detail.rawHash } }))); anomalies.push(...adapted.anomalies.map((item) => ({ fixtureId: item.fixtureId, reason: item.reason }))); uncreditedGoalEvents += adapted.uncreditedGoalEvents;
    }
    const complete = !stoppedForQuota && ids.length > 0 && requests.filter((item) => item.endpoint.startsWith('/fixtures?ids=')).every((item) => item.ok);
    const activeSeasonRecord = seasons.find((row) => row.season === activeSeason);
    if (activeSeasonRecord) activeSeasonRecord.status = complete ? 'active_events_loaded' : 'active_events_partial';
    const coverageEstimated = goalEvents > 0 ? Number((facts.length / goalEvents).toFixed(6)) : null;
    const report = reportFile(complete ? 'ready_for_lab_load' : 'partial', complete ? 'Fixture list and event details completed; assist credit is only recorded when API-Football provides an assister.' : 'Carga parcial; no se presenta como cobertura completa.', requests, facts, { seasons, seasonsConsulted: requestedSeasons, goalEvents, uncreditedGoalEvents, coverageEstimated, anomalies, stoppedForQuota, fixtureCount: ids.length, detailRequests: requests.filter((item) => item.endpoint.startsWith('/fixtures?ids=')).length, coverageComplete: complete });
    await writeJson(resolve(outputRoot, artifact('API_ASSISTS_FACTS.json')), { source: 'api-football', activeSeason, activeCoverageComplete: complete, facts });
    await writeJson(resolve(outputRoot, artifact('API_ASSISTS_REPORT.json')), report);
    await writeFile(resolve(outputRoot, artifact('API_ASSISTS_REPORT.md')), `# ${blockLabel} — API-Football asistencias\n\n- estado: **${report.status}**\n- temporada: **${activeSeason}**\n- hechos: **${facts.length}**\n- eventos de gol sin asistente explícito: **${uncreditedGoalEvents}**\n- peticiones: **${requests.length}**\n- cuota restante: **${report.quotaRemaining ?? 'no observada'}**\n- payloads guardados: **no**\n\nLas asistencias no proporcionadas por la fuente quedan sin asignar; no se infieren.\n`, 'utf8');
    console.log(JSON.stringify({ status: report.status, requestsPerformed: requests.length, factsImported: facts.length, coverageComplete: complete, quotaRemaining: report.quotaRemaining }, null, 2));
  } catch (error) {
    const report = reportFile('failed', 'Error de red o respuesta API; no se guardó payload crudo.', requests, facts, { error: error instanceof Error ? error.message.slice(0, 300) : 'unknown_error', uncreditedGoalEvents });
    await writeJson(resolve(outputRoot, artifact('API_ASSISTS_REPORT.json')), report); console.log(JSON.stringify({ status: 'failed', requestsPerformed: requests.length, factsImported: facts.length }, null, 2));
    process.exitCode = 1;
  }
}
await main();
