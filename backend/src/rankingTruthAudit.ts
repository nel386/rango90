import { createHash } from 'node:crypto';

export type EditorialStatus = 'candidate' | 'provisional' | 'approved' | 'retired';
export type AuditSeverity = 'blocking' | 'warning' | 'info';
export type AuditEntityType = 'player' | 'club' | 'national_team';

export type AuditCategoryInput = {
  slug: string;
  labelEs: string;
  labelEn: string;
  definition: string;
  entityType: AuditEntityType;
  metricKey: string;
  scopeKind: string;
  scope: Record<string, unknown>;
  categoryStatus: string;
  snapshotId: string | null;
  snapshotStatus: string | null;
  dataVersion: string | null;
  algorithmVersion: string | null;
  contentSha256: string | null;
  generatedAt: string | null;
  coverageComplete: boolean | null;
  unresolvedConflicts: number | null;
  eligibleCount: number | null;
  scoreCap: number | null;
  snapshotRowsTotal: number;
  sourceSnapshotId: string | null;
  sourceKey: string | null;
  sourceName: string | null;
  sourceBaseUrl: string | null;
  sourceRightsStatus: string | null;
  sourceRetrievedAt: string | null;
  sourcePublishedAt: string | null;
  sourceStorageUri: string | null;
  sourceContentSha256: string | null;
  sourceMetadata: Record<string, unknown>;
  snapshotMetadata: Record<string, unknown>;
  rankingDirection: 'asc' | 'desc';
};

export type AuditEntryInput = {
  categorySlug: string;
  snapshotId: string;
  sourceEntityId: string;
  sourceName: string;
  sourceEntityType: AuditEntityType;
  canonicalEntityId: string | null;
  canonicalName: string | null;
  canonicalEntityType: AuditEntityType | null;
  rawValue: number;
  rank: number;
  scoreValue: number;
  tieGroup: number;
  evidence: Record<string, unknown>;
  playable: boolean;
  catalogStatus: string | null;
  externalIds: Array<{ sourceKey: string; entityType: AuditEntityType; externalId: string; entityId: string }>;
  aliases: Array<{ alias: string; sourceKey: string | null }>;
  media: Array<{
    id: string;
    reviewStatus: string;
    isPrimary: boolean;
    provider: string;
    rightsEvidenceUrl: string | null;
    rightsVerifiedAt: string | null;
    metadata: Record<string, unknown>;
  }>;
};

export type RankingTruthAnomaly = {
  code: string;
  severity: AuditSeverity;
  message: string;
  entityIds?: string[];
  details?: Record<string, unknown>;
};

export type RankingTruthCategoryReport = {
  slug: string;
  definition: {
    labelEs: string;
    labelEn: string;
    description: string;
    entityType: AuditEntityType;
    metricKey: string;
    scopeKind: string;
    declaredScope: Record<string, unknown>;
    labelClaimsGlobal: boolean;
    labelHonestForObservedScope: boolean;
  };
  editorialStatus: EditorialStatus;
  snapshots: {
    ranking: {
      id: string | null;
      status: string | null;
      dataVersion: string | null;
      algorithmVersion: string | null;
      contentSha256: string | null;
      generatedAt: string | null;
    };
    source: {
      id: string | null;
      key: string | null;
      name: string | null;
      evidenceUrls: string[];
      storageUri: string | null;
      contentSha256: string | null;
      retrievedAt: string | null;
      sourcePublishedAt: string | null;
    };
  };
  observedScope: {
    temporalWindow: Record<string, unknown>;
    scope: Record<string, unknown>;
    coverageComplete: boolean | null;
    coverageCompatibleWithLabel: boolean;
  };
  counts: {
    rowsAudited: number;
    snapshotRowsTotal: number;
    uniqueSourceEntities: number;
    uniqueCanonicalEntities: number;
    rowsWithZeroOrNegativeValue: number;
    duplicateCanonicalEntries: number;
    conflictingIdentityRows: number;
    rowsOutsideTop20: number;
    playableRows: number;
    playableTop200: number;
    mediaLicensed: number;
    mediaFallbackOrUnavailable: number;
    mediaPending: number;
  };
  rankingChecks: {
    positiveValuesOnly: boolean;
    deterministicRanks: boolean;
    deterministicScores: boolean;
    duplicateCanonicalEntities: boolean;
    tiedPositions: Array<{ tieGroup: number; rank: number; count: number; value: number }>;
  };
  rights: {
    sourceStatus: string | null;
    sourceRightsApproved: boolean;
    visualAssetStatus: 'licensed' | 'fallback' | 'pending' | 'unavailable' | 'mixed';
  };
  top20: Array<{
    entityId: string;
    sourceEntityId: string;
    sourceName: string;
    canonicalName: string;
    value: number;
    rank: number;
    score: number;
    tieGroup: number;
    identityStatus: 'canonical' | 'resolved' | 'missing' | 'conflict';
    playable: boolean;
    mediaStatus: 'licensed' | 'fallback' | 'pending' | 'unavailable';
    evidenceUrls: string[];
  }>;
  anomalies: RankingTruthAnomaly[];
};

export type RankingTruthAuditReport = {
  reportVersion: '1';
  artifactKind: 'audit_report';
  readOnly: true;
  productionData: false;
  editorialApproval: false;
  generatedAt: string | null;
  selectedCategories: string[];
  categories: RankingTruthCategoryReport[];
  anomalies: Array<RankingTruthAnomaly & { categorySlug: string }>;
  recommendations: Array<{
    slug: string;
    editorialStatus: EditorialStatus;
    recommendation: 'stabilize_first' | 'repair_before_stabilizing' | 'retire_or_redefine' | 'keep_as_candidate';
    reasons: string[];
  }>;
  priorityCandidates: string[];
  dataFingerprint: {
    version: '1';
    watermark: string | null;
    snapshots: Array<{
      categorySlug: string;
      rankingSnapshotId: string | null;
      rankingContentSha256: string | null;
      dataVersion: string | null;
      algorithmVersion: string | null;
      sourceSnapshotId: string | null;
      sourceContentSha256: string | null;
    }>;
    sha256: string;
  };
  hashes: {
    jsonSha256: string;
    markdownSha256: string;
    csvSha256: string;
  };
};

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right));
}

function urlsFromEvidence(evidence: Record<string, unknown>): string[] {
  const urls: string[] = [];
  for (const key of ['sourceUrl', 'sourceURL', 'url', 'evidenceUrl', 'evidenceURL']) {
    const value = stringValue(evidence[key]);
    if (value?.startsWith('http')) urls.push(value);
  }
  for (const key of ['sourceUrls', 'evidenceUrls', 'urls']) {
    const value = evidence[key];
    if (Array.isArray(value)) {
      urls.push(...value.filter((item): item is string => typeof item === 'string' && item.startsWith('http')));
    }
  }
  return uniqueStrings(urls);
}

function temporalWindow(category: AuditCategoryInput): Record<string, unknown> {
  const source = category.sourceMetadata;
  const scope = category.scope;
  const result: Record<string, unknown> = {};
  const keys = [
    'window', 'temporalWindow', 'era', 'startDate', 'endDate', 'startSeason', 'endSeason',
    'minSeason', 'maxSeason', 'minYear', 'maxYear', 'season', 'seasons', 'period'
  ];
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
    else if (scope[key] !== undefined) result[key] = scope[key];
  }
  if (Object.keys(result).length === 0) result.declaredByCategory = category.scopeKind;
  return result;
}

function hasSpecificTemporalWindow(window: Record<string, unknown>): boolean {
  return Object.keys(window).some((key) => key !== 'declaredByCategory');
}

function labelClaimsGlobal(category: AuditCategoryInput): boolean {
  return /\b(global|globales|globales|all[- ]?time|career|carrera|históric|historical)\b/i.test(
    `${category.labelEs} ${category.labelEn} ${category.slug}`
  );
}

function mediaStatus(media: AuditEntryInput['media']): 'licensed' | 'fallback' | 'pending' | 'unavailable' {
  const approved = media.find((asset) => asset.reviewStatus === 'approved' && asset.rightsEvidenceUrl && asset.rightsVerifiedAt);
  if (approved) return 'licensed';
  if (media.some((asset) => asset.reviewStatus === 'pending')) return 'pending';
  if (media.some((asset) => asset.reviewStatus === 'rejected')) return 'unavailable';
  return 'fallback';
}

function categoryMediaStatus(entries: AuditEntryInput[]): RankingTruthCategoryReport['rights']['visualAssetStatus'] {
  const statuses = new Set(entries.slice(0, 20).map((entry) => mediaStatus(entry.media)));
  if (statuses.size === 0) return 'unavailable';
  if (statuses.size === 1) return [...statuses][0] as RankingTruthCategoryReport['rights']['visualAssetStatus'];
  return 'mixed';
}

function isGlobalScopeCompatible(category: AuditCategoryInput): boolean {
  const source = category.sourceMetadata;
  const scope = category.scope;
  const partial = [source.coverageComplete, source.partial, scope.coverageComplete, scope.partial]
    .some((value) => value === false);
  const unknownComponents = source.unknownComponents;
  return category.coverageComplete === true && !partial && !(Array.isArray(unknownComponents) && unknownComponents.length > 0);
}

function expectedRankAndTie(entries: AuditEntryInput[], direction: 'asc' | 'desc'): Map<string, { rank: number; tieGroup: number }> {
  const sorted = [...entries].sort((left, right) => {
    const valueOrder = direction === 'desc' ? right.rawValue - left.rawValue : left.rawValue - right.rawValue;
    return valueOrder || left.sourceEntityId.localeCompare(right.sourceEntityId);
  });
  const result = new Map<string, { rank: number; tieGroup: number }>();
  let previousValue: number | undefined;
  let rank = 0;
  let tieGroup = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index];
    if (!entry) continue;
    if (previousValue === undefined || entry.rawValue !== previousValue) {
      rank = index + 1;
      tieGroup += 1;
      previousValue = entry.rawValue;
    }
    result.set(entry.sourceEntityId, { rank, tieGroup });
  }
  return result;
}

function resolveIdentityStatus(entry: AuditEntryInput): 'canonical' | 'resolved' | 'missing' | 'conflict' {
  if (!entry.canonicalEntityId) return 'missing';
  if (entry.canonicalEntityId === entry.sourceEntityId) return 'canonical';
  if (entry.canonicalEntityType !== entry.sourceEntityType) return 'conflict';
  return 'resolved';
}

function makeAnomaly(code: string, severity: AuditSeverity, message: string, details?: Record<string, unknown>, entityIds?: string[]): RankingTruthAnomaly {
  return { code, severity, message, ...(entityIds?.length ? { entityIds: [...entityIds].sort() } : {}), ...(details ? { details } : {}) };
}

function evidenceUrls(category: AuditCategoryInput, entry: AuditEntryInput): string[] {
  return uniqueStrings([
    category.sourceBaseUrl,
    stringValue(category.sourceMetadata.sourceUrl),
    stringValue(category.sourceMetadata.url),
    ...urlsFromEvidence(entry.evidence)
  ]);
}

export function auditRankingCategory(category: AuditCategoryInput, rawEntries: AuditEntryInput[]): RankingTruthCategoryReport {
  const entries = rawEntries
    .filter((entry) => entry.snapshotId === category.snapshotId && entry.categorySlug === category.slug)
    .sort((left, right) => left.rank - right.rank || left.sourceEntityId.localeCompare(right.sourceEntityId));
  const top20 = entries.slice(0, 20);
  const resolvedEntities = entries.filter((entry) => entry.canonicalEntityId).map((entry) => entry.canonicalEntityId as string);
  const canonicalCounts = new Map<string, number>();
  for (const entityId of resolvedEntities) canonicalCounts.set(entityId, (canonicalCounts.get(entityId) ?? 0) + 1);
  const duplicateCanonicalEntities = [...canonicalCounts.entries()].filter(([, count]) => count > 1);
  const expected = expectedRankAndTie(entries, category.rankingDirection);
  const tiedPositions = [...new Map<number, { rank: number; tieGroup: number; value: number; count: number }>(
    entries.map((entry) => [entry.tieGroup, { rank: entry.rank, tieGroup: entry.tieGroup, value: entry.rawValue, count: 0 }])
  ).values()];
  for (const tie of tiedPositions) tie.count = entries.filter((entry) => entry.tieGroup === tie.tieGroup).length;
  const actualTies = tiedPositions.filter((tie) => tie.count > 1).sort((left, right) => left.tieGroup - right.tieGroup);
  const anomalies: RankingTruthAnomaly[] = [];
  if (!category.snapshotId) anomalies.push(makeAnomaly('missing_snapshot', 'warning', 'La categoría no tiene un snapshot de ranking seleccionable.'));
  const nonPositive = entries.filter((entry) => entry.rawValue <= 0);
  if (nonPositive.length) anomalies.push(makeAnomaly('non_positive_values', 'blocking', 'Hay filas con valor cero o negativo.', { count: nonPositive.length }, nonPositive.map((entry) => entry.sourceEntityId)));
  if (duplicateCanonicalEntities.length) anomalies.push(makeAnomaly('duplicate_canonical_entries', 'blocking', 'Más de una fila del snapshot resuelve a la misma entidad canónica.', { count: duplicateCanonicalEntities.length }, duplicateCanonicalEntities.map(([id]) => id)));
  const conflictingIdentity = entries.filter((entry) => resolveIdentityStatus(entry) === 'conflict');
  if (conflictingIdentity.length) anomalies.push(makeAnomaly('identity_conflicts', 'blocking', 'Hay identidades resueltas con tipo incompatible.', { count: conflictingIdentity.length }, conflictingIdentity.map((entry) => entry.sourceEntityId)));
  const missingIdentity = entries.filter((entry) => resolveIdentityStatus(entry) === 'missing');
  if (missingIdentity.length) anomalies.push(makeAnomaly('missing_identity', 'blocking', 'Hay filas sin entidad canónica trazable.', { count: missingIdentity.length }, missingIdentity.map((entry) => entry.sourceEntityId)));
  const rankMismatches = entries.filter((entry) => expected.get(entry.sourceEntityId)?.rank !== entry.rank);
  if (rankMismatches.length) anomalies.push(makeAnomaly('rank_mismatch', 'blocking', 'Las posiciones no coinciden con el orden determinista del valor bruto.', { count: rankMismatches.length }, rankMismatches.map((entry) => entry.sourceEntityId)));
  const tieMismatches = entries.filter((entry) => expected.get(entry.sourceEntityId)?.tieGroup !== entry.tieGroup);
  if (tieMismatches.length) anomalies.push(makeAnomaly('tie_group_mismatch', 'blocking', 'Los grupos de empate no coinciden con el valor bruto.', { count: tieMismatches.length }, tieMismatches.map((entry) => entry.sourceEntityId)));
  const scoreMismatches = category.scoreCap === null ? [] : entries.filter((entry) => entry.scoreValue !== Math.min(entry.rank, category.scoreCap as number));
  if (scoreMismatches.length) anomalies.push(makeAnomaly('score_mismatch', 'blocking', 'Los scores no coinciden con min(rank, scoreCap).', { count: scoreMismatches.length }, scoreMismatches.map((entry) => entry.sourceEntityId)));
  if (category.snapshotId && category.sourceSnapshotId === null) anomalies.push(makeAnomaly('source_snapshot_missing', 'blocking', 'El ranking no referencia un snapshot de fuente.', undefined));
  if (category.snapshotId && category.sourceSnapshotId && entries.some((entry) => stringValue(entry.evidence.sourceSnapshotId) && entry.evidence.sourceSnapshotId !== category.sourceSnapshotId)) {
    anomalies.push(makeAnomaly('source_snapshot_mismatch', 'blocking', 'La evidencia de alguna fila apunta a otro snapshot de fuente.'));
  }
  if (category.coverageComplete === false) anomalies.push(makeAnomaly('coverage_incomplete', 'blocking', 'El snapshot declara cobertura incompleta.'));
  if (category.eligibleCount !== null && category.eligibleCount === 200 && category.coverageComplete === false) anomalies.push(makeAnomaly('declared_200_incomplete', 'warning', 'Declara 200 filas elegibles pero cobertura incompleta; 200 filas no demuestran un top histórico completo.'));
  const window = temporalWindow(category);
  if (!hasSpecificTemporalWindow(window)) anomalies.push(makeAnomaly('temporal_window_not_declared', 'warning', 'No hay una ventana temporal concreta en los metadatos de fuente o en el alcance de la categoría.'));
  const labelClaims = labelClaimsGlobal(category);
  const coverageCompatible = !labelClaims || isGlobalScopeCompatible(category);
  if (!coverageCompatible) anomalies.push(makeAnomaly('global_label_overclaims_scope', 'blocking', 'La etiqueta promete un alcance global/histórico/carrera que la cobertura observada no respalda.'));
  if (category.sourceRightsStatus !== 'approved') anomalies.push(makeAnomaly('source_rights_not_approved', 'warning', 'La fuente no tiene derechos aprobados para redistribución.', { status: category.sourceRightsStatus ?? 'missing' }));
  const topWithoutMedia = top20.filter((entry) => mediaStatus(entry.media) !== 'licensed');
  if (topWithoutMedia.length) anomalies.push(makeAnomaly('top20_visual_assets_not_licensed', 'warning', 'Hay elementos del top 20 sin asset visual licenciado y aprobado.', { count: topWithoutMedia.length }, topWithoutMedia.map((entry) => entry.canonicalEntityId ?? entry.sourceEntityId)));
  const sourceExternalConflicts = new Map<string, Set<string>>();
  for (const entry of entries) for (const external of entry.externalIds) {
    const key = `${external.sourceKey}/${external.entityType}/${external.externalId}`;
    const ids = sourceExternalConflicts.get(key) ?? new Set<string>();
    ids.add(external.entityId);
    sourceExternalConflicts.set(key, ids);
  }
  const ambiguousExternalIds = [...sourceExternalConflicts.entries()].filter(([, ids]) => ids.size > 1);
  if (ambiguousExternalIds.length) anomalies.push(makeAnomaly('ambiguous_external_ids', 'blocking', 'Un mismo ID externo se asigna a varias entidades.', { count: ambiguousExternalIds.length, keys: ambiguousExternalIds.map(([key]) => key) }));
  const editorialStatus: EditorialStatus = category.categoryStatus === 'retired' || category.snapshotStatus === 'superseded'
    ? 'retired'
    : !category.snapshotId || entries.length === 0
      ? 'candidate'
      : category.categoryStatus === 'approved' && ['approved', 'published'].includes(category.snapshotStatus ?? '') && category.coverageComplete === true && category.unresolvedConflicts === 0 && anomalies.every((anomaly) => anomaly.severity !== 'blocking')
        ? 'approved'
        : 'provisional';
  const mediaCounts = { licensed: 0, fallback: 0, pending: 0, unavailable: 0 };
  for (const entry of top20) mediaCounts[mediaStatus(entry.media)] += 1;
  return {
    slug: category.slug,
    definition: {
      labelEs: category.labelEs,
      labelEn: category.labelEn,
      description: category.definition,
      entityType: category.entityType,
      metricKey: category.metricKey,
      scopeKind: category.scopeKind,
      declaredScope: category.scope,
      labelClaimsGlobal: labelClaims,
      labelHonestForObservedScope: coverageCompatible
    },
    editorialStatus,
    snapshots: {
      ranking: { id: category.snapshotId, status: category.snapshotStatus, dataVersion: category.dataVersion, algorithmVersion: category.algorithmVersion, contentSha256: category.contentSha256, generatedAt: category.generatedAt },
      source: {
        id: category.sourceSnapshotId,
        key: category.sourceKey,
        name: category.sourceName,
        evidenceUrls: uniqueStrings([category.sourceBaseUrl, stringValue(category.sourceMetadata.sourceUrl), stringValue(category.sourceMetadata.url)]),
        storageUri: category.sourceStorageUri,
        contentSha256: category.sourceContentSha256,
        retrievedAt: category.sourceRetrievedAt,
        sourcePublishedAt: category.sourcePublishedAt
      }
    },
    observedScope: {
      temporalWindow: window,
      scope: category.scope,
      coverageComplete: category.coverageComplete,
      coverageCompatibleWithLabel: coverageCompatible
    },
    counts: {
      rowsAudited: entries.length,
      snapshotRowsTotal: category.snapshotRowsTotal,
      uniqueSourceEntities: new Set(entries.map((entry) => entry.sourceEntityId)).size,
      uniqueCanonicalEntities: new Set(resolvedEntities).size,
      rowsWithZeroOrNegativeValue: nonPositive.length,
      duplicateCanonicalEntries: duplicateCanonicalEntities.reduce((total, [, count]) => total + count, 0),
      conflictingIdentityRows: conflictingIdentity.length + ambiguousExternalIds.length,
      rowsOutsideTop20: Math.max(0, entries.length - top20.length),
      playableRows: entries.filter((entry) => entry.playable).length,
      playableTop200: entries.filter((entry) => entry.rank <= 200 && entry.playable).length,
      mediaLicensed: mediaCounts.licensed,
      mediaFallbackOrUnavailable: mediaCounts.fallback + mediaCounts.unavailable,
      mediaPending: mediaCounts.pending
    },
    rankingChecks: {
      positiveValuesOnly: nonPositive.length === 0,
      deterministicRanks: rankMismatches.length === 0,
      deterministicScores: scoreMismatches.length === 0,
      duplicateCanonicalEntities: duplicateCanonicalEntities.length === 0,
      tiedPositions: actualTies
    },
    rights: {
      sourceStatus: category.sourceRightsStatus,
      sourceRightsApproved: category.sourceRightsStatus === 'approved',
      visualAssetStatus: categoryMediaStatus(top20)
    },
    top20: top20.map((entry) => ({
      entityId: entry.canonicalEntityId ?? entry.sourceEntityId,
      sourceEntityId: entry.sourceEntityId,
      sourceName: entry.sourceName,
      canonicalName: entry.canonicalName ?? entry.sourceName,
      value: entry.rawValue,
      rank: entry.rank,
      score: entry.scoreValue,
      tieGroup: entry.tieGroup,
      identityStatus: resolveIdentityStatus(entry),
      playable: entry.playable,
      mediaStatus: mediaStatus(entry.media),
      evidenceUrls: evidenceUrls(category, entry)
    }))
      .sort((left, right) => left.rank - right.rank || left.sourceEntityId.localeCompare(right.sourceEntityId)),
    anomalies
  };
}

function recommendation(category: RankingTruthCategoryReport): RankingTruthAuditReport['recommendations'][number] {
  const blocking = category.anomalies.filter((anomaly) => anomaly.severity === 'blocking');
  if (category.editorialStatus === 'approved') return { slug: category.slug, editorialStatus: category.editorialStatus, recommendation: 'stabilize_first', reasons: ['La definición, snapshot, integridad y cobertura pasan las condiciones del auditor.'] };
  if (category.editorialStatus === 'retired') return { slug: category.slug, editorialStatus: category.editorialStatus, recommendation: 'retire_or_redefine', reasons: ['La categoría o su snapshot está retirado/superseded.'] };
  if (blocking.some((anomaly) => ['global_label_overclaims_scope', 'coverage_incomplete', 'declared_200_incomplete'].includes(anomaly.code))) return { slug: category.slug, editorialStatus: category.editorialStatus, recommendation: 'retire_or_redefine', reasons: blocking.map((anomaly) => anomaly.message) };
  if (blocking.length) return { slug: category.slug, editorialStatus: category.editorialStatus, recommendation: 'repair_before_stabilizing', reasons: blocking.map((anomaly) => anomaly.message) };
  if (category.counts.rowsAudited > 0) return { slug: category.slug, editorialStatus: category.editorialStatus, recommendation: 'repair_before_stabilizing', reasons: ['Hay datos observados, pero todavía no alcanzan las condiciones editoriales de aprobación.'] };
  return { slug: category.slug, editorialStatus: category.editorialStatus, recommendation: 'keep_as_candidate', reasons: ['No hay filas auditables en el snapshot seleccionado.'] };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function renderRankingTruthCsv(report: Omit<RankingTruthAuditReport, 'hashes'>): string {
  const headers = ['record_type', 'category_slug', 'editorial_status', 'entity_type', 'label_es', 'ranking_snapshot_id', 'ranking_snapshot_status', 'source_snapshot_id', 'source_key', 'source_rights_status', 'coverage_complete', 'coverage_compatible_with_label', 'rows_audited', 'snapshot_rows_total', 'unique_source_entities', 'unique_canonical_entities', 'rows_zero_or_negative', 'duplicate_canonical_entries', 'conflicting_identity_rows', 'playable_top200', 'visual_asset_status', 'anomaly_codes', 'rank', 'entity_id', 'source_entity_id', 'source_name', 'canonical_name', 'raw_value', 'score', 'tie_group', 'identity_status', 'playable', 'media_status', 'evidence_urls'];
  const rows: string[][] = [headers];
  for (const category of report.categories) {
    const summary = [
      'category', category.slug, category.editorialStatus, category.definition.entityType, category.definition.labelEs,
      category.snapshots.ranking.id, category.snapshots.ranking.status, category.snapshots.source.id, category.snapshots.source.key,
      category.rights.sourceStatus, category.observedScope.coverageComplete, category.observedScope.coverageCompatibleWithLabel,
      category.counts.rowsAudited, category.counts.snapshotRowsTotal, category.counts.uniqueSourceEntities, category.counts.uniqueCanonicalEntities,
      category.counts.rowsWithZeroOrNegativeValue, category.counts.duplicateCanonicalEntries, category.counts.conflictingIdentityRows,
      category.counts.playableTop200, category.rights.visualAssetStatus, category.anomalies.map((anomaly) => anomaly.code).join('; ')
    ].map(String);
    rows.push([...summary, ...Array(12).fill('')]);
    for (const entry of category.top20) rows.push([
      'top20', category.slug, category.editorialStatus, category.definition.entityType, category.definition.labelEs,
      category.snapshots.ranking.id ?? '', category.snapshots.ranking.status ?? '', category.snapshots.source.id ?? '', category.snapshots.source.key ?? '',
      category.rights.sourceStatus ?? '', String(category.observedScope.coverageComplete), String(category.observedScope.coverageCompatibleWithLabel),
      '', '', '', '', '', '', '', '', '', '', String(entry.rank), entry.entityId, entry.sourceEntityId, entry.sourceName, entry.canonicalName,
      String(entry.value), String(entry.score), String(entry.tieGroup), entry.identityStatus, String(entry.playable), entry.mediaStatus, entry.evidenceUrls.join('; ')
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

export function renderRankingTruthMarkdown(report: Omit<RankingTruthAuditReport, 'hashes'>): string {
  const lines = [
    '# Rango 90 — auditoría de verdad de rankings',
    '',
    `Marca de generación determinista: ${report.generatedAt ?? 'sin snapshot'}. Se deriva del watermark de snapshots, para que una base sin cambios produzca el mismo informe.`,
    '',
    `Categorías auditadas: ${report.selectedCategories.length}.`,
    '',
    '## Resumen editorial',
    '',
    '| Categoría | Estado | Filas | Cobertura | Fuente | Anomalías bloqueantes | Recomendación |',
    '| --- | --- | ---: | --- | --- | ---: | --- |'
  ];
  for (const category of report.categories) {
    const blocking = category.anomalies.filter((anomaly) => anomaly.severity === 'blocking').length;
    const rec = report.recommendations.find((item) => item.slug === category.slug);
    lines.push(`| ${category.slug} | ${category.editorialStatus} | ${category.counts.rowsAudited} / ${category.counts.snapshotRowsTotal} | ${category.observedScope.coverageComplete === null ? 'desconocida' : category.observedScope.coverageComplete ? 'completa' : 'incompleta'} | ${category.snapshots.source.key ?? 'sin fuente'} | ${blocking} | ${rec?.recommendation ?? '—'} |`);
  }
  lines.push('', `Huella de datos: ${report.dataFingerprint.sha256}. Watermark: ${report.dataFingerprint.watermark ?? 'sin snapshot'}.`, '', '## Detalle por categoría', '');
  for (const category of report.categories) {
    lines.push(`### ${category.slug}`, '', `- Etiqueta ES: ${category.definition.labelEs}`, `- Entidad: ${category.definition.entityType}`, `- Métrica: ${category.definition.metricKey}`, `- Alcance declarado: \`${JSON.stringify(category.definition.declaredScope)}\``, `- Ventana observada: \`${JSON.stringify(category.observedScope.temporalWindow)}\``, `- ¿La etiqueta es honesta con el alcance?: ${category.definition.labelHonestForObservedScope ? 'sí' : 'no'}`, `- Snapshot de ranking: ${category.snapshots.ranking.id ?? 'no disponible'} (${category.snapshots.ranking.status ?? 'sin estado'})`, `- Snapshot de fuente: ${category.snapshots.source.id ?? 'no disponible'}`, `- Fuente: ${category.snapshots.source.name ?? category.snapshots.source.key ?? 'no disponible'}`, `- Evidencia: ${category.snapshots.source.evidenceUrls.length ? category.snapshots.source.evidenceUrls.map((url) => `[enlace](${url})`).join(', ') : 'no registrada'}`, `- Recuperado: ${category.snapshots.source.retrievedAt ?? 'no registrado'}; generado: ${category.snapshots.ranking.generatedAt ?? 'no registrado'}`, `- Cobertura completa: ${category.observedScope.coverageComplete === null ? 'desconocida' : category.observedScope.coverageComplete ? 'sí' : 'no'}`, `- Filas auditadas: ${category.counts.rowsAudited}; filas totales del snapshot: ${category.counts.snapshotRowsTotal}; entidades fuente únicas: ${category.counts.uniqueSourceEntities}; entidades canónicas únicas: ${category.counts.uniqueCanonicalEntities}`, `- Valores cero/negativos: ${category.counts.rowsWithZeroOrNegativeValue}; duplicados canónicos: ${category.counts.duplicateCanonicalEntries}; conflictos de identidad: ${category.counts.conflictingIdentityRows}`, `- Derechos de fuente: ${category.rights.sourceStatus ?? 'no registrado'}; medios top 20: ${category.rights.visualAssetStatus}`, '', '#### Top 20 trazable', '', '| Rank | ID canónico | Nombre canónico | Valor | Score | Empate | Identidad | Jugable | Media | Evidencia |', '| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |');
    if (!category.top20.length) lines.push('| — | — | — | — | — | — | — | — | — | Sin filas |');
    for (const entry of category.top20) lines.push(`| ${entry.rank} | ${entry.entityId} | ${entry.canonicalName} | ${entry.value} | ${entry.score} | ${entry.tieGroup} | ${entry.identityStatus} | ${entry.playable ? 'sí' : 'no'} | ${entry.mediaStatus} | ${entry.evidenceUrls.length ? entry.evidenceUrls.map((url) => `[fuente](${url})`).join(', ') : 'sin evidencia'} |`);
    lines.push('', '#### Anomalías', '');
    if (!category.anomalies.length) lines.push('Ninguna.', '');
    for (const anomaly of category.anomalies) lines.push(`- **${anomaly.severity}** \`${anomaly.code}\`: ${anomaly.message}${anomaly.details ? ` — ${JSON.stringify(anomaly.details)}` : ''}`, '');
  }
  lines.push('## Anomalías agrupadas por severidad', '');
  for (const severity of ['blocking', 'warning', 'info'] as const) {
    const items = report.anomalies.filter((anomaly) => anomaly.severity === severity);
    lines.push(`### ${severity}`, '');
    if (!items.length) lines.push('Ninguna.', '');
    for (const item of items) lines.push(`- \`${item.categorySlug}\` — \`${item.code}\`: ${item.message}`, '');
  }
  lines.push('## Recomendación inicial', '', 'Se priorizan categorías que ya tienen snapshot íntegro, alcance compatible con su etiqueta y menos anomalías bloqueantes. La aprobación editorial no sustituye la revisión humana de los top 20 ni la revisión legal de derechos.', '', `Candidatas prioritarias para estabilizar primero: ${report.priorityCandidates.length ? report.priorityCandidates.join(', ') : 'ninguna; primero hay que reparar las categorías seleccionadas.'}`, '');
  for (const item of report.recommendations) lines.push(`- \`${item.slug}\`: **${item.recommendation}** — ${item.reasons.join(' ')}`);
  lines.push('');
  return lines.join('\n');
}

export function buildRankingTruthAudit(categories: AuditCategoryInput[], entries: AuditEntryInput[], selectedCategories: string[]): RankingTruthAuditReport {
  const reports = categories
    .filter((category) => selectedCategories.includes(category.slug))
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((category) => auditRankingCategory(category, entries));
  const generatedAt = categories.map((category) => category.generatedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const fingerprintSnapshots = categories
    .filter((category) => selectedCategories.includes(category.slug))
    .map((category) => ({
      categorySlug: category.slug,
      rankingSnapshotId: category.snapshotId,
      rankingContentSha256: category.contentSha256,
      dataVersion: category.dataVersion,
      algorithmVersion: category.algorithmVersion,
      sourceSnapshotId: category.sourceSnapshotId,
      sourceContentSha256: category.sourceContentSha256
    }))
    .sort((left, right) => left.categorySlug.localeCompare(right.categorySlug));
  const fingerprintPayload = { version: '1' as const, watermark: generatedAt, snapshots: fingerprintSnapshots };
  const dataFingerprint = { ...fingerprintPayload, sha256: createHash('sha256').update(stableJson(fingerprintPayload)).digest('hex') };
  const base = {
    reportVersion: '1' as const,
    artifactKind: 'audit_report' as const,
    readOnly: true as const,
    productionData: false as const,
    editorialApproval: false as const,
    generatedAt,
    selectedCategories: [...selectedCategories].sort(),
    categories: reports,
    anomalies: reports.flatMap((category) => category.anomalies.map((anomaly) => ({ ...anomaly, categorySlug: category.slug }))).sort((left, right) => left.categorySlug.localeCompare(right.categorySlug) || left.code.localeCompare(right.code) || left.message.localeCompare(right.message)),
    recommendations: reports.map(recommendation).sort((left, right) => left.slug.localeCompare(right.slug)),
    priorityCandidates: reports
      .filter((category) => category.editorialStatus !== 'retired' && !category.anomalies.some((anomaly) => anomaly.severity === 'blocking'))
      .sort((left, right) => right.counts.rowsAudited - left.counts.rowsAudited || left.slug.localeCompare(right.slug))
      .slice(0, 5)
      .map((category) => category.slug),
    dataFingerprint
  };
  const json = stableJson(base);
  const markdown = renderRankingTruthMarkdown(base);
  const csv = renderRankingTruthCsv(base);
  return { ...base, hashes: { jsonSha256: createHash('sha256').update(json).digest('hex'), markdownSha256: createHash('sha256').update(markdown).digest('hex'), csvSha256: createHash('sha256').update(csv).digest('hex') } };
}

export function rankingTruthJson(report: RankingTruthAuditReport): string {
  return stableJson(report);
}

export function rankingTruthMarkdown(report: RankingTruthAuditReport): string {
  return renderRankingTruthMarkdown(report);
}

export function rankingTruthCsv(report: RankingTruthAuditReport): string {
  return renderRankingTruthCsv(report);
}
