import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildScopeDecision,
  buildScopeDecisionBundle,
  scopeDecisionBundleJson,
  renderScopeDecisionMarkdown,
  type AbbreviatedIdentity,
  type ScopeClassification,
  type ScopeConflict
} from '../rankingScopeDecisions.js';

const OUTPUT_DIRECTORY = resolve('audits/ranking-scope');
const AUDIT_PATH = resolve('audits/ranking-truth/ranking-truth.json');
const VALIDATION_PATH = resolve('audits/ranking-validation/ranking-validation-discrepancies.json');
const PRIMARY_UEFA_PATH = resolve('storage/source-snapshots/src_257235808020fc330123b522.json');
const OFFICIAL_UEFA_PATH = resolve('storage/source-snapshots/src_c9359c9f91bba9215af8fef6.json');
const PRIMARY_WORLD_CUP_PATH = resolve('storage/source-snapshots/src_a5862ab2e594939ddfa99181.json');
const CONTRAST_PATH = resolve('data/evidence/uefa-champions-league-goals-2026-09-12/official-contrast.json');

// The audit input is intentionally schema-flexible because it is a read-only
// artifact produced by an earlier block.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function fileSha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]/gu, '');
}

function classificationFor(player: string): { classification: ScopeClassification; basis: string } {
  if (player === 'Cristiano Ronaldo') {
    return { classification: 'diferencia de alcance', basis: 'La referencia UEFA separa explícitamente una lista sin clasificación (140) de otra con clasificación (141); el snapshot archivado no documenta qué corte explica este caso.' };
  }
  return { classification: 'discrepancia no resoluble', basis: 'Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación.' };
}

function conflictRows(primary: AnyRecord, contrast: AnyRecord): ScopeConflict[] {
  return contrast.discrepancies.map((item: AnyRecord) => {
    const primaryEntry = primary.entries.find((entry: AnyRecord) => normalizeName(entry.name) === normalizeName(item.name));
    const classification = classificationFor(item.name);
    return {
      player: item.name,
      primaryValue: item.primaryGoals,
      officialValue: item.officialGoals,
      storedValue: primaryEntry?.rawValue ?? item.primaryGoals,
      primaryRank: item.primaryRank,
      officialRank: item.officialRank,
      classification: classification.classification,
      classificationBasis: classification.basis,
      primaryDefinition: 'Tabla histórica de Transfermarkt para European Cup / Champions League; el snapshot no conserva desglose por partido ni una declaración verificable de rondas para este contraste.',
      officialDefinition: 'Ranking histórico oficial UEFA de goles; el snapshot archivado no conserva el desglose por partido/ronda de esta fila.',
      includesEuropeanCup: 'no documentado',
      includesQualifying: 'no documentado',
      includesPreliminaryRounds: 'no documentado',
      evidenceUrls: [primary.source.baseUrl, contrast.primary.url, contrast.officialContrast.url],
      status: 'abierta'
    };
  });
}

function abbreviations(validation: AnyRecord, slug: string): AbbreviatedIdentity[] {
  const report = validation.reports.find((item: AnyRecord) => item.categorySlug === slug);
  return (report?.entries ?? [])
    .filter((entry: AnyRecord) => entry.issues.some((issue: AnyRecord) => issue.code === 'short_or_ambiguous_source_name'))
    .map((entry: AnyRecord) => ({
      categorySlug: slug,
      canonicalEntityId: entry.entityId,
      canonicalName: entry.canonicalName,
      sourceName: entry.sourceName,
      sourceProfileUrl: entry.sourceProfileUrl,
      sourceExternalId: entry.sourceProfileUrl,
      disambiguation: `Perfil externo exacto de Transfermarkt; se conserva el nombre canónico del catálogo y no se resuelve por nombre libre (${entry.sourceProfileUrl}).`
    }));
}

async function main(): Promise<void> {
  const [audit, validation, primaryUefa, contrast] = await Promise.all([
    json<AnyRecord>(AUDIT_PATH), json<AnyRecord>(VALIDATION_PATH), json<AnyRecord>(PRIMARY_UEFA_PATH), json<AnyRecord>(CONTRAST_PATH)
  ]);
  const uefaAudit = audit.categories.find((category: AnyRecord) => category.slug === 'uefa-champions-league-goals');
  const worldAudit = audit.categories.find((category: AnyRecord) => category.slug === 'world-cup-goals');
  if (!uefaAudit || !worldAudit) throw new Error('Faltan las categorías prioritarias en ranking-truth.json');
  const [primaryUefaSha, officialUefaSha, primaryWorldCupSha] = await Promise.all([fileSha256(PRIMARY_UEFA_PATH), fileSha256(OFFICIAL_UEFA_PATH), fileSha256(PRIMARY_WORLD_CUP_PATH)]);
  const uefaConflicts = conflictRows(primaryUefa, contrast);
  const uefa = buildScopeDecision({
    categorySlug: 'uefa-champions-league-goals',
    currentLabel: uefaAudit.definition.labelEs,
    proposedExactLabel: 'Goles históricos — Copa de Europa / UEFA Champions League (sin rondas de clasificación)',
    decisionStatus: 'proposed_not_approved',
    whatItMeasures: 'Goles oficiales de jugadores en la Copa de Europa y la UEFA Champions League masculina, contados en el torneo principal desde su inauguración.',
    finalDefinition: {
      entityType: 'player', metric: 'goals', competition: 'Copa de Europa / UEFA Champions League', temporalWindow: '1955/56–2025/26; corte del dato al 2026-09-12', snapshotCutoff: '2026-09-12 (snapshot recuperado; no se presume inclusión de partidos posteriores)', tournamentPhase: 'torneo principal/fase final; sin rondas de clasificación ni fases previas', gender: 'masculino', countingRule: 'un gol por anotación oficial registrada por la fuente adoptada; empates por valor exacto y ranking de competición'
    },
    included: ['Ediciones desde 1955/56, incluida la etapa denominada Copa de Europa.', 'Partidos oficiales del torneo principal de clubes.', 'Jugadores que hayan anotado en esas ediciones, sin limitar por nacionalidad ni estado de retiro.'],
    excluded: ['Rondas de clasificación y fases previas.', 'Amistosos, juveniles, reservas, testimoniales y otras competiciones UEFA.', 'Filas sintéticas: el límite de 200 es de filas reales de la fuente, no una afirmación de cobertura universal.'],
    sourceAuthority: {
      semanticAuthority: 'UEFA oficial para resolver qué competición, rondas y periodización significa “Copa de Europa / Champions League”.',
      numericPrimarySource: 'Transfermarkt archivado, actualmente conservado como fuente numérica primaria provisional; rightsStatus=review_required.',
      conflictRule: 'No se mezclan ni promedian valores. UEFA fija la semántica; ningún valor sustituye al otro hasta resolver cada conflicto con evidencia de partido o una decisión del titular.'
    },
    lineage: { rankingSnapshotId: uefaAudit.snapshots.ranking.id, rankingDataVersion: uefaAudit.snapshots.ranking.dataVersion, rankingAlgorithmVersion: uefaAudit.snapshots.ranking.algorithmVersion, rankingContentSha256: uefaAudit.snapshots.ranking.contentSha256, primarySourceSnapshotId: uefaAudit.snapshots.source.id, primarySourceContentSha256: primaryUefaSha, officialContrastSnapshotId: 'src_c9359c9f91bba9215af8fef6', officialContrastContentSha256: officialUefaSha },
    valueCheck: { top20Checked: 20, top20ValuesMatchArchivedPrimary: true, definitionScopeExplicit: false, note: 'La coincidencia demuestra consistencia con el snapshot archivado, no que Transfermarkt sea definitivamente correcto frente a UEFA; el snapshot no explicita por fila el tratamiento de rondas.' },
    conflicts: uefaConflicts,
    abbreviatedIdentities: abbreviations(validation, 'uefa-champions-league-goals'),
    openDiscrepancies: ['Los 12 conflictos de contraste siguen abiertos: 1 clasificado provisionalmente como diferencia de alcance y 11 como discrepancias no resolubles con la evidencia disponible.', 'El snapshot actual de Transfermarkt y el snapshot oficial de UEFA tienen cortes/metadatos distintos; hay que conservar ambos y documentar el desglose por partido/ronda.', 'La etiqueta visible actual omite Copa de Europa y la exclusión de clasificación; debe actualizarse junto con una nueva versión draft, no mediante edición destructiva.'],
    approvalGates: ['Resolver los 12 conflictos con desglose de alcance/definición o declarar formalmente una fuente autoridad.', 'Confirmar una definición de sin clasificación y su ventana temporal exacta con el titular/fuente oficial.', 'Crear, si procede, un nuevo snapshot con data_version, algorithm_version, content_sha256 y definición completa; mantenerlo en draft.', 'Obtener rights_status=approved para la fuente numérica que vaya a redistribuirse y revisar los assets por separado.'],
    rightsStatus: 'review_required'
  });
  const worldCup = buildScopeDecision({
    categorySlug: 'world-cup-goals',
    currentLabel: worldAudit.definition.labelEs,
    proposedExactLabel: 'Goles históricos — Copa Mundial masculina (fases finales)',
    decisionStatus: 'proposed_not_approved',
    whatItMeasures: 'Goles de jugadores en las fases finales de la Copa Mundial masculina de la FIFA, sumados por edición de torneo.',
    finalDefinition: {
      entityType: 'player', metric: 'goals', competition: 'FIFA World Cup masculina', temporalWindow: '1930–2026 inclusive; corte del dato al 2026-09-12', snapshotCutoff: '2026-09-12 (posterior al cierre de la edición 2026)', tournamentPhase: 'solo fases finales del torneo', gender: 'masculino', countingRule: 'goles anotados en partidos de las fases finales; empates por valor exacto y ranking de competición'
    },
    included: ['Ediciones de la Copa Mundial masculina desde 1930 hasta 2026 inclusive.', 'Futbolistas participantes en las fases finales, incluido cualquier estado de retiro.', 'La edición 2026 solo hasta el cierre documentado del snapshot.'],
    excluded: ['Clasificatorias, repescas y partidos de preparación.', 'Torneos femeninos, juveniles, olímpicos, confederativos o de clubes.', 'Filas sintéticas: el top 200 es un corte de filas reales y no añade jugadores con cero goles.'],
    sourceAuthority: {
      semanticAuthority: 'FIFA oficial para la definición de Copa Mundial masculina y sus fases finales.',
      numericPrimarySource: 'Transfermarkt archivado, conservado como fuente numérica primaria provisional; rightsStatus=review_required.',
      conflictRule: 'No se sustituyen valores por coincidencia nominal; la definición adoptada debe comprobarse contra la fuente antes de aprobar.'
    },
    lineage: { rankingSnapshotId: worldAudit.snapshots.ranking.id, rankingDataVersion: worldAudit.snapshots.ranking.dataVersion, rankingAlgorithmVersion: worldAudit.snapshots.ranking.algorithmVersion, rankingContentSha256: worldAudit.snapshots.ranking.contentSha256, primarySourceSnapshotId: worldAudit.snapshots.source.id, primarySourceContentSha256: primaryWorldCupSha, officialContrastSnapshotId: null, officialContrastContentSha256: null },
    valueCheck: { top20Checked: 20, top20ValuesMatchArchivedPrimary: true, definitionScopeExplicit: true, note: 'Los 20 valores coinciden con el snapshot primario archivado y su scope declara final tournaments; la referencia FIFA se conserva como autoridad semántica y contraste, no como sustitución numérica automática.' },
    conflicts: [],
    abbreviatedIdentities: abbreviations(validation, 'world-cup-goals'),
    openDiscrepancies: ['La fuente primaria mantiene rightsStatus=review_required.', 'La fuente archivada no expone una trazabilidad partido por partido en este artefacto; debe documentarse antes de aprobar.', 'Las imágenes pendientes quedan fuera de esta decisión de alcance y se abordarán en el bloque de media.'],
    approvalGates: ['Confirmar que el corte 1930–2026 y la exclusión de clasificatorias están explícitos en la fuente adoptada.', 'Conservar la definición completa en metadatos de una nueva versión draft si se modifica el snapshot.', 'Resolver derechos de redistribución de la fuente numérica antes de aprobar o publicar.'],
    rightsStatus: 'review_required'
  });
  const bundle = buildScopeDecisionBundle([uefa, worldCup]);
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await Promise.all([
    writeFile(resolve(OUTPUT_DIRECTORY, 'RANKING_SCOPE_DECISION_UEFA.md'), renderScopeDecisionMarkdown(uefa), 'utf8'),
    writeFile(resolve(OUTPUT_DIRECTORY, 'RANKING_SCOPE_DECISION_WORLD_CUP.md'), renderScopeDecisionMarkdown(worldCup), 'utf8'),
    writeFile(resolve(OUTPUT_DIRECTORY, 'ranking-scope-decisions.json'), scopeDecisionBundleJson(bundle), 'utf8')
  ]);
  console.log(JSON.stringify({ readOnly: true, productionData: false, editorialApproval: false, outputDirectory: OUTPUT_DIRECTORY, decisions: bundle.decisions.map((decision) => ({ categorySlug: decision.categorySlug, decisionStatus: decision.decisionStatus, conflicts: decision.conflicts.length, abbreviatedIdentities: decision.abbreviatedIdentities.length, decisionSha256: decision.hashes.decisionSha256 })), bundleSha256: bundle.hashes.bundleSha256 }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
