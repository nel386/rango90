import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildChampionsApprovalDossier, renderChampionsApprovalMarkdown, sha256, stableJson } from '../championsApprovalDossier.js';

const root = resolve(process.cwd());
const inputPath = resolve(root, 'audits/block7a/champions-conflict-audit.json');
const outputRoot = resolve(root, 'audits/block7b');
const inputContent = await readFile(inputPath, 'utf8');
const input = JSON.parse(inputContent);
const inputSha256 = createHash('sha256').update(inputContent).digest('hex');
const dossier = buildChampionsApprovalDossier({ audit: input, auditSha256: inputSha256 });
const scopeDecision = {
  artifactKind: 'versioned_scope_decision',
  version: dossier.scopeDecision.version,
  categorySlug: dossier.categorySlug,
  status: dossier.scopeDecision.status,
  approved: false,
  definition: dossier.scopeDecision.definition,
  label: dossier.scopeDecision.label,
  authority: dossier.scopeDecision.authority,
  rationale: dossier.scopeDecision.rationale,
  inputAuditRunId: dossier.inputAudit.runId,
  inputAuditSha256: dossier.inputAudit.sha256,
  readOnly: true,
  productionData: false,
  mutationCount: 0
};
const matrix = { artifactKind: 'champions_conflict_resolution_matrix', categorySlug: dossier.categorySlug, sourceDossierRunId: dossier.runId, total: dossier.conflictMatrix.total, blocked: dossier.conflictMatrix.blocked, rows: dossier.conflictMatrix.rows, readOnly: true, productionData: false, mutationCount: 0 };
const dossierJson = stableJson(dossier);
const scopeJson = stableJson(scopeDecision);
const matrixJson = stableJson(matrix);
const scopeMarkdown = [
  '# Decisión de alcance — UEFA Champions League (v2)',
  '',
  '> Propuesta editorial versionada. No es una aprobación ni modifica el snapshot.',
  '',
  `- categoría: \`${dossier.categorySlug}\``,
  `- versión: \`${dossier.scopeDecision.version}\``,
  `- estado: **${dossier.scopeDecision.status}**`,
  `- auditoría de entrada: \`${dossier.inputAudit.runId}\``,
  '',
  '## Definición propuesta',
  '',
  `- Etiqueta: **${dossier.scopeDecision.label}**`,
  `- ${dossier.scopeDecision.authority}`,
  `- ${dossier.scopeDecision.rationale}`,
  `- Definición completa: \`${JSON.stringify(dossier.scopeDecision.definition)}\``,
  '',
  '## Regla de conflicto',
  '',
  'UEFA fija la semántica de competición y fases. Transfermarkt se conserva como fuente numérica provisional del snapshot actual. No se mezclan ni sustituyen valores hasta disponer de evidencia de alcance/definición y revisión aprobada de derechos.',
  '',
  '## Estado',
  '',
  '- No aprobado.',
  '- No publicado.',
  '- Snapshot actual conservado en draft.',
  '- Los 12 conflictos permanecen bloqueados.',
  '- La prueba de publicación y rollback en PostgreSQL aislado permanece pendiente.',
  ''
].join('\n');
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, 'champions-approval-dossier.json'), dossierJson, 'utf8');
await writeFile(resolve(outputRoot, 'champions-approval-dossier.md'), renderChampionsApprovalMarkdown(dossier), 'utf8');
await writeFile(resolve(outputRoot, 'ranking-scope-decision-uefa-v2.json'), scopeJson, 'utf8');
await writeFile(resolve(outputRoot, 'RANKING_SCOPE_DECISION_UEFA_v2.md'), scopeMarkdown, 'utf8');
await writeFile(resolve(outputRoot, 'champions-conflict-resolution-matrix.json'), matrixJson, 'utf8');
console.log(JSON.stringify({
  runId: dossier.runId,
  categorySlug: dossier.categorySlug,
  conflicts: dossier.conflictMatrix.total,
  conflictsBlocked: dossier.conflictMatrix.blocked,
  pendingDiscrepancies: dossier.pendingResolutions.total,
  editoriallyResolved: dossier.pendingResolutions.editoriallyResolved,
  pendingBlocked: dossier.pendingResolutions.blocked,
  isolatedValidation: dossier.isolatedValidation.status,
  readyForApproval: dossier.readyForApproval,
  dossierSha256: sha256(dossierJson),
  scopeDecisionSha256: sha256(scopeJson),
  matrixSha256: sha256(matrixJson),
  outputRoot
}, null, 2));
