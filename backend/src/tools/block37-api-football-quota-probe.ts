import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performQuotaProbe } from '../quotaProbe.js';

const outputRoot = resolve(process.env.BLOCK37_OUTPUT_ROOT?.trim() || 'audits/block37');
const outputFile = resolve(outputRoot, 'QUOTA_PROBE_REPORT.json');
const writeJson = async (value: unknown) => { await mkdir(dirname(outputFile), { recursive: true }); await writeFile(outputFile, JSON.stringify(value, null, 2), 'utf8'); };

const report = await performQuotaProbe({
  apiKey: process.env.API_FOOTBALL_KEY?.trim() ?? '',
  baseUrl: process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io',
  cooldownSeconds: Number(process.env.BLOCK37_QUOTA_PROBE_COOLDOWN_SECONDS ?? 3600),
  lastProbeAt: process.env.BLOCK37_LAST_PROBE_AT?.trim() || null
});
await writeJson(report);
console.log(JSON.stringify({ status: report.status, requestsPerformed: report.requestsPerformed, quotaObserved: report.quotaObserved, factsInserted: 0, snapshotsCreated: 0, secretPrinted: false }));
