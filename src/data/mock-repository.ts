import { mockDailyChallenge } from "./mock-game";
import { RepositoryError, type AssignmentClaim, type GameRepository, type GameResult, type GameSession, type LeaderboardEntry, type OfficialAssignment } from "./game-repository";

function hashMockResult(assignments: OfficialAssignment[]) {
  return assignments.map((assignment) => `${assignment.ordinal}:${assignment.entityId}:${assignment.categorySlug}:${assignment.scoreValue}`).join("|");
}

function mockResult(session: GameSession, claims: AssignmentClaim[], timedOut = false): { accepted: true; duplicate: false; leaderboardEligible: false; resultId: string; result: GameResult } {
  const assignments = claims.map((claim) => {
    const entity = session.challenge.entities[claim.ordinal];
    const scoreValue = claim.timedOut ? 100 : entity?.scores[claim.categorySlug] ?? 100;
    return { ...claim, scoreValue, timedOut: Boolean(claim.timedOut) };
  });
  const startedAtMs = Date.parse(session.startedAt);
  const finishedAtMs = timedOut ? Date.parse(session.deadlineAt) : Date.now();
  const result: GameResult = {
    challengeId: session.challengeId, sourceVersion: session.challenge.sourceVersion, engineVersion: "mock-engine-v1",
    challengeSha256: session.challenge.challengeSha256,
    startedAtMs, finishedAtMs, elapsedMilliseconds: Math.max(0, finishedAtMs - startedAtMs), elapsedSeconds: Math.max(0, Math.round((finishedAtMs - startedAtMs) / 1000)),
    timedOut, assignments, totalScore: assignments.reduce((sum, assignment) => sum + assignment.scoreValue, 0), resultHash: hashMockResult(assignments),
  };
  return { accepted: true, duplicate: false, leaderboardEligible: false, resultId: `mock-result-${Date.now()}`, result };
}

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, displayName: "El Muro", totalScore: 104, elapsedSeconds: 76 },
  { rank: 2, displayName: "RangoLoco", totalScore: 129, elapsedSeconds: 82 },
  { rank: 3, displayName: "Tiki Taka", totalScore: 171, elapsedSeconds: 91 },
];

export const mockGameRepository: GameRepository = {
  getCurrentUser: async () => null,
  login: async () => { throw new RepositoryError("Backend unavailable", "offline"); },
  register: async () => { throw new RepositoryError("Backend unavailable", "offline"); },
  logout: async () => undefined,
  getGoogleAuthStatus: async () => false,
  getDailyChallenge: async () => mockDailyChallenge,
  startGame: async (challengeId) => ({ id: `mock-game-${Date.now()}`, challengeId, status: "active", startedAt: new Date().toISOString(), deadlineAt: new Date(Date.now() + mockDailyChallenge.timeLimitSeconds * 1000).toISOString(), currentOrdinal: 0, sessionToken: `mock-session-${Date.now()}`, challenge: mockDailyChallenge }),
  submitDecision: async (session, decision, previousAssignments) => {
    const entity = session.challenge.entities[decision.ordinal];
    const scoreValue = entity?.scores[decision.categorySlug] ?? 100;
    const best = session.challenge.categories
      .filter((category) => entity?.scores[category.slug] !== undefined)
      .sort((left, right) => (entity?.scores[left.slug] ?? 100) - (entity?.scores[right.slug] ?? 100))[0];
    return { assignment: { ...decision, scoreValue }, selectedRank: scoreValue, bestCategorySlug: best?.slug ?? decision.categorySlug, bestRank: best ? entity?.scores[best.slug] ?? null : null, complete: previousAssignments.length + 1 >= session.challenge.entities.length };
  },
  submitResult: async (session, assignments) => mockResult(session, assignments),
  expireGame: async (session, knownAssignments = []) => {
    const used = new Set(knownAssignments.map((assignment) => assignment.categorySlug));
    const remainingCategories = session.challenge.categories.filter((category) => !used.has(category.slug));
    const claims = [...knownAssignments];
    session.challenge.entities.slice(knownAssignments.length).forEach((entity, index) => {
      const categoryIndex = remainingCategories.findIndex((category) => !category.entityType || category.entityType === entity.entityType);
      const category = categoryIndex >= 0 ? remainingCategories.splice(categoryIndex, 1)[0] : undefined;
      if (category) claims.push({ ordinal: entity.ordinal ?? knownAssignments.length + index, entityId: entity.id, categorySlug: category.slug, timedOut: true });
    });
    return mockResult(session, claims, true);
  },
  getLeaderboard: async (challengeId) => challengeId === mockDailyChallenge.id ? mockLeaderboard : [],
  createDuel: async (challengeId) => ({ id: `mock-duel-${challengeId}`, code: "MOCK90", status: "open", challengeId, expiresAt: new Date(Date.now() + 604800000).toISOString(), joinable: true, challenge: mockDailyChallenge, participantToken: "mock-participant" }),
  getDuel: async () => ({ id: "mock-duel", code: "MOCK90", status: "open", challengeId: mockDailyChallenge.id, expiresAt: new Date(Date.now() + 604800000).toISOString(), joinable: true, challenge: mockDailyChallenge, participants: [{ slot: 1, status: "active", hasResult: false, totalScore: null, elapsedSeconds: null, timedOut: null }] }),
  joinDuel: async () => ({ id: "mock-duel", code: "MOCK90", status: "active", challengeId: mockDailyChallenge.id, expiresAt: new Date(Date.now() + 604800000).toISOString(), joinable: false, challenge: mockDailyChallenge, participantToken: "mock-participant-2" }),
  submitDuelResult: async (_code, _token, assignments) => mockResult({ id: "mock-duel-game", challengeId: mockDailyChallenge.id, status: "active", startedAt: new Date(Date.now() - 1000).toISOString(), deadlineAt: new Date(Date.now() + (mockDailyChallenge.timeLimitSeconds - 1) * 1000).toISOString(), currentOrdinal: 0, sessionToken: "mock", challenge: mockDailyChallenge }, assignments, assignments.some((assignment) => assignment.timedOut)),
  replayDuel: async () => ({ id: "mock-duel-replay", code: "MOCK91", status: "open", challengeId: mockDailyChallenge.id, expiresAt: new Date(Date.now() + 604800000).toISOString(), joinable: true, challenge: mockDailyChallenge, participantToken: "mock-replay" }),
};
