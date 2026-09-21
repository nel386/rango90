import { createHash } from 'node:crypto';

export type QuotaState = 'quota_confirmed_zero' | 'quota_unknown' | 'quota_stale' | 'quota_available' | 'quota_insufficient';

export type QuotaProbeResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type QuotaProbeFetcher = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<QuotaProbeResponse>;

export type QuotaProbeReport = {
  artifactKind: 'block37_api_football_quota_probe';
  status: QuotaState;
  requestsPerformed: number;
  quotaObserved: number | null;
  httpStatus: number | null;
  responseSha256: string | null;
  observedAt: string;
  probeEndpoint: '/status';
  factsInserted: 0;
  snapshotsCreated: 0;
  postgresqlTouched: false;
  rawPayloadsStored: false;
  secretPrinted: false;
  reason: string;
  cooldownSeconds: number;
};

export type BatchAuthorization = {
  allowed: boolean;
  status: QuotaState | 'quota_probe_required' | 'run_batches_not_requested';
  reason: string;
};

function nonNegativeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function quotaFromHeaders(headers: { get(name: string): string | null }): number | null {
  return nonNegativeInteger(headers.get('x-ratelimit-requests-remaining'));
}

export function quotaFromStatusBody(value: unknown): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const response = record.response && typeof record.response === 'object' && !Array.isArray(record.response) ? record.response as Record<string, unknown> : null;
  const requests = response?.requests && typeof response.requests === 'object' && !Array.isArray(response.requests) ? response.requests as Record<string, unknown> : null;
  const current = nonNegativeInteger(requests?.current);
  const dailyLimit = nonNegativeInteger(requests?.limit_day);
  if (current !== null && dailyLimit !== null) return Math.max(0, dailyLimit - current);
  return nonNegativeInteger(response?.remaining) ?? nonNegativeInteger(record.remaining);
}

export function classifyCachedQuota(input: { knownQuota: number | null | undefined; observedAt: string | null | undefined; now?: Date; staleAfterSeconds?: number }): QuotaState {
  const knownQuota = nonNegativeInteger(input.knownQuota);
  if (knownQuota === null) return 'quota_unknown';
  const observedAt = input.observedAt ? Date.parse(input.observedAt) : Number.NaN;
  const now = (input.now ?? new Date()).getTime();
  const staleAfterSeconds = Math.max(0, Math.floor(input.staleAfterSeconds ?? 86400));
  if (!Number.isFinite(observedAt) || now - observedAt > staleAfterSeconds * 1000) return 'quota_stale';
  return knownQuota === 0 ? 'quota_confirmed_zero' : 'quota_available';
}

export function canRunQuotaProbe(input: { now?: Date; lastProbeAt?: string | null; cooldownSeconds?: number }): { allowed: boolean; reason: string } {
  const lastProbeAt = input.lastProbeAt ? Date.parse(input.lastProbeAt) : Number.NaN;
  if (!Number.isFinite(lastProbeAt)) return { allowed: true, reason: 'No existe un probe reciente dentro del estado proporcionado.' };
  const cooldownSeconds = Math.max(0, Math.floor(input.cooldownSeconds ?? 3600));
  const elapsed = (input.now ?? new Date()).getTime() - lastProbeAt;
  if (elapsed < cooldownSeconds * 1000) return { allowed: false, reason: `Cooldown activo; faltan ${Math.ceil((cooldownSeconds * 1000 - elapsed) / 1000)} segundos.` };
  return { allowed: true, reason: 'Cooldown satisfecho.' };
}

export function classifyProbeResponse(input: { httpStatus: number; responseOk: boolean; quotaObserved: number | null }): QuotaState {
  if (input.httpStatus === 429 || input.quotaObserved === 0) return 'quota_confirmed_zero';
  if (input.responseOk && input.quotaObserved !== null && input.quotaObserved > 0) return 'quota_available';
  return 'quota_unknown';
}

export function authorizeBatches(input: {
  runBatches: boolean;
  probeRequested?: boolean;
  probeStatus: string | null | undefined;
  probeQuotaRemaining: number | null | undefined;
  probeObservedAt: string | null | undefined;
  now?: Date;
  staleAfterSeconds?: number;
}): BatchAuthorization {
  if (!input.runBatches) return { allowed: false, status: 'run_batches_not_requested', reason: 'run_batches no fue solicitado explícitamente.' };
  if (input.probeRequested) return { allowed: false, status: 'quota_probe_required', reason: 'quota_probe es una ejecución aislada y no puede iniciar tandas en la misma ejecución.' };
  if (input.probeStatus !== 'quota_available') return { allowed: false, status: (input.probeStatus as QuotaState) || 'quota_probe_required', reason: 'Se requiere un quota_probe válido con estado quota_available antes de ejecutar tandas.' };
  const cachedState = classifyCachedQuota({ knownQuota: input.probeQuotaRemaining, observedAt: input.probeObservedAt, now: input.now, staleAfterSeconds: input.staleAfterSeconds });
  if (cachedState !== 'quota_available') return { allowed: false, status: cachedState, reason: 'La observación de cuota no es positiva y reciente.' };
  return { allowed: true, status: 'quota_available', reason: 'Probe válido, reciente y con cuota positiva; el presupuesto de cada tanda se comprobará por separado.' };
}

export async function performQuotaProbe(input: {
  apiKey: string;
  baseUrl: string;
  fetcher?: QuotaProbeFetcher;
  now?: Date;
  cooldownSeconds?: number;
  lastProbeAt?: string | null;
}): Promise<QuotaProbeReport> {
  const observedAt = (input.now ?? new Date()).toISOString();
  const cooldownSeconds = Math.max(0, Math.floor(input.cooldownSeconds ?? 3600));
  const blocked = canRunQuotaProbe({ now: input.now, lastProbeAt: input.lastProbeAt, cooldownSeconds });
  const base = input.baseUrl.replace(/\/$/u, '');
  if (!blocked.allowed) {
    return { artifactKind: 'block37_api_football_quota_probe', status: 'quota_stale', requestsPerformed: 0, quotaObserved: null, httpStatus: null, responseSha256: null, observedAt, probeEndpoint: '/status', factsInserted: 0, snapshotsCreated: 0, postgresqlTouched: false, rawPayloadsStored: false, secretPrinted: false, reason: blocked.reason, cooldownSeconds };
  }
  if (!input.apiKey) {
    return { artifactKind: 'block37_api_football_quota_probe', status: 'quota_unknown', requestsPerformed: 0, quotaObserved: null, httpStatus: null, responseSha256: null, observedAt, probeEndpoint: '/status', factsInserted: 0, snapshotsCreated: 0, postgresqlTouched: false, rawPayloadsStored: false, secretPrinted: false, reason: 'API_FOOTBALL_KEY ausente; no se realizó el probe.', cooldownSeconds };
  }
  try {
    const fetcher = input.fetcher ?? (fetch as unknown as QuotaProbeFetcher);
    const response = await fetcher(`${base}/status`, { headers: { 'x-apisports-key': input.apiKey, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    const raw = await response.text();
    let body: unknown = null;
    try { body = JSON.parse(raw); } catch { body = null; }
    const observed = quotaFromHeaders(response.headers) ?? quotaFromStatusBody(body);
    const status = classifyProbeResponse({ httpStatus: response.status, responseOk: response.ok, quotaObserved: observed });
    return { artifactKind: 'block37_api_football_quota_probe', status, requestsPerformed: 1, quotaObserved: observed, httpStatus: response.status, responseSha256: sha256(raw), observedAt, probeEndpoint: '/status', factsInserted: 0, snapshotsCreated: 0, postgresqlTouched: false, rawPayloadsStored: false, secretPrinted: false, reason: status === 'quota_available' ? 'Probe mínimo correcto; se observó cuota positiva.' : status === 'quota_confirmed_zero' ? 'API-Football confirmó cuota agotada o respondió HTTP 429.' : 'La respuesta no permitió confirmar una cuota positiva.', cooldownSeconds };
  } catch (error) {
    return { artifactKind: 'block37_api_football_quota_probe', status: 'quota_unknown', requestsPerformed: 1, quotaObserved: null, httpStatus: null, responseSha256: null, observedAt, probeEndpoint: '/status', factsInserted: 0, snapshotsCreated: 0, postgresqlTouched: false, rawPayloadsStored: false, secretPrinted: false, reason: error instanceof Error ? `Error de red o timeout: ${error.message.slice(0, 200)}` : 'Error de red o timeout.', cooldownSeconds };
  }
}
