import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import {
  CHAMPIONS_CATEGORY_SLUG,
  CHAMPIONS_HISTORICAL_END,
  CHAMPIONS_HISTORICAL_START,
  buildChampionsRanking,
  createGoalFact,
  detectChampionsConflicts,
  editionForSeason,
  normalizePlayerName,
  normalizeChampionsPhase,
  resolvePlayerIdentity,
  stableJson,
  type ChampionsGoalFact,
  type ChampionsPhase,
  type ChampionsSourceCoverage,
  type IdentityResolver
} from '../championsRankingEngine.js';

type Row = Record<string, string>;
type SourceCapture = { id: string; sourceKey: string; sourceUrl: string; capturedAt: string; contentSha256: string; dataVersion: string; metadata: Record<string, unknown> };
type HistoricalMatch = { row: Row; seasonStart: number; phaseLabel: ChampionsPhase };
type ApiFactsPayload = { facts?: ChampionsGoalFact[] };

const historicalStart = CHAMPIONS_HISTORICAL_START;
const historicalEnd = 2009;
const expectedEnd = Number(process.env.BLOCK15B_EXPECTED_END ?? 2026);
const outputRoot = resolve(process.env.BLOCK15B_OUTPUT_ROOT?.trim() || 'audits/block15b');
const captureRoot = resolve(process.env.BLOCK15B_CAPTURE_ROOT?.trim() || resolve(outputRoot, 'not-uploaded-captures'));
const manualRoot = resolve(process.env.BLOCK15B_MANUAL_DIR?.trim() || 'data/fixtures/block15b/historical');
const apiFactsFile = process.env.BLOCK15B_API_FACTS_FILE?.trim() || '';
const databaseUrl = process.env.DATABASE_URL?.trim() || '';
const runId = process.env.BLOCK15B_RUN_ID?.trim() || process.env.GITHUB_RUN_ID?.trim() || new Date().toISOString().replace(/[^0-9]/gu, '').slice(0, 14);
const now = new Date().toISOString();

const SOURCE_URLS = {
  repository: 'https://github.com/CharlieGnomo/champions_uefa_data',
  matches: 'https://raw.githubusercontent.com/CharlieGnomo/champions_uefa_data/master/matches.csv',
  goals: 'https://raw.githubusercontent.com/CharlieGnomo/champions_uefa_data/master/goals.csv',
  players: 'https://raw.githubusercontent.com/CharlieGnomo/champions_uefa_data/master/players.csv',
  rsssfArchive: 'https://www.rsssf.org/ec/',
  rsssf1955: 'https://www.rsssf.org/ec/ec195556det.html',
  uefa2009: 'https://www.uefa.com/uefachampionsleague/history/seasons/2010/',
  uefaHandbook: 'https://www.uefa.com/MultimediaFiles/Download/competitions/Statistics/01/85/99/80/1859980_DOWNLOAD.pdf'
} as const;

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function numberValue(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isInteger(parsed) ? parsed : undefined; }
function recordValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function sourceSeason(value: string): number | undefined { const match = /^(\d{4})-(\d{4})$/u.exec(value); return match ? Number(match[1]) : undefined; }
function safeDate(value: string | undefined): string | null { return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : null; }
function phaseForRow(round: string | undefined): ChampionsPhase {
  const value = normalizePlayerName(round ?? '');
  if (value === 'final') return 'final';
  if (value === 'semifinal' || value === 'semi final') return 'semi_final';
  if (value === 'quarter finals' || value === 'quarter final') return 'quarter_final';
  if (value === 'round of 16') return 'round_of_16';
  if (value === 'first group match stage' || value === 'second group match stage' || value === 'group standings') return 'group';
  if (value === 'first') return 'first_round';
  if (value === 'second') return 'second_round';
  if (value === 'third') return 'third_round';
  if (value === 'intermediate') return 'intermediate';
  return normalizeChampionsPhase(round);
}
function crossSourceConflicts(facts: ChampionsGoalFact[]): Array<{ key: string; factIds: string[]; sourceKeys: string[]; values: number[]; reason: 'different_goal_values_for_same_match_player' }> {
  const groups = new Map<string, ChampionsGoalFact[]>();
  for (const fact of facts) {
    const matchKey = [fact.edition.seasonStart, fact.match.date ?? 'unknown-date', normalizePlayerName(fact.match.homeTeam), normalizePlayerName(fact.match.awayTeam), fact.player.normalizedName, fact.phase].join('|');
    groups.set(matchKey, [...(groups.get(matchKey) ?? []), fact]);
  }
  return [...groups.entries()].flatMap(([key, group]) => {
    const sourceValues = new Map<string, number>();
    for (const fact of group) sourceValues.set(fact.sourceKey, (sourceValues.get(fact.sourceKey) ?? 0) + fact.goals);
    if (sourceValues.size < 2 || new Set(sourceValues.values()).size < 2) return [];
    return [{ key, factIds: group.map((fact) => fact.id).sort(), sourceKeys: [...sourceValues.keys()].sort(), values: [...sourceValues.values()].sort((a, b) => a - b), reason: 'different_goal_values_for_same_match_player' as const }];
  });
}
function splitDelimited(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === ';' && !quoted) { values.push(value); value = ''; } else value += character;
  }
  values.push(value);
  return values;
}
function parseTable(raw: string): Row[] {
  const lines = raw.replace(/^\uFEFF/u, '').split(/\r?\n/u).filter((line) => line.length > 0);
  const headers = splitDelimited(lines[0] ?? '');
  return lines.slice(1).map((line) => {
    const values = splitDelimited(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}
async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stableJson(value), 'utf8');
}
async function fetchSource(url: string, name: string): Promise<{ raw: string; capture: SourceCapture }> {
  const response = await fetch(url);
  const raw = await response.text();
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const contentSha256 = sha256(raw);
  const capture = { id: `block15b-${name}-${contentSha256.slice(0, 16)}`, sourceKey: 'uefa-raw-github', sourceUrl: url, capturedAt: now, contentSha256, dataVersion: 'github-master-2026-09-17', metadata: { repository: SOURCE_URLS.repository, rawPayloadStored: true } };
  await writeFile(resolve(captureRoot, `${name}.csv`), raw, 'utf8');
  return { raw, capture };
}

function historicalMatches(rows: Row[]): Map<string, HistoricalMatch> {
  const result = new Map<string, HistoricalMatch>();
  for (const row of rows) {
    const seasonStart = sourceSeason(row.season ?? '');
    if (seasonStart === undefined || seasonStart < historicalStart || seasonStart > historicalEnd) continue;
    if ((row.status ?? '') !== 'FINISHED' || (row.phase ?? '') !== 'TOURNAMENT') continue;
    const matchId = row.match_id ?? '';
    if (!matchId) continue;
    result.set(matchId, { row, seasonStart, phaseLabel: phaseForRow(row.round ?? '') });
  }
  return result;
}

async function loadManualFacts(): Promise<{ facts: ChampionsGoalFact[]; captures: SourceCapture[]; files: Array<Record<string, unknown>>; errors: string[] }> {
  const facts: ChampionsGoalFact[] = [];
  const captures: SourceCapture[] = [];
  const files: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  let entries: string[];
  try { entries = (await (await import('node:fs/promises')).readdir(manualRoot)).filter((name) => name.endsWith('.json')).sort(); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { facts, captures, files, errors };
    throw error;
  }
  for (const name of entries) {
    try {
      const path = resolve(manualRoot, name);
      const raw = await readFile(path, 'utf8');
      const payload = JSON.parse(raw) as { sourceCapture?: Record<string, unknown>; facts?: Array<Record<string, unknown>> };
      const sourceCapture = payload.sourceCapture ?? {};
      const sourceKey = String(sourceCapture.sourceKey ?? '').trim();
      const sourceUrl = String(sourceCapture.sourceUrl ?? '').trim();
      const capturedAt = String(sourceCapture.capturedAt ?? '').trim();
      if (!sourceKey || !/^https:\/\//u.test(sourceUrl) || Number.isNaN(Date.parse(capturedAt))) throw new Error('sourceCapture incompleta o URL no HTTPS');
      const contentSha256 = sha256(raw);
      const captureId = String(sourceCapture.id ?? `block15b-manual-${contentSha256.slice(0, 16)}`);
      const capture: SourceCapture = { id: captureId, sourceKey, sourceUrl, capturedAt, contentSha256, dataVersion: 'manual-structured-v1', metadata: { file: name } };
      captures.push(capture);
      const sourceIds: Record<string, string> = {};
      for (const row of payload.facts ?? []) {
        const player = recordValue(row.player);
        if (player.sourcePlayerId && player.canonicalId) sourceIds[`${sourceKey}:${String(player.sourcePlayerId)}`] = String(player.canonicalId);
      }
      const resolver: IdentityResolver = { sourceIds };
      let imported = 0;
      for (const [index, row] of (payload.facts ?? []).entries()) {
        const seasonStart = typeof row.seasonStart === 'number' ? row.seasonStart : numberValue(String(row.seasonStart ?? ''));
        const player = recordValue(row.player);
        const match = recordValue(row.match);
        const evidence = recordValue(row.evidence);
        const sourcePlayerId = String(player.sourcePlayerId ?? '');
        const displayName = String(player.displayName ?? '');
        const matchId = String(match.id ?? '');
        const phase = String(row.phase ?? '') as ChampionsPhase;
        const goals = typeof row.goals === 'number' ? row.goals : numberValue(String(row.goals ?? ''));
        const locator = String(evidence.locator ?? '');
        if (seasonStart === undefined || seasonStart < historicalStart || seasonStart > historicalEnd || !sourcePlayerId || !displayName || !matchId || !locator || goals === undefined) throw new Error(`hecho ${index} sin trazabilidad mínima o fuera de alcance`);
        const identity = resolvePlayerIdentity({ sourceKey, sourcePlayerId, displayName }, resolver);
        facts.push(createGoalFact({ id: typeof row.id === 'string' ? row.id : undefined, edition: editionForSeason(seasonStart), player: identity, match: { id: matchId, date: typeof match.date === 'string' ? match.date : null, homeTeam: String(match.homeTeam ?? 'Unknown home team'), awayTeam: String(match.awayTeam ?? 'Unknown away team') }, phase, goals, sourceKey, sourceCaptureId: captureId, sourceRecordId: String(row.sourceRecordId ?? `${name}:${index}`), evidence: { sourceUrl: String(evidence.sourceUrl ?? sourceUrl), locator, contentSha256, ...(evidence.excerpt ? { excerpt: String(evidence.excerpt) } : {}) }, capturedAt }));
        imported += 1;
      }
      files.push({ file: name, sourceKey, captureId, contentSha256, facts: imported });
    } catch (error) { errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { facts, captures, files, errors };
}

async function loadApiFacts(aliases: Record<string, string>): Promise<{ facts: ChampionsGoalFact[]; captures: SourceCapture[]; status: 'loaded' | 'not_run' | 'failed'; error?: string }> {
  if (!apiFactsFile) return { facts: [], captures: [], status: 'not_run', error: 'No se proporcionó el fichero de hechos API-Football de 15A.' };
  try {
    const payload = JSON.parse(await readFile(apiFactsFile, 'utf8')) as ApiFactsPayload;
    const facts = (payload.facts ?? []).filter((fact) => fact.edition.seasonStart >= 2011 && fact.edition.seasonStart <= expectedEnd).map((fact) => createGoalFact({ ...fact, player: resolvePlayerIdentity({ sourceKey: fact.sourceKey, sourcePlayerId: fact.player.sourcePlayerId, displayName: fact.player.displayName }, { aliases }) }));
    const captureMap = new Map<string, SourceCapture>();
    for (const fact of facts) {
      if (!captureMap.has(fact.sourceCaptureId)) captureMap.set(fact.sourceCaptureId, { id: fact.sourceCaptureId, sourceKey: fact.sourceKey, sourceUrl: fact.evidence.sourceUrl, capturedAt: fact.capturedAt, contentSha256: fact.evidence.contentSha256 ?? sha256(fact.sourceCaptureId), dataVersion: 'block15a-api-football-facts-v1', metadata: { importedFrom: apiFactsFile } });
    }
    return { facts, captures: [...captureMap.values()], status: 'loaded' };
  } catch (error) { return { facts: [], captures: [], status: 'failed', error: error instanceof Error ? error.message : String(error) }; }
}

async function persistToIsolatedDatabase(facts: ChampionsGoalFact[], captures: SourceCapture[], sourceKeys: string[], conflicts: Array<{ key: string; factIds: string[]; sourceKeys: string[]; values: number[]; reason: 'different_goal_values_for_same_match_player' | 'duplicate_source_record_with_different_value' }>): Promise<{ factsInserted: number; capturesInserted: number; conflictsInserted: number }> {
  if (!databaseUrl) throw new Error('DATABASE_URL es obligatoria para BLOQUE 15B');
  const pool = new pg.Pool({ connectionString: databaseUrl });
  let factsInserted = 0;
  let capturesInserted = 0;
  let conflictsInserted = 0;
  try {
    await pool.query('BEGIN');
    for (const sourceKey of sourceKeys) {
      const isApi = sourceKey === 'api-football';
      await pool.query(`INSERT INTO sources (key, name, source_type, base_url, usage_notes, rights_status) VALUES ($1, $2, $3, $4, $5, 'review_required') ON CONFLICT (key) DO NOTHING`, [sourceKey, isApi ? 'API-Football' : sourceKey === 'uefa-raw-github' ? 'UEFA raw extraction on GitHub' : `Historical structured source ${sourceKey}`, isApi ? 'api' : 'reference', isApi ? 'https://v3.football.api-sports.io' : SOURCE_URLS.repository, 'BLOQUE 15B isolated historical reconstruction; no production publication.']);
    }
    for (let season = historicalStart; season <= expectedEnd; season += 1) {
      const edition = editionForSeason(season, expectedEnd);
      await pool.query(`INSERT INTO champions_editions (id, season_start, season_end, season_label, era, competition_name, include_qualifying, is_current_season, scope_version) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,$8) ON CONFLICT (id) DO NOTHING`, [edition.id, edition.seasonStart, edition.seasonEnd, edition.seasonLabel, edition.era, edition.competitionName, edition.isCurrentSeason, 'uefa-champions-league-goals-facts-v1']);
    }
    for (const capture of captures) {
      const result = await pool.query(`INSERT INTO champions_source_captures (id, source_key, captured_at, source_url, content_sha256, data_version, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`, [capture.id, capture.sourceKey, capture.capturedAt, capture.sourceUrl, capture.contentSha256, capture.dataVersion, capture.metadata]);
      capturesInserted += result.rowCount ?? 0;
    }
    for (const fact of facts) {
      await pool.query(`INSERT INTO entities (id, entity_type, canonical_name, catalog_status) VALUES ($1,'player',$2,'excluded_from_game') ON CONFLICT (id) DO NOTHING`, [fact.player.canonicalId, fact.player.displayName]);
    }
    for (const fact of facts) {
      const result = await pool.query(`INSERT INTO champions_goal_facts (id, edition_id, canonical_player_id, source_player_id, player_name_at_source, match_id, match_date, home_team, away_team, phase, goals, source_key, source_capture_id, source_record_id, evidence, captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`, [fact.id, fact.edition.id, fact.player.canonicalId, fact.player.sourcePlayerId, fact.player.displayName, fact.match.id, fact.match.date, fact.match.homeTeam, fact.match.awayTeam, fact.phase, fact.goals, fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId, fact.evidence, fact.capturedAt]);
      factsInserted += result.rowCount ?? 0;
    }
    for (const conflict of conflicts) {
      const result = await pool.query(`INSERT INTO champions_fact_conflicts (id, logical_key, fact_ids, source_keys, values, reason) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`, [`block15b-conflict-${sha256(stableJson(conflict)).slice(0, 32)}`, conflict.key, conflict.factIds, conflict.sourceKeys, conflict.values, conflict.reason]);
      conflictsInserted += result.rowCount ?? 0;
    }
    await pool.query('COMMIT');
    return { factsInserted, capturesInserted, conflictsInserted };
  } catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }
}

await mkdir(captureRoot, { recursive: true });
const historical = await (async () => {
  const matches = await fetchSource(SOURCE_URLS.matches, 'matches');
  const goals = await fetchSource(SOURCE_URLS.goals, 'goals');
  const players = await fetchSource(SOURCE_URLS.players, 'players');
  const allMatchRows = parseTable(matches.raw);
  const allMatchIds = new Set(allMatchRows.map((row) => row.match_id).filter((id): id is string => Boolean(id)));
  const matchMap = historicalMatches(allMatchRows);
  const playerMap = new Map(parseTable(players.raw).map((row) => [row.player_id, row]));
  const aliases: Record<string, string> = {};
  for (const player of playerMap.values()) {
    const displayName = player.full_name || player.international_name || player.short_name;
    if (displayName) aliases[normalizePlayerName(displayName)] = `champions:player:${normalizePlayerName(displayName).replaceAll(' ', '-')}`;
  }
  const facts: ChampionsGoalFact[] = [];
  const anomalies = { unmatchedGoalMatches: 0, outOfScopeGoalRows: 0, missingPlayers: 0, missingPlayersBySeason: {} as Record<string, number>, penaltyShootoutRowsExcluded: 0, unknownPhases: 0 };
  const goalRows = parseTable(goals.raw);
  for (const [index, row] of goalRows.entries()) {
    if ((row.mode ?? '') !== 'SCORED') continue;
    if ((row.type ?? '') === 'PENALTY') { anomalies.penaltyShootoutRowsExcluded += 1; continue; }
    const matchId = row.match_id ?? '';
    const match = matchMap.get(matchId);
    if (!match) { if (allMatchIds.has(matchId)) anomalies.outOfScopeGoalRows += 1; else anomalies.unmatchedGoalMatches += 1; continue; }
    const playerId = row.player_id ?? '';
    const player = playerMap.get(playerId);
    const displayName = player?.full_name || player?.international_name || player?.short_name;
    if (!displayName) { anomalies.missingPlayers += 1; anomalies.missingPlayersBySeason[String(match.seasonStart)] = (anomalies.missingPlayersBySeason[String(match.seasonStart)] ?? 0) + 1; continue; }
    if (match.phaseLabel === 'unknown') anomalies.unknownPhases += 1;
    facts.push(createGoalFact({ edition: editionForSeason(match.seasonStart), player: resolvePlayerIdentity({ sourceKey: 'uefa-raw-github', sourcePlayerId: playerId, displayName }, { aliases }), match: { id: `uefa-raw:match:${matchId}`, date: safeDate(match.row.date), homeTeam: match.row.t1_name || 'Unknown home team', awayTeam: match.row.t2_name || 'Unknown away team' }, phase: match.phaseLabel, goals: 1, sourceKey: 'uefa-raw-github', sourceCaptureId: goals.capture.id, sourceRecordId: row.id || `goals.csv:${index + 2}`, evidence: { sourceUrl: goals.capture.sourceUrl, locator: `goals.csv:row=${index + 2};match_id=${matchId};player_id=${playerId}`, contentSha256: goals.capture.contentSha256 }, capturedAt: goals.capture.capturedAt }));
  }
  const matchCountBySeason = new Map<number, number>();
  for (const match of matchMap.values()) matchCountBySeason.set(match.seasonStart, (matchCountBySeason.get(match.seasonStart) ?? 0) + 1);
  return { facts, captures: [matches.capture, goals.capture, players.capture], matchCountBySeason, anomalies, sourceRows: { matches: matchMap.size, goalRows: goalRows.length, playerRows: playerMap.size } };
})();
const manual = await loadManualFacts();
const identityAliases: Record<string, string> = Object.fromEntries([...historical.facts, ...manual.facts].map((fact) => [fact.player.normalizedName, fact.player.canonicalId]));
const api = await loadApiFacts(identityAliases);
const allFacts = [...historical.facts, ...manual.facts, ...api.facts];
const conflicts = [...new Map([...detectChampionsConflicts(allFacts), ...crossSourceConflicts(allFacts)].map((conflict) => [`${conflict.key}|${conflict.reason}`, conflict])).values()];
const sources = [...historical.captures, ...manual.captures, ...api.captures];
const sourceKeys = [...new Set(allFacts.map((fact) => fact.sourceKey))];
const historicalSeasons = new Set(historical.facts.map((fact) => fact.edition.seasonStart));
const apiSeasons = new Set(api.facts.map((fact) => fact.edition.seasonStart));
const manualSeasons = new Set(manual.facts.map((fact) => fact.edition.seasonStart));
const matrix = Array.from({ length: expectedEnd - historicalStart + 1 }, (_, index) => historicalStart + index).map((season) => {
  const facts = allFacts.filter((fact) => fact.edition.seasonStart === season);
  const isHistorical = season <= historicalEnd;
  const hasSource = isHistorical ? historicalSeasons.has(season) || manualSeasons.has(season) : apiSeasons.has(season);
  const missingPlayerFacts = historical.anomalies.missingPlayersBySeason[String(season)] ?? 0;
  return { seasonStart: season, seasonLabel: editionForSeason(season).seasonLabel, era: editionForSeason(season).era, qualifyingExcluded: true, status: hasSource ? missingPlayerFacts > 0 ? 'partial' : 'complete' : 'pending', matchCount: historical.matchCountBySeason.get(season) ?? null, factCount: facts.length, sources: [...new Set(facts.map((fact) => fact.sourceKey))], explanation: hasSource ? missingPlayerFacts > 0 ? `${missingPlayerFacts} goles sin jugador resoluble en la fuente primaria.` : 'Hechos trazables cargados en entorno aislado.' : isHistorical ? 'Sin hechos históricos estructurados cargados.' : 'Sin hechos API-Football proporcionados a esta ejecución.' };
});
const coverage: ChampionsSourceCoverage[] = [...new Set(allFacts.map((fact) => fact.sourceKey))].map((sourceKey) => {
  const covered = [...new Set(allFacts.filter((fact) => fact.sourceKey === sourceKey).map((fact) => fact.edition.seasonStart))].sort((a, b) => a - b);
  return { sourceKey, coveredSeasons: covered, missingSeasons: matrix.filter((row) => !covered.includes(row.seasonStart)).map((row) => row.seasonStart), complete: covered.length === matrix.length, reason: sourceKey === 'uefa-raw-github' ? 'Partidos y goles separados; clasificación y rondas de clasificación excluidas.' : 'Hechos aportados por captura estructurada.' };
});
const ranking = allFacts.length > 0 ? buildChampionsRanking({ facts: allFacts, coverage }) : null;
const playerCoverage = [...new Map(allFacts.map((fact) => [fact.player.canonicalId, fact.player])).values()].map((player) => {
  const facts = allFacts.filter((fact) => fact.player.canonicalId === player.canonicalId);
  return { canonicalPlayerId: player.canonicalId, playerName: player.displayName, normalizedName: player.normalizedName, facts: facts.length, goals: facts.reduce((sum, fact) => sum + fact.goals, 0), seasons: [...new Set(facts.map((fact) => fact.edition.seasonStart))].sort((a, b) => a - b), sources: [...new Set(facts.map((fact) => fact.sourceKey))] };
}).sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName));
const pendingSeasons = matrix.filter((row) => row.status !== 'complete').map((row) => row.seasonStart);
const historicalReady = matrix.filter((row) => row.seasonStart <= historicalEnd).every((row) => row.status === 'complete');
const combinedReady = historicalReady && matrix.every((row) => row.status === 'complete') && conflicts.length === 0 && (ranking?.unresolvedIdentityFacts.length ?? 0) === 0 && (ranking?.excludedUnknownPhaseFacts.length ?? 0) === 0;
const persistence = await persistToIsolatedDatabase(allFacts, sources, sourceKeys, conflicts);
await mkdir(outputRoot, { recursive: true });
await writeJson(resolve(outputRoot, 'BLOCK15B_HISTORICAL_FACTS.json'), { artifactKind: 'block15b_structured_historical_facts', source: 'uefa-raw-github-plus-manual-captures', generatedAt: now, facts: [...historical.facts, ...manual.facts] });
const report = {
  artifactKind: 'block15b_champions_historical_rebuild_report', reportVersion: '1', generatedAt: now, runId, categorySlug: CHAMPIONS_CATEGORY_SLUG,
  scope: { europeanCup: '1955/56–1991/92', championsLeagueHistorical: '1992/93–2009/10', combinedMatrix: `1955/56–${expectedEnd}/${String((expectedEnd + 1) % 100).padStart(2, '0')}`, qualifyingExcluded: true },
  sources: [
    { sourceKey: 'uefa-raw-github', role: 'primary_fact_import', status: 'loaded', urls: [SOURCE_URLS.matches, SOURCE_URLS.goals, SOURCE_URLS.players], provenance: 'Repositorio comunitario que declara extracción de datos UEFA; no se trata como autorización comercial UEFA.', licenseObserved: 'Apache-2.0 en el repositorio', importedFacts: historical.facts.length },
    { sourceKey: 'manual-structured-captures', role: 'seasonal_secondary_fact_import', status: manual.files.length > 0 ? 'loaded' : 'not_run', files: manual.files, importedFacts: manual.facts.length },
    { sourceKey: 'rsssf', role: 'historical_cross_check_candidate', status: 'catalogued_not_imported', urls: [SOURCE_URLS.rsssfArchive, SOURCE_URLS.rsssf1955], limitation: 'Las páginas detalladas son prácticas para 1955–1991/92; los agregados no se convierten automáticamente en hechos.' },
    { sourceKey: 'uefa-official', role: 'cross_check_candidate', status: 'catalogued_not_imported', urls: [SOURCE_URLS.uefa2009, SOURCE_URLS.uefaHandbook], limitation: 'Las estadísticas y manuales sirven para contrastar totales; no se usan como desglose partido/jugador sin captura verificable.' }
  ],
  historical: { status: historical.facts.length > 0 ? 'loaded' : 'not_run', sourceRows: historical.sourceRows, captures: historical.captures, anomalies: historical.anomalies, manualErrors: manual.errors },
  apiFootball: { status: api.status, factsImported: api.facts.length, captures: api.captures.length, ...(api.error ? { error: api.error } : {}) },
  totals: { historicalFactsImported: historical.facts.length + manual.facts.length, combinedFacts: allFacts.length, isolatedFactsInserted: persistence.factsInserted, sourceCapturesInserted: persistence.capturesInserted, isolatedConflictsInserted: persistence.conflictsInserted, seasonsComplete: matrix.filter((row) => row.status === 'complete').length, seasonsPending: pendingSeasons.length, conflicts: conflicts.length },
  matrix,
  playerCoverage,
  pendingSeasons,
  conflicts,
  candidateRanking: ranking && combinedReady ? { status: 'calculated_in_lab', entries: ranking.entries, coverageComplete: ranking.coverageComplete } : { status: 'not_sufficient', entries: [], reason: combinedReady ? 'Sin hechos.' : 'No se calcula una candidatura publicable mientras falten temporadas, haya conflictos o existan identidades/fases no resueltas.' },
  publication: { status: 'blocked', snapshotCreated: false, reason: 'La matriz y la trazabilidad deben ser revisadas antes de cualquier snapshot; no se usa el top 200 antiguo.' },
  database: { mode: 'isolated_postgresql', productionAccess: 'none', productionMutations: 0, rollback: 'fixture_cleanup_required' },
  imagesTouched: false, top200UsedAsFacts: false, rawPayloadUploaded: false, sha256: ''
};
report.sha256 = sha256(stableJson({ ...report, sha256: '' }));
await writeJson(resolve(outputRoot, 'BLOCK15B_HISTORICAL_REPORT.json'), report);
const markdown = ['# BLOQUE 15B — reconstrucción histórica Champions/Copa de Europa', '', `- estado: **${report.candidateRanking.status}**`, `- hechos históricos importados: **${report.totals.historicalFactsImported}**`, `- hechos combinados con API-Football: **${report.totals.combinedFacts}**`, `- temporadas completas: **${report.totals.seasonsComplete}/${matrix.length}**`, `- temporadas pendientes: **${report.totals.seasonsPending}**`, `- conflictos: **${report.totals.conflicts}**`, `- PostgreSQL de producción: **sin acceso**`, `- top 200 usado como hechos: **no**`, '', '## Cobertura', '', '| Temporada | Era | Estado | Partidos históricos | Hechos | Fuentes |', '| --- | --- | --- | ---: | ---: | --- |', ...matrix.map((row) => `| ${row.seasonLabel} | ${row.era} | ${row.status} | ${row.matchCount ?? '—'} | ${row.factCount} | ${row.sources.join(', ') || '—'} |`), '', `Temporadas pendientes: **${pendingSeasons.join(', ') || 'ninguna'}**.`, '', '## Fuentes y huecos', '', 'La fuente primaria cargada separa partidos, goles y jugadores. Los penaltis de tandas se excluyeron; no se reconstruyeron goles desde marcadores ni desde rankings agregados.', 'RSSSF y UEFA quedan registradas para contraste, pero no se mezclan automáticamente hasta disponer de capturas compatibles y trazables.', '', `Huella del informe: ${report.sha256}`, '', 'No se creó snapshot oficial, no se tocaron imágenes y la base temporal debe destruirse al finalizar el workflow.'].join('\n');
await writeFile(resolve(outputRoot, 'BLOCK15B_HISTORICAL_REPORT.md'), `${markdown}\n`, 'utf8');
console.log(JSON.stringify({ status: report.candidateRanking.status, historicalFactsImported: report.totals.historicalFactsImported, combinedFacts: report.totals.combinedFacts, seasonsComplete: report.totals.seasonsComplete, seasonsPending: report.totals.seasonsPending, conflicts: report.totals.conflicts, candidate: report.candidateRanking.status }, null, 2));
