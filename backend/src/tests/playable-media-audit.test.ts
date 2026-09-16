import assert from 'node:assert/strict';
import { buildPlayableMediaAudit, renderPlayableMediaAuditCsv, renderPlayableMediaAuditMarkdown, type PlayableMediaAuditEntry } from '../playableMediaAudit.js';

const entries: PlayableMediaAuditEntry[] = [
  { entityId: 'world-2', canonicalName: 'Jugador Dos', categorySlug: 'world-cup-goals', rank: 2, mediaStatus: 'fallback', reviewStatus: 'missing', rightsStatus: 'missing', isPublishable: false, priority: true, reason: 'No existe retrato aprobado.' },
  { entityId: 'world-1', canonicalName: 'Jugador Uno', categorySlug: 'world-cup-goals', rank: 1, mediaStatus: 'licensed', reviewStatus: 'approved', rightsStatus: 'approved', isPublishable: true, priority: false, reason: 'Existe retrato aprobado.' }
];
const first = buildPlayableMediaAudit(entries, '2026-09-16T00:00:00.000Z');
const second = buildPlayableMediaAudit([...entries].reverse(), '2026-09-16T00:00:00.000Z');
assert.deepEqual(first, second);
assert.equal(first.appearancesTotal, 2);
assert.equal(first.canonicalEntitiesTotal, 2);
assert.equal(first.entitiesWithLicensedImage, 1);
assert.equal(first.entitiesWithFallback, 1);
assert.equal(first.entitiesWithoutRepresentation, 0);
assert.equal(first.priorityMissingApprovedPortraits, 1);
assert.match(renderPlayableMediaAuditMarkdown(first), /Jugador Dos/u);
assert.match(renderPlayableMediaAuditMarkdown(first), /sin retrato aprobado y se muestran mediante fallback/u);
assert.match(renderPlayableMediaAuditCsv(first), /rights_status,is_publishable/u);
console.log('playable-media-audit tests passed');
