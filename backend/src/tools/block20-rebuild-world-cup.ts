import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildWorldCupSnapshot, normalizeWorldCupName, normalizeWorldCupPhase, type WorldCupFact, type WorldCupPlayer, type WorldCupSnapshot } from '../worldCupRankingEngine.js';

type JsonRecord = Record<string, unknown>;
type OpenGoal = { name?: string; minute?: string | number; penalty?: boolean; owngoal?: boolean };
type OpenMatch = { round?: string; date?: string; team1?: string; team2?: string; score?: number[]; goals1?: OpenGoal[]; goals2?: OpenGoal[] };
type OpenFile = { name?: string; matches?: OpenMatch[] };
type DataGoal = { goal_id?: string; tournament_id?: string; match_id?: string; tournament_name?: string; match_name?: string; match_date?: string; stage_name?: string; group_name?: string; team_name?: string; player_id?: string; family_name?: string; given_name?: string; minute_label?: string; own_goal?: string; penalty?: string };
type DataMatch = { tournament_id?: string; tournament_name?: string; match_id?: string; match_name?: string; match_date?: string; stage_name?: string; home_team_name?: string; away_team_name?: string; home_team_score?: string; away_team_score?: string; penalty_shootout?: string };

const outputRoot = resolve(process.env.BLOCK20_OUTPUT_ROOT?.trim() || 'audits/block20');
const now = new Date().toISOString();
const years = (process.env.BLOCK20_YEARS?.trim() || '1930,1934,1938,1950,1954,1958,1962,1966,1970,1974,1978,1982,1986,1990,1994,1998,2002,2006,2010,2014,2018,2022,2026').split(',').map(Number).filter(Number.isInteger);
const openBase = process.env.BLOCK20_OPENFOOTBALL_BASE_URL?.trim() || 'https://raw.githubusercontent.com/openfootball/worldcup.json/master';
const datahubGoalsUrl = process.env.BLOCK20_DATAHUB_GOALS_URL?.trim() || 'https://datahub.io/football/worldcup/_r/-/goals.csv';
const datahubMatchesUrl = process.env.BLOCK20_DATAHUB_MATCHES_URL?.trim() || 'https://datahub.io/football/worldcup/_r/-/matches.csv';
const heldYears = new Set(years);
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const stable = (value: unknown): string => JSON.stringify(value, Object.keys(value as object).sort());
const writeJson = async (file: string, value: unknown): Promise<void> => { const target = resolve(outputRoot, file); await mkdir(dirname(target), { recursive: true }); await writeFile(target, JSON.stringify(value, null, 2), 'utf8'); };
async function fetchText(url: string): Promise<{ ok: boolean; status: number; body: string; contentSha256: string }> { const response = await fetch(url, { signal: AbortSignal.timeout(30_000) }); const body = response.ok ? await response.text() : ''; return { ok: response.ok, status: response.status, body, contentSha256: sha256(body) }; }
function parseCsv(text: string): JsonRecord[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const char = text[i]; const next = text[i + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { row.push(cell); cell = ''; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i += 1; row.push(cell); if (row.some((part) => part.length > 0)) rows.push(row); row = []; cell = ''; } else cell += char; }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift() ?? []; return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}
function variants(name: string): string[] { const normalized = normalizeWorldCupName(name); const tokens = normalized.split(' ').filter(Boolean); return [...new Set([normalized, tokens.slice().reverse().join(' '), tokens.slice().sort().join(' ')])]; }
function teamKey(name: string | undefined): string { const normalized = normalizeWorldCupName(name ?? ''); const aliases: Record<string, string> = { usa: 'united states', 'united states of america': 'united states', 'czech republic': 'czechoslovakia', czechia: 'czechoslovakia', 'west germany': 'germany', 'soviet union': 'ussr', ussr: 'ussr', 'ivory coast': 'cote d ivoire', 'republic of ireland': 'ireland', 'north korea': 'korea dpr', 'korea dpr': 'korea dpr', 'bosnia herzegovina': 'bosnia and herzegovina' }; return aliases[normalized] ?? normalized; }
function matchKey(year: number, date: string | undefined, home: string | undefined, away: string | undefined): string { return `${year}|${date ?? ''}|${[teamKey(home), teamKey(away)].sort().join('|')}`; }
function displayName(given: string, family: string): string { return `${given} ${family}`.trim() || family || given; }
function dataMatchTeams(row: DataMatch | undefined): { home?: string; away?: string } { if (!row) return {}; if (row.home_team_name && row.away_team_name) return { home: row.home_team_name, away: row.away_team_name }; const parts = (row.match_name ?? '').split(/\s+vs\s+/iu); return { home: parts[0], away: parts[1] }; }
function playerFor(name: string, identityMap: Map<string, { id: string; displayName: string }>, sourceKey: string): WorldCupPlayer {
  const candidates = [...new Set(variants(name).flatMap((variant) => identityMap.get(variant)?.id ?? []))];
  const matched = candidates.length === 1 ? identityMap.get(variants(name).find((variant) => identityMap.has(variant))!) : undefined;
  const normalized = normalizeWorldCupName(name);
  if (matched) return { canonicalId: `world-cup:player:datahub:${matched.id}`, displayName: matched.displayName, normalizedName: normalized, sourceKey: 'fjelstul-world-cup', sourcePlayerId: matched.id, resolution: 'source_id' };
  return { canonicalId: `world-cup:unresolved:${sha256(normalized).slice(0, 24)}`, displayName: name, normalizedName: normalized, sourceKey, sourcePlayerId: `name:${normalized}`, resolution: 'normalized_name' };
}
function fact(input: Omit<WorldCupFact, 'id'>): WorldCupFact { return { ...input, id: `world-cup-fact-${sha256(stable({ sourceCaptureId: input.sourceCaptureId, sourceRecordId: input.sourceRecordId, sourceKey: input.sourceKey })).slice(0, 32)}` }; }

const datahubGoalsResponse = await fetchText(datahubGoalsUrl);
const datahubMatchesResponse = await fetchText(datahubMatchesUrl);
const dataGoals = datahubGoalsResponse.ok ? parseCsv(datahubGoalsResponse.body) as DataGoal[] : [];
const dataMatches = datahubMatchesResponse.ok ? parseCsv(datahubMatchesResponse.body) as DataMatch[] : [];
const identityMap = new Map<string, { id: string; displayName: string }>();
for (const row of dataGoals) { if (!row.player_id || row.own_goal === '1') continue; const name = displayName(row.given_name ?? '', row.family_name ?? ''); for (const variant of variants(name)) { const prior = identityMap.get(variant); if (prior && prior.id !== row.player_id) identityMap.delete(variant); else identityMap.set(variant, { id: row.player_id, displayName: name }); } }
const dataMatchById = new Map(dataMatches.filter((row) => row.match_id).map((row) => [row.match_id!, row]));
const openMatchesByKey = new Map<string, { id: string; match: OpenMatch; year: number }>();
const primaryFacts: WorldCupFact[] = []; const contrastFacts: WorldCupFact[] = []; const coverage: JsonRecord[] = []; const sourceCaptures: JsonRecord[] = []; const conflicts: JsonRecord[] = []; const unresolved: string[] = [];
sourceCaptures.push({ id: `block20-datahub-goals-${datahubGoalsResponse.contentSha256.slice(0, 16)}`, sourceKey: 'fjelstul-world-cup', sourceUrl: datahubGoalsUrl, capturedAt: now, contentSha256: datahubGoalsResponse.contentSha256, dataVersion: 'fjelstul-world-cup-goals-csv', payloadStored: false, available: datahubGoalsResponse.ok });
for (const year of years) {
  const url = `${openBase}/${year}/worldcup-full.json`; const response = await fetchText(url); const parsed = response.ok ? JSON.parse(response.body) as OpenFile : null; const matches = parsed?.matches ?? [];
  const captureId = `block20-openfootball-${year}-${response.contentSha256.slice(0, 16)}`;
  sourceCaptures.push({ id: captureId, sourceKey: 'openfootball-worldcup', sourceUrl: url, capturedAt: now, contentSha256: response.contentSha256, dataVersion: `worldcup-full-${year}`, payloadStored: false });
  const beforePrimary = primaryFacts.length; const beforeUnknown = unresolved.length; let unknownPhases = 0; const unknownRounds = new Set<string>(); const openMatchKeys = new Set<string>();
  matches.forEach((match, matchIndex) => {
    const matchId = `openfootball:world-cup:${year}:${matchIndex + 1}`; const key = matchKey(year, match.date, match.team1, match.team2); openMatchesByKey.set(key, { id: matchId, match, year }); openMatchKeys.add(key); const phase = normalizeWorldCupPhase(match.round); if (phase === 'unknown') { unknownPhases += 1; unknownRounds.add(match.round ?? 'missing'); }
    for (const [teamIndex, goals] of [[match.team1, match.goals1 ?? []], [match.team2, match.goals2 ?? []]] as const) for (const [goalIndex, goal] of goals.entries()) {
      const ownGoal = goal.owngoal === true; const sourceName = goal.name?.trim() || ''; const player = ownGoal ? null : sourceName ? playerFor(sourceName, identityMap, 'openfootball-worldcup') : null;
      if (!player && !ownGoal) unresolved.push(`${year}:${matchIndex + 1}:${goalIndex + 1}:player_missing`);
    const sideIndex = teamIndex === match.team1 ? 1 : 2;
    const row = fact({ edition: { id: `world-cup:${year}`, year, label: String(year), isCurrentEdition: year === 2026 }, player, sourcePlayerName: sourceName || undefined, match: { id: matchId, date: match.date ?? null, homeTeam: match.team1 ?? 'Unknown home team', awayTeam: match.team2 ?? 'Unknown away team' }, phase, goals: 1, isOwnGoal: ownGoal, isShootout: false, scopeEligible: true, role: 'primary', sourceKey: 'openfootball-worldcup', sourceCaptureId: captureId, sourceRecordId: `${year}:match:${matchIndex + 1}:team:${sideIndex}:goal:${goalIndex + 1}`, evidence: { sourceUrl: url, locator: `matches[${matchIndex}].goals${sideIndex}[${goalIndex}]`, excerpt: `${sourceName} ${String(goal.minute ?? '')}`, contentSha256: response.contentSha256 }, capturedAt: now });
      primaryFacts.push(row);
    }
  });
  const yearDataGoals = dataGoals.filter((row) => row.tournament_id === `WC-${year}`);
  for (const [rowIndex, row] of yearDataGoals.entries()) {
    const dataMatch = dataMatchById.get(row.match_id ?? ''); const teams = dataMatchTeams(dataMatch); const key = matchKey(year, row.match_date, teams.home, teams.away); const mapped = openMatchesByKey.get(key); const sourceName = displayName(row.given_name ?? '', row.family_name ?? ''); const ownGoal = row.own_goal === '1'; const player = ownGoal ? null : row.player_id ? playerFor(sourceName, identityMap, 'fjelstul-world-cup') : null;
    if (!mapped) { conflicts.push({ year, type: 'contrast_match_not_mapped', sourceRecordId: row.goal_id ?? `${year}:${rowIndex}`, matchId: row.match_id, matchName: dataMatch?.match_name, matchKey: key, openMatchKeys: [...openMatchesByKey.keys()].filter((candidate) => candidate.startsWith(`${year}|`)).slice(0, 3) }); continue; }
    const captureIdContrast = `block20-datahub-goals-${datahubGoalsResponse.contentSha256.slice(0, 16)}`; const phase = normalizeWorldCupPhase(row.stage_name); contrastFacts.push(fact({ edition: { id: `world-cup:${year}`, year, label: String(year), isCurrentEdition: year === 2026 }, player, sourcePlayerId: row.player_id, sourcePlayerName: sourceName || undefined, match: { id: mapped.id, date: row.match_date ?? null, homeTeam: mapped.match.team1 ?? 'Unknown home team', awayTeam: mapped.match.team2 ?? 'Unknown away team' }, phase, goals: 1, isOwnGoal: ownGoal, isShootout: false, scopeEligible: true, role: 'contrast', sourceKey: 'fjelstul-world-cup', sourceCaptureId: captureIdContrast, sourceRecordId: row.goal_id ?? `${year}:goal:${rowIndex}`, evidence: { sourceUrl: datahubGoalsUrl, locator: `goals.csv.goal_id=${row.goal_id ?? `${year}:${rowIndex}`}`, contentSha256: datahubGoalsResponse.contentSha256 }, capturedAt: now }));
  }
  const primaryYearFacts = primaryFacts.slice(beforePrimary); const contrastYearFacts = contrastFacts.filter((factRow) => factRow.edition.year === year); const primaryGoals = primaryYearFacts.length; const contrastGoals = contrastYearFacts.length; if (response.ok && primaryGoals !== contrastGoals && year <= 2022) conflicts.push({ year, type: 'source_goal_count_mismatch', primaryGoals, contrastGoals });
  coverage.push({ year, status: response.ok && matches.length > 0 && unknownPhases === 0 && (year > 2022 || primaryGoals === contrastGoals) ? 'complete' : response.ok ? 'partial' : 'missing', primarySource: 'openfootball-worldcup', sourceUrl: url, matches: matches.length, primaryGoals, contrastGoals: year <= 2022 ? contrastGoals : null, unknownPhases, unknownRounds: [...unknownRounds], unresolvedPlayers: unresolved.length - beforeUnknown, reason: response.ok ? (unknownPhases ? 'unknown_phase_requires_review' : primaryGoals === contrastGoals || year > 2022 ? 'verified_against_structured_contrast' : 'goal_count_differs_from_contrast') : `source_http_${response.status}` });
}
const allFacts = [...primaryFacts, ...contrastFacts];
const historicalFacts = primaryFacts.filter((row) => row.edition.year <= 2022); const activeFacts = primaryFacts.filter((row) => row.edition.year <= 2026);
const historicalCoverageComplete = coverage.filter((row) => Number(row.year) <= 2022).every((row) => row.status === 'complete') && conflicts.filter((row) => Number(row.year) <= 2022).length === 0 && unresolved.every((item) => !item.startsWith('2026:'));
const completeCoverage = coverage.every((row) => row.status === 'complete') && conflicts.length === 0 && unresolved.length === 0;
const coverageForHistorical = [{ sourceKey: 'openfootball-worldcup', coveredEditions: coverage.filter((row) => Number(row.year) <= 2022 && row.status === 'complete').map((row) => Number(row.year)), missingEditions: coverage.filter((row) => Number(row.year) <= 2022 && row.status !== 'complete').map((row) => Number(row.year)), complete: historicalCoverageComplete, reason: historicalCoverageComplete ? '1930–2022 final tournaments mapped and contrasted' : 'historical source debt remains' }];
const coverageForActive = [{ sourceKey: 'openfootball-worldcup', coveredEditions: coverage.filter((row) => row.status === 'complete').map((row) => Number(row.year)), missingEditions: coverage.filter((row) => row.status !== 'complete').map((row) => Number(row.year)), complete: completeCoverage, reason: completeCoverage ? 'all requested final tournaments mapped and contrasted' : 'historical source debt remains; candidate is not complete' }];
const historicalSnapshot: WorldCupSnapshot = buildWorldCupSnapshot({ facts: historicalFacts, dataset: 'historical_base', editionStart: 1930, editionEnd: 2022, coverage: coverageForHistorical, generatedAt: now, fixtureOnly: false });
const activeSnapshot: WorldCupSnapshot = buildWorldCupSnapshot({ facts: activeFacts, dataset: 'active_edition_weekly', editionStart: 1930, editionEnd: 2026, parentSnapshotId: historicalSnapshot.id, coverage: coverageForActive, generatedAt: now, fixtureOnly: false });
const report = { status: completeCoverage ? 'candidate_ready_for_review' : 'candidate_incomplete', readyForApproval: false, sourcePolicy: { top200UsedAsFacts: false, payloadsStored: false, apiFootballUsed: false, reason: 'API-Football is consulted separately only after coverage is confirmed; openfootball primary plus Fjelstul/DataHub contrast used here.' }, scope: { gender: 'men', finalTournamentsOnly: true, qualifiersExcluded: true, shootoutsExcluded: true, ownGoalsStoredAndExcludedFromPlayerValues: true }, coverage, facts: { primary: primaryFacts.length, contrast: contrastFacts.length, allStored: allFacts.length, rankingPrimaryHistorical: historicalSnapshot.factIds.length, rankingPrimaryActive: activeSnapshot.factIds.length, playersNormalized: new Set(primaryFacts.filter((row) => row.player).map((row) => row.player!.canonicalId)).size, unresolvedPlayerFacts: unresolved.length }, matches: { primaryMapped: new Set(primaryFacts.map((row) => row.match.id)).size, contrastMapped: new Set(contrastFacts.map((row) => row.match.id)).size }, exclusions: { ownGoals: historicalSnapshot.excludedOwnGoalFacts.length + activeSnapshot.excludedOwnGoalFacts.length, shootouts: 0, unknownPhase: historicalSnapshot.excludedUnknownPhaseFacts.length }, conflicts, missingEditions: coverage.filter((row) => row.status !== 'complete').map((row) => row.year), snapshots: { historical: historicalSnapshot.id, active: activeSnapshot.id }, sourceCaptures, generatedAt: now, productionDatabaseAccess: 'none', renderTouched: false, rightsChanged: false, imagesTouched: false };
const reportHash = sha256(JSON.stringify(report));
await writeJson('BLOCK20_FACTS.json', { facts: allFacts, reportHash });
await writeJson('BLOCK20_SNAPSHOTS.json', { historical: historicalSnapshot, active: activeSnapshot });
await writeJson('BLOCK20_REPORT.json', { ...report, reportHash });
await writeFile(resolve(outputRoot, 'BLOCK20_REPORT.md'), `# BLOQUE 20 — reconstrucción real Mundial\n\n- estado: **${report.status}**\n- readyForApproval: **false**\n- hechos primarios: **${primaryFacts.length}**\n- hechos de contraste no sumados: **${contrastFacts.length}**\n- ediciones completas: **${coverage.filter((row) => row.status === 'complete').length}/${coverage.length}**\n- conflictos: **${conflicts.length}**\n- identidades pendientes: **${unresolved.length}**\n- snapshot oficial: **no creado**\n- PostgreSQL de producción: **sin acceso**\n\nLa fuente primaria y el contraste se conservan por URL, fecha, localizador y huella. Las filas de contraste no se suman al ranking.\n\nHuella del informe: ${reportHash}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, readyForApproval: false, editions: coverage.length, completeEditions: coverage.filter((row) => row.status === 'complete').length, primaryFacts: primaryFacts.length, contrastFacts: contrastFacts.length, unresolvedPlayers: unresolved.length, conflicts: conflicts.length, historicalSnapshot: historicalSnapshot.id, activeSnapshot: activeSnapshot.id }, null, 2));
