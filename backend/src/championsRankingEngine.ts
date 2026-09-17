import { createHash } from 'node:crypto';
import { buildRanking } from './ranking.js';

export const CHAMPIONS_CATEGORY_SLUG = 'uefa-champions-league-goals';
export const CHAMPIONS_SCOPE_VERSION = 'uefa-champions-league-goals-facts-v1';
export const CHAMPIONS_HISTORICAL_START = 1955;
export const CHAMPIONS_HISTORICAL_END = 2025;

export type ChampionsEra = 'european_cup' | 'champions_league';
export type ChampionsDataset = 'historical_base' | 'active_season_weekly';
export type ChampionsSnapshotStatus = 'lab_provisional' | 'draft' | 'published' | 'superseded' | 'rolled_back';
export type ChampionsPhase =
  | 'qualifying'
  | 'preliminary'
  | 'first_round'
  | 'second_round'
  | 'third_round'
  | 'intermediate'
  | 'league_phase'
  | 'group'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'final'
  | 'unknown';

export type ChampionsScope = {
  startSeason: number;
  endSeason: number;
  includeQualifying: boolean;
  scopeVersion: string;
};

export type ChampionsEdition = {
  id: string;
  seasonStart: number;
  seasonEnd: number;
  seasonLabel: string;
  era: ChampionsEra;
  competitionName: 'Copa de Europa' | 'UEFA Champions League';
  isCurrentSeason: boolean;
};

export type PlayerIdentity = {
  canonicalId: string;
  displayName: string;
  normalizedName: string;
  sourceKey: string;
  sourcePlayerId: string;
  resolution: 'explicit' | 'source_id' | 'normalized_name';
};

export type ChampionsEvidence = {
  sourceUrl: string;
  locator: string;
  excerpt?: string;
  contentSha256?: string;
};

export type ChampionsGoalFact = {
  id: string;
  edition: ChampionsEdition;
  player: PlayerIdentity;
  match: {
    id: string;
    date: string | null;
    homeTeam: string;
    awayTeam: string;
  };
  phase: ChampionsPhase;
  goals: number;
  sourceKey: string;
  sourceCaptureId: string;
  sourceRecordId: string;
  evidence: ChampionsEvidence;
  capturedAt: string;
};

export type ChampionsSourceCoverage = {
  sourceKey: string;
  coveredSeasons: number[];
  missingSeasons: number[];
  complete: boolean;
  reason: string;
};

export type ChampionsConflict = {
  key: string;
  factIds: string[];
  sourceKeys: string[];
  values: number[];
  reason: 'different_goal_values_for_same_match_player' | 'duplicate_source_record_with_different_value';
};

export type ChampionsRankingEntry = {
  canonicalPlayerId: string;
  playerName: string;
  rawValue: number;
  rank: number;
  tieGroup: number;
  factIds: string[];
  eras: ChampionsEra[];
};

export type ChampionsChange = {
  canonicalPlayerId: string;
  playerName: string;
  previousValue: number | null;
  nextValue: number | null;
  previousRank: number | null;
  nextRank: number | null;
  valueChanged: boolean;
  positionChanged: boolean;
};

export type ChampionsRankingResult = {
  entries: ChampionsRankingEntry[];
  conflicts: ChampionsConflict[];
  excludedQualifyingFacts: string[];
  excludedOutOfScopeFacts: string[];
  excludedUnknownPhaseFacts: string[];
  unresolvedIdentityFacts: string[];
  coverageComplete: boolean;
  coverage: ChampionsSourceCoverage[];
};

export type ChampionsSnapshot = {
  id: string;
  categorySlug: typeof CHAMPIONS_CATEGORY_SLUG;
  scopeVersion: string;
  dataset: ChampionsDataset;
  status: ChampionsSnapshotStatus;
  seasonStart: number;
  seasonEnd: number;
  parentSnapshotId: string | null;
  rollbackOf: string | null;
  contentSha256: string;
  generatedAt: string;
  factIds: string[];
  ranking: ChampionsRankingEntry[];
  conflicts: ChampionsConflict[];
  coverage: ChampionsSourceCoverage[];
  coverageComplete: boolean;
  unresolvedIdentityFacts: string[];
  excludedUnknownPhaseFacts: string[];
  metadata: { imagesUsed: false; published: boolean; sourceCount: number };
};

export type ChampionsSnapshotAudit = {
  action: 'created' | 'rollback_requested' | 'publication_rejected';
  snapshotId: string;
  parentSnapshotId: string | null;
  timestamp: string;
  reason: string;
};

export type IdentityResolver = {
  aliases?: Record<string, string>;
  sourceIds?: Record<string, string>;
  displayNames?: Record<string, string>;
};

export type ApiFootballGoalEvent = {
  type?: string;
  detail?: string | null;
  player?: { id?: number; name?: string | null } | null;
  team?: { id?: number; name?: string | null } | null;
};

export type ApiFootballChampionsMatch = {
  fixture?: { id?: number; date?: string | null };
  league?: { season?: number; round?: string | null };
  teams?: { home?: { name?: string | null }; away?: { name?: string | null } };
  events?: ApiFootballGoalEvent[];
};

export type ApiFootballAdaptation = {
  facts: ChampionsGoalFact[];
  anomalies: Array<{ fixtureId: string; reason: string }>;
};

export const DEFAULT_CHAMPIONS_SCOPE: ChampionsScope = {
  startSeason: CHAMPIONS_HISTORICAL_START,
  endSeason: CHAMPIONS_HISTORICAL_END,
  includeQualifying: false,
  scopeVersion: CHAMPIONS_SCOPE_VERSION
};

export function seasonLabel(seasonStart: number): string {
  assertSeason(seasonStart);
  return `${seasonStart}/${String((seasonStart + 1) % 100).padStart(2, '0')}`;
}

export function editionForSeason(seasonStart: number, activeSeasonStart?: number): ChampionsEdition {
  assertSeason(seasonStart);
  const current = activeSeasonStart !== undefined && seasonStart === activeSeasonStart;
  const era: ChampionsEra = seasonStart < 1992 ? 'european_cup' : 'champions_league';
  return {
    id: `champions:${seasonLabel(seasonStart)}`,
    seasonStart,
    seasonEnd: seasonStart + 1,
    seasonLabel: seasonLabel(seasonStart),
    era,
    competitionName: era === 'european_cup' ? 'Copa de Europa' : 'UEFA Champions League',
    isCurrentSeason: current
  };
}

export function normalizePlayerName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeChampionsPhase(round: string | null | undefined): ChampionsPhase {
  const normalized = normalizePlayerName(round ?? '');
  if (!normalized) return 'unknown';
  if (/knockout (phase|round) play off/u.test(normalized)) return 'intermediate';
  if (/(qualifying|preliminary|play off|playoff)/u.test(normalized)) return 'qualifying';
  if (/first round|^round 1$|^first$/u.test(normalized)) return 'first_round';
  if (/second round|^round 2$|^second$/u.test(normalized)) return 'second_round';
  if (/third round|^round 3$|^third$/u.test(normalized)) return 'third_round';
  if (/intermediate/u.test(normalized)) return 'intermediate';
  if (/(league phase|league stage|regular season|championship stage)/u.test(normalized)) return 'league_phase';
  if (/(group|second stage|first stage)/u.test(normalized)) return 'group';
  if (/round of 16|round 16|last 16|1 8/u.test(normalized)) return 'round_of_16';
  if (/quarter|1 4/u.test(normalized)) return 'quarter_final';
  if (/semi|1 2/u.test(normalized)) return 'semi_final';
  if (/final/u.test(normalized)) return 'final';
  return 'unknown';
}

export function logicalFactKey(fact: ChampionsGoalFact): string {
  return [fact.edition.id, fact.match.id, fact.player.canonicalId, fact.phase].join('|');
}

export function factId(input: {
  sourceCaptureId: string;
  sourceRecordId: string;
  sourceKey: string;
  editionId: string;
  playerSourceId: string;
  goals: number;
}): string {
  const raw = JSON.stringify(input);
  return `champions-fact-${sha256(raw).slice(0, 32)}`;
}

export function resolvePlayerIdentity(
  input: { sourceKey: string; sourcePlayerId: string; displayName: string },
  resolver: IdentityResolver = {}
): PlayerIdentity {
  const normalizedName = normalizePlayerName(input.displayName);
  if (!normalizedName) throw new Error('El nombre del jugador no puede estar vacío');
  const sourceKey = `${input.sourceKey}:${input.sourcePlayerId}`;
  const explicitId = resolver.sourceIds?.[sourceKey];
  const aliasId = resolver.aliases?.[normalizedName];
  const canonicalId = explicitId ?? aliasId ?? `champions:player:${normalizedName.replaceAll(' ', '-')}`;
  const resolution = explicitId ? 'source_id' : aliasId ? 'explicit' : 'normalized_name';
  return {
    canonicalId,
    displayName: resolver.displayNames?.[canonicalId] ?? input.displayName,
    normalizedName,
    sourceKey: input.sourceKey,
    sourcePlayerId: input.sourcePlayerId,
    resolution
  };
}

export function createGoalFact(input: Omit<ChampionsGoalFact, 'id'> & { id?: string }): ChampionsGoalFact {
  assertFact(input);
  return {
    ...input,
    id: input.id ?? factId({
      sourceCaptureId: input.sourceCaptureId,
      sourceRecordId: input.sourceRecordId,
      sourceKey: input.sourceKey,
      editionId: input.edition.id,
      playerSourceId: input.player.sourcePlayerId,
      goals: input.goals
    })
  };
}

export function adaptApiFootballChampionsMatches(input: {
  sourceCaptureId: string;
  capturedAt: string;
  sourceUrl: string;
  matches: ApiFootballChampionsMatch[];
  resolver?: IdentityResolver;
  activeSeasonStart?: number;
}): ApiFootballAdaptation {
  const facts: ChampionsGoalFact[] = [];
  const anomalies: ApiFootballAdaptation['anomalies'] = [];
  for (const [matchIndex, match] of input.matches.entries()) {
    const fixtureId = match.fixture?.id;
    const seasonStart = match.league?.season;
    if (typeof fixtureId !== 'number' || !Number.isInteger(fixtureId) || typeof seasonStart !== 'number' || !Number.isInteger(seasonStart)) {
      anomalies.push({ fixtureId: String(fixtureId ?? `row-${matchIndex}`), reason: 'fixture_or_season_missing' });
      continue;
    }
    const edition = editionForSeason(seasonStart, input.activeSeasonStart);
    const phase = normalizeChampionsPhase(match.league?.round);
    for (const [eventIndex, event] of (match.events ?? []).entries()) {
      if (event.type?.toLocaleLowerCase('en-US') !== 'goal') continue;
      if (normalizePlayerName(event.detail ?? '').includes('own goal')) continue;
      if (!event.player?.id || !event.player.name) {
        anomalies.push({ fixtureId: String(fixtureId), reason: `goal_${eventIndex}_player_missing` });
        continue;
      }
      const player = resolvePlayerIdentity({
        sourceKey: 'api-football',
        sourcePlayerId: String(event.player.id),
        displayName: event.player.name
      }, input.resolver);
      facts.push(createGoalFact({
        edition,
        player,
        match: {
          id: `api-football:fixture:${fixtureId}`,
          date: match.fixture?.date ? new Date(match.fixture.date).toISOString().slice(0, 10) : null,
          homeTeam: match.teams?.home?.name ?? 'Unknown home team',
          awayTeam: match.teams?.away?.name ?? 'Unknown away team'
        },
        phase,
        goals: 1,
        sourceKey: 'api-football',
        sourceCaptureId: input.sourceCaptureId,
        sourceRecordId: `fixture:${fixtureId}:goal:${eventIndex}`,
        evidence: { sourceUrl: input.sourceUrl, locator: `response.fixture=${fixtureId}.events[${eventIndex}]` },
        capturedAt: input.capturedAt
      }));
    }
  }
  return { facts, anomalies };
}

export function importFactsIdempotently(existing: ChampionsGoalFact[], incoming: ChampionsGoalFact[]): {
  facts: ChampionsGoalFact[];
  added: ChampionsGoalFact[];
  skipped: ChampionsGoalFact[];
  conflicts: ChampionsConflict[];
} {
  const byId = new Map(existing.map((fact) => [fact.id, fact]));
  const added: ChampionsGoalFact[] = [];
  const skipped: ChampionsGoalFact[] = [];
  const conflicts: ChampionsConflict[] = [];
  for (const fact of incoming) {
    assertFact(fact);
    const prior = byId.get(fact.id);
    if (prior) {
      if (stableJson(prior) !== stableJson(fact)) {
        conflicts.push(conflictForFacts([prior, fact], 'duplicate_source_record_with_different_value'));
      } else {
        skipped.push(fact);
      }
      continue;
    }
    byId.set(fact.id, fact);
    added.push(fact);
  }
  return { facts: [...byId.values()], added, skipped, conflicts: [...conflicts, ...detectChampionsConflicts([...byId.values()])] };
}

export function detectChampionsConflicts(facts: ChampionsGoalFact[]): ChampionsConflict[] {
  const sourceRecordGroups = new Map<string, ChampionsGoalFact[]>();
  const groups = new Map<string, ChampionsGoalFact[]>();
  for (const fact of facts) {
    const sourceRecordKey = [fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId].join('|');
    sourceRecordGroups.set(sourceRecordKey, [...(sourceRecordGroups.get(sourceRecordKey) ?? []), fact]);
    const key = logicalFactKey(fact);
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  const duplicateConflicts = [...sourceRecordGroups.values()]
    .filter((group) => new Set(group.map((fact) => fact.goals)).size > 1)
    .map((group) => conflictForFacts(group, 'duplicate_source_record_with_different_value'));
  const crossSourceConflicts = [...groups.values()]
    .filter((group) => {
      const totals = new Map<string, number>();
      for (const fact of group) totals.set(fact.sourceKey, (totals.get(fact.sourceKey) ?? 0) + fact.goals);
      return totals.size > 1 && new Set(totals.values()).size > 1;
    })
    .map((group) => {
      const totals = new Map<string, number>();
      for (const fact of group) totals.set(fact.sourceKey, (totals.get(fact.sourceKey) ?? 0) + fact.goals);
      return conflictForFacts(group, 'different_goal_values_for_same_match_player', [...totals.values()]);
    });
  return [...duplicateConflicts, ...crossSourceConflicts];
}

export function buildChampionsRanking(input: {
  facts: ChampionsGoalFact[];
  scope?: Partial<ChampionsScope>;
  coverage?: ChampionsSourceCoverage[];
}): ChampionsRankingResult {
  const scope = { ...DEFAULT_CHAMPIONS_SCOPE, ...input.scope };
  const conflicts = detectChampionsConflicts(input.facts);
  const conflictFactIds = new Set(conflicts.flatMap((conflict) => conflict.factIds));
  const excludedQualifyingFacts: string[] = [];
  const excludedOutOfScopeFacts: string[] = [];
  const excludedUnknownPhaseFacts: string[] = [];
  const unresolvedIdentityFacts: string[] = [];
  const values = new Map<string, { name: string; rawValue: number; factIds: string[]; eras: Set<ChampionsEra> }>();
  for (const fact of input.facts) {
    assertFact(fact);
    if (fact.edition.seasonStart < scope.startSeason || fact.edition.seasonStart > scope.endSeason) {
      excludedOutOfScopeFacts.push(fact.id);
      continue;
    }
    if (!scope.includeQualifying && fact.phase === 'qualifying') {
      excludedQualifyingFacts.push(fact.id);
      continue;
    }
    if (fact.phase === 'unknown') {
      excludedUnknownPhaseFacts.push(fact.id);
      continue;
    }
    if (fact.player.resolution === 'normalized_name') unresolvedIdentityFacts.push(fact.id);
    if (conflictFactIds.has(fact.id)) {
      continue;
    }
    const prior = values.get(fact.player.canonicalId) ?? { name: fact.player.displayName, rawValue: 0, factIds: [], eras: new Set<ChampionsEra>() };
    prior.rawValue += fact.goals;
    prior.factIds.push(fact.id);
    prior.eras.add(fact.edition.era);
    values.set(fact.player.canonicalId, prior);
  }
  const ranking = buildRanking([...values.entries()].map(([entityId, value]) => ({ entityId, rawValue: value.rawValue })), { direction: 'desc', scoreCap: 100 });
  const entries: ChampionsRankingEntry[] = ranking.map((entry) => {
    const value = values.get(entry.entityId)!;
    return {
      canonicalPlayerId: entry.entityId,
      playerName: value.name,
      rawValue: entry.rawValue,
      rank: entry.rank,
      tieGroup: entry.tieGroup,
      factIds: [...value.factIds].sort(),
      eras: [...value.eras].sort()
    };
  });
  return {
    entries,
    conflicts,
    excludedQualifyingFacts,
    excludedOutOfScopeFacts,
    excludedUnknownPhaseFacts,
    unresolvedIdentityFacts,
    coverageComplete: (input.coverage ?? []).length > 0 && input.coverage!.every((coverage) => coverage.complete),
    coverage: input.coverage ?? []
  };
}

export function compareChampionsRankings(previous: ChampionsRankingEntry[], next: ChampionsRankingEntry[]): ChampionsChange[] {
  const oldById = new Map(previous.map((entry) => [entry.canonicalPlayerId, entry]));
  const newById = new Map(next.map((entry) => [entry.canonicalPlayerId, entry]));
  const ids = [...new Set([...oldById.keys(), ...newById.keys()])].sort();
  return ids.map((canonicalPlayerId) => {
    const oldEntry = oldById.get(canonicalPlayerId);
    const newEntry = newById.get(canonicalPlayerId);
    return {
      canonicalPlayerId,
      playerName: newEntry?.playerName ?? oldEntry?.playerName ?? canonicalPlayerId,
      previousValue: oldEntry?.rawValue ?? null,
      nextValue: newEntry?.rawValue ?? null,
      previousRank: oldEntry?.rank ?? null,
      nextRank: newEntry?.rank ?? null,
      valueChanged: (oldEntry?.rawValue ?? null) !== (newEntry?.rawValue ?? null),
      positionChanged: (oldEntry?.rank ?? null) !== (newEntry?.rank ?? null)
    };
  }).filter((change) => change.valueChanged || change.positionChanged);
}

export function buildWeeklyChampionsUpdate(input: {
  historicalFacts: ChampionsGoalFact[];
  activeSeasonFacts: ChampionsGoalFact[];
  activeSeasonStart: number;
  previousSnapshot?: ChampionsSnapshot;
  coverage?: ChampionsSourceCoverage[];
  generatedAt?: string;
}): { snapshot: ChampionsSnapshot; changes: ChampionsChange[] } {
  const allFacts = [...input.historicalFacts, ...input.activeSeasonFacts];
  const snapshot = buildChampionsSnapshot({
    facts: allFacts,
    dataset: 'active_season_weekly',
    seasonStart: CHAMPIONS_HISTORICAL_START,
    seasonEnd: input.activeSeasonStart,
    parentSnapshotId: input.previousSnapshot?.id ?? null,
    coverage: input.coverage,
    generatedAt: input.generatedAt
  });
  return {
    snapshot,
    changes: compareChampionsRankings(input.previousSnapshot?.ranking ?? [], snapshot.ranking)
  };
}

export function buildChampionsSnapshot(input: {
  facts: ChampionsGoalFact[];
  dataset: ChampionsDataset;
  seasonStart: number;
  seasonEnd: number;
  status?: Exclude<ChampionsSnapshotStatus, 'published'>;
  parentSnapshotId?: string | null;
  generatedAt?: string;
  coverage?: ChampionsSourceCoverage[];
}): ChampionsSnapshot {
  const ranking = buildChampionsRanking({ facts: input.facts, scope: { startSeason: input.seasonStart, endSeason: input.seasonEnd }, coverage: input.coverage });
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const payload = {
    categorySlug: CHAMPIONS_CATEGORY_SLUG,
    scopeVersion: CHAMPIONS_SCOPE_VERSION,
    dataset: input.dataset,
    seasonStart: input.seasonStart,
    seasonEnd: input.seasonEnd,
    factIds: input.facts.map((fact) => fact.id).sort(),
    ranking: ranking.entries,
    conflicts: ranking.conflicts,
    coverage: ranking.coverage,
    unresolvedIdentityFacts: ranking.unresolvedIdentityFacts,
    excludedUnknownPhaseFacts: ranking.excludedUnknownPhaseFacts
  };
  const contentSha256 = sha256(stableJson(payload));
  return {
    id: `champions-snapshot-${contentSha256.slice(0, 32)}`,
    categorySlug: CHAMPIONS_CATEGORY_SLUG,
    scopeVersion: CHAMPIONS_SCOPE_VERSION,
    dataset: input.dataset,
    status: input.status ?? 'lab_provisional',
    seasonStart: input.seasonStart,
    seasonEnd: input.seasonEnd,
    parentSnapshotId: input.parentSnapshotId ?? null,
    rollbackOf: null,
    contentSha256,
    generatedAt,
    factIds: payload.factIds,
    ranking: ranking.entries,
    conflicts: ranking.conflicts,
    coverage: ranking.coverage,
    coverageComplete: ranking.coverageComplete,
    unresolvedIdentityFacts: ranking.unresolvedIdentityFacts,
    excludedUnknownPhaseFacts: ranking.excludedUnknownPhaseFacts,
    metadata: { imagesUsed: false, published: false, sourceCount: new Set(input.facts.map((fact) => fact.sourceKey)).size }
  };
}

export function publishChampionsSnapshot(input: {
  snapshot: ChampionsSnapshot;
  authorization: { written: boolean; reviewedBy?: string };
  generatedAt?: string;
}): ChampionsSnapshot {
  assertPublishableChampionsSnapshot(input.snapshot, input.authorization);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  return {
    ...input.snapshot,
    id: `champions-published-${sha256(`${input.snapshot.id}|${input.authorization.reviewedBy}|${generatedAt}`).slice(0, 32)}`,
    status: 'published',
    parentSnapshotId: input.snapshot.id,
    generatedAt,
    metadata: { ...input.snapshot.metadata, published: true }
  };
}

export function appendSnapshot(existing: ChampionsSnapshot[], next: ChampionsSnapshot): ChampionsSnapshot[] {
  const prior = existing.find((snapshot) => snapshot.id === next.id);
  if (prior && stableJson(prior) !== stableJson(next)) throw new Error(`Snapshot append-only en conflicto: ${next.id}`);
  if (prior) return existing.map((snapshot) => snapshot);
  return [...existing, next];
}

export function rollbackChampionsSnapshot(input: {
  target: ChampionsSnapshot;
  parentSnapshotId: string;
  generatedAt?: string;
  reason: string;
}): { snapshot: ChampionsSnapshot; audit: ChampionsSnapshotAudit } {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const base = buildChampionsSnapshot({
    facts: [],
    dataset: input.target.dataset,
    seasonStart: input.target.seasonStart,
    seasonEnd: input.target.seasonEnd,
    status: 'rolled_back',
    parentSnapshotId: input.parentSnapshotId,
    generatedAt
  });
  const snapshot: ChampionsSnapshot = {
    ...base,
    id: `champions-rollback-${sha256(`${input.target.id}|${input.parentSnapshotId}|${input.reason}`).slice(0, 32)}`,
    rollbackOf: input.target.id,
    factIds: [...input.target.factIds],
    ranking: input.target.ranking.map((entry) => ({ ...entry, factIds: [...entry.factIds], eras: [...entry.eras] })),
    conflicts: input.target.conflicts.map((conflict) => ({ ...conflict, factIds: [...conflict.factIds], sourceKeys: [...conflict.sourceKeys], values: [...conflict.values] })),
    coverage: input.target.coverage.map((coverage) => ({ ...coverage, coveredSeasons: [...coverage.coveredSeasons], missingSeasons: [...coverage.missingSeasons] })),
    coverageComplete: input.target.coverageComplete,
    unresolvedIdentityFacts: [...input.target.unresolvedIdentityFacts],
    excludedUnknownPhaseFacts: [...input.target.excludedUnknownPhaseFacts],
    contentSha256: input.target.contentSha256,
    metadata: { ...input.target.metadata, published: false }
  };
  return {
    snapshot,
    audit: { action: 'rollback_requested', snapshotId: snapshot.id, parentSnapshotId: input.parentSnapshotId, timestamp: generatedAt, reason: input.reason }
  };
}

export function assertPublishableChampionsSnapshot(snapshot: ChampionsSnapshot, authorization: { written: boolean; reviewedBy?: string }): void {
  if (!authorization.written) throw new Error('Champions no puede publicarse sin autorización escrita');
  if (!authorization.reviewedBy?.trim()) throw new Error('Champions requiere revisor legal/documental');
  if (!snapshot.coverageComplete) throw new Error('Champions no puede publicarse con cobertura incompleta');
  if (snapshot.conflicts.length > 0) throw new Error('Champions no puede publicarse con conflictos sin resolver');
  if (snapshot.unresolvedIdentityFacts.length > 0) throw new Error('Champions no puede publicarse con identidades resueltas solo por nombre');
  if (snapshot.excludedUnknownPhaseFacts.length > 0) throw new Error('Champions no puede publicarse con hechos sin fase clasificada');
}

export function stableJson(value: unknown): string { return JSON.stringify(value, null, 2) + '\n'; }
export function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function assertSeason(seasonStart: number): void {
  if (!Number.isInteger(seasonStart) || seasonStart < 1955 || seasonStart > 2100) throw new Error(`Temporada Champions inválida: ${seasonStart}`);
}

function assertFact(fact: Omit<ChampionsGoalFact, 'id'> | ChampionsGoalFact): void {
  if (!fact.edition || fact.edition.era !== (fact.edition.seasonStart < 1992 ? 'european_cup' : 'champions_league')) throw new Error('Era Champions incoherente con la temporada');
  if (fact.edition.seasonStart < 1955) throw new Error('Una evidencia anterior a 1955/56 está fuera del alcance Champions');
  if (!fact.match.id.trim() || !fact.sourceCaptureId.trim() || !fact.sourceRecordId.trim()) throw new Error('Un hecho Champions requiere partido, captura y registro de fuente');
  if (!fact.player.canonicalId.trim() || !fact.player.sourcePlayerId.trim()) throw new Error('Un hecho Champions requiere identidad canónica y de fuente');
  if (!Number.isInteger(fact.goals) || fact.goals < 1) throw new Error('Los goles de un hecho Champions deben ser enteros positivos');
  if (!fact.evidence.sourceUrl.trim() || !fact.evidence.locator.trim()) throw new Error('Un hecho Champions requiere evidencia trazable');
  if (Number.isNaN(Date.parse(fact.capturedAt))) throw new Error('capturedAt inválido en hecho Champions');
}

function conflictForFacts(facts: ChampionsGoalFact[], reason: ChampionsConflict['reason'], valuesOverride?: number[]): ChampionsConflict {
  const values = valuesOverride ?? [...new Set(facts.map((fact) => fact.goals))];
  return {
    key: logicalFactKey(facts[0]!),
    factIds: facts.map((fact) => fact.id).sort(),
    sourceKeys: [...new Set(facts.map((fact) => fact.sourceKey))].sort(),
    values: values.sort((a, b) => a - b),
    reason
  };
}
