import assert from 'node:assert/strict';
import { parseBallonDorWinners } from '../providers/franceFootballClient.js';

const players = Array.from({ length: 60 }, (_, index) => ({
  IDJOUEUR: String(index + 1),
  NOM: index === 0 ? 'Ousmane Dembélé' : index === 1 ? 'Rodri' : `Ganador ${index + 1}`,
  YEAR: String(index === 0 ? 2025 : index === 1 ? 2024 : 1956 + index - 2),
  LINK: `https://app.francefootball.fr/fiche/joueur/${index + 1}`,
  URLMEDIA: `https://media.francefootball.fr/${index + 1}.jpg`,
  CODEPAYS: index === 0 ? 'FRA' : index === 1 ? 'ESP' : 'XXX'
}));

const html = `<script>window.__NUXT__=${JSON.stringify({
  fetch: {
    'Palmares:0': {
      palmaresObjectItems: [
        { id: 'male', players },
        { id: 'female', players: [] }
      ]
    }
  }
})}</script>`;

const winners = parseBallonDorWinners(html);
assert.equal(winners.length, 60);
assert.deepEqual(winners.slice(0, 2).map((winner) => [winner.year, winner.name]), [
  [2025, 'Ousmane Dembélé'],
  [2024, 'Rodri']
]);
assert.equal(new Set(winners.map((winner) => winner.year)).size, 60);

console.log('france-football.test.ts: OK');
