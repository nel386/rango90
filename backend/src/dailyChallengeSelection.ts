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
 * Selects one entity from one category's ranking. Categories are deliberately
 * independent: an entity does not have to occur in any of the other rankings.
 * The game materializer assigns the score cap when this entity is absent from
 * another compatible category.
 */
export function selectDailyCategoryEntity(
  entries: readonly DailyChallengeRankingEntry[],
  snapshotId: string,
  selectionSeed: string,
  candidateRankLimit: number,
  excludedEntityIds: ReadonlySet<string> = new Set()
): DailyChallengeCandidate | null {
  const byEntity = new Map<string, Map<string, DailyChallengeRankingEntry>>();
  for (const entry of entries) {
    const bySnapshot = byEntity.get(entry.entityId) ?? new Map<string, DailyChallengeRankingEntry>();
    if (!bySnapshot.has(entry.snapshotId)) bySnapshot.set(entry.snapshotId, entry);
    byEntity.set(entry.entityId, bySnapshot);
  }
  return [...byEntity.entries()]
    .filter(([entityId, bySnapshot]) =>
      !excludedEntityIds.has(entityId)
      && (bySnapshot.get(snapshotId)?.rank ?? Number.POSITIVE_INFINITY) <= candidateRankLimit
    )
    .map(([entityId, bySnapshot]) => ({
      entityId,
      bySnapshot,
      selectionKey: createHash('sha256').update(`${selectionSeed}|${snapshotId}|${entityId}`).digest('hex')
    }))
    .sort((left, right) => left.selectionKey.localeCompare(right.selectionKey) || left.entityId.localeCompare(right.entityId))
    [0] ?? null;
}
