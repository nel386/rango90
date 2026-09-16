import { createHash } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export type ProbeStatus = 'passed' | 'integration_pending' | 'failed';

export type ChampionsApiProbe = {
  artifactKind: 'api_football_champions_probe';
  reportVersion: '1';
  provider: 'API-Football / API-Sports';
  competition: { leagueId: 2; slug: 'uefa-champions-league'; queriedOnly: true };
  status: ProbeStatus;
  reason: string;
  networkRequests: number;
  databaseAccess: 'none';
  mutationCount: 0;
  imagesQueried: false;
  rawDataStored: false;
  planStatus: 'not_verified' | 'verified';
  coverageAssessment: 'not_run' | 'insufficient' | 'complete' | 'failed';
  requestedEndpoints: string[];
  sample: Array<{ season: number; playerId: number; playerName: string; goals: number }>;
  comparison: {
    baselineSnapshotId: string;
    baselineContentSha256: string;
    status: 'not_run' | 'completed' | 'failed';
    differences: Array<{ season?: number; playerName: string; detail: string }>;
  };
  responseEvidence: Array<{ endpoint: string; httpStatus: number; responseSha256: string; rowCount: number }>;
  readyForApproval: false;
  sha256: string;
};

export type SourceAssessment = {
  provider: string;
  role: 'current_snapshot' | 'candidate_numeric' | 'semantic_authority' | 'metadata_only' | 'not_suitable';
  rightsStatus: 'blocked' | 'conditional_not_approved' | 'open_metadata_only';
  coverageStatus: 'unverified' | 'partial' | 'unknown' | 'not_suitable';
  planStatus: 'not_applicable' | 'not_verified' | 'not_contracted';
  recommendation: 'retain_draft_only' | 'conditional_candidate' | 'request_license' | 'metadata_only' | 'reject_for_scope';
  storage: string;
  derivedRankings: string;
  attribution: string;
  commercialRestrictions: string;
  images: string;
  evidenceUrls: string[];
  evidenceFacts: string[];
  missingEvidence: string[];
};

export type ChampionsSourceSelectionReport = {
  artifactKind: 'champions_source_selection';
  reportVersion: '1';
  categorySlug: 'uefa-champions-league-goals';
  reviewDate: '2026-09-16';
  readOnly: true;
  productionData: false;
  mutationCount: 0;
  approvalsGranted: false;
  published: false;
  snapshotCreated: false;
  runId: string;
  inputArtifacts: Array<{ path: string; sha256: string; runId?: string }>;
  contractedProvider: {
    configuredProvider: 'API-Football / API-Sports';
    baseUrl: string;
    plan: 'not_verified';
    accountOrContractEvidence: 'not_found_in_repository_or_environment';
    conclusion: string;
  };
  scope: { version: 'uefa-champions-league-goals-v2'; status: 'proposed_not_approved'; definition: JsonRecord };
  baseline: { snapshotId: string; contentSha256: string; status: 'draft'; provider: 'Transfermarkt'; rightsStatus: 'review_required'; differencesOnly: true };
  sourceMatrix: SourceAssessment[];
  apiProbe: { path: string; sha256: string; status: ProbeStatus; networkRequests: number; coverageAssessment: ChampionsApiProbe['coverageAssessment'] };
  coverage: { requestedWindow: string; apiFootball: 'not_tested'; historicalRankingReconstruction: 'not_tested'; reason: string };
  imageRights: { queried: false; imported: false; providerImagesPublishable: 'not_demonstrated'; policy: string };
  openBlocks: string[];
  gates: Array<{ key: string; status: 'block' | 'pending' | 'pass'; detail: string }>;
  readyForApproval: false;
  recommendation: string;
  sha256: string;
};

export function stableJson(value: unknown): string { return JSON.stringify(value, null, 2) + '\n'; }
export function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function record(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function stringValue(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }

export function buildPendingApiFootballProbe(input: { baselineSnapshotId: string; baselineContentSha256: string }): ChampionsApiProbe {
  const base = {
    artifactKind: 'api_football_champions_probe' as const,
    reportVersion: '1' as const,
    provider: 'API-Football / API-Sports' as const,
    competition: { leagueId: 2 as const, slug: 'uefa-champions-league' as const, queriedOnly: true as const },
    status: 'integration_pending' as const,
    reason: 'API_FOOTBALL_KEY_missing; no se realizó ninguna llamada de red ni consulta de base de datos.',
    networkRequests: 0 as const,
    databaseAccess: 'none' as const,
    mutationCount: 0 as const,
    imagesQueried: false as const,
    rawDataStored: false as const,
    planStatus: 'not_verified' as const,
    coverageAssessment: 'not_run' as const,
    requestedEndpoints: ['/leagues?id=2', '/players/topscorers?league=2&season={season}'],
    sample: [],
    comparison: { baselineSnapshotId: input.baselineSnapshotId, baselineContentSha256: input.baselineContentSha256, status: 'not_run' as const, differences: [] },
    responseEvidence: [],
    readyForApproval: false as const
  };
  return { ...base, sha256: sha256(stableJson(base)) };
}

export function buildChampionsSourceSelection(input: {
  rightsReview: JsonRecord;
  rightsReviewSha256: string;
  probe: ChampionsApiProbe;
  probeSha256: string;
  providerBaseUrl: string;
  licenseReviewSha256: string;
}): ChampionsSourceSelectionReport {
  const rights = input.rightsReview;
  const scope = record(rights.scopeDecision);
  const definition = record(scope.definition);
  const current = record(rights.currentDraftSource);
  const baselineSnapshotId = stringValue(current.snapshotId, 'rs_870f1dff967bb160f2d132cc');
  const matrix: SourceAssessment[] = [
    {
      provider: 'Transfermarkt', role: 'current_snapshot', rightsStatus: 'blocked', coverageStatus: 'unverified', planStatus: 'not_applicable', recommendation: 'retain_draft_only',
      storage: 'El snapshot ya archivado se conserva; no se autoriza nueva extracción ni redistribución con la evidencia actual.',
      derivedRankings: 'No demostrado y no publicable con la evidencia archivada.',
      attribution: 'No existe una autorización archivada que defina atribución suficiente.',
      commercialRestrictions: 'Los términos públicos restringen la copia automatizada y reservan los derechos de bases de datos/material.',
      images: 'No se consideran publicables por defecto; cada retrato requiere licencia independiente.',
      evidenceUrls: ['https://www.transfermarkt.com/intern/anb', 'https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0'],
      evidenceFacts: ['La auditoría 7C identifica la fuente actual como draft y rights_status=review_required.', 'La revisión pública no acredita permiso de redistribución del ranking histórico.'],
      missingEvidence: ['Permiso escrito que cubra extracción, almacenamiento, ranking derivado y redistribución pública/comercial.']
    },
    {
      provider: 'API-Football / API-Sports', role: 'candidate_numeric', rightsStatus: 'conditional_not_approved', coverageStatus: 'unverified', planStatus: 'not_verified', recommendation: 'conditional_candidate',
      storage: 'Los términos públicos mencionan distribución, transferencia y almacenamiento de datos, sujetos a sus límites; no hay contrato de Rango90 archivado.',
      derivedRankings: 'No se debe asumir autorización para el ranking histórico derivado sin confirmación escrita del plan y del uso previsto.',
      attribution: 'No se ha localizado en el repositorio una obligación contractual concreta; debe confirmarse con el plan.',
      commercialRestrictions: 'Los términos prohíben revender el producto sin permiso previo; el modelo de Rango90 debe ser revisado contra esa cláusula.',
      images: 'Las imágenes, logos y vídeos tienen tratamiento separado; el proveedor no demuestra derechos de publicación para Rango90.',
      evidenceUrls: ['https://apifootball.com/terms_of_use/', 'https://www.api-football.com/pricing'],
      evidenceFacts: ['El repositorio configura API_FOOTBALL_BASE_URL, pero no contiene API_FOOTBALL_KEY, factura, plan o contrato verificable.', 'La prueba técnica quedó integration_pending con cero peticiones; no hay muestra ni cobertura histórica observada.'],
      missingEvidence: ['Plan/cuenta contratados.', 'Permiso para almacenar snapshots, generar/publicar rankings derivados y operar con uso comercial.', 'Cobertura comprobada de 1955/56 hasta el corte v2.', 'Derechos de imágenes, logos y marcas.']
    },
    {
      provider: 'UEFA', role: 'semantic_authority', rightsStatus: 'blocked', coverageStatus: 'unknown', planStatus: 'not_contracted', recommendation: 'request_license',
      storage: 'No se ha encontrado una licencia de redistribución para conservar y servir un snapshot de terceros.',
      derivedRankings: 'UEFA define y controla los derechos de datos de la competición; la página pública de estadísticas no es una licencia.',
      attribution: 'Debe pactarse en la licencia o términos de uso autorizados.',
      commercialRestrictions: 'Las regulaciones reservan derechos comerciales y de datos de la competición a UEFA/socios autorizados.',
      images: 'No se consultaron ni incorporaron imágenes UEFA.',
      evidenceUrls: ['https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/', 'https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-2-Definitions-Online', 'https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-72-Commercial-rights-for-the-play-offs-and-UEFA-Champions-League-Online'],
      evidenceFacts: ['UEFA es la referencia semántica más fuerte para competición y fases.', 'La existencia de estadísticas públicas no demuestra permiso para redistribuirlas en una aplicación de terceros.'],
      missingEvidence: ['Licencia o permiso para el ranking derivado, almacenamiento, nombres, estadísticas y uso web/PWA/Android.', 'Exportación o desglose autorizado para reconciliar los 12 conflictos.']
    },
    {
      provider: 'Wikidata', role: 'metadata_only', rightsStatus: 'open_metadata_only', coverageStatus: 'unknown', planStatus: 'not_applicable', recommendation: 'metadata_only',
      storage: 'CC0 según la documentación de Wikidata.',
      derivedRankings: 'No se ha demostrado que sus datos permitan reconstruir este ranking de goles completo.',
      attribution: 'CC0 no impone una atribución obligatoria, aunque se recomienda documentar procedencia.',
      commercialRestrictions: 'No identificadas en la licencia CC0; la calidad/cobertura sigue sin estar probada.',
      images: 'No se consultaron imágenes.',
      evidenceUrls: ['https://www.wikidata.org/wiki/Wikidata:Licensing', 'https://www.wikidata.org/wiki/Wikidata:Reuse'],
      evidenceFacts: ['Es una opción abierta para IDs y metadatos.', 'No es fuente numérica suficiente sin una reconstrucción independiente y auditada.'],
      missingEvidence: ['Dataset completo y reproducible de goles por partido/ronda bajo la definición v2.']
    },
    {
      provider: 'OpenFootball / football-data', role: 'not_suitable', rightsStatus: 'open_metadata_only', coverageStatus: 'not_suitable', planStatus: 'not_contracted', recommendation: 'reject_for_scope',
      storage: 'Sus licencias deben respetarse por dataset; no se propone importar datos en este bloque.',
      derivedRankings: 'La evidencia local no demuestra resultados completos de goleadores de Champions desde 1955/56.',
      attribution: 'Depende del dataset concreto.',
      commercialRestrictions: 'Dependen del dataset y licencia concreta.',
      images: 'No se consultaron imágenes.',
      evidenceUrls: ['https://github.com/openfootball', 'https://github.com/schochastics/football-data'],
      evidenceFacts: ['Pueden servir como apoyo de resultados, no como fuente definitiva demostrada para este ranking histórico.',
      ],
      missingEvidence: ['Cobertura completa y licencia que cubra el ranking derivado bajo v2.']
    }
  ];
  const base = {
    artifactKind: 'champions_source_selection' as const,
    reportVersion: '1' as const,
    categorySlug: 'uefa-champions-league-goals' as const,
    reviewDate: '2026-09-16' as const,
    readOnly: true as const,
    productionData: false as const,
    mutationCount: 0 as const,
    approvalsGranted: false as const,
    published: false as const,
    snapshotCreated: false as const,
    runId: `block7d-champions-${input.rightsReviewSha256.slice(0, 16)}-${input.probeSha256.slice(0, 8)}`,
    inputArtifacts: [
      { path: 'audits/block7c/champions-source-scope-rights-review.json', sha256: input.rightsReviewSha256, runId: stringValue(rights.runId) },
      { path: 'audits/block7d/api-football-champions-probe.json', sha256: input.probeSha256 },
      { path: 'DATA_PROVIDER_LICENSE_REVIEW.md', sha256: input.licenseReviewSha256 }
    ],
    contractedProvider: {
      configuredProvider: 'API-Football / API-Sports' as const,
      baseUrl: input.providerBaseUrl,
      plan: 'not_verified' as const,
      accountOrContractEvidence: 'not_found_in_repository_or_environment' as const,
      conclusion: 'El repositorio muestra configuración de API-Football, pero no acredita cuenta, plan contratado, factura ni autorización contractual del uso histórico y derivado.'
    },
    scope: { version: 'uefa-champions-league-goals-v2' as const, status: 'proposed_not_approved' as const, definition },
    baseline: { snapshotId: baselineSnapshotId, contentSha256: stringValue(record(rights.rankingChecks).contentSha256, '870f1dff967bb160f2d132cc7d9ca1f2483b26d32681e6a55985efc744cc718b'), status: 'draft' as const, provider: 'Transfermarkt' as const, rightsStatus: 'review_required' as const, differencesOnly: true as const },
    sourceMatrix: matrix,
    apiProbe: { path: 'audits/block7d/api-football-champions-probe.json', sha256: input.probeSha256, status: input.probe.status, networkRequests: input.probe.networkRequests, coverageAssessment: input.probe.coverageAssessment },
    coverage: { requestedWindow: stringValue(definition.temporalWindow, '1955/56–2025/26; corte del dato al 2026-09-12'), apiFootball: 'not_tested' as const, historicalRankingReconstruction: 'not_tested' as const, reason: 'No hay API_FOOTBALL_KEY en el entorno. No se simula cobertura ni se declara reconstrucción completa.' },
    imageRights: { queried: false as const, imported: false as const, providerImagesPublishable: 'not_demonstrated' as const, policy: 'No incorporar una imagen sin derechos confirmados. Una fuente numérica aprobada no autoriza por sí sola retratos, logos o vídeos.' },
    openBlocks: ['provider_plan_and_contract_not_verified', 'api_football_champions_probe_pending', 'historical_coverage_1955_56_not_demonstrated', 'derived_ranking_redistribution_rights_not_confirmed', 'image_rights_not_confirmed', '12_scope_and_definition_conflicts_remain_from_block7c', 'isolated_postgresql_publish_rollback_not_run'],
    gates: [
      { key: 'contracted_provider', status: 'block' as const, detail: 'Plan, cuenta y contrato actual no están acreditados.' },
      { key: 'api_probe', status: input.probe.status === 'passed' ? 'pass' as const : 'pending' as const, detail: input.probe.status === 'passed' ? 'Muestra técnica archivada.' : 'Falta API_FOOTBALL_KEY; no hubo llamadas de red.' },
      { key: 'historical_coverage', status: 'block' as const, detail: 'No está demostrada la cobertura completa 1955/56–corte v2.' },
      { key: 'derived_ranking_rights', status: 'block' as const, detail: 'No existe autorización suficiente archivada para publicar el ranking derivado.' },
      { key: 'image_rights', status: 'block' as const, detail: 'No se han demostrado derechos de imágenes del proveedor.' },
      { key: 'conflicts', status: 'block' as const, detail: 'Los 12 conflictos de alcance/definición siguen abiertos.' },
      { key: 'isolated_publish_rollback', status: 'pending' as const, detail: 'No se ejecuta sin RANGO90_ISOLATED_DATABASE_URL.' }
    ],
    readyForApproval: false as const,
    recommendation: 'Champions debe permanecer bloqueada. No seleccionar Transfermarkt para publicación. API-Football solo puede seguir como candidato condicional después de verificar plan/contrato, derechos de ranking derivado, cobertura histórica completa y derechos separados de imágenes; si no se obtiene esa evidencia, solicitar una licencia directa a UEFA o a un proveedor autorizado con cobertura explícita.'
  };
  return { ...base, sha256: sha256(stableJson(base)) };
}

function cell(value: unknown): string { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderChampionsSourceSelectionMarkdown(report: ChampionsSourceSelectionReport, probe: ChampionsApiProbe): string {
  const lines = [
    '# BLOQUE 7D — Selección de fuente publicable para Champions League', '',
    '> Artefacto de auditoría. No es aprobación legal, no publica datos y no modifica PostgreSQL, snapshots, fuentes, derechos ni imágenes.', '',
    `- runId: \`${report.runId}\``, `- fecha: \`${report.reviewDate}\``, `- huella: \`${report.sha256}\``, '- readyForApproval: **false**', '',
    '## Resultado', '', report.recommendation, '',
    '## Proveedor configurado y plan', '', `- Proveedor configurado: **${report.contractedProvider.configuredProvider}**.`, `- Base URL configurada: \`${report.contractedProvider.baseUrl}\`.`, '- Plan, cuenta, factura y contrato: **not_verified**; no se imprime ni se persigue ninguna credencial.', `- ${report.contractedProvider.conclusion}`, '',
    '## Alcance de la prueba', '', `- Competición consultable: Champions League, league id 2; nunca se consultan otras competiciones.`, `- Ventana objetivo: \`${report.coverage.requestedWindow}\`.`, `- Estado de prueba: **${probe.status}**; peticiones de red: **${probe.networkRequests}**.`, `- Cobertura observada: **${probe.coverageAssessment}**; reconstrucción completa: **${report.coverage.historicalRankingReconstruction}**.`, `- Motivo: ${probe.reason}`, '',
    '## Artefactos y seguridad', '', '- Se guarda únicamente el artefacto local de prueba; no se almacenan respuestas crudas ni credenciales.', '- La comparación con el snapshot Transfermarkt es solo de diferencias y no autoriza ningún valor.', '- No se consultaron ni importaron imágenes.', `- Baseline: \`${report.baseline.snapshotId}\`, content_sha256 \`${report.baseline.contentSha256}\`, estado **${report.baseline.status}**, derechos **${report.baseline.rightsStatus}**.`, '',
    '## Matriz comparativa', '', '| Fuente | Papel | Derechos | Cobertura | Plan | Decisión |', '| --- | --- | --- | --- | --- | --- |', ...report.sourceMatrix.map((source) => `| ${source.provider} | ${source.role} | **${source.rightsStatus}** | ${source.coverageStatus} | ${source.planStatus} | ${source.recommendation} |`), '',
    ...report.sourceMatrix.flatMap((source) => [`### ${source.provider}`, '', `- Evidencia: ${source.evidenceUrls.map((url) => `[enlace](${url})`).join(', ')}.`, ...source.evidenceFacts.map((fact) => `- ${fact}`), `- Almacenamiento: ${source.storage}`, `- Rankings derivados: ${source.derivedRankings}`, `- Atribución: ${source.attribution}`, `- Restricciones comerciales: ${source.commercialRestrictions}`, `- Imágenes: ${source.images}`, '- Evidencia que falta:', ...source.missingEvidence.map((item) => `  - ${item}`), '']),
    '## Bloqueos', '', '| Puerta | Estado | Motivo |', '| --- | --- | --- |', ...report.gates.map((gate) => `| ${gate.key} | **${gate.status}** | ${cell(gate.detail)} |`), '', ...report.openBlocks.map((block) => `- ${block}`), '',
    '## Decisión', '', '- Champions **no es viable para aprobación en esta ejecución**.', '- Mantener snapshot actual en `draft` y `rights_status=review_required`.', '- No crear snapshot append-only hasta contar con fuente, alcance y derechos resueltos.', '- La prueba PostgreSQL de publicación/rollback queda pendiente de una base aislada.', ''
  ];
  return lines.join('\n');
}
