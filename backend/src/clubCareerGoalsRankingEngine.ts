import { createHash } from 'node:crypto';

export const CLUB_CAREER_GOALS_CATEGORY_SLUG = 'club-career-goals';
export const CLUB_CAREER_GOALS_SCOPE_VERSION = 'club-career-goals-facts-v1';
export type ClubGoalsDataset = 'historical_base' | 'active_weekly';

export type ClubGoalFact = {
  id: string;
  canonicalPlayerId: string | null;
  sourcePlayerId: string;
  playerNameAtSource: string;
  clubProviderId: number;
  clubNameAtSource: string;
  competition: { id: string; providerId: number; name: string; country: string };
  seasonStart: number;
  seasonLabel: string;
  recordType: 'season_stat' | 'match_event';
  matchId: string | null;
  matchDate: string | null;
  matchType: 'official_competition' | 'friendly' | 'youth' | 'reserve' | 'testimonial' | 'national_team' | 'unknown';
  goals: number;
  sourceKey: string;
  sourceCaptureId: string;
  sourceRecordId: string;
  sourceType: 'primary' | 'contrast';
  verificationStatus: 'confirmed' | 'unresolved' | 'conflict';
  scopeEligible: boolean;
  evidence: { sourceUrl: string; locator: string; contentSha256?: string };
  capturedAt: string;
};

export type ClubGoalsCoverage = {
  competitionId: string;
  providerId: number;
  name: string;
  country: string;
  seasonStart: number;
  status: 'covered' | 'partial' | 'unavailable';
  playerPages: number;
  playerRecords: number;
  facts: number;
  reason: string;
};

export type ClubGoalsRankingEntry = { canonicalPlayerId: string; playerName: string; rawValue: number; rank: number; tieGroup: number; factIds: string[] };
export type ClubGoalsChange = { canonicalPlayerId: string; playerName: string; previousValue: number | null; nextValue: number | null; previousRank: number | null; nextRank: number | null; valueChanged: boolean; positionChanged: boolean };
export type ClubGoalsSnapshot = {
  id: string;
  categorySlug: typeof CLUB_CAREER_GOALS_CATEGORY_SLUG;
  scopeVersion: string;
  dataset: ClubGoalsDataset;
  status: 'lab_provisional' | 'draft' | 'rolled_back';
  seasonStart: number;
  seasonEnd: number;
  competitionFilter: string | null;
  parentSnapshotId: string | null;
  rollbackOf: string | null;
  contentSha256: string;
  generatedAt: string;
  factIds: string[];
  ranking: ClubGoalsRankingEntry[];
  coverage: ClubGoalsCoverage[];
  coverageComplete: boolean;
  unresolvedIdentityFacts: string[];
  conflicts: string[];
  metadata: { imagesUsed: false; published: false; sourceCount: number; candidateStatus: 'candidate' | 'candidate_not_sufficient' };
};

export function stableClubGoalsJson(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (current && typeof current === 'object' && !Array.isArray(current)) return Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
    return current;
  });
}
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

export function importClubGoalFactsIdempotently(existing: ClubGoalFact[], incoming: ClubGoalFact[]) {
  const byId = new Map(existing.map((fact) => [fact.id, fact]));
  const added: ClubGoalFact[] = [];
  const skipped: ClubGoalFact[] = [];
  const conflicts: Array<{ id: string; existingGoals: number; incomingGoals: number }> = [];
  for (const fact of incoming) {
    const prior = byId.get(fact.id);
    if (!prior) { byId.set(fact.id, fact); added.push(fact); continue; }
    if (prior.goals !== fact.goals || prior.canonicalPlayerId !== fact.canonicalPlayerId) conflicts.push({ id: fact.id, existingGoals: prior.goals, incomingGoals: fact.goals });
    else skipped.push(fact);
  }
  return { added, skipped, conflicts };
}

export function buildClubGoalsSnapshot(input: {
  facts: ClubGoalFact[];
  dataset: ClubGoalsDataset;
  seasonStart: number;
  seasonEnd: number;
  competitionFilter?: string | null;
  coverage: ClubGoalsCoverage[];
  coverageComplete: boolean;
  generatedAt?: string;
  parentSnapshotId?: string | null;
  conflicts?: string[];
}): ClubGoalsSnapshot {
  const eligible = input.facts.filter((fact) => fact.scopeEligible && fact.matchType === 'official_competition' && fact.verificationStatus === 'confirmed' && fact.canonicalPlayerId && fact.goals > 0);
  const unresolvedIdentityFacts = input.facts.filter((fact) => !fact.canonicalPlayerId || fact.verificationStatus === 'unresolved').map((fact) => fact.id);
  const conflicts = input.conflicts ?? input.facts.filter((fact) => fact.verificationStatus === 'conflict').map((fact) => fact.id);
  const grouped = new Map<string, { playerName: string; goals: number; factIds: string[] }>();
  for (const fact of eligible) {
    const current = grouped.get(fact.canonicalPlayerId!);
    if (current) { current.goals += fact.goals; current.factIds.push(fact.id); }
    else grouped.set(fact.canonicalPlayerId!, { playerName: fact.playerNameAtSource, goals: fact.goals, factIds: [fact.id] });
  }
  const ordered = [...grouped.entries()].map(([canonicalPlayerId, value]) => ({ canonicalPlayerId, playerName: value.playerName, rawValue: value.goals, factIds: value.factIds.sort() })).sort((a, b) => b.rawValue - a.rawValue || a.playerName.localeCompare(b.playerName, 'es') || a.canonicalPlayerId.localeCompare(b.canonicalPlayerId));
  let previousValue: number | null = null; let rank = 0; let tieGroup = 0;
  const ranking = ordered.map((entry, index) => {
    if (entry.rawValue !== previousValue) { rank = index + 1; tieGroup += 1; previousValue = entry.rawValue; }
    return { ...entry, rank, tieGroup };
  });
  const payload = { categorySlug: CLUB_CAREER_GOALS_CATEGORY_SLUG, scopeVersion: CLUB_CAREER_GOALS_SCOPE_VERSION, dataset: input.dataset, seasonStart: input.seasonStart, seasonEnd: input.seasonEnd, competitionFilter: input.competitionFilter ?? null, factIds: input.facts.map((fact) => fact.id).sort(), ranking, coverage: input.coverage, coverageComplete: input.coverageComplete, unresolvedIdentityFacts, conflicts };
  const contentSha256 = sha256(stableClubGoalsJson(payload));
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  return { id: `club-goals-snapshot-${contentSha256.slice(0, 32)}`, categorySlug: CLUB_CAREER_GOALS_CATEGORY_SLUG, scopeVersion: CLUB_CAREER_GOALS_SCOPE_VERSION, dataset: input.dataset, status: 'lab_provisional', seasonStart: input.seasonStart, seasonEnd: input.seasonEnd, competitionFilter: input.competitionFilter ?? null, parentSnapshotId: input.parentSnapshotId ?? null, rollbackOf: null, contentSha256, generatedAt, factIds: payload.factIds, ranking, coverage: input.coverage, coverageComplete: input.coverageComplete, unresolvedIdentityFacts, conflicts, metadata: { imagesUsed: false, published: false, sourceCount: new Set(input.facts.map((fact) => fact.sourceKey)).size, candidateStatus: input.coverageComplete && conflicts.length === 0 && unresolvedIdentityFacts.length === 0 ? 'candidate' : 'candidate_not_sufficient' } };
}

export function compareClubGoalsRankings(previous: ClubGoalsRankingEntry[], next: ClubGoalsRankingEntry[]): ClubGoalsChange[] {
  const before = new Map(previous.map((entry) => [entry.canonicalPlayerId, entry]));
  const after = new Map(next.map((entry) => [entry.canonicalPlayerId, entry]));
  return [...new Set([...before.keys(), ...after.keys()])].map((canonicalPlayerId) => {
    const left = before.get(canonicalPlayerId); const right = after.get(canonicalPlayerId);
    return { canonicalPlayerId, playerName: right?.playerName ?? left?.playerName ?? canonicalPlayerId, previousValue: left?.rawValue ?? null, nextValue: right?.rawValue ?? null, previousRank: left?.rank ?? null, nextRank: right?.rank ?? null, valueChanged: (left?.rawValue ?? null) !== (right?.rawValue ?? null), positionChanged: (left?.rank ?? null) !== (right?.rank ?? null) };
  }).filter((change) => change.valueChanged || change.positionChanged).sort((a, b) => (a.nextRank ?? 999999) - (b.nextRank ?? 999999) || a.canonicalPlayerId.localeCompare(b.canonicalPlayerId));
}

export function rollbackClubGoalsSnapshot(input: { target: ClubGoalsSnapshot; parentSnapshotId: string | null; reason: string; generatedAt?: string }) {
  const snapshot = { ...input.target, id: `club-goals-rollback-${sha256(`${input.target.id}|${input.parentSnapshotId}|${input.reason}`).slice(0, 32)}`, status: 'rolled_back' as const, parentSnapshotId: input.parentSnapshotId, rollbackOf: input.target.id, generatedAt: input.generatedAt ?? new Date().toISOString(), metadata: { ...input.target.metadata, published: false as const } };
  return { snapshot };
}
