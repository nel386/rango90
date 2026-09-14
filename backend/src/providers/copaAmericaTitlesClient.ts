import type { RankingInput } from '../imports/rankingInput.js';

export const copaAmericaTitlesSourceUrl = 'https://copaamerica.com/es/novedades/todas-ediciones-conmebol-copa-america-campeones-sedes-mejores-jugadores';

export type CopaAmericaTitleRow = {
  code: string;
  name: string;
  titles: number;
  years: number[];
};

// The official competition history reports 48 editions through 2024 and the
// complete all-time title distribution. Keep the years as evidence so a
// future edition can be added without silently changing historical totals.
export const copaAmericaTitleRows: CopaAmericaTitleRow[] = [
  { code: 'ARG', name: 'Argentina', titles: 16, years: [1921, 1925, 1927, 1929, 1937, 1941, 1945, 1946, 1947, 1955, 1957, 1959, 1991, 1993, 2021, 2024] },
  { code: 'URU', name: 'Uruguay', titles: 15, years: [1916, 1917, 1920, 1923, 1924, 1926, 1935, 1942, 1956, 1959, 1967, 1983, 1987, 1995, 2011] },
  { code: 'BRA', name: 'Brazil', titles: 9, years: [1919, 1922, 1949, 1989, 1997, 1999, 2004, 2007, 2019] },
  { code: 'PRY', name: 'Paraguay', titles: 2, years: [1953, 1979] },
  { code: 'CHL', name: 'Chile', titles: 2, years: [2015, 2016] },
  { code: 'PER', name: 'Peru', titles: 2, years: [1939, 1975] },
  { code: 'COL', name: 'Colombia', titles: 1, years: [2001] },
  { code: 'BOL', name: 'Bolivia', titles: 1, years: [1963] }
];

const stableNationalTeamIds: Record<string, string> = {
  ARG: 'fifa:world-cup:national-team:argentina',
  BRA: 'fifa:world-cup:national-team:brazil',
  URU: 'fifa:world-cup:national-team:uruguay'
};

function validateRows(rows: CopaAmericaTitleRow[]): void {
  if (rows.length !== 8) throw new Error(`Copa América: se esperaban 8 campeones, llegaron ${rows.length}`);
  const codes = new Set<string>();
  let previousTitles = Number.POSITIVE_INFINITY;
  let editionCount = 0;
  for (const row of rows) {
    if (codes.has(row.code) || row.years.length !== row.titles) throw new Error(`Copa América: títulos/años inválidos para ${row.name}`);
    if (row.titles > previousTitles) throw new Error(`Copa América: títulos fuera de orden en ${row.name}`);
    codes.add(row.code);
    previousTitles = row.titles;
    editionCount += row.titles;
  }
  if (editionCount !== 48) throw new Error(`Copa América: se esperaban 48 ediciones, llegaron ${editionCount}`);
}

export function fetchCopaAmericaNationalTeamTitles(): RankingInput {
  validateRows(copaAmericaTitleRows);
  return {
    categorySlug: 'copa-america-national_team-titles',
    source: {
      key: 'conmebol-copa-america-history',
      name: 'CONMEBOL Copa América — historia oficial de campeones',
      sourceType: 'official',
      baseUrl: copaAmericaTitlesSourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: 'conmebol-copa-america-national-team-titles-2024',
    coverageComplete: true,
    reviewed: false,
    entries: copaAmericaTitleRows.map((row, index) => ({
      entityId: stableNationalTeamIds[row.code] ?? `conmebol:copa-america:national-team:${row.code.toLowerCase()}`,
      entityType: 'national_team' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: index + 1,
        externalId: `conmebol:copa-america:national-team:${row.code}`,
        sourceUrl: copaAmericaTitlesSourceUrl,
        years: row.years,
        scope: 'CONMEBOL Copa América y Campeonato Sudamericano; 48 ediciones celebradas hasta 2024'
      }
    }))
  };
}
