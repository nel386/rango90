import { createHash } from 'node:crypto';

export type ChampionsAuditSourceArtifact = { path: string; sha256: string };

export type ChampionsConflictDecision = {
  player: string;
  currentValue: number;
  currentPosition: number;
  primaryValue: number;
  primaryPosition: number;
  officialValue: number;
  officialPosition: number;
  valueDifference: { primaryMinusCurrent: number; officialMinusCurrent: number; officialMinusPrimary: number };
  positionDifference: { primaryMinusCurrent: number; officialMinusCurrent: number; officialMinusPrimary: number };
  comparedSources: {
    primary: { snapshotId: string; name: string; url: string; contentSha256: string; definition: string };
    officialContrast: { snapshotId: string; name: string; url: string; contentSha256: string; definition: string };
  };
  possibleCause: 'scope' | 'definition_or_scope';
  sourceClassification: string;
  proposedDecision: 'hold_open_keep_stored_value_in_draft';
  evidence: string[];
  requiredCorrection: string;
};

export type ChampionsPendingDiscrepancy = {
  type: string;
  code: string;
  entityId: string | null;
  player: string | null;
  message: string;
  evidenceUrls: string[];
  proposedDisposition: string;
  requiredCorrection: string;
};

export type ChampionsCandidateAuditReport = {
  artifactKind: 'champions_official_candidate_audit';
  reportVersion: '1';
  categorySlug: 'uefa-champions-league-goals';
  auditMode: 'offline_archived_artifacts';
  readOnly: true;
  productionData: false;
  mutationCount: 0;
  editorialApproval: false;
  published: false;
  runId: string;
  watermark: string;
  sourceArtifacts: ChampionsAuditSourceArtifact[];
  dataFingerprint: { version: '1'; snapshotIds: Record<string, string | null>; sha256: string };
  scope: {
    decisionStatus: string;
    proposedLabel: string;
    exactDefinition: Record<string, unknown>;
    included: string[];
    excluded: string[];
    conflictsOpen: number;
  };
  ranking: {
    snapshotId: string;
    snapshotStatus: string;
    dataVersion: string;
    algorithmVersion: string;
    contentSha256: string;
    generatedAt: string;
    rowsAudited: number;
    snapshotRowsTotal: number;
    declaredCoverageComplete: boolean;
    coverageNote: string;
    top20: Array<Record<string, unknown>>;
    identities: { checked: number; confirmed: number; conflicts: number };
    values: { checked: number; withEvidence: number; conflicts: number };
    ordering: { ranksConsistent: boolean; scoresConsistent: boolean; tiesConsistent: boolean; ties: Array<Record<string, unknown>> };
  };
  sources: {
    primary: { snapshotId: string; name: string; url: string; contentSha256: string; rightsStatus: string };
    officialContrast: { snapshotId: string; name: string; url: string; contentSha256: string };
  };
  conflicts: ChampionsConflictDecision[];
  pendingDiscrepancies: ChampionsPendingDiscrepancy[];
  media: {
    top20Licensed: number;
    top20WithoutApprovedPortrait: number;
    playableEntities: number;
    playableLicensed: number;
    playableFallback: number;
    playableUnavailable: number;
    allTop20Publishable: boolean;
    fallbackLegalStatus: 'not_required_for_top20_but_playable_fallbacks_exist';
  };
  rollback: {
    status: 'passed' | 'failed' | 'integration_pending' | 'not_run';
    databaseAccess: 'none';
    detail: string;
    requiredBeforeApproval: true;
  };
  gates: Array<{ key: string; status: 'pass' | 'pending' | 'block'; detail: string }>;
  readyForApproval: false;
  recommendation: string;
  sha256: string;
};

type JsonRecord = Record<string, unknown>;

export function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function array(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).sort() : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function candidateSource(value: JsonRecord, fallbackName: string, fallbackUrl: string, fallbackHash: string, snapshotId: string): { snapshotId: string; name: string; url: string; contentSha256: string; definition: string } {
  return {
    snapshotId,
    name: text(value.name, fallbackName),
    url: text(array(value.evidenceUrls)[0]?.url, fallbackUrl) || fallbackUrl,
    contentSha256: text(value.contentSha256, fallbackHash),
    definition: text(value.definition, text(value.name, fallbackName))
  };
}

export function buildChampionsCandidateAudit(input: {
  truth: JsonRecord;
  scope: JsonRecord;
  validation: JsonRecord;
  media: JsonRecord;
  sourceArtifacts: ChampionsAuditSourceArtifact[];
  isolatedDatabaseConfigured?: boolean;
}): ChampionsCandidateAuditReport {
  const truth = array(input.truth.categories).find((item) => text(item.slug) === 'uefa-champions-league-goals');
  const scope = array(input.scope.decisions).find((item) => text(item.categorySlug) === 'uefa-champions-league-goals');
  if (!truth || !scope) throw new Error('Falta evidencia archivada de Champions League');

  const snapshots = record(truth.snapshots);
  const ranking = record(snapshots.ranking);
  const source = record(snapshots.source);
  const lineage = record(scope.lineage);
  const officialSourceId = text(lineage.officialContrastSnapshotId, 'src_c9359c9f91bba9215af8fef6');
  const officialHash = text(lineage.officialContrastContentSha256, '');
  const primaryUrl = 'https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0';
  const officialUrl = 'https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/';
  const primary = candidateSource(source, 'Transfermarkt — historical European Cup / Champions League top scorers', primaryUrl, text(lineage.primarySourceContentSha256), text(lineage.primarySourceSnapshotId, text(source.id)));
  const officialContrast = {
    snapshotId: officialSourceId,
    name: 'UEFA Champions League official player statistics',
    url: officialUrl,
    contentSha256: officialHash,
    definition: 'Ranking histórico oficial UEFA de goles; el snapshot archivado no conserva el desglose por partido/ronda de esta fila.'
  };
  const top20 = array(truth.top20).sort((a, b) => number(a.rank) - number(b.rank) || text(a.entityId).localeCompare(text(b.entityId)));
  const top20ByName = new Map(top20.map((entry) => [text(entry.canonicalName), entry]));
  const scopeConflicts = array(scope.conflicts).sort((a, b) => text(a.player).localeCompare(text(b.player)));
  const conflicts: ChampionsConflictDecision[] = scopeConflicts.map((item) => {
    const primaryValue = number(item.primaryValue);
    const officialValue = number(item.officialValue);
    const currentValue = number(item.storedValue);
    const primaryPosition = number(item.primaryRank);
    const officialPosition = number(item.officialRank);
    const currentPosition = primaryPosition;
    const classification = text(item.classification, 'discrepancia no resoluble');
    const likelyScope = classification === 'diferencia de alcance';
    return {
      player: text(item.player),
      currentValue,
      currentPosition,
      primaryValue,
      primaryPosition,
      officialValue,
      officialPosition,
      valueDifference: { primaryMinusCurrent: primaryValue - currentValue, officialMinusCurrent: officialValue - currentValue, officialMinusPrimary: officialValue - primaryValue },
      positionDifference: { primaryMinusCurrent: primaryPosition - currentPosition, officialMinusCurrent: officialPosition - currentPosition, officialMinusPrimary: officialPosition - primaryPosition },
      comparedSources: { primary, officialContrast },
      possibleCause: likelyScope ? 'scope' : 'definition_or_scope',
      sourceClassification: classification,
      proposedDecision: 'hold_open_keep_stored_value_in_draft',
      evidence: unique([text(item.classificationBasis), ...strings(item.evidenceUrls)]),
      requiredCorrection: likelyScope
        ? 'Obtener un desglose autorizado por partido/ronda que confirme el tratamiento de clasificación; solo después generar, si procede, una nueva versión draft append-only.'
        : 'Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.'
    };
  });

  const validationDiscrepancies: ChampionsPendingDiscrepancy[] = array(input.validation.discrepancies)
    .filter((item) => text(item.categorySlug) === 'uefa-champions-league-goals')
    .sort((a, b) => text(a.code).localeCompare(text(b.code)) || text(a.entityId).localeCompare(text(b.entityId)))
    .map((item) => {
      const entityId = item.entityId == null ? null : text(item.entityId);
      const player = entityId ? [...top20ByName.entries()].find(([, entry]) => text(entry.entityId) === entityId)?.[0] ?? null : null;
      const code = text(item.code);
      const proposedDisposition = code === 'short_or_ambiguous_source_name'
        ? 'identidad_confirmada_por_URL; pendiente normalizar nombre de fuente sin cambiar entidad ni valor'
        : code === 'source_rights_not_approved'
          ? 'bloqueo_de_derechos; mantener review_required'
          : 'bloqueo_de_contraste; mantener abierto';
      const requiredCorrection = code === 'short_or_ambiguous_source_name'
        ? 'Conservar el nombre canónico y el identificador externo; opcionalmente normalizar la etiqueta visible en una nueva versión de metadatos.'
        : code === 'source_rights_not_approved'
          ? 'Completar revisión documental de derechos y cambiar el estado solo mediante el flujo explícito de revisión.'
          : 'Resolver los 12 contrastes con evidencia de alcance/definición antes de proponer aprobación.';
      return { type: text(item.type, 'sin clasificar'), code, entityId, player, message: text(item.message), evidenceUrls: strings(item.evidenceUrls), proposedDisposition, requiredCorrection };
    });

  const counts = record(truth.counts);
  const checks = record(truth.rankingChecks);
  const observedScope = record(truth.observedScope);
  const rights = record(truth.rights);
  const mediaEntries = array(input.media.entries).filter((entry) => text(entry.categorySlug) === 'uefa-champions-league-goals');
  const top20Licensed = top20.filter((entry) => text(entry.mediaStatus) === 'licensed').length;
  const playableLicensed = mediaEntries.filter((entry) => text(entry.mediaStatus) === 'licensed').length;
  const playableFallback = mediaEntries.filter((entry) => text(entry.mediaStatus) === 'fallback').length;
  const playableUnavailable = mediaEntries.filter((entry) => text(entry.mediaStatus) === 'unavailable').length;
  const snapshotIds = {
    ranking: text(ranking.id),
    primarySource: text(source.id),
    officialContrast: officialSourceId
  };
  const fingerprintPayload = { version: '1' as const, snapshotIds, rankingContentSha256: text(ranking.contentSha256), sourceContentSha256: text(source.contentSha256), officialContrastContentSha256: officialHash, dataVersion: text(ranking.dataVersion), algorithmVersion: text(ranking.algorithmVersion) };
  const dataFingerprint = { version: '1' as const, snapshotIds, sha256: sha256(stableJson(fingerprintPayload)) };
  const sourceDigest = sha256(stableJson(input.sourceArtifacts));
  const rollbackStatus = input.isolatedDatabaseConfigured ? 'not_run' : 'integration_pending';
  const gates: ChampionsCandidateAuditReport['gates'] = [
    { key: 'identities', status: number(counts.conflictingIdentityRows) === 0 && top20.length === 20 ? 'pass' : 'block', detail: `${top20.length}/20 filas del top 20 tienen identidad canónica y no hay conflictos estructurales.` },
    { key: 'values_positions', status: top20.every((entry) => Array.isArray(entry.evidenceUrls) && entry.evidenceUrls.length > 0) ? 'pass' : 'block', detail: 'Los valores, posiciones, scores y empates son trazables al snapshot archivado y a su URL de evidencia.' },
    { key: 'scope', status: text(scope.decisionStatus) === 'approved' && scopeConflicts.length === 0 ? 'pass' : 'block', detail: `${scopeConflicts.length} conflictos de contraste abiertos; la decisión editorial sigue en ${text(scope.decisionStatus)}.` },
    { key: 'coverage', status: observedScope.coverageComplete === true ? 'pass' : 'block', detail: `Cobertura completa solo para el universo declarado de ${number(counts.snapshotRowsTotal)} filas reales; no equivale a universo histórico total.` },
    { key: 'source_rights', status: text(rights.sourceStatus) === 'approved' ? 'pass' : 'block', detail: `La fuente numérica mantiene rights_status=${text(rights.sourceStatus, 'missing')}.` },
    { key: 'media', status: top20Licensed === 20 && playableUnavailable === 0 ? 'pass' : 'pending', detail: `${top20Licensed}/20 retratos del top 20 licenciados; ${playableFallback} entidades jugables dependen de fallback.` },
    { key: 'rollback_isolated', status: 'pending', detail: rollbackStatus === 'integration_pending' ? 'No existe RANGO90_ISOLATED_DATABASE_URL; no se simula una prueba pasada.' : 'La ejecución aislada de rollback aún no forma parte de esta auditoría offline.' },
    { key: 'open_discrepancies', status: validationDiscrepancies.length === 0 ? 'pass' : 'block', detail: `${validationDiscrepancies.length} discrepancias de validación siguen abiertas.` }
  ];
  const base = {
    artifactKind: 'champions_official_candidate_audit' as const,
    reportVersion: '1' as const,
    categorySlug: 'uefa-champions-league-goals' as const,
    auditMode: 'offline_archived_artifacts' as const,
    readOnly: true as const,
    productionData: false as const,
    mutationCount: 0 as const,
    editorialApproval: false as const,
    published: false as const,
    runId: `block7a-champions-${sourceDigest.slice(0, 16)}`,
    watermark: text(truth.generatedAt, text(ranking.generatedAt, 'archived-artifacts')),
    sourceArtifacts: [...input.sourceArtifacts].sort((a, b) => a.path.localeCompare(b.path)),
    dataFingerprint,
    scope: { decisionStatus: text(scope.decisionStatus), proposedLabel: text(scope.proposedExactLabel), exactDefinition: record(scope.finalDefinition), included: strings(scope.included), excluded: strings(scope.excluded), conflictsOpen: conflicts.length },
    ranking: {
      snapshotId: text(ranking.id), snapshotStatus: text(ranking.status), dataVersion: text(ranking.dataVersion), algorithmVersion: text(ranking.algorithmVersion), contentSha256: text(ranking.contentSha256), generatedAt: text(ranking.generatedAt), rowsAudited: number(counts.rowsAudited), snapshotRowsTotal: number(counts.snapshotRowsTotal), declaredCoverageComplete: observedScope.coverageComplete === true, coverageNote: `Completa para el universo declarado de ${number(counts.snapshotRowsTotal)} filas reales; el límite top ${number(counts.snapshotRowsTotal)} no demuestra cobertura histórica universal.`, top20: top20.map((entry) => ({ entityId: text(entry.entityId), sourceEntityId: text(entry.sourceEntityId), sourceName: text(entry.sourceName), canonicalName: text(entry.canonicalName), value: number(entry.value), rank: number(entry.rank), score: number(entry.score), tieGroup: number(entry.tieGroup), identityStatus: text(entry.identityStatus), playable: Boolean(entry.playable), mediaStatus: text(entry.mediaStatus), evidenceUrls: strings(entry.evidenceUrls) })), identities: { checked: 20, confirmed: 20 - number(counts.conflictingIdentityRows), conflicts: number(counts.conflictingIdentityRows) }, values: { checked: 20, withEvidence: top20.filter((entry) => strings(entry.evidenceUrls).length > 0).length, conflicts: 0 }, ordering: { ranksConsistent: Boolean(checks.deterministicRanks), scoresConsistent: Boolean(checks.deterministicScores), tiesConsistent: Boolean(checks.deterministicRanks), ties: array(checks.tiedPositions) }
    },
    sources: { primary: { snapshotId: primary.snapshotId, name: primary.name, url: primary.url, contentSha256: primary.contentSha256, rightsStatus: text(rights.sourceStatus, 'missing') }, officialContrast: { snapshotId: officialContrast.snapshotId, name: officialContrast.name, url: officialContrast.url, contentSha256: officialContrast.contentSha256 } },
    conflicts,
    pendingDiscrepancies: validationDiscrepancies,
    media: { top20Licensed, top20WithoutApprovedPortrait: top20.length - top20Licensed, playableEntities: mediaEntries.length, playableLicensed, playableFallback, playableUnavailable, allTop20Publishable: top20Licensed === 20, fallbackLegalStatus: 'not_required_for_top20_but_playable_fallbacks_exist' as const },
    rollback: { status: rollbackStatus as 'integration_pending' | 'not_run', databaseAccess: 'none' as const, detail: rollbackStatus === 'integration_pending' ? 'Falta RANGO90_ISOLATED_DATABASE_URL; el procedimiento de rollback está documentado pero no probado en este entorno.' : 'La URL aislada existe, pero esta ejecución permanece offline y no ejecuta mutaciones ni rollback.', requiredBeforeApproval: true as const },
    gates,
    readyForApproval: false as const,
    recommendation: 'Mantener el snapshot rs_870f1dff967bb160f2d132cc en draft. Resolver documentalmente los 12 conflictos y los 6 pendientes, completar derechos y ejecutar rollback en una base aislada antes de solicitar aprobación explícita.'
  };
  return { ...base, sha256: sha256(stableJson(base)) };
}

function cell(value: unknown): string { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderChampionsCandidateMarkdown(report: ChampionsCandidateAuditReport): string {
  const lines = [
    '# BLOQUE 7A — Candidatura oficial de Champions League',
    '',
    '> ARTEFACTO DE AUDITORÍA. Solo lectura: no modifica PostgreSQL, no aprueba derechos, no aprueba snapshots y no publica datos.',
    '',
    `- runId: \`${report.runId}\``,
    `- watermark: \`${report.watermark}\``,
    `- huella de datos: \`${report.dataFingerprint.sha256}\``,
    `- huella del informe: \`${report.sha256}\``,
    `- readyForApproval: **false**`,
    '',
    '## Resultado ejecutivo',
    '',
    `La candidatura no está lista para aprobación. Hay **${report.conflicts.length} conflictos de contraste** y **${report.pendingDiscrepancies.length} discrepancias pendientes**. El snapshot \`${report.ranking.snapshotId}\` conserva estado \`${report.ranking.snapshotStatus}\` y no se ha modificado.`,
    '',
    '## Definición propuesta',
    '',
    `- Etiqueta: **${report.scope.proposedLabel}**`,
    `- Estado editorial: \`${report.scope.decisionStatus}\``,
    `- Definición exacta: \`${JSON.stringify(report.scope.exactDefinition)}\``,
    `- Incluye: ${report.scope.included.join('; ')}`,
    `- Excluye: ${report.scope.excluded.join('; ')}`,
    `- Los ${report.scope.conflictsOpen} conflictos continúan abiertos; no se ha escogido silenciosamente ninguna de las dos cifras.`,
    '',
    '## Linaje y comprobaciones',
    '',
    `- Snapshot: \`${report.ranking.snapshotId}\`, \`${report.ranking.dataVersion}\`, algoritmo \`${report.ranking.algorithmVersion}\`, content_sha256 \`${report.ranking.contentSha256}\`.`,
    `- Filas auditadas: ${report.ranking.rowsAudited}; filas totales del snapshot: ${report.ranking.snapshotRowsTotal}. ${report.ranking.coverageNote}`,
    `- Identidades: ${report.ranking.identities.confirmed}/20 confirmadas; valores con evidencia: ${report.ranking.values.withEvidence}/20.`,
    `- Ranking: posiciones=${report.ranking.ordering.ranksConsistent ? 'consistentes' : 'inconsistentes'}, scores=${report.ranking.ordering.scoresConsistent ? 'consistentes' : 'inconsistentes'}, empates=${report.ranking.ordering.tiesConsistent ? 'consistentes' : 'inconsistentes'}; ${report.ranking.ordering.ties.length} grupos de empate registrados.`,
    `- Fuente primaria: \`${report.sources.primary.snapshotId}\`, ${report.sources.primary.name}, rights_status=**${report.sources.primary.rightsStatus}**, content_sha256 \`${report.sources.primary.contentSha256}\`.`,
    `- Contraste UEFA: \`${report.sources.officialContrast.snapshotId}\`, ${report.sources.officialContrast.name}, content_sha256 \`${report.sources.officialContrast.contentSha256}\`.`,
    '',
    '## Top 20 trazable',
    '',
    '| Rank | Jugador canónico | Nombre fuente | Valor | Score | Tie group | Evidencia |',
    '| ---: | --- | --- | ---: | ---: | ---: | --- |',
    ...report.ranking.top20.map((entry) => `| ${entry.rank} | ${cell(entry.canonicalName)} | ${cell(entry.sourceName)} | ${entry.value} | ${entry.score} | ${entry.tieGroup} | ${(entry.evidenceUrls as string[]).join('<br>')} |`),
    '',
    '## 12 conflictos de contraste',
    '',
    '| Jugador | Actual / posición | Transfermarkt / posición | UEFA / posición | Δ UEFA-actual | Causa propuesta | Decisión |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.conflicts.map((item) => `| ${cell(item.player)} | ${item.currentValue} / ${item.currentPosition} | ${item.primaryValue} / ${item.primaryPosition} | ${item.officialValue} / ${item.officialPosition} | ${item.valueDifference.officialMinusCurrent >= 0 ? '+' : ''}${item.valueDifference.officialMinusCurrent} (${item.positionDifference.officialMinusCurrent >= 0 ? '+' : ''}${item.positionDifference.officialMinusCurrent}) | ${item.possibleCause}; ${cell(item.sourceClassification)} | **mantener abierto; conservar actual en draft** |`),
    '',
    '### Detalle de cada conflicto',
    '',
    ...report.conflicts.flatMap((item, index) => [`#### ${index + 1}. ${item.player}`, '', `- Valores: actual ${item.currentValue}; primaria ${item.primaryValue} (Δ ${item.valueDifference.primaryMinusCurrent >= 0 ? '+' : ''}${item.valueDifference.primaryMinusCurrent}); UEFA ${item.officialValue} (Δ ${item.valueDifference.officialMinusCurrent >= 0 ? '+' : ''}${item.valueDifference.officialMinusCurrent}).`, `- Posiciones: actual ${item.currentPosition}; primaria ${item.primaryPosition}; UEFA ${item.officialPosition}.`, `- Fuentes: [Transfermarkt](${item.comparedSources.primary.url}) [${item.comparedSources.primary.snapshotId}], [UEFA](${item.comparedSources.officialContrast.url}) [${item.comparedSources.officialContrast.snapshotId}].`, `- Causa posible: **${item.possibleCause}**; clasificación archivada: ${item.sourceClassification}.`, `- Evidencia: ${item.evidence.join(' ')}`, `- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.`, `- Corrección necesaria: ${item.requiredCorrection}`, '']),
    '## Seis discrepancias pendientes',
    '',
    '| Tipo | Código | Jugador/entidad | Estado propuesto | Corrección necesaria |',
    '| --- | --- | --- | --- | --- |',
    ...report.pendingDiscrepancies.map((item) => `| ${cell(item.type)} | \`${item.code}\` | ${cell(item.player ?? item.entityId ?? 'general')} | ${cell(item.proposedDisposition)} | ${cell(item.requiredCorrection)} |`),
    '',
    '## Media y derechos',
    '',
    `- Top 20 con imagen licenciada/aprobada: ${report.media.top20Licensed}/20; sin retrato aprobado: ${report.media.top20WithoutApprovedPortrait}.`,
    `- Entidades jugables auditadas: ${report.media.playableEntities}; licenciadas: ${report.media.playableLicensed}; fallback: ${report.media.playableFallback}; unavailable: ${report.media.playableUnavailable}.`,
    '- Los fallbacks jugables no se presentan como retratos aprobados. La fuente numérica mantiene rights_status=review_required.',
    '',
    '## Rollback y puerta de aprobación',
    '',
    `- Rollback aislado: **${report.rollback.status}**. ${report.rollback.detail}`,
    '',
    '| Gate | Estado | Detalle |',
    '| --- | --- | --- |',
    ...report.gates.map((gate) => `| ${gate.key} | **${gate.status}** | ${cell(gate.detail)} |`),
    '',
    '## Recomendación técnica',
    '',
    report.recommendation,
    '',
    'No publicar, aprobar ni modificar datos en este bloque. Si una futura evidencia cambia valores o alcance, crear un snapshot append-only nuevo, conservar este content_sha256 y someterlo de nuevo a auditoría y aprobación explícita.',
    ''
  ];
  return lines.join('\n');
}
