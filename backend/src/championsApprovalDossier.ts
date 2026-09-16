import { createHash } from 'node:crypto';

export type DossierStatus = 'resolved_editorially' | 'blocked';

export type ConflictResolutionRow = {
  player: string;
  currentValue: number;
  currentPosition: number;
  primaryValue: number;
  primaryPosition: number;
  officialValue: number;
  officialPosition: number;
  valueDifference: { primaryMinusCurrent: number; officialMinusCurrent: number; officialMinusPrimary: number };
  positionDifference: { primaryMinusCurrent: number; officialMinusCurrent: number; officialMinusPrimary: number };
  classification: string;
  possibleCause: string;
  status: 'blocked';
  proposedDecision: string;
  evidence: string[];
  requiredCorrection: string;
};

export type PendingResolutionRow = {
  type: string;
  code: string;
  player: string | null;
  entityId: string | null;
  status: DossierStatus;
  resolution: string;
  requiredAction: string;
  evidenceUrls: string[];
};

export type ChampionsApprovalDossier = {
  artifactKind: 'champions_official_approval_dossier';
  reportVersion: '1';
  categorySlug: 'uefa-champions-league-goals';
  readOnly: true;
  productionData: false;
  mutationCount: 0;
  editorialApproval: false;
  published: false;
  runId: string;
  watermark: string;
  inputAudit: { path: string; sha256: string; runId: string; dataFingerprint: string };
  scopeDecision: {
    version: 'uefa-champions-league-goals-v2';
    status: 'proposed_not_approved';
    accepted: false;
    label: string;
    definition: Record<string, unknown>;
    authority: string;
    rationale: string;
  };
  sourceDecision: {
    semanticAuthority: string;
    numericSource: string;
    numericSourceStatus: 'provisional_pending_rights';
    conflictPolicy: string;
    rightsStatus: string;
    rightsDecision: 'blocked_pending_documented_review';
  };
  historicalVsPlayable: {
    historicalRankingKeepsAllSnapshotRows: true;
    challengeUsesPlayableOnly: true;
    noHistoricalRowsSubstituted: true;
  };
  rankingChecks: {
    snapshotId: string;
    snapshotStatus: string;
    contentSha256: string;
    dataVersion: string;
    algorithmVersion: string;
    top20Identities: string;
    top20ValuesWithEvidence: string;
    coverage: string;
    orderingAndTies: string;
  };
  conflictMatrix: { total: 12; blocked: 12; rows: ConflictResolutionRow[] };
  pendingResolutions: { total: 6; editoriallyResolved: 3; blocked: 3; rows: PendingResolutionRow[] };
  media: {
    top20Licensed: number;
    top20WithoutApprovedPortrait: number;
    playableEntities: number;
    playableLicensed: number;
    playableFallback: number;
    playableUnavailable: number;
    policy: string;
  };
  isolatedValidation: {
    status: 'passed' | 'failed' | 'integration_pending' | 'not_run';
    required: true;
    databaseAccess: 'none';
    detail: string;
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

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).sort() : [];
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asRows(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

export function buildChampionsApprovalDossier(input: {
  audit: JsonRecord;
  auditSha256: string;
  isolatedDatabaseConfigured?: boolean;
}): ChampionsApprovalDossier {
  const audit = input.audit;
  const scope = asRecord(audit.scopeDecision ?? audit.scope);
  const ranking = asRecord(audit.ranking);
  const sources = asRecord(audit.sources);
  const primary = asRecord(sources.primary);
  const conflicts = asRows(audit.conflicts).map((row): ConflictResolutionRow => ({
    player: asString(row.player),
    currentValue: asNumber(row.currentValue),
    currentPosition: asNumber(row.currentPosition),
    primaryValue: asNumber(row.primaryValue),
    primaryPosition: asNumber(row.primaryPosition),
    officialValue: asNumber(row.officialValue),
    officialPosition: asNumber(row.officialPosition),
    valueDifference: asRecord(row.valueDifference) as ConflictResolutionRow['valueDifference'],
    positionDifference: asRecord(row.positionDifference) as ConflictResolutionRow['positionDifference'],
    classification: asString(row.sourceClassification),
    possibleCause: asString(row.possibleCause),
    status: 'blocked',
    proposedDecision: 'No escoger Transfermarkt ni UEFA de forma automática; conservar el valor actual en draft hasta obtener evidencia por partido/ronda o una reconciliación autorizada.',
    evidence: asStringArray(row.evidence),
    requiredCorrection: asString(row.requiredCorrection)
  }));
  const pendingRows = asRows(audit.pendingDiscrepancies).map((row): PendingResolutionRow => {
    const code = asString(row.code);
    const identity = code === 'short_or_ambiguous_source_name';
    return {
      type: asString(row.type),
      code,
      player: row.player == null ? null : asString(row.player),
      entityId: row.entityId == null ? null : asString(row.entityId),
      status: identity ? 'resolved_editorially' : 'blocked',
      resolution: identity
        ? 'Identidad confirmada mediante el perfil externo archivado; normalización de nombre propuesta solo para una futura versión de metadatos, sin alterar entidad ni valor.'
        : asString(row.proposedDisposition),
      requiredAction: asString(row.requiredCorrection),
      evidenceUrls: asStringArray(row.evidenceUrls)
    };
  });
  if (conflicts.length !== 12) throw new Error(`Se esperaban 12 conflictos de Champions; recibidos: ${conflicts.length}`);
  if (pendingRows.length !== 6) throw new Error(`Se esperaban 6 discrepancias de Champions; recibidas: ${pendingRows.length}`);
  if (pendingRows.filter((row) => row.status === 'resolved_editorially').length !== 3) throw new Error('Se esperaban 3 discrepancias editoriales resueltas');
  const media = asRecord(audit.media);
  const isolatedStatus = input.isolatedDatabaseConfigured ? 'not_run' : 'integration_pending';
  const gates: ChampionsApprovalDossier['gates'] = [
    { key: 'scope_definition', status: 'block', detail: 'La definición está documentada como propuesta, pero no aprobada; permanecen 12 conflictos de contraste.' },
    { key: 'ranking_traceability', status: 'pass', detail: 'Top 20 con identidades y valores respaldados por el snapshot archivado; scores y empates son deterministas.' },
    { key: 'coverage', status: 'pass', detail: 'Completa para las 200 filas reales declaradas en el snapshot, sin afirmar universo histórico ilimitado.' },
    { key: 'source_rights', status: 'block', detail: `La fuente numérica mantiene rights_status=${asString(primary.rightsStatus, 'missing')}; requiere revisión documentada.` },
    { key: 'media_policy', status: asNumber(media.playableUnavailable) === 0 ? 'pass' : 'block', detail: `${asNumber(media.top20Licensed)}/20 retratos del top 20 licenciados; los fallbacks jugables no se presentan como retratos aprobados.` },
    { key: 'conflicts', status: 'block', detail: 'Los 12 contrastes siguen bloqueados por falta de evidencia suficiente para resolver alcance/definición.' },
    { key: 'isolated_publish_rollback', status: 'pending', detail: isolatedStatus === 'integration_pending' ? 'No existe RANGO90_ISOLATED_DATABASE_URL; no se simula una publicación ni rollback pasados.' : 'La URL aislada existe, pero esta generación offline no ejecuta la prueba transaccional.' }
  ];
  const base = {
    artifactKind: 'champions_official_approval_dossier' as const,
    reportVersion: '1' as const,
    categorySlug: 'uefa-champions-league-goals' as const,
    readOnly: true as const,
    productionData: false as const,
    mutationCount: 0 as const,
    editorialApproval: false as const,
    published: false as const,
    runId: `block7b-champions-${input.auditSha256.slice(0, 16)}`,
    watermark: asString(audit.watermark, 'archived-artifacts'),
    inputAudit: { path: 'audits/block7a/champions-conflict-audit.json', sha256: input.auditSha256, runId: asString(audit.runId), dataFingerprint: asString(asRecord(audit.dataFingerprint).sha256) },
    scopeDecision: { version: 'uefa-champions-league-goals-v2' as const, status: 'proposed_not_approved' as const, accepted: false as const, label: asString(scope.proposedLabel), definition: asRecord(scope.exactDefinition), authority: 'UEFA para semántica de competición y rondas; Transfermarkt solo como fuente numérica provisional mientras rights_status no sea approved.', rationale: 'La definición Copa de Europa + Champions masculina desde 1955/56, solo torneo principal y sin clasificación evita mezclar alcances. Debe ser aprobada explícitamente.' },
    sourceDecision: { semanticAuthority: 'UEFA oficial para la semántica de competición y fases.', numericSource: `${asString(primary.name)} [${asString(primary.snapshotId)}]`, numericSourceStatus: 'provisional_pending_rights' as const, conflictPolicy: 'No mezclar, promediar ni sustituir valores por coincidencia parcial; resolver por alcance/definición con evidencia.', rightsStatus: asString(primary.rightsStatus, 'missing'), rightsDecision: 'blocked_pending_documented_review' as const },
    historicalVsPlayable: { historicalRankingKeepsAllSnapshotRows: true as const, challengeUsesPlayableOnly: true as const, noHistoricalRowsSubstituted: true as const },
    rankingChecks: { snapshotId: asString(ranking.snapshotId), snapshotStatus: asString(ranking.snapshotStatus), contentSha256: asString(ranking.contentSha256), dataVersion: asString(ranking.dataVersion), algorithmVersion: asString(ranking.algorithmVersion), top20Identities: `${asRecord(ranking.identities).confirmed ?? 0}/20 confirmadas`, top20ValuesWithEvidence: `${asRecord(ranking.values).withEvidence ?? 0}/20 con evidencia`, coverage: asString(ranking.coverageNote), orderingAndTies: `ranks=${asRecord(ranking.ordering).ranksConsistent === true}; scores=${asRecord(ranking.ordering).scoresConsistent === true}; ties=${asRecord(ranking.ordering).tiesConsistent === true}` },
    conflictMatrix: { total: 12 as const, blocked: 12 as const, rows: conflicts },
    pendingResolutions: { total: 6 as const, editoriallyResolved: 3 as const, blocked: 3 as const, rows: pendingRows },
    media: { top20Licensed: asNumber(media.top20Licensed), top20WithoutApprovedPortrait: asNumber(media.top20WithoutApprovedPortrait), playableEntities: asNumber(media.playableEntities), playableLicensed: asNumber(media.playableLicensed), playableFallback: asNumber(media.playableFallback), playableUnavailable: asNumber(media.playableUnavailable), policy: 'Retrato propio/licenciado/autorizado/dominio público o placeholder legal; no usar una imagen sin derechos para completar el ranking.' },
    isolatedValidation: { status: isolatedStatus as 'integration_pending' | 'not_run', required: true as const, databaseAccess: 'none' as const, detail: isolatedStatus === 'integration_pending' ? 'La prueba de publicación y rollback queda pendiente hasta disponer de RANGO90_ISOLATED_DATABASE_URL distinta de DATABASE_URL.' : 'Existe URL aislada, pero la generación del dossier no ejecuta transacciones.' },
    gates,
    readyForApproval: false as const,
    recommendation: 'No aprobar ni publicar. Solicitar revisión explícita de alcance y derechos, resolver o mantener formalmente bloqueados los 12 contrastes, y ejecutar la prueba de publicación/rollback en PostgreSQL aislado antes de una nueva solicitud de aprobación.'
  };
  return { ...base, sha256: sha256(stableJson(base)) };
}

function cell(value: unknown): string { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderChampionsApprovalMarkdown(dossier: ChampionsApprovalDossier): string {
  const lines = [
    '# BLOQUE 7B — Dossier de aprobación de Champions League',
    '',
    '> ARTEFACTO DE AUDITORÍA Y PROPUESTA EDITORIAL. No es una aprobación, no modifica datos, no cambia derechos y no publica snapshots.',
    '',
    `- runId: \`${dossier.runId}\``,
    `- watermark: \`${dossier.watermark}\``,
    `- auditoría de entrada: \`${dossier.inputAudit.runId}\` / \`${dossier.inputAudit.sha256}\``,
    `- huella del dossier: \`${dossier.sha256}\``,
    '- readyForApproval: **false**',
    '',
    '## Decisión de alcance versionada',
    '',
    `- Versión: \`${dossier.scopeDecision.version}\`; estado: **${dossier.scopeDecision.status}**.`,
    `- Etiqueta propuesta: **${dossier.scopeDecision.label}**`,
    `- Definición: \`${JSON.stringify(dossier.scopeDecision.definition)}\``,
    `- Autoridad: ${dossier.scopeDecision.authority}`,
    `- Justificación: ${dossier.scopeDecision.rationale}`,
    '',
    'La propuesta mide goles de jugadores en la Copa de Europa y UEFA Champions League masculina desde 1955/56, solo torneo principal/fase final y sin rondas de clasificación. El corte temporal exacto permanece en el snapshot archivado; la definición aún requiere confirmación editorial.',
    '',
    '## Fuente numérica y derechos',
    '',
    `- Fuente numérica provisional: ${dossier.sourceDecision.numericSource}.`,
    `- Estado: **${dossier.sourceDecision.numericSourceStatus}**; rights_status=**${dossier.sourceDecision.rightsStatus}**.`,
    `- Política: ${dossier.sourceDecision.conflictPolicy}`,
    '- Decisión de derechos: **bloqueada** hasta revisión documentada; no se cambia automáticamente a approved.',
    '',
    '## Ranking histórico frente a catálogo jugable',
    '',
    '- El ranking histórico conserva todas las filas del snapshot, incluidos jugadores no jugables.',
    '- El reto solo selecciona entidades `playable=true`.',
    '- No se eliminan ni sustituyen filas históricas para alterar posiciones.',
    '',
    '## Validación del snapshot',
    '',
    `- Snapshot: \`${dossier.rankingChecks.snapshotId}\`, estado \`${dossier.rankingChecks.snapshotStatus}\`, content_sha256 \`${dossier.rankingChecks.contentSha256}\`.`,
    `- data_version: \`${dossier.rankingChecks.dataVersion}\`; algorithm_version: \`${dossier.rankingChecks.algorithmVersion}\`.`,
    `- Identidades: ${dossier.rankingChecks.top20Identities}; valores: ${dossier.rankingChecks.top20ValuesWithEvidence}.`,
    `- Cobertura: ${dossier.rankingChecks.coverage}`,
    `- Orden y empates: ${dossier.rankingChecks.orderingAndTies}.`,
    '',
    '## Matriz de los 12 conflictos',
    '',
    '| Jugador | Actual | Transfermarkt | UEFA | Δ UEFA | Causa | Estado |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...dossier.conflictMatrix.rows.map((row) => `| ${cell(row.player)} (${row.currentPosition}) | ${row.currentValue} | ${row.primaryValue} (${row.primaryPosition}) | ${row.officialValue} (${row.officialPosition}) | ${row.valueDifference.officialMinusCurrent >= 0 ? '+' : ''}${row.valueDifference.officialMinusCurrent} | ${cell(row.possibleCause)} / ${cell(row.classification)} | **bloqueado** |`),
    '',
    'Los 12 casos conservan el valor actual en draft. No hay evidencia archivada suficiente para atribuir de forma concluyente las diferencias a alcance, rondas o criterio de contabilización. Cada fila del JSON contiene fuentes, diferencias exactas, evidencia y corrección requerida.',
    '',
    '## Resolución de las 6 discrepancias',
    '',
    '| Tipo | Código | Entidad | Estado | Resolución/acción |',
    '| --- | --- | --- | --- | --- |',
    ...dossier.pendingResolutions.rows.map((row) => `| ${cell(row.type)} | \`${row.code}\` | ${cell(row.player ?? row.entityId ?? 'general')} | **${row.status}** | ${cell(row.resolution)} |`),
    '',
    'Las tres etiquetas abreviadas quedan desambiguadas por sus perfiles archivados, pero la normalización visual se reserva para una futura versión sin cambiar IDs ni valores. Las discrepancias de fuente/alcance y derechos siguen bloqueadas.',
    '',
    '## Imágenes',
    '',
    `- Top 20 licenciados: ${dossier.media.top20Licensed}/20; sin retrato aprobado: ${dossier.media.top20WithoutApprovedPortrait}.`,
    `- Jugables: ${dossier.media.playableEntities}; licenciados: ${dossier.media.playableLicensed}; fallback: ${dossier.media.playableFallback}; unavailable: ${dossier.media.playableUnavailable}.`,
    `- ${dossier.media.policy}`,
    '',
    '## Puerta y QA aislado',
    '',
    ...dossier.gates.map((gate) => `- **${gate.key}: ${gate.status}** — ${cell(gate.detail)}`),
    `- Publicación/rollback aislado: **${dossier.isolatedValidation.status}** — ${dossier.isolatedValidation.detail}`,
    '',
    '## Recomendación',
    '',
    dossier.recommendation,
    '',
    'No ejecutar seeds, imports, aprobaciones ni cambios en la base real. Cualquier corrección futura debe crear una nueva versión append-only y volver a pasar la auditoría.',
    ''
  ];
  return lines.join('\n');
}
