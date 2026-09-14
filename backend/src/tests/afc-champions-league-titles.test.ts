import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const input = JSON.parse(await readFile(new URL('../../storage/rankings/afc-champions-league-club-titles.json', import.meta.url), 'utf8')) as {
  categorySlug: string;
  coverageComplete: boolean;
  entries: Array<{ entityId: string; rawValue: number; evidence?: { editions?: string[] } }>;
};

assert.equal(input.categorySlug, 'afc-champions-league-club-titles');
assert.equal(input.coverageComplete, true);
assert.equal(input.entries.length, 25);
assert.equal(new Set(input.entries.map((entry) => entry.entityId)).size, 25);
assert.equal(input.entries.reduce((total, entry) => total + entry.rawValue, 0), 44);
assert.equal(input.entries.flatMap((entry) => entry.evidence?.editions ?? []).length, 44);
assert.equal(input.entries.find((entry) => entry.entityId.endsWith(':al-hilal'))?.rawValue, 4);
assert.equal(input.entries.find((entry) => entry.entityId.endsWith(':al-ahli-saudi'))?.rawValue, 2);

console.log('AFC Champions League titles tests passed');
