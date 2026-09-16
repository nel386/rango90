import { createHash } from 'node:crypto';

export type ValidationIssueType = 'error de fuente' | 'error de identidad' | 'error de cálculo' | 'error de alcance' | 'problema de derechos' | 'problema de imagen';
export type ValidationStatus = 'confirmado' | 'dudoso' | 'discrepante' | 'no verificable';

export type PrioritySourceEntry = {
  entityId: string;
  entityType: 'player';
  name: string;
  rawValue: number;
  evidence: {
    sourceRank?: number;
    externalId?: string;
    profileUrl?: string;
    sourceUrl?: string;
    scope?: string;
  };
};

export type PrioritySourceSnapshot = {
  categorySlug: string;
  source: { key: string; name: string; baseUrl: string; rightsStatus: string };
  dataVersion: string;
  coverageComplete: boolean;
  reviewed: boolean;
  audit?: {
    unresolvedConflicts?: number;
    ties?: string;
    productionDecision?: string;
    contrastSources?: Array<{ name: string; url: string; archivedSnapshotId?: string; matchedNames?: number; equalValues?: number; valueDiscrepancies?: number; status?: string }>;
  };
  entries: PrioritySourceEntry[];
};

export type PriorityCurrentEntry = {
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
};

export type PriorityIdentityContext = {
  profileUrlsByEntity: Record<string, string[]>;
  entitiesByProfileUrl: Record<string, string[]>;
  imageByEntity: Record<string, Array<{ provider: string; reviewStatus: string; rightsEvidenceUrl: string | null; rightsVerifiedAt: string | null; sourceUrl: string | null; localPath: string | null }>>;
};

export type PriorityValidationEntry = {
  entityId: string;
  canonicalName: string;
  sourceName: string;
  sourceProfileUrl: string | null;
  sourceValue: number | null;
  rankingValue: number;
  sourceRank: number | null;
  rankingRank: number;
  expectedRankFromSource: number | null;
  rankingScore: number;
  tieGroup: number;
  expectedTieGroupFromSource: number | null;
  identityStatus: ValidationStatus;
  valueStatus: ValidationStatus;
  rankStatus: ValidationStatus;
  tieStatus: ValidationStatus;
  ambiguityNote: string | null;
  imageAvailable: boolean;
  imageStatus: string;
  imageRightsStatus: ValidationStatus;
  evidenceUrls: string[];
  issues: Array<{ type: ValidationIssueType; code: string; message: string; evidenceUrls: string[] }>;
};

export type PriorityValidationReport = {
  artifactKind: 'priority_ranking_validation';
  readOnly: true;
  productionData: false;
  editorialApproval: false;
  categorySlug: string;
  rankingSnapshotId: string | null;
  sourceSnapshotId: string | null;
  source: PrioritySourceSnapshot['source'];
  snapshot: { dataVersion: string | null; algorithmVersion: string | null; contentSha256: string | null; generatedAt: string | null; coverageComplete: boolean | null; reviewed: boolean; sourceContentSha256: string | null; sourceStorageUri: string | null };
  validationMethod: {
    archivedSourceSnapshot: string;
    liveSourceStatus: 'not_automatable';
    liveSourceNote: string;
    independentReferences: Array<{ name: string; url: string; scope: string; status: 'reference_only' }>;
  };
  sourceAudit: PrioritySourceSnapshot['audit'];
  entries: PriorityValidationEntry[];
  discrepancies: Array<{ type: ValidationIssueType; code: string; message: string; entityId?: string; evidenceUrls: string[] }>;
  recommendation: string;
  hashes: { validationSha256: string };
};

function normalizeProfileUrl(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/^https?:\/\//u, 'https://').replace(/\/$/u, '');
}

function nameIsAmbiguous(name: string): boolean {
  return name.trim().split(/\s+/u).length < 2 || /\b[A-ZÁÉÍÓÚÑ]\.\s*\S+$/u.test(name.trim());
}

function expectedRanks(entries: PrioritySourceEntry[]): Map<string, { rank: number; tieGroup: number }> {
  const sorted = [...entries].sort((left, right) => right.rawValue - left.rawValue || left.entityId.localeCompare(right.entityId));
  const result = new Map<string, { rank: number; tieGroup: number }>();
  let previousValue: number | null = null;
  let rank = 0;
  let tieGroup = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index];
    if (!entry) continue;
    if (previousValue === null || entry.rawValue !== previousValue) {
      rank = index + 1;
      tieGroup += 1;
      previousValue = entry.rawValue;
    }
    result.set(entry.entityId, { rank, tieGroup });
  }
  return result;
}

function issue(type: ValidationIssueType, code: string, message: string, evidenceUrls: string[] = []): { type: ValidationIssueType; code: string; message: string; evidenceUrls: string[] } {
  return { type, code, message, evidenceUrls: [...new Set(evidenceUrls)].sort() };
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function validatePriorityRanking(
  current: { categorySlug: string; rankingSnapshotId: string | null; sourceSnapshotId: string | null; source: PrioritySourceSnapshot['source']; snapshot: PriorityValidationReport['snapshot']; top20: PriorityCurrentEntry[]; sourceAudit?: PrioritySourceSnapshot['audit'] },
  sourceSnapshot: PrioritySourceSnapshot,
  context: PriorityIdentityContext,
  independentReferences: PriorityValidationReport['validationMethod']['independentReferences']
): PriorityValidationReport {
  const sourceByProfile = new Map<string, PrioritySourceEntry>();
  for (const sourceEntry of sourceSnapshot.entries) {
    const profile = normalizeProfileUrl(sourceEntry.evidence.profileUrl ?? sourceEntry.evidence.externalId);
    if (profile && !sourceByProfile.has(profile)) sourceByProfile.set(profile, sourceEntry);
  }
  const sourceRanks = expectedRanks(sourceSnapshot.entries);
  const entries: PriorityValidationEntry[] = current.top20.map((rankingEntry) => {
    const profileUrls = [...new Set([
      ...(context.profileUrlsByEntity[rankingEntry.entityId] ?? []),
      ...(context.profileUrlsByEntity[rankingEntry.sourceEntityId] ?? [])
    ].map(normalizeProfileUrl).filter((value): value is string => Boolean(value)))];
    const profileUrl = profileUrls.find((url) => sourceByProfile.has(url)) ?? profileUrls[0] ?? null;
    const sourceEntry = profileUrl ? sourceByProfile.get(profileUrl) ?? null : null;
    const sourceExpected = sourceEntry ? sourceRanks.get(sourceEntry.entityId) ?? null : null;
    const profileOwners = profileUrl ? context.entitiesByProfileUrl[profileUrl] ?? [] : [];
    const issues: PriorityValidationEntry['issues'] = [];
    const acceptedOwners = new Set([rankingEntry.entityId, rankingEntry.sourceEntityId, ...(sourceEntry ? [sourceEntry.entityId] : [])]);
    const identityConfirmed = rankingEntry.identityStatus !== 'missing' && rankingEntry.identityStatus !== 'conflict' && Boolean(sourceEntry) && profileOwners.length > 0 && profileOwners.every((owner) => acceptedOwners.has(owner));
    let identityStatus: ValidationStatus = identityConfirmed ? 'confirmado' : 'dudoso';
    if (!sourceEntry) {
      identityStatus = 'no verificable';
      issues.push(issue('error de identidad', 'source_profile_not_mapped', 'No se pudo mapear el perfil de fuente a una entidad canónica única.', current.top20.find((item) => item.entityId === rankingEntry.entityId)?.evidenceUrls ?? []));
    } else if (profileOwners.length === 0 || profileOwners.some((owner) => !acceptedOwners.has(owner)) || rankingEntry.identityStatus === 'conflict') {
      identityStatus = 'discrepante';
      issues.push(issue('error de identidad', 'canonical_entity_mismatch', 'El perfil de fuente no apunta a una entidad canónica única coincidente.', [sourceEntry.evidence.profileUrl ?? '', ...rankingEntry.evidenceUrls]));
    }
    const valueStatus: ValidationStatus = sourceEntry && sourceEntry.rawValue === rankingEntry.value ? 'confirmado' : sourceEntry ? 'discrepante' : 'no verificable';
    if (valueStatus === 'discrepante') issues.push(issue('error de fuente', 'source_value_mismatch', `La fuente archivada registra ${sourceEntry?.rawValue} y el ranking usa ${rankingEntry.value}.`, [sourceEntry?.evidence.sourceUrl ?? '', sourceEntry?.evidence.profileUrl ?? '']));
    const rankStatus: ValidationStatus = sourceExpected && sourceExpected.rank === rankingEntry.rank ? 'confirmado' : sourceExpected ? 'discrepante' : 'no verificable';
    if (rankStatus === 'discrepante') issues.push(issue('error de cálculo', 'rank_mismatch_against_source', `La posición calculada desde los valores de la fuente es ${sourceExpected?.rank}, pero el ranking usa ${rankingEntry.rank}.`, [sourceEntry?.evidence.sourceUrl ?? '']));
    const tieStatus: ValidationStatus = sourceExpected && sourceExpected.tieGroup === rankingEntry.tieGroup ? 'confirmado' : sourceExpected ? 'discrepante' : 'no verificable';
    if (tieStatus === 'discrepante') issues.push(issue('error de cálculo', 'tie_group_mismatch_against_source', `El grupo de empate calculado desde la fuente es ${sourceExpected?.tieGroup}, pero el ranking usa ${rankingEntry.tieGroup}.`, [sourceEntry?.evidence.sourceUrl ?? '']));
    const ambiguityNote = sourceEntry && nameIsAmbiguous(sourceEntry.name) ? 'La etiqueta de fuente es abreviada; el perfil URL se usa como desambiguación.' : null;
    if (ambiguityNote && sourceEntry) issues.push(issue('error de identidad', 'short_or_ambiguous_source_name', ambiguityNote, [sourceEntry.evidence.profileUrl ?? '']));
    const imageAssets = context.imageByEntity[rankingEntry.entityId] ?? [];
    const imageAvailable = imageAssets.some((asset) => Boolean(asset.localPath || asset.sourceUrl));
    const imageRightsStatus: ValidationStatus = rankingEntry.mediaStatus === 'licensed' && imageAssets.some((asset) => asset.rightsEvidenceUrl && asset.rightsVerifiedAt) ? 'confirmado' : imageAvailable ? 'dudoso' : 'no verificable';
    if (!imageAvailable) issues.push(issue('problema de imagen', 'image_unavailable', 'No hay imagen disponible para el jugador en el catálogo actual.'));
    else if (imageRightsStatus !== 'confirmado') issues.push(issue('problema de derechos', 'image_rights_unconfirmed', 'Existe una imagen, pero no consta como licenciada y verificada para producto.'));
    return {
      entityId: rankingEntry.entityId, canonicalName: rankingEntry.canonicalName, sourceName: sourceEntry?.name ?? rankingEntry.sourceName,
      sourceProfileUrl: sourceEntry?.evidence.profileUrl ?? null, sourceValue: sourceEntry?.rawValue ?? null, rankingValue: rankingEntry.value,
      sourceRank: sourceEntry?.evidence.sourceRank ?? null, rankingRank: rankingEntry.rank, expectedRankFromSource: sourceExpected?.rank ?? null,
      rankingScore: rankingEntry.score, tieGroup: rankingEntry.tieGroup, expectedTieGroupFromSource: sourceExpected?.tieGroup ?? null,
      identityStatus, valueStatus, rankStatus, tieStatus, ambiguityNote, imageAvailable, imageStatus: rankingEntry.mediaStatus,
      imageRightsStatus, evidenceUrls: [...new Set([...(sourceEntry?.evidence.sourceUrl ? [sourceEntry.evidence.sourceUrl] : []), ...(sourceEntry?.evidence.profileUrl ? [sourceEntry.evidence.profileUrl] : []), ...rankingEntry.evidenceUrls])].sort(), issues
    };
  });
  const discrepancies: PriorityValidationReport['discrepancies'] = entries.flatMap((entry) => entry.issues.map((entryIssue) => ({ ...entryIssue, entityId: entry.entityId })));
  if ((sourceSnapshot.audit?.unresolvedConflicts ?? 0) > 0) {
    discrepancies.push(issue('error de fuente', 'source_snapshot_unresolved_conflicts', `El snapshot de fuente declara ${sourceSnapshot.audit?.unresolvedConflicts} conflictos sin resolver.`, [sourceSnapshot.source.baseUrl]));
  }
  for (const contrast of sourceSnapshot.audit?.contrastSources ?? []) {
    if ((contrast.valueDiscrepancies ?? 0) > 0) {
      discrepancies.push(issue('error de alcance', 'source_contrast_value_discrepancy', `La fuente de contraste «${contrast.name}» registra ${contrast.valueDiscrepancies} discrepancias de valor; hay que resolver si corresponden a alcance o definición estadística distinta.`, [contrast.url]));
    }
  }
  if (sourceSnapshot.source.rightsStatus !== 'approved') {
    discrepancies.push(issue('problema de derechos', 'source_rights_not_approved', `La fuente mantiene rightsStatus=${sourceSnapshot.source.rightsStatus}; no puede publicarse como dato aprobado.`, [sourceSnapshot.source.baseUrl]));
  }
  if (!sourceSnapshot.coverageComplete) {
    discrepancies.push(issue('error de alcance', 'source_coverage_incomplete', 'El snapshot de fuente declara cobertura incompleta.', [sourceSnapshot.source.baseUrl]));
  }
  const base = {
    artifactKind: 'priority_ranking_validation' as const,
    readOnly: true as const,
    productionData: false as const,
    editorialApproval: false as const,
    categorySlug: current.categorySlug,
    rankingSnapshotId: current.rankingSnapshotId,
    sourceSnapshotId: current.sourceSnapshotId,
    source: current.source,
    snapshot: current.snapshot,
    validationMethod: {
      archivedSourceSnapshot: 'Se compara contra el JSON archivado que originó el ranking; el acceso web vivo requiere revisión del propietario del sitio.',
      liveSourceStatus: 'not_automatable' as const,
      liveSourceNote: 'La página de Transfermarkt respondió con verificación anti-bot durante la comprobación. No se ha tratado ese bloqueo como aprobación ni como discrepancia de valor.',
      independentReferences
    },
    sourceAudit: sourceSnapshot.audit,
    entries,
    discrepancies,
    recommendation: 'No aprobar ni publicar automáticamente. Resolver discrepancias de identidad, confirmar los valores contra la fuente primaria, documentar el alcance y cerrar derechos/imágenes antes de promover el snapshot.',
  };
  const validationSha256 = createHash('sha256').update(stableJson(base)).digest('hex');
  return { ...base, hashes: { validationSha256 } };
}

export function renderPriorityValidationMarkdown(report: PriorityValidationReport): string {
  const lines = [
    `# Validación de ranking — ${report.categorySlug}`,
    '',
    '> ARTIFACTO DE AUDITORÍA — solo lectura. No es producción y no implica aprobación editorial.',
    '',
    `Snapshot de ranking: ${report.rankingSnapshotId ?? 'no disponible'}; snapshot de fuente: ${report.sourceSnapshotId ?? 'no disponible'}.`,
    `Huella del snapshot de ranking: ${report.snapshot.contentSha256 ?? 'no disponible'}; huella del snapshot de fuente: ${report.snapshot.sourceContentSha256 ?? 'no disponible'}.`,
    `Artefacto de fuente archivado: ${report.snapshot.sourceStorageUri ?? 'no disponible'}.`,
    `Fuente: ${report.source.name} — ${report.source.baseUrl}`,
    `Estado de fuente: ${report.source.rightsStatus}; cobertura declarada: ${report.snapshot.coverageComplete ? 'completa' : 'incompleta'}; fuente revisada: ${report.snapshot.reviewed ? 'sí' : 'no'}.`,
    '',
    '## Método y límites',
    '',
    `- ${report.validationMethod.archivedSourceSnapshot}`,
    `- ${report.validationMethod.liveSourceNote}`,
    ...report.validationMethod.independentReferences.map((reference) => `- Referencia independiente (${reference.scope}): [${reference.name}](${reference.url})`),
    '',
    '## Resultado por jugador',
    '',
    '| Rank | Jugador canónico | Etiqueta fuente | Valor ranking | Valor fuente | Fuente rank | Rank calculado | Tie group | Identidad | Valor | Rank | Empate | Imagen | Derechos imagen | Discrepancias |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const entry of report.entries) {
    lines.push(`| ${entry.rankingRank} | ${entry.canonicalName} | ${entry.sourceName} | ${entry.rankingValue} | ${entry.sourceValue ?? '—'} | ${entry.sourceRank ?? '—'} | ${entry.expectedRankFromSource ?? '—'} | ${entry.tieGroup} / ${entry.expectedTieGroupFromSource ?? '—'} | ${entry.identityStatus} | ${entry.valueStatus} | ${entry.rankStatus} | ${entry.tieStatus} | ${entry.imageAvailable ? entry.imageStatus : 'no disponible'} | ${entry.imageRightsStatus} | ${entry.issues.length ? entry.issues.map((item) => `\`${item.code}\``).join(', ') : 'ninguna'} |`);
  }
  lines.push('', '## Discrepancias clasificadas', '');
  if (!report.discrepancies.length) lines.push('Ninguna.', '');
  for (const discrepancy of report.discrepancies) lines.push(`- **${discrepancy.type}** \`${discrepancy.code}\`${discrepancy.entityId ? ` — ${discrepancy.entityId}` : ''}: ${discrepancy.message}${discrepancy.evidenceUrls.length ? ` ([evidencia](${discrepancy.evidenceUrls[0]}))` : ''}`);
  lines.push('', '## Recomendación técnica', '', report.recommendation, '', `Huella del informe: ${report.hashes.validationSha256}.`, '');
  return lines.join('\n');
}

export function priorityValidationJson(report: PriorityValidationReport): string {
  return stableJson(report);
}
