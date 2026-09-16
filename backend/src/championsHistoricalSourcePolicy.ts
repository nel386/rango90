import { createHash } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export const CHAMPIONS_HISTORICAL_SLUG = 'uefa-champions-league-goals';
export const CHAMPIONS_HISTORICAL_SCOPE_VERSION = 'uefa-champions-league-goals-v2';

export type HistoricalScope = {
  scopeVersion?: string;
  startSeason?: number;
  endSeason?: number;
  competition?: string;
  tournamentPhase?: string;
  gender?: string;
  coverageComplete?: boolean;
};

export type HistoricalScopeBlocker = {
  code: 'historical_scope';
  message: string;
};

export type ChampionsSourcePolicyReport = {
  artifactKind: 'champions_historical_source_policy';
  reportVersion: '1';
  categorySlug: 'uefa-champions-league-goals';
  reviewDate: '2026-09-16';
  readOnly: true;
  productionData: false;
  mutationCount: 0;
  approvalsGranted: false;
  published: false;
  runId: string;
  inputArtifact: { path: string; sha256: string; status: string };
  sourceFreeze: Array<{ provider: string; status: 'frozen_non_publishable'; reason: string }>;
  snapshots: { currentStatus: 'draft'; newSnapshotCreated: false; importPerformed: false; databaseModified: false };
  minimumRequirements: Array<{ key: string; requirement: string; blocking: true }>;
  providerMatrix: Array<{ provider: string; historicalCoverage: string; traceability: string; derivedRankingRights: string; attribution: string; imageRights: string; status: 'not_eligible' | 'candidate_requires_evidence' }>;
  partialRangePolicy: { historicalSlug: string; requiredStartSeason: 1955; partialRangeExample: string; allowedAlternativeSlug: string; alternativeCategoryCreated: false; officialHistoricalAllowed: false };
  runtimePolicy: { lab: string[]; official: string[]; historicalRankingStatus: 'provisional_only_until_source_approved'; warningRequired: true };
  openBlocks: string[];
  readyForApproval: false;
  readyForPublication: false;
  sha256: string;
};

export function stableJson(value: unknown): string { return JSON.stringify(value, null, 2) + '\n'; }
export function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function record(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function numberValue(value: unknown): number | undefined { return typeof value === 'number' && Number.isInteger(value) ? value : undefined; }
function firstNumber(records: JsonRecord[], keys: string[]): number | undefined {
  for (const item of records) for (const key of keys) {
    const value = numberValue(item[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}
function firstString(records: JsonRecord[], keys: string[]): string | undefined {
  for (const item of records) for (const key of keys) if (typeof item[key] === 'string') return item[key] as string;
  return undefined;
}

export function readHistoricalScope(categorySlug: string, categoryScope: unknown, snapshotMetadata: unknown): HistoricalScope | undefined {
  if (categorySlug !== CHAMPIONS_HISTORICAL_SLUG) return undefined;
  const category = record(categoryScope);
  const snapshot = record(snapshotMetadata);
  const categoryHistorical = record(category.historicalScope);
  const snapshotHistorical = record(snapshot.historicalScope);
  const records = [snapshotHistorical, categoryHistorical, snapshot, category];
  const startSeason = firstNumber(records, ['startSeason', 'fromSeason']);
  const endSeason = firstNumber(records, ['endSeason', 'toSeason']);
  const scopeVersion = firstString(records, ['scopeVersion', 'definitionVersion']);
  const competition = firstString(records, ['competition', 'competitionId']);
  const tournamentPhase = firstString(records, ['tournamentPhase', 'phase']);
  const gender = firstString(records, ['gender']);
  const coverageComplete = records.find((item) => typeof item.coverageComplete === 'boolean')?.coverageComplete as boolean | undefined;
  if (startSeason === undefined && endSeason === undefined && scopeVersion === undefined && competition === undefined && tournamentPhase === undefined && gender === undefined && coverageComplete === undefined) return undefined;
  return { scopeVersion, startSeason, endSeason, competition, tournamentPhase, gender, coverageComplete };
}

export function validateHistoricalScope(categorySlug: string, scope: HistoricalScope | undefined): HistoricalScopeBlocker[] {
  if (categorySlug !== CHAMPIONS_HISTORICAL_SLUG) return [];
  if (!scope) return [{ code: 'historical_scope', message: 'Champions histórica no tiene un alcance estructurado verificable; no puede publicarse como 1955/56–corte v2.' }];
  const blockers: HistoricalScopeBlocker[] = [];
  if (scope.startSeason !== 1955) blockers.push({ code: 'historical_scope', message: `Champions histórica requiere startSeason=1955 (1955/56); se recibió ${scope.startSeason ?? 'ausente'}.` });
  if (scope.scopeVersion !== CHAMPIONS_HISTORICAL_SCOPE_VERSION) blockers.push({ code: 'historical_scope', message: `Champions histórica requiere scopeVersion=${CHAMPIONS_HISTORICAL_SCOPE_VERSION}.` });
  if (!scope.competition || !/copa de europa|champions/i.test(scope.competition)) blockers.push({ code: 'historical_scope', message: 'El alcance no identifica Copa de Europa / UEFA Champions League.' });
  const phase = scope.tournamentPhase ?? '';
  const explicitlyExcludesQualifiers = /sin\s+(?:rondas?\s+de\s+)?clasific|exclu(?:ye|ir).*clasific/i.test(phase);
  if (!phase || !/principal|final/i.test(phase) || (/clasific|previa|qualif/i.test(phase) && !explicitlyExcludesQualifiers)) blockers.push({ code: 'historical_scope', message: 'El alcance debe ser torneo principal/fase final y excluir clasificación y fases previas.' });
  if (scope.gender && !/masculin|men/i.test(scope.gender)) blockers.push({ code: 'historical_scope', message: 'La categoría histórica requiere fútbol masculino.' });
  if (scope.coverageComplete !== true) blockers.push({ code: 'historical_scope', message: 'La cobertura declarada no está certificada como completa para el universo histórico.' });
  return blockers;
}

export function buildChampionsSourcePolicy(input: { apiValidation: JsonRecord; apiValidationSha256: string }): ChampionsSourcePolicyReport {
  const base = {
    artifactKind: 'champions_historical_source_policy' as const,
    reportVersion: '1' as const,
    categorySlug: 'uefa-champions-league-goals' as const,
    reviewDate: '2026-09-16' as const,
    readOnly: true as const,
    productionData: false as const,
    mutationCount: 0 as const,
    approvalsGranted: false as const,
    published: false as const,
    runId: `block8-champions-${input.apiValidationSha256.slice(0, 16)}`,
    inputArtifact: { path: 'audits/block7e/champions-api-validation.json', sha256: input.apiValidationSha256, status: typeof input.apiValidation.status === 'string' ? input.apiValidation.status : 'unknown' },
    sourceFreeze: [
      { provider: 'Transfermarkt', status: 'frozen_non_publishable' as const, reason: 'Sin autorización de redistribución demostrada; conservar solo como snapshot histórico draft y baseline de auditoría.' },
      { provider: 'API-Football / API-Sports', status: 'frozen_non_publishable' as const, reason: 'La prueba observó 2011–2026, no demuestra 1955/56 ni derechos para publicar el ranking derivado.' }
    ],
    snapshots: { currentStatus: 'draft' as const, newSnapshotCreated: false as const, importPerformed: false as const, databaseModified: false as const },
    minimumRequirements: [
      { key: 'historical_coverage', requirement: 'Cobertura demostrada desde 1955/56 hasta el corte exacto.', blocking: true as const },
      { key: 'competition_definition', requirement: 'Definición inequívoca de Copa de Europa / UEFA Champions League masculina, torneo principal y exclusiones.', blocking: true as const },
      { key: 'cumulative_scorers', requirement: 'Goleadores acumulados, no solo top scorers por temporada.', blocking: true as const },
      { key: 'traceability', requirement: 'Valor, identidad, posición, empate y evidencia trazables por fila.', blocking: true as const },
      { key: 'derived_rights', requirement: 'Permiso escrito para almacenar y publicar rankings derivados.', blocking: true as const },
      { key: 'attribution', requirement: 'Condiciones de atribución documentadas y aplicables al producto.', blocking: true as const },
      { key: 'image_rights', requirement: 'Derechos de imágenes, logos y marcas revisados por separado.', blocking: true as const }
    ],
    providerMatrix: [
      { provider: 'Transfermarkt', historicalCoverage: 'snapshot top 200; alcance por fila no certificado', traceability: 'parcial respecto a snapshot archivado', derivedRankingRights: 'no demostrados', attribution: 'no documentada para Rango90', imageRights: 'separados y no aprobados', status: 'not_eligible' as const },
      { provider: 'API-Football / API-Sports', historicalCoverage: 'observado 2011–2026; insuficiente para v2', traceability: 'muestra de 20 por temporada consultada', derivedRankingRights: 'no autorizados por la evidencia actual', attribution: 'requiere confirmación contractual', imageRights: 'no concedidos automáticamente', status: 'candidate_requires_evidence' as const },
      { provider: 'UEFA / proveedor autorizado', historicalCoverage: 'a demostrar mediante exportación o licencia', traceability: 'requisito por fila', derivedRankingRights: 'requiere licencia escrita', attribution: 'a pactar', imageRights: 'licencia separada', status: 'candidate_requires_evidence' as const }
    ],
    partialRangePolicy: { historicalSlug: 'uefa-champions-league-goals', requiredStartSeason: 1955 as const, partialRangeExample: '2011–2026', allowedAlternativeSlug: 'uefa-champions-league-goals-2011-2026', alternativeCategoryCreated: false as const, officialHistoricalAllowed: false as const },
    runtimePolicy: { lab: ['Puede mostrar el snapshot draft o ranking provisional.', 'Debe mostrar Modo laboratorio y Datos provisionales.', 'Debe advertir que no representa una publicación oficial.'], official: ['Debe rechazar cualquier snapshot draft, parcial o sin alcance estructurado.', 'Nunca puede hacer fallback al ranking de laboratorio.', 'Solo puede servir una categoría histórica con cobertura v2 y derechos aprobados.'], historicalRankingStatus: 'provisional_only_until_source_approved' as const, warningRequired: true as const },
    openBlocks: ['historical_source_not_selected', 'transfermarkt_frozen', 'api_football_coverage_starts_2011_in_observed_probe', 'derived_ranking_rights_missing', 'provider_plan_and_contract_not_verified', 'image_rights_separate_and_unverified'],
    readyForApproval: false as const,
    readyForPublication: false as const
  };
  return { ...base, sha256: sha256(stableJson(base)) };
}

function cell(value: unknown): string { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderChampionsSourcePolicyMarkdown(report: ChampionsSourcePolicyReport): string {
  const lines = [
    '# BLOQUE 8 — Decisión de fuente histórica para Champions League', '',
    '> Política editorial y de publicación. No aprueba fuentes, no modifica datos y no crea categorías ni snapshots.', '',
    `- runId: \`${report.runId}\``, `- fecha: \`${report.reviewDate}\``, `- huella: \`${report.sha256}\``, '- readyForApproval: **false**', '',
    '## Decisión', '',
    'Transfermarkt y API-Football/API-Sports quedan congeladas como fuentes no publicables para Champions histórica. Todos los snapshots existentes permanecen en `draft`. No se realizarán importaciones ni peticiones masivas.', '',
    '## Requisitos mínimos de una fuente válida', '', '| Requisito | Condición bloqueante |', '| --- | --- |', ...report.minimumRequirements.map((item) => `| ${item.key} | ${item.requirement} |`), '',
    '## Matriz de proveedores', '', '| Proveedor | Cobertura | Trazabilidad | Ranking derivado | Atribución | Imágenes | Estado |', '| --- | --- | --- | --- | --- | --- | --- |', ...report.providerMatrix.map((item) => `| ${item.provider} | ${cell(item.historicalCoverage)} | ${cell(item.traceability)} | ${cell(item.derivedRankingRights)} | ${cell(item.attribution)} | ${cell(item.imageRights)} | **${item.status}** |`), '',
    '## Separación de alcance', '', `- La categoría histórica es \`${report.partialRangePolicy.historicalSlug}\` y exige inicio **1955/56**.`, `- El rango parcial ${report.partialRangePolicy.partialRangeExample} no puede presentarse con ese nombre.`, `- Categoría alternativa propuesta, no creada: \`${report.partialRangePolicy.allowedAlternativeSlug}\`.`, '- Si algún día se publica 2011–2026, deberá tener etiqueta, definición, snapshot y derechos propios.', '',
    '## Laboratorio y producto oficial', '', '- `lab`: puede mostrar datos provisionales, siempre con advertencia visible.', '- `official`: rechaza cualquier ranking parcial, draft o sin derechos aprobados.', '- La página histórica solo es provisional hasta seleccionar y aprobar una fuente válida.', '',
    '## Fuentes congeladas', '', ...report.sourceFreeze.map((source) => `- **${source.provider}** — ${source.status}: ${source.reason}`), '',
    '## Estado', '', ...report.openBlocks.map((block) => `- ${block}`), '- No se modificó PostgreSQL.', '- No se modificó Render.', '- No se creó ni publicó ningún snapshot.', '',
    'La puerta permanece cerrada hasta demostrar cobertura completa desde 1955/56, derechos de ranking derivado y derechos separados de medios.', ''
  ];
  return lines.join('\n');
}
