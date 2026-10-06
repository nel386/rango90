import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { stableYellowJson, type YellowCardFact } from '../clubYellowCardsCareerRankingEngine.js';

type Json = Record<string, unknown>;
type Coverage = { facts: number; league: string; leagueId: number; pagesExpected: number; pagesRead: number; playersReturned: number; reason: string; season: number; status: string };
type RequestEvidence = { endpoint: string; kind: 'preflight' | 'league_page'; status: number; responseSha256: string; responseComplete: boolean; dailyRemaining: number | null; dailyLimit: number | null; minuteRemaining: number | null; minuteLimit: number | null; pagingCurrent: number | null; pagingTotal: number | null };
export type ActiveFact = { factId: string; leagueId: number; competitionName: string; competitionType: string; playerId: string; playerName: string; season: number; clubId: number; clubName: string; yellowCards: number; page: number; responseSha256: string; capturedAt: string; sourceUrl: string };
type RankingRow = { playerId: string; playerName: string; yellowCards: number; rank: number; tieGroup: number; evidence: Array<{ factId: string; clubId: number; clubName: string; yellowCards: number; sourcePage: number; responseSha256: string }> };
type LeagueRanking = { leagueId: number; leagueNameEs: string; leagueNameEn: string; season: number; coverage: { status: 'complete' | 'partial'; pagesExpected: number; pagesRead: number; playersReturned: number; verifiedFactRows: number; rankedPlayers: number; explicitZeroCardFacts: number; latestFactCapturedAt: string | null; cutoffNote: string }; rows: RankingRow[] };
type SeasonCheckpoint = { artifactKind: 'block45_active_season_six_checkpoint'; version: 1; season: number; sourceRunId: string; sourceCommitSha: string; sourceManifestHash: string; sourceCoverageHash: string; sourceFactsHash: string; preflight: Json | null; preflightHistory?: Json[]; requests: RequestEvidence[]; coverage: Coverage[]; facts: ActiveFact[]; errors: string[]; stoppedForRateLimit: boolean; generatedAt: string; checkpointHash: string };
type BaseManifest = { artifactKind: string; version: string; baseRunId: string; commitSha: string; workflowName: string; leagueIds: number[]; activeSeason: number; baseCoverageComplete: boolean; selectedSeasons: number[]; coverage: Coverage[]; coverageHash: string; facts: YellowCardFact[]; factsHash: string; requests: Array<Json & { endpoint: string; status: number; responseSha256: string; responseComplete?: boolean; pagingTotal: number | null; kind: string }>; manifestHash: string };
type BaseReport = { baseCoverageComplete?: boolean; baseManifestHashes?: { coverageHash?: string; factsHash?: string; manifestHash?: string }; providerErrors?: number; allPagesUsePagingTotal?: boolean };

const SEASON = 2026;
const SOURCE_RUN_ID = process.env.BLOCK45_SEASON_SIX_SOURCE_RUN_ID?.trim() || '36574961077';
const EXPECTED_SOURCE_COMMIT_SHA = process.env.BLOCK45_SEASON_SIX_EXPECTED_SOURCE_COMMIT_SHA?.trim() || '';
const SOURCE_FILE = resolve(process.env.BLOCK45_SEASON_SIX_SOURCE_FILE?.trim() || '.block45/base/provider/BLOCK45_BASE_MANIFEST.json');
const SOURCE_REPORT_FILE = resolve(process.env.BLOCK45_SEASON_SIX_SOURCE_REPORT_FILE?.trim() || '.block45/base/provider/BLOCK45_REPORT.json');
const RESUME_FILE = process.env.BLOCK45_SEASON_SIX_RESUME_FILE?.trim() || '';
const OUTPUT_ROOT = resolve(process.env.BLOCK45_SEASON_SIX_OUTPUT_ROOT?.trim() || '.block45/season-six');
const MAX_ATTEMPTS = Math.max(1, Number(process.env.BLOCK45_SEASON_SIX_MAX_REQUESTS ?? 7500));
const API_KEY = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const BASE_URL = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/u, '');
const TARGET_LEAGUES = [
  { id: 39, es: 'Premier League', en: 'Premier League' },
  { id: 140, es: 'La Liga', en: 'La Liga' },
  { id: 135, es: 'Serie A', en: 'Serie A' },
  { id: 78, es: 'Bundesliga', en: 'Bundesliga' },
  { id: 61, es: 'Ligue 1', en: 'Ligue 1' },
  { id: 94, es: 'Primeira Liga', en: 'Primeira Liga' },
];
const SAVED_FIVE_LEAGUE_RANKING_SHA256: Record<number, string> = {
  39: 'f7142a3ac85581e10cd368a13d53920a99f198d4a00428c0951706927535b1b5',
  140: '2f8f5af91e1f8ebb63984e86aab277c7e5a8add984bea08a83d00dac7218a1eb',
  135: 'f99b985d05eccf8b966329f4aeab98155d4f54010430a7b498ecdfd167497ccc',
  78: '211c8f35c5e20138d1f6da05f853c0c7b9b4f5bbace9a7c15e3f669149c95cbc',
  61: '3f63d0b6544d9858d6d6d67b415a23f1355766a116f19513112622abd0527676',
};
const HASH = (value: string) => createHash('sha256').update(value).digest('hex');
const HASH_JSON = (value: unknown) => HASH(stableYellowJson(value));
const asObject = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const int = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
const hasErrors = (value: unknown): boolean => value !== undefined && value !== null && value !== false && value !== '' && (Array.isArray(value) ? value.length > 0 : typeof value === 'object' ? Object.keys(value as Json).length > 0 : true);
const numberHeader = (headers: Headers, name: string): number | null => { const value = headers.get(name); if (!value?.trim()) return null; const number = Number(value); return Number.isInteger(number) && number >= 0 ? number : null; };
const jsonWrite = async (name: string, value: unknown) => { await mkdir(OUTPUT_ROOT, { recursive: true }); await writeFile(join(OUTPUT_ROOT, name), stableYellowJson(value), 'utf8'); };

export function verifyBase(manifest: BaseManifest, report?: BaseReport): string[] {
  const errors: string[] = [];
  if (manifest.artifactKind !== 'block45_base_manifest' || manifest.version !== '1' || manifest.baseRunId !== SOURCE_RUN_ID) errors.push('base manifest kind/version/runId mismatch');
  if (EXPECTED_SOURCE_COMMIT_SHA && manifest.commitSha !== EXPECTED_SOURCE_COMMIT_SHA) errors.push('commitSha differs from GitHub run provenance');
  if (!manifest.baseCoverageComplete || manifest.activeSeason !== SEASON || !manifest.selectedSeasons.includes(SEASON)) errors.push('base manifest is not complete for active season 2026');
  const { manifestHash, ...unsigned } = manifest;
  if (HASH_JSON(unsigned) !== manifestHash) errors.push('manifestHash mismatch');
  if (HASH_JSON(manifest.coverage) !== manifest.coverageHash) errors.push('coverageHash mismatch');
  if (HASH_JSON(manifest.facts) !== manifest.factsHash) errors.push('factsHash mismatch');
  if (!report || report.baseCoverageComplete !== true || report.providerErrors !== 0 || report.allPagesUsePagingTotal !== true) errors.push('base report does not attest complete paging and zero provider errors');
  if (report?.baseManifestHashes?.coverageHash !== manifest.coverageHash || report?.baseManifestHashes?.factsHash !== manifest.factsHash || report?.baseManifestHashes?.manifestHash !== manifest.manifestHash) errors.push('base report hash references do not match manifest');
  const expectedOldIds = [39, 61, 78, 135, 140];
  if (HASH_JSON([...manifest.leagueIds].sort((a, b) => a - b)) !== HASH_JSON(expectedOldIds)) errors.push('source manifest league set differs from audited five-league checkpoint');
  const expectedSeasons = Array.from({ length: 17 }, (_, index) => 2010 + index);
  if (HASH_JSON(manifest.selectedSeasons) !== HASH_JSON(expectedSeasons)) errors.push('source manifest selected seasons differ from 2010–2026');
  const expectedCoverageKeys = new Set(expectedOldIds.flatMap((leagueId) => expectedSeasons.map((season) => `${leagueId}|${season}`)));
  const coverageKeys = manifest.coverage.map((row) => `${row.leagueId}|${row.season}`);
  if (coverageKeys.length !== 85 || new Set(coverageKeys).size !== 85 || coverageKeys.some((key) => !expectedCoverageKeys.has(key))) errors.push('source manifest does not contain exactly 85 league-season combinations');
  if (manifest.coverage.some((row) => !['complete', 'no_data'].includes(row.status) || row.pagesExpected === null || row.pagesRead !== row.pagesExpected)) errors.push('source manifest has incomplete page coverage');
  const targetCoverage = manifest.coverage.filter((row) => row.season === SEASON && expectedOldIds.includes(row.leagueId));
  if (targetCoverage.length !== 5 || targetCoverage.some((row) => row.status !== 'complete' || row.pagesExpected === null || row.pagesRead !== row.pagesExpected)) errors.push('five existing 2026 league coverages are not all complete');
  for (const row of targetCoverage) {
    const prefix = `/players?league=${row.leagueId}&season=${SEASON}&page=`;
    const pages = manifest.requests.filter((request) => request.kind === 'league_page' && request.endpoint.startsWith(prefix) && (request.responseComplete === true || (request.responseComplete === undefined && request.status === 200 && Array.isArray(request.attemptStatuses) && request.attemptStatuses.length === 1 && request.attemptStatuses[0] === 200 && request.retryCount === 0)));
    const pageNumbers = pages.map((request) => Number(request.endpoint.slice(prefix.length))).sort((a, b) => a - b);
    if (pages.length !== row.pagesRead || pageNumbers.some((page, index) => page !== index + 1) || pages.some((page) => page.pagingTotal !== row.pagesExpected)) errors.push(`saved page evidence invalid for league ${row.leagueId}`);
  }
  return errors;
}

export function buildOldFacts(manifest: BaseManifest): ActiveFact[] {
  const ids = new Set([39, 140, 135, 78, 61]);
  return manifest.facts.filter((fact) => fact.seasonStart === SEASON && ids.has(fact.competitionProviderId)).map((fact) => ({
    factId: fact.id, leagueId: fact.competitionProviderId, competitionName: fact.competitionName, competitionType: fact.competitionType, playerId: fact.sourcePlayerId,
    playerName: fact.canonicalName, season: SEASON, clubId: fact.clubProviderId, clubName: fact.clubName,
    yellowCards: fact.yellowCards, page: fact.sourcePage, responseSha256: fact.responseSha256,
    capturedAt: fact.capturedAt, sourceUrl: fact.sourceUrl,
  }));
}

export function rankFacts(facts: ActiveFact[], coverage: Coverage[]): LeagueRanking[] {
  return TARGET_LEAGUES.map((league) => {
    const selected = facts.filter((fact) => fact.leagueId === league.id && fact.season === SEASON);
    const grouped = new Map<string, RankingRow>();
    for (const fact of selected) {
      const row = grouped.get(fact.playerId) ?? { playerId: `api-football:player:${fact.playerId}`, playerName: fact.playerName, yellowCards: 0, rank: 0, tieGroup: 0, evidence: [] };
      row.yellowCards += fact.yellowCards;
      row.evidence.push({ factId: fact.factId, clubId: fact.clubId, clubName: fact.clubName, yellowCards: fact.yellowCards, sourcePage: fact.page, responseSha256: fact.responseSha256 });
      grouped.set(fact.playerId, row);
    }
    const rows = [...grouped.values()].filter((row) => row.yellowCards > 0).sort((a, b) => b.yellowCards - a.yellowCards || a.playerName.localeCompare(b.playerName));
    let previous: number | null = null; let tieGroup = 0;
    rows.forEach((row, index) => { if (row.yellowCards !== previous) { previous = row.yellowCards; tieGroup += 1; } row.rank = index === 0 || rows[index - 1]?.yellowCards !== row.yellowCards ? index + 1 : rows[index - 1]!.rank; row.tieGroup = tieGroup; row.evidence.sort((a, b) => a.factId.localeCompare(b.factId)); });
    const covered = coverage.find((entry) => entry.leagueId === league.id && entry.season === SEASON);
    const captures = selected.map((fact) => fact.capturedAt).sort();
    return { leagueId: league.id, leagueNameEs: league.es, leagueNameEn: league.en, season: SEASON, coverage: { status: covered?.status === 'complete' ? 'complete' : 'partial', pagesExpected: covered?.pagesExpected ?? 0, pagesRead: covered?.pagesRead ?? 0, playersReturned: covered?.playersReturned ?? 0, verifiedFactRows: selected.length, rankedPlayers: rows.length, explicitZeroCardFacts: selected.filter((fact) => fact.yellowCards === 0).length, latestFactCapturedAt: captures.at(-1) ?? null, cutoffNote: 'Corte independiente de esta liga; las seis competiciones no se mezclan en un único ranking.' }, rows };
  });
}

async function findResumeCheckpoint(path: string): Promise<SeasonCheckpoint> {
  const checkpoint = JSON.parse(await readFile(path, 'utf8')) as SeasonCheckpoint;
  const { checkpointHash, ...unsigned } = checkpoint;
  if (checkpoint.artifactKind !== 'block45_active_season_six_checkpoint' || checkpoint.version !== 1 || checkpoint.season !== SEASON || checkpoint.sourceRunId !== SOURCE_RUN_ID || HASH_JSON(unsigned) !== checkpointHash) throw new Error('Resume checkpoint is incompatible or hash-invalid');
  return checkpoint;
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  if (!API_KEY) { await jsonWrite('BLOCK45_ACTIVE_SEASON_SIX_REPORT.json', { artifactKind: 'block45_active_season_six_report', status: 'not_run', reason: 'API_FOOTBALL_KEY unavailable', apiCalls: 0 }); return; }
  const base = JSON.parse(await readFile(SOURCE_FILE, 'utf8')) as BaseManifest;
  const baseReport = JSON.parse(await readFile(SOURCE_REPORT_FILE, 'utf8')) as BaseReport;
  const baseErrors = verifyBase(base, baseReport);
  if (baseErrors.length) { await jsonWrite('BLOCK45_ACTIVE_SEASON_SIX_REPORT.json', { artifactKind: 'block45_active_season_six_report', status: 'blocked_invalid_source_checkpoint', sourceRunId: SOURCE_RUN_ID, sourceManifestHash: base.manifestHash, errors: baseErrors, apiCalls: 0 }); return; }

  const savedBaseFacts = buildOldFacts(base);
  const savedCoverage = base.coverage.filter((row) => row.season === SEASON && [39, 140, 135, 78, 61].includes(row.leagueId));
  const savedFactsPerLeague = Object.fromEntries([39, 140, 135, 78, 61].map((id) => [String(id), savedBaseFacts.filter((fact) => fact.leagueId === id).length]));
  const expectedFactCounts: Record<number, number> = { 39: 511, 140: 573, 135: 608, 78: 426, 61: 468 };
  // rankFacts always includes the sixth target league, which has no source
  // pages yet. Only compare the five saved leagues against their frozen G
  // baseline; Portugal is validated after its own pages are fetched.
  const baselineRankings = rankFacts(savedBaseFacts, savedCoverage).filter((ranking) => [39, 140, 135, 78, 61].includes(ranking.leagueId));
  const baselineMismatches = baselineRankings.filter((ranking) => HASH(JSON.stringify(ranking.rows)) !== SAVED_FIVE_LEAGUE_RANKING_SHA256[ranking.leagueId] || ranking.coverage.verifiedFactRows !== expectedFactCounts[ranking.leagueId]).map((ranking) => ({ leagueId: ranking.leagueId, facts: ranking.coverage.verifiedFactRows, expectedFacts: expectedFactCounts[ranking.leagueId], computedRankingSha256: HASH(JSON.stringify(ranking.rows)), expectedRankingSha256: SAVED_FIVE_LEAGUE_RANKING_SHA256[ranking.leagueId] }));
  if (baselineMismatches.length) {
    await jsonWrite('BLOCK45_ACTIVE_SEASON_SIX_REPORT.json', { artifactKind: 'block45_active_season_six_report', status: 'blocked_saved_five_league_baseline_mismatch', sourceRunId: SOURCE_RUN_ID, sourceManifestHash: base.manifestHash, existingFiveLeaguePagesRead: savedCoverage.reduce((sum, row) => sum + row.pagesRead, 0), existingFiveLeagueFacts: savedBaseFacts.length, baselineMismatches, apiCalls: 0, noCareerExpansion: true, noDatabaseTouched: true, noSnapshotsCreated: true });
    return;
  }
  const priorPortugalFacts = base.facts.filter((fact) => fact.seasonStart === SEASON && fact.competitionProviderId === 94);
  const savedPortugalCoverage = base.coverage.find((row) => row.season === SEASON && row.leagueId === 94);
  if (savedPortugalCoverage && (savedPortugalCoverage.pagesRead > 0 || savedPortugalCoverage.status === 'complete')) throw new Error('Unexpected: source checkpoint already contains Primeira Liga pages; reconcile instead of refetching.');

  let checkpoint: SeasonCheckpoint;
  if (RESUME_FILE) {
    checkpoint = await findResumeCheckpoint(RESUME_FILE);
    if (checkpoint.sourceManifestHash !== base.manifestHash || checkpoint.sourceCoverageHash !== base.coverageHash || checkpoint.sourceFactsHash !== base.factsHash || checkpoint.sourceCommitSha !== base.commitSha) throw new Error('Resume checkpoint points to a different source manifest.');
  }
  else {
    checkpoint = { artifactKind: 'block45_active_season_six_checkpoint', version: 1, season: SEASON, sourceRunId: SOURCE_RUN_ID, sourceCommitSha: base.commitSha, sourceManifestHash: base.manifestHash, sourceCoverageHash: base.coverageHash, sourceFactsHash: base.factsHash, preflight: null, requests: [], coverage: [], facts: [], errors: [], stoppedForRateLimit: false, generatedAt: new Date().toISOString(), checkpointHash: '' };
  }
  const savedPageIds = new Set(checkpoint.facts.map((fact) => fact.factId));
  const oldPortugalByKey = new Map(priorPortugalFacts.map((fact) => [`${fact.sourcePlayerId}|${fact.clubProviderId}|${fact.competitionProviderId}`, fact.yellowCards]));
  const max = MAX_ATTEMPTS;
  const batchStartAttempts = checkpoint.requests.length;
  let lastRequestStartedAt = 0;
  let minuteLimit: number | null = null;
  const waitForSlot = async () => {
    const safeRate = minuteLimit && minuteLimit > 0 ? minuteLimit * 0.75 : 6;
    const delay = Math.ceil(60_000 / safeRate) - (Date.now() - lastRequestStartedAt);
    if (lastRequestStartedAt > 0 && delay > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    lastRequestStartedAt = Date.now();
  };
  const perform = async (endpoint: string, kind: RequestEvidence['kind']): Promise<{ response: globalThis.Response; raw: string; body: Json; evidence: RequestEvidence }> => {
    await waitForSlot();
    let response: globalThis.Response; let raw = '';
    try { response = await fetch(`${BASE_URL}${endpoint}`, { headers: { 'x-apisports-key': API_KEY, accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }); raw = await response.text(); }
    catch { response = globalThis.Response.error(); raw = 'network_error'; }
    let body: Json;
    try { body = asObject(JSON.parse(raw)); } catch { body = {}; }
    const paging = asObject(body.paging);
    const limitPerMinute = numberHeader(response.headers, 'X-RateLimit-Limit');
    if (limitPerMinute && limitPerMinute > 0) minuteLimit = minuteLimit === null ? limitPerMinute : Math.min(minuteLimit, limitPerMinute);
    const evidence: RequestEvidence = { endpoint, kind, status: response.status, responseSha256: HASH(raw), responseComplete: response.status === 200 && !hasErrors(body.errors) && Array.isArray(body.response), dailyRemaining: numberHeader(response.headers, 'x-ratelimit-requests-remaining'), dailyLimit: numberHeader(response.headers, 'x-ratelimit-requests-limit'), minuteRemaining: numberHeader(response.headers, 'X-RateLimit-Remaining'), minuteLimit: limitPerMinute, pagingCurrent: int(paging.current), pagingTotal: int(paging.total) };
    return { response, raw, body, evidence };
  };
  const persist = async (coverage: Coverage[], facts: ActiveFact[], errors: string[], stoppedForRateLimit: boolean) => {
    checkpoint.requests = [...checkpoint.requests]; checkpoint.coverage = coverage; checkpoint.facts = facts; checkpoint.errors = errors; checkpoint.stoppedForRateLimit = stoppedForRateLimit; checkpoint.generatedAt = new Date().toISOString();
    const { checkpointHash: _oldHash, ...unsigned } = checkpoint; checkpoint.checkpointHash = HASH_JSON(unsigned);
    await jsonWrite('BLOCK45_ACTIVE_SEASON_SIX_CHECKPOINT.json', checkpoint);
  };

  const errors = [...checkpoint.errors];
  let stoppedForRateLimit = false;
  let terminalReason: string | null = null;
  {
    if (checkpoint.errors.length > 0) terminalReason = 'checkpoint_has_unresolved_error_requires_review';
    else if (max - (checkpoint.requests.length - batchStartAttempts) < 2) terminalReason = 'budget_too_small_for_preflight_and_one_data_request';
    else {
      const call = await perform('/status', 'preflight');
      checkpoint.requests.push(call.evidence);
      const responseValue = call.body.response;
      const responseIsObjectOrArray = responseValue !== null && typeof responseValue === 'object';
      const responseCount = Array.isArray(responseValue) ? responseValue.length : null;
      const results = int(call.body.results);
      // /status is a special endpoint: it may return an object in `response`
      // and `results` need not equal that object's nested-field count.
      const statusStructureOkay = call.response.status === 200 && !hasErrors(call.body.errors) && responseIsObjectOrArray && results !== null;
      const initialRemaining = call.evidence.dailyRemaining;
      const preflightSummary = { httpStatus: call.response.status, errorsPresent: hasErrors(call.body.errors), results: results ?? null, responseShape: Array.isArray(responseValue) ? 'array' : responseIsObjectOrArray ? 'object' : 'missing_or_malformed', responseCount, dailyRemainingAfterStatus: initialRemaining, dailyLimit: call.evidence.dailyLimit, minuteRemaining: call.evidence.minuteRemaining, minuteLimit: call.evidence.minuteLimit, responseSha256: call.evidence.responseSha256, statusStructureOkay };
      checkpoint.preflight = preflightSummary;
      checkpoint.preflightHistory = [...(checkpoint.preflightHistory ?? []), preflightSummary];
      if (call.response.status === 429) { stoppedForRateLimit = true; terminalReason = 'preflight_429'; }
      else if (!statusStructureOkay) { errors.push('preflight_status_or_errors_malformed'); terminalReason = 'preflight_error_or_malformed_response'; }
      else if (initialRemaining === null || initialRemaining < 1) terminalReason = initialRemaining === null ? 'not_run_daily_quota_unverifiable' : 'not_run_no_daily_request_available_after_preflight';
      else if (call.evidence.minuteLimit === null) terminalReason = 'not_run_per_minute_limit_unverifiable';
    }
  }

  let coverage = [...savedCoverage];
  const priorPortugalCoverage = checkpoint.coverage.find((row) => row.leagueId === 94 && row.season === SEASON);
  if (priorPortugalCoverage) coverage.push(priorPortugalCoverage);
  const facts = [...checkpoint.facts];
  let playersReturned = priorPortugalCoverage?.playersReturned ?? 0;
  let pageTotal = priorPortugalCoverage?.pagesExpected ?? null;
  let pagesRead = priorPortugalCoverage?.pagesRead ?? 0;
  let factsAdded = facts.length;
  if (!terminalReason && checkpoint.preflight && pagesRead === 0) {
    if (checkpoint.requests.length - batchStartAttempts >= max) terminalReason = 'request_attempt_budget_reached_before_discovery_page';
    else {
      const first = await perform(`/players?league=94&season=${SEASON}&page=1`, 'league_page');
      checkpoint.requests.push(first.evidence);
      const rawRows = asArray(first.body.response);
      const firstPaging = asObject(first.body.paging);
      const results = int(first.body.results);
      pageTotal = int(firstPaging.total);
      const structureOkay = first.response.status === 200 && !hasErrors(first.body.errors) && Array.isArray(first.body.response) && results === rawRows.length && int(firstPaging.current) === 1 && pageTotal !== null && pageTotal >= 1;
      if (first.response.status === 429) { stoppedForRateLimit = true; terminalReason = 'first_page_429'; }
      else if (!structureOkay) { errors.push('primeira_liga_page1_http_errors_results_response_paging_invalid'); terminalReason = 'first_page_error_or_malformed_response'; }
      else {
        const expectedPageTotal = pageTotal ?? 0;
        const afterFirstDaily = first.evidence.dailyRemaining;
        const pendingPageCount = expectedPageTotal - 1;
        pagesRead = 1; playersReturned += rawRows.length;
        const pageFacts = extractFacts(rawRows, 1, first.evidence.responseSha256, first.evidence.endpoint);
        const pageErrors = validatePlayers(rawRows, 1);
        if (pageErrors.length) { errors.push(...pageErrors); terminalReason = 'first_page_identity_or_stats_validation_failed'; }
        else {
          for (const fact of pageFacts) {
            const oldYellow = oldPortugalByKey.get(`${fact.playerId}|${fact.clubId}|94`);
            if (oldYellow !== undefined && oldYellow !== fact.yellowCards) { errors.push(`expansion_overlap_conflict:${fact.playerId}:${fact.clubId}`); terminalReason = 'existing_expansion_fact_conflict'; break; }
          }
          if (!terminalReason) { first.evidence.responseComplete = true; facts.push(...pageFacts); factsAdded += pageFacts.length; }
        }
        if (!terminalReason && afterFirstDaily === null) terminalReason = 'daily_quota_unverifiable_after_discovery';
        else if (!terminalReason && afterFirstDaily! < pendingPageCount) terminalReason = 'insufficient_daily_quota_for_remaining_primeira_pages';
        coverage.push({ facts: facts.filter((fact) => fact.leagueId === 94).length, league: 'Primeira Liga', leagueId: 94, season: SEASON, pagesExpected: expectedPageTotal, pagesRead, playersReturned, reason: terminalReason ?? (pagesRead === expectedPageTotal ? 'all paging.total pages read' : 'paging_total_discovered'), status: !terminalReason && pagesRead === expectedPageTotal ? 'complete' : 'partial' });
        await persist(coverage, facts, errors, stoppedForRateLimit);
      }
    }
  }

  if (!terminalReason && checkpoint.preflight && pageTotal !== null) {
    let priorTotal = pageTotal;
    for (let page = pagesRead + 1; page <= pageTotal; page += 1) {
      if (checkpoint.requests.length - batchStartAttempts >= max) { terminalReason = 'request_attempt_budget_reached'; break; }
      const lastDaily = checkpoint.requests.at(-1)?.dailyRemaining;
      const pagesAfterThis = pageTotal - page;
      if (lastDaily !== null && lastDaily !== undefined && lastDaily < 1 + pagesAfterThis) { terminalReason = 'daily_quota_below_remaining_page_requirement'; break; }
      const call = await perform(`/players?league=94&season=${SEASON}&page=${page}`, 'league_page');
      checkpoint.requests.push(call.evidence);
      const rawRows = asArray(call.body.response);
      const paging = asObject(call.body.paging);
      const results = int(call.body.results);
      const total = int(paging.total);
      const structureOkay = call.response.status === 200 && !hasErrors(call.body.errors) && Array.isArray(call.body.response) && results === rawRows.length && int(paging.current) === page && total === priorTotal;
      if (call.response.status === 429) { stoppedForRateLimit = true; terminalReason = `page_${page}_429`; }
      else if (!structureOkay) { errors.push(`page_${page}_http_errors_results_response_identity_or_paging_invalid`); terminalReason = `page_${page}_error_or_malformed_response`; }
      else {
        const pageErrors = validatePlayers(rawRows, page);
        if (pageErrors.length) { errors.push(...pageErrors); terminalReason = `page_${page}_identity_or_stats_validation_failed`; }
        else {
          const pageFacts = extractFacts(rawRows, page, call.evidence.responseSha256, call.evidence.endpoint);
          for (const fact of pageFacts) {
            const oldKey = `${fact.playerId}|${fact.clubId}|94`;
            const oldYellow = oldPortugalByKey.get(oldKey);
            if (oldYellow !== undefined && oldYellow !== fact.yellowCards) { errors.push(`expansion_overlap_conflict:${fact.playerId}:${fact.clubId}`); terminalReason = 'existing_expansion_fact_conflict'; break; }
            if (!savedPageIds.has(fact.factId)) { facts.push(fact); savedPageIds.add(fact.factId); factsAdded += 1; }
          }
          if (!terminalReason) { call.evidence.responseComplete = true; pagesRead += 1; playersReturned += rawRows.length; }
        }
      }
      coverage = coverage.filter((row) => !(row.leagueId === 94 && row.season === SEASON));
      coverage.push({ facts: facts.filter((fact) => fact.leagueId === 94).length, league: 'Primeira Liga', leagueId: 94, season: SEASON, pagesExpected: pageTotal, pagesRead, playersReturned, reason: terminalReason ?? (pagesRead === pageTotal ? 'all paging.total pages read' : `page_${page}_saved`), status: !terminalReason && pagesRead === pageTotal ? 'complete' : 'partial' });
      await persist(coverage, facts, errors, stoppedForRateLimit);
      if (terminalReason) break;
    }
  }

  const allSixComplete = [39, 140, 135, 78, 61, 94].every((id) => coverage.some((row) => row.leagueId === id && row.season === SEASON && row.status === 'complete' && row.pagesRead === row.pagesExpected));
  const mergedFacts = [...savedBaseFacts, ...facts];
  const factById = new Map<string, ActiveFact>();
  for (const fact of mergedFacts) {
    const prior = factById.get(fact.factId);
    if (prior && prior.yellowCards !== fact.yellowCards) { errors.push(`duplicate_fact_value_conflict:${fact.factId}`); continue; }
    if (!prior || fact.leagueId === 94) factById.set(fact.factId, fact);
  }
  const uniqueFacts = [...factById.values()];
  const rankings = rankFacts(uniqueFacts, coverage);
  const candidate = { artifactKind: 'block45_active_season_six_candidate', version: 1, status: allSixComplete && errors.length === 0 ? 'ready_for_isolated_validation' : 'partial_not_publishable', labelEs: 'Tarjetas amarillas — temporada activa (alcance observado)', labelEn: 'Yellow cards — active season (observed scope)', scopeKind: 'club_active_season_observed', season: SEASON, careerComplete: false, includedCompetitionIds: TARGET_LEAGUES.map((league) => league.id), excludedCompetitionIds: [], rankingMode: 'one independent ranking per competition; no cross-league aggregate', sourceRunId: SOURCE_RUN_ID, sourceCommitSha: base.commitSha, sourceManifestHash: base.manifestHash, sourceCoverageHash: base.coverageHash, sourceFactsHash: base.factsHash, generatedAt: new Date().toISOString(), pageCutoffNote: 'Existing five league snapshots retain their checkpoint page capture times; Primeira Liga pages are captured during this run. Each leaderboard is per league and displays its own latest capture time.', fiveLeagueBaselineSha256: Object.fromEntries(baselineRankings.map((ranking) => [ranking.leagueId, HASH(JSON.stringify(ranking.rows))])), rankingSha256: HASH_JSON(rankings), factSha256: HASH_JSON(uniqueFacts), rankings };
  const pendingPrimeiraPages = pageTotal === null ? null : Math.max(0, pageTotal - pagesRead);
  const needsLaterPreflight = pendingPrimeiraPages !== null && pendingPrimeiraPages > 0;
  const report = { artifactKind: 'block45_active_season_six_report', status: allSixComplete && errors.length === 0 ? 'ready_for_isolated_validation' : stoppedForRateLimit ? 'partial_rate_limited' : terminalReason ? 'partial' : 'not_run', source: { baseRunId: SOURCE_RUN_ID, commitSha: base.commitSha, workflowName: base.workflowName, manifestHash: base.manifestHash, coverageHash: base.coverageHash, factsHash: base.factsHash }, season: SEASON, plannedLeagues: TARGET_LEAGUES.map(({ id, es }) => ({ id, name: es })), oldCheckpointReconciliation: { threeLeagueFacts: 1692, otherTwoLeagueFacts: 894, fiveLeagueFacts: savedBaseFacts.length, fiveLeaguePagesExpected: 131, fiveLeaguePagesRead: savedCoverage.reduce((sum, row) => sum + row.pagesRead, 0), factsByLeague: savedFactsPerLeague, earlierThreeLeagueSubtotalIds: [39, 140, 135], remainingTwoLeagueIds: [78, 61], priorIsolatedExpansionFactsForPrimeira: priorPortugalFacts.length, priorPrimeiraCoveragePages: savedPortugalCoverage?.pagesRead ?? 0, fiveLeagueRankingBaselineVerified: true, fiveLeagueRankingSha256: candidate.fiveLeagueBaselineSha256 }, preflight: checkpoint.preflight, preflightHistory: checkpoint.preflightHistory ?? [], apiCallAttempts: checkpoint.requests.length, currentBatchAttempts: checkpoint.requests.length - batchStartAttempts, preflightCalls: checkpoint.requests.filter((request) => request.kind === 'preflight').length, leaguePageCalls: checkpoint.requests.filter((request) => request.kind === 'league_page').length, successfulHttp200Pages: checkpoint.requests.filter((request) => request.kind === 'league_page' && request.responseComplete).length, retryAttempts: 0, stoppedForRateLimit, pendingPrimeiraPages, missingLeaguePageRequests: pendingPrimeiraPages, preflightRequestsNeededForNextRun: needsLaterPreflight ? 1 : 0, exactCallsNeededToFinishFromCheckpoint: pendingPrimeiraPages === null ? null : pendingPrimeiraPages + (needsLaterPreflight ? 1 : 0), exactTargetCallsAfterPage1: pageTotal === null ? null : Math.max(0, pageTotal - 1), totalQueryCallsNeededIncludingPreflight: pageTotal === null ? null : pageTotal + 1, quotaReconciliation: { dailyCounter: 'x-ratelimit-requests-remaining', perMinuteCounter: 'X-RateLimit-Remaining', headerValuesRecordedPerRequest: true, causeOfAnyDelta: 'not inferred; preserve raw observed readings' }, coverage: rankings.map((ranking) => ({ leagueId: ranking.leagueId, name: ranking.leagueNameEn, status: ranking.coverage.status, pagesRead: ranking.coverage.pagesRead, pagesExpected: ranking.coverage.pagesExpected, playersReturned: ranking.coverage.playersReturned, verifiedFactRows: ranking.coverage.verifiedFactRows, explicitZeroCardFacts: ranking.coverage.explicitZeroCardFacts, positiveRankingRows: ranking.coverage.rankedPlayers, latestFactCapturedAt: ranking.coverage.latestFactCapturedAt })), playerTotalsByLeague: rankings.map((ranking) => ({ leagueId: ranking.leagueId, rowCount: ranking.rows.length, topScore: ranking.rows[0]?.yellowCards ?? 0 })), factsAdded, checkpointFactsForPortugal: facts.filter((fact) => fact.leagueId === 94).length, existingExpansionOverlapChecked: priorPortugalFacts.length, errors, terminalReason, noCareerExpansion: true, noDatabaseTouched: true, noSnapshotsCreated: true, noProductionDeployment: true, rawPayloadsStored: false, secretPrinted: false, checkpointFile: 'BLOCK45_ACTIVE_SEASON_SIX_CHECKPOINT.json', candidateFile: allSixComplete && errors.length === 0 ? 'BLOCK45_ACTIVE_SEASON_SIX_RANKING.json' : null };
  await persist(coverage, facts, errors, stoppedForRateLimit);
  await jsonWrite('BLOCK45_ACTIVE_SEASON_SIX_REPORT.json', report);
  if (allSixComplete && errors.length === 0) await jsonWrite('BLOCK45_ACTIVE_SEASON_SIX_RANKING.json', candidate);
  await jsonWrite('BLOCK45_ACTIVE_SEASON_SIX_FACTS.json', uniqueFacts);
  const markdown = [
    '# BLOQUE 45G — ranking de temporada activa (seis ligas)',
    '',
    `- Estado: **${report.status}**`,
    `- Temporada API-Football: **${SEASON}**`,
    '- Alcance: seis rankings separados por competición; no es carrera ni ranking global.',
    `- Run base: \`${SOURCE_RUN_ID}\` · commit \`${base.commitSha}\``,
    `- Manifiesto base: \`${base.manifestHash}\``,
    `- Intentos acumulados del checkpoint: ${checkpoint.requests.length}; esta tanda: ${checkpoint.requests.length - batchStartAttempts}; reintentos: 0.`,
    `- Páginas Primeira Liga pendientes: ${pendingPrimeiraPages === null ? 'por descubrir' : pendingPrimeiraPages}.`,
    `- Llamadas exactas para completar desde el checkpoint, incluida una nueva preflight si requiere otra tanda: ${report.exactCallsNeededToFinishFromCheckpoint ?? 'pendiente de paging.total'}.`,
    '',
    '| Competición | Estado | Páginas | Filas de hechos | Jugadores con amarillas | Cero explícito | Corte observado |',
    '|---|---:|---:|---:|---:|---:|---|',
    ...rankings.map((ranking) => `| ${ranking.leagueNameEn} (${ranking.leagueId}) | ${ranking.coverage.status} | ${ranking.coverage.pagesRead}/${ranking.coverage.pagesExpected} | ${ranking.coverage.verifiedFactRows} | ${ranking.coverage.rankedPlayers} | ${ranking.coverage.explicitZeroCardFacts} | ${ranking.coverage.latestFactCapturedAt ?? 'sin datos'} |`),
    '',
    'La cuota diaria (`x-ratelimit-requests-remaining`) y el límite por minuto (`X-RateLimit-Remaining`) se registran por respuesta por separado. No se atribuye causa a diferencias entre contadores.',
    '',
    'Solo los hechos de respuestas HTTP 200 completas y validadas entran en el candidato. No se guardan payloads crudos ni secretos. No se ejecuta expansión de carrera, importación, load, escritura en base real, snapshot oficial ni despliegue.',
  ].join('\n');
  await writeFile(join(OUTPUT_ROOT, 'BLOCK45_ACTIVE_SEASON_SIX_REPORT.md'), markdown, 'utf8');
}

export function validatePlayers(rows: unknown[], page: number): string[] {
  const errors: string[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const item = asObject(rows[index]); const player = asObject(item.player);
    const playerId = int(player.id); const playerName = typeof player.name === 'string' ? player.name.trim() : '';
    const stats = asArray(item.statistics);
    if (!playerId || !playerName || !Array.isArray(item.statistics)) errors.push(`page_${page}_row_${index}_player_or_statistics_invalid`);
    for (const value of stats) {
      const statistic = asObject(value); const league = asObject(statistic.league); const team = asObject(statistic.team); const cards = asObject(statistic.cards);
      if (int(league.id) === 94 && (typeof league.name !== 'string' || !league.name.trim() || int(league.season) !== SEASON || int(team.id) === null || typeof team.name !== 'string' || !team.name.trim() || int(cards.yellow) === null)) errors.push(`page_${page}_row_${index}_league94_identity_season_team_or_yellow_invalid`);
    }
  }
  return errors;
}

export function extractFacts(rows: unknown[], page: number, responseSha256: string, endpoint: string): ActiveFact[] {
  const capturedAt = new Date().toISOString();
  const out: ActiveFact[] = [];
  for (const value of rows) {
    const item = asObject(value); const player = asObject(item.player); const playerId = int(player.id); const playerName = String(player.name ?? '').trim();
    if (!playerId || !playerName) continue;
    for (const statValue of asArray(item.statistics)) {
      const statistic = asObject(statValue); const league = asObject(statistic.league); const team = asObject(statistic.team); const cards = asObject(statistic.cards);
      if (int(league.id) !== 94) continue;
      const clubId = int(team.id); const yellowCards = int(cards.yellow);
      if (clubId === null || yellowCards === null) continue;
      const factId = `club-yellow-card-fact-${HASH(`${SEASON}|${playerId}|${clubId}|94`).slice(0, 32)}`;
      out.push({ factId, leagueId: 94, competitionName: String(league.name).trim(), competitionType: typeof league.type === 'string' ? league.type : 'provider_type_unavailable', playerId: String(playerId), playerName, season: SEASON, clubId, clubName: String(team.name), yellowCards, page, responseSha256, capturedAt, sourceUrl: `${BASE_URL}${endpoint}` });
    }
  }
  const keys = new Set<string>();
  for (const fact of out) {
    const key = `${fact.playerId}|${fact.clubId}|${fact.leagueId}`;
    if (keys.has(key)) throw new Error(`duplicate league/team/player stat on page ${page}`);
    keys.add(key);
  }
  return out;
}

if (process.env.BLOCK45_SEASON_SIX_TEST_ONLY !== '1') void main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : 'unexpected_error';
  await mkdir(dirname(join(OUTPUT_ROOT, 'failed')), { recursive: true });
  await writeFile(join(OUTPUT_ROOT, 'BLOCK45_ACTIVE_SEASON_SIX_FATAL.txt'), message, 'utf8');
  process.exitCode = 1;
});
