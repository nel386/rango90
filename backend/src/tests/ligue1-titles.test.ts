import assert from 'node:assert/strict';
import { parseLigue1ClubTitles } from '../providers/ligue1TitlesClient.js';

const counts: Array<[string, number]> = [
  ['Paris Saint-Germain', 14], ['AS Saint-Etienne', 10], ['Olympique de Marseille', 9],
  ['AS Monaco', 8], ['FC Nantes', 8], ['Olympique Lyonnais', 7], ['Stade de Reims', 6],
  ['FC Girondins de Bordeaux', 6], ['OGC Nice', 4], ['LOSC', 4],
  ['FC Sochaux Montbéliard', 2], ['FC Sète 34', 2], ['Montpellier Hérault SC', 1],
  ['RC Lens', 1], ['RC Strasbourg Alsace', 1], ['AJ Auxerre', 1],
  ['Olympique Lillois', 1], ['Racing Club de Paris', 1], ['CO Roubaix-Tourcoing', 1]
];
const seasons = counts.flatMap(([name, count], clubIndex) => Array.from({ length: count }, (_, seasonIndex) => {
  const year = 1932 + clubIndex * 4 + seasonIndex;
  return `${year}/${String((year + 1) % 100).padStart(2, '0')} : ${name}`;
}));

const html = `<article><p>La liste des clubs sacrés par saison : ${seasons.join(' ')}</p><p>Classement des clubs les plus titrés de Ligue 1</p></article>`;
const parsed = parseLigue1ClubTitles(html);
assert.equal(parsed.length, 19);
assert.deepEqual(parsed.slice(0, 6), [
  { name: 'Paris Saint-Germain', titles: 14 },
  { name: 'AS Saint-Etienne', titles: 10 },
  { name: 'Olympique de Marseille', titles: 9 },
  { name: 'AS Monaco', titles: 8 },
  { name: 'FC Nantes', titles: 8 },
  { name: 'Olympique Lyonnais', titles: 7 }
]);
assert.throws(() => parseLigue1ClubTitles('<p>empty</p>'), /bloque oficial/);
console.log('ligue 1 titles tests passed');
