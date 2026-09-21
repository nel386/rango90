import assert from 'node:assert/strict';
import { authorizeBatches, canRunQuotaProbe, classifyCachedQuota, classifyProbeResponse, performQuotaProbe } from '../quotaProbe.js';

const now = new Date('2026-09-21T12:00:00.000Z');
assert.equal(classifyCachedQuota({ knownQuota: 0, observedAt: '2026-09-21T11:59:00.000Z', now, staleAfterSeconds: 3600 }), 'quota_confirmed_zero');
assert.equal(classifyCachedQuota({ knownQuota: 0, observedAt: '2026-09-20T12:00:00.000Z', now, staleAfterSeconds: 3600 }), 'quota_stale');
assert.equal(classifyCachedQuota({ knownQuota: null, observedAt: null, now }), 'quota_unknown');
assert.equal(classifyProbeResponse({ httpStatus: 200, responseOk: true, quotaObserved: 4 }), 'quota_available');
assert.equal(classifyProbeResponse({ httpStatus: 200, responseOk: true, quotaObserved: 0 }), 'quota_confirmed_zero');
assert.equal(classifyProbeResponse({ httpStatus: 429, responseOk: false, quotaObserved: null }), 'quota_confirmed_zero');
assert.equal(classifyProbeResponse({ httpStatus: 503, responseOk: false, quotaObserved: null }), 'quota_unknown');
assert.equal(canRunQuotaProbe({ now, lastProbeAt: '2026-09-21T11:59:00.000Z', cooldownSeconds: 3600 }).allowed, false);
assert.equal(authorizeBatches({ runBatches: true, probeStatus: 'quota_probe_required', probeQuotaRemaining: 4, probeObservedAt: now.toISOString(), now }).allowed, false);
assert.equal(authorizeBatches({ runBatches: true, probeRequested: true, probeStatus: 'quota_available', probeQuotaRemaining: 4, probeObservedAt: now.toISOString(), now }).allowed, false);
assert.equal(authorizeBatches({ runBatches: true, probeStatus: 'quota_available', probeQuotaRemaining: 4, probeObservedAt: now.toISOString(), now }).allowed, true);

let calls = 0;
const available = await performQuotaProbe({
  apiKey: 'test-secret', baseUrl: 'https://example.test', now,
  fetcher: async () => { calls += 1; return { ok: true, status: 200, headers: { get: (name: string) => name === 'x-ratelimit-requests-remaining' ? '7' : null }, text: async () => '{"response":{"requests":{"current":1,"limit_day":8}}}' }; }
});
assert.equal(calls, 1);
assert.equal(available.status, 'quota_available');
assert.equal(available.quotaObserved, 7);
assert.equal(available.factsInserted, 0);
assert.equal(available.snapshotsCreated, 0);
assert.equal(available.postgresqlTouched, false);

const timeout = await performQuotaProbe({ apiKey: 'test-secret', baseUrl: 'https://example.test', now, fetcher: async () => { throw new Error('timeout'); } });
assert.equal(timeout.status, 'quota_unknown');
assert.equal(timeout.requestsPerformed, 1);
assert.match(timeout.reason, /timeout/);
console.log('block37-quota-probe: states, cooldown, one-request probe and batch gate: ok');
