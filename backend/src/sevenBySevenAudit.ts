export type SevenBySevenCategory = {
  slug: string;
  snapshotId: string;
  top200EntityIds: ReadonlySet<string>;
  candidateBandEntityIds: ReadonlySet<string>;
};

export type SevenBySevenMatch = {
  categories: string[];
  commonTop200Count: number;
  commonCandidateBandCount: number;
  commonCandidateBandEntityIds: string[];
};

export type SevenBySevenAuditResult = {
  categoryCount: number;
  matchingCombinationCount: number;
  matches: SevenBySevenMatch[];
};

function canMatch(categories: readonly SevenBySevenCategory[], band: 'top200EntityIds' | 'candidateBandEntityIds'): string[] | null {
  const matchedByEntity = new Map<string, number>();
  const ordered = [...categories].sort((left, right) => left[band].size - right[band].size || left.slug.localeCompare(right.slug));
  const visit = (categoryIndex: number, seen: Set<string>): boolean => {
    const category = ordered[categoryIndex];
    if (!category) return true;
    for (const entityId of category[band]) {
      if (seen.has(entityId)) continue;
      seen.add(entityId);
      const previousCategory = matchedByEntity.get(entityId);
      if (previousCategory === undefined || visit(previousCategory, seen)) {
        matchedByEntity.set(entityId, categoryIndex);
        return true;
      }
    }
    return false;
  };
  for (let index = 0; index < ordered.length; index += 1) {
    if (!visit(index, new Set())) return null;
  }
  return [...matchedByEntity.keys()].sort();
}

/**
 * Finds category combinations with a valid one-to-one assignment. Categories
 * are intentionally independent: a player does not need to appear in every
 * ranking. This is the same rule used by the daily materializer.
 */
export function auditSevenBySeven(
  categories: readonly SevenBySevenCategory[],
  requiredCategoryCount = 7,
  requiredCommonEntityCount = 7,
  candidateRankLimit = 90,
  maxReturnedMatches = 20
): SevenBySevenAuditResult {
  if (requiredCategoryCount < 1 || requiredCommonEntityCount < 1 || candidateRankLimit < 1 || maxReturnedMatches < 1) {
    throw new Error('Los límites de auditoría 7×7 deben ser positivos');
  }

  const ordered = [...categories].sort((left, right) => left.slug.localeCompare(right.slug));
  const matches: SevenBySevenMatch[] = [];
  let matchingCombinationCount = 0;

  function visit(
    startIndex: number,
    selected: SevenBySevenCategory[]
  ): void {
    if (selected.length === requiredCategoryCount) {
      const top200Ids = canMatch(selected, 'top200EntityIds');
      const candidateBandIds = canMatch(selected, 'candidateBandEntityIds');
      if (!top200Ids || !candidateBandIds || candidateBandIds.length < requiredCommonEntityCount) return;
      matchingCombinationCount += 1;
      if (matches.length < maxReturnedMatches) {
        matches.push({
          categories: selected.map((category) => category.slug),
          commonTop200Count: top200Ids.length,
          commonCandidateBandCount: candidateBandIds.length,
          commonCandidateBandEntityIds: candidateBandIds
        });
      }
      return;
    }

    const remaining = requiredCategoryCount - selected.length;
    if (ordered.length - startIndex < remaining) return;

    for (let index = startIndex; index <= ordered.length - remaining; index += 1) {
      const category = ordered[index];
      if (!category) continue;
      const nextSelected = [...selected, category];
      if (nextSelected.every((item) => item.candidateBandEntityIds.size >= requiredCommonEntityCount)) {
        visit(index + 1, nextSelected);
      }
    }
  }

  visit(0, []);
  return { categoryCount: ordered.length, matchingCombinationCount, matches };
}
