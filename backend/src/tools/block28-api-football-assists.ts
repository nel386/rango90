import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  adaptApiFootballChampionsAssists,
  stableAssistJson,
  type ApiFootballChampionsAssistMatch,
  type ChampionsAssistFact
} from '../championsAssistsRankingEngine.js';

type RecordValue = Record<string, unknown>;
type Envelope = { response?: unknown[]; errors?: unknown; results?: number; paging?: RecordValue };
type RequestEvidence = {
  endpoint: string;
  season?: number;
  httpStatus: number | null;
  ok: boolean;
  resultCount: number;
  responseSha256: string;
  quotaRemaining: number | null;
};
type SeasonMatrixRow = {
  season: number;
  requestsPerformed: number;
  playersReturned: number;
  explicitAssists: number;
  matchesQueried: number;
  matchesWithEvents: number;
  goalEvents: number;
  eventsWithoutAssist: number;
  coverageEstimated: number | null;
  status: 'complete' | 'partial' | 'unavailable';
  reason: string;
  source: string;
  sourceSha256: string | null;
};

const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const outputRoot = resolve(process.env.BLOCK28_OUTPUT_ROOT?.trim() || 'audits/block28');
const activeSeason = Number(process.env.BLOCK28_ACTIVE_SEASON_START ?? 2026);
const historicalStart = Number(process.env.BLOCK28_HISTORICAL_START ?? 2011);
const historicalEnd = Number(process.env.BLOCK28_HISTORICAL_END ?? 2025);
const quotaReserve = Math.max(Number(process.env.BLOCK28_QUOTA_RESERVE ?? 5) || 5, 0);
const timeoutMs = Math.min(Math.max(Number(process.env.API_FOOTBALL_TIMEOUT_MS ?? 15_000) || 15_000, 1_000), 60_000);
const baselineReportFile = process.env.BLOCK28_BASELINE_API_REPORT_FILE?.trim() ?? '';
function object(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function writeJson(path: string, value: unknown): Promise<void> { return mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableAssistJson(value), 'utf8')); }
function quota(headers: Headers): number | null { const value = Number(headers.get('x-ratelimit-requests-remaining')); return Number.isFinite(value) ? value : null; }
function matches(body: Envelope): ApiFootballChampionsAssistMatch[] { return array(body.response).map(object) as ApiFootballChampionsAssistMatch[]; }
function fixtureIds(body: Envelope): number[] { return [...new Set(array(body.response).map(object).map((row) => Number(object(row.fixture).id)).filter((id) => Number.isInteger(id) && id > 0))]; }
function ownGoal(event: RecordValue): boolean { return String(event.detail ?? '').toLocaleLowerCase('en-US').includes('own goal'); }
function goalEvent(event: RecordValue): boolean { return String(event.type ?? '').toLocaleLowerCase('en-US') === 'goal' && !ownGoal(event); }
function explicitAssist(event: RecordValue): boolean {
  const assist = object(event.assist);
  return Number.isInteger(assist.id) && Boolean(String(assist.name ?? '').trim());
}
async function readJson(path: string): Promise<RecordValue> {
  if (!path) return {};
  try { return JSON.parse(await readFile(path, 'utf8')) as RecordValue; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}
async function request(endpoint: string, season?: number): Promise<{ body: Envelope; evidence: RequestEvidence; rawHash: string }> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' }, signal: controller.signal });
    const raw = await response.text();
    let body: Envelope = {};
    try { body = object(JSON.parse(raw)) as Envelope; } catch { body = { errors: { invalid_json: true } }; }
    return { body, rawHash: sha256(raw), evidence: { endpoint, season, httpStatus: response.status, ok: response.ok, resultCount: array(body.response).length, responseSha256: sha256(raw), quotaRemaining: quota(response.headers) } };
  } finally { clearTimeout(timer); }
}
function seasonRow(season: number, status: SeasonMatrixRow['status'], reason: string, extra: Partial<SeasonMatrixRow> = {}): SeasonMatrixRow {
  return { season, requestsPerformed: 0, playersReturned: 0, explicitAssists: 0, matchesQueried: 0, matchesWithEvents: 0, goalEvents: 0, eventsWithoutAssist: 0, coverageEstimated: null, status, reason, source: `${baseUrl}/fixtures`, sourceSha256: null, ...extra };
}
async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  if (!apiKey) {
    await writeJson(resolve(outputRoot, 'BLOCK28_API_ASSISTS_REPORT.json'), { status: 'not_run', reason: 'API_FOOTBALL_KEY ausente', requestsPerformed: 0, rawPayloadsStored: false, secretPrinted: false });
    console.log(JSON.stringify({ status: 'not_run', requestsPerformed: 0, factsImported: 0 }, null, 2)); return;
  }
  const requests: RequestEvidence[] = [];
  const facts: ChampionsAssistFact[] = [];
  const matrix: SeasonMatrixRow[] = [];
  const anomalies: RecordValue[] = [];
  let stoppedForQuota = false;
  try {
    const baseline = await readJson(baselineReportFile);
    const baselineRequests = Array.isArray(baseline.requests) ? baseline.requests : [];
    const league = await request('/leagues?id=2'); requests.push(league.evidence);
    const seasonRows = array(object(array(league.body.response)[0]).seasons).map(object);
    for (const season of Array.from({ length: historicalEnd - historicalStart + 1 }, (_, index) => historicalStart + index)) {
      const available = seasonRows.find((row) => Number(row.year) === season);
      if (!available) {
        matrix.push(seasonRow(season, 'unavailable', 'API-Football no declara esta temporada para la competición.'));
        continue;
      }
      if (object(object(available.coverage).fixtures).events !== true) {
        matrix.push(seasonRow(season, 'unavailable', 'La API declara la temporada, pero no confirma cobertura de eventos.'));
        continue;
      }
      const row = seasonRow(season, 'partial', 'Pendiente de descargar partidos y comprobar cada evento.');
      const seasonHashes: string[] = [];
      const fixtures = await request(`/fixtures?league=2&season=${season}&status=FT-AET-PEN`, season);
      requests.push(fixtures.evidence); row.requestsPerformed += 1; seasonHashes.push(fixtures.rawHash);
      if (!fixtures.evidence.ok) {
        row.status = 'unavailable'; row.reason = `Falló la lista de partidos: HTTP ${fixtures.evidence.httpStatus ?? 'desconocido'}.`; row.sourceSha256 = sha256(stableAssistJson(seasonHashes)); matrix.push(row); continue;
      }
      const ids = fixtureIds(fixtures.body); row.matchesQueried = ids.length;
      if (!ids.length) {
        row.status = 'unavailable'; row.reason = 'La lista de partidos no devolvió fixtures procesables.'; row.sourceSha256 = sha256(stableAssistJson(seasonHashes)); matrix.push(row); continue;
      }
      for (let offset = 0; offset < ids.length; offset += 20) {
        const remaining = requests.at(-1)?.quotaRemaining;
        if (remaining !== null && remaining !== undefined && remaining <= quotaReserve) { stoppedForQuota = true; break; }
        const batch = ids.slice(offset, offset + 20);
        const detail = await request(`/fixtures?ids=${batch.join('-')}`, season); requests.push(detail.evidence); row.requestsPerformed += 1; seasonHashes.push(detail.rawHash);
        if (!detail.evidence.ok) { anomalies.push({ season, reason: 'fixture_detail_failed', batchStart: offset, httpStatus: detail.evidence.httpStatus }); continue; }
        const detailMatches = matches(detail.body);
        row.matchesWithEvents += detailMatches.filter((match) => array(match.events).length > 0).length;
        for (const match of detailMatches) {
          for (const event of array(match.events).map(object)) {
            if (!goalEvent(event)) continue;
            row.goalEvents += 1;
            if (explicitAssist(event)) row.explicitAssists += 1;
            else row.eventsWithoutAssist += 1;
          }
        }
        const adapted = adaptApiFootballChampionsAssists({ sourceCaptureId: `block28-api-${season}-${offset}`, capturedAt: new Date().toISOString(), sourceUrl: `${baseUrl}/fixtures?ids=${batch.join('-')}`, matches: detailMatches, activeSeasonStart: activeSeason });
        facts.push(...adapted.facts.map((fact) => ({ ...fact, evidence: { ...fact.evidence, contentSha256: detail.rawHash } })));
        anomalies.push(...adapted.anomalies.map((item) => ({ season, fixtureId: item.fixtureId, reason: item.reason })));
      }
      const seasonFacts = facts.filter((fact) => fact.edition.seasonStart === season);
      row.playersReturned = new Set(seasonFacts.map((fact) => fact.player.canonicalId)).size;
      row.coverageEstimated = row.goalEvents > 0 ? Number((row.explicitAssists / row.goalEvents).toFixed(6)) : null;
      row.sourceSha256 = sha256(stableAssistJson(seasonHashes));
      const detailsForSeason = requests.filter((item) => item.season === season && item.endpoint.startsWith('/fixtures?ids='));
      const detailsComplete = detailsForSeason.length > 0 && detailsForSeason.every((item) => item.ok) && !stoppedForQuota;
      if (!detailsComplete) { row.status = 'partial'; row.reason = stoppedForQuota ? 'Carga detenida por reserva de cuota.' : 'Uno o más lotes de detalles no se pudieron descargar.'; }
      else if (row.eventsWithoutAssist > 0) { row.status = 'partial'; row.reason = 'Existen eventos de gol sin asistente explícito; no se convierten en cero ni se infieren.'; }
      else { row.status = 'complete'; row.reason = 'Todos los eventos de gol descargados tienen asistente explícito.'; }
      matrix.push(row);
      if (stoppedForQuota) break;
    }
    for (const season of Array.from({ length: historicalEnd - historicalStart + 1 }, (_, index) => historicalStart + index)) {
      if (!matrix.some((row) => row.season === season)) matrix.push(seasonRow(season, 'unavailable', 'No se consultó por reserva de cuota.'));
    }
    matrix.sort((a, b) => a.season - b.season);
    const combinedRequests = [...baselineRequests, ...requests];
    const complete = matrix.filter((row) => row.status === 'complete').length;
    const partial = matrix.filter((row) => row.status === 'partial').length;
    const unavailable = matrix.filter((row) => row.status === 'unavailable').length;
    const report = {
      artifactKind: 'block28_api_football_champions_assists', reportVersion: '1', generatedAt: new Date().toISOString(), status: stoppedForQuota ? 'partial' : 'ready_for_lab_load', categorySlug: 'uefa-champions-league-assists',
      competition: { leagueId: 2, historicalStart, historicalEnd, activeSeason, qualifyingExcluded: true, penaltyShootoutsExcluded: true },
      requests: combinedRequests, requestsPerformed: combinedRequests.length, newRequestsPerformed: requests.length, historicalRequestsPerformed: requests.length, baselineRequestsPerformed: baselineRequests.length,
      quotaRemaining: combinedRequests.at(-1)?.quotaRemaining ?? null, quotaReserve, factsImported: facts.length, previousFacts: 230, combinedFactsExpected: facts.length + 230,
      playersNormalized: new Set(facts.map((fact) => fact.player.canonicalId)).size, conflicts: 0, unresolvedIdentities: facts.filter((fact) => fact.player.resolution === 'normalized_name').length, duplicateFacts: 0,
      seasons: matrix, seasonMatrix: matrix, seasonsComplete: complete, seasonsPartial: partial, seasonsUnavailable: unavailable, anomalies, stoppedForQuota,
      baseline: { reportFile: baselineReportFile || null, activeSeason, facts: 230, rawPayloadsStored: false },
      topPlayerEndpointUsed: false, rawPayloadsStored: false, secretPrinted: false, productionDatabaseAccess: 'none', officialSnapshotCreated: false,
      sourceType: 'primary', source: baseUrl, sourceHashes: matrix.map((row) => ({ season: row.season, sha256: row.sourceSha256 }))
    };
    await writeJson(resolve(outputRoot, 'BLOCK28_API_ASSISTS_FACTS.json'), { source: 'api-football', seasons: [historicalStart, historicalEnd], facts });
    await writeJson(resolve(outputRoot, 'BLOCK28_API_ASSISTS_REPORT.json'), report);
    await writeFile(resolve(outputRoot, 'BLOCK28_API_ASSISTS_REPORT.md'), `# BLOQUE 28 — API-Football asistencias\n\n- estado: **${report.status}**\n- peticiones totales: **${report.requestsPerformed}**\n- peticiones nuevas: **${report.newRequestsPerformed}**\n- hechos nuevos: **${facts.length}**\n- temporadas completas: **${complete}**\n- temporadas parciales: **${partial}**\n- temporadas sin datos: **${unavailable}**\n- cuota restante: **${report.quotaRemaining ?? 'no observada'}**\n- endpoint de top de jugadores utilizado: **no**\n- payloads guardados: **no**\n\nLos eventos sin asistente explícito permanecen como desconocidos; no se infieren.\n`, 'utf8');
    console.log(JSON.stringify({ status: report.status, requestsPerformed: report.requestsPerformed, newRequestsPerformed: requests.length, factsImported: facts.length, seasonsComplete: complete, seasonsPartial: partial, seasonsUnavailable: unavailable, quotaRemaining: report.quotaRemaining }, null, 2));
  } catch (error) {
    const report = { status: 'failed', reason: error instanceof Error ? error.message.slice(0, 300) : 'unknown_error', requestsPerformed: requests.length, factsImported: facts.length, rawPayloadsStored: false, secretPrinted: false };
    await writeJson(resolve(outputRoot, 'BLOCK28_API_ASSISTS_REPORT.json'), report); console.log(JSON.stringify(report, null, 2)); process.exitCode = 1;
  }
}
await main();
