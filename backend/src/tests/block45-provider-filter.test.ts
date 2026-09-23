import assert from 'node:assert/strict';
import { classifyClubCompetition, isOfficialClubCompetition } from '../tools/block45-provider-scope.js';

const statistic = (league: Record<string, unknown>, team: Record<string, unknown> = { id: 10, name: 'Club FC' }) => ({ league, team });

assert.equal(isOfficialClubCompetition(statistic({ id: 2, name: 'UEFA Champions League', type: 'Cup', country: 'World' })), true);
assert.equal(isOfficialClubCompetition(statistic({ id: 1, name: 'World Cup', type: 'Cup', country: 'World' })), false);
assert.equal(isOfficialClubCompetition(statistic({ id: 999, name: 'Friendlies', type: 'Friendly', country: 'World' })), false);
assert.equal(isOfficialClubCompetition(statistic({ id: 998, name: 'Premier League 2', type: 'League', country: 'England' })), false);
assert.equal(isOfficialClubCompetition(statistic({ id: 39, name: 'Premier League', type: 'League', country: 'England' })), true);
assert.equal(isOfficialClubCompetition(statistic({ id: 1, name: 'World Cup', type: 'Cup', country: 'World' }, { id: 999, name: 'National Team', national: true })), false);
assert.deepEqual(classifyClubCompetition(statistic({ id: 2, name: 'UEFA Champions League', type: 'Cup', country: 'World' })), { decision: 'accepted', reason: 'official_international_club_competition' });
assert.deepEqual(classifyClubCompetition(statistic({ id: 1, name: 'World Cup', type: 'Cup', country: 'World' })), { decision: 'excluded', reason: 'national_competition' });

console.log('BLOQUE 45 provider competition filter fixtures passed');
