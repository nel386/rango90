import assert from 'node:assert/strict';
import { buildCoupeFranceRanking, parseCoupeFranceClubTitles } from '../providers/coupeFranceTitlesClient.js';

const clubs: Array<[string, number[]]> = [
  ['Paris Saint-Germain', [1982, 1983, 1993, 1995, 1998, 2004, 2006, 2010, 2015, 2016, 2017, 2018, 2020, 2021, 2024, 2025]], ['Olympique de Marseille', [1924, 1926, 1927, 1935, 1938, 1943, 1969, 1972, 1976, 1989]], ['AS Saint-Étienne', [1962, 1968, 1970, 1974, 1975, 1977]], ['Lille OSC', [1946, 1947, 1948, 1953, 1955, 2011]], ['Red Star Club', [1921, 1922, 1923, 1928, 1942]], ['RC Paris', [1936, 1939, 1940, 1945, 1949]], ['AS Monaco FC', [1960, 1963, 1980, 1985, 1991]], ['Olympique Lyonnais', [1964, 1967, 1973, 2008, 2012]], ['FC Girondins de Bordeaux', [1941, 1986, 1987, 2013]], ['FC Nantes Atlantique', [1979, 1999, 2000, 2022]], ['AJ Auxerre', [1994, 1996, 2003, 2005]], ['RC Strasbourg', [1951, 1966, 2001]], ['OGC Nice', [1952, 1954, 1997]], ['Stade Rennais FC', [1965, 1971, 2019]], ['CASG Paris', [1919, 1925]], ['FC Sète', [1930, 1934]], ['FC Sochaux Montbéliard', [1937, 2007]], ['Stade de Reims', [1950, 1958]], ['UA Sedan-Torcy', [1956, 1961]], ['FC Metz', [1984, 1988]], ['EA de Guingamp', [2009, 2014]], ['Olympique Pantin', [1918]], ['CA Paris', [1920]], ['SO Montpellier', [1929]], ['Club Français', [1931]], ['AS Cannes', [1932]], ['Excelsior Roubaix', [1933]], ['EF Nancy-Lorraine', [1944]], ['Toulouse FC _(*)_', [1957]], ['Le Havre AC', [1959]], ['AS Nancy Lorraine', [1978]], ['SEC Bastia', [1981]], ['Montpellier HSC', [1990]], ['FC Lorient', [2002]], ['Toulouse FC (*)', [2023]]
];
const markdown = clubs.flatMap(([name, years]) => [`## **${name}**`, '', `(${years.join(', ')})`]).join('\n');
const rows = parseCoupeFranceClubTitles(markdown);
assert.equal(rows.length, 35);
assert.equal(rows.reduce((sum, row) => sum + row.winnerYears.length, 0), 107);
const ranking = buildCoupeFranceRanking([...rows, { name: 'RC Lens', winnerYears: [2026] }]);
assert.equal(ranking.entries.length, 36);
assert.equal(ranking.entries.reduce((sum, entry) => sum + entry.rawValue, 0), 108);
assert.equal(ranking.entries[0]?.name, 'Paris Saint-Germain');
assert.equal(ranking.entries.find((entry) => entry.name.includes('1957'))?.entityId, 'fff:coupe-de-france:club:toulouse-fc-1957');
console.log('coupe de France titles tests passed');
