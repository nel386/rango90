import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderOfficialPublicationCandidateMarkdown, buildOfficialPublicationCandidateReport, sha256, stableJson } from '../officialPublicationCandidate.js';

const root = resolve(process.cwd());
const auditRoot = resolve(root, 'audits');
const outputRoot = resolve(auditRoot, 'block7');
const artifactPaths = [
  'ranking-truth/ranking-truth.json',
  'ranking-scope/ranking-scope-decisions.json',
  'ranking-validation/ranking-validation-discrepancies.json',
  'media/playable-media-audit.json'
];

async function readArtifact(relativePath: string): Promise<{ path: string; sha256: string; value: unknown }> {
  const path = resolve(auditRoot, relativePath);
  const content = await readFile(path, 'utf8');
  return { path: `audits/${relativePath}`, sha256: createHash('sha256').update(content).digest('hex'), value: JSON.parse(content) };
}

const artifacts = await Promise.all(artifactPaths.map(readArtifact));
const byPath = new Map(artifacts.map((artifact) => [artifact.path, artifact.value]));
const report = buildOfficialPublicationCandidateReport({
  truth: byPath.get('audits/ranking-truth/ranking-truth.json') as Parameters<typeof buildOfficialPublicationCandidateReport>[0]['truth'],
  scope: byPath.get('audits/ranking-scope/ranking-scope-decisions.json') as Parameters<typeof buildOfficialPublicationCandidateReport>[0]['scope'],
  validation: byPath.get('audits/ranking-validation/ranking-validation-discrepancies.json') as Parameters<typeof buildOfficialPublicationCandidateReport>[0]['validation'],
  media: byPath.get('audits/media/playable-media-audit.json') as Parameters<typeof buildOfficialPublicationCandidateReport>[0]['media'],
  sourceArtifacts: artifacts.map(({ path, sha256: contentSha256 }) => ({ path, sha256: contentSha256 }))
});
const json = stableJson(report);
const markdown = renderOfficialPublicationCandidateMarkdown(report);
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, 'official-publication-candidates.json'), json, 'utf8');
await writeFile(resolve(outputRoot, 'official-publication-candidates.md'), markdown, 'utf8');
console.log(JSON.stringify({
  readOnly: report.readOnly,
  productionData: report.productionData,
  mutationCount: report.execution.mutationCount,
  runId: report.runId,
  selectedCategories: report.selectedCategories,
  readyForApproval: report.readyForApproval,
  readyForPublication: report.readyForPublication,
  blockingReasons: report.blockingReasons,
  dataFingerprint: report.dataFingerprint.sha256,
  reportSha256: sha256(json),
  outputRoot
}, null, 2));
