import type { RankingInput } from '../imports/rankingInput.js';

export const fifaClubWorldCupTitlesSourceUrl = 'https://www.archives.fifa.com/fifa_club_world_cup';

type ClubWorldCupTitleRow = {
  key: string;
  name: string;
  titles: number;
  editions: number[];
  entityId: string;
};

export const fifaClubWorldCupTitleRows: ClubWorldCupTitleRow[] = [
  { key: 'real-madrid', name: 'Real Madrid', titles: 5, editions: [2014, 2016, 2017, 2018, 2022], entityId: 'uefa:champions:club:4bea3ac923fc47dcf0b15d66' },
  { key: 'barcelona', name: 'Barcelona', titles: 3, editions: [2009, 2011, 2015], entityId: 'uefa:champions:club:062dda15f8838576019a50b0' },
  { key: 'corinthians', name: 'Corinthians', titles: 2, editions: [2000, 2012], entityId: 'fifa:club-world-cup:club:corinthians' },
  { key: 'bayern-munich', name: 'Bayern München', titles: 2, editions: [2013, 2020], entityId: 'uefa:champions:club:0414e94a3ca7c69b252081e3' },
  { key: 'chelsea', name: 'Chelsea', titles: 2, editions: [2021, 2025], entityId: 'pl:club:4' },
  { key: 'inter', name: 'Inter', titles: 1, editions: [2010], entityId: 'uefa:champions:club:30a4a5bca8f4056c1f696b91' },
  { key: 'sao-paulo', name: 'São Paulo', titles: 1, editions: [2005], entityId: 'fifa:club-world-cup:club:sao-paulo' },
  { key: 'internacional', name: 'Internacional', titles: 1, editions: [2006], entityId: 'fifa:club-world-cup:club:internacional' },
  { key: 'milan', name: 'Milan', titles: 1, editions: [2007], entityId: 'uefa:champions:club:ec3ae6550b9446364138461d' },
  { key: 'manchester-united', name: 'Manchester United', titles: 1, editions: [2008], entityId: 'pl:club:12' },
  { key: 'liverpool', name: 'Liverpool', titles: 1, editions: [2019], entityId: 'pl:club:10' },
  { key: 'manchester-city', name: 'Manchester City', titles: 1, editions: [2023], entityId: 'pl:club:11' }
];

function validateRows(rows: ClubWorldCupTitleRow[]): void {
  if (rows.length !== 12) throw new Error(`Mundial de Clubes FIFA: se esperaban 12 campeones, llegaron ${rows.length}`);
  const keys = new Set<string>();
  const editions = new Set<number>();
  let previousTitles = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (keys.has(row.key) || row.editions.length !== row.titles || row.titles < 1) {
      throw new Error(`Mundial de Clubes FIFA: datos inválidos para ${row.name}`);
    }
    if (row.titles > previousTitles) throw new Error(`Mundial de Clubes FIFA: títulos fuera de orden en ${row.name}`);
    for (const edition of row.editions) {
      if (editions.has(edition)) throw new Error(`Mundial de Clubes FIFA: edición duplicada ${edition}`);
      editions.add(edition);
    }
    keys.add(row.key);
    previousTitles = row.titles;
  }
  if (editions.size !== 21 || !editions.has(2000) || !editions.has(2025)) {
    throw new Error(`Mundial de Clubes FIFA: se esperaban 21 ediciones oficiales, llegaron ${editions.size}`);
  }
}

export function fetchFifaClubWorldCupClubTitles(): RankingInput {
  validateRows(fifaClubWorldCupTitleRows);
  return {
    categorySlug: 'club-world-cup-club-titles',
    source: {
      key: 'fifa-club-world-cup-archive',
      name: 'FIFA Club World Cup — archivo oficial de campeones',
      sourceType: 'official',
      baseUrl: fifaClubWorldCupTitlesSourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: 'fifa-club-world-cup-club-titles-2025',
    coverageComplete: true,
    reviewed: false,
    entries: fifaClubWorldCupTitleRows.map((row, index) => ({
      entityId: row.entityId,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: index + 1,
        externalId: `fifa:club-world-cup:club:${row.key}`,
        sourceUrl: fifaClubWorldCupTitlesSourceUrl,
        editions: row.editions,
        scope: 'FIFA Club World Cup; incluye 2000, 2005–2023 y 2025; excluye la Copa Intercontinental independiente'
      }
    }))
  };
}
