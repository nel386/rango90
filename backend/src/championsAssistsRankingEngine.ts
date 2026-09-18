import { createHash } from 'node:crypto';
import { buildRanking } from './ranking.js';
import {
  editionForSeason,
  normalizeChampionsPhase,
  normalizePlayerName,
  resolvePlayerIdentity,
  stableJson,
  type ChampionsEdition,
  type ChampionsEvidence,
  type ChampionsPhase,
  type IdentityResolver,
  type PlayerIdentity
} from './championsRankingEngine.js';

export const CHAMPIONS_ASSISTS_CATEGORY_SLUG = 'uefa-champions-league-assists';
export const CHAMPIONS_ASSISTS_SCOPE_VERSION = 'uefa-champions-league-assists-facts-v1';
export const CHAMPIONS_ASSISTS_HISTORICAL_START = 1955;
export const CHAMPIONS_ASSISTS_HISTORICAL_END = 2025;

export type ChampionsAssistDataset = 'historical_base' | 'active_season_weekly';
export type ChampionsAssistSnapshotStatus = 'lab_provisional' | 'draft' | 'published' | 'superseded' | 'rolled_back';

export type ChampionsAssistFact = {
  id: string;
  edition: ChampionsEdition;
  player: PlayerIdentity;
  match: { id: string; date: string | null; homeTeam: string; awayTeam: string };
  eventId: string;
  phase: ChampionsPhase;
  assists: number;
  sourceKey: string;
  sourceCaptureId: string;
  sourceRecordId: string;
  sourceType: 'primary' | 'contrast';
  verificationStatus: 'confirmed' | 'unresolved' | 'conflict';
  evidence: ChampionsEvidence;
  capturedAt: string;
};

export type ChampionsAssistCoverage = {
  sourceKey: string;
  coveredSeasons: number[];
  missingSeasons: number[];
  complete: boolean;
  reason: string;
};

export type ChampionsAssistConflict = {
  key: string;
  factIds: string[];
  sourceKeys: string[];
  values: number[];
  reason: 'different_assist_values_for_same_match_player' | 'duplicate_source_record_with_different_value';
};

export type ChampionsAssistRankingEntry = {
  canonicalPlayerId: string;
  playerName: string;
  rawValue: number;
  rank: number;
  tieGroup: number;
  factIds: string[];
  eras: Array<'european_cup' | 'champions_league'>;
};

export type ChampionsAssistChange = {
  canonicalPlayerId: string;
  playerName: string;
  previousValue: number | null;
  nextValue: number | null;
  previousRank: number | null;
  nextRank: number | null;
  valueChanged: boolean;
  positionChanged: boolean;
};

export type ChampionsAssistRankingResult = {
  entries: ChampionsAssistRankingEntry[];
  conflicts: ChampionsAssistConflict[];
  excludedQualifyingFacts: string[];
  excludedOutOfScopeFacts: string[];
  excludedUnknownPhaseFacts: string[];
  unresolvedIdentityFacts: string[];
  excludedUnverifiedFacts: string[];
  coverageComplete: boolean;
  coverage: ChampionsAssistCoverage[];
};

export type ChampionsAssistSnapshot = {
  id: string;
  categorySlug: typeof CHAMPIONS_ASSISTS_CATEGORY_SLUG;
  scopeVersion: string;
  dataset: ChampionsAssistDataset;
  status: ChampionsAssistSnapshotStatus;
  seasonStart: number;
  seasonEnd: number;
  parentSnapshotId: string | null;
  rollbackOf: string | null;
  contentSha256: string;
  generatedAt: string;
  factIds: string[];
  ranking: ChampionsAssistRankingEntry[];
  conflicts: ChampionsAssistConflict[];
  coverage: ChampionsAssistCoverage[];
  coverageComplete: boolean;
  unresolvedIdentityFacts: string[];
  excludedUnknownPhaseFacts: string[];
  excludedUnverifiedFacts: string[];
  metadata: { imagesUsed: false; published: boolean; sourceCount: number; candidateStatus: 'candidate' | 'candidate_not_sufficient' };
};

export type ApiFootballAssistEvent = {
  type?: string;
  detail?: string | null;
  player?: { id?: number; name?: string | null } | null;
  assist?: { id?: number | null; name?: string | null } | null;
};

export type ApiFootballChampionsAssistMatch = {
  fixture?: { id?: number; date?: string | null };
  league?: { season?: number; round?: string | null };
  teams?: { home?: { name?: string | null }; away?: { name?: string | null } };
  events?: ApiFootballAssistEvent[];
};

export type ApiFootballAssistAdaptation = {
  facts: ChampionsAssistFact[];
  anomalies: Array<{ fixtureId: string; reason: string }>;
  uncreditedGoalEvents: number;
};

export function assistFactId(input: { sourceCaptureId: string; sourceRecordId: string; sourceKey: string; editionId: string; playerSourceId: string; assists: number }): string {
  return `champions-assist-fact-${sha256(JSON.stringify(input)).slice(0, 32)}`;
}

export function createChampionsAssistFact(input: Omit<ChampionsAssistFact, 'id'> & { id?: string }): ChampionsAssistFact {
  assertAssistFact(input);
  return { ...input, id: input.id ?? assistFactId({ sourceCaptureId: input.sourceCaptureId, sourceRecordId: input.sourceRecordId, sourceKey: input.sourceKey, editionId: input.edition.id, playerSourceId: input.player.sourcePlayerId, assists: input.assists }) };
}

export function adaptApiFootballChampionsAssists(input: { sourceCaptureId: string; capturedAt: string; sourceUrl: string; matches: ApiFootballChampionsAssistMatch[]; resolver?: IdentityResolver; activeSeasonStart?: number }): ApiFootballAssistAdaptation {
  const facts: ChampionsAssistFact[] = [];
  const anomalies: ApiFootballAssistAdaptation['anomalies'] = [];
  let uncreditedGoalEvents = 0;
  for (const [matchIndex, match] of input.matches.entries()) {
    const fixtureId = match.fixture?.id;
    const seasonStart = match.league?.season;
    if (!Number.isInteger(fixtureId) || !Number.isInteger(seasonStart)) {
      anomalies.push({ fixtureId: String(fixtureId ?? `row-${matchIndex}`), reason: 'fixture_or_season_missing' });
      continue;
    }
    const edition = editionForSeason(seasonStart as number, input.activeSeasonStart);
    const phase = normalizeChampionsPhase(match.league?.round);
    for (const [eventIndex, event] of (match.events ?? []).entries()) {
      if (event.type?.toLocaleLowerCase('en-US') !== 'goal') continue;
      if (normalizePlayerName(event.detail ?? '').includes('own goal')) continue;
      if (!Number.isInteger(event.assist?.id) || !event.assist?.name) {
        uncreditedGoalEvents += 1;
        continue;
      }
      const player = resolvePlayerIdentity({ sourceKey: 'api-football', sourcePlayerId: String(event.assist.id), displayName: event.assist.name }, input.resolver);
      facts.push(createChampionsAssistFact({
        edition,
        player,
        match: { id: `api-football:fixture:${fixtureId}`, date: match.fixture?.date ? new Date(match.fixture.date).toISOString().slice(0, 10) : null, homeTeam: match.teams?.home?.name ?? 'Unknown home team', awayTeam: match.teams?.away?.name ?? 'Unknown away team' },
        phase,
        assists: 1,
        sourceKey: 'api-football',
        sourceCaptureId: input.sourceCaptureId,
        sourceRecordId: `fixture:${fixtureId}:assist:${eventIndex}`,
        eventId: `fixture:${fixtureId}:event:${eventIndex}`,
        evidence: { sourceUrl: input.sourceUrl, locator: `response.fixture=${fixtureId}.events[${eventIndex}].assist` },
        sourceType: 'primary',
        verificationStatus: 'confirmed',
        capturedAt: input.capturedAt
      }));
    }
  }
  return { facts, anomalies, uncreditedGoalEvents };
}

export function logicalAssistFactKey(fact: ChampionsAssistFact): string {
  return [fact.edition.id, fact.match.id, fact.player.canonicalId, fact.phase].join('|');
}

export function detectChampionsAssistConflicts(facts: ChampionsAssistFact[]): ChampionsAssistConflict[] {
  const sourceRecords = new Map<string, ChampionsAssistFact[]>();
  const logical = new Map<string, ChampionsAssistFact[]>();
  for (const fact of facts) {
    const sourceRecordKey = [fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId].join('|');
    sourceRecords.set(sourceRecordKey, [...(sourceRecords.get(sourceRecordKey) ?? []), fact]);
    const key = logicalAssistFactKey(fact);
    logical.set(key, [...(logical.get(key) ?? []), fact]);
  }
  const duplicate = [...sourceRecords.values()].filter((group) => new Set(group.map((fact) => fact.assists)).size > 1).map((group) => conflictForAssistFacts(group, 'duplicate_source_record_with_different_value'));
  const crossSource = [...logical.values()].filter((group) => {
    const totals = new Map<string, number>();
    for (const fact of group) totals.set(fact.sourceKey, (totals.get(fact.sourceKey) ?? 0) + fact.assists);
    return totals.size > 1 && new Set(totals.values()).size > 1;
  }).map((group) => {
    const totals = new Map<string, number>();
    for (const fact of group) totals.set(fact.sourceKey, (totals.get(fact.sourceKey) ?? 0) + fact.assists);
    return conflictForAssistFacts(group, 'different_assist_values_for_same_match_player', [...totals.values()]);
  });
  return [...duplicate, ...crossSource];
}

export function importChampionsAssistsIdempotently(existing: ChampionsAssistFact[], incoming: ChampionsAssistFact[]): { facts: ChampionsAssistFact[]; added: ChampionsAssistFact[]; skipped: ChampionsAssistFact[]; conflicts: ChampionsAssistConflict[] } {
  const byId = new Map(existing.map((fact) => [fact.id, fact]));
  const byRecord = new Map(existing.map((fact) => [[fact.sourceKey, fact.sourceRecordId].join('|'), fact]));
  const added: ChampionsAssistFact[] = [];
  const skipped: ChampionsAssistFact[] = [];
  const conflicts: ChampionsAssistConflict[] = [];
  for (const fact of incoming) {
    assertAssistFact(fact);
    const prior = byId.get(fact.id) ?? byRecord.get([fact.sourceKey, fact.sourceRecordId].join('|'));
    if (!prior) { byId.set(fact.id, fact); byRecord.set([fact.sourceKey, fact.sourceRecordId].join('|'), fact); added.push(fact); continue; }
    if (stableJson({ edition: prior.edition.id, player: prior.player.canonicalId, match: prior.match, eventId: prior.eventId, phase: prior.phase, assists: prior.assists, sourceType: prior.sourceType, verificationStatus: prior.verificationStatus }) === stableJson({ edition: fact.edition.id, player: fact.player.canonicalId, match: fact.match, eventId: fact.eventId, phase: fact.phase, assists: fact.assists, sourceType: fact.sourceType, verificationStatus: fact.verificationStatus })) skipped.push(fact);
    else conflicts.push(conflictForAssistFacts([prior, fact], 'duplicate_source_record_with_different_value'));
  }
  return { facts: [...byId.values()], added, skipped, conflicts: [...conflicts, ...detectChampionsAssistConflicts([...byId.values()])] };
}

export function buildChampionsAssistsRanking(input: { facts: ChampionsAssistFact[]; startSeason?: number; endSeason?: number; coverage?: ChampionsAssistCoverage[] }): ChampionsAssistRankingResult {
  const startSeason = input.startSeason ?? CHAMPIONS_ASSISTS_HISTORICAL_START;
  const endSeason = input.endSeason ?? CHAMPIONS_ASSISTS_HISTORICAL_END;
  const conflicts = detectChampionsAssistConflicts(input.facts);
  const conflictFactIds = new Set(conflicts.flatMap((conflict) => conflict.factIds));
  const excludedQualifyingFacts: string[] = [];
  const excludedOutOfScopeFacts: string[] = [];
  const excludedUnknownPhaseFacts: string[] = [];
  const unresolvedIdentityFacts: string[] = [];
  const excludedUnverifiedFacts: string[] = [];
  const values = new Map<string, { name: string; rawValue: number; factIds: string[]; eras: Set<'european_cup' | 'champions_league'> }>();
  for (const fact of input.facts) {
    assertAssistFact(fact);
    if (fact.edition.seasonStart < startSeason || fact.edition.seasonStart > endSeason) { excludedOutOfScopeFacts.push(fact.id); continue; }
    if (fact.phase === 'qualifying' || fact.phase === 'preliminary') { excludedQualifyingFacts.push(fact.id); continue; }
    if (fact.phase === 'unknown') { excludedUnknownPhaseFacts.push(fact.id); continue; }
    if (fact.verificationStatus !== 'confirmed') { excludedUnverifiedFacts.push(fact.id); continue; }
    if (fact.player.resolution === 'normalized_name') { unresolvedIdentityFacts.push(fact.id); continue; }
    if (conflictFactIds.has(fact.id)) continue;
    const prior = values.get(fact.player.canonicalId) ?? { name: fact.player.displayName, rawValue: 0, factIds: [], eras: new Set<'european_cup' | 'champions_league'>() };
    prior.rawValue += fact.assists;
    prior.factIds.push(fact.id);
    prior.eras.add(fact.edition.era);
    values.set(fact.player.canonicalId, prior);
  }
  const ranking = buildRanking([...values.entries()].map(([entityId, value]) => ({ entityId, rawValue: value.rawValue })), { direction: 'desc', scoreCap: 100 });
  const entries = ranking.map((entry) => { const value = values.get(entry.entityId)!; return { canonicalPlayerId: entry.entityId, playerName: value.name, rawValue: entry.rawValue, rank: entry.rank, tieGroup: entry.tieGroup, factIds: [...value.factIds].sort(), eras: [...value.eras].sort() }; });
  return { entries, conflicts, excludedQualifyingFacts, excludedOutOfScopeFacts, excludedUnknownPhaseFacts, unresolvedIdentityFacts, excludedUnverifiedFacts, coverageComplete: (input.coverage ?? []).length > 0 && input.coverage!.every((coverage) => coverage.complete), coverage: input.coverage ?? [] };
}

export function compareChampionsAssistsRankings(previous: ChampionsAssistRankingEntry[], next: ChampionsAssistRankingEntry[]): ChampionsAssistChange[] {
  const oldById = new Map(previous.map((entry) => [entry.canonicalPlayerId, entry]));
  const newById = new Map(next.map((entry) => [entry.canonicalPlayerId, entry]));
  return [...new Set([...oldById.keys(), ...newById.keys()])].sort().map((id) => {
    const oldEntry = oldById.get(id); const newEntry = newById.get(id);
    return { canonicalPlayerId: id, playerName: newEntry?.playerName ?? oldEntry?.playerName ?? id, previousValue: oldEntry?.rawValue ?? null, nextValue: newEntry?.rawValue ?? null, previousRank: oldEntry?.rank ?? null, nextRank: newEntry?.rank ?? null, valueChanged: (oldEntry?.rawValue ?? null) !== (newEntry?.rawValue ?? null), positionChanged: (oldEntry?.rank ?? null) !== (newEntry?.rank ?? null) };
  }).filter((change) => change.valueChanged || change.positionChanged);
}

export function buildChampionsAssistsSnapshot(input: { facts: ChampionsAssistFact[]; dataset: ChampionsAssistDataset; seasonStart: number; seasonEnd: number; status?: Exclude<ChampionsAssistSnapshotStatus, 'published'>; parentSnapshotId?: string | null; generatedAt?: string; coverage?: ChampionsAssistCoverage[] }): ChampionsAssistSnapshot {
  const ranking = buildChampionsAssistsRanking({ facts: input.facts, startSeason: input.seasonStart, endSeason: input.seasonEnd, coverage: input.coverage });
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const payload = { categorySlug: CHAMPIONS_ASSISTS_CATEGORY_SLUG, scopeVersion: CHAMPIONS_ASSISTS_SCOPE_VERSION, dataset: input.dataset, seasonStart: input.seasonStart, seasonEnd: input.seasonEnd, factIds: input.facts.map((fact) => fact.id).sort(), ranking: ranking.entries, conflicts: ranking.conflicts, coverage: ranking.coverage, unresolvedIdentityFacts: ranking.unresolvedIdentityFacts, excludedUnknownPhaseFacts: ranking.excludedUnknownPhaseFacts, excludedUnverifiedFacts: ranking.excludedUnverifiedFacts };
  const contentSha256 = sha256(stableJson(payload));
  return { id: `champions-assists-snapshot-${contentSha256.slice(0, 32)}`, categorySlug: CHAMPIONS_ASSISTS_CATEGORY_SLUG, scopeVersion: CHAMPIONS_ASSISTS_SCOPE_VERSION, dataset: input.dataset, status: input.status ?? 'lab_provisional', seasonStart: input.seasonStart, seasonEnd: input.seasonEnd, parentSnapshotId: input.parentSnapshotId ?? null, rollbackOf: null, contentSha256, generatedAt, factIds: payload.factIds, ranking: ranking.entries, conflicts: ranking.conflicts, coverage: ranking.coverage, coverageComplete: ranking.coverageComplete, unresolvedIdentityFacts: ranking.unresolvedIdentityFacts, excludedUnknownPhaseFacts: ranking.excludedUnknownPhaseFacts, excludedUnverifiedFacts: ranking.excludedUnverifiedFacts, metadata: { imagesUsed: false, published: false, sourceCount: new Set(input.facts.map((fact) => fact.sourceKey)).size, candidateStatus: ranking.coverageComplete && ranking.conflicts.length === 0 && ranking.unresolvedIdentityFacts.length === 0 && ranking.excludedUnknownPhaseFacts.length === 0 && ranking.excludedUnverifiedFacts.length === 0 ? 'candidate' : 'candidate_not_sufficient' } };
}

export function rollbackChampionsAssistsSnapshot(input: { target: ChampionsAssistSnapshot; parentSnapshotId: string; generatedAt?: string; reason: string }): { snapshot: ChampionsAssistSnapshot; audit: { action: 'rollback_requested'; snapshotId: string; parentSnapshotId: string; timestamp: string; reason: string } } {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const snapshot = { ...input.target, id: `champions-assists-rollback-${sha256(`${input.target.id}|${input.parentSnapshotId}|${input.reason}`).slice(0, 32)}`, status: 'rolled_back' as const, parentSnapshotId: input.parentSnapshotId, rollbackOf: input.target.id, generatedAt, metadata: { ...input.target.metadata, published: false } };
  return { snapshot, audit: { action: 'rollback_requested', snapshotId: snapshot.id, parentSnapshotId: input.parentSnapshotId, timestamp: generatedAt, reason: input.reason } };
}

export function stableAssistJson(value: unknown): string { return stableJson(value); }
export function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function conflictForAssistFacts(facts: ChampionsAssistFact[], reason: ChampionsAssistConflict['reason'], valuesOverride?: number[]): ChampionsAssistConflict { return { key: logicalAssistFactKey(facts[0]!), factIds: facts.map((fact) => fact.id).sort(), sourceKeys: [...new Set(facts.map((fact) => fact.sourceKey))].sort(), values: (valuesOverride ?? [...new Set(facts.map((fact) => fact.assists))]).sort((a, b) => a - b), reason }; }
function assertAssistFact(fact: Omit<ChampionsAssistFact, 'id'> | ChampionsAssistFact): void {
  if (!fact.edition || fact.edition.seasonStart < 1955 || fact.edition.era !== (fact.edition.seasonStart < 1992 ? 'european_cup' : 'champions_league')) throw new Error('Era Champions incoherente en hecho de asistencia');
  if (!fact.match.id.trim() || !fact.eventId.trim() || !fact.sourceCaptureId.trim() || !fact.sourceRecordId.trim()) throw new Error('Un hecho de asistencia requiere partido, evento, captura y registro de fuente');
  if (!fact.player.canonicalId.trim() || !fact.player.sourcePlayerId.trim()) throw new Error('Un hecho de asistencia requiere identidad canónica y de fuente');
  if (!Number.isInteger(fact.assists) || fact.assists < 1) throw new Error('Las asistencias deben ser enteros positivos');
  if (!fact.evidence.sourceUrl.trim() || !fact.evidence.locator.trim()) throw new Error('Un hecho de asistencia requiere evidencia trazable');
  if (!['primary', 'contrast'].includes(fact.sourceType)) throw new Error('sourceType inválido en hecho de asistencia');
  if (!['confirmed', 'unresolved', 'conflict'].includes(fact.verificationStatus)) throw new Error('verificationStatus inválido en hecho de asistencia');
  if (Number.isNaN(Date.parse(fact.capturedAt))) throw new Error('capturedAt inválido en hecho de asistencia');
}
