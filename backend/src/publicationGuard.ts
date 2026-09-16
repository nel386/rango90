import type { RuntimeMode } from './runtimeMode.js';
import { validateHistoricalScope, type HistoricalScope } from './championsHistoricalSourcePolicy.js';

export type PublicationBlockerCode =
  | 'challenge_status'
  | 'test_only'
  | 'category_count'
  | 'category_not_approved'
  | 'snapshot_status'
  | 'coverage_incomplete'
  | 'identity_conflict'
  | 'source_rights'
  | 'score_mismatch'
  | 'answer_matrix'
  | 'entity_not_playable'
  | 'image_not_publishable'
  | 'historical_scope';

export type PublicationBlocker = {
  code: PublicationBlockerCode;
  message: string;
  categorySlug?: string;
  snapshotId?: string;
};

export type OfficialCategoryCheck = {
  slug: string;
  snapshotId: string;
  categoryStatus: string;
  snapshotStatus: string;
  coverageComplete: boolean;
  unresolvedConflicts: number;
  rightsStatus: string;
  scoreMismatches: number;
  imagePolicyRequired: boolean;
  nonPublishableImages: number;
  historicalScope?: HistoricalScope;
};

export type OfficialChallengeCheck = {
  challengeId: string;
  status: string;
  testOnly: boolean;
  categories: readonly OfficialCategoryCheck[];
  decisionCount: number;
  answerCount: number;
  entityNotPlayable: number;
};

export type OfficialNotReadyDetails = {
  runtimeMode: 'official';
  blockingCategories: Array<{ slug: string; snapshotId: string | null; reasons: string[] }>;
  snapshotRequired: string;
  reason: string;
};

const reasonForCode: Record<PublicationBlockerCode, string> = {
  challenge_status: 'El reto no está publicado.',
  test_only: 'El reto está marcado como testOnly.',
  category_count: 'El reto diario no tiene exactamente siete categorías distintas.',
  category_not_approved: 'La categoría no está aprobada para publicación.',
  snapshot_status: 'El snapshot no está publicado.',
  coverage_incomplete: 'El snapshot tiene cobertura incompleta.',
  identity_conflict: 'El snapshot conserva conflictos de identidad sin resolver.',
  source_rights: 'La fuente no tiene derechos aprobados.',
  score_mismatch: 'Hay scores que no coinciden con el snapshot.',
  answer_matrix: 'La matriz de respuestas no está completa.',
  entity_not_playable: 'Hay entidades fuera del catálogo jugable válido.',
  image_not_publishable: 'La política de la categoría exige imágenes publicables.',
  historical_scope: 'El alcance histórico de la categoría no está validado desde 1955/56.'
};

export function validateOfficialChallenge(input: OfficialChallengeCheck): PublicationBlocker[] {
  const blockers: PublicationBlocker[] = [];
  if (input.status !== 'published') blockers.push({ code: 'challenge_status', message: reasonForCode.challenge_status });
  if (input.testOnly) blockers.push({ code: 'test_only', message: reasonForCode.test_only });
  const distinctSlugs = new Set(input.categories.map((category) => category.slug));
  if (input.categories.length !== 7 || distinctSlugs.size !== 7) blockers.push({ code: 'category_count', message: reasonForCode.category_count });
  if (input.answerCount !== input.decisionCount * input.categories.length || input.decisionCount !== 7) blockers.push({ code: 'answer_matrix', message: reasonForCode.answer_matrix });
  if (input.entityNotPlayable > 0) blockers.push({ code: 'entity_not_playable', message: reasonForCode.entity_not_playable });
  for (const category of input.categories) {
    const context = { categorySlug: category.slug, snapshotId: category.snapshotId };
    if (!['approved', 'published'].includes(category.categoryStatus)) blockers.push({ code: 'category_not_approved', message: reasonForCode.category_not_approved, ...context });
    if (category.snapshotStatus !== 'published') blockers.push({ code: 'snapshot_status', message: reasonForCode.snapshot_status, ...context });
    if (!category.coverageComplete) blockers.push({ code: 'coverage_incomplete', message: reasonForCode.coverage_incomplete, ...context });
    if (category.unresolvedConflicts > 0) blockers.push({ code: 'identity_conflict', message: reasonForCode.identity_conflict, ...context });
    if (category.rightsStatus !== 'approved') blockers.push({ code: 'source_rights', message: reasonForCode.source_rights, ...context });
    if (category.scoreMismatches > 0) blockers.push({ code: 'score_mismatch', message: reasonForCode.score_mismatch, ...context });
    if (category.imagePolicyRequired && category.nonPublishableImages > 0) blockers.push({ code: 'image_not_publishable', message: reasonForCode.image_not_publishable, ...context });
    for (const scopeBlocker of validateHistoricalScope(category.slug, category.historicalScope)) blockers.push({ code: scopeBlocker.code, message: scopeBlocker.message, ...context });
  }
  return blockers;
}

export function runtimeAllowsChallenge(runtimeMode: RuntimeMode, status: string, testOnly: boolean): boolean {
  return runtimeMode === 'lab'
    ? status === 'published' || (status === 'draft' && testOnly)
    : status === 'published' && !testOnly;
}

export function officialNotReadyDetails(
  challengeId: string | null,
  blockers: readonly PublicationBlocker[] = []
): OfficialNotReadyDetails {
  const grouped = new Map<string, { snapshotId: string | null; reasons: string[] }>();
  for (const blocker of blockers) {
    const slug = blocker.categorySlug ?? 'reto';
    const current = grouped.get(slug) ?? { snapshotId: blocker.snapshotId ?? null, reasons: [] };
    if (!current.reasons.includes(blocker.message)) current.reasons.push(blocker.message);
    grouped.set(slug, current);
  }
  const blockingCategories = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([slug, value]) => ({ slug, snapshotId: value.snapshotId, reasons: [...value.reasons].sort() }));
  const reason = challengeId
    ? `El reto ${challengeId} no puede publicarse todavía.`
    : 'No existe ningún reto oficial válido para servir todavía.';
  return {
    runtimeMode: 'official',
    blockingCategories,
    snapshotRequired: 'Un snapshot publicado, no superseded, con cobertura completa, identidad resuelta, fuente con derechos approved y scores consistentes para cada categoría.',
    reason
  };
}

export function assertRuntimeModeDoesNotChange(initial: RuntimeMode, current: RuntimeMode): void {
  if (initial !== current) throw new Error('RANGO90_RUNTIME_MODE no puede cambiar durante la vida de la aplicación');
}
