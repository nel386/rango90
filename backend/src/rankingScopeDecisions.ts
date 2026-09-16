import { createHash } from 'node:crypto';

export type ScopeClassification = 'diferencia de alcance' | 'diferencia de definición' | 'error de fuente' | 'error de identidad' | 'discrepancia no resoluble';

export type ScopeConflict = {
  player: string;
  primaryValue: number;
  officialValue: number;
  storedValue: number;
  primaryRank: number;
  officialRank: number;
  classification: ScopeClassification;
  classificationBasis: string;
  primaryDefinition: string;
  officialDefinition: string;
  includesEuropeanCup: 'sí' | 'no' | 'no documentado';
  includesQualifying: 'sí' | 'no' | 'no documentado';
  includesPreliminaryRounds: 'sí' | 'no' | 'no documentado';
  evidenceUrls: string[];
  status: 'abierta';
};

export type AbbreviatedIdentity = {
  categorySlug: string;
  canonicalEntityId: string;
  canonicalName: string;
  sourceName: string;
  sourceProfileUrl: string;
  sourceExternalId: string;
  disambiguation: string;
};

export type ScopeDecision = {
  artifactKind: 'scope_decision';
  readOnly: true;
  productionData: false;
  editorialApproval: false;
  categorySlug: string;
  currentLabel: string;
  proposedExactLabel: string;
  decisionStatus: 'proposed_not_approved';
  whatItMeasures: string;
  finalDefinition: {
    entityType: 'player';
    metric: 'goals';
    competition: string;
    temporalWindow: string;
    snapshotCutoff: string;
    tournamentPhase: string;
    gender: string;
    countingRule: string;
  };
  included: string[];
  excluded: string[];
  sourceAuthority: {
    semanticAuthority: string;
    numericPrimarySource: string;
    conflictRule: string;
  };
  lineage: {
    rankingSnapshotId: string;
    rankingDataVersion: string;
    rankingAlgorithmVersion: string;
    rankingContentSha256: string;
    primarySourceSnapshotId: string;
    primarySourceContentSha256: string;
    officialContrastSnapshotId: string | null;
    officialContrastContentSha256: string | null;
  };
  valueCheck: { top20Checked: number; top20ValuesMatchArchivedPrimary: boolean; definitionScopeExplicit: boolean; note: string };
  conflicts: ScopeConflict[];
  abbreviatedIdentities: AbbreviatedIdentity[];
  openDiscrepancies: string[];
  approvalGates: string[];
  rightsStatus: 'review_required';
  hashes: { decisionSha256: string };
};

export type ScopeDecisionBundle = {
  artifactKind: 'scope_decision_bundle';
  readOnly: true;
  productionData: false;
  editorialApproval: false;
  decisions: ScopeDecision[];
  allConflicts: Array<ScopeConflict & { categorySlug: string }>;
  allAbbreviatedIdentities: AbbreviatedIdentity[];
  recommendation: string;
  hashes: { bundleSha256: string };
};

type DecisionSeed = Omit<ScopeDecision, 'artifactKind' | 'readOnly' | 'productionData' | 'editorialApproval' | 'hashes'>;

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildScopeDecision(seed: DecisionSeed): ScopeDecision {
  const base = { artifactKind: 'scope_decision' as const, readOnly: true as const, productionData: false as const, editorialApproval: false as const, ...seed };
  return { ...base, hashes: { decisionSha256: createHash('sha256').update(stableJson(base)).digest('hex') } };
}

export function buildScopeDecisionBundle(decisions: ScopeDecision[]): ScopeDecisionBundle {
  const base = {
    artifactKind: 'scope_decision_bundle' as const,
    readOnly: true as const,
    productionData: false as const,
    editorialApproval: false as const,
    decisions: [...decisions].sort((left, right) => left.categorySlug.localeCompare(right.categorySlug)),
    allConflicts: decisions.flatMap((decision) => decision.conflicts.map((conflict) => ({ categorySlug: decision.categorySlug, ...conflict }))),
    allAbbreviatedIdentities: decisions.flatMap((decision) => decision.abbreviatedIdentities),
    recommendation: 'Mantener los snapshots actuales en draft y rights_required/review_required. Resolver alcance, definición y derechos antes de cambiar valores, aprobar o publicar.'
  };
  return { ...base, hashes: { bundleSha256: createHash('sha256').update(stableJson(base)).digest('hex') } };
}

function markdownTable<T extends Record<string, unknown>>(headers: string[], rows: T[], values: (row: T) => string[]): string[] {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${values(row).join(' | ')} |`);
  return lines;
}

export function renderScopeDecisionMarkdown(decision: ScopeDecision): string {
  const lines = [
    `# Decisión de alcance — ${decision.categorySlug}`,
    '',
    '> ARTIFACTO DE DECISIÓN EDITORIAL — solo lectura. Es una propuesta documentada; no es producción, no aprueba datos y no publica cambios.',
    '',
    `Estado: **${decision.decisionStatus}**.`,
    `Etiqueta actual: **${decision.currentLabel}**.`,
    `Etiqueta exacta propuesta: **${decision.proposedExactLabel}**.`,
    '',
    '## Respuestas de alcance',
    '',
    `- Qué mide: ${decision.whatItMeasures}`,
    `- Ventana temporal: ${decision.finalDefinition.temporalWindow}`,
    `- Corte del snapshot: ${decision.finalDefinition.snapshotCutoff}`,
    `- Fase: ${decision.finalDefinition.tournamentPhase}`,
    `- Género: ${decision.finalDefinition.gender}`,
    `- Regla de conteo: ${decision.finalDefinition.countingRule}`,
    '',
    '### Incluye',
    '',
    ...decision.included.map((item) => `- ${item}`),
    '',
    '### Excluye',
    '',
    ...decision.excluded.map((item) => `- ${item}`),
    '',
    '## Autoridad de fuentes',
    '',
    `- Autoridad semántica: ${decision.sourceAuthority.semanticAuthority}`,
    `- Fuente numérica primaria actual: ${decision.sourceAuthority.numericPrimarySource}`,
    `- Regla ante conflicto: ${decision.sourceAuthority.conflictRule}`,
    '',
    '## Trazabilidad y valores',
    '',
    `- Ranking: \`${decision.lineage.rankingSnapshotId}\`; data_version: \`${decision.lineage.rankingDataVersion}\`; algorithm_version: \`${decision.lineage.rankingAlgorithmVersion}\`; content_sha256: \`${decision.lineage.rankingContentSha256}\`.`,
    `- Fuente primaria: \`${decision.lineage.primarySourceSnapshotId}\`; content_sha256: \`${decision.lineage.primarySourceContentSha256}\`.`,
    `- Contraste oficial: \`${decision.lineage.officialContrastSnapshotId ?? 'no disponible'}\`; content_sha256: \`${decision.lineage.officialContrastContentSha256 ?? 'no disponible'}\`.`,
    `- Top 20 comprobado: ${decision.valueCheck.top20Checked}; coincide con la fuente primaria archivada: ${decision.valueCheck.top20ValuesMatchArchivedPrimary ? 'sí' : 'no'}; alcance explícito en la fuente: ${decision.valueCheck.definitionScopeExplicit ? 'sí' : 'no'}. ${decision.valueCheck.note}`,
    '',
    '## Discrepancias abiertas',
    ''
  ];
  if (decision.conflicts.length) {
    lines.push(...markdownTable(
      ['Jugador', 'Transfermarkt', 'UEFA', 'Almacenado', 'Rank TM/UEFA', 'Clasificación', 'Definición TM', 'Definición UEFA', 'Criterio fase/alcance'],
      decision.conflicts,
      (row) => [row.player, String(row.primaryValue), String(row.officialValue), String(row.storedValue), `${row.primaryRank}/${row.officialRank}`, row.classification, row.primaryDefinition, row.officialDefinition, `Europea antigua: ${row.includesEuropeanCup}; clasificación: ${row.includesQualifying}; previas: ${row.includesPreliminaryRounds}`]
    ));
  } else lines.push('No hay discrepancias numéricas registradas.', '');
  lines.push('', 'Las clasificaciones no autorizan cambiar valores. Las discrepancias marcadas como no resolubles necesitan evidencia adicional del titular o una fuente revisada.', '', '## Identidades abreviadas o ambiguas', '');
  lines.push(...markdownTable(
    ['Entidad canónica', 'Nombre canónico', 'Nombre fuente', 'ID/URL externo', 'Desambiguación'],
    decision.abbreviatedIdentities,
    (row) => [`\`${row.canonicalEntityId}\``, row.canonicalName, row.sourceName, `[perfil](${row.sourceProfileUrl})`, row.disambiguation]
  ));
  lines.push('', '## Qué queda abierto', '', ...decision.openDiscrepancies.map((item) => `- ${item}`), '', '## Requisitos para aprobar', '', ...decision.approvalGates.map((item) => `- ${item}`), '', `Estado de derechos: **${decision.rightsStatus}**; no se ha elevado a approved.`, '', `Huella de esta decisión: ${decision.hashes.decisionSha256}.`, '');
  return lines.join('\n');
}

export function scopeDecisionJson(decision: ScopeDecision): string {
  return stableJson(decision);
}

export function scopeDecisionBundleJson(bundle: ScopeDecisionBundle): string {
  return stableJson(bundle);
}
