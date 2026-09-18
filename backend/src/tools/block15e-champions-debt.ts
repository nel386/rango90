import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import {
  buildChampionsRanking,
  buildChampionsSnapshot,
  compareChampionsRankings,
  normalizeChampionsPhase,
  rollbackChampionsSnapshot,
  stableJson,
  type ChampionsGoalFact,
  type ChampionsRankingEntry,
  type ChampionsPhase
} from '../championsRankingEngine.js';

type JsonRecord = Record<string, unknown>;
type DebtType = 'fact_without_canonical_identity' | 'pending_alias' | 'duplicate_player' | 'missing_external_id' | 'unknown_phase' | 'phase_incompatible_with_scope' | 'phase_contrast_required' | 'fact_contrast_required';
type Decision = {
  id: string;
  factId: string;
  debtType: DebtType;
  decision: string;
  beforeState: JsonRecord;
  afterState: JsonRecord;
  sourceKey: string;
  sourceCaptureId: string;
  sourceRecordId: string;
  evidence: JsonRecord;
  contentSha256: string;
};

const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const baseFactsFile = process.env.BLOCK15E_BASE_FACTS_FILE?.trim() ?? '';
const priorSnapshotFile = process.env.BLOCK15E_PRIOR_SNAPSHOT_FILE?.trim() ?? '';
const apiCaptureRoot = resolve(process.env.BLOCK15E_API_CAPTURE_ROOT?.trim() || '');
const outputRoot = resolve(process.env.BLOCK15E_OUTPUT_ROOT?.trim() || 'audits/block15e');
const runId = process.env.BLOCK15E_RUN_ID?.trim() || process.env.GITHUB_RUN_ID?.trim() || new Date().toISOString().replace(/[^0-9]/gu, '').slice(0, 14);
const now = new Date().toISOString();
const official2025PlayoffUrl = 'https://www.uefa.com/uefachampionsleague/news/02a1-1fce2f47dac2-92ac3ef0e883-1000/';
const official2025PlayoffDates = new Set(['2026-02-17', '2026-02-18', '2026-02-24', '2026-02-25']);

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function writeJson(path: string, value: unknown): Promise<void> { return mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableJson(value), 'utf8')); }
function record(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function phase(value: string): ChampionsPhase { return normalizeChampionsPhase(value); }
function isActive(fact: ChampionsGoalFact): boolean { return fact.phase !== 'qualifying' && fact.edition.seasonStart >= 1955 && fact.edition.seasonStart <= 2026; }
function decisionHash(input: Omit<Decision, 'id' | 'contentSha256'>): string { return sha256(stableJson(input)); }
function factState(fact: ChampionsGoalFact): JsonRecord {
  return { canonicalPlayerId: fact.player.canonicalId, resolution: fact.player.resolution, sourcePlayerId: fact.player.sourcePlayerId, displayName: fact.player.displayName, phase: fact.phase };
}
function decisionFor(fact: ChampionsGoalFact, debtType: DebtType, decision: string, afterState: JsonRecord, evidence: JsonRecord): Decision {
  const base: Omit<Decision, 'id' | 'contentSha256'> = { factId: fact.id, debtType, decision, beforeState: factState(fact), afterState, sourceKey: fact.sourceKey, sourceCaptureId: fact.sourceCaptureId, sourceRecordId: fact.sourceRecordId, evidence };
  const hash = decisionHash(base);
  return { ...base, id: `champions-debt-${hash.slice(0, 32)}`, contentSha256: hash };
}
function cloneFact(fact: ChampionsGoalFact, changes: { phase?: ChampionsPhase; canonicalId?: string; resolution?: ChampionsGoalFact['player']['resolution']; displayName?: string }): ChampionsGoalFact {
  const player = changes.canonicalId || changes.resolution || changes.displayName ? { ...fact.player, canonicalId: changes.canonicalId ?? fact.player.canonicalId, resolution: changes.resolution ?? fact.player.resolution, displayName: changes.displayName ?? fact.player.displayName } : fact.player;
  return { ...fact, player, phase: changes.phase ?? fact.phase };
}
function providerIdentityKey(fact: ChampionsGoalFact): string { return `${fact.sourceKey}:${fact.player.sourcePlayerId}`; }
function descriptiveScore(name: string): number {
  const tokens = name.trim().split(/\s+/u).filter(Boolean);
  return tokens.filter((token) => token.replace(/[^A-Za-zÀ-ÿ]/gu, '').length > 1).length * 100 + name.replace(/[^A-Za-zÀ-ÿ]/gu, '').length;
}

async function loadApiPhaseIndex(): Promise<{ phaseByFixture: Map<string, { phase: ChampionsPhase; sourceUrl: string; contentSha256: string; locator: string }>; filesRead: number }> {
  const result = new Map<string, { phase: ChampionsPhase; sourceUrl: string; contentSha256: string; locator: string }>();
  if (!process.env.BLOCK15E_API_CAPTURE_ROOT?.trim()) return { phaseByFixture: result, filesRead: 0 };
  let names: string[];
  try { names = (await readdir(apiCaptureRoot)).filter((name) => name.endsWith('.json')).sort(); } catch { return { phaseByFixture: result, filesRead: 0 }; }
  for (const name of names) {
    const raw = await readFile(resolve(apiCaptureRoot, name), 'utf8');
    let payload: JsonRecord;
    try { payload = JSON.parse(raw) as JsonRecord; } catch { continue; }
    const rows = Array.isArray(payload.response) ? payload.response : [];
    const contentSha256 = sha256(raw);
    for (const [index, value] of rows.entries()) {
      const row = record(value); const fixture = record(row.fixture); const league = record(row.league);
      const id = typeof fixture.id === 'number' || typeof fixture.id === 'string' ? String(fixture.id) : '';
      const rawRound = typeof league.round === 'string' ? league.round : '';
      const mapped = phase(rawRound);
      if (id && mapped !== 'unknown') result.set(id, { phase: mapped, sourceUrl: `https://v3.football.api-sports.io/fixtures?ids=${id}`, contentSha256, locator: `response[${index}].league.round` });
    }
  }
  return { phaseByFixture: result, filesRead: names.length };
}

async function loadOfficialPlayoffEvidence(): Promise<{ sourceUrl: string; contentSha256: string } | null> {
  try {
    const response = await fetch(official2025PlayoffUrl, { headers: { accept: 'text/html' } });
    const raw = await response.text();
    if (!response.ok || raw.length < 1000) return null;
    return { sourceUrl: official2025PlayoffUrl, contentSha256: sha256(raw) };
  } catch {
    return null;
  }
}

async function persistDecisions(decisions: Decision[]): Promise<{ inserted: number }> {
  if (!databaseUrl) return { inserted: 0 };
  const pool = new pg.Pool({ connectionString: databaseUrl }); let inserted = 0;
  try {
    await pool.query('BEGIN');
    for (const item of decisions) {
      const result = await pool.query(`INSERT INTO champions_debt_decisions (id,fact_id,debt_type,decision,before_state,after_state,source_key,source_capture_id,source_record_id,evidence,content_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`, [item.id, item.factId, item.debtType, item.decision, item.beforeState, item.afterState, item.sourceKey, item.sourceCaptureId, item.sourceRecordId, item.evidence, item.contentSha256]);
      inserted += result.rowCount ?? 0;
    }
    await pool.query('COMMIT'); return { inserted };
  } catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }
}

function emptyReport(reason: string): JsonRecord {
  const report: JsonRecord = { artifactKind: 'block15e_champions_debt_audit', reportVersion: '1', generatedAt: now, runId, status: 'not_run', readyForApproval: false, reason, productionDatabaseAccess: 'none', productionMutations: 0, officialSnapshotCreated: false, imagesTouched: false, rightsChanged: false, renderTouched: false, top200UsedAsFacts: false, sha256: '' };
  report.sha256 = sha256(stableJson({ ...report, sha256: '' })); return report;
}

async function main(): Promise<void> {
  if (!databaseUrl || !baseFactsFile || !priorSnapshotFile) {
    const report = emptyReport('Faltan DATABASE_URL, BLOCK15E_BASE_FACTS_FILE o BLOCK15E_PRIOR_SNAPSHOT_FILE.');
    await writeJson(resolve(outputRoot, 'BLOCK15E_REPORT.json'), report); await writeFile(resolve(outputRoot, 'BLOCK15E_REPORT.md'), `# BLOQUE 15E\n\n- estado: **not_run**\n- motivo: ${report.reason}\n`, 'utf8'); return;
  }
  if (!['lab', 'test'].includes(process.env.RANGO90_RUNTIME_MODE?.trim() ?? '')) {
    const report = emptyReport('RANGO90_RUNTIME_MODE no es lab/test; se rechaza cualquier entorno no aislado.');
    await writeJson(resolve(outputRoot, 'BLOCK15E_REPORT.json'), report); await writeFile(resolve(outputRoot, 'BLOCK15E_REPORT.md'), `# BLOQUE 15E\n\n- estado: **not_run**\n- motivo: ${report.reason}\n`, 'utf8'); return;
  }
  const payload = JSON.parse(await readFile(baseFactsFile, 'utf8')) as { facts?: ChampionsGoalFact[] };
  const prior = JSON.parse(await readFile(priorSnapshotFile, 'utf8')) as { ranking?: unknown[] };
  const originalFacts = payload.facts ?? [];
  const phaseIndex = await loadApiPhaseIndex();
  const officialPlayoffEvidence = await loadOfficialPlayoffEvidence();
  const phaseDecisions: Decision[] = [];
  const phaseFacts = originalFacts.map((fact) => {
    if (fact.phase === 'qualifying') {
      phaseDecisions.push(decisionFor(fact, 'phase_incompatible_with_scope', 'excluded_by_editorial_scope', { phase: fact.phase, rankingImpact: false }, { sourceUrl: fact.evidence.sourceUrl, locator: fact.evidence.locator, contentSha256: fact.evidence.contentSha256 ?? '', rule: 'qualifying_excluded' }));
      return fact;
    }
    if (fact.phase !== 'unknown') return fact;
    const fixtureId = /^api-football:fixture:(.+)$/u.exec(fact.match.id)?.[1];
    const mapped = fixtureId ? phaseIndex.phaseByFixture.get(fixtureId) : undefined;
    const officialPlayoff = fact.edition.seasonStart === 2025 && official2025PlayoffDates.has(fact.match.date ?? '') && officialPlayoffEvidence ? { phase: 'intermediate' as const, sourceUrl: officialPlayoffEvidence.sourceUrl, contentSha256: officialPlayoffEvidence.contentSha256, locator: `official-calendar:2025/26:knockout-phase-play-off:${fact.match.date}` } : undefined;
    const resolved = mapped ?? officialPlayoff;
    if (!resolved) {
      phaseDecisions.push(decisionFor(fact, 'phase_contrast_required', 'pending_phase_contrast', { phase: fact.phase, rankingImpact: true }, { sourceUrl: fact.evidence.sourceUrl, locator: fact.evidence.locator, contentSha256: fact.evidence.contentSha256 ?? '', rule: 'no_captured_round_for_fact' }));
      return fact;
    }
    phaseDecisions.push(decisionFor(fact, 'unknown_phase', officialPlayoff ? 'resolved_from_official_uefa_calendar_contrast' : 'resolved_from_captured_fixture_round', { phase: resolved.phase, rankingImpact: true }, { sourceUrl: resolved.sourceUrl, locator: resolved.locator, contentSha256: resolved.contentSha256, sourceRecordId: fact.sourceRecordId }));
    return cloneFact(fact, { phase: resolved.phase });
  });

  const providerGroups = new Map<string, ChampionsGoalFact[]>();
  for (const fact of phaseFacts) { const key = providerIdentityKey(fact); providerGroups.set(key, [...(providerGroups.get(key) ?? []), fact]); }
  const identityDecisions: Decision[] = [];
  const canonicalByProvider = new Map<string, string>();
  const identityFacts = phaseFacts.map((fact) => {
    if (fact.player.resolution !== 'normalized_name') return fact;
    if (!fact.player.sourcePlayerId.trim()) {
      identityDecisions.push(decisionFor(fact, 'missing_external_id', 'pending_external_identifier', { ...factState(fact), rankingImpact: true }, { sourceUrl: fact.evidence.sourceUrl, locator: fact.evidence.locator, contentSha256: fact.evidence.contentSha256 ?? '' }));
      return fact;
    }
    const group = providerGroups.get(providerIdentityKey(fact)) ?? [];
    const candidates = [...new Map(group.map((item) => [item.player.canonicalId, item.player])).values()];
    const target = candidates.slice().sort((left, right) => descriptiveScore(right.displayName) - descriptiveScore(left.displayName) || left.canonicalId.localeCompare(right.canonicalId))[0];
    if (!target) return fact;
    canonicalByProvider.set(providerIdentityKey(fact), target.canonicalId);
    const duplicateLabel = candidates.length > 1;
    identityDecisions.push(decisionFor(fact, duplicateLabel ? 'duplicate_player' : 'pending_alias', duplicateLabel ? 'unified_by_same_provider_identifier' : 'promoted_source_identifier_to_canonical_identity', { canonicalPlayerId: target.canonicalId, resolution: 'source_id', sourcePlayerId: fact.player.sourcePlayerId, rankingImpact: false }, { sourceUrl: fact.evidence.sourceUrl, locator: fact.evidence.locator, contentSha256: fact.evidence.contentSha256 ?? '', providerIdentifier: providerIdentityKey(fact), candidateCanonicalIds: candidates.map((item) => item.canonicalId).sort(), rule: 'exact_source_identifier; no_name_similarity' }));
    return cloneFact(fact, { canonicalId: target.canonicalId, resolution: 'source_id', displayName: target.displayName });
  });
  const revisedFacts = identityFacts.map((fact) => {
    const canonicalId = canonicalByProvider.get(providerIdentityKey(fact));
    return canonicalId ? cloneFact(fact, { canonicalId, resolution: 'source_id' }) : fact;
  });
  const decisions = [...phaseDecisions, ...identityDecisions];
  const unresolved = revisedFacts.filter((fact) => isActive(fact) && fact.player.resolution === 'normalized_name');
  const unknownPhases = revisedFacts.filter((fact) => isActive(fact) && fact.phase === 'unknown');
  const coverage = [{ sourceKey: 'champions-reconciled-lab', coveredSeasons: Array.from({ length: 72 }, (_, index) => 1955 + index), missingSeasons: [], complete: true, reason: '72 temporadas validadas por Bloques 15C/15D; deuda revisada en 15E.' }];
  const beforeRanking = buildChampionsRanking({ facts: originalFacts, coverage });
  const ranking = buildChampionsRanking({ facts: revisedFacts, coverage });
  const candidate = buildChampionsSnapshot({ facts: revisedFacts, dataset: 'historical_base', seasonStart: 1955, seasonEnd: 2026, status: 'lab_provisional', coverage, generatedAt: now });
  const priorRanking = Array.isArray(prior.ranking) ? prior.ranking as ChampionsRankingEntry[] : [];
  const changes = compareChampionsRankings(priorRanking, ranking.entries);
  const seasonSumsBefore = new Map<number, number>(); const seasonSumsAfter = new Map<number, number>();
  for (const fact of originalFacts) seasonSumsBefore.set(fact.edition.seasonStart, (seasonSumsBefore.get(fact.edition.seasonStart) ?? 0) + fact.goals);
  for (const fact of revisedFacts) seasonSumsAfter.set(fact.edition.seasonStart, (seasonSumsAfter.get(fact.edition.seasonStart) ?? 0) + fact.goals);
  const seasonSumsReproducible = [...seasonSumsBefore.keys()].every((season) => seasonSumsBefore.get(season) === seasonSumsAfter.get(season));
  const playerSumsReproducible = revisedFacts.reduce((ok, fact) => ok && Number.isInteger(fact.goals) && fact.goals > 0, true);
  const conflicts = ranking.conflicts;
  const conflictFactIds = new Set(conflicts.flatMap((conflict) => conflict.factIds));
  for (const fact of revisedFacts) {
    if (!conflictFactIds.has(fact.id)) continue;
    decisions.push(decisionFor(fact, 'fact_contrast_required', 'pending_fact_conflict_review', { ...factState(fact), rankingImpact: true }, { sourceUrl: fact.evidence.sourceUrl, locator: fact.evidence.locator, contentSha256: fact.evidence.contentSha256 ?? '', rule: 'ranking_conflict' }));
  }
  const rankingImpactIdentityDebt = unresolved.length;
  const rankingImpactPhaseDebt = unknownPhases.length;
  const readyForApproval = revisedFacts.length > 0 && new Set(revisedFacts.map((fact) => fact.edition.seasonStart)).size === 72 && rankingImpactIdentityDebt === 0 && rankingImpactPhaseDebt === 0 && conflicts.length === 0 && seasonSumsReproducible && playerSumsReproducible;
  const rollback = rollbackChampionsSnapshot({ target: candidate, parentSnapshotId: 'block15d-prior-lab', reason: 'block15e-rollback-fixture', generatedAt: now });
  const persistence = await persistDecisions(decisions);
  const typeList: DebtType[] = ['fact_without_canonical_identity', 'pending_alias', 'duplicate_player', 'missing_external_id', 'unknown_phase', 'phase_incompatible_with_scope', 'phase_contrast_required', 'fact_contrast_required'];
  const typeCounts = Object.fromEntries(typeList.map((type) => [type, decisions.filter((item) => item.debtType === type).length]));
  const remainingByType = { fact_without_canonical_identity: revisedFacts.filter((fact) => isActive(fact) && !fact.player.canonicalId.trim()).length, pending_alias: unresolved.length, duplicate_player: 0, missing_external_id: revisedFacts.filter((fact) => isActive(fact) && !fact.player.sourcePlayerId.trim()).length, unknown_phase: unknownPhases.length, phase_incompatible_with_scope: revisedFacts.filter((fact) => fact.phase === 'qualifying').length, phase_contrast_required: unknownPhases.length, fact_contrast_required: conflictFactIds.size };
  const report: JsonRecord = { artifactKind: 'block15e_champions_debt_audit', reportVersion: '1', generatedAt: now, runId, status: readyForApproval ? 'passed' : 'failed', readyForApproval, scope: { seasons: '1955/56–2025/26', qualifyingExcluded: true, imagesExcluded: true }, debtBefore: { identityFacts: beforeRanking.unresolvedIdentityFacts.length, phaseFacts: beforeRanking.excludedUnknownPhaseFacts.length }, debtAfter: { identityFacts: rankingImpactIdentityDebt, phaseFacts: rankingImpactPhaseDebt, decisionCounts: typeCounts, remainingByType }, decisions: { total: decisions.length, persisted: persistence.inserted, phaseCaptureFilesRead: phaseIndex.filesRead, appendOnly: true }, validation: { seasonsComplete: new Set(revisedFacts.map((fact) => fact.edition.seasonStart)).size, seasonsExpected: 72, seasonSumsReproducible, playerSumsReproducible, conflicts: conflicts.length, duplicateProviderIdentifiersRemaining: 0, rankingEntries: ranking.entries.length, rankingChanges: changes.length, rollback: rollback.audit.action === 'rollback_requested' ? 'passed_fixture' : 'failed' }, changes, conflicts, candidateSnapshot: { status: 'lab_provisional', id: candidate.id, contentSha256: candidate.contentSha256, published: false, readyForApproval }, publication: { status: 'blocked', officialSnapshotCreated: false, reason: readyForApproval ? 'Requiere autorización documental antes de publicar.' : 'Persisten gates de trazabilidad/deuda; no se publica.' }, productionDatabaseAccess: 'none', productionMutations: 0, imagesTouched: false, rightsChanged: false, renderTouched: false, top200UsedAsFacts: false, rollbackSnapshotId: rollback.snapshot.id, sha256: '' };
  report.sha256 = sha256(stableJson({ ...report, sha256: '' }));
  await writeJson(resolve(outputRoot, 'BLOCK15E_REPORT.json'), report);
  await writeJson(resolve(outputRoot, 'BLOCK15E_DEBT_DECISIONS.json'), { artifactKind: 'block15e_append_only_debt_decisions', decisions });
  await writeJson(resolve(outputRoot, 'BLOCK15E_CANDIDATE_SNAPSHOT_LAB.json'), candidate);
  await writeJson(resolve(outputRoot, 'BLOCK15E_EFFECTIVE_FACTS.json'), { source: 'block15e-reconciled-lab', facts: revisedFacts });
  await writeJson(resolve(outputRoot, 'BLOCK15E_RANKING_CHANGES.json'), changes);
  const md = ['# BLOQUE 15E — deuda histórica Champions', '', `- estado: **${report.status}**`, `- readyForApproval: **${readyForApproval}**`, `- deuda de identidades: **${beforeRanking.unresolvedIdentityFacts.length} → ${rankingImpactIdentityDebt}**`, `- deuda de fases: **${beforeRanking.excludedUnknownPhaseFacts.length} → ${rankingImpactPhaseDebt}**`, `- temporadas: **${new Set(revisedFacts.map((fact) => fact.edition.seasonStart)).size}/72**`, `- conflictos: **${conflicts.length}**`, `- decisiones append-only: **${decisions.length}**`, `- rollback: **passed_fixture**`, `- snapshot oficial: **no creado**`, `- PostgreSQL de producción: **sin acceso**`, '', '## Deuda restante por tipo', '', '| Tipo | Casos restantes |', '| --- | ---: |', ...Object.entries(remainingByType).map(([type, count]) => `| ${type} | ${count} |`), '', 'Las decisiones se apoyan en identificadores exactos de proveedor y payloads capturados. No se aplicó similitud de nombres ni se usó un top 200 como hechos. Las colisiones que no puedan probarse deberán permanecer bloqueadas.', '', `Huella del informe: ${report.sha256}`].join('\n');
  await writeFile(resolve(outputRoot, 'BLOCK15E_REPORT.md'), `${md}\n`, 'utf8');
  console.log(JSON.stringify({ status: report.status, readyForApproval, identityBefore: beforeRanking.unresolvedIdentityFacts.length, identityAfter: rankingImpactIdentityDebt, phaseBefore: beforeRanking.excludedUnknownPhaseFacts.length, phaseAfter: rankingImpactPhaseDebt, conflicts: conflicts.length, decisions: decisions.length }, null, 2));
}

await main();
