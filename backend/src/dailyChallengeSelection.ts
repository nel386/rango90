import { createHash } from 'node:crypto';

export type DailyChallengeRankingEntry = {
  snapshotId: string;
  entityId: string;
  rank: number;
  scoreValue: number;
};

export type DailyChallengeCandidate = {
  entityId: string;
  bySnapshot: Map<string, DailyChallengeRankingEntry>;
  selectionKey: string;
};

/**
 * Selects only entities present in every selected ranking. The top-rank band
 * controls deterministic variety, but cannot relax the common-entity rule.
 */
export function selectCommonDailyEntities(
  entries: readonly DailyChallengeRankingEntry[],
  snapshotIds: readonly string[],
  selectionSeed: string,
  candidateRankLimit: number,
  count: number
): DailyChallengeCandidate[] {
  const byEntity = new Map<string, Map<string, DailyChallengeRankingEntry>>();
  for (const entry of entries) {
    const bySnapshot = byEntity.get(entry.entityId) ?? new Map<string, DailyChallengeRankingEntry>();
    if (!bySnapshot.has(entry.snapshotId)) bySnapshot.set(entry.snapshotId, entry);
    byEntity.set(entry.entityId, bySnapshot);
  }
  return [...byEntity.entries()]
    .filter(([, bySnapshot]) =>
      snapshotIds.every((snapshotId) => bySnapshot.has(snapshotId))
      && snapshotIds.some((snapshotId) => (bySnapshot.get(snapshotId)?.rank ?? Number.POSITIVE_INFINITY) <= candidateRankLimit)
    )
    .map(([entityId, bySnapshot]) => ({
      entityId,
      bySnapshot,
      selectionKey: createHash('sha256').update(`${selectionSeed}|${entityId}`).digest('hex')
    }))
    .sort((left, right) => left.selectionKey.localeCompare(right.selectionKey) || left.entityId.localeCompare(right.entityId))
    .slice(0, count);
}
