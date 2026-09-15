import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SELECTED_DAILY_CATEGORY_COUNTS,
  SELECTED_DAILY_CATEGORY_SLUGS
} from '../dailyMatrix.js';
import { categories } from '../catalog.js';

test('la matriz diaria oficial conserva exactamente siete categorías de jugadores', () => {
  assert.deepEqual([...SELECTED_DAILY_CATEGORY_SLUGS], [
    'club-career-yellow-cards',
    'club-career-red-cards',
    'club-career-titles',
    'world-cup-goals',
    'player-career-goals',
    'uefa-champions-league-assists',
    'uefa-champions-league-goals'
  ]);
  assert.deepEqual(SELECTED_DAILY_CATEGORY_COUNTS, { player: 7, club: 0, national_team: 0 });

  const selected = SELECTED_DAILY_CATEGORY_SLUGS.map((slug) => categories.find((category) => category.slug === slug));
  assert.ok(selected.every(Boolean));
  assert.deepEqual(selected.map((category) => category?.entityType), ['player', 'player', 'player', 'player', 'player', 'player', 'player']);
});
