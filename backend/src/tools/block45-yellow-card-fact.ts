import { createHash } from 'node:crypto';
import { isOfficialClubCompetition } from './block45-provider-scope.js';
import { resolveBlock45LegacyZeroRow } from './block45-legacy-zero-evidence.js';
import type { YellowCardFact } from '../clubYellowCardsCareerRankingEngine.js';

type JsonRecord = Record<string, unknown>;

const object = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function factFromStats(
  player: JsonRecord,
  statistic: JsonRecord,
  season: number,
  sourceUrl: string,
  page: number,
  responseSha256: string,
  eligibilityMajorLeagueId: number | null
): YellowCardFact | null {
  const team = object(statistic.team); const league = object(statistic.league); const games = object(statistic.games); const cards = object(statistic.cards);
  const playerId = Number(player.id); const clubId = Number(team.id); const sourceCompetitionId = Number(league.id); const yellow = numberOrNull(cards.yellow);
  const legacyAttribution = resolveBlock45LegacyZeroRow({ playerId, season, eligibilityMajorLeagueId, statistic });
  if (!legacyAttribution && !isOfficialClubCompetition(statistic)) return null;
  if (!Number.isInteger(playerId) || playerId < 1 || !Number.isInteger(clubId) || clubId < 1 || yellow === null) return null;
  if (sourceCompetitionId === 0 && !legacyAttribution) return null;
  if (sourceCompetitionId !== 0 && (!Number.isInteger(sourceCompetitionId) || sourceCompetitionId < 1)) return null;
  const competitionId = legacyAttribution?.attributedCompetitionId ?? sourceCompetitionId;
  const competitionName = legacyAttribution?.competitionName ?? String(league.name ?? `Competition ${competitionId}`);
  const name = String(player.name ?? `Player ${playerId}`).replace(/\s+/gu, ' ').trim();
  const sourceRecord = `${season}|${playerId}|${clubId}|${competitionId}`;
  return {
    id: `club-yellow-card-fact-${sha256(sourceRecord).slice(0, 32)}`, sourcePlayerId: String(playerId), playerNameOriginal: name,
    canonicalPlayerId: `api-football:player:${playerId}`, canonicalName: name, clubProviderId: clubId,
    clubName: String(team.name ?? `Club ${clubId}`), competitionProviderId: competitionId, competitionName,
    competitionType: 'official_club_competition', eligibilityMajorLeagueId,
    seasonStart: season, appearances: numberOrNull(games.appearences), minutes: numberOrNull(games.minutes), yellowCards: yellow,
    sourceKey: 'api-football', sourceUrl, sourcePage: page,
    locator: `response.player.id=${playerId}.statistics[league=${sourceCompetitionId},name=${competitionName},season=${season}].team.id=${clubId}.cards.yellow`,
    responseSha256, capturedAt: new Date().toISOString(), sourceType: 'primary', verificationStatus: 'confirmed', coverageStatus: 'coverage_partial',
    ...(legacyAttribution ? { competitionAttribution: {
      method: 'block45e_exact_case_evidence', caseId: legacyAttribution.caseId,
      sourceCompetitionId: legacyAttribution.sourceCompetitionId,
      attributedCompetitionId: legacyAttribution.attributedCompetitionId,
      independentSource: legacyAttribution.independentSource, auditArtifact: legacyAttribution.auditArtifact,
      auditReportSha256: legacyAttribution.auditReportSha256, auditResponseSha256: legacyAttribution.auditResponseSha256
    } } : {})
  };
}
