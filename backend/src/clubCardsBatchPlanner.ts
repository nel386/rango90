export const CLUB_CARD_COMPETITIONS = [
  { key: 'premier-league', providerId: 39, name: 'Premier League' },
  { key: 'la-liga', providerId: 140, name: 'La Liga' },
  { key: 'serie-a', providerId: 135, name: 'Serie A' },
  { key: 'bundesliga', providerId: 78, name: 'Bundesliga' },
  { key: 'ligue-1', providerId: 61, name: 'Ligue 1' },
  { key: 'primeira-liga', providerId: 94, name: 'Primeira Liga' }
] as const;

export type ClubCardBatchStatus = 'planned' | 'skipped' | 'quota_insufficient' | 'complete' | 'provisional_active_season' | 'partial' | 'failed' | 'provider_unavailable';
export type ClubCardBatch = {
  key: string;
  providerId: number;
  name: string;
  estimatedRequests: number;
  retryBudget: number;
  status: ClubCardBatchStatus;
  reason: string;
  snapshotAction: 'create' | 'preserve' | 'none';
};

export type ClubCardsQuotaPlan = {
  quotaInitial: number;
  quotaReserve: number;
  maxRequests: number;
  estimatedRequests: number;
  reservedRequests: number;
  plannedRequests: number;
  skippedRequests: number;
  batches: ClubCardBatch[];
};

export function estimateClubCardBatchRequests(input: { planRequests?: number; playerPages: number; retryBudget?: number }): number {
  return Math.max(0, Math.floor(input.planRequests ?? 0)) + Math.max(0, Math.floor(input.playerPages)) * (1 + Math.max(0, Math.floor(input.retryBudget ?? 0)));
}

export function planClubCardBatches(input: {
  quotaInitial: number;
  quotaReserve?: number;
  maxRequests?: number;
  batches: Array<{ key: string; providerId: number; name: string; estimatedRequests: number; retryBudget?: number; alreadyUpdated?: boolean }>;
}): ClubCardsQuotaPlan {
  const quotaInitial = Math.max(0, Math.floor(input.quotaInitial));
  const quotaReserve = Math.max(0, Math.floor(input.quotaReserve ?? 0));
  const maxRequests = Math.max(0, Math.floor(input.maxRequests ?? Number.MAX_SAFE_INTEGER));
  const budget = Math.min(maxRequests, Math.max(0, quotaInitial - quotaReserve));
  let used = 0;
  const batches = input.batches.map((candidate) => {
    const estimatedRequests = Math.max(0, Math.floor(candidate.estimatedRequests));
    const retryBudget = Math.max(0, Math.floor(candidate.retryBudget ?? 0));
    if (candidate.alreadyUpdated) return { key: candidate.key, providerId: candidate.providerId, name: candidate.name, estimatedRequests, retryBudget, status: 'skipped' as const, reason: 'La tanda ya está actualizada; se reutiliza su snapshot candidato válido.', snapshotAction: 'preserve' as const };
    if (estimatedRequests > budget - used) return { key: candidate.key, providerId: candidate.providerId, name: candidate.name, estimatedRequests, retryBudget, status: 'quota_insufficient' as const, reason: `La tanda requiere ${estimatedRequests} peticiones reservables y solo quedan ${Math.max(0, budget - used)}.`, snapshotAction: 'preserve' as const };
    used += estimatedRequests;
    return { key: candidate.key, providerId: candidate.providerId, name: candidate.name, estimatedRequests, retryBudget, status: 'planned' as const, reason: 'Presupuesto reservado; la tanda puede comenzar completa.', snapshotAction: 'create' as const };
  });
  return {
    quotaInitial, quotaReserve, maxRequests,
    estimatedRequests: input.batches.reduce((sum, batch) => sum + Math.max(0, Math.floor(batch.estimatedRequests)), 0),
    reservedRequests: used, plannedRequests: used,
    skippedRequests: batches.filter((batch) => batch.status === 'skipped' || batch.status === 'quota_insufficient').reduce((sum, batch) => sum + batch.estimatedRequests, 0),
    batches
  };
}

export function backoffDelayMs(attempt: number, baseMs = 1000, maxMs = 30000): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(maxMs, baseMs * (2 ** safeAttempt));
}

export function classifyClubCardProviderFailure(input: { status?: number; timedOut?: boolean; incomplete?: boolean }): 'rate_limited' | 'timeout' | 'incomplete' | 'temporary' | 'fatal' {
  if (input.status === 429) return 'rate_limited';
  if (input.timedOut) return 'timeout';
  if (input.incomplete) return 'incomplete';
  if (typeof input.status === 'number' && input.status >= 500) return 'temporary';
  if (typeof input.status === 'number' && input.status >= 400) return 'fatal';
  return 'temporary';
}

export function preserveBatchSnapshot(status: ClubCardBatchStatus): boolean {
  return ['quota_insufficient', 'failed', 'provider_unavailable', 'partial', 'skipped'].includes(status);
}
