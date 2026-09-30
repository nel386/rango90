import assert from 'node:assert/strict';
import { eligibleYellowCardPlayerIds } from '../clubYellowCardsCareerRankingEngine.js';
import { factFromStats } from '../tools/block45-yellow-card-fact.js';

const makeFact = (cards: Record<string, unknown>, season: number) => factFromStats(
  { id: 77, name: 'Fixture Player' },
  { team: { id: 10, name: 'Fixture FC' }, league: { id: 39, name: 'Premier League', type: 'League', country: 'England' }, games: { appearences: 20, minutes: 1800 }, cards },
  season, 'https://v3.football.api-sports.io/players?id=77&season=2025', 1, `hash-${season}`, 39
);

const separated = makeFact({ yellow: 4, red: 1, yellowred: 2 }, 2025);
assert.ok(separated);
assert.equal(separated.yellowCards, 4);
assert.equal(separated.redCards, 1);
assert.equal(separated.yellowRedCards, 2);
assert.match(separated.locator, /cards\.\{yellow,red,yellowred\}/u);

const redOnly = makeFact({ yellow: null, red: 1, yellowred: 2 }, 2024);
assert.ok(redOnly, 'a usable red-card row must survive even when yellow is unknown');
assert.equal(redOnly.yellowCards, null);
assert.equal(redOnly.redCards, 1);
assert.equal(redOnly.yellowRedCards, 2);
assert.deepEqual(eligibleYellowCardPlayerIds([
  { ...redOnly, seasonStart: 2024 },
  { ...redOnly, id: 'another-season', seasonStart: 2025 }
], [2024, 2025]), new Set(), 'unknown yellow counts must not create eligibility');

assert.equal(makeFact({ yellow: null, red: null, yellowred: null }, 2025), null, 'a row with no recorded card category is not a card fact');
console.log('BLOQUE 45 yellow/red/second-yellow extraction tests passed');
