import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildChampionsSourcePolicy, renderChampionsSourcePolicyMarkdown, sha256, stableJson } from '../championsHistoricalSourcePolicy.js';

const root = resolve(process.cwd());
const inputPath = resolve(root, 'audits/block7e/champions-api-validation.json');
const outputRoot = resolve(root, 'audits/block8');
const inputContent = await readFile(inputPath, 'utf8');
const report = buildChampionsSourcePolicy({ apiValidation: JSON.parse(inputContent), apiValidationSha256: createHash('sha256').update(inputContent).digest('hex') });
const json = stableJson(report);
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, 'champions-historical-source-policy.json'), json, 'utf8');
await writeFile(resolve(outputRoot, 'champions-historical-source-policy.md'), renderChampionsSourcePolicyMarkdown(report), 'utf8');
console.log(JSON.stringify({ runId: report.runId, frozenSources: report.sourceFreeze.length, requirements: report.minimumRequirements.length, partialRange: report.partialRangePolicy.partialRangeExample, readyForApproval: report.readyForApproval, reportSha256: sha256(json), outputRoot }, null, 2));
