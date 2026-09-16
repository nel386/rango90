import { createHash } from 'node:crypto';

export type PlayableMediaAuditEntry = {
  entityId: string;
  canonicalName: string;
  categorySlug: string;
  rank: number;
  mediaStatus: 'licensed' | 'fallback' | 'unavailable';
  reviewStatus: 'approved' | 'pending' | 'rejected' | 'missing';
  rightsStatus: 'approved' | 'review_required' | 'rejected' | 'missing';
  isPublishable: boolean;
  priority: boolean;
  reason: string;
};

export type PlayableMediaAuditReport = {
  artifactKind: 'playable_media_audit';
  reportVersion: '1';
  readOnly: true;
  productionData: false;
  editorialApproval: false;
  watermark: string | null;
  appearancesTotal: number;
  canonicalEntitiesTotal: number;
  licensedAppearances: number;
  fallbackAppearances: number;
  unavailableAppearances: number;
  entitiesWithLicensedImage: number;
  entitiesWithFallback: number;
  entitiesWithoutRepresentation: number;
  priorityMissingApprovedPortraits: number;
  entries: PlayableMediaAuditEntry[];
  sha256: string;
};

export function buildPlayableMediaAudit(entries: PlayableMediaAuditEntry[], watermark: string | null): PlayableMediaAuditReport {
  const ordered = [...entries].sort((left, right) => Number(right.priority) - Number(left.priority) || left.rank - right.rank || left.canonicalName.localeCompare(right.canonicalName) || left.entityId.localeCompare(right.entityId));
  const byEntity = new Map<string, PlayableMediaAuditEntry[]>();
  for (const entry of ordered) byEntity.set(entry.entityId, [...(byEntity.get(entry.entityId) ?? []), entry]);
  const entityGroups = [...byEntity.values()];
  const entityHasLicensed = (group: PlayableMediaAuditEntry[]) => group.some((entry) => entry.mediaStatus === 'licensed');
  const entityHasFallback = (group: PlayableMediaAuditEntry[]) => !entityHasLicensed(group) && group.some((entry) => entry.mediaStatus === 'fallback');
  const entityHasNoRepresentation = (group: PlayableMediaAuditEntry[]) => group.every((entry) => entry.mediaStatus === 'unavailable');
  const reportWithoutHash = {
    artifactKind: 'playable_media_audit' as const,
    reportVersion: '1' as const,
    readOnly: true as const,
    productionData: false as const,
    editorialApproval: false as const,
    watermark,
    appearancesTotal: ordered.length,
    canonicalEntitiesTotal: entityGroups.length,
    licensedAppearances: ordered.filter((entry) => entry.mediaStatus === 'licensed').length,
    fallbackAppearances: ordered.filter((entry) => entry.mediaStatus === 'fallback').length,
    unavailableAppearances: ordered.filter((entry) => entry.mediaStatus === 'unavailable').length,
    entitiesWithLicensedImage: entityGroups.filter(entityHasLicensed).length,
    entitiesWithFallback: entityGroups.filter(entityHasFallback).length,
    entitiesWithoutRepresentation: entityGroups.filter(entityHasNoRepresentation).length,
    priorityMissingApprovedPortraits: new Set(ordered.filter((entry) => entry.priority && entry.mediaStatus !== 'licensed').map((entry) => entry.entityId)).size,
    entries: ordered
  };
  const sha256 = createHash('sha256').update(JSON.stringify(reportWithoutHash)).digest('hex');
  return { ...reportWithoutHash, sha256 };
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function renderPlayableMediaAuditCsv(report: PlayableMediaAuditReport): string {
  const headers = ['entity_id', 'canonical_name', 'category_slug', 'rank', 'media_status', 'review_status', 'rights_status', 'is_publishable', 'priority', 'reason'];
  return [headers.join(','), ...report.entries.map((entry) => [entry.entityId, entry.canonicalName, entry.categorySlug, entry.rank, entry.mediaStatus, entry.reviewStatus, entry.rightsStatus, entry.isPublishable, entry.priority, entry.reason].map(csvCell).join(','))].join('\n') + '\n';
}

export function renderPlayableMediaAuditMarkdown(report: PlayableMediaAuditReport): string {
  const priority = report.entries.filter((entry) => entry.priority);
  const lines = [
    '# Auditoría de medios del pool jugable',
    '',
    'Artefacto de auditoría: no modifica PostgreSQL, no aprueba imágenes y no publica datos.',
    '',
    `- Huella de datos: ${report.sha256}`,
    `- Watermark de snapshots: ${report.watermark ?? 'no disponible'}`,
    `- Apariciones totales en rankings: ${report.appearancesTotal}`,
    `- Entidades canónicas únicas: ${report.canonicalEntitiesTotal}`,
    `- Apariciones con imagen licenciada: ${report.licensedAppearances}`,
    `- Apariciones con fallback: ${report.fallbackAppearances}`,
    `- Apariciones sin representación visual: ${report.unavailableAppearances}`,
    `- Entidades con alguna imagen licenciada: ${report.entitiesWithLicensedImage}`,
    `- Entidades representadas solo mediante fallback: ${report.entitiesWithFallback}`,
    `- Entidades sin representación visual: ${report.entitiesWithoutRepresentation}`,
    `- Prioridades del Mundial sin retrato aprobado: ${report.priorityMissingApprovedPortraits}`,
    report.priorityMissingApprovedPortraits > 0 ? `- Precaución: las ${report.priorityMissingApprovedPortraits} prioridades del Mundial siguen sin retrato aprobado y se muestran mediante fallback; esto no es una resolución visual ni una aprobación editorial.` : '- Las prioridades del Mundial tienen retrato aprobado.',
    '',
    '## Prioridad: Mundial',
    '',
    '| Rank | Entidad canónica | Estado media | Revisión | Derechos | Publicable | Motivo |',
    '| ---: | --- | --- | --- | --- | --- | --- |'
  ];
  if (!priority.length) lines.push('| — | — | — | — | — | — | No hay incidencias prioritarias |');
  for (const entry of priority) lines.push(`| ${entry.rank} | ${entry.canonicalName} | ${entry.mediaStatus} | ${entry.reviewStatus} | ${entry.rightsStatus} | ${entry.isPublishable ? 'sí' : 'no'} | ${entry.reason} |`);
  lines.push('', '## Pool completo', '', 'La lista CSV conserva una fila por aparición auditada del pool y no altera ninguna entidad ni activo.', '');
  return lines.join('\n');
}
