import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SELECTED_DAILY_CATEGORY_COUNTS,
  SELECTED_DAILY_CATEGORY_SLUGS
} from '../dailyMatrix.js';
import { categories } from '../catalog.js';

test('la matriz diaria oficial conserva exactamente las cinco categorías de jugadores y dos de equipos', () => {
  assert.deepEqual([...SELECTED_DAILY_CATEGORY_SLUGS], [
    'club-career-yellow-cards',
    'club-career-red-cards',
    'club-career-titles',
    'world-cup-goals',
    'player-career-goals',
    'national-league-club-titles',
    'european-cup-champions-league-club-titles'
  ]);
  assert.deepEqual(SELECTED_DAILY_CATEGORY_COUNTS, { player: 5, club: 2, national_team: 0 });

  const selected = SELECTED_DAILY_CATEGORY_SLUGS.map((slug) => categories.find((category) => category.slug === slug));
  assert.ok(selected.every(Boolean));
  assert.deepEqual(selected.slice(0, 5).map((category) => category?.entityType), ['player', 'player', 'player', 'player', 'player']);
  assert.deepEqual(selected.slice(5).map((category) => category?.entityType), ['club', 'club']);
});
