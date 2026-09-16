import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildChampionsCandidateAudit, renderChampionsCandidateMarkdown, sha256, stableJson } from '../championsCandidateAudit.js';

const root = resolve(process.cwd());
const auditRoot = resolve(root, 'audits');
const outputRoot = resolve(auditRoot, 'block7a');
const paths = [
  'ranking-truth/ranking-truth.json',
  'ranking-scope/ranking-scope-decisions.json',
  'ranking-validation/ranking-validation-discrepancies.json',
  'media/playable-media-audit.json'
];

async function readArtifact(relativePath: string) {
  const filePath = resolve(auditRoot, relativePath);
  const content = await readFile(filePath, 'utf8');
  return { path: `audits/${relativePath}`, sha256: createHash('sha256').update(content).digest('hex'), value: JSON.parse(content) };
}

const artifacts = await Promise.all(paths.map(readArtifact));
const byPath = new Map(artifacts.map((artifact) => [artifact.path, artifact.value]));
const report = buildChampionsCandidateAudit({
  truth: byPath.get('audits/ranking-truth/ranking-truth.json'),
  scope: byPath.get('audits/ranking-scope/ranking-scope-decisions.json'),
  validation: byPath.get('audits/ranking-validation/ranking-validation-discrepancies.json'),
  media: byPath.get('audits/media/playable-media-audit.json'),
  sourceArtifacts: artifacts.map(({ path, sha256: contentSha256 }) => ({ path, sha256: contentSha256 }))
});
const json = stableJson(report);
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, 'champions-conflict-audit.json'), json, 'utf8');
await writeFile(resolve(outputRoot, 'champions-conflict-audit.md'), renderChampionsCandidateMarkdown(report), 'utf8');
console.log(JSON.stringify({
  artifactKind: report.artifactKind,
  categorySlug: report.categorySlug,
  readOnly: report.readOnly,
  productionData: report.productionData,
  mutationCount: report.mutationCount,
  runId: report.runId,
  conflicts: report.conflicts.length,
  pendingDiscrepancies: report.pendingDiscrepancies.length,
  rollback: report.rollback.status,
  readyForApproval: report.readyForApproval,
  dataFingerprint: report.dataFingerprint.sha256,
  reportSha256: sha256(json),
  outputRoot
}, null, 2));
