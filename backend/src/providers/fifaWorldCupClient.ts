import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://www.fifa.com/en/tournaments/mens/worldcup/articles/world-cup-champions-1982-2026-italy-argentina-germany-brazil-france-spain';
const historicalSourceUrl = 'https://www.fifa.com/fr/tournaments/mens/worldcup/articles/vainqueurs-de-la-coupe-du-monde-fifa-1930-1978';

type WorldCupChampion = {
  name: string;
  code: string;
  titles: number;
  years: number[];
  entityId: string;
};

// FIFA's two official history articles cover the complete men's tournament
// record. Germany is intentionally one entity across FRG (1954, 1974, 1990)
// and Germany (2014); the years remain explicit evidence for auditability.
const champions: WorldCupChampion[] = [
  { name: 'Brazil', code: 'BRA', titles: 5, years: [1958, 1962, 1970, 1994, 2002], entityId: 'fifa:world-cup:national-team:brazil' },
  { name: 'Germany', code: 'GER', titles: 4, years: [1954, 1974, 1990, 2014], entityId: 'uefa:euro:national-team:d16bc5443ca1c8804d10c991' },
  { name: 'Italy', code: 'ITA', titles: 4, years: [1934, 1938, 1982, 2006], entityId: 'uefa:euro:national-team:50df1f1f2697727d6120dc89' },
  { name: 'Argentina', code: 'ARG', titles: 3, years: [1978, 1986, 2022], entityId: 'fifa:world-cup:national-team:argentina' },
  { name: 'France', code: 'FRA', titles: 2, years: [1998, 2018], entityId: 'uefa:euro:national-team:05e837ba40a4ce384caec4dd' },
  { name: 'Spain', code: 'ESP', titles: 2, years: [2010, 2026], entityId: 'uefa:euro:national-team:5ae0eccf85bfcf66f267fb19' },
  { name: 'Uruguay', code: 'URU', titles: 2, years: [1930, 1950], entityId: 'fifa:world-cup:national-team:uruguay' },
  { name: 'England', code: 'ENG', titles: 1, years: [1966], entityId: 'fifa:world-cup:national-team:england' }
];

export function fetchFifaWorldCupNationalTeamTitles(): RankingInput {
  return {
    categorySlug: 'world-cup-national_team-titles',
    source: {
      key: 'fifa-world-cup-official',
      name: 'FIFA World Cup official champions history',
      sourceType: 'official',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `world-cup-national-team-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: champions.map((champion, index) => ({
      entityId: champion.entityId,
      entityType: 'national_team' as const,
      name: champion.name,
      rawValue: champion.titles,
      evidence: {
        sourceRank: index + 1,
        externalId: `fifa-world-cup:${champion.code}`,
        sourceUrl,
        historicalSourceUrl,
        scope: 'FIFA World Cup masculino; títulos oficiales por selección desde 1930 hasta 2026',
        winnerYears: champion.years,
        countryCode: champion.code,
        continuityRule: 'Alemania Federal y Alemania se agrupan como una selección histórica'
      }
    }))
  };
}

export function fifaWorldCupChampionChecksum(): string {
  return createHash('sha256').update(JSON.stringify(champions)).digest('hex');
}
