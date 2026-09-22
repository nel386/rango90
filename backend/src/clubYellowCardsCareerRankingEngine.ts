import { createHash } from 'node:crypto';

export type YellowCardFact = {
  id: string;
  sourcePlayerId: string;
  playerNameOriginal: string;
  canonicalPlayerId: string;
  canonicalName: string;
  clubProviderId: number;
  clubName: string;
  competitionProviderId: number;
  competitionName: string;
  competitionType: 'official_club_competition';
  eligibilityMajorLeagueId: number | null;
  seasonStart: number;
  appearances: number | null;
  minutes: number | null;
  yellowCards: number;
  sourceKey: string;
  sourceUrl: string;
  sourcePage: number;
  locator: string;
  responseSha256: string;
  capturedAt: string;
  sourceType: 'primary' | 'contrast';
  verificationStatus: 'confirmed' | 'unresolved' | 'conflict';
  coverageStatus: 'coverage_complete' | 'coverage_partial';
};

export type YellowRankingType = 'career' | 'active_season' | 'active_players_career';
export type YellowRankingEntry = {
  canonicalPlayerId: string;
  playerName: string;
  rawValue: number;
  rank: number;
  tieGroup: number;
  seasons: number[];
  competitions: number[];
  factIds: string[];
  isCurrentPlayer: boolean;
  coverageStatus: 'coverage_complete' | 'coverage_partial';
  missingSeasons: number[];
};

export type YellowRankingSnapshot = {
  id: string;
  rankingType: YellowRankingType;
  seasonStart: number;
  seasonEnd: number;
  status: 'lab_provisional' | 'draft' | 'rolled_back';
  contentSha256: string;
  generatedAt: string;
  ranking: YellowRankingEntry[];
  metadata: {
    published: false;
    candidateStatus: 'candidate' | 'candidate_not_sufficient';
    activeSeason: number;
    eligiblePlayers: number;
    factsUsed: number;
    source: 'api-football';
    coverageScope: string;
    requestedSeasons: number[];
    controls: Record<string, YellowControlCase>;
  };
};

export type YellowControlCase = {
  requestedName: string;
  matched: boolean;
  careerTotal: number | null;
  activeSeasonTotal: number | null;
  seasonsAvailable: number[];
  missingSeasons: number[];
  competitions: string[];
  careerRank: number | null;
  activeSeasonRank: number | null;
  coverageStatus: 'coverage_complete' | 'coverage_partial' | 'not_found';
};

export const FIVE_MAJOR_LEAGUE_IDS = [39, 140, 135, 78, 61] as const;
export const CONTROL_NAMES = ['Marcos Alonso', 'Raúl García', 'Alberto Lopo', 'Sergio Ramos', 'Sergio Busquets', 'Dani Parejo'] as const;

export function normalizePlayerName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim().replace(/\s+/gu, ' ');
}

export function stableYellowJson(value: unknown): string {
  return JSON.stringify(value, (_key, current) => current && typeof current === 'object' && !Array.isArray(current)
    ? Object.fromEntries(Object.entries(current).sort(([left], [right]) => left.localeCompare(right)))
    : current);
}

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

export function deduplicateYellowFacts(facts: YellowCardFact[]): { facts: YellowCardFact[]; duplicates: number; conflicts: string[] } {
  const byKey = new Map<string, YellowCardFact>();
  const conflicts: string[] = [];
  let duplicates = 0;
  for (const fact of facts) {
    const key = `${fact.sourceKey}|${fact.sourcePlayerId}|${fact.competitionProviderId}|${fact.clubProviderId}|${fact.seasonStart}`;
    const previous = byKey.get(key);
    if (!previous) { byKey.set(key, fact); continue; }
    const left = stableYellowJson([previous.yellowCards, previous.appearances, previous.minutes, previous.competitionName, previous.clubName]);
    const right = stableYellowJson([fact.yellowCards, fact.appearances, fact.minutes, fact.competitionName, fact.clubName]);
    if (left !== right) conflicts.push(key);
    else duplicates += 1;
  }
  return { facts: [...byKey.values()].sort((left, right) => left.id.localeCompare(right.id)), duplicates, conflicts };
}

function eligiblePlayerIds(facts: YellowCardFact[], requestedSeasons: number[]): Set<string> {
  const deduped = deduplicateYellowFacts(facts).facts;
  const byPlayerLeague = new Map<string, Set<number>>();
  for (const fact of deduped) {
    if (fact.verificationStatus !== 'confirmed' || fact.yellowCards < 0) continue;
    if (fact.eligibilityMajorLeagueId === null || !requestedSeasons.includes(fact.seasonStart)) continue;
    const key = `${fact.canonicalPlayerId}|${fact.eligibilityMajorLeagueId}`;
    const seasons = byPlayerLeague.get(key) ?? new Set<number>();
    seasons.add(fact.seasonStart); byPlayerLeague.set(key, seasons);
  }
  return new Set([...byPlayerLeague.entries()].filter(([, seasons]) => seasons.size >= 2).map(([key]) => key.split('|')[0] ?? '').filter((playerId) => playerId.length > 0));
}

function buildEntries(facts: YellowCardFact[], rankingType: YellowRankingType, activeSeason: number, requestedSeasons: number[]): YellowRankingEntry[] {
  const careerEligiblePlayerIds = eligiblePlayerIds(facts, requestedSeasons);
  const eligible = deduplicateYellowFacts(facts).facts.filter((fact) => requestedSeasons.includes(fact.seasonStart) && (rankingType === 'active_season' || careerEligiblePlayerIds.has(fact.canonicalPlayerId)));
  const grouped = new Map<string, { playerName: string; value: number; facts: YellowCardFact[] }>();
  for (const fact of eligible) {
    if (rankingType === 'active_season' && fact.seasonStart !== activeSeason) continue;
    const current = grouped.get(fact.canonicalPlayerId);
    if (current) { current.value += fact.yellowCards; current.facts.push(fact); }
    else grouped.set(fact.canonicalPlayerId, { playerName: fact.canonicalName, value: fact.yellowCards, facts: [fact] });
  }
  const activePlayers = new Set(deduplicateYellowFacts(facts).facts.filter((fact) => fact.seasonStart === activeSeason && (fact.appearances ?? 0) > 0).map((fact) => fact.canonicalPlayerId));
  const rows = [...grouped.entries()].filter(([playerId]) => rankingType !== 'active_players_career' || activePlayers.has(playerId)).map(([canonicalPlayerId, value]) => {
    const seasons = [...new Set(value.facts.map((fact) => fact.seasonStart))].sort((a, b) => a - b);
    const competitions = [...new Set(value.facts.map((fact) => fact.competitionProviderId))].sort((a, b) => a - b);
    const missingSeasons = requestedSeasons.filter((season) => !seasons.includes(season));
    return { canonicalPlayerId, playerName: value.playerName, rawValue: value.value, rank: 0, tieGroup: 0, seasons, competitions, factIds: value.facts.map((fact) => fact.id).sort(), isCurrentPlayer: activePlayers.has(canonicalPlayerId), coverageStatus: missingSeasons.length === 0 ? 'coverage_complete' as const : 'coverage_partial' as const, missingSeasons };
  }).sort((left, right) => right.rawValue - left.rawValue || left.playerName.localeCompare(right.playerName, 'es') || left.canonicalPlayerId.localeCompare(right.canonicalPlayerId));
  let previous: number | null = null; let rank = 0; let tieGroup = 0;
  return rows.map((entry, index) => { if (entry.rawValue !== previous) { rank = index + 1; tieGroup += 1; previous = entry.rawValue; } return { ...entry, rank, tieGroup }; });
}

function findControl(name: string, facts: YellowCardFact[], career: YellowRankingEntry[], active: YellowRankingEntry[], requestedSeasons: number[]): YellowControlCase {
  const target = normalizePlayerName(name);
  const matching = facts.filter((fact) => normalizePlayerName(fact.canonicalName) === target || normalizePlayerName(fact.playerNameOriginal) === target);
  const careerRow = career.find((entry) => matching.some((fact) => fact.canonicalPlayerId === entry.canonicalPlayerId));
  const activeRow = active.find((entry) => matching.some((fact) => fact.canonicalPlayerId === entry.canonicalPlayerId));
  const seasons = [...new Set(matching.map((fact) => fact.seasonStart))].sort((a, b) => a - b);
  const missing = requestedSeasons.filter((season) => !seasons.includes(season));
  return { requestedName: name, matched: matching.length > 0, careerTotal: careerRow?.rawValue ?? null, activeSeasonTotal: activeRow?.rawValue ?? null, seasonsAvailable: seasons, missingSeasons: missing, competitions: [...new Set(matching.map((fact) => fact.competitionName))].sort(), careerRank: careerRow?.rank ?? null, activeSeasonRank: activeRow?.rank ?? null, coverageStatus: matching.length === 0 ? 'not_found' : missing.length === 0 ? 'coverage_complete' : 'coverage_partial' };
}

export function buildYellowCardSnapshots(input: { facts: YellowCardFact[]; activeSeason: number; requestedSeasons: number[]; generatedAt?: string; coverageScope: string }): { snapshots: Record<YellowRankingType, YellowRankingSnapshot>; controls: Record<string, YellowControlCase>; duplicates: number; conflicts: string[] } {
  const normalized = deduplicateYellowFacts(input.facts);
  const career = buildEntries(normalized.facts, 'career', input.activeSeason, input.requestedSeasons);
  const active = buildEntries(normalized.facts, 'active_season', input.activeSeason, input.requestedSeasons);
  const activePlayersCareer = buildEntries(normalized.facts, 'active_players_career', input.activeSeason, input.requestedSeasons);
  const controls = Object.fromEntries(CONTROL_NAMES.map((name) => [name, findControl(name, normalized.facts, career, active, input.requestedSeasons)]));
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const build = (rankingType: YellowRankingType, ranking: YellowRankingEntry[]): YellowRankingSnapshot => {
    const payload = { rankingType, activeSeason: input.activeSeason, requestedSeasons: input.requestedSeasons, ranking, facts: normalized.facts.map((fact) => fact.id).sort() };
    const contentSha256 = sha256(stableYellowJson(payload));
    return { id: `club-yellow-cards-${rankingType}-${contentSha256.slice(0, 32)}`, rankingType, seasonStart: Math.min(...input.requestedSeasons), seasonEnd: Math.max(...input.requestedSeasons), status: 'lab_provisional', contentSha256, generatedAt, ranking, metadata: { published: false, candidateStatus: 'candidate_not_sufficient', activeSeason: input.activeSeason, eligiblePlayers: new Set(ranking.map((entry) => entry.canonicalPlayerId)).size, factsUsed: normalized.facts.length, source: 'api-football', coverageScope: input.coverageScope, requestedSeasons: input.requestedSeasons, controls } };
  };
  return { snapshots: { career: build('career', career), active_season: build('active_season', active), active_players_career: build('active_players_career', activePlayersCareer) }, controls, duplicates: normalized.duplicates, conflicts: normalized.conflicts };
}

export function rollbackYellowSnapshot(snapshot: YellowRankingSnapshot, reason: string): YellowRankingSnapshot {
  const id = `club-yellow-cards-rollback-${sha256(`${snapshot.id}|${reason}`).slice(0, 32)}`;
  return { ...snapshot, id, status: 'rolled_back', generatedAt: new Date().toISOString(), metadata: { ...snapshot.metadata, published: false } };
}
