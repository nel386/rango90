import assert from 'node:assert/strict';
import { SlidingWindowRateLimiter } from '../rateLimit.js';

let now = 1_000;
const limiter = new SlidingWindowRateLimiter(() => now);
const policy = { windowMs: 1_000, max: 2, key: 'test' };

assert.equal(limiter.check('a', policy).allowed, true);
assert.equal(limiter.check('a', policy).allowed, true);
const blocked = limiter.check('a', policy);
assert.equal(blocked.allowed, false);
assert.equal(blocked.retryAfterSeconds, 1);
now += 1_000;
assert.equal(limiter.check('a', policy).allowed, true);
console.log('rate limit tests passed');
