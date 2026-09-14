export interface RankingValue {
  entityId: string;
  rawValue: number;
  evidence?: Record<string, unknown>;
}

export interface RankingEntry extends RankingValue {
  rank: number;
  scoreValue: number;
  tieGroup: number;
}

export interface RankingOptions {
  direction: 'desc' | 'asc';
  scoreCap: number;
}

export function buildRanking(values: RankingValue[], options: RankingOptions): RankingEntry[] {
  const unique = new Map<string, RankingValue>();
  for (const value of values) {
    if (!Number.isFinite(value.rawValue) || value.rawValue < 0) {
      throw new Error(`Valor inválido para ${value.entityId}`);
    }
    if (unique.has(value.entityId)) {
      throw new Error(`Entidad duplicada en ranking: ${value.entityId}`);
    }
    unique.set(value.entityId, value);
  }

  const sorted = [...unique.values()].sort((a, b) => {
    const difference = options.direction === 'desc' ? b.rawValue - a.rawValue : a.rawValue - b.rawValue;
    return difference !== 0 ? difference : a.entityId.localeCompare(b.entityId);
  });

  let previousValue: number | undefined;
  let currentRank = 0;
  let tieGroup = 0;
  return sorted.map((value, index) => {
    if (previousValue === undefined || value.rawValue !== previousValue) {
      currentRank = index + 1;
      tieGroup += 1;
      previousValue = value.rawValue;
    }
    return {
      ...value,
      rank: currentRank,
      scoreValue: Math.min(currentRank, options.scoreCap),
      tieGroup
    };
  });
}

export function selectTopRankPositions(entries: RankingEntry[], maxRank = 100): RankingEntry[] {
  return entries.filter((entry) => entry.rank <= maxRank);
}
