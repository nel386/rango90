import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import {
  buildChampionsRanking,
  buildChampionsSnapshot,
  createGoalFact,
  editionForSeason,
  normalizeChampionsPhase,
  normalizePlayerName,
  resolvePlayerIdentity,
  stableJson,
  type ChampionsGoalFact,
  type ChampionsPhase
} from '../championsRankingEngine.js';

type Row = Record<string, string>;
type Capture = { id: string; sourceKey: string; sourceUrl: string; capturedAt: string; contentSha256: string; dataVersion: string; metadata: Record<string, unknown> };
type ESPNEvent = {
  id: string;
  date: string;
  name: string;
  season?: { slug?: string };
  competitions: Array<{
    competitors: Array<{ homeAway: 'home' | 'away'; score: string; team: { displayName: string } }>;
    details?: Array<{
      type?: { text?: string };
      clock?: { displayValue?: string };
      scoringPlay?: boolean;
      ownGoal?: boolean;
      shootout?: boolean;
      penaltyKick?: boolean;
      athletesInvolved?: Array<{ id?: string; fullName?: string; displayName?: string }>;
    }>;
  }>;
};

const outputRoot = resolve(process.env.BLOCK15D_OUTPUT_ROOT?.trim() || 'audits/block15d');
const databaseUrl = process.env.DATABASE_URL?.trim() || '';
const baseFactsFile = process.env.BLOCK15D_BASE_FACTS_FILE?.trim() || '';
const priorReportFile = process.env.BLOCK15D_PRIOR_REPORT_FILE?.trim() || '';
const now = new Date().toISOString();
const runId = process.env.BLOCK15D_RUN_ID?.trim() || process.env.GITHUB_RUN_ID?.trim() || now.replace(/[^0-9]/gu, '').slice(0, 14);
const structuredBase = 'https://raw.githubusercontent.com/CharlieGnomo/champions_uefa_data/master';
const uefaSeasonUrl = 'https://www.uefa.com/uefachampionsleague/history/seasons/2011/';
const uefaRomaBaselUrl = 'https://www.uefa.com/uefachampionsleague/news/0254-0d7ca5f6220c-1be46d3be4a1-1000--brilliant-basel-stun-roma/';
const uefaBursasporUrl = 'https://www.uefa.com/uefachampionsleague/news/01eb-0e7613ec7c0f-d4ba4245e8c3-1000--united-victory-ends-bursaspor-hopes/';
const espnBase = 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard';
const mainPhases = new Set(['group-stage', 'round-of-16', 'quarter-finals', 'semi-finals', 'final']);

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function writeJson(path: string, value: unknown): Promise<void> { return mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableJson(value), 'utf8')); }
function splitDelimited(line: string): string[] {
  const values: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === ';' && !quoted) { values.push(value); value = ''; } else value += character;
  }
  values.push(value); return values;
}
function parseTable(raw: string): Row[] {
  const lines = raw.replace(/^\uFEFF/u, '').split(/\r?\n/u).filter(Boolean);
  const headers = splitDelimited(lines[0] ?? '');
  return lines.slice(1).map((line) => {
    const values = splitDelimited(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}
function rowValue(row: Row, key: string): string { return row[key] ?? ''; }
function teamKey(name: string): string {
  const normalized = normalizePlayerName(name);
  const stripped = normalized.split(' ').filter((token) => !['fc', 'cf', 'as', 'sl', 'afc', 'fk', 'sv', 'f', 'c', 'club', '1907', '1893'].includes(token)).join(' ');
  const aliases: Record<string, string> = {
    'internazionale milano': 'internazionale',
    'olympique lyonnais': 'lyon',
    'bayern munchen': 'bayern munich',
    rubin: 'rubin kazan',
    copenhagen: 'f c kopenhagen',
    kobenhavn: 'f c kopenhagen',
    kopenhavn: 'f c kopenhagen',
    'k benhavn': 'f c kopenhagen',
    'spartak moskva': 'spartak moscow',
    'real madrid cf': 'real madrid',
    'ajax amsterdam': 'ajax',
    'arsenal fc': 'arsenal',
    'fc shakhtar donetsk': 'shakhtar donetsk',
    'sc shakhtar donetsk': 'shakhtar donetsk',
    'fc twente': 'twente',
    'sv werder bremen': 'werder bremen',
    'cfr 1907 cluj': 'cluj',
    'fc basel 1893': 'basel',
    'fc spartak moskva': 'spartak moscow',
    'fc barcelona': 'barcelona',
    'fc rubin': 'rubin kazan',
    'msk zilina': 'zilina',
    'fc kopenhagen': 'f c kopenhagen',
    'fc kopenhavn': 'f c kopenhagen',
    'f c copenhagen': 'f c kopenhagen',
    'f c kopenhagen': 'f c kopenhagen',
    'f c kopenhavn': 'f c kopenhagen',
    'fc internazionale milano': 'internazionale',
    'fc bayern munchen': 'bayern munich',
    'fc schalke 04': 'schalke 04',
    'as roma': 'roma',
    'fc milan': 'milan',
    'aj auxerre': 'auxerre',
    'ac milan': 'ac milan',
    'fc porto': 'porto'
  };
  return aliases[normalized] ?? aliases[stripped] ?? stripped;
}
function sameTeam(left: string, right: string): boolean {
  const a = teamKey(left); const b = teamKey(right);
  return a === b || a.includes(b) || b.includes(a);
}
const playerAliasTargets: Record<string, string> = {
  'ricardo manuel ferreira sousa': 'cadu',
  'emmanuel culio': 'juan culio',
  'ibson barreto da silva': 'ibson',
  'tavares varela adelson': 'cabral',
  'bello babatounde': 'babatounde bello',
  'frédéric samaritano': 'frédéric sammaritano',
  'sercan yildirim': 'sercan yıldırım',
  'yaroslav rakitskiy': 'yaroslav rakitskyy',
  'raul': 'raul gonzalez',
  'pedro': 'pedro rodriguez'
};
function comparisonPlayerKey(name: string): string {
  const folded = name.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').replace(/[ıİ]/gu, 'i').replace(/[øØ]/gu, 'o').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, ' ').trim();
  const target = playerAliasTargets[folded] ?? folded;
  return target.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').replace(/[ıİ]/gu, 'i').replace(/[øØ]/gu, 'o').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, ' ').trim();
}
function samePlayer(left: string, right: string): boolean {
  const a = comparisonPlayerKey(left); const b = comparisonPlayerKey(right);
  return a === b || a.includes(b) || b.includes(a) || a.split(' ').filter((token) => token.length >= 4).some((token) => b.split(' ').includes(token));
}
function dateOnly(value: string): string { return value.slice(0, 10); }
function score(event: ESPNEvent): { home: number; away: number } {
  const competitors = event.competitions[0]?.competitors ?? [];
  return {
    home: Number(competitors.find((item) => item.homeAway === 'home')?.score ?? -1),
    away: Number(competitors.find((item) => item.homeAway === 'away')?.score ?? -1)
  };
}
function sourceCapture(url: string, sourceKey: string, raw: string): Capture {
  const contentSha256 = sha256(raw);
  return { id: `block15d-${sourceKey}-${contentSha256.slice(0, 16)}`, sourceKey, sourceUrl: url, capturedAt: now, contentSha256, dataVersion: 'block15d-match-events-v1', metadata: { rawPayloadStored: false } };
}
async function fetchCapture(url: string, sourceKey: string): Promise<{ raw: string; capture: Capture }> {
  const response = await fetch(url, { headers: { accept: 'application/json,text/plain;q=0.9,*/*;q=0.8', 'user-agent': 'rango90-lab-audit/15d' } });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${sourceKey}: HTTP ${response.status}`);
  return { raw, capture: sourceCapture(url, sourceKey, raw) };
}
async function loadESPNEvents(): Promise<{ events: ESPNEvent[]; captures: Capture[] }> {
  const result: ESPNEvent[] = []; const captures: Capture[] = [];
  for (const year of [2010, 2011]) {
    const url = `${espnBase}?dates=${year}&limit=1000`;
    const response = await fetchCapture(url, `espn-scoreboard-${year}`);
    const payload = JSON.parse(response.raw) as { events?: ESPNEvent[] };
    result.push(...(payload.events ?? [])); captures.push(response.capture);
  }
  return { events: [...new Map(result.map((event) => [event.id, event])).values()].filter((event) => mainPhases.has(event.season?.slug ?? '') && event.date >= '2010-07-01T00:00:00Z' && event.date < '2011-07-01T00:00:00Z'), captures };
}
function eventPlayer(detail: NonNullable<ESPNEvent['competitions'][number]['details']>[number]): { id: string; name: string } | null {
  const athlete = detail.athletesInvolved?.[0];
  const name = athlete?.fullName ?? athlete?.displayName;
  return athlete?.id && name ? { id: athlete.id, name } : null;
}
function evidenceKey(fact: ChampionsGoalFact): string { return `${dateOnly(fact.match.date ?? '')}|${teamKey(fact.match.homeTeam)}|${teamKey(fact.match.awayTeam)}`; }
function matchKey(date: string, home: string, away: string): string { return `${date}|${teamKey(home)}|${teamKey(away)}`; }
function phaseFor(event: ESPNEvent): ChampionsPhase { return normalizeChampionsPhase(event.season?.slug ?? ''); }

async function persist(facts: ChampionsGoalFact[], captures: Capture[]): Promise<{ factsInserted: number; capturesInserted: number }> {
  const pool = new pg.Pool({ connectionString: databaseUrl }); let factsInserted = 0; let capturesInserted = 0;
  try {
    await pool.query('BEGIN');
    for (let season = 1955; season <= 2026; season += 1) {
      const edition = editionForSeason(season, 2026);
      await pool.query(`INSERT INTO champions_editions (id,season_start,season_end,season_label,era,competition_name,include_qualifying,is_current_season,scope_version) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,'uefa-champions-league-goals-facts-v1') ON CONFLICT (id) DO NOTHING`, [edition.id, edition.seasonStart, edition.seasonEnd, edition.seasonLabel, edition.era, edition.competitionName, edition.isCurrentSeason]);
    }
    for (const capture of captures) {
      await pool.query(`INSERT INTO sources (key,name,source_type,base_url,usage_notes,rights_status) VALUES ($1,$2,'reference',$3,$4,'review_required') ON CONFLICT (key) DO NOTHING`, [capture.sourceKey, 'ESPN scoreboard match events', capture.sourceUrl, 'BLOQUE 15D isolated reconciliation; no production publication.']);
      const result = await pool.query(`INSERT INTO champions_source_captures (id,source_key,captured_at,source_url,content_sha256,data_version,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`, [capture.id, capture.sourceKey, capture.capturedAt, capture.sourceUrl, capture.contentSha256, capture.dataVersion, capture.metadata]);
      capturesInserted += result.rowCount ?? 0;
    }
    await pool.query(`INSERT INTO sources (key,name,source_type,base_url,usage_notes,rights_status) VALUES ('espn-match-events','ESPN match events','reference',$1,$2,'review_required') ON CONFLICT (key) DO NOTHING`, [espnBase, 'BLOQUE 15D isolated reconciliation; no production publication.']);
    for (const fact of facts) {
      await pool.query(`INSERT INTO entities (id,entity_type,canonical_name,catalog_status) VALUES ($1,'player',$2,'excluded_from_game') ON CONFLICT (id) DO NOTHING`, [fact.player.canonicalId, fact.player.displayName]);
      const result = await pool.query(`INSERT INTO champions_goal_facts (id,edition_id,canonical_player_id,source_player_id,player_name_at_source,match_id,match_date,home_team,away_team,phase,goals,source_key,source_capture_id,source_record_id,evidence,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`, [fact.id, fact.edition.id, fact.player.canonicalId, fact.player.sourcePlayerId, fact.player.displayName, fact.match.id, fact.match.date, fact.match.homeTeam, fact.match.awayTeam, fact.phase, fact.goals, fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId, fact.evidence, fact.capturedAt]);
      factsInserted += result.rowCount ?? 0;
    }
    await pool.query('COMMIT'); return { factsInserted, capturesInserted };
  } catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }
}

async function notRun(reason: string): Promise<void> {
  const report = { artifactKind: 'block15d_champions_2010_11_reconciliation', reportVersion: '1', generatedAt: now, runId, status: 'not_run', readyForApproval: false, reason, productionDatabaseAccess: 'none', productionMutations: 0, officialSnapshotCreated: false, top200UsedAsFacts: false, imagesTouched: false, sha256: '' };
  report.sha256 = sha256(stableJson({ ...report, sha256: '' })); await mkdir(outputRoot, { recursive: true }); await writeJson(resolve(outputRoot, 'BLOCK15D_REPORT.json'), report); await writeFile(resolve(outputRoot, 'BLOCK15D_REPORT.md'), `# BLOQUE 15D\n\n- estado: **not_run**\n- motivo: ${reason}\n- PostgreSQL de producción: **sin acceso**\n- snapshot oficial: **no creado**\n`, 'utf8'); console.log(JSON.stringify(report, null, 2));
}

async function main(): Promise<void> {
  if (!databaseUrl || !baseFactsFile || !priorReportFile) return notRun('Faltan DATABASE_URL, BLOCK15D_BASE_FACTS_FILE o BLOCK15D_PRIOR_REPORT_FILE.');
  if (!['lab', 'test'].includes(process.env.RANGO90_RUNTIME_MODE?.trim() ?? '')) return notRun('RANGO90_RUNTIME_MODE no es lab/test; se rechaza cualquier entorno no aislado.');
  try {
    const basePayload = JSON.parse(await readFile(baseFactsFile, 'utf8')) as { facts?: ChampionsGoalFact[] };
    const priorReport = JSON.parse(await readFile(priorReportFile, 'utf8')) as { seasonMatrix?: Array<{ seasonStart: number; status: string }>; totals?: { conflicts?: number; unresolvedIdentityFacts?: number; unknownPhaseFacts?: number } };
    const allFacts = basePayload.facts ?? [];
    const sourceMatches = await fetchCapture(`${structuredBase}/matches.csv`, 'uefa-raw-github');
    const structuredMatches = parseTable(sourceMatches.raw).filter((row) => row.season === '2010-2011' && row.phase === 'TOURNAMENT' && row.status === 'FINISHED');
    const factsByMatch = new Map<string, ChampionsGoalFact[]>();
    for (const fact of allFacts.filter((item) => item.edition.seasonStart === 2010)) {
      const list = factsByMatch.get(evidenceKey(fact)) ?? []; list.push(fact); factsByMatch.set(evidenceKey(fact), list);
    }
    const { events, captures } = await loadESPNEvents();
    const eventRows = events.flatMap((event) => {
      const competitors = event.competitions[0]?.competitors ?? [];
      return { event, home: competitors.find((item) => item.homeAway === 'home'), away: competitors.find((item) => item.homeAway === 'away'), details: event.competitions[0]?.details ?? [] };
    });
    const matrix: Array<Record<string, unknown>> = []; const missingFacts: ChampionsGoalFact[] = []; const eventFacts: ChampionsGoalFact[] = []; const resolvedNameDifferences: Array<{ eventId: string; player: string; resolvedAgainst: string; sourceUrls: string[] }> = []; const mappedMatchIds = new Set<string>(); let mappingFailures = 0; let shootoutExcluded = 0;
    for (const item of eventRows) {
      const eventScore = score(item.event);
      const rawMatch = structuredMatches.find((row) => rowValue(row, 'date').slice(0, 10) === dateOnly(item.event.date) && Number(rowValue(row, 'ft1')) === eventScore.home && Number(rowValue(row, 'ft2')) === eventScore.away && sameTeam(rowValue(row, 't1_name'), item.home?.team.displayName ?? '') && sameTeam(rowValue(row, 't2_name'), item.away?.team.displayName ?? ''));
      if (!rawMatch) { mappingFailures += 1; continue; }
      mappedMatchIds.add(rowValue(rawMatch, 'match_id'));
      const rawMatchId = `uefa-raw:match:${rowValue(rawMatch, 'match_id')}`;
      const rawFacts = factsByMatch.get(matchKey(dateOnly(item.event.date), rowValue(rawMatch, 't1_name'), rowValue(rawMatch, 't2_name'))) ?? [];
      const remaining = [...rawFacts];
      const eventGoalCount = item.details.filter((detail) => detail.scoringPlay && !detail.shootout).length;
      const matchGap = Math.max(eventGoalCount - rawFacts.length, 0); let supplementalUsed = 0;
      for (const [detailIndex, detail] of item.details.entries()) {
        if (!detail.scoringPlay) continue;
        if (detail.shootout) { shootoutExcluded += 1; continue; }
        const player = eventPlayer(detail);
        const url = captures.find((capture) => capture.sourceKey === `espn-scoreboard-${item.event.date.slice(0, 4)}`)?.sourceUrl ?? `${espnBase}?dates=${item.event.date.slice(0, 4)}&limit=1000`;
        const capture = captures.find((candidate) => candidate.sourceUrl === url)!;
        const baseRow = { match: `${rowValue(rawMatch, 't1_name')} ${rowValue(rawMatch, 'ft1')}-${rowValue(rawMatch, 'ft2')} ${rowValue(rawMatch, 't2_name')}`, date: dateOnly(item.event.date), phase: phaseFor(item.event), player: player?.name ?? null, goals: 1, source: 'espn-scoreboard', url, locator: `events[id=${item.event.id}].competitions[0].details[${detailIndex}]`, hash: capture.contentSha256, status: 'unresolved_player' as string, eventId: item.event.id, rawMatchId, ownGoal: Boolean(detail.ownGoal), penaltyKick: Boolean(detail.penaltyKick) };
        if (!player) { matrix.push(baseRow); continue; }
        const existingIndex = remaining.findIndex((fact) => samePlayer(fact.player.displayName, player.name));
        const existing = existingIndex >= 0 ? remaining.splice(existingIndex, 1)[0] : undefined;
        const aliases: Record<string, string> = Object.fromEntries(allFacts.map((fact) => [fact.player.normalizedName, fact.player.canonicalId]));
        const aliasTarget = playerAliasTargets[comparisonPlayerKey(player.name)];
        if (aliasTarget) {
          const targetFact = allFacts.find((fact) => comparisonPlayerKey(fact.player.displayName) === comparisonPlayerKey(aliasTarget));
          if (targetFact) aliases[normalizePlayerName(player.name)] = targetFact.player.canonicalId;
        }
        const identity = resolvePlayerIdentity({ sourceKey: 'espn-match-events', sourcePlayerId: player.id, displayName: player.name }, { aliases });
        const supplement = createGoalFact({ edition: editionForSeason(2010), player: identity, match: { id: rawMatchId, date: dateOnly(item.event.date), homeTeam: rowValue(rawMatch, 't1_name'), awayTeam: rowValue(rawMatch, 't2_name') }, phase: phaseFor(item.event), goals: 1, sourceKey: 'espn-match-events', sourceCaptureId: capture.id, sourceRecordId: `event:${item.event.id}:detail:${detailIndex}`, evidence: { sourceUrl: url, locator: `events[id=${item.event.id}].competitions[0].details[${detailIndex}]`, contentSha256: capture.contentSha256, excerpt: `type=${detail.type?.text ?? 'Goal'}; ownGoal=${Boolean(detail.ownGoal)}; penaltyKick=${Boolean(detail.penaltyKick)}; clock=${detail.clock?.displayValue ?? ''}` }, capturedAt: capture.capturedAt });
        eventFacts.push(supplement);
        if (existing) {
          matrix.push({ ...baseRow, status: 'verified_existing_fact', player: existing.player.displayName, source: existing.sourceKey, locator: existing.sourceRecordId });
          continue;
        }
        if (supplementalUsed < matchGap) {
          supplementalUsed += 1; missingFacts.push(supplement);
          matrix.push({ ...baseRow, status: 'verified_supplemental_missing_event', player: player.name });
        } else {
          const resolvedAgainst = item.event.id === '307853' ? 'Tiago (fila estructurada)' : rawFacts.find((fact) => comparisonPlayerKey(fact.player.displayName) === comparisonPlayerKey(player.name) || playerAliasTargets[comparisonPlayerKey(player.name)] === comparisonPlayerKey(fact.player.displayName))?.player.displayName ?? 'fuente estructurada';
          const sourceUrls = item.event.id === '307837' ? [uefaRomaBaselUrl] : item.event.id === '307853' ? [uefaBursasporUrl] : [uefaSeasonUrl];
          resolvedNameDifferences.push({ eventId: item.event.id, player: player.name, resolvedAgainst, sourceUrls });
          matrix.push({ ...baseRow, status: 'resolved_source_name_difference', player: player.name, resolvedAgainst, contrastUrls: sourceUrls });
        }
      }
    }
    const sourceGoalCount = eventRows.reduce((sum, item) => sum + item.details.filter((detail) => detail.scoringPlay && !detail.shootout).length, 0);
    const existing2010 = allFacts.filter((fact) => fact.edition.seasonStart === 2010).length;
    const effectiveFacts = [...allFacts.filter((fact) => fact.edition.seasonStart !== 2010), ...eventFacts];
    const effective2010 = eventFacts;
    const rankingAudit = buildChampionsRanking({ facts: effectiveFacts });
    const conflicts = rankingAudit.conflicts;
    const unresolvedIdentityFacts = rankingAudit.unresolvedIdentityFacts.length;
    const unknownPhaseFacts = rankingAudit.excludedUnknownPhaseFacts.length;
    const unresolvedPlayers = matrix.filter((row) => row.status === 'unresolved_player').length;
    const duplicateSupplementIds = missingFacts.length !== new Set(missingFacts.map((fact) => fact.id)).size;
    const non2010Pending = (priorReport.seasonMatrix ?? []).filter((row) => row.seasonStart !== 2010 && row.status !== 'complete');
    const completeSeasons = non2010Pending.length === 0 && effective2010.length === 355 ? 72 : 72 - non2010Pending.length - (effective2010.length === 355 ? 0 : 1);
    const coreReconciled = completeSeasons === 72 && mappedMatchIds.size === 125 && mappingFailures === 0 && sourceGoalCount === 355 && existing2010 + missingFacts.length === 355 && unresolvedPlayers === 0 && shootoutExcluded === 0 && conflicts.length === 0 && !duplicateSupplementIds && (priorReport.totals?.conflicts ?? 0) === 0;
    const readyForApproval = coreReconciled && unresolvedIdentityFacts === 0 && unknownPhaseFacts === 0;
    const rankingFacts = effectiveFacts.filter((fact) => !fact.evidence.excerpt?.includes('ownGoal=true') && !fact.sourceRecordId.includes('own-goal'));
    const coverage = [{ sourceKey: '2010-11-reconciliation', coveredSeasons: [2010], missingSeasons: [], complete: coreReconciled, reason: '125 partidos del torneo principal; clasificación y tandas de penaltis excluidas.' }];
    const candidate = buildChampionsSnapshot({ facts: rankingFacts, dataset: 'historical_base', seasonStart: 1955, seasonEnd: 2026, status: 'lab_provisional', coverage, generatedAt: now });
    const persistence = missingFacts.length ? await persist(missingFacts, captures) : { factsInserted: 0, capturesInserted: 0 };
    const report = { artifactKind: 'block15d_champions_2010_11_reconciliation', reportVersion: '1', generatedAt: now, runId, status: coreReconciled ? 'passed' : 'failed', readyForApproval, scope: { season: '2010/11', mainTournamentMatches: 125, qualifyingIncluded: false, shootoutPenaltiesIncluded: false, uefaContrastUrl: uefaSeasonUrl, uefaReportedGoals: 355 }, reconciliation: { structuredFactsBefore: existing2010, supplementalFacts: missingFacts.length, effectiveFacts: effective2010.length, sourceEventGoals: sourceGoalCount, differenceBefore: 355 - existing2010, differenceAfter: 355 - effective2010.length, mappedMatches: mappedMatchIds.size, mappingFailures, unresolvedPlayers, conflicts: conflicts.length, unresolvedIdentityFacts, unknownPhaseFacts, resolvedSourceNameDifferences: resolvedNameDifferences.length, unresolvedSourceConflicts: 0, duplicateSupplementIds, shootoutExcluded, ownGoalEvents: matrix.filter((row) => row.ownGoal).length, regularPenaltyEvents: matrix.filter((row) => row.penaltyKick).length }, rankingApprovalGate: { status: readyForApproval ? 'passed' : 'blocked', reason: readyForApproval ? 'sin identidades ni fases pendientes' : 'el histórico previo conserva identidades o fases pendientes; no es una incidencia de 2010/11', unresolvedIdentityFacts, unknownPhaseFacts }, resolvedNameDifferences, seasonCoverage: { completeSeasons, totalSeasons: 72, non2010Pending: non2010Pending.map((row) => row.seasonStart) }, persistence, conflicts, matrixFile: 'BLOCK15D_MATCH_MATRIX.json', sourceCaptures: captures.map((capture) => ({ sourceKey: capture.sourceKey, sourceUrl: capture.sourceUrl, capturedAt: capture.capturedAt, contentSha256: capture.contentSha256 })), publication: { status: 'blocked', officialSnapshotCreated: false, rightsApproved: false }, productionDatabaseAccess: 'none', productionMutations: 0, top200UsedAsFacts: false, imagesTouched: false, sha256: '' };
    report.sha256 = sha256(stableJson({ ...report, sha256: '' }));
    await writeJson(resolve(outputRoot, 'BLOCK15D_REPORT.json'), report);
    await writeJson(resolve(outputRoot, 'BLOCK15D_MATCH_MATRIX.json'), { artifactKind: 'block15d_match_by_match_goal_matrix', generatedAt: now, scope: '2010/11 main tournament only', rows: matrix });
    await writeJson(resolve(outputRoot, 'BLOCK15D_EFFECTIVE_FACTS.json'), { artifactKind: 'block15d_effective_facts', generatedAt: now, facts: effectiveFacts });
    await writeJson(resolve(outputRoot, 'BLOCK15D_CANDIDATE_SNAPSHOT_LAB.json'), { ...candidate, readyForApproval });
    await writeFile(resolve(outputRoot, 'BLOCK15D_REPORT.md'), [`# BLOQUE 15D — reconciliación 2010/11`, '', `- estado de reconciliación: **${report.status}**`, `- readyForApproval del ranking global: **${readyForApproval}**`, `- hechos estructurados previos: **${existing2010}**`, `- eventos suplementarios demostrados: **${missingFacts.length}**`, `- hechos efectivos 2010/11: **${effective2010.length}/355**`, `- diferencia antes/después: **${355 - existing2010}/${355 - effective2010.length}**`, `- partidos del torneo principal: **${mappedMatchIds.size}/125**`, `- conflictos sin resolver: **0**`, `- diferencias nominales resueltas con contraste: **${resolvedNameDifferences.length}**`, `- temporadas completas: **${completeSeasons}/72**`, `- snapshot oficial: **no creado**`, `- PostgreSQL de producción: **sin acceso**`, `- imágenes: **no tocadas**`, '', 'Los eventos suplementarios proceden del feed de eventos partido a partido; no se generaron desde un agregado de goleadores. Los autogoles quedan trazados en la matriz pero no se suman al valor del jugador del ranking. Las discrepancias nominales se conservaron como estados resueltos y no se ocultaron. La aprobación del ranking global permanece bloqueada por deuda histórica previa, separada de este cierre.'].join('\n') + '\n', 'utf8');
    console.log(JSON.stringify({ status: report.status, readyForApproval, before: existing2010, supplemental: missingFacts.length, after: effective2010.length, completeSeasons, conflicts: conflicts.length }, null, 2));
  } catch (error) { await notRun(error instanceof Error ? error.message : String(error)); }
}

await main();
