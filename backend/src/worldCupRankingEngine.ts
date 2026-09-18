import { createHash } from 'node:crypto';
import { buildRanking } from './ranking.js';

export const WORLD_CUP_CATEGORY_SLUG = 'world-cup-goals';
export const WORLD_CUP_SCOPE_VERSION = 'world-cup-goals-final-tournaments-v1';
export type WorldCupDataset = 'historical_base' | 'active_edition_weekly';
export type WorldCupPhase = 'group' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final' | 'unknown';
export type WorldCupSnapshotStatus = 'lab_provisional' | 'draft' | 'published' | 'superseded' | 'rolled_back';

export type WorldCupPlayer = {
  canonicalId: string;
  displayName: string;
  normalizedName: string;
  sourceKey: string;
  sourcePlayerId: string;
  resolution: 'explicit' | 'source_id' | 'normalized_name';
};
export type WorldCupFact = {
  id: string;
  edition: { id: string; year: number; label: string; isCurrentEdition: boolean };
  player: WorldCupPlayer | null;
  match: { id: string; date: string | null; homeTeam: string; awayTeam: string };
  phase: WorldCupPhase;
  goals: number;
  isOwnGoal: boolean;
  isShootout: boolean;
  scopeEligible?: boolean;
  sourceKey: string;
  sourceCaptureId: string;
  sourceRecordId: string;
  evidence: { sourceUrl: string; locator: string; excerpt?: string; contentSha256?: string };
  capturedAt: string;
};
export type WorldCupConflict = { key: string; factIds: string[]; sourceKeys: string[]; values: number[]; reason: string };
export type WorldCupEntry = { canonicalPlayerId: string; playerName: string; rawValue: number; rank: number; tieGroup: number; factIds: string[] };
export type WorldCupCoverage = { sourceKey: string; coveredEditions: number[]; missingEditions: number[]; complete: boolean; reason: string };
export type WorldCupSnapshot = {
  id: string; categorySlug: typeof WORLD_CUP_CATEGORY_SLUG; scopeVersion: string; dataset: WorldCupDataset; status: WorldCupSnapshotStatus;
  editionStart: number; editionEnd: number; parentSnapshotId: string | null; rollbackOf: string | null; contentSha256: string; generatedAt: string;
  factIds: string[]; ranking: WorldCupEntry[]; conflicts: WorldCupConflict[]; coverage: WorldCupCoverage[]; coverageComplete: boolean;
  unresolvedIdentityFacts: string[]; excludedOwnGoalFacts: string[]; excludedUnknownPhaseFacts: string[];
  metadata: { imagesUsed: false; published: boolean; sourceCount: number; fixtureOnly?: boolean };
};

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
export const normalizeWorldCupName = (name: string): string => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
export function editionForYear(year: number, currentYear?: number) {
  if (!Number.isInteger(year) || year < 1930) throw new Error(`Invalid World Cup edition: ${year}`);
  return { id: `world-cup:${year}`, year, label: `${year}`, isCurrentEdition: year === currentYear };
}
export function normalizeWorldCupPhase(round: string | null | undefined): WorldCupPhase {
  const value = normalizeWorldCupName(round ?? '');
  if (!value) return 'unknown';
  if (/qualif|prelim|play off|playoff/u.test(value)) return 'unknown';
  if (/group|first stage|second stage|league/u.test(value)) return 'group';
  if (/round of 16|last 16|1 8/u.test(value)) return 'round_of_16';
  if (/quarter|1 4/u.test(value)) return 'quarter_final';
  if (/semi|1 2/u.test(value)) return 'semi_final';
  if (/third|third place/u.test(value)) return 'third_place';
  if (/final/u.test(value)) return 'final';
  return 'unknown';
}
export function resolveWorldCupPlayer(input: { sourceKey: string; sourcePlayerId: string; displayName: string }, aliases: Record<string, string> = {}): WorldCupPlayer {
  const normalizedName = normalizeWorldCupName(input.displayName);
  if (!normalizedName) throw new Error('World Cup player name cannot be empty');
  const canonicalId = aliases[`${input.sourceKey}:${input.sourcePlayerId}`] ?? `world-cup:player:${normalizedName.replaceAll(' ', '-')}`;
  return { ...input, canonicalId, normalizedName, resolution: aliases[`${input.sourceKey}:${input.sourcePlayerId}`] ? 'source_id' : 'normalized_name' };
}
export function createWorldCupFact(input: Omit<WorldCupFact, 'id'> & { id?: string }): WorldCupFact {
  const id = input.id ?? `world-cup-fact-${sha256(JSON.stringify({ sourceCaptureId: input.sourceCaptureId, sourceRecordId: input.sourceRecordId, sourceKey: input.sourceKey })).slice(0, 32)}`;
  if (input.isOwnGoal && input.player) throw new Error('An own goal must not be credited to a player');
  if (!input.isOwnGoal && !input.player) throw new Error('A non-own goal requires a player');
  if (input.isShootout) throw new Error('Shootout events are out of scope');
  return { ...input, id };
}
export type ApiFootballWorldCupMatch = { fixture?: { id?: number; date?: string | null }; league?: { season?: number; round?: string | null }; teams?: { home?: { name?: string | null }; away?: { name?: string | null } }; events?: Array<{ type?: string; detail?: string | null; player?: { id?: number; name?: string | null } | null }> };
export function adaptApiFootballWorldCupMatches(input: { sourceCaptureId: string; capturedAt: string; sourceUrl: string; matches: ApiFootballWorldCupMatch[]; currentYear?: number; aliases?: Record<string, string> }) {
  const facts: WorldCupFact[] = []; const anomalies: Array<{ fixtureId: string; reason: string }> = [];
  for (const [matchIndex, match] of input.matches.entries()) {
    const fixtureId = match.fixture?.id; const year = match.league?.season;
    if (!Number.isInteger(fixtureId) || !Number.isInteger(year)) { anomalies.push({ fixtureId: String(fixtureId ?? `row-${matchIndex}`), reason: 'fixture_or_edition_missing' }); continue; }
    const phase = normalizeWorldCupPhase(match.league?.round); const edition = editionForYear(year as number, input.currentYear);
    for (const [eventIndex, event] of (match.events ?? []).entries()) {
      if (event.type?.toLocaleLowerCase('en-US') !== 'goal') continue;
      const detail = normalizeWorldCupName(event.detail ?? '');
      if (/penalty shootout|shootout/u.test(detail)) { anomalies.push({ fixtureId: String(fixtureId), reason: `goal_${eventIndex}_shootout_excluded` }); continue; }
      const ownGoal = /own goal|autogol/u.test(detail);
      const player = ownGoal ? null : event.player?.id && event.player.name ? resolveWorldCupPlayer({ sourceKey: 'api-football', sourcePlayerId: String(event.player.id), displayName: event.player.name }, input.aliases) : null;
      if (!ownGoal && !player) { anomalies.push({ fixtureId: String(fixtureId), reason: `goal_${eventIndex}_player_missing` }); continue; }
      facts.push(createWorldCupFact({ edition, player, match: { id: `api-football:fixture:${fixtureId}`, date: match.fixture?.date ? new Date(match.fixture.date).toISOString().slice(0, 10) : null, homeTeam: match.teams?.home?.name ?? 'Unknown home team', awayTeam: match.teams?.away?.name ?? 'Unknown away team' }, phase, goals: 1, isOwnGoal: ownGoal, isShootout: false, sourceKey: 'api-football', sourceCaptureId: input.sourceCaptureId, sourceRecordId: `fixture:${fixtureId}:goal:${eventIndex}`, evidence: { sourceUrl: input.sourceUrl, locator: `response.fixture=${fixtureId}.events[${eventIndex}]` }, capturedAt: input.capturedAt }));
    }
  }
  return { facts, anomalies };
}
export function importWorldCupFactsIdempotently(existing: WorldCupFact[], incoming: WorldCupFact[]) {
  const byId = new Map(existing.map((fact) => [fact.id, fact])); const byRecord = new Map(existing.map((fact) => [`${fact.sourceKey}|${fact.sourceRecordId}`, fact])); const added: WorldCupFact[] = []; const skipped: WorldCupFact[] = []; const conflicts: WorldCupConflict[] = [];
  for (const fact of incoming) { const prior = byId.get(fact.id) ?? byRecord.get(`${fact.sourceKey}|${fact.sourceRecordId}`); if (prior) { if (JSON.stringify({ player: prior.player?.canonicalId, goals: prior.goals, own: prior.isOwnGoal }) !== JSON.stringify({ player: fact.player?.canonicalId, goals: fact.goals, own: fact.isOwnGoal })) conflicts.push({ key: `${fact.sourceKey}|${fact.sourceRecordId}`, factIds: [prior.id, fact.id], sourceKeys: [prior.sourceKey, fact.sourceKey], values: [prior.goals, fact.goals], reason: 'duplicate_source_record_with_different_value' }); else skipped.push(fact); continue; } byId.set(fact.id, fact); byRecord.set(`${fact.sourceKey}|${fact.sourceRecordId}`, fact); added.push(fact); }
  return { facts: [...byId.values()], added, skipped, conflicts: [...conflicts, ...detectWorldCupConflicts([...byId.values()])] };
}
export function detectWorldCupConflicts(facts: WorldCupFact[]): WorldCupConflict[] {
  const groups = new Map<string, WorldCupFact[]>(); for (const fact of facts) { if (fact.isOwnGoal) continue; const key = `${fact.edition.id}|${fact.match.id}|${fact.player?.canonicalId}|${fact.phase}`; groups.set(key, [...(groups.get(key) ?? []), fact]); }
  return [...groups.entries()].filter(([, group]) => new Set(group.map((fact) => fact.goals)).size > 1).map(([key, group]) => ({ key, factIds: group.map((fact) => fact.id), sourceKeys: group.map((fact) => fact.sourceKey), values: group.map((fact) => fact.goals), reason: 'different_goal_values_for_same_match_player' }));
}
export function buildWorldCupRanking(input: { facts: WorldCupFact[]; coverage?: WorldCupCoverage[]; editionStart?: number; editionEnd?: number }) {
  const start = input.editionStart ?? 1930; const end = input.editionEnd ?? 2026; const conflicts = detectWorldCupConflicts(input.facts); const conflictIds = new Set(conflicts.flatMap((conflict) => conflict.factIds)); const excludedOwnGoalFacts: string[] = []; const excludedUnknownPhaseFacts: string[] = []; const unresolvedIdentityFacts: string[] = []; const values = new Map<string, { name: string; rawValue: number; factIds: string[] }>();
  for (const fact of input.facts) { if (fact.edition.year < start || fact.edition.year > end || fact.isShootout || fact.scopeEligible === false) continue; if (fact.isOwnGoal) { excludedOwnGoalFacts.push(fact.id); continue; } if (fact.phase === 'unknown') { excludedUnknownPhaseFacts.push(fact.id); continue; } if (!fact.player) continue; if (fact.player.resolution === 'normalized_name') unresolvedIdentityFacts.push(fact.id); if (conflictIds.has(fact.id)) continue; const current = values.get(fact.player.canonicalId) ?? { name: fact.player.displayName, rawValue: 0, factIds: [] }; current.rawValue += fact.goals; current.factIds.push(fact.id); values.set(fact.player.canonicalId, current); }
  const ranking = buildRanking([...values.entries()].map(([entityId, value]) => ({ entityId, rawValue: value.rawValue })), { direction: 'desc', scoreCap: 100 }).map((entry) => { const value = values.get(entry.entityId)!; return { canonicalPlayerId: entry.entityId, playerName: value.name, rawValue: entry.rawValue, rank: entry.rank, tieGroup: entry.tieGroup, factIds: [...value.factIds].sort() }; });
  return { entries: ranking, conflicts, excludedOwnGoalFacts, excludedUnknownPhaseFacts, unresolvedIdentityFacts, coverage: input.coverage ?? [], coverageComplete: (input.coverage ?? []).length > 0 && input.coverage!.every((coverage) => coverage.complete) };
}
export function buildWorldCupSnapshot(input: { facts: WorldCupFact[]; dataset: WorldCupDataset; editionStart: number; editionEnd: number; parentSnapshotId?: string | null; coverage?: WorldCupCoverage[]; generatedAt?: string; status?: WorldCupSnapshotStatus; fixtureOnly?: boolean }): WorldCupSnapshot {
  const result = buildWorldCupRanking(input); const generatedAt = input.generatedAt ?? new Date().toISOString(); const factIds = input.facts.map((fact) => fact.id).sort(); const contentSha256 = sha256(JSON.stringify({ dataset: input.dataset, factIds, ranking: result.entries, coverage: result.coverage }));
  return { id: `world-cup-${input.dataset}-${generatedAt.replace(/[^0-9]/g, '').slice(0, 14)}-${contentSha256.slice(0, 12)}`, categorySlug: WORLD_CUP_CATEGORY_SLUG, scopeVersion: WORLD_CUP_SCOPE_VERSION, dataset: input.dataset, status: input.status ?? 'lab_provisional', editionStart: input.editionStart, editionEnd: input.editionEnd, parentSnapshotId: input.parentSnapshotId ?? null, rollbackOf: null, contentSha256, generatedAt, factIds, ranking: result.entries, conflicts: result.conflicts, coverage: result.coverage, coverageComplete: result.coverageComplete, unresolvedIdentityFacts: result.unresolvedIdentityFacts, excludedOwnGoalFacts: result.excludedOwnGoalFacts, excludedUnknownPhaseFacts: result.excludedUnknownPhaseFacts, metadata: { imagesUsed: false, published: false, sourceCount: new Set(input.facts.map((fact) => fact.sourceKey)).size, fixtureOnly: input.fixtureOnly } };
}
export function compareWorldCupRankings(previous: WorldCupEntry[], next: WorldCupEntry[]) { const oldById = new Map(previous.map((entry) => [entry.canonicalPlayerId, entry])); const newById = new Map(next.map((entry) => [entry.canonicalPlayerId, entry])); return [...new Set([...oldById.keys(), ...newById.keys()])].map((id) => ({ canonicalPlayerId: id, previousValue: oldById.get(id)?.rawValue ?? null, nextValue: newById.get(id)?.rawValue ?? null, previousRank: oldById.get(id)?.rank ?? null, nextRank: newById.get(id)?.rank ?? null })).filter((change) => change.previousValue !== change.nextValue || change.previousRank !== change.nextRank); }
