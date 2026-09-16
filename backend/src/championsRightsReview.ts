import { createHash } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export type RightsAssessment = {
  provider: string;
  status: 'blocked' | 'conditional_not_approved' | 'candidate_open';
  evidenceUrls: string[];
  documentedFacts: string[];
  implicationForRango90: string;
  missingEvidence: string[];
};

export type ChampionsRightsReviewReport = {
  artifactKind: 'champions_source_scope_rights_review';
  reportVersion: '1';
  categorySlug: 'uefa-champions-league-goals';
  reviewDate: '2026-09-16';
  readOnly: true;
  productionData: false;
  mutationCount: 0;
  approvalsGranted: false;
  published: false;
  runId: string;
  inputAudit: { path: string; sha256: string; runId: string };
  scopeDecision: { version: 'uefa-champions-league-goals-v2'; status: 'proposed_not_approved'; definition: JsonRecord; decision: 'retain_proposed_scope_pending_explicit_editorial_confirmation' };
  currentDraftSource: { provider: 'Transfermarkt'; snapshotId: string; rightsStatus: 'review_required'; decision: 'retain_in_draft_only' };
  sourceAssessments: RightsAssessment[];
  conflictAssessment: { total: 12; scopeCompatibleCases: string[]; unresolvedCases: string[]; conclusion: string; requiredEvidence: string[] };
  identityAndMetadata: { totalPending: 6; identityDiscrepanciesDocumented: 3; identityStatus: 'canonical_ids_confirmed_by_archived_profile_urls'; dataChangeMade: false; remainingBlocks: string[] };
  media: { top20Licensed: number; top20WithoutApprovedPortrait: number; playableLicensed: number; playableFallback: number; playableUnavailable: number; policy: string };
  appendOnlyPlan: { newSnapshotCreated: false; createNewSnapshotWhen: string[]; preserveSnapshotIdsAndHashes: true };
  isolatedValidation: { status: 'integration_pending' | 'not_run'; required: true; detail: string };
  gates: Array<{ key: string; status: 'pass' | 'pending' | 'block'; detail: string }>;
  readyForApproval: false;
  recommendation: string;
  sha256: string;
};

export function stableJson(value: unknown): string { return JSON.stringify(value, null, 2) + '\n'; }
export function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function stringValue(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
function record(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function numberValue(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function records(value: unknown): JsonRecord[] { return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []; }

export function buildChampionsRightsReview(input: { audit: JsonRecord; auditSha256: string; isolatedDatabaseConfigured?: boolean }): ChampionsRightsReviewReport {
  const audit = input.audit;
  const scope = record(audit.scopeDecision ?? audit.scope);
  const ranking = record(audit.ranking ?? audit.rankingChecks);
  const media = record(audit.media);
  const inputRunId = stringValue(audit.runId);
  const rollbackStatus = input.isolatedDatabaseConfigured ? 'not_run' : 'integration_pending';
  const conflictMatrix = record(audit.conflictMatrix);
  const unresolved = records(audit.conflicts ?? conflictMatrix.rows).map((item) => stringValue(item.player));
  const base = {
    artifactKind: 'champions_source_scope_rights_review' as const,
    reportVersion: '1' as const,
    categorySlug: 'uefa-champions-league-goals' as const,
    reviewDate: '2026-09-16' as const,
    readOnly: true as const,
    productionData: false as const,
    mutationCount: 0 as const,
    approvalsGranted: false as const,
    published: false as const,
    runId: `block7c-champions-${input.auditSha256.slice(0, 16)}`,
    inputAudit: { path: 'audits/block7b/champions-approval-dossier.json', sha256: input.auditSha256, runId: inputRunId },
    scopeDecision: { version: 'uefa-champions-league-goals-v2' as const, status: 'proposed_not_approved' as const, definition: record(scope.exactDefinition ?? scope.definition), decision: 'retain_proposed_scope_pending_explicit_editorial_confirmation' as const },
    currentDraftSource: { provider: 'Transfermarkt' as const, snapshotId: stringValue(record(audit.currentDraftSource).snapshotId, stringValue(ranking.snapshotId)), rightsStatus: 'review_required' as const, decision: 'retain_in_draft_only' as const },
    sourceAssessments: [
      { provider: 'Transfermarkt', status: 'blocked' as const, evidenceUrls: ['https://www.transfermarkt.com/intern/anb', 'https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0'], documentedFacts: ['Los términos públicos prohíben acceder o copiar contenido digital mediante bots, spiders, screen scraping u otros procesos automatizados.', 'Los términos reservan derechos sobre programas, bases de datos y material para los fines de las licencias aplicables; no aparece una autorización pública específica para redistribuir este ranking derivado.'], implicationForRango90: 'La extracción archivada no demuestra derecho de redistribución. La fuente no puede pasar a approved para una aplicación pública con los documentos actuales.', missingEvidence: ['Contrato o permiso escrito que cubra extracción, almacenamiento de snapshots, ranking derivado, redistribución web/PWA/Android, atribución y uso comercial.', 'Confirmación expresa del corte sin clasificación de la definición v2.'] },
      { provider: 'API-Football / API-Sports', status: 'conditional_not_approved' as const, evidenceUrls: ['https://apifootball.com/terms_of_use/', 'https://www.api-football.com/pricing'], documentedFacts: ['Los términos públicos indican que la distribución, transferencia y almacenamiento de los datos del servicio están permitidos, pero prohíben revender el producto sin permiso previo.', 'Los términos tratan por separado el material del sitio y las imágenes/logos/videos, y responsabilizan al usuario de obtener la prueba de propiedad intelectual.', 'El repositorio no contiene contrato, plan contratado ni confirmación escrita que cubra este ranking histórico derivado desde 1955/56.'], implicationForRango90: 'Es un candidato condicional para datos, no una aprobación. El pago o la disponibilidad del endpoint no demuestra autorización para este snapshot histórico, ni resuelve los derechos de imágenes.', missingEvidence: ['Plan y cuenta contratados identificables.', 'Permiso escrito para snapshots derivados, caché/backups, exposición a usuarios, aplicación pública/comercial y Android.', 'Demostración de cobertura homogénea 1955/56–corte v2 y reconciliación de las 12 diferencias.', 'Derechos separados para imágenes, logos y marcas.'] },
      { provider: 'UEFA', status: 'blocked' as const, evidenceUrls: ['https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/', 'https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-2-Definitions-Online', 'https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-72-Commercial-rights-for-the-play-offs-and-UEFA-Champions-League-Online'], documentedFacts: ['La normativa UEFA define los data rights como el derecho a compilar y explotar estadísticas y otros datos de la competición.', 'La normativa atribuye a UEFA los derechos comerciales de la competición y distingue la fase de clasificación de los play-offs y la competición principal.', 'Una página oficial de estadísticas no proporciona por sí sola una licencia de redistribución para una aplicación de terceros.'], implicationForRango90: 'UEFA es autoridad semántica y posible fuente numérica definitiva, pero necesita autorización contractual o términos explícitos para el uso previsto.', missingEvidence: ['Licencia o permiso escrito para publicar el ranking derivado, almacenar snapshots, usar nombres/estadísticas y operar en web/PWA/Android.', 'Definición autorizada por fila o exportación que explique las diferencias frente a Transfermarkt.'] },
      { provider: 'Wikidata', status: 'candidate_open' as const, evidenceUrls: ['https://www.wikidata.org/wiki/Wikidata:Licensing', 'https://www.wikidata.org/wiki/Wikidata:Reuse'], documentedFacts: ['Los datos estructurados de Wikidata se ofrecen bajo CC0 según su documentación de licenciamiento.', 'La documentación no demuestra cobertura ni exactitud para este ranking histórico de goles.'], implicationForRango90: 'Puede apoyar identidad y metadatos; no es fuente numérica suficiente para sustituir el snapshot sin reconstrucción y auditoría completa.', missingEvidence: ['Dataset reproducible de goles con cobertura 1955/56–corte v2, referencias por valor y reconciliación histórica.'] }
    ],
    conflictAssessment: { total: 12 as const, scopeCompatibleCases: ['Cristiano Ronaldo: el +1 UEFA es compatible con una diferencia de tratamiento de clasificación, pero el snapshot no prueba qué cifra corresponde exactamente al alcance v2.'], unresolvedCases: unresolved.filter((player) => player !== 'Cristiano Ronaldo'), conclusion: 'La evidencia pública y los snapshots archivados permiten formular una hipótesis de alcance, no resolver las cifras. UEFA mantiene estadísticas separadas de clasificación y su documentación histórica indica que algunos compendios incluyen clasificación/play-offs; aun así, no existe desglose archivado por jugador para atribuir los otros 11 casos ni confirmar de forma concluyente el caso de Ronaldo.', requiredEvidence: ['Desglose oficial por partido y ronda para los 12 jugadores.', 'Declaración de cada fuente sobre Copa de Europa, fase principal, play-offs, clasificación y criterio de contabilización.', 'Nueva reconciliación reproducible bajo la definición v2 antes de crear un snapshot append-only.'] },
    identityAndMetadata: { totalPending: 6 as const, identityDiscrepanciesDocumented: 3 as const, identityStatus: 'canonical_ids_confirmed_by_archived_profile_urls' as const, dataChangeMade: false as const, remainingBlocks: ['source_snapshot_unresolved_conflicts', 'source_contrast_value_discrepancy', 'source_rights_not_approved'] },
    media: { top20Licensed: numberValue(media.top20Licensed), top20WithoutApprovedPortrait: numberValue(media.top20WithoutApprovedPortrait), playableLicensed: numberValue(media.playableLicensed), playableFallback: numberValue(media.playableFallback), playableUnavailable: numberValue(media.playableUnavailable), policy: 'Solo activos propios, licenciados, autorizados, de dominio público o placeholders legales; los fallbacks no convierten una fuente de datos en publicable.' },
    appendOnlyPlan: { newSnapshotCreated: false as const, createNewSnapshotWhen: ['La definición v2 sea aprobada y la fuente definitiva tenga derechos documentados.', 'Cambie cualquier valor, alcance, fuente o metadato del snapshot actual.', 'La nueva versión conserve los IDs/hashes históricos y registre data_version y algorithm_version.'], preserveSnapshotIdsAndHashes: true as const },
    isolatedValidation: { status: rollbackStatus as 'integration_pending' | 'not_run', required: true as const, detail: rollbackStatus === 'integration_pending' ? 'RANGO90_ISOLATED_DATABASE_URL no está disponible; no se conecta a DATABASE_URL ni se simula una publicación/rollback.' : 'La URL aislada existe, pero esta auditoría documental no ejecuta transacciones.' },
    gates: [
      { key: 'source_rights', status: 'block' as const, detail: 'Transfermarkt permanece review_required; no hay licencia o permiso archivado para el uso exacto.' },
      { key: 'scope_reconciliation', status: 'block' as const, detail: 'Las 12 diferencias no tienen desglose suficiente para resolverlas bajo v2.' },
      { key: 'identity_metadata', status: 'pending' as const, detail: 'Tres nombres están desambiguados por URL, pero la normalización aún no se ha materializado en una nueva versión.' },
      { key: 'media_rights', status: numberValue(media.playableUnavailable) === 0 ? 'pass' as const : 'block' as const, detail: `${numberValue(media.top20Licensed)}/20 retratos del top 20 licenciados; ${numberValue(media.playableFallback)} jugables usan fallback.` },
      { key: 'isolated_publish_rollback', status: 'pending' as const, detail: rollbackStatus === 'integration_pending' ? 'Prueba pendiente de base aislada.' : 'Prueba no ejecutada por permanecer esta revisión en modo documental.' }
    ],
    readyForApproval: false as const,
    recommendation: 'Mantener el snapshot en draft y rights_status=review_required. No aprobar Transfermarkt con la evidencia actual. Solicitar permiso escrito a Transfermarkt o seleccionar una fuente alternativa con licencia expresa; resolver los 12 contrastes bajo v2 y ejecutar publicación/rollback en PostgreSQL aislado antes de solicitar aprobación.'
  };
  return { ...base, sha256: sha256(stableJson(base)) };
}

function cell(value: unknown): string { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderChampionsRightsReviewMarkdown(report: ChampionsRightsReviewReport): string {
  const lines = [
    '# BLOQUE 7C — Fuente, alcance y derechos de Champions League', '',
    '> REVISIÓN DOCUMENTAL. No es una opinión jurídica ni una aprobación de fuente. Solo lectura: no modifica PostgreSQL, snapshots, derechos ni publicaciones.', '',
    `- runId: \`${report.runId}\``, `- fecha: \`${report.reviewDate}\``, `- auditoría de entrada: \`${report.inputAudit.runId}\` / \`${report.inputAudit.sha256}\``, `- huella del informe: \`${report.sha256}\``, '- readyForApproval: **false**', '',
    '## Conclusión', '', report.recommendation, '',
    '## Alcance v2', '', `- Estado: **${report.scopeDecision.status}**; versión \`${report.scopeDecision.version}\`.`, '- Copa de Europa + UEFA Champions League masculina desde 1955/56.', '- Solo torneo principal/fase final; sin rondas de clasificación ni fases previas.', `- Definición archivada: \`${JSON.stringify(report.scopeDecision.definition)}\``, '',
    '## Fuentes y derechos', '', '| Fuente | Estado | Decisión |', '| --- | --- | --- |', ...report.sourceAssessments.map((source) => `| ${source.provider} | **${source.status}** | ${cell(source.implicationForRango90)} |`), '',
    ...report.sourceAssessments.flatMap((source) => [`### ${source.provider}`, '', `- Evidencia: ${source.evidenceUrls.map((url) => `[enlace](${url})`).join(', ')}.`, ...source.documentedFacts.map((fact) => `- ${fact}`), '- Evidencia que falta:', ...source.missingEvidence.map((item) => `  - ${item}`), '']),
    '## Reconciliación de los 12 conflictos', '', `- Casos totales: ${report.conflictAssessment.total}.`, `- Caso compatible con hipótesis de alcance: ${report.conflictAssessment.scopeCompatibleCases.join(' ')}`, `- Casos todavía sin resolver: ${report.conflictAssessment.unresolvedCases.length}.`, `- Conclusión: ${report.conflictAssessment.conclusion}`, '- Ningún valor ha sido cambiado.', '', '| Jugador | Estado |', '| --- | --- |', ...report.conflictAssessment.scopeCompatibleCases.map((item) => `| Cristiano Ronaldo | bloqueado; ${cell(item)} |`), ...report.conflictAssessment.unresolvedCases.map((player) => `| ${cell(player)} | bloqueado; falta desglose por partido/ronda y criterio de fuente |`), '',
    'Evidencia pública adicional: UEFA separa la fase de clasificación y publica estadísticas históricas que pueden incluir clasificación/play-offs según el compendio; esa documentación apoya la hipótesis de alcance, pero no sustituye una reconciliación por jugador.', '',
    '## Identidades, media y snapshot', '', '- Las tres discrepancias de nombres abreviados quedan desambiguadas mediante perfiles archivados; no se han modificado nombres ni IDs.', `- Media: ${report.media.top20Licensed}/20 retratos licenciados del top 20; ${report.media.playableFallback} jugables con fallback; ${report.media.playableUnavailable} unavailable.`, `- Snapshot actual: \`${report.currentDraftSource.snapshotId}\`, Transfermarkt, estado de derechos **${report.currentDraftSource.rightsStatus}**, decisión **${report.currentDraftSource.decision}**.`, '',
    '## Plan append-only y QA', '', '- No se creó snapshot nuevo.', '- Solo crear uno nuevo si cambia alcance, valores, fuente o metadatos; conservar el snapshot y hashes anteriores.', `- Publicación/rollback aislado: **${report.isolatedValidation.status}**. ${report.isolatedValidation.detail}`, '', '| Gate | Estado |', '| --- | --- |', ...report.gates.map((gate) => `| ${gate.key} | **${gate.status}** — ${cell(gate.detail)} |`), '', 'No aprobar ni publicar automáticamente. La aceptación futura requiere autorización explícita del propietario después de resolver derechos, alcance, fuente numérica y QA aislado.', ''
  ];
  return lines.join('\n');
}
