import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { CLUB_CARD_COMPETITIONS, planClubCardBatches, type ClubCardBatchStatus } from '../clubCardsBatchPlanner.js';
import { authorizeBatches } from '../quotaProbe.js';

type JsonRecord = Record<string, unknown>;
const outputRoot = resolve(process.env.BLOCK32_OUTPUT_ROOT?.trim() || 'audits/block32');
const runBatches = process.env.BLOCK37_RUN_BATCHES === 'true';
const probeStatus = process.env.BLOCK37_PROBE_STATUS?.trim() || null;
const probeQuotaRemaining = Number.isFinite(Number(process.env.BLOCK37_PROBE_QUOTA_REMAINING)) ? Number(process.env.BLOCK37_PROBE_QUOTA_REMAINING) : null;
const probeObservedAt = process.env.BLOCK37_PROBE_OBSERVED_AT?.trim() || null;
const authorization = authorizeBatches({ runBatches, probeRequested: process.env.BLOCK37_QUOTA_PROBE === 'true', probeStatus, probeQuotaRemaining, probeObservedAt, staleAfterSeconds: Number(process.env.BLOCK37_QUOTA_STALE_AFTER_SECONDS ?? 86400) });
const knownQuota = authorization.allowed ? Math.max(0, Number(process.env.BLOCK32_KNOWN_QUOTA_REMAINING ?? probeQuotaRemaining ?? 0) || 0) : 0;
const quotaReserve = Math.max(0, Number(process.env.BLOCK32_QUOTA_RESERVE ?? 0) || 0);
const maxRequests = Math.max(0, Number(process.env.BLOCK32_MAX_REQUESTS ?? 0) || 0);
const selectedCompetition = process.env.BLOCK32_COMPETITION?.trim() || 'all';
const planFile = process.env.BLOCK32_BATCH_PLAN_FILE?.trim() ?? '';

const writeJson = async (file: string, value: unknown) => { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(value, null, 2), 'utf8'); };

async function readPlan(): Promise<Array<{ key: string; providerId: number; name: string; estimatedRequests: number; retryBudget?: number; alreadyUpdated?: boolean }>> {
  if (!planFile) return CLUB_CARD_COMPETITIONS.filter((competition) => selectedCompetition === 'all' || competition.key === selectedCompetition).map((competition, index) => ({ ...competition, estimatedRequests: 8, alreadyUpdated: selectedCompetition === 'all' && index < 3 }));
  const input = JSON.parse(await readFile(planFile, 'utf8')) as JsonRecord;
  return Array.isArray(input.batches) ? input.batches.map((row) => ({ key: String((row as JsonRecord).key), providerId: Number((row as JsonRecord).providerId), name: String((row as JsonRecord).name), estimatedRequests: Number((row as JsonRecord).estimatedRequests), retryBudget: Number((row as JsonRecord).retryBudget ?? 0), alreadyUpdated: (row as JsonRecord).alreadyUpdated === true })) : [];
}

async function main(): Promise<void> {
  const candidates = await readPlan();
  const plan = planClubCardBatches({ quotaInitial: knownQuota, quotaReserve, maxRequests, batches: candidates });
  const statuses = plan.batches.reduce<Record<string, number>>((result, batch) => { result[batch.status] = (result[batch.status] ?? 0) + 1; return result; }, {});
  const report = {
    artifactKind: 'block32_club_cards_quota_safe_batches', reportVersion: '1', generatedAt: new Date().toISOString(),
    status: !authorization.allowed ? authorization.status : knownQuota === 0 ? 'quota_insufficient' : plan.batches.some((batch) => batch.status === 'quota_insufficient') ? 'partial_scope' : 'planned',
    quotaState: authorization.status,
    batchAuthorization: authorization,
    quotaInitial: plan.quotaInitial, quotaReserve: plan.quotaReserve, maxRequests: plan.maxRequests,
    requestsEstimated: plan.estimatedRequests, requestsReserved: plan.reservedRequests, requestsPerformed: 0,
    requestsSkipped: plan.skippedRequests, externalRequestsMade: false,
    batches: plan.batches.map((batch) => ({ ...batch, status: batch.status as ClubCardBatchStatus })),
    statusCounts: statuses,
    completeCompetitions: plan.batches.filter((batch) => batch.status === 'complete' || batch.status === 'skipped').map((batch) => batch.key),
    pendingCompetitions: plan.batches.filter((batch) => batch.status === 'quota_insufficient' || batch.status === 'planned').map((batch) => batch.key),
    preservedSnapshots: plan.batches.filter((batch) => batch.snapshotAction === 'preserve').map((batch) => batch.key),
    errors429: 0, idempotency: 'not_run_external', rollback: 'fixture_verified_in_tests',
    official: { status: 'blocked', snapshotCreated: false }, rawPayloadsStored: false, secretPrinted: false,
    note: !authorization.allowed ? `${authorization.reason} No se hicieron peticiones y se conserva el último snapshot candidato válido.` : knownQuota === 0 ? 'No se hicieron peticiones: la cuota conocida es 0. Se conserva el último snapshot candidato válido.' : 'Plan preparado con probe válido; la tanda real permanece limitada al presupuesto reservado.'
  };
  await writeJson(resolve(outputRoot, 'BLOCK32_REPORT.json'), report);
  await writeJson(resolve(outputRoot, 'BLOCK32_BATCH_PLAN.json'), plan);
  console.log(JSON.stringify({ status: report.status, requestsPerformed: 0, preservedSnapshots: report.preservedSnapshots.length, official: 'blocked' }));
}

await main();
