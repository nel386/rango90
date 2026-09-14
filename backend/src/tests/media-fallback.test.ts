import assert from 'node:assert/strict';
import { renderMediaFallback } from '../mediaFallback.js';

const first = await renderMediaFallback('Lionel Messi', 'player-1', 'player');
const second = await renderMediaFallback('Lionel Messi', 'player-1', 'player');
const other = await renderMediaFallback('Lionel Messi', 'player-2', 'player');

assert.equal(first.subarray(0, 4).toString('ascii'), 'RIFF');
assert.equal(first.subarray(8, 12).toString('ascii'), 'WEBP');
assert.deepEqual(first, second);
assert.notDeepEqual(first, other);
assert.ok(first.length > 100);

console.log('media fallback tests passed');
