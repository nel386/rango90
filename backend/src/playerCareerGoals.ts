/**
 * Rules for the global career-goals category.
 *
 * This module deliberately keeps an absent component as `null`. A provisional
 * ranking may expose the observed lower bound, but its evidence must say which
 * component is unknown. The value must never be presented as a completed
 * club+senior-national-team career total.
 */

export type PlayerCareerGoalsDbRow = {
  entity_id: string;
  canonical_name: string;
  club_goals: string | null;
  national_goals: string | null;
  club_source_snapshots: string[] | null;
  national_source_snapshots: string[] | null;
  national_source_entities: string | number | null;
  national_min_goals: string | number | null;
  national_max_goals: string | number | null;
};

export type PlayerCareerGoalsEntry = {
  entityId: string;
  name: string;
  observedGoals: number;
  clubGoals: number | null;
  nationalTeamGoals: number | null;
  unknownComponents: Array<'clubs' | 'senior_national_team'>;
  sourceSnapshotIds: string[];
  evidence: Record<string, unknown>;
};

export type PlayerCareerGoalsAudit = {
  sourceRows: number;
  outputRows: number;
  completeComponentRows: number;
  rowsWithUnknownClubComponent: number;
  rowsWithUnknownNationalTeamComponent: number;
  identityConflictRows: number;
  excludedEmptyRows: number;
  selectionBasis: 'observed_lower_bound';
  coverageComplete: false;
  warning: string;
};

export type PlayerCareerGoalsBuild = {
  entries: PlayerCareerGoalsEntry[];
  audit: PlayerCareerGoalsAudit;
};

function nullableNonNegativeInteger(value: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`player-career-goals: componente inválido: ${String(value)}`);
  }
  return parsed;
}

function sourceSnapshotIds(...groups: Array<string[] | null | undefined>): string[] {
  return [...new Set(groups.flatMap((group) => group ?? []).filter((id) => id.length > 0))].sort();
}

/**
 * Builds a deterministic draft ranking from separately observed components.
 * The caller may use `observedGoals` as the ranking value only because the
 * snapshot is explicitly partial and carries `unknownComponents` evidence.
 */
export function buildPlayerCareerGoalsRanking(rows: PlayerCareerGoalsDbRow[], topN = 200): PlayerCareerGoalsBuild {
  if (!Number.isInteger(topN) || topN < 1) throw new Error('player-career-goals: topN inválido');

  let completeComponentRows = 0;
  let rowsWithUnknownClubComponent = 0;
  let rowsWithUnknownNationalTeamComponent = 0;
  let identityConflictRows = 0;
  let excludedEmptyRows = 0;
  const candidates: PlayerCareerGoalsEntry[] = [];

  for (const row of rows) {
    const clubGoals = nullableNonNegativeInteger(row.club_goals);
    const nationalTeamGoals = nullableNonNegativeInteger(row.national_goals);
    const identityConflict = row.national_min_goals !== null
      && row.national_max_goals !== null
      && nullableNonNegativeInteger(row.national_min_goals) !== nullableNonNegativeInteger(row.national_max_goals);
    if (identityConflict) {
      identityConflictRows += 1;
      continue;
    }

    const unknownComponents: PlayerCareerGoalsEntry['unknownComponents'] = [];
    if (clubGoals === null) {
      unknownComponents.push('clubs');
      rowsWithUnknownClubComponent += 1;
    }
    if (nationalTeamGoals === null) {
      unknownComponents.push('senior_national_team');
      rowsWithUnknownNationalTeamComponent += 1;
    }

    const observedGoals = (clubGoals ?? 0) + (nationalTeamGoals ?? 0);
    if (observedGoals === 0) {
      excludedEmptyRows += 1;
      continue;
    }
    if (unknownComponents.length === 0) completeComponentRows += 1;

    candidates.push({
      entityId: row.entity_id,
      name: row.canonical_name,
      observedGoals,
      clubGoals,
      nationalTeamGoals,
      unknownComponents,
      sourceSnapshotIds: sourceSnapshotIds(row.club_source_snapshots, row.national_source_snapshots),
      evidence: {
        clubGoals,
        nationalTeamGoals,
        unknownComponents,
        knownComponents: unknownComponents.length === 0 ? ['clubs', 'senior_national_team'] : [
          ...(clubGoals !== null ? ['clubs'] : []),
          ...(nationalTeamGoals !== null ? ['senior_national_team'] : [])
        ],
        totalKind: unknownComponents.length === 0 ? 'observed_components' : 'observed_lower_bound',
        sourceSnapshotIds: sourceSnapshotIds(row.club_source_snapshots, row.national_source_snapshots),
        nationalSourceEntities: row.national_source_entities === null ? null : Number(row.national_source_entities),
        definition: 'Goles observados de clubes + selección absoluta. Si un componente no está disponible, observedGoals es solo un límite inferior y no un total completo de carrera.',
        noUnknownComponentImputation: true
      }
    });
  }

  candidates.sort((left, right) => right.observedGoals - left.observedGoals || left.name.localeCompare(right.name, 'es') || left.entityId.localeCompare(right.entityId));
  const entries = candidates.slice(0, topN);
  return {
    entries,
    audit: {
      sourceRows: rows.length,
      outputRows: entries.length,
      completeComponentRows,
      rowsWithUnknownClubComponent,
      rowsWithUnknownNationalTeamComponent,
      identityConflictRows,
      excludedEmptyRows,
      selectionBasis: 'observed_lower_bound',
      coverageComplete: false,
      warning: 'La clasificación no demuestra una carrera completa: conserva explícitamente los componentes desconocidos y ordena por el mínimo observado.'
    }
  };
}
