import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildChampionsCandidateAudit, stableJson } from '../championsCandidateAudit.js';

const root = resolve(process.cwd());
const auditRoot = resolve(root, 'audits');
const readJson = async (relativePath: string) => JSON.parse(await readFile(resolve(auditRoot, relativePath), 'utf8'));
const [truth, scope, validation, media] = await Promise.all([
  readJson('ranking-truth/ranking-truth.json'),
  readJson('ranking-scope/ranking-scope-decisions.json'),
  readJson('ranking-validation/ranking-validation-discrepancies.json'),
  readJson('media/playable-media-audit.json')
]);
const sourceArtifacts = [
  { path: 'audits/ranking-truth/ranking-truth.json', sha256: 'truth' },
  { path: 'audits/ranking-scope/ranking-scope-decisions.json', sha256: 'scope' },
  { path: 'audits/ranking-validation/ranking-validation-discrepancies.json', sha256: 'validation' },
  { path: 'audits/media/playable-media-audit.json', sha256: 'media' }
];

const first = buildChampionsCandidateAudit({ truth, scope, validation, media, sourceArtifacts });
const second = buildChampionsCandidateAudit({ truth, scope, validation, media, sourceArtifacts });
assert.equal(first.categorySlug, 'uefa-champions-league-goals');
assert.equal(first.conflicts.length, 12);
assert.equal(first.pendingDiscrepancies.length, 6);
assert.equal(first.ranking.top20.length, 20);
assert.equal(first.ranking.identities.confirmed, 20);
assert.equal(first.ranking.values.withEvidence, 20);
assert.equal(first.scope.conflictsOpen, 12);
assert.equal(first.readyForApproval, false);
assert.equal(first.readOnly, true);
assert.equal(first.productionData, false);
assert.equal(first.mutationCount, 0);
assert.equal(first.rollback.status, 'integration_pending');
assert.equal(first.conflicts.find((item) => item.player === 'Cristiano Ronaldo')?.valueDifference.officialMinusCurrent, 1);
assert.equal(first.conflicts.find((item) => item.player === 'Luis Suárez')?.positionDifference.officialMinusCurrent, -7);
assert.ok(first.conflicts.every((item) => item.proposedDecision === 'hold_open_keep_stored_value_in_draft'));
assert.equal(stableJson(first), stableJson(second));
console.log('champions candidate audit tests passed');
