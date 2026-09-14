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

function intersect(left: ReadonlySet<string>, right: ReadonlySet<string>): Set<string> {
  const smaller = left.size <= right.size ? left : right;
  const larger = left.size <= right.size ? right : left;
  return new Set([...smaller].filter((value) => larger.has(value)));
}

/**
 * Finds seven-category player matrices without padding or reusing a player
 * that is absent from any selected snapshot. The candidate band mirrors the
 * daily selector's stronger top-90 requirement.
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
    selected: SevenBySevenCategory[],
    commonTop200: Set<string> | null,
    commonCandidateBand: Set<string> | null
  ): void {
    if (selected.length === requiredCategoryCount) {
      const top200 = commonTop200 ?? new Set<string>();
      const candidateBand = commonCandidateBand ?? new Set<string>();
      if (top200.size < requiredCommonEntityCount || candidateBand.size < requiredCommonEntityCount) return;
      matchingCombinationCount += 1;
      if (matches.length < maxReturnedMatches) {
        matches.push({
          categories: selected.map((category) => category.slug),
          commonTop200Count: top200.size,
          commonCandidateBandCount: candidateBand.size,
          commonCandidateBandEntityIds: [...candidateBand].sort()
        });
      }
      return;
    }

    const remaining = requiredCategoryCount - selected.length;
    if (ordered.length - startIndex < remaining) return;

    for (let index = startIndex; index <= ordered.length - remaining; index += 1) {
      const category = ordered[index];
      if (!category) continue;
      const nextTop200 = commonTop200 ? intersect(commonTop200, category.top200EntityIds) : new Set(category.top200EntityIds);
      const nextCandidateBand = commonCandidateBand
        ? intersect(commonCandidateBand, category.candidateBandEntityIds)
        : new Set(category.candidateBandEntityIds);

      // Intersections only shrink, so no later category can recover a failed
      // minimum. This also keeps the audit bounded when the catalogue grows.
      if (nextTop200.size < requiredCommonEntityCount || nextCandidateBand.size < requiredCommonEntityCount) continue;
      visit(index + 1, [...selected, category], nextTop200, nextCandidateBand);
    }
  }

  visit(0, [], null, null);
  return { categoryCount: ordered.length, matchingCombinationCount, matches };
}
