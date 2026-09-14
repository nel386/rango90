import assert from 'node:assert/strict';
import test from 'node:test';
import {
  API_FOOTBALL_REFRESH_COMPETITIONS,
  apiFootballRefreshCompetitions,
  apiFootballRefreshPlan,
  apiFootballRefreshSeason
} from '../apiFootballRefreshPolicy.js';

const referenceDate = new Date('2026-09-14T12:00:00.000Z');

test('API-Football separa ligas activas diarias de torneos semanales', () => {
  const daily = apiFootballRefreshCompetitions('daily');
  const weekly = apiFootballRefreshCompetitions('weekly');
  assert.equal(daily.length, 6);
  assert.equal(weekly.length, 2);
  assert.deepEqual(daily.map((item) => item.id), [
    'premier-league', 'la-liga', 'bundesliga', 'serie-a', 'ligue-1', 'primeira-liga'
  ]);
  assert.deepEqual(weekly.map((item) => item.id), [
    'european-cup-champions-league', 'world-cup'
  ]);
  assert.equal(new Set(API_FOOTBALL_REFRESH_COMPETITIONS.map((item) => item.id)).size, API_FOOTBALL_REFRESH_COMPETITIONS.length);
});

test('la temporada diaria es la activa y la semanal la última cerrada', () => {
  assert.equal(apiFootballRefreshSeason('daily', referenceDate), 2026);
  assert.equal(apiFootballRefreshSeason('weekly', referenceDate), 2025);
});

test('el plan conserva las barreras de derechos y publicación', () => {
  const plan = apiFootballRefreshPlan('daily', referenceDate);
  assert.equal(plan.provider, 'api-football');
  assert.equal(plan.safeguards.skipMedia, true);
  assert.equal(plan.safeguards.sourceRights, 'review_required');
  assert.equal(plan.safeguards.autoApprove, false);
  assert.equal(plan.safeguards.autoPublish, false);
  assert.equal(plan.safeguards.globalCareerGoalsNeedsSeniorNationalTeamFeed, true);
});
