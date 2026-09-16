import assert from 'node:assert/strict';
import { evaluateBlock6Release, type Block6Evidence } from '../block6ReleaseGate.js';

const run = {
  runId: 'block6-test-run',
  timestamp: '2026-09-16T00:00:00.000Z',
  runtimeMode: 'lab' as const,
  isolatedDatabase: { configured: true, distinctFromDatabaseUrl: true, databaseName: 'rango90_block6', fingerprintSha256: 'a'.repeat(64) }
};

const complete: Block6Evidence = {
  isolatedIntegration: { status: 'passed', detail: 'isolated PostgreSQL passed' },
  mobileAudit: { status: 'passed', p0: 0, p1: 0, detail: 'evidence available' },
  publicReadOnlyAudit: { status: 'passed', detail: 'read-only checks passed' },
  officialPublication: { status: 'passed', detail: 'all release checks passed' },
  artifactHashes: { report: 'a'.repeat(64) },
  run
};
const ready = evaluateBlock6Release(complete);
assert.equal(ready.readyForRelease, true);
assert.deepEqual(ready.blockingReasons, []);

const pending = evaluateBlock6Release({ ...complete, isolatedIntegration: { status: 'integration_pending', detail: 'URL missing' } });
assert.equal(pending.readyForRelease, false);
assert.deepEqual(pending.blockingReasons, ['isolated_integration:integration_pending']);

const visualBlocker = evaluateBlock6Release({ ...complete, mobileAudit: { status: 'not_run', p0: 0, p1: 0, detail: 'browser unavailable' } });
assert.equal(visualBlocker.readyForRelease, false);
assert.deepEqual(visualBlocker.blockingReasons, ['mobile_audit:not_run']);
console.log('block6 release gate tests passed');
