import assert from 'node:assert/strict';
import { buildFootballDataCareerCardsRankings, parseFootballDataIncidentFile } from '../providers/footballDataIncidentsClient.js';

const fixture = JSON.stringify([
  {
    league: 'testland-premier-league',
    date: '2024-08-10',
    incident: {
      incidents: [
        { team: 'home', incident_type: 'Yellow Card', player_name: 'Ramos S.' },
        { team: 'away', incident_type: 'Red Card', player_name: 'Müller T.' },
        { team: 'away', incident_type: 'Second Yellow Card', player_name: 'Ramos S.' },
        { team: 'home', incident_type: 'Goal', player_name: 'Ramos S.' }
      ]
    }
  }
]);

const parsed = parseFootballDataIncidentFile(fixture, 'https://example.test/england-2024-2025.json', 'england_premier-league-2024-2025.json');
assert.deepEqual(parsed.map((incident) => [incident.metric, incident.playerName, incident.season, incident.team]), [
  ['yellow_cards', 'Ramos S.', '2024-2025', 'home'],
  ['red_cards', 'Müller T.', '2024-2025', 'away']
]);

const rankings = buildFootballDataCareerCardsRankings(parsed, { sourceVersion: 'fixture-sha', sourceFiles: 1, now: new Date('2026-09-14T00:00:00Z') });
assert.equal(rankings.yellow_cards.categorySlug, 'club-career-yellow-cards');
assert.equal(rankings.red_cards.categorySlug, 'club-career-red-cards');
assert.equal(rankings.yellow_cards.entries[0]?.entityId, 'football-data:player:ramos-s');
assert.equal(rankings.yellow_cards.entries[0]?.rawValue, 1);
assert.equal(rankings.red_cards.entries[0]?.entityId, 'football-data:player:muller-t');
assert.equal(rankings.red_cards.entries[0]?.rawValue, 1);
assert.equal(rankings.yellow_cards.coverageComplete, false);
assert.equal(rankings.red_cards.reviewed, false);

console.log('football-data incidents provider tests passed');
