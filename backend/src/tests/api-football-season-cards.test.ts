import assert from 'node:assert/strict';
import { mergeApiFootballSeasonRows, type ApiFootballPayload } from '../providers/apiFootballSeasonClient.js';

const first: ApiFootballPayload = {
  response: [{
    player: { id: 7, name: 'Jugador' },
    statistics: [{
      team: { id: 10, name: 'Club' },
      league: { id: 39, name: 'Premier League', season: 2024 },
      cards: { yellow: null, red: null }
    }]
  }],
  paging: { current: 1, total: 1 }
};

const unknownResult = mergeApiFootballSeasonRows({ playersPage1: first }, 2024, 39);
assert.equal(unknownResult.rows[0]?.statistic.cards?.yellow, null);
assert.equal(unknownResult.rows[0]?.statistic.cards?.red, null);

const known: ApiFootballPayload = {
  response: [{
    player: { id: 7, name: 'Jugador' },
    statistics: [{
      team: { id: 10, name: 'Club' },
      league: { id: 39, name: 'Premier League', season: 2024 },
      cards: { yellow: 3, red: 1 }
    }]
  }],
  paging: { current: 1, total: 1 }
};
const knownResult = mergeApiFootballSeasonRows({ playersPage1: known, playersPage2: first }, 2024, 39);
assert.equal(knownResult.rows[0]?.statistic.cards?.yellow, 3);
assert.equal(knownResult.rows[0]?.statistic.cards?.red, 1);

const conflicting: ApiFootballPayload = {
  ...first,
  response: [{ ...first.response![0]!, statistics: [{ ...first.response![0]!.statistics![0]!, cards: { yellow: 4, red: 1 } }] }]
};
assert.throws(
  () => mergeApiFootballSeasonRows({ playersPage1: known, playersPage2: conflicting }, 2024, 39),
  /yellow cards incompatibles/
);

console.log('api-football season card null semantics tests passed');
