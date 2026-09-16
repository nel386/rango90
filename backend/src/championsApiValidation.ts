import { createHash } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export type ApiQuery = {
  endpoint: string;
  httpStatus: number | null;
  ok: boolean;
  resultCount: number | null;
  errorCount: number | null;
  responseSha256: string | null;
  dailyLimit: number | null;
  dailyRemaining: number | null;
  minuteLimit: number | null;
  minuteRemaining: number | null;
  seasons: number[];
  players: Array<{ playerId: number; playerName: string; goals: number }>;
  errorCode: string | null;
};

export type ChampionsApiValidation = {
  artifactKind: 'champions_api_validation';
  reportVersion: '1';
  reviewDate: '2026-09-16';
  provider: 'API-Football / API-Sports';
  competition: { leagueId: 2; slug: 'uefa-champions-league'; onlyCompetitionQueried: true };
  credential: { source: 'API_FOOTBALL_KEY'; present: boolean; persisted: false; printed: false };
  status: 'passed' | 'integration_pending' | 'failed';
  reason: string;
  networkRequests: number;
  databaseAccess: 'none';
  mutationCount: 0;
  queries: ApiQuery[];
  seasonsAvailable: number[];
  historicalWindowAssessment: 'not_run' | 'partial' | 'not_sufficient_for_v2';
  topScorersAvailability: 'not_run' | 'observed' | 'failed';
  fullRankingReconstruction: 'not_run' | 'not_proven' | 'possible_pending_full_export';
  limits: { dailyLimit: number | null; dailyRemaining: number | null; minuteLimit: number | null; minuteRemaining: number | null; source: 'response_headers' | 'not_observed' };
  plan: { status: 'not_verified' | 'observed_quota_only'; name: string | null; evidence: string };
  documentationEvidence: Array<{ topic: string; url: string }>;
  rights: { dataStorage: 'public_terms_claim_storage_allowed_but_contract_required'; derivedRankings: 'not_authorized'; attribution: 'must_confirm_in_contract'; commercialRestrictions: 'third_party_rights_and_no_competition_rights_granted'; images: 'not_authorized_by_api_access' };
  comparison: { baselineSnapshotId: string; baselineContentSha256: string; mode: 'differences_only'; differences: Array<{ playerName: string; apiValue: number | null; baselineValue: number | null; detail: string }> };
  rawResponsesStored: false;
  imagesQueried: false;
  importPerformed: false;
  snapshotCreated: false;
  readyForApproval: false;
  sha256: string;
};

export function stableJson(value: unknown): string { return JSON.stringify(value, null, 2) + '\n'; }
export function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function numberOrNull(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function headerLimits(headers: Headers): ChampionsApiValidation['limits'] {
  const values = {
    dailyLimit: numberOrNull(headers.get('x-ratelimit-requests-limit')),
    dailyRemaining: numberOrNull(headers.get('x-ratelimit-requests-remaining')),
    minuteLimit: numberOrNull(headers.get('X-RateLimit-Limit')),
    minuteRemaining: numberOrNull(headers.get('X-RateLimit-Remaining'))
  };
  return { ...values, source: Object.values(values).some((value) => value !== null) ? 'response_headers' : 'not_observed' };
}

export function pendingChampionsApiValidation(input: { baselineSnapshotId: string; baselineContentSha256: string }): ChampionsApiValidation {
  const base = {
    artifactKind: 'champions_api_validation' as const,
    reportVersion: '1' as const,
    reviewDate: '2026-09-16' as const,
    provider: 'API-Football / API-Sports' as const,
    competition: { leagueId: 2 as const, slug: 'uefa-champions-league' as const, onlyCompetitionQueried: true as const },
    credential: { source: 'API_FOOTBALL_KEY' as const, present: false as const, persisted: false as const, printed: false as const },
    status: 'integration_pending' as const,
    reason: 'API_FOOTBALL_KEY no está presente; no se ejecutaron llamadas de red.',
    networkRequests: 0 as const,
    databaseAccess: 'none' as const,
    mutationCount: 0 as const,
    queries: [],
    seasonsAvailable: [],
    historicalWindowAssessment: 'not_run' as const,
    topScorersAvailability: 'not_run' as const,
    fullRankingReconstruction: 'not_run' as const,
    limits: { dailyLimit: null, dailyRemaining: null, minuteLimit: null, minuteRemaining: null, source: 'not_observed' as const },
    plan: { status: 'not_verified' as const, name: null, evidence: 'El plan solo puede verificarse con el dashboard o contrato de la cuenta; la API key no se persiste ni revela el plan contractual.' },
    documentationEvidence: [
      { topic: 'terms', url: 'https://www.api-football.com/terms' },
      { topic: 'pricing', url: 'https://www.api-football.com/pricing' },
      { topic: 'rate_limits', url: 'https://www.api-football.com/news/post/how-ratelimit-works' },
      { topic: 'leagues_endpoint', url: 'https://www.api-football.com/documentation-v3#tag/Leagues/operation/get-leagues' },
      { topic: 'top_scorers_endpoint', url: 'https://www.api-football.com/documentation-v3#tag/Players/operation/get-players-topscorers' }
    ],
    rights: { dataStorage: 'public_terms_claim_storage_allowed_but_contract_required' as const, derivedRankings: 'not_authorized' as const, attribution: 'must_confirm_in_contract' as const, commercialRestrictions: 'third_party_rights_and_no_competition_rights_granted' as const, images: 'not_authorized_by_api_access' as const },
    comparison: { baselineSnapshotId: input.baselineSnapshotId, baselineContentSha256: input.baselineContentSha256, mode: 'differences_only' as const, differences: [] },
    rawResponsesStored: false as const,
    imagesQueried: false as const,
    importPerformed: false as const,
    snapshotCreated: false as const,
    readyForApproval: false as const
  };
  return { ...base, sha256: sha256(stableJson(base)) };
}

export function makeQuery(input: { endpoint: string; response: Response; body: JsonRecord; rawResponseForHash: unknown; seasons?: number[]; players?: ApiQuery['players']; errorCode?: string | null }): ApiQuery {
  const metadata = input.body.metadata && typeof input.body.metadata === 'object' && !Array.isArray(input.body.metadata) ? input.body.metadata as JsonRecord : {};
  const errors = input.body.errors && typeof input.body.errors === 'object' && !Array.isArray(input.body.errors) ? Object.keys(input.body.errors as JsonRecord) : [];
  const responseRows = Array.isArray(input.body.response) ? input.body.response : [];
  const limits = headerLimits(input.response.headers);
  return { endpoint: input.endpoint, httpStatus: input.response.status, ok: input.response.ok, resultCount: typeof input.body.results === 'number' ? input.body.results : responseRows.length, errorCount: errors.length, responseSha256: sha256(JSON.stringify(input.rawResponseForHash)), dailyLimit: limits.dailyLimit, dailyRemaining: limits.dailyRemaining, minuteLimit: limits.minuteLimit, minuteRemaining: limits.minuteRemaining, seasons: input.seasons ?? [], players: input.players ?? [], errorCode: input.errorCode ?? (typeof metadata.message === 'string' ? metadata.message : errors[0] ?? null) };
}

export function buildLiveValidation(input: { queries: ApiQuery[]; baselineSnapshotId: string; baselineContentSha256: string }): ChampionsApiValidation {
  const seasons = [...new Set(input.queries.flatMap((query) => query.seasons))].sort((a, b) => a - b);
  const firstSeason = seasons[0];
  const observedPlayerQuery = input.queries.some((query) => query.endpoint.startsWith('/players/topscorers') && query.ok);
  const limits = input.queries.find((query) => query.dailyLimit !== null || query.minuteLimit !== null);
  const base = {
    artifactKind: 'champions_api_validation' as const,
    reportVersion: '1' as const,
    reviewDate: '2026-09-16' as const,
    provider: 'API-Football / API-Sports' as const,
    competition: { leagueId: 2 as const, slug: 'uefa-champions-league' as const, onlyCompetitionQueried: true as const },
    credential: { source: 'API_FOOTBALL_KEY' as const, present: true as const, persisted: false as const, printed: false as const },
    status: input.queries.every((query) => query.ok) ? 'passed' as const : 'failed' as const,
    reason: input.queries.every((query) => query.ok) ? 'Prueba limitada completada solo para Champions League; no certifica derechos ni reconstrucción histórica completa.' : 'Al menos una consulta limitada devolvió un error; no se puede evaluar cobertura completa.',
    networkRequests: input.queries.length,
    databaseAccess: 'none' as const,
    mutationCount: 0 as const,
    queries: input.queries,
    seasonsAvailable: seasons,
    historicalWindowAssessment: firstSeason !== undefined && firstSeason <= 1955 ? 'partial' as const : 'not_sufficient_for_v2' as const,
    topScorersAvailability: observedPlayerQuery ? 'observed' as const : 'failed' as const,
    fullRankingReconstruction: 'not_proven' as const,
    limits: limits ? { dailyLimit: limits.dailyLimit, dailyRemaining: limits.dailyRemaining, minuteLimit: limits.minuteLimit, minuteRemaining: limits.minuteRemaining, source: 'response_headers' as const } : { dailyLimit: null, dailyRemaining: null, minuteLimit: null, minuteRemaining: null, source: 'not_observed' as const },
    plan: { status: limits?.dailyLimit !== null && limits?.dailyLimit !== undefined ? 'observed_quota_only' as const : 'not_verified' as const, name: null, evidence: 'La cuota observada no identifica de forma concluyente el plan contratado; se requiere evidencia del dashboard o contrato.' },
    documentationEvidence: [
      { topic: 'terms', url: 'https://www.api-football.com/terms' },
      { topic: 'pricing', url: 'https://www.api-football.com/pricing' },
      { topic: 'rate_limits', url: 'https://www.api-football.com/news/post/how-ratelimit-works' },
      { topic: 'leagues_endpoint', url: 'https://www.api-football.com/documentation-v3#tag/Leagues/operation/get-leagues' },
      { topic: 'top_scorers_endpoint', url: 'https://www.api-football.com/documentation-v3#tag/Players/operation/get-players-topscorers' }
    ],
    rights: { dataStorage: 'public_terms_claim_storage_allowed_but_contract_required' as const, derivedRankings: 'not_authorized' as const, attribution: 'must_confirm_in_contract' as const, commercialRestrictions: 'third_party_rights_and_no_competition_rights_granted' as const, images: 'not_authorized_by_api_access' as const },
    comparison: { baselineSnapshotId: input.baselineSnapshotId, baselineContentSha256: input.baselineContentSha256, mode: 'differences_only' as const, differences: [{ playerName: 'sample-only', apiValue: null, baselineValue: null, detail: 'La prueba limitada no es comparable con el ranking acumulado del snapshot; no se cambian valores.' }] },
    rawResponsesStored: false as const,
    imagesQueried: false as const,
    importPerformed: false as const,
    snapshotCreated: false as const,
    readyForApproval: false as const
  };
  return { ...base, sha256: sha256(stableJson(base)) };
}

function cell(value: unknown): string { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderChampionsApiValidationMarkdown(report: ChampionsApiValidation): string {
  const lines = [
    '# BLOQUE 7E — Validación real de API-Football para Champions League', '',
    '> Auditoría técnica y documental. No es aprobación de datos ni de derechos. No modifica PostgreSQL, snapshots, fuentes, derechos, retos o imágenes.', '',
    `- fecha: \`${report.reviewDate}\``, `- estado: **${report.status}**`, `- peticiones: **${report.networkRequests}**`, `- huella: \`${report.sha256}\``, `- readyForApproval: **false**`, '',
    '## Resultado', '', report.reason, '',
    '## Credencial y proveedor', '', `- Credencial: \`${report.credential.source}\`; presente: **${report.credential.present}**; persistida: **false**; impresa: **false**.`, '- Proveedor: **API-Football / API-Sports**.', `- Plan: **${report.plan.status}**${report.plan.name ? ` (${report.plan.name})` : ''}. ${report.plan.evidence}`, '',
    '## Consultas realizadas', '', '| Endpoint | HTTP | OK | Resultados | Errores | Temporadas | Límite diario | Restantes | Límite/min | Restantes/min |', '| --- | ---: | :---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |', ...report.queries.map((query) => `| \`${query.endpoint}\` | ${query.httpStatus ?? '—'} | ${query.ok ? 'sí' : 'no'} | ${query.resultCount ?? '—'} | ${query.errorCount ?? '—'} | ${query.seasons.join(', ') || '—'} | ${query.dailyLimit ?? '—'} | ${query.dailyRemaining ?? '—'} | ${query.minuteLimit ?? '—'} | ${query.minuteRemaining ?? '—'} |`), '',
    'No se guardaron respuestas crudas; cada consulta conserva solo estado, conteos, límites, muestra mínima y huella sanitizada.', '',
    '## Cobertura y reconstrucción', '', `- Temporadas observadas: ${report.seasonsAvailable.join(', ') || '**ninguna**'}.`, `- Ventana v2: **${report.historicalWindowAssessment}**.`, `- Goleadores: **${report.topScorersAvailability}**.`, `- Ranking histórico completo: **${report.fullRankingReconstruction}**.`, '- El endpoint de top scorers devuelve una lista limitada por temporada; esta prueba de bajo consumo no demuestra una reconstrucción acumulada completa desde 1955/56.', '',
    '## Jugadores y valores observados', '', ...report.queries.flatMap((query) => query.players.length === 0 ? [] : [`### ${query.endpoint}`, '', '| Jugador | ID | Goles |', '| --- | ---: | ---: |', ...query.players.map((player) => `| ${cell(player.playerName)} | ${player.playerId} | ${player.goals} |`), '']),
    '## Derechos y restricciones', '', ...report.documentationEvidence.map((evidence) => `- Evidencia ${evidence.topic}: [fuente oficial](${evidence.url}).`), '- Almacenamiento: los términos públicos deben leerse junto con el contrato y no sustituyen la autorización de los titulares de la competición.', '- Rankings derivados: **no autorizados** con la evidencia disponible.', '- Atribución: pendiente de confirmación contractual.', '- Restricciones comerciales: API-Football no concede por sí sola derechos comerciales de competiciones de terceros.', '- Imágenes/logos: no consultados; el acceso a la API no demuestra derechos de publicación.', '',
    '## Comparación con baseline', '', `- Snapshot de comparación: \`${report.comparison.baselineSnapshotId}\`, content_sha256 \`${report.comparison.baselineContentSha256}\`.`, '- Comparación solo de diferencias; no se sustituyen valores ni se crea un snapshot.', ...report.comparison.differences.map((difference) => `- ${difference.playerName}: ${difference.detail}`), '',
    '## Puerta', '', '| Condición | Estado |', '| --- | --- |', `| Credencial válida y consulta limitada | **${report.status}** |`, `| Cobertura completa 1955/56–corte v2 | **${report.historicalWindowAssessment}** |`, `| Reconstrucción histórica completa | **${report.fullRankingReconstruction}** |`, '| Derechos de almacenamiento/publicación derivados | **bloqueado** |', '| Snapshot candidato | **no creado** |', '| Importación o mutación | **0** |', '',
    'Decisión: mantener Champions bloqueada. Para avanzar se necesita evidencia del plan/contrato, cobertura histórica completa y autorización expresa para almacenar y publicar el ranking derivado; la clave por sí sola no satisface esos requisitos.', ''
  ];
  return lines.join('\n');
}
