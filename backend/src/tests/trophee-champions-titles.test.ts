import assert from 'node:assert/strict';
import { parseTropheeChampionsTitles } from '../providers/tropheeChampionsTitlesClient.js';

const winners = [
  ['Paris Saint-Germain', 14], ['Olympique Lyonnais', 7], ['Olympique de Marseille', 2],
  ['Girondins de Bordeaux', 2], ['FC Nantes', 2], ['AS Monaco', 2], ['LOSC Lille', 1], ['RC Lens', 1]
] as const;
const lines = winners.flatMap(([name, count], index) => Array.from({ length: count }, (_, i) => `${1995 + index * 4 + i} : ${name} - Opponent : 1-0`));
const html = `<p>Les vainqueurs du Trophée des Champions : ${lines.join(' ')}</p><p>→ Le palmarès du MVP</p>`;
const parsed = parseTropheeChampionsTitles(html);
assert.equal(parsed.length, 8);
assert.deepEqual(parsed.slice(0, 3), [
  { name: 'Paris Saint-Germain', titles: 14 },
  { name: 'Olympique Lyonnais', titles: 7 },
  { name: 'AS Monaco', titles: 2 }
]);
assert.throws(() => parseTropheeChampionsTitles('<p>empty</p>'), /bloque oficial/);
console.log('trophee champions titles tests passed');
