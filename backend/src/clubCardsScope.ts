export const CLUB_CARD_SCOPE_COMPETITIONS = [
  { id: '39', providerId: 39, name: 'Premier League', status: 'complete' as const },
  { id: '140', providerId: 140, name: 'La Liga', status: 'complete' as const },
  { id: '135', providerId: 135, name: 'Serie A', status: 'complete' as const },
  { id: '78', providerId: 78, name: 'Bundesliga', status: 'quota_insufficient' as const },
  { id: '61', providerId: 61, name: 'Ligue 1', status: 'quota_insufficient' as const },
  { id: '94', providerId: 94, name: 'Primeira Liga', status: 'quota_insufficient' as const }
] as const;

export type ClubCardsScopeStatus = typeof CLUB_CARD_SCOPE_COMPETITIONS[number]['status'] | 'complete_scope' | 'provisional_active_season' | 'partial_missing_provider_data' | 'provider_unavailable';

export function buildClubCardsScopeStatus(input: { lastSnapshots?: Record<string, { id: string; generatedAt: string; contentSha256: string; status?: ClubCardsScopeStatus } | undefined> } = {}) {
  const lastSnapshots = input.lastSnapshots ?? {};
  const complete = CLUB_CARD_SCOPE_COMPETITIONS.filter((competition) => competition.status === 'complete');
  const pending = CLUB_CARD_SCOPE_COMPETITIONS.filter((competition) => competition.status !== 'complete');
  const provisional = pending.filter((competition) => lastSnapshots[competition.id]?.status === 'provisional_active_season').map((competition) => ({ ...competition, status: 'provisional_active_season' as const, state: 'snapshot_available' as const, lastSnapshot: lastSnapshots[competition.id] ?? null, reason: 'active_season_in_progress' as const }));
  const excluded = pending.filter((competition) => !provisional.some((candidate) => candidate.id === competition.id));
  return {
    status: 'complete_scope' as const,
    labelEs: '3 competiciones completas',
    labelEn: '3 complete competitions',
    included: complete.map((competition) => ({ ...competition, state: 'snapshot_preserved' as const, lastSnapshot: lastSnapshots[competition.id] ?? null })),
    excluded: excluded.map((competition) => ({ ...competition, state: 'snapshot_preserved' as const, reason: 'quota_insufficient' as const, lastSnapshot: lastSnapshots[competition.id] ?? null })),
    provisional,
    completeCount: complete.length,
    pendingCount: pending.length,
    warningEs: provisional.length > 0 ? `Ranking provisional de 3 competiciones completas; ${provisional.map((item) => item.name).join(', ')} tienen temporada activa provisional. No entran en complete_scope.` : 'Ranking provisional de 3 competiciones completas; Bundesliga, Ligue 1 y Primeira Liga están pendientes por cuota. No es un ranking global de seis competiciones.',
    warningEn: provisional.length > 0 ? `Provisional ranking of 3 complete competitions; ${provisional.map((item) => item.name).join(', ')} have an active-season provisional snapshot. They are not in complete_scope.` : 'Provisional ranking of 3 complete competitions; Bundesliga, Ligue 1 and Primeira Liga are pending quota. This is not a six-competition global ranking.'
  };
}

export function getKnownClubCardsCompetitionStatus(competitionId: string) {
  const competition = CLUB_CARD_SCOPE_COMPETITIONS.find((candidate) => candidate.id === competitionId);
  if (!competition) return { status: 'ranking_not_available' as const, reason: 'unknown_competition' as const };
  return competition.status === 'complete'
    ? { ...competition, state: 'snapshot_preserved' as const }
    : { ...competition, state: 'snapshot_preserved' as const, reason: 'quota_insufficient' as const };
}
