import assert from 'node:assert/strict';
import { parseSupercopaEspanaTitles } from '../providers/supercopaEspanaTitlesClient.js';

const winners = [
  ['Real Sociedad', 1982], ['FC Barcelona', 1983], ['Athletic Club', 1984], ['Club Atlético de Madrid', 1985],
  ['Real Madrid CF', 1988], ['Real Madrid CF', 1989], ['Real Madrid CF', 1990], ['FC Barcelona', 1991],
  ['FC Barcelona', 1992], ['Real Madrid CF', 1993], ['FC Barcelona', 1994], ['RC Deportivo de La Coruña', 1995],
  ['FC Barcelona', 1996], ['Real Madrid CF', 1997], ['RCD Mallorca', 1998], ['Valencia CF', 1999],
  ['RC Deportivo de La Coruña', 2000], ['Real Madrid CF', 2001], ['RC Deportivo de La Coruña', 2002], ['Real Madrid CF', 2003],
  ['Real Zaragoza', 2004], ['FC Barcelona', 2005], ['FC Barcelona', 2006], ['Sevilla FC', 2007], ['Real Madrid CF', 2008],
  ['FC Barcelona', 2009], ['FC Barcelona', 2010], ['FC Barcelona', 2011], ['Real Madrid CF', 2012], ['FC Barcelona', 2013],
  ['Club Atlético de Madrid', 2014], ['Athletic Club', 2015], ['FC Barcelona', 2016], ['Real Madrid CF', 2017],
  ['FC Barcelona', 2018], ['Real Madrid CF', 2020], ['Athletic Club', 2021], ['Real Madrid CF', 2022], ['FC Barcelona', 2023],
  ['Real Madrid CF', 2024], ['FC Barcelona', 2025], ['FC Barcelona', 2026]
] as const;
const markdown = [
  '| EDICIÓN | AÑO | CAMPEÓN | SUBCAMPEÓN |',
  '| --- | --- | --- | --- |',
  ...winners.map(([name, year], index) => `| ${index + 1} | ${year} | **${name}** | rival |`)
].join('\n');

const rows = parseSupercopaEspanaTitles(markdown);
assert.equal(rows.length, 10);
assert.equal(rows[0]?.name, 'FC Barcelona');
assert.equal(rows[0]?.titles, 16);
assert.equal(rows.reduce((sum, row) => sum + row.titles, 0), 42);
assert.deepEqual(rows.find((row) => row.name === 'Athletic Club')?.winnerYears, [1984, 2015, 2021]);
console.log('supercopa española titles tests passed');
