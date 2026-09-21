import { createHash } from 'node:crypto';

export const CLUB_YELLOW_CARDS_CATEGORY_SLUG = 'club-career-yellow-cards';
export const CLUB_RED_CARDS_CATEGORY_SLUG = 'club-career-red-cards';
export const CLUB_CARDS_SCOPE_VERSION = 'club-cards-facts-v1';
export type ClubCardKind = 'yellow' | 'red';
export type ClubCardsDataset = 'historical_base' | 'active_weekly';

export type ClubCardFact = {
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
  yellowCards: number | null;
  redCards: number | null;
  redSecondYellow: number | null;
  redDirect: number | null;
  sourceKey: string;
  sourceCaptureId: string;
  sourceRecordId: string;
  sourceType: 'primary' | 'contrast';
  verificationStatus: 'confirmed' | 'unresolved' | 'conflict';
  scopeEligible: boolean;
  evidence: { sourceUrl: string; locator: string; contentSha256?: string };
  capturedAt: string;
};

export type ClubCardsCoverage = {
  competitionId: string;
  providerId: number;
  name: string;
  country: string;
  seasonStart: number;
  status: 'complete' | 'partial' | 'unavailable';
  playerPages: number;
  playerRecords: number;
  yellowCards: number;
  redCards: number;
  reason: string;
};

export type ClubCardsRankingEntry = { canonicalPlayerId: string; playerName: string; rawValue: number; rank: number; tieGroup: number; factIds: string[] };
export type ClubCardsChange = { canonicalPlayerId: string; playerName: string; previousValue: number | null; nextValue: number | null; previousRank: number | null; nextRank: number | null; valueChanged: boolean; positionChanged: boolean };
export type ClubCardsSnapshot = {
  id: string;
  categorySlug: typeof CLUB_YELLOW_CARDS_CATEGORY_SLUG | typeof CLUB_RED_CARDS_CATEGORY_SLUG;
  cardKind: ClubCardKind;
  scopeVersion: string;
  dataset: ClubCardsDataset;
  status: 'lab_provisional' | 'draft' | 'rolled_back';
  seasonStart: number;
  seasonEnd: number;
  competitionFilter: string | null;
  parentSnapshotId: string | null;
  rollbackOf: string | null;
  contentSha256: string;
  generatedAt: string;
  factIds: string[];
  ranking: ClubCardsRankingEntry[];
  coverage: ClubCardsCoverage[];
  coverageComplete: boolean;
  unresolvedIdentityFacts: string[];
  conflicts: string[];
  metadata: { published: false; candidateStatus: 'candidate' | 'candidate_not_sufficient'; activeSeasonStatus?: 'complete_scope' | 'provisional_active_season' | 'partial_missing_provider_data' | 'quota_insufficient' | 'provider_unavailable'; seasonInProgress?: boolean; observedFacts?: number; observedPages?: number; redTypesDifferentiated: boolean };
};

export function stableClubCardsJson(value: unknown): string {
  return JSON.stringify(value, (_key, current) => current && typeof current === 'object' && !Array.isArray(current)
    ? Object.fromEntries(Object.entries(current).sort(([left], [right]) => left.localeCompare(right)))
    : current);
}

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

export function cardValue(fact: ClubCardFact, cardKind: ClubCardKind): number | null {
  return cardKind === 'yellow' ? fact.yellowCards : fact.redCards;
}

export function importClubCardFactsIdempotently(existing: ClubCardFact[], incoming: ClubCardFact[]) {
  const byId = new Map(existing.map((fact) => [fact.id, fact]));
  const added: ClubCardFact[] = []; const skipped: ClubCardFact[] = [];
  const conflicts: Array<{ id: string; existing: string; incoming: string }> = [];
  for (const fact of incoming) {
    const prior = byId.get(fact.id);
    if (!prior) { byId.set(fact.id, fact); added.push(fact); continue; }
    const existingValue = stableClubCardsJson([prior.yellowCards, prior.redCards, prior.redSecondYellow, prior.redDirect, prior.canonicalPlayerId]);
    const incomingValue = stableClubCardsJson([fact.yellowCards, fact.redCards, fact.redSecondYellow, fact.redDirect, fact.canonicalPlayerId]);
    if (existingValue !== incomingValue) conflicts.push({ id: fact.id, existing: existingValue, incoming: incomingValue });
    else skipped.push(fact);
  }
  return { added, skipped, conflicts };
}

export function buildClubCardsSnapshot(input: {
  facts: ClubCardFact[];
  cardKind: ClubCardKind;
  dataset: ClubCardsDataset;
  seasonStart: number;
  seasonEnd: number;
  coverage: ClubCardsCoverage[];
  coverageComplete: boolean;
  generatedAt?: string;
  competitionFilter?: string | null;
  conflicts?: string[];
  redTypesDifferentiated?: boolean;
  activeSeasonStatus?: ClubCardsSnapshot['metadata']['activeSeasonStatus'];
  seasonInProgress?: boolean;
  observedFacts?: number;
  observedPages?: number;
}): ClubCardsSnapshot {
  const eligible = input.facts.filter((fact) => fact.scopeEligible && fact.matchType === 'official_competition' && fact.verificationStatus === 'confirmed' && fact.canonicalPlayerId && (cardValue(fact, input.cardKind) ?? 0) > 0);
  const unresolvedIdentityFacts = input.facts.filter((fact) => !fact.canonicalPlayerId || fact.verificationStatus === 'unresolved').map((fact) => fact.id);
  const conflicts = input.conflicts ?? input.facts.filter((fact) => fact.verificationStatus === 'conflict').map((fact) => fact.id);
  const grouped = new Map<string, { playerName: string; value: number; factIds: string[] }>();
  for (const fact of eligible) {
    const value = cardValue(fact, input.cardKind)!; const current = grouped.get(fact.canonicalPlayerId!);
    if (current) { current.value += value; current.factIds.push(fact.id); }
    else grouped.set(fact.canonicalPlayerId!, { playerName: fact.playerNameAtSource, value, factIds: [fact.id] });
  }
  const ordered = [...grouped.entries()].map(([canonicalPlayerId, value]) => ({ canonicalPlayerId, playerName: value.playerName, rawValue: value.value, factIds: value.factIds.sort() })).sort((left, right) => right.rawValue - left.rawValue || left.playerName.localeCompare(right.playerName, 'es') || left.canonicalPlayerId.localeCompare(right.canonicalPlayerId));
  let previousValue: number | null = null; let rank = 0; let tieGroup = 0;
  const ranking = ordered.map((entry, index) => { if (entry.rawValue !== previousValue) { rank = index + 1; tieGroup += 1; previousValue = entry.rawValue; } return { ...entry, rank, tieGroup }; });
  const categorySlug: ClubCardsSnapshot['categorySlug'] = input.cardKind === 'yellow' ? CLUB_YELLOW_CARDS_CATEGORY_SLUG : CLUB_RED_CARDS_CATEGORY_SLUG;
  const payload = { categorySlug, cardKind: input.cardKind, scopeVersion: CLUB_CARDS_SCOPE_VERSION, dataset: input.dataset, seasonStart: input.seasonStart, seasonEnd: input.seasonEnd, competitionFilter: input.competitionFilter ?? null, factIds: input.facts.map((fact) => fact.id).sort(), ranking, coverage: input.coverage, coverageComplete: input.coverageComplete, unresolvedIdentityFacts, conflicts };
  const contentSha256 = sha256(stableClubCardsJson(payload)); const generatedAt = input.generatedAt ?? new Date().toISOString();
  const validFacts = conflicts.length === 0 && unresolvedIdentityFacts.length === 0;
  const candidateStatus = validFacts && (input.coverageComplete || input.activeSeasonStatus === 'provisional_active_season' || input.activeSeasonStatus === 'complete_scope') ? 'candidate' : 'candidate_not_sufficient';
  return { id: `club-cards-${input.cardKind}-snapshot-${contentSha256.slice(0, 32)}`, categorySlug: payload.categorySlug, cardKind: input.cardKind, scopeVersion: CLUB_CARDS_SCOPE_VERSION, dataset: input.dataset, status: 'lab_provisional', seasonStart: input.seasonStart, seasonEnd: input.seasonEnd, competitionFilter: input.competitionFilter ?? null, parentSnapshotId: null, rollbackOf: null, contentSha256, generatedAt, factIds: payload.factIds, ranking, coverage: input.coverage, coverageComplete: input.coverageComplete, unresolvedIdentityFacts, conflicts, metadata: { published: false, candidateStatus, activeSeasonStatus: input.activeSeasonStatus, seasonInProgress: input.seasonInProgress, observedFacts: input.observedFacts ?? input.facts.length, observedPages: input.observedPages, redTypesDifferentiated: input.redTypesDifferentiated ?? false } };
}

export function compareClubCardsRankings(previous: ClubCardsRankingEntry[], next: ClubCardsRankingEntry[]): ClubCardsChange[] {
  const before = new Map(previous.map((entry) => [entry.canonicalPlayerId, entry])); const after = new Map(next.map((entry) => [entry.canonicalPlayerId, entry]));
  return [...new Set([...before.keys(), ...after.keys()])].map((canonicalPlayerId) => { const left = before.get(canonicalPlayerId); const right = after.get(canonicalPlayerId); return { canonicalPlayerId, playerName: right?.playerName ?? left?.playerName ?? canonicalPlayerId, previousValue: left?.rawValue ?? null, nextValue: right?.rawValue ?? null, previousRank: left?.rank ?? null, nextRank: right?.rank ?? null, valueChanged: (left?.rawValue ?? null) !== (right?.rawValue ?? null), positionChanged: (left?.rank ?? null) !== (right?.rank ?? null) }; }).filter((change) => change.valueChanged || change.positionChanged).sort((left, right) => (left.nextRank ?? 999999) - (right.nextRank ?? 999999) || left.canonicalPlayerId.localeCompare(right.canonicalPlayerId));
}

export function rollbackClubCardsSnapshot(input: { target: ClubCardsSnapshot; parentSnapshotId: string | null; reason: string; generatedAt?: string }) {
  return { snapshot: { ...input.target, id: `club-cards-rollback-${sha256(`${input.target.id}|${input.parentSnapshotId}|${input.reason}`).slice(0, 32)}`, status: 'rolled_back' as const, parentSnapshotId: input.parentSnapshotId, rollbackOf: input.target.id, generatedAt: input.generatedAt ?? new Date().toISOString(), metadata: { ...input.target.metadata, published: false as const } } };
}
