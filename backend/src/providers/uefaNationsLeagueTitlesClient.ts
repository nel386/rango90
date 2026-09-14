import type { RankingInput } from '../imports/rankingInput.js';

export const uefaNationsLeagueTitlesSourceUrl = 'https://www.uefa.com/news/026e-1372acedf4a0-4cf2bf8d3c1b-1000--nations-league-roll-of-honour/';

type NationsLeagueTitleRow = {
  code: string;
  name: string;
  titles: number;
  editions: number[];
};

export const uefaNationsLeagueTitleRows: NationsLeagueTitleRow[] = [
  { code: 'POR', name: 'Portugal', titles: 2, editions: [2019, 2025] },
  { code: 'ESP', name: 'Spain', titles: 1, editions: [2023] },
  { code: 'FRA', name: 'France', titles: 1, editions: [2021] }
];

const nationalTeamIds: Record<string, string> = {
  POR: 'uefa:euro:national-team:88f0ccf3dff5f1f2b9f1e1cc',
  ESP: 'uefa:euro:national-team:5ae0eccf85bfcf66f267fb19',
  FRA: 'uefa:euro:national-team:05e837ba40a4ce384caec4dd'
};

function validateRows(rows: NationsLeagueTitleRow[]): void {
  if (rows.length !== 3) throw new Error(`Nations League: se esperaban 3 campeones, llegaron ${rows.length}`);
  const codes = new Set<string>();
  let previousTitles = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (codes.has(row.code) || row.editions.length !== row.titles || row.titles < 1) {
      throw new Error(`Nations League: ediciones inválidas para ${row.name}`);
    }
    if (row.titles > previousTitles) throw new Error(`Nations League: títulos fuera de orden en ${row.name}`);
    codes.add(row.code);
    previousTitles = row.titles;
  }
  if (rows.reduce((sum, row) => sum + row.titles, 0) !== 4) throw new Error('Nations League: se esperaban cuatro ediciones');
}

export function fetchUefaNationsLeagueNationalTeamTitles(): RankingInput {
  validateRows(uefaNationsLeagueTitleRows);
  return {
    categorySlug: 'nations-league-national_team-titles',
    source: {
      key: 'uefa-nations-league-roll-of-honour',
      name: 'UEFA Nations League — cuadro de honor oficial',
      sourceType: 'official',
      baseUrl: uefaNationsLeagueTitlesSourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: 'uefa-nations-league-national-team-titles-2025',
    coverageComplete: true,
    reviewed: false,
    entries: uefaNationsLeagueTitleRows.map((row, index) => ({
      entityId: nationalTeamIds[row.code]!,
      entityType: 'national_team' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: index + 1,
        externalId: `uefa:nations-league:national-team:${row.code}`,
        sourceUrl: uefaNationsLeagueTitlesSourceUrl,
        editions: row.editions,
        scope: 'UEFA Nations League masculina; cuatro torneos finales celebrados hasta 2025'
      }
    }))
  };
}
