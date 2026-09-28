import assert from 'node:assert/strict';
import { validateBlock45StatusPreflight } from '../tools/block45-status-preflight.js';

const response = { requests: { current: 346, limit_day: 7500 } };
const result = (overrides: Partial<Parameters<typeof validateBlock45StatusPreflight>[0]> = {}) => validateBlock45StatusPreflight({ httpStatus: 200, errors: [], results: undefined, response, ...overrides });

assert.deepEqual(result(), { valid: true, reason: 'passed', resultsValue: null, dailyRemaining: 7154, dailyLimit: 7500 });
assert.equal(result({ results: 1 }).valid, true, 'a one-item status envelope is valid');
assert.equal(result({ results: 0 }).reason, 'malformed_results', 'zero results must not mask the status object');
assert.equal(result({ results: '1' }).reason, 'malformed_results', 'non-numeric result values are rejected');
assert.equal(result({ errors: { unauthorized: true } }).reason, 'provider_errors');
assert.equal(result({ httpStatus: 429 }).reason, 'http_status_not_200');
assert.equal(result({ response: {} }).reason, 'status_response_missing');
assert.equal(result({ response: { requests: {} } }).reason, 'daily_quota_missing');
assert.equal(result({ response: { requests: { current: 7501, limit_day: 7500 } } }).reason, 'daily_quota_missing');

console.log('BLOCK45 status preflight validation tests passed');
