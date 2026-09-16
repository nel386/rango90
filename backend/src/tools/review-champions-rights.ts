import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildChampionsRightsReview, renderChampionsRightsReviewMarkdown, sha256, stableJson } from '../championsRightsReview.js';

const root = resolve(process.cwd());
const inputPath = resolve(root, 'audits/block7b/champions-approval-dossier.json');
const outputRoot = resolve(root, 'audits/block7c');
const content = await readFile(inputPath, 'utf8');
const input = JSON.parse(content);
const inputSha256 = createHash('sha256').update(content).digest('hex');
const report = buildChampionsRightsReview({ audit: input, auditSha256: inputSha256 });
const json = stableJson(report);
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, 'champions-source-scope-rights-review.json'), json, 'utf8');
await writeFile(resolve(outputRoot, 'champions-source-scope-rights-review.md'), renderChampionsRightsReviewMarkdown(report), 'utf8');
console.log(JSON.stringify({ runId: report.runId, categorySlug: report.categorySlug, sourceRights: report.currentDraftSource.rightsStatus, conflicts: report.conflictAssessment.total, unresolvedConflicts: report.conflictAssessment.unresolvedCases.length + 1, isolatedValidation: report.isolatedValidation.status, readyForApproval: report.readyForApproval, reportSha256: sha256(json), outputRoot }, null, 2));
