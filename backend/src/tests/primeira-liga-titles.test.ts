import assert from 'node:assert/strict';
import { buildPrimeiraLigaRanking, parsePrimeiraLigaClubTitles } from '../providers/primeiraLigaTitlesClient.js';

const names = [
  'FC Porto', 'Sporting CP', 'Sporting CP', 'SL Benfica',
  ...Array.from({ length: 37 }, () => 'SL Benfica'),
  ...Array.from({ length: 30 }, () => 'FC Porto'),
  ...Array.from({ length: 19 }, () => 'Sporting CP'),
  'Boavista FC', 'CF Belenenses'
];
const seasons = Array.from({ length: 92 }, (_, index) => `${2025 - index}/${2026 - index}`);
assert.equal(names.length, seasons.length);
const rows = parsePrimeiraLigaClubTitles([
  '### I Divisão/ I Liga', '',
  ...seasons.map((season, index) => `${season} ${names[index]}`),
  '', '### Campeonato da Liga I Divisão', '', '[](https://www.fpf.pt/pt/competicoes/futebol/masculino/liga-nos/vencedores)'
].join('\n'));
assert.equal(rows.length, 92);
assert.equal(buildPrimeiraLigaRanking(rows).entries.length, 5);
console.log('primeira liga titles tests passed');
