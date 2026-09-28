import { normalizePlayerName, type YellowCardFact } from '../clubYellowCardsCareerRankingEngine.js';

/**
 * Exact, case-scoped decisions from BLOCK45E. This is deliberately not a
 * league.id=0 mapping rule: every field below must match before a row can be
 * attributed. All other zero/missing competition IDs stay blocked.
 */
export type LegacyZeroAttribution = {
  caseId: string;
  playerId: number;
  season: number;
  sourceCompetitionId: 0;
  attributedCompetitionId: number;
  competitionName: string;
  teamId: number;
  yellowCards: number;
  independentSource: string;
  auditArtifact: string;
  auditReportSha256: string;
  auditResponseSha256: string;
};

export const BLOCK45E_AUDIT_ARTIFACT = 'backend/audits/block45/BLOCK45E_LEAGUE_ZERO_VALIDATION.json';
export const BLOCK45E_AUDIT_REPORT_SHA256 = 'acf1c9c161607508b98bcdc51de9b9162add7cb724e8a0f0f542b2c83410dcda';

export const BLOCK45E_RESOLVED_LEAGUE_ZERO_ROWS: readonly LegacyZeroAttribution[] = [
  {
    caseId: 'la-liga-sergio-ramos-2007', playerId: 738, season: 2007,
    sourceCompetitionId: 0, attributedCompetitionId: 140, competitionName: 'La Liga',
    teamId: 541, yellowCards: 14,
    independentSource: 'https://betl.statbunker.com/players/GetHistoryStats?comps_type=-1&dates=-1&player_id=18585',
    auditArtifact: BLOCK45E_AUDIT_ARTIFACT, auditReportSha256: BLOCK45E_AUDIT_REPORT_SHA256,
    auditResponseSha256: '5758a46f938db698be50ee0e59dfe13bd618dbec4abf65d552b0bdaf3c27af8c'
  },
  {
    caseId: 'la-liga-dani-parejo-2009', playerId: 928, season: 2009,
    sourceCompetitionId: 0, attributedCompetitionId: 140, competitionName: 'La Liga',
    teamId: 546, yellowCards: 6,
    independentSource: 'https://theanalyst.com/players/1893/dani-parejo/career',
    auditArtifact: BLOCK45E_AUDIT_ARTIFACT, auditReportSha256: BLOCK45E_AUDIT_REPORT_SHA256,
    auditResponseSha256: 'e91df714149de770f25d87f9c99cd6dfa3fe9604c8d45493e58e9ab9fac80314'
  },
  {
    caseId: 'bundesliga-franck-ribery-2007', playerId: 515, season: 2007,
    sourceCompetitionId: 0, attributedCompetitionId: 78, competitionName: 'Bundesliga',
    teamId: 157, yellowCards: 2,
    independentSource: 'https://www.statbunker.com/players/GetHistoryStats?comps_type=BL&dates=2007&player_id=18728',
    auditArtifact: BLOCK45E_AUDIT_ARTIFACT, auditReportSha256: BLOCK45E_AUDIT_REPORT_SHA256,
    auditResponseSha256: '83d5cefce95633b6c35bd71097fa986d4fa3b40c21e31d08f83d9ac349f02d96'
  },
  {
    caseId: 'bundesliga-franck-ribery-2009', playerId: 515, season: 2009,
    sourceCompetitionId: 0, attributedCompetitionId: 78, competitionName: 'Bundesliga',
    teamId: 157, yellowCards: 1,
    independentSource: 'https://www.statbunker.com/players/GetHistoryStats?comps_type=BL&dates=2009&player_id=18728',
    auditArtifact: BLOCK45E_AUDIT_ARTIFACT, auditReportSha256: BLOCK45E_AUDIT_REPORT_SHA256,
    auditResponseSha256: '1018d1e0b71755f9a96892cb36e4d572da843c0bcf0bc340dc15d1a7f2913bd0'
  }
];

export function resolveBlock45LegacyZeroRow(input: {
  playerId: number;
  season: number;
  eligibilityMajorLeagueId: number | null;
  statistic: Record<string, unknown>;
}): LegacyZeroAttribution | null {
  const league = input.statistic.league && typeof input.statistic.league === 'object'
    ? input.statistic.league as Record<string, unknown> : {};
  const team = input.statistic.team && typeof input.statistic.team === 'object'
    ? input.statistic.team as Record<string, unknown> : {};
  const cards = input.statistic.cards && typeof input.statistic.cards === 'object'
    ? input.statistic.cards as Record<string, unknown> : {};
  if (league.id !== 0) return null;

  return BLOCK45E_RESOLVED_LEAGUE_ZERO_ROWS.find((row) => {
    if (input.playerId !== row.playerId || input.season !== row.season) return false;
    if (input.eligibilityMajorLeagueId !== null && input.eligibilityMajorLeagueId !== row.attributedCompetitionId) return false;
    if (Number(team.id) !== row.teamId || Number(cards.yellow) !== row.yellowCards) return false;
    if (normalizePlayerName(String(league.name ?? '')) !== normalizePlayerName(row.competitionName)) return false;
    const returnedSeason = league.season === undefined || league.season === null ? null : Number(league.season);
    return returnedSeason === null || (Number.isInteger(returnedSeason) && returnedSeason === row.season);
  }) ?? null;
}

export function hasValidBlock45LegacyZeroAttribution(fact: YellowCardFact): boolean {
  const attribution = fact.competitionAttribution;
  if (!attribution || attribution.method !== 'block45e_exact_case_evidence') return false;
  const evidence = BLOCK45E_RESOLVED_LEAGUE_ZERO_ROWS.find((row) => row.caseId === attribution.caseId);
  return Boolean(evidence
    && attribution.sourceCompetitionId === evidence.sourceCompetitionId
    && attribution.attributedCompetitionId === evidence.attributedCompetitionId
    && attribution.independentSource === evidence.independentSource
    && attribution.auditArtifact === evidence.auditArtifact
    && attribution.auditReportSha256 === evidence.auditReportSha256
    && attribution.auditResponseSha256 === evidence.auditResponseSha256
    && fact.sourcePlayerId === String(evidence.playerId)
    && fact.seasonStart === evidence.season
    && fact.clubProviderId === evidence.teamId
    && fact.competitionProviderId === evidence.attributedCompetitionId
    && normalizePlayerName(fact.competitionName) === normalizePlayerName(evidence.competitionName)
    && fact.yellowCards === evidence.yellowCards);
}
