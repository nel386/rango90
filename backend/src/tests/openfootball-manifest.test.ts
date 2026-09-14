import assert from 'node:assert/strict';
import { competitionForPath, isCompletedSeasonLabel, seasonForPath, selectOpenFootballSeasonFiles } from '../tools/generate-openfootball-manifest.js';

const now = new Date('2026-09-14T00:00:00Z');
assert.equal(isCompletedSeasonLabel('2024-25', now), true);
assert.equal(isCompletedSeasonLabel('2025-26', now), false);
assert.equal(isCompletedSeasonLabel('2025', now), true);
assert.equal(isCompletedSeasonLabel('2026', now), false);

const europe = {
  name: 'europe',
  competitionRoot: 'europe',
  excludeCountryRoots: ['england', 'germany', 'spain', 'italy', 'france']
} as const;
assert.equal(competitionForPath(europe, 'albania/2024-25_al1.txt'), 'albania');
assert.equal(seasonForPath(europe, 'albania/2024-25_al1.txt'), '2024-25');
assert.equal(seasonForPath(europe, 'albania/2025-26_al1.txt'), null);

const selected = selectOpenFootballSeasonFiles(europe, {
  sha: 'commit-europe',
  truncated: false,
  tree: [
    { type: 'blob', path: 'albania/2024-25_al1.txt', sha: 'sha-1' },
    { type: 'blob', path: 'albania/2024-25_al2.txt', sha: 'sha-2' },
    { type: 'blob', path: 'albania/2024-25_alcup.txt', sha: 'sha-3' },
    { type: 'blob', path: 'england/2024-25_eng1.txt', sha: 'sha-4' },
    { type: 'blob', path: 'albania/2025-26_al1.txt', sha: 'sha-5' }
  ]
}, now);
assert.equal(selected.length, 1);
assert.equal(selected[0]?.url, 'https://raw.githubusercontent.com/openfootball/europe/commit-europe/albania/2024-25_al1.txt');

assert.throws(() => selectOpenFootballSeasonFiles(europe, { sha: 'commit', truncated: true, tree: [] }, now), /truncada/);

console.log('openfootball manifest tests passed');
