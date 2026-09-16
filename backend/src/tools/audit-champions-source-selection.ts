import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildChampionsSourceSelection, renderChampionsSourceSelectionMarkdown, sha256, stableJson } from '../championsSourceSelection.js';

const root = resolve(process.cwd());
const outputRoot = resolve(root, 'audits/block7d');
const rightsPath = resolve(root, 'audits/block7c/champions-source-scope-rights-review.json');
const probePath = resolve(outputRoot, 'api-football-champions-probe.json');
const licensePath = resolve(root, '../DATA_PROVIDER_LICENSE_REVIEW.md');
const rightsContent = await readFile(rightsPath, 'utf8');
const probeContent = await readFile(probePath, 'utf8');
const licenseContent = await readFile(licensePath, 'utf8');
const rights = JSON.parse(rightsContent);
const probe = JSON.parse(probeContent);
const report = buildChampionsSourceSelection({
  rightsReview: rights,
  rightsReviewSha256: createHash('sha256').update(rightsContent).digest('hex'),
  probe,
  probeSha256: createHash('sha256').update(probeContent).digest('hex'),
  providerBaseUrl: process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io',
  licenseReviewSha256: createHash('sha256').update(licenseContent).digest('hex')
});
const json = stableJson(report);
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, 'champions-source-selection.json'), json, 'utf8');
await writeFile(resolve(outputRoot, 'source-comparison-matrix.json'), stableJson({ artifactKind: 'champions_source_comparison_matrix', reportRunId: report.runId, readOnly: true, productionData: false, mutationCount: 0, sources: report.sourceMatrix }), 'utf8');
await writeFile(resolve(outputRoot, 'champions-source-selection.md'), renderChampionsSourceSelectionMarkdown(report, probe), 'utf8');
console.log(JSON.stringify({ runId: report.runId, provider: report.contractedProvider.configuredProvider, probeStatus: report.apiProbe.status, coverage: report.coverage.apiFootball, readyForApproval: report.readyForApproval, reportSha256: sha256(json), outputRoot }, null, 2));
