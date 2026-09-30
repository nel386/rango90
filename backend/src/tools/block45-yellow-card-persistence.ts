import pg from 'pg';
import type { YellowCardFact } from '../clubYellowCardsCareerRankingEngine.js';

type PgQueryable = pg.Pool | pg.PoolClient;

type CompetitionAttribution = NonNullable<YellowCardFact['competitionAttribution']>;

function attributionFromEvidence(value: unknown): CompetitionAttribution | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('competitionAttribution almacenada no es un objeto');
  const row = value as Record<string, unknown>;
  const valid = row.method === 'block45e_exact_case_evidence'
    && typeof row.caseId === 'string' && row.caseId.length > 0
    && row.sourceCompetitionId === 0
    && Number.isInteger(row.attributedCompetitionId) && Number(row.attributedCompetitionId) > 0
    && typeof row.independentSource === 'string' && row.independentSource.length > 0
    && typeof row.auditArtifact === 'string' && row.auditArtifact.length > 0
    && typeof row.auditReportSha256 === 'string' && /^[a-f0-9]{64}$/u.test(row.auditReportSha256)
    && typeof row.auditResponseSha256 === 'string' && /^[a-f0-9]{64}$/u.test(row.auditResponseSha256);
  if (!valid) throw new Error('competitionAttribution almacenada no supera validación');
  return {
    method: 'block45e_exact_case_evidence', caseId: row.caseId as string,
    sourceCompetitionId: 0, attributedCompetitionId: Number(row.attributedCompetitionId),
    independentSource: row.independentSource as string, auditArtifact: row.auditArtifact as string,
    auditReportSha256: row.auditReportSha256 as string, auditResponseSha256: row.auditResponseSha256 as string
  };
}

function rowFact(row: Record<string, unknown>): YellowCardFact {
  const evidence = row.evidence && typeof row.evidence === 'object' && !Array.isArray(row.evidence)
    ? row.evidence as Record<string, unknown> : {};
  const competitionAttribution = attributionFromEvidence(evidence.competitionAttribution);
  return {
    id: String(row.id), sourcePlayerId: String(row.source_player_id), playerNameOriginal: String(row.player_name_original), canonicalPlayerId: String(row.canonical_player_id), canonicalName: String(row.canonical_name), clubProviderId: Number(row.club_provider_id), clubName: String(row.club_name), competitionProviderId: Number(row.competition_provider_id), competitionName: String(row.competition_name), competitionType: 'official_club_competition', eligibilityMajorLeagueId: row.eligibility_major_league_id === null ? null : Number(row.eligibility_major_league_id), seasonStart: Number(row.season_start), appearances: row.appearances === null ? null : Number(row.appearances), minutes: row.minutes === null ? null : Number(row.minutes), yellowCards: row.yellow_cards === null ? null : Number(row.yellow_cards), redCards: row.red_cards === null ? null : Number(row.red_cards), yellowRedCards: row.yellow_red_cards === null ? null : Number(row.yellow_red_cards), sourceKey: String(row.source_key), sourceUrl: String(row.source_url), sourcePage: Number(row.source_page), locator: String(row.locator), responseSha256: String(row.response_sha256), capturedAt: new Date(String(row.captured_at)).toISOString(), sourceType: String(row.source_type) as YellowCardFact['sourceType'], verificationStatus: String(row.verification_status) as YellowCardFact['verificationStatus'], coverageStatus: String(row.coverage_status) as YellowCardFact['coverageStatus'], ...(competitionAttribution ? { competitionAttribution } : {})
  };
}

export async function existingBlock45Facts(pool: PgQueryable): Promise<YellowCardFact[]> {
  const result = await pool.query('SELECT * FROM club_yellow_card_facts ORDER BY id');
  return result.rows.map((row) => rowFact(row as Record<string, unknown>));
}

export async function insertBlock45Facts(pool: PgQueryable, facts: YellowCardFact[]): Promise<{ added: number; skipped: number }> {
  let added = 0; let skipped = 0;
  for (const fact of facts) {
    const evidence = {
      sourceUrl: fact.sourceUrl, locator: fact.locator, responseSha256: fact.responseSha256,
      rawPayloadStored: false,
      ...(fact.competitionAttribution ? { competitionAttribution: fact.competitionAttribution } : {})
    };
    const result = await pool.query(`INSERT INTO club_yellow_card_facts
      (id,source_player_id,player_name_original,canonical_player_id,canonical_name,club_provider_id,club_name,competition_provider_id,competition_name,competition_type,eligibility_major_league_id,season_start,appearances,minutes,yellow_cards,red_cards,yellow_red_cards,source_key,source_url,source_page,locator,response_sha256,captured_at,source_type,verification_status,coverage_status,evidence)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
      ON CONFLICT DO NOTHING`, [fact.id, fact.sourcePlayerId, fact.playerNameOriginal, fact.canonicalPlayerId, fact.canonicalName, fact.clubProviderId, fact.clubName, fact.competitionProviderId, fact.competitionName, fact.competitionType, fact.eligibilityMajorLeagueId, fact.seasonStart, fact.appearances, fact.minutes, fact.yellowCards, fact.redCards ?? null, fact.yellowRedCards ?? null, fact.sourceKey, fact.sourceUrl, fact.sourcePage, fact.locator, fact.responseSha256, fact.capturedAt, fact.sourceType, fact.verificationStatus, fact.coverageStatus, evidence]);
    if ((result.rowCount ?? 0) > 0) added += 1; else skipped += 1;
  }
  return { added, skipped };
}
