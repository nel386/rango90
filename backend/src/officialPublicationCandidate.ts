import { createHash } from 'node:crypto';

export type CandidateGateStatus = 'pass' | 'pending' | 'block';

export type CandidateGate = {
  key: string;
  status: CandidateGateStatus;
  detail: string;
};

export type CandidateTop20Entry = {
  entityId: string;
  sourceEntityId: string;
  sourceName: string;
  canonicalName: string;
  value: number;
  rank: number;
  score: number;
  tieGroup: number;
  identityStatus: string;
  playable: boolean;
  mediaStatus: string;
  evidenceUrls: string[];
};

export type CandidateDifference = {
  categorySlug: string;
  type: string;
  code: string;
  message: string;
  entityId: string | null;
  player: string | null;
  evidenceUrls: string[];
};

export type OfficialPublicationCandidate = {
  categorySlug: string;
  state: 'candidate_not_publishable';
  publishable: false;
  editorialStatus: string;
  scope: {
    decisionStatus: string;
    approved: false;
    finalDefinition: Record<string, unknown>;
    included: string[];
    excluded: string[];
    openConflicts: Array<Record<string, unknown>>;
  };
  ranking: {
    snapshotId: string | null;
    snapshotStatus: string | null;
    dataVersion: string | null;
    algorithmVersion: string | null;
    contentSha256: string | null;
    generatedAt: string | null;
    rowsAudited: number;
    snapshotRowsTotal: number;
    uniqueCanonicalEntities: number;
    identities: { top20Checked: number; top20Confirmed: number; conflicts: number; complete: boolean };
    values: { top20Checked: number; top20WithEvidence: number; complete: boolean };
    ordering: { ranksConsistent: boolean; scoresConsistent: boolean; tiesConsistent: boolean; ties: Array<Record<string, unknown>> };
    coverage: { declaredComplete: boolean | null; declaredUniverse: string; completeForDeclaredUniverse: boolean; note: string };
    top20: CandidateTop20Entry[];
  };
  source: {
    snapshotId: string | null;
    key: string | null;
    name: string | null;
    rightsStatus: string | null;
    contentSha256: string | null;
    evidenceUrls: string[];
  };
  media: {
    top20Licensed: number;
    top20WithoutApprovedPortrait: number;
    playableAppearances: number;
    playableLicensed: number;
    playableFallback: number;
    playableUnavailable: number;
    priorityMissingApprovedPortraits: number;
    policyStatus: CandidateGateStatus;
    note: string;
  };
  gates: CandidateGate[];
  pendingDifferences: CandidateDifference[];
  candidateSnapshot: {
    id: string | null;
    status: string | null;
    mustRemainDraft: true;
    preserveContentSha256: string | null;
  };
  recommendation: string;
};

export type OfficialPublicationCandidateReport = {
  artifactKind: 'official_publication_candidate_audit';
  reportVersion: '1';
  readOnly: true;
  productionData: false;
  editorialApproval: false;
  published: false;
  execution: { mode: 'offline_archived_artifacts'; databaseAccess: 'none'; mutationCount: 0 };
  runId: string;
  watermark: string;
  selectedCategories: string[];
  sourceArtifacts: Array<{ path: string; sha256: string }>;
  dataFingerprint: {
    version: '1';
    snapshots: Array<Record<string, unknown>>;
    sha256: string;
  };
  categories: OfficialPublicationCandidate[];
  readyForApproval: false;
  readyForPublication: false;
  blockingReasons: string[];
  publicationProcedure: {
    status: 'documented_not_executed';
    atomic: true;
    reversible: true;
    traceable: true;
    requiresExplicitApproval: true;
  };
  sha256: string;
};

type JsonRecord = Record<string, unknown>;

export type RankingTruth = {
  generatedAt: string | null;
  categories: Array<JsonRecord>;
};

export type ScopeDecisions = { decisions: Array<JsonRecord> };
export type Validation = { discrepancies: Array<JsonRecord>; categories: Array<JsonRecord> };
export type Media = { entries: Array<JsonRecord> };

const TARGET_CATEGORIES = ['uefa-champions-league-goals', 'world-cup-goals'] as const;

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function gate(key: string, status: CandidateGateStatus, detail: string): CandidateGate {
  return { key, status, detail };
}

function top20Entry(entry: JsonRecord): CandidateTop20Entry {
  return {
    entityId: String(entry.entityId),
    sourceEntityId: String(entry.sourceEntityId),
    sourceName: String(entry.sourceName),
    canonicalName: String(entry.canonicalName),
    value: asNumber(entry.value),
    rank: asNumber(entry.rank),
    score: asNumber(entry.score),
    tieGroup: asNumber(entry.tieGroup),
    identityStatus: String(entry.identityStatus),
    playable: Boolean(entry.playable),
    mediaStatus: String(entry.mediaStatus),
    evidenceUrls: Array.isArray(entry.evidenceUrls) ? entry.evidenceUrls.map(String).sort() : []
  };
}

function candidateCategory(
  truth: JsonRecord,
  scope: JsonRecord,
  validation: Validation,
  media: Media,
  slug: string
): OfficialPublicationCandidate {
  const snapshots = objectValue(truth.snapshots);
  const ranking = objectValue(snapshots.ranking);
  const source = objectValue(snapshots.source);
  const counts = objectValue(truth.counts);
  const rankingChecks = objectValue(truth.rankingChecks);
  const observedScope = objectValue(truth.observedScope);
  const rights = objectValue(truth.rights);
  const top20 = recordArray(truth.top20).map(top20Entry).sort((left: CandidateTop20Entry, right: CandidateTop20Entry) => left.rank - right.rank || left.sourceEntityId.localeCompare(right.sourceEntityId));
  const categoryDifferences = validation.discrepancies
    .filter((item) => item.categorySlug === slug)
    .map((item) => ({
      categorySlug: slug,
      type: String(item.type ?? 'sin clasificar'),
      code: String(item.code ?? 'unknown'),
      message: String(item.message ?? ''),
      entityId: asString(item.entityId),
      player: asString(item.player),
      evidenceUrls: Array.isArray(item.evidenceUrls) ? item.evidenceUrls.map(String).sort() : []
    }))
    .sort((left, right) => left.code.localeCompare(right.code) || (left.entityId ?? '').localeCompare(right.entityId ?? '') || left.message.localeCompare(right.message));
  const scopeConflicts = (Array.isArray(scope.conflicts) ? scope.conflicts : [])
    .map((item: JsonRecord) => ({
      player: asString(item.player),
      classification: asString(item.classification),
      primaryValue: item.primaryValue ?? null,
      officialValue: item.officialValue ?? null,
      storedValue: item.storedValue ?? null,
      evidenceUrls: Array.isArray(item.evidenceUrls) ? item.evidenceUrls.map(String).sort() : []
    }))
    .sort((left, right) => (left.player ?? '').localeCompare(right.player ?? ''));
  const mediaEntries = media.entries.filter((entry) => entry.categorySlug === slug);
  const top20Licensed = top20.filter((entry: CandidateTop20Entry) => entry.mediaStatus === 'licensed').length;
  const top20WithoutApprovedPortrait = top20.length - top20Licensed;
  const playableLicensed = mediaEntries.filter((entry) => entry.mediaStatus === 'licensed').length;
  const playableFallback = mediaEntries.filter((entry) => entry.mediaStatus === 'fallback').length;
  const playableUnavailable = mediaEntries.filter((entry) => entry.mediaStatus === 'unavailable').length;
  const priorityMissing = new Set(mediaEntries.filter((entry) => entry.priority && !entry.isPublishable).map((entry) => String(entry.entityId))).size;
  const identityConfirmed = top20.filter((entry: CandidateTop20Entry) => ['canonical', 'resolved'].includes(entry.identityStatus)).length;
  const valuesWithEvidence = top20.filter((entry: CandidateTop20Entry) => entry.evidenceUrls.length > 0).length;
  const scopeDecisionStatus = String(scope.decisionStatus ?? 'missing');
  const coverageDeclared = observedScope.coverageComplete === true;
  const coverageNote = `Completa para el universo declarado de ${asNumber(counts.snapshotRowsTotal)} filas reales; no implica que el top ${asNumber(counts.snapshotRowsTotal)} sea el universo histórico total.`;
  const sourceRightsStatus = asString(rights.sourceStatus ?? source.sourceRightsStatus ?? source.rightsStatus);
  const imagePolicyStatus: CandidateGateStatus = top20WithoutApprovedPortrait > 0 || playableFallback > 0 || playableUnavailable > 0 ? 'pending' : 'pass';
  const gates: CandidateGate[] = [
    gate('snapshot_status', ['approved', 'published'].includes(String(ranking.status)) ? 'pass' : 'block', `El snapshot candidato está en estado ${ranking.status ?? 'sin estado'}; debe seguir en draft hasta aprobación explícita.`),
    gate('scope_decision', scopeDecisionStatus === 'approved' ? 'pass' : 'block', `La decisión editorial está en estado ${scopeDecisionStatus}; no se convierte en aprobación automáticamente.`),
    gate('identities', identityConfirmed === top20.length && asNumber(counts.conflictingIdentityRows) === 0 ? 'pass' : 'block', `${identityConfirmed}/${top20.length} identidades del top 20 confirmadas; conflictos registrados: ${asNumber(counts.conflictingIdentityRows)}.`),
    gate('values_and_evidence', valuesWithEvidence === top20.length && asNumber(counts.rowsWithZeroOrNegativeValue) === 0 ? 'pass' : 'block', `${valuesWithEvidence}/${top20.length} valores del top 20 tienen evidencia; valores no positivos: ${asNumber(counts.rowsWithZeroOrNegativeValue)}.`),
    gate('ordering_and_ties', rankingChecks.deterministicRanks && rankingChecks.deterministicScores && rankingChecks.duplicateCanonicalEntities ? 'pass' : 'block', 'La posición, el score, los empates y la unicidad canónica deben coincidir con el algoritmo archivado.'),
    gate('coverage', coverageDeclared ? 'pass' : 'block', coverageNote),
    gate('source_rights', sourceRightsStatus === 'approved' ? 'pass' : 'block', `La fuente numérica mantiene rights_status=${sourceRightsStatus ?? 'missing'}.`),
    gate('images', imagePolicyStatus, `${top20Licensed}/${top20.length} retratos aprobados en top 20; ${playableFallback} apariciones jugables usan fallback.`),
    gate('open_differences', scopeConflicts.length === 0 && categoryDifferences.length === 0 ? 'pass' : 'block', `${scopeConflicts.length} conflictos de alcance/definición y ${categoryDifferences.length} discrepancias de validación siguen abiertas.`)
  ];
  return {
    categorySlug: slug,
    state: 'candidate_not_publishable',
    publishable: false,
    editorialStatus: String(truth.editorialStatus ?? 'provisional'),
    scope: {
      decisionStatus: scopeDecisionStatus,
      approved: false,
      finalDefinition: objectValue(scope.finalDefinition),
      included: stringArray(scope.included),
      excluded: stringArray(scope.excluded),
      openConflicts: scopeConflicts
    },
    ranking: {
      snapshotId: asString(ranking.id),
      snapshotStatus: asString(ranking.status),
      dataVersion: asString(ranking.dataVersion),
      algorithmVersion: asString(ranking.algorithmVersion),
      contentSha256: asString(ranking.contentSha256),
      generatedAt: asString(ranking.generatedAt),
      rowsAudited: asNumber(counts.rowsAudited),
      snapshotRowsTotal: asNumber(counts.snapshotRowsTotal),
      uniqueCanonicalEntities: asNumber(counts.uniqueCanonicalEntities),
      identities: { top20Checked: top20.length, top20Confirmed: identityConfirmed, conflicts: asNumber(counts.conflictingIdentityRows), complete: identityConfirmed === top20.length && asNumber(counts.conflictingIdentityRows) === 0 },
      values: { top20Checked: top20.length, top20WithEvidence: valuesWithEvidence, complete: valuesWithEvidence === top20.length },
      ordering: { ranksConsistent: Boolean(rankingChecks.deterministicRanks), scoresConsistent: Boolean(rankingChecks.deterministicScores), tiesConsistent: Boolean(rankingChecks.deterministicRanks), ties: recordArray(rankingChecks.tiedPositions) },
      coverage: { declaredComplete: observedScope.coverageComplete === true ? true : observedScope.coverageComplete === false ? false : null, declaredUniverse: `top ${asNumber(counts.snapshotRowsTotal)} filas reales del snapshot`, completeForDeclaredUniverse: coverageDeclared, note: coverageNote },
      top20
    },
    source: { snapshotId: asString(source.id), key: asString(source.key), name: asString(source.name), rightsStatus: sourceRightsStatus, contentSha256: asString(source.contentSha256), evidenceUrls: Array.isArray(source.evidenceUrls) ? source.evidenceUrls.map(String).sort() : [] },
    media: {
      top20Licensed,
      top20WithoutApprovedPortrait,
      playableAppearances: mediaEntries.length,
      playableLicensed,
      playableFallback,
      playableUnavailable,
      priorityMissingApprovedPortraits: priorityMissing,
      policyStatus: imagePolicyStatus,
      note: priorityMissing > 0 ? `${priorityMissing} prioridades continúan sin retrato aprobado y se muestran mediante fallback; esto no equivale a resolución editorial.` : 'No hay prioridades sin retrato aprobado en el artefacto seleccionado.'
    },
    gates,
    pendingDifferences: categoryDifferences,
    candidateSnapshot: { id: asString(ranking.id), status: asString(ranking.status), mustRemainDraft: true, preserveContentSha256: asString(ranking.contentSha256) },
    recommendation: `No publicar ${slug}. Mantener el snapshot en draft, resolver todos los gates no satisfechos y generar una nueva versión append-only si cambia cualquier valor, alcance o metadato.`
  };
}

export function buildOfficialPublicationCandidateReport(input: {
  truth: RankingTruth;
  scope: ScopeDecisions;
  validation: Validation;
  media: Media;
  sourceArtifacts: Array<{ path: string; sha256: string }>;
}): OfficialPublicationCandidateReport {
  const categories = TARGET_CATEGORIES.map((slug) => {
    const truth = input.truth.categories.find((item) => item.slug === slug);
    const scope = input.scope.decisions.find((item) => item.categorySlug === slug);
    if (!truth || !scope) throw new Error(`Falta evidencia archivada para ${slug}`);
    return candidateCategory(truth, scope, input.validation, input.media, slug);
  });
  const snapshots = categories.map((category) => ({
    categorySlug: category.categorySlug,
    rankingSnapshotId: category.ranking.snapshotId,
    rankingContentSha256: category.ranking.contentSha256,
    dataVersion: category.ranking.dataVersion,
    algorithmVersion: category.ranking.algorithmVersion,
    sourceSnapshotId: category.source.snapshotId,
    sourceContentSha256: category.source.contentSha256
  }));
  const fingerprintPayload = { version: '1' as const, snapshots };
  const dataFingerprint = { ...fingerprintPayload, sha256: sha256(stableJson(fingerprintPayload)) };
  const sourceDigest = sha256(stableJson(input.sourceArtifacts));
  const watermark = input.truth.generatedAt ?? 'archived-artifacts';
  const base = {
    artifactKind: 'official_publication_candidate_audit' as const,
    reportVersion: '1' as const,
    readOnly: true as const,
    productionData: false as const,
    editorialApproval: false as const,
    published: false as const,
    execution: { mode: 'offline_archived_artifacts' as const, databaseAccess: 'none' as const, mutationCount: 0 as const },
    runId: `block7-candidate-${sourceDigest.slice(0, 16)}`,
    watermark,
    selectedCategories: [...TARGET_CATEGORIES],
    sourceArtifacts: [...input.sourceArtifacts].sort((left, right) => left.path.localeCompare(right.path)),
    dataFingerprint,
    categories,
    readyForApproval: false as const,
    readyForPublication: false as const,
    blockingReasons: categories.flatMap((category) => category.gates.filter((item) => item.status !== 'pass').map((item) => `${category.categorySlug}:${item.key}`)).sort(),
    publicationProcedure: { status: 'documented_not_executed' as const, atomic: true as const, reversible: true as const, traceable: true as const, requiresExplicitApproval: true as const }
  };
  return { ...base, sha256: sha256(stableJson(base)) };
}

function markdownCell(value: unknown): string {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderOfficialPublicationCandidateMarkdown(report: OfficialPublicationCandidateReport): string {
  const lines = [
    '# BLOQUE 7 — Candidatos de publicación oficial',
    '',
    '> ARTEFACTO DE AUDITORÍA. Solo lectura: no modifica PostgreSQL, no aprueba derechos, no aprueba categorías, no publica snapshots y no representa producción.',
    '',
    `- runId: \`${report.runId}\``,
    `- watermark: \`${report.watermark}\``,
    `- acceso a base de datos: **ninguno**`,
    `- huella de datos: \`${report.dataFingerprint.sha256}\``,
    `- huella del informe: \`${report.sha256}\``,
    `- readyForApproval: **no**`,
    `- readyForPublication: **no**`,
    '',
    '## Resumen',
    '',
    '| Categoría | Snapshot candidato | Alcance | Identidad top 20 | Valores | Cobertura declarada | Derechos | Imágenes | Resultado |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const category of report.categories) {
    const gateStatus = (key: string) => category.gates.find((item) => item.key === key)?.status ?? 'missing';
    lines.push(`| ${category.categorySlug} | ${category.ranking.snapshotId} (${category.ranking.snapshotStatus}) | ${category.scope.decisionStatus} | ${category.ranking.identities.top20Confirmed}/${category.ranking.identities.top20Checked} | ${category.ranking.values.top20WithEvidence}/${category.ranking.values.top20Checked} | ${category.ranking.coverage.declaredComplete ? 'sí' : 'no'} | ${category.source.rightsStatus} | ${category.media.top20Licensed}/${category.ranking.top20.length} top 20; ${category.media.playableFallback} fallback jugable | **no publicable** (${gateStatus('open_differences')}) |`);
  }
  lines.push('', '## Candidatos', '');
  for (const category of report.categories) {
    lines.push(`### ${category.categorySlug}`, '', `Estado: **${category.state}**. ${category.recommendation}`, '', '#### Definición y alcance', '', `- Decisión editorial: **${category.scope.decisionStatus}**; aprobada: no.`, `- Definición: \`${JSON.stringify(category.scope.finalDefinition)}\``, '- Incluye:', ...category.scope.included.map((item) => `  - ${item}`), '- Excluye:', ...category.scope.excluded.map((item) => `  - ${item}`), '', '#### Linaje del snapshot', '', `- Ranking: \`${category.ranking.snapshotId}\`; estado: \`${category.ranking.snapshotStatus}\`; data_version: \`${category.ranking.dataVersion}\`; algorithm_version: \`${category.ranking.algorithmVersion}\`; content_sha256: \`${category.ranking.contentSha256}\`.`, `- Fuente: \`${category.source.snapshotId}\`; ${category.source.name}; rights_status: **${category.source.rightsStatus}**.`, `- Fuente content_sha256: \`${category.source.contentSha256}\`.`, `- Cobertura: ${category.ranking.coverage.note}`, '', '#### Gates', '', '| Gate | Estado | Detalle |', '| --- | --- | --- |');
    for (const item of category.gates) lines.push(`| ${item.key} | **${item.status}** | ${markdownCell(item.detail)} |`);
    lines.push('', '#### Top 20: identidad, valor, posición, empate y media', '', '| Rank | Nombre canónico | Nombre fuente | Valor | Score | Tie group | Identidad | Jugable | Media |', '| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |');
    for (const entry of category.ranking.top20) lines.push(`| ${entry.rank} | ${markdownCell(entry.canonicalName)} | ${markdownCell(entry.sourceName)} | ${entry.value} | ${entry.score} | ${entry.tieGroup} | ${entry.identityStatus} | ${entry.playable ? 'sí' : 'no'} | ${entry.mediaStatus} |`);
    lines.push('', `- Empates registrados: ${category.ranking.ordering.ties.length}. La regla es valor bruto exacto, mismo rank/tie_group y salto competitivo posterior.`, `- Medios: ${category.media.top20Licensed}/${category.ranking.top20.length} top 20 con retrato aprobado; ${category.media.priorityMissingApprovedPortraits} prioridades sin retrato aprobado; ${category.media.note}`, '', `#### Conflictos de contraste de alcance/definición (${category.scope.openConflicts.length})`, '', '| Jugador | Primaria | UEFA/contraste | Almacenado | Clasificación |', '| --- | ---: | ---: | ---: | --- |');
    if (category.scope.openConflicts.length === 0) lines.push('| — | — | — | — | Ninguno registrado. |');
    for (const conflict of category.scope.openConflicts) lines.push(`| ${markdownCell(conflict.player)} | ${markdownCell(conflict.primaryValue)} | ${markdownCell(conflict.officialValue)} | ${markdownCell(conflict.storedValue)} | ${markdownCell(conflict.classification)} |`);
    lines.push('', '#### Diferencias pendientes', '', '| Tipo | Código | Entidad | Detalle |', '| --- | --- | --- | --- |');
    if (category.pendingDifferences.length === 0) lines.push('| — | — | — | Ninguna registrada en los artefactos de validación. |');
    for (const difference of category.pendingDifferences) lines.push(`| ${markdownCell(difference.type)} | \`${difference.code}\` | ${markdownCell(difference.player ?? difference.entityId ?? 'general')} | ${markdownCell(difference.message)} |`);
    lines.push('', '');
  }
  lines.push('## Procedimiento de publicación preparado', '', 'El procedimiento está documentado, pero no se ha ejecutado en este bloque y requiere aprobación explícita posterior.', '', '1. Congelar los artefactos de evidencia y verificar sus hashes, `data_version`, `algorithm_version`, `content_sha256`, watermark e IDs de snapshots.', '2. Crear una nueva versión append-only si cambia cualquier valor, alcance o metadato. Nunca editar ni borrar snapshots históricos.', '3. Ejecutar todos los gates en una base aislada y adjuntar el resultado al `runId` de la propuesta.', '4. Con aprobación explícita, abrir una transacción y adquirir un advisory lock por categoría.', '5. Volver a validar derechos, cobertura, identidades, scores, entradas, imágenes y que el candidato continúa en el estado esperado.', '6. Cambiar el candidato aprobado a `published` y el snapshot publicado anterior a `superseded` dentro de la misma transacción; hacer `COMMIT` solo si todas las validaciones pasan.', '7. Registrar actor, motivo, timestamp, IDs, hashes y resultado. Si falla cualquier precondición, hacer `ROLLBACK`.', '', '### Reversión', '', 'La reversión no edita el contenido publicado: publica de nuevo, mediante otra transacción auditada y con aprobación explícita, el snapshot anterior conservado, y marca el actual como `superseded`. El snapshot original y sus hashes permanecen intactos.', '', '## Recomendación', '', ...report.blockingReasons.map((reason) => `- \`${reason}\``), '', 'No publicar ninguno de los dos candidatos. Champions mantiene 12 conflictos de contraste además de derechos y alcance no aprobados. Mundial mantiene derechos no aprobados, evidencia temporal/partido pendiente y 17 prioridades del top 20 sin retrato aprobado.', '');
  return lines.join('\n');
}

export { TARGET_CATEGORIES, sha256, stableJson };
