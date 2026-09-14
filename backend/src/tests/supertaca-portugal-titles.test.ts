import assert from 'node:assert/strict';
import { buildSupertacaPortugalRanking, parseSupertacaPortugalClubTitles } from '../providers/supertacaPortugalTitlesClient.js';

const names = [
  ...Array.from({ length: 25 }, () => 'FC Porto'), ...Array.from({ length: 9 }, () => 'SL Benfica'),
  ...Array.from({ length: 9 }, () => 'Sporting CP'), 'Boavista FC', 'Boavista FC', 'Vitória SC',
  'SL Benfica (prova oficiosa)', 'Boavista FC (prova oficiosa)'
];
const years = Array.from({ length: 48 }, (_, index) => 2026 - index);
const markdown = ['### Supertaça Cândido de Oliveira', '', ...years.map((year, index) => `${year} ${names[index]}`), '', '[](https://www.fpf.pt/pt/Competi%C3%A7%C3%B5es/Futebol-Masculino/Superta%C3%A7a-C%C3%A2ndido-de-Oliveira-Betano/Vencedores)'].join('\n');
const rows = parseSupertacaPortugalClubTitles(markdown);
assert.equal(rows.length, 46);
assert.equal(rows.reduce((sum) => sum + 1, 0), 46);
const ranking = buildSupertacaPortugalRanking(rows);
assert.equal(ranking.entries.length, 5);
assert.equal(ranking.entries[0]?.name, 'FC Porto');
assert.equal(ranking.entries[0]?.rawValue, 25);
assert.deepEqual(ranking.entries.find((entry) => entry.name === 'FC Porto')?.evidence?.winnerYears, years.slice(0, 25));
console.log('supertaca portuguesa titles tests passed');
