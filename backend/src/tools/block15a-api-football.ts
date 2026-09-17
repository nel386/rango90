import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  CHAMPIONS_CATEGORY_SLUG,
  CHAMPIONS_HISTORICAL_END,
  CHAMPIONS_HISTORICAL_START,
  adaptApiFootballChampionsMatches,
  buildChampionsRanking,
  buildChampionsSnapshot,
  detectChampionsConflicts,
  stableJson,
  type ApiFootballChampionsMatch,
  type ChampionsGoalFact
} from '../championsRankingEngine.js';

type JsonRecord = Record<string, unknown>;
type ApiEnvelope = JsonRecord & { response?: unknown[]; errors?: unknown; results?: number; paging?: JsonRecord };
type Quota = { limit: number | null; remaining: number | null };
type RequestEvidence = { endpoint: string; httpStatus: number | null; ok: boolean; resultCount: number; responseSha256: string | null; quota: Quota };
type PlanSeason = { season: number; status: 'confirmed' | 'not_available_in_api' | 'events_not_covered' | 'fixtures_unavailable' | 'quota_limited'; fixtureIds: number[]; estimatedDetailRequests: number; fixtureList?: RequestEvidence; reason?: string };

const mode = process.env.BLOCK15A_MODE?.trim() || 'plan';
const outputRoot = resolve(process.env.BLOCK15A_OUTPUT_ROOT?.trim() || 'audits/block15a');
const planFile = process.env.BLOCK15A_PLAN_FILE?.trim() || resolve(outputRoot, 'BLOCK15A_COVERAGE_PLAN.json');
const captureRoot = resolve(process.env.BLOCK15A_CAPTURE_ROOT?.trim() || resolve(outputRoot, 'not-uploaded-captures'));
const factsRoot = resolve(process.env.BLOCK15A_FACTS_ROOT?.trim() || resolve(outputRoot, 'not-uploaded-facts'));
const apiBaseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const apiKey = process.env.API_FOOTBALL_KEY?.trim() || '';
const runId = process.env.BLOCK15A_RUN_ID?.trim() || process.env.GITHUB_RUN_ID?.trim() || new Date().toISOString().replace(/[^0-9]/gu, '').slice(0, 14);
const timeoutMs = Math.min(Math.max(Number(process.env.API_FOOTBALL_TIMEOUT_MS ?? 15_000) || 15_000, 1_000), 60_000);
const quotaReserve = Math.max(Number(process.env.BLOCK15A_QUOTA_RESERVE ?? 5) || 5, 0);
const activeSeasonStart = Number(process.env.BLOCK15A_ACTIVE_SEASON_START ?? 2026);

function objectValue(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function numberValue(value: unknown): number | undefined { return typeof value === 'number' && Number.isInteger(value) ? value : undefined; }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function seasonsInRange(): number[] { return Array.from({ length: 2026 - CHAMPIONS_HISTORICAL_START + 1 }, (_, index) => CHAMPIONS_HISTORICAL_START + index); }
function redact(value: string): string {
  return (apiKey ? value.replaceAll(apiKey, '[redacted]') : value)
    .replace(/x-apisports-key[^\s,]*/giu, '[redacted-header]')
    .slice(0, 500);
}
function quotaFromHeaders(headers: Headers): Quota {
  const limit = Number(headers.get('x-ratelimit-requests-limit'));
  const remaining = Number(headers.get('x-ratelimit-requests-remaining'));
  return { limit: Number.isFinite(limit) ? limit : null, remaining: Number.isFinite(remaining) ? remaining : null };
}
function fixtureIds(body: ApiEnvelope): number[] {
  return [...new Set(arrayValue(body.response).map(objectValue).map((row) => numberValue(objectValue(row.fixture).id)).filter((id): id is number => id !== undefined))];
}
function fixtureRows(body: ApiEnvelope): ApiFootballChampionsMatch[] { return arrayValue(body.response).map(objectValue) as ApiFootballChampionsMatch[]; }

async function request(endpoint: string): Promise<{ body: ApiEnvelope; evidence: RequestEvidence; raw: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' }, signal: controller.signal });
    const raw = await response.text();
    let body: ApiEnvelope;
    try { body = objectValue(JSON.parse(raw)) as ApiEnvelope; } catch { body = { errors: { invalid_json: true } }; }
    return { body, raw, evidence: { endpoint, httpStatus: response.status, ok: response.ok, resultCount: arrayValue(body.response).length, responseSha256: sha256(raw), quota: quotaFromHeaders(response.headers) } };
  } finally {
    clearTimeout(timer);
  }
}

function availableSeasons(body: ApiEnvelope): Set<number> {
  const rows = arrayValue(body.response).map(objectValue);
  const seasons = arrayValue(objectValue(rows[0]).seasons).map(objectValue).map((season) => numberValue(season.year)).filter((season): season is number => season !== undefined);
  return new Set(seasons);
}

function eventsAreCovered(body: ApiEnvelope, season: number): boolean {
  const row = arrayValue(objectValue(arrayValue(body.response).map(objectValue)[0]).seasons).map(objectValue).find((item) => numberValue(item.year) === season);
  return objectValue(objectValue(objectValue(row).coverage).fixtures).events === true;
}

function planTranches(seasons: PlanSeason[]): Array<Record<string, unknown>> {
  return [
    { name: 'european_cup', startSeason: 1955, endSeason: 1991 },
    { name: 'champions_league', startSeason: 1992, endSeason: 2025 },
    { name: 'active_2026', startSeason: 2026, endSeason: 2026 }
  ].map((tranche) => {
    const rows = seasons.filter((item) => item.season >= tranche.startSeason && item.season <= tranche.endSeason);
    return { ...tranche, confirmedSeasons: rows.filter((item) => item.status === 'confirmed').map((item) => item.season), estimatedListRequests: rows.filter((item) => item.status === 'confirmed').length, estimatedDetailRequests: rows.reduce((sum, item) => sum + item.estimatedDetailRequests, 0) };
  });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stableJson(value), 'utf8');
}

async function runPlan(): Promise<void> {
  const requested = seasonsInRange();
  const errors: string[] = [];
  const requests: RequestEvidence[] = [];
  const seasons: PlanSeason[] = [];
  if (!apiKey) errors.push('credencial de API ausente');
  if (apiKey) {
    try {
      const league = await request('/leagues?id=2');
      requests.push(league.evidence);
      if (!league.evidence.ok || Object.keys(objectValue(league.body.errors)).length > 0) {
        throw new Error(`No se pudo consultar la cobertura de la competición (HTTP ${league.evidence.httpStatus ?? 'sin respuesta'}).`);
      }
      const available = availableSeasons(league.body);
      for (const season of requested) {
        if (!available.has(season)) {
          seasons.push({ season, status: 'not_available_in_api', fixtureIds: [], estimatedDetailRequests: 0 });
          continue;
        }
        if (!eventsAreCovered(league.body, season)) {
          seasons.push({ season, status: 'events_not_covered', fixtureIds: [], estimatedDetailRequests: 0, reason: 'La cobertura de eventos de la temporada no está confirmada por /leagues.' });
          continue;
        }
        const latestQuota = requests.at(-1)?.quota;
        if (latestQuota?.remaining !== null && latestQuota?.remaining !== undefined && latestQuota.remaining <= quotaReserve) {
          seasons.push(...requested.slice(seasons.length).map((remainingSeason) => ({ season: remainingSeason, status: 'quota_limited' as const, fixtureIds: [], estimatedDetailRequests: 0, reason: `No se consultó por reserva de cuota (${latestQuota.remaining} <= ${quotaReserve}).` })));
          break;
        }
        const fixtures = await request(`/fixtures?league=2&season=${season}&status=FT-AET-PEN`);
        requests.push(fixtures.evidence);
        const ids = fixtureIds(fixtures.body);
        seasons.push({ season, status: fixtures.evidence.ok && ids.length > 0 ? 'confirmed' : 'fixtures_unavailable', fixtureIds: ids, estimatedDetailRequests: Math.ceil(ids.length / 20), fixtureList: fixtures.evidence, ...(ids.length === 0 ? { reason: 'No hay fixtures finalizados disponibles para planificar.' } : {}) });
      }
    } catch (error) {
      errors.push(redact(error instanceof Error ? error.message : String(error)));
    }
  }
  const plan = {
    artifactKind: 'block15a_champions_coverage_plan',
    reportVersion: '1',
    generatedAt: new Date().toISOString(),
    runId,
    categorySlug: CHAMPIONS_CATEGORY_SLUG,
    competition: { leagueId: 2, requestedSeasons: requested, qualifyingExcluded: true },
    phase: 'coverage_plan',
    eventsDownloaded: false,
    apiKeyUsed: Boolean(apiKey),
    apiBaseUrl,
    requests,
    requestCount: requests.length,
    quota: requests.at(-1)?.quota ?? { limit: null, remaining: null },
    seasons,
    tranches: planTranches(seasons),
    errors,
    status: errors.length > 0 && seasons.length === 0 ? 'not_run' : 'ready_for_load',
    redaction: { secretPrinted: false, secretStored: false, rawPayloadStored: false },
    productionDatabaseAccess: 'none',
    productionMutations: 0
  };
  await mkdir(outputRoot, { recursive: true });
  const jsonPath = resolve(outputRoot, 'BLOCK15A_COVERAGE_PLAN.json');
  const json = stableJson(plan);
  await writeFile(jsonPath, json, 'utf8');
  const confirmed = seasons.filter((season) => season.status === 'confirmed');
  const markdown = [
    '# BLOQUE 15A — plan de cobertura API-Football', '',
    `- estado: **${plan.status}**`, `- temporadas solicitadas: **${requested.length}**`, `- temporadas confirmadas: **${confirmed.length}**`, `- peticiones realizadas: **${requests.length}**`, `- peticiones de eventos descargadas: **0**`, `- cuota restante observada: **${plan.quota.remaining ?? 'no observada'}**`, '',
    '## Tramos', '', '| Tramo | Confirmadas | Peticiones de listado | Peticiones de detalle estimadas |', '| --- | ---: | ---: | ---: |', ...plan.tranches.map((tranche) => `| ${tranche.name} | ${(tranche.confirmedSeasons as number[]).length} | ${tranche.estimatedListRequests} | ${tranche.estimatedDetailRequests} |`), '',
    'La carga queda condicionada a la cuota y a la confirmación de cada temporada. No se descargaron eventos en esta fase.', '',
    ...(errors.length > 0 ? ['## Errores', '', ...errors.map((error) => `- ${error}`), ''] : []),
    'No se accedió a PostgreSQL de producción, no se creó snapshot oficial y no se subió ningún payload crudo.'
  ].join('\n');
  await writeFile(resolve(outputRoot, 'BLOCK15A_COVERAGE_PLAN.md'), `${markdown}\n`, 'utf8');
  console.log(JSON.stringify({ status: plan.status, requestCount: plan.requestCount, confirmedSeasons: confirmed.length, estimatedDetailRequests: confirmed.reduce((sum, season) => sum + season.estimatedDetailRequests, 0), quotaRemaining: plan.quota.remaining }, null, 2));
}

async function runLoad(): Promise<void> {
  const plan = JSON.parse(await readFile(planFile, 'utf8')) as { seasons?: PlanSeason[]; requests?: RequestEvidence[]; quota?: Quota; runId?: string };
  if (!apiKey) {
    const report = {
      artifactKind: 'block15a_champions_real_load_report', reportVersion: '1', generatedAt: new Date().toISOString(), runId,
      categorySlug: CHAMPIONS_CATEGORY_SLUG, phase: 'tranche_load', status: 'not_run', reason: 'credencial de API ausente; no se realizó ninguna petición.',
      apiBaseUrl, apiKeyUsed: false, requestsPerformed: 0, requestsPlanned: 0, quota: { limit: null, remaining: null, reserve: quotaReserve, stoppedForQuota: false }, factsImported: 0,
      seasons: [], seasonsCovered: [], seasonsPartial: [], seasonsAbsent: (plan.seasons ?? []).map((season) => season.season), historicalSources: { status: 'not_loaded_in_15a' }, conflicts: [], errors: ['credencial de API ausente'],
      candidateRanking: { status: 'not_sufficient', entries: [], reason: 'Carga no ejecutada.' }, candidateSnapshot: { status: 'not_created' }, rollback: { status: 'passed_fixture', productionRollback: false },
      productionDatabaseAccess: 'none', productionMutations: 0, imagesTouched: false, redaction: { secretPrinted: false, secretStored: false, rawPayloadUploaded: false }, publication: { status: 'blocked' }, sha256: ''
    };
    report.sha256 = sha256(stableJson({ ...report, sha256: '' }));
    await writeJson(resolve(outputRoot, 'BLOCK15A_REAL_LOAD_REPORT.json'), report);
    await writeFile(resolve(outputRoot, 'BLOCK15A_REAL_LOAD_REPORT.md'), '# BLOQUE 15A — carga real API-Football\n\n- estado: **not_run**\n- motivo: no se proporcionó la credencial de API.\n- peticiones realizadas: **0**\n- hechos importados: **0**\n\nNo se realizó ninguna llamada ni se subió ningún payload.\n', 'utf8');
    console.log(JSON.stringify({ status: 'not_run', reason: 'credencial de API ausente', requestsPerformed: 0, factsImported: 0 }, null, 2));
    return;
  }
  const planned = (plan.seasons ?? []).filter((season) => season.status === 'confirmed');
  const requests: RequestEvidence[] = [];
  const errors: string[] = [];
  const facts: ChampionsGoalFact[] = [];
  const seasonRows: Array<Record<string, unknown>> = [];
  let quota = plan.quota ?? { limit: null, remaining: null };
  let stoppedForQuota = false;
  await mkdir(captureRoot, { recursive: true });
  for (const season of planned) {
    let detailRequests = 0;
    let detailedFixtures = 0;
    let anomalies = 0;
    let seasonError: string | null = null;
    for (let offset = 0; offset < season.fixtureIds.length; offset += 20) {
      if (quota.remaining !== null && quota.remaining <= quotaReserve) {
        stoppedForQuota = true;
        seasonError = `detenido por reserva de cuota (${quota.remaining} <= ${quotaReserve})`;
        break;
      }
      const batch = season.fixtureIds.slice(offset, offset + 20);
      const detail = await request(`/fixtures?ids=${batch.join('-')}`);
      requests.push(detail.evidence);
      quota = detail.evidence.quota;
      detailRequests += 1;
      const payloadHash = detail.evidence.responseSha256 ?? sha256(detail.raw);
      await writeFile(resolve(captureRoot, `season-${season.season}-batch-${Math.floor(offset / 20) + 1}.json`), detail.raw, 'utf8');
      if (!detail.evidence.ok) {
        seasonError = `detail HTTP ${detail.evidence.httpStatus}`;
        break;
      }
      const adapted = adaptApiFootballChampionsMatches({ sourceCaptureId: `block15a-${runId}-${season.season}-${offset}`, capturedAt: new Date().toISOString(), sourceUrl: `${apiBaseUrl}/fixtures?ids=${batch.join('-')}`, matches: fixtureRows(detail.body), activeSeasonStart });
      facts.push(...adapted.facts.map((fact) => ({ ...fact, evidence: { ...fact.evidence, contentSha256: payloadHash } })));
      anomalies += adapted.anomalies.length;
      detailedFixtures += fixtureRows(detail.body).length;
    }
    const complete = seasonError === null && detailRequests === season.estimatedDetailRequests && detailedFixtures === season.fixtureIds.length;
    seasonRows.push({ season: season.season, status: complete ? 'complete' : detailedFixtures > 0 ? 'partial' : 'absent', plannedFixtures: season.fixtureIds.length, detailedFixtures, detailRequests, estimatedDetailRequests: season.estimatedDetailRequests, facts: facts.filter((fact) => fact.edition.seasonStart === season.season).length, anomalies, error: seasonError });
    if (stoppedForQuota) break;
  }
  const conflicts = detectChampionsConflicts(facts);
  const coverage = seasonRows.map((row) => ({ sourceKey: 'api-football', coveredSeasons: row.status === 'complete' ? [row.season as number] : [], missingSeasons: row.status === 'complete' ? [] : [row.season as number], complete: row.status === 'complete', reason: row.status === 'complete' ? 'fixtures and event details downloaded' : String(row.error ?? 'incomplete fixture detail response') }));
  const ranking = facts.length > 0 ? buildChampionsRanking({ facts, coverage }) : null;
  const expectedHistoricalSeasons = Array.from({ length: CHAMPIONS_HISTORICAL_END - CHAMPIONS_HISTORICAL_START + 1 }, (_, index) => CHAMPIONS_HISTORICAL_START + index);
  const completeHistorical = expectedHistoricalSeasons.every((season) => seasonRows.some((row) => row.season === season && row.status === 'complete'));
  const sufficient = Boolean(ranking && completeHistorical && conflicts.length === 0 && ranking.unresolvedIdentityFacts.length === 0 && ranking.excludedUnknownPhaseFacts.length === 0);
  await mkdir(factsRoot, { recursive: true });
  const factsPath = resolve(factsRoot, 'champions-facts.json');
  await writeJson(factsPath, { source: 'api-football', runId, facts });
  const candidate = sufficient && ranking ? buildChampionsSnapshot({ facts, dataset: 'historical_base', seasonStart: CHAMPIONS_HISTORICAL_START, seasonEnd: CHAMPIONS_HISTORICAL_END, status: 'lab_provisional', coverage, generatedAt: new Date().toISOString() }) : null;
  if (candidate) await writeJson(resolve(factsRoot, 'candidate-snapshot-lab.json'), candidate);
  const report = {
    artifactKind: 'block15a_champions_real_load_report',
    reportVersion: '1',
    generatedAt: new Date().toISOString(),
    runId,
    categorySlug: CHAMPIONS_CATEGORY_SLUG,
    phase: 'tranche_load',
    apiBaseUrl,
    apiKeyUsed: Boolean(apiKey),
    requestsPerformed: requests.length,
    requestsPlanned: planned.reduce((sum, season) => sum + season.estimatedDetailRequests, 0),
    quota: { ...quota, reserve: quotaReserve, stoppedForQuota },
    factsImported: facts.length,
    factsStoredPath: factsPath,
    seasons: seasonRows,
    seasonsCovered: seasonRows.filter((row) => row.status === 'complete').map((row) => row.season),
    seasonsPartial: seasonRows.filter((row) => row.status === 'partial').map((row) => row.season),
    seasonsAbsent: [...new Set([...(plan.seasons ?? []).filter((season) => season.status !== 'confirmed').map((season) => season.season), ...planned.filter((season) => !seasonRows.some((row) => row.season === season.season)).map((season) => season.season), ...seasonRows.filter((row) => row.status === 'absent').map((row) => row.season)])].sort((a, b) => Number(a) - Number(b)),
    historicalSources: { status: 'not_loaded_in_15a', reason: 'Las capturas estructuradas de Copa de Europa se incorporarán en una fase posterior.' },
    conflicts,
    errors,
    candidateRanking: sufficient && ranking ? { status: 'calculated_in_lab', entries: ranking.entries, coverageComplete: ranking.coverageComplete } : { status: 'not_sufficient', entries: [], reason: 'No se publica ni se presenta ranking candidato hasta completar cobertura, identidad y conflictos.' },
    candidateSnapshot: candidate ? { status: 'lab_provisional', id: candidate.id, contentSha256: candidate.contentSha256, published: false } : { status: 'not_created' },
    rollback: { status: 'passed_fixture', productionRollback: false },
    productionDatabaseAccess: 'none',
    productionMutations: 0,
    imagesTouched: false,
    redaction: { secretPrinted: false, secretStored: false, rawPayloadUploaded: false },
    publication: { status: 'blocked', reason: 'No se crea snapshot oficial ni se importa el top 200 antiguo.' },
    sha256: ''
  };
  report.sha256 = sha256(stableJson({ ...report, sha256: '' }));
  await writeJson(resolve(outputRoot, 'BLOCK15A_REAL_LOAD_REPORT.json'), report);
  const markdown = [
    '# BLOQUE 15A — carga real API-Football', '',
    `- hechos importados: **${report.factsImported}**`, `- peticiones realizadas: **${report.requestsPerformed}** / **${report.requestsPlanned}**`, `- temporadas completas: **${report.seasonsCovered.length}**`, `- temporadas parciales: **${report.seasonsPartial.length}**`, `- temporadas ausentes: **${report.seasonsAbsent.length}**`, `- cuota restante: **${report.quota.remaining ?? 'no observada'}**`, `- conflictos: **${report.conflicts.length}**`, '',
    '| Temporada | Estado | Fixtures planificados | Fixtures detallados | Hechos |', '| --- | --- | ---: | ---: | ---: |', ...report.seasons.map((row) => `| ${row.season} | ${row.status} | ${row.plannedFixtures} | ${row.detailedFixtures} | ${row.facts} |`), '',
    `Ranking candidato: **${report.candidateRanking.status}**. Snapshot oficial: **no creado**.`, '',
    'Los payloads y hechos se conservaron solo en almacenamiento efímero del runner; el artefacto publicado contiene únicamente este informe redactado.'
  ].join('\n');
  await writeFile(resolve(outputRoot, 'BLOCK15A_REAL_LOAD_REPORT.md'), `${markdown}\n`, 'utf8');
  console.log(JSON.stringify({ status: report.publication.status, factsImported: report.factsImported, requestsPerformed: report.requestsPerformed, seasonsCovered: report.seasonsCovered.length, seasonsPartial: report.seasonsPartial.length, seasonsAbsent: report.seasonsAbsent.length, quotaRemaining: report.quota.remaining, conflicts: report.conflicts.length, candidateRanking: report.candidateRanking.status }, null, 2));
}

if (mode === 'plan') await runPlan();
else if (mode === 'load') await runLoad();
else throw new Error('BLOCK15A_MODE debe ser plan o load');
