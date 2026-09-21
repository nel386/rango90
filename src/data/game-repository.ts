import type { MockChallenge, MockEntity, RuntimeMode } from "./game-types";

export type AssignmentClaim = { ordinal: number; entityId: string; categorySlug: string; timedOut?: boolean };
export type DecisionFeedback = {
  assignment: AssignmentClaim & { scoreValue: number };
  selectedRank: number | null;
  bestCategorySlug: string;
  bestRank: number | null;
  complete: boolean;
};
export type OfficialAssignment = AssignmentClaim & { scoreValue: number };
export type GameResult = {
  challengeId: string; sourceVersion: string; challengeSha256?: string; engineVersion: string; startedAtMs: number; finishedAtMs: number;
  elapsedMilliseconds: number; elapsedSeconds: number; timedOut: boolean; assignments: OfficialAssignment[]; totalScore: number; resultHash: string;
};
export type GameSession = {
  id: string; challengeId: string; status: "active" | "completed" | "expired" | "abandoned";
  startedAt: string; deadlineAt: string; currentOrdinal: number; sessionToken: string; challenge: MockChallenge;
};
export type ResultResponse = { accepted: boolean; duplicate: boolean; leaderboardEligible: boolean; resultId: string; result: GameResult };
export type LeaderboardEntry = { rank: number; playerId?: string; displayName: string; totalScore: number; elapsedSeconds?: number; timedOut?: boolean };
export type CategoryRankingEntry = {
  rank: number;
  entityId: string;
  canonicalName: string;
  rawValue: number;
  scoreValue: number;
  tieGroup: number | null;
  imageUrl?: string;
  imageStatus: "licensed" | "fallback" | "unavailable";
  reviewStatus: "approved" | "pending" | "rejected" | "missing";
  rightsStatus: "approved" | "review_required" | "rejected" | "missing";
  isPublishable: boolean;
  playable: boolean;
  imageSourceUrl?: string;
  imageLicenseName?: string;
  snapshotId: string;
  dataVersion?: string;
  generatedAt?: string;
  sources?: Array<{ sourceKey: string; sourceCaptureId: string; sourceRecordId: string; sourceUrl?: string; locator?: string; contentSha256?: string }>;
};
export type CategoryRankingDataset = "historical_base" | "active_season_weekly" | "active_edition_weekly";
export type CategoryRanking = {
  category: { slug: string; labelEs: string; labelEn: string };
  rankingScope: "historical_snapshot" | "active_season_weekly";
  snapshotId: string;
  mode: RuntimeMode;
  status: "official" | "provisional";
  entries: CategoryRankingEntry[];
  dataset?: CategoryRankingDataset;
  scopeLabelEs?: string;
  scopeLabelEn?: string;
  coverageComplete?: boolean;
  scope?: "active_season" | "historical";
  season?: number;
  coverageEstimated?: number | null;
  provisionalWarningEs?: string;
  provisionalWarningEn?: string;
  source?: string;
  degraded?: boolean;
  updateDate?: string;
  factCount?: number;
  sourceCount?: number;
  dataVersion?: string;
  contentSha256?: string;
  generatedAt?: string;
  redTypesDifferentiated?: boolean;
  scopeStatus?: "complete_scope" | "complete" | "provisional_active_season" | "partial" | "partial_missing_provider_data" | "quota_insufficient" | "snapshot_preserved" | "ranking_not_available";
  activeSeasonStatus?: "complete_scope" | "provisional_active_season" | "partial_missing_provider_data" | "quota_insufficient" | "provider_unavailable";
  seasonInProgress?: boolean;
  observedFacts?: number;
  observedPages?: number | null;
  includedCompetitions?: string[];
  excludedCompetitions?: string[];
  blockReason?: string | null;
  fixtureOnly?: boolean;
};
export type RankingCatalogStatus = "available_lab" | "provisional_lab" | "partial_scope" | "ranking_not_available" | "candidate_not_sufficient" | "official_not_ready" | "quota_insufficient" | "provider_unavailable";
export type RankingCategoryOption = {
  slug: string;
  labelEs: string;
  labelEn: string;
  descriptionEs?: string;
  descriptionEn?: string;
  scope?: string;
  availability: "official" | "provisional";
  status: RankingCatalogStatus;
  selectable: boolean;
  reason?: string | null;
  lastUpdated?: string | null;
  factCount?: number | null;
  players?: number | null;
  provisional?: boolean;
  allowsHistorical?: boolean;
  allowsActiveSeason?: boolean;
  allowsOfficial?: boolean;
};
export type DuelParticipant = { slot: number; status: string; joinedAt?: string; hasResult: boolean; totalScore: number | null; elapsedSeconds: number | null; timedOut: boolean | null };
export type DuelState = {
  id: string; code: string; status: "open" | "active" | "completed" | "expired"; challengeId: string; expiresAt: string; joinable: boolean;
  challenge?: MockChallenge; participants?: DuelParticipant[]; participantToken?: string;
};
export type AuthUser = { id: string; email: string; displayName: string; emailVerified: boolean };
export type RepositoryErrorKind = "offline" | "timeout" | "auth" | "session" | "not_found" | "expired" | "conflict" | "invalid" | "server";

export type RequestOptions = { signal?: AbortSignal; timeoutMs?: number };

export class RepositoryError extends Error {
  constructor(message: string, readonly kind: RepositoryErrorKind, readonly status?: number, readonly code?: string, readonly details?: unknown) {
    super(message); this.name = "RepositoryError";
  }
}

export type RepositoryErrorView = "official_not_ready" | "official_test_only" | "ranking_not_available" | "timeout" | "offline" | "generic";

export function classifyRepositoryError(error: Pick<RepositoryError, "code" | "kind" | "status"> | null): RepositoryErrorView {
  if (!error) return "generic";
  if (error.code === "official_not_ready") return "official_not_ready";
  if (error.code === "official_test_challenge_rejected") return "official_test_only";
  if (error.code === "ranking_not_available") return "ranking_not_available";
  if (error.kind === "timeout" || error.code === "request_timeout" || error.status === 408) return "timeout";
  if (error.kind === "offline" || error.code === "request_cancelled") return "offline";
  return "generic";
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function validateDecisionFeedbackResponse(raw: unknown, session: GameSession, decision: AssignmentClaim): DecisionFeedback {
  if (!isRecord(raw) || !isRecord(raw.assignment)
    || raw.assignment.ordinal !== decision.ordinal
    || raw.assignment.entityId !== decision.entityId
    || raw.assignment.categorySlug !== decision.categorySlug
    || typeof raw.assignment.scoreValue !== "number"
    || !Number.isFinite(raw.assignment.scoreValue)
    || !isNullableFiniteNumber(raw.selectedRank)
    || typeof raw.bestCategorySlug !== "string"
    || !isNullableFiniteNumber(raw.bestRank)
    || typeof raw.complete !== "boolean") {
    throw new RepositoryError("The decision feedback response is invalid", "invalid", 502, "feedback_invalid");
  }

  const bestCategory = session.challenge.categories.find((category) => category.slug === raw.bestCategorySlug);
  if (!bestCategory || (bestCategory.entityType && bestCategory.entityType !== session.challenge.entities[decision.ordinal]?.entityType)) {
    throw new RepositoryError("The decision feedback category is not part of the active challenge", "invalid", 502, "feedback_category_invalid");
  }

  return {
    assignment: {
      ordinal: decision.ordinal,
      entityId: decision.entityId,
      categorySlug: decision.categorySlug,
      scoreValue: raw.assignment.scoreValue
    },
    selectedRank: raw.selectedRank,
    bestCategorySlug: bestCategory.slug,
    bestRank: raw.bestRank,
    complete: raw.complete
  };
}

export type RuntimeConfig = {
  runtimeMode: RuntimeMode;
  modeLabel: string;
  provisionalDataAllowed: boolean;
  officialPublicationOnly: boolean;
};

export interface GameRepository {
  getRuntimeConfig(options?: RequestOptions): Promise<RuntimeConfig>;
  getCurrentUser(): Promise<AuthUser | null>;
  login(email: string, password: string): Promise<AuthUser>;
  register(email: string, password: string, displayName: string): Promise<AuthUser>;
  logout(): Promise<void>;
  getGoogleAuthStatus(): Promise<boolean>;
  getDailyChallenge(options?: RequestOptions): Promise<MockChallenge>;
  startGame(challengeId: string): Promise<GameSession>;
  submitDecision(session: GameSession, decision: AssignmentClaim, previousAssignments: AssignmentClaim[]): Promise<DecisionFeedback>;
  submitResult(session: GameSession, assignments: AssignmentClaim[]): Promise<ResultResponse>;
  expireGame(session: GameSession, knownAssignments?: AssignmentClaim[]): Promise<ResultResponse>;
  getLeaderboard(challengeId: string): Promise<LeaderboardEntry[]>;
  getCategoryRanking(categorySlug: string, dataset?: CategoryRankingDataset, competition?: string): Promise<CategoryRanking>;
  getRankingCategories(options?: RequestOptions): Promise<RankingCategoryOption[]>;
  createDuel(challengeId: string): Promise<DuelState>;
  getDuel(code: string): Promise<DuelState>;
  joinDuel(code: string): Promise<DuelState>;
  submitDuelResult(code: string, participantToken: string, assignments: AssignmentClaim[]): Promise<ResultResponse>;
  replayDuel(code: string, participantToken: string): Promise<DuelState>;
}

type ApiChallenge = {
  id: string; kind: "daily" | "weekly" | "duel"; challengeDate: string | null; sourceVersion: string; challengeSha256: string; engineVersion: string; timeLimitSeconds: number; scoreCap: number;
  testOnly?: boolean;
  runtimeMode?: RuntimeMode;
  provisionalData?: boolean;
  categories: Array<{ ordinal: number; id: string; rankingSnapshotId: string; slug: string; entityType?: string; labelEs: string; labelEn: string }>;
  decisions: Array<{ ordinal: number; entityId: string; name: string; shortName: string | null; entityType: string; imageUrl?: string; imageStatus?: "licensed" | "unlicensed" | "fallback" }>;
};

function resolveApiAssetUrl(baseUrl: string, path?: string): string | undefined {
  if (!path) return undefined;
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

function normalizeChallenge(raw: ApiChallenge, baseUrl = ""): MockChallenge {
  const provisional = raw.provisionalData === true || raw.testOnly === true || raw.runtimeMode === "lab";
  return {
    id: raw.id, kind: raw.kind === "duel" ? "duel" : "daily",
    title: { es: "Reto diario", en: "Daily challenge" },
    subtitle: provisional
      ? { es: "Modo de prueba con datos reales y fallback visual.", en: "Test mode with real data and fallback visuals." }
      : { es: "Una combinación publicada y auditada.", en: "A published and audited combination." },
    entityType: raw.decisions[0]?.entityType === "club" || raw.decisions[0]?.entityType === "national_team" ? raw.decisions[0].entityType : "player",
    timeLimitSeconds: raw.timeLimitSeconds, qualificationScore: 250, scoreCap: raw.scoreCap, sourceVersion: raw.sourceVersion, challengeSha256: raw.challengeSha256, engineVersion: raw.engineVersion, difficulty: "balanced",
    runtimeMode: raw.runtimeMode,
    provisionalData: provisional,
    categories: raw.categories.map((category) => ({ slug: category.slug, code: category.slug === "club-career-yellow-cards" ? "AM" : category.slug === "club-career-red-cards" ? "RO" : category.slug.includes("champions-league") ? "CL" : category.slug === "world-cup-goals" ? "WC" : "90", id: category.id, ordinal: category.ordinal, entityType: category.entityType === "club" || category.entityType === "national_team" ? category.entityType : "player", label: { es: category.labelEs, en: category.labelEn }, competitionLabel: { es: category.slug.includes("champions-league") ? "UEFA · Champions League" : category.slug === "world-cup-goals" ? "FIFA · Mundial" : category.slug.includes("club-career") ? "Clubes · global" : "Carrera · global", en: category.slug.includes("champions-league") ? "UEFA · Champions League" : category.slug === "world-cup-goals" ? "FIFA · World Cup" : category.slug.includes("club-career") ? "Clubs · global" : "Career · global" }, definition: { es: "Ranking publicado para este reto.", en: "Published ranking for this challenge." } })),
    entities: raw.decisions.map((decision) => ({ id: decision.entityId, name: decision.name, shortName: decision.shortName ?? decision.name.slice(0, 2).toUpperCase(), entityType: decision.entityType === "club" || decision.entityType === "national_team" ? decision.entityType : "player", position: "", imageUrl: resolveApiAssetUrl(baseUrl, decision.imageUrl), imageFallbackUrl: resolveApiAssetUrl(baseUrl, `/v1/media/${encodeURIComponent(decision.entityId)}/fallback`), imageStatus: decision.imageStatus, ordinal: decision.ordinal, scores: {} })),
  };
}

function errorKind(status: number, code?: string): RepositoryErrorKind {
  if (status === 401 || status === 403 || code?.includes("auth") || code?.includes("forbidden")) return "auth";
  if (code?.includes("session") || code?.includes("deadline") || code === "time_expired" || code === "time_not_expired") return "session";
  if (status === 404 || code?.includes("not_found")) return "not_found";
  if (status === 410 || code?.includes("expired")) return "expired";
  if (status === 409 || code?.includes("conflict")) return "conflict";
  if (status === 422 || code?.includes("invalid")) return "invalid";
  return status >= 500 ? "server" : "offline";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new RepositoryError(`Invalid game session: ${field}`, "invalid", 502, "session_invalid");
  return value;
}

export function validateGameSessionResponse(raw: unknown, baseUrl = ""): GameSession {
  if (!isRecord(raw) || !isRecord(raw.game) || !isRecord(raw.challenge)) throw new RepositoryError("The game session response is incomplete", "invalid", 502, "session_invalid");
  const game = raw.game;
  const challenge = raw.challenge as ApiChallenge;
  const id = requiredString(game.id, "game.id");
  const challengeId = requiredString(game.challengeId, "game.challengeId");
  const sessionToken = requiredString(raw.sessionToken, "sessionToken");
  const startedAt = requiredString(game.startedAt, "game.startedAt");
  const deadlineAt = requiredString(game.deadlineAt, "game.deadlineAt");
  if (challengeId !== challenge.id || Number.isNaN(Date.parse(startedAt)) || Number.isNaN(Date.parse(deadlineAt)) || Date.parse(deadlineAt) <= Date.parse(startedAt)) {
    throw new RepositoryError("The game session dates or challenge do not match", "invalid", 502, "session_invalid");
  }
  if (game.status !== "active" || !Array.isArray(challenge.decisions) || !Array.isArray(challenge.categories) || challenge.decisions.length !== challenge.categories.length) {
    throw new RepositoryError("The game session cannot be started", "invalid", 502, "session_invalid");
  }
  const normalizedChallenge = normalizeChallenge(challenge, baseUrl);
  if (normalizedChallenge.categories.length !== 7 || normalizedChallenge.entities.length !== 7 || normalizedChallenge.runtimeMode === undefined) {
    throw new RepositoryError("The game session challenge is incomplete", "invalid", 502, "session_invalid");
  }
  return { id, challengeId, status: "active", startedAt, deadlineAt, currentOrdinal: typeof game.currentOrdinal === "number" ? game.currentOrdinal : 0, sessionToken, challenge: normalizedChallenge };
}

export class HttpGameRepository implements GameRepository {
  constructor(private readonly baseUrl: string) {}
  private dailyChallengeRequest: Promise<MockChallenge> | null = null;

  private async request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 15_000;
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    if (options.signal?.aborted || init.signal?.aborted) controller.abort();
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    init.signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = globalThis.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, { ...init, credentials: "include", signal: controller.signal, headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers } });
      const body = await response.json().catch(() => ({})) as { error?: string; message?: string; [key: string]: unknown };
      if (!response.ok) throw new RepositoryError(body.message ?? body.error ?? "Request failed", errorKind(response.status, body.error), response.status, body.error, body.details);
      return body as T;
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      if (timedOut) throw new RepositoryError("The request timed out", "timeout", 408, "request_timeout");
      if (options.signal?.aborted || init.signal?.aborted) throw new RepositoryError("The request was cancelled", "offline", 499, "request_cancelled");
      throw new RepositoryError("Backend unavailable", "offline");
    } finally {
      globalThis.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
      init.signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  async getCurrentUser() {
    const response = await this.request<{ user: AuthUser | null }>("/v1/auth/session");
    return response.user;
  }

  async getRuntimeConfig(options?: RequestOptions) {
    return this.request<RuntimeConfig>("/v1/config", {}, options);
  }

  async login(email: string, password: string) {
    const response = await this.request<{ user: AuthUser }>("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    return response.user;
  }

  async register(email: string, password: string, displayName: string) {
    const response = await this.request<{ user: AuthUser }>("/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) });
    return response.user;
  }

  async logout() {
    await this.request<{ ok: boolean }>("/v1/auth/logout", { method: "POST", body: "{}" });
  }

  async getGoogleAuthStatus() {
    const response = await this.request<{ configured: boolean }>("/v1/auth/google/status");
    return response.configured;
  }

  async getDailyChallenge(options?: RequestOptions) {
    // A caller-owned AbortSignal must never cancel or poison a request shared
    // with a later retry. Only signal-less callers use the small in-flight
    // deduplication window.
    const load = async () => {
      const response = await this.request<{ challenge: ApiChallenge }>("/v1/challenges/daily", {}, options);
      const runtime = response.challenge.runtimeMode ? { runtimeMode: response.challenge.runtimeMode } as RuntimeConfig : await this.getRuntimeConfig(options);
      const challenge = normalizeChallenge(response.challenge, this.baseUrl);
      challenge.runtimeMode = runtime.runtimeMode;
      challenge.provisionalData = response.challenge.provisionalData === true || response.challenge.testOnly === true || runtime.runtimeMode === "lab";
      if (challenge.categories.length !== 7 || challenge.entities.length !== 7) {
        throw new RepositoryError("The published challenge is incomplete", "invalid", 422, "challenge_invalid");
      }
      return challenge;
    };
    if (options?.signal) return load();
    if (this.dailyChallengeRequest) return this.dailyChallengeRequest;
    const request = load();
    const sharedRequest = request.finally(() => { if (this.dailyChallengeRequest === sharedRequest) this.dailyChallengeRequest = null; });
    this.dailyChallengeRequest = sharedRequest;
    return sharedRequest;
  }

  async startGame(challengeId: string) {
    const response = await this.request<{ sessionToken: string; game: Omit<GameSession, "sessionToken" | "challenge">; challenge: ApiChallenge }>("/v1/games", { method: "POST", body: JSON.stringify({ challengeId }) });
    return validateGameSessionResponse(response, this.baseUrl);
  }

  async submitDecision(session: GameSession, decision: AssignmentClaim, previousAssignments: AssignmentClaim[]) {
    const response = await this.request<unknown>(`/v1/games/${encodeURIComponent(session.id)}/decision`, { method: "POST", headers: { "Idempotency-Key": `rango90-decision-${session.id}-${decision.ordinal}` }, body: JSON.stringify({ sessionToken: session.sessionToken, decision, previousAssignments }) });
    return validateDecisionFeedbackResponse(response, session, decision);
  }

  async submitResult(session: GameSession, assignments: AssignmentClaim[]) {
    return this.request<ResultResponse>(`/v1/games/${encodeURIComponent(session.id)}/result`, { method: "POST", headers: { "Idempotency-Key": `rango90-${session.id}-${assignments.length}` }, body: JSON.stringify({ sessionToken: session.sessionToken, result: { assignments } }) });
  }

  async expireGame(session: GameSession, knownAssignments = []) {
    const payload = knownAssignments.length > 0 ? { sessionToken: session.sessionToken, result: { assignments: knownAssignments } } : { sessionToken: session.sessionToken };
    return this.request<ResultResponse>(`/v1/games/${encodeURIComponent(session.id)}/expire`, { method: "POST", body: JSON.stringify(payload) });
  }

  async getLeaderboard(challengeId: string) {
    const response = await this.request<{ entries: LeaderboardEntry[] }>(`/v1/challenges/${encodeURIComponent(challengeId)}/leaderboard?limit=100`);
    return response.entries;
  }

  async getCategoryRanking(categorySlug: string, dataset?: CategoryRankingDataset, competition?: string) {
    const query = new URLSearchParams({ limit: "200" });
    if (dataset) query.set("dataset", dataset);
    if (competition) query.set("competition", competition);
    if (categorySlug === "uefa-champions-league-assists") query.set("scope", dataset === "historical_base" ? "historical" : "active_season");
    const response = await this.request<{ category: string; categoryLabelEs?: string; categoryLabelEn?: string; snapshotId: string; rankingScope?: "historical_snapshot" | "active_season_weekly"; mode?: RuntimeMode; status?: "official" | "provisional"; entries: Array<Record<string, unknown>>; dataset?: CategoryRankingDataset; scope?: "active_season" | "historical"; season?: number; scopeLabelEs?: string; scopeLabelEn?: string; coverageComplete?: boolean; coverageEstimated?: number | null; provisionalWarningEs?: string; provisionalWarningEn?: string; source?: string; degraded?: boolean; updateDate?: string; factCount?: number; sourceCount?: number; dataVersion?: string; contentSha256?: string; generatedAt?: string; fixtureOnly?: boolean; redTypesDifferentiated?: boolean; scopeStatus?: CategoryRanking["scopeStatus"]; activeSeasonStatus?: CategoryRanking["activeSeasonStatus"]; seasonInProgress?: boolean; observedFacts?: number; observedPages?: number | null; includedCompetitions?: string[]; excludedCompetitions?: string[]; blockReason?: string | null }>(`/v1/rankings/${encodeURIComponent(categorySlug)}?${query.toString()}`);
    if (!response.snapshotId || !Array.isArray(response.entries)) throw new RepositoryError("The category ranking response is invalid", "invalid", 502, "ranking_invalid");
    const entries: CategoryRankingEntry[] = response.entries.map((entry) => {
      const number = (value: unknown) => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
        return null;
      };
      const rank = number(entry.rank);
      const rawValue = number(entry.raw_value);
      const scoreValue = number(entry.score_value);
      if (rank === null || rawValue === null || scoreValue === null || typeof entry.entity_id !== "string" || typeof entry.canonical_name !== "string") throw new RepositoryError("The category ranking contains an invalid row", "invalid", 502, "ranking_invalid");
      const status = (entry.imageStatus ?? entry.image_status) === "licensed" || (entry.imageStatus ?? entry.image_status) === "fallback" ? (entry.imageStatus ?? entry.image_status) as "licensed" | "fallback" : "unavailable";
      const reviewStatus = (entry.reviewStatus ?? entry.review_status) === "approved" || (entry.reviewStatus ?? entry.review_status) === "pending" || (entry.reviewStatus ?? entry.review_status) === "rejected" ? (entry.reviewStatus ?? entry.review_status) as "approved" | "pending" | "rejected" : "missing";
      const rightsStatus = (entry.rightsStatus ?? entry.rights_status) === "approved" || (entry.rightsStatus ?? entry.rights_status) === "review_required" || (entry.rightsStatus ?? entry.rights_status) === "rejected" ? (entry.rightsStatus ?? entry.rights_status) as "approved" | "review_required" | "rejected" : "missing";
      return { rank, entityId: entry.entity_id, canonicalName: entry.canonical_name, rawValue, scoreValue, tieGroup: number(entry.tie_group), imageUrl: typeof entry.image_url === "string" ? resolveApiAssetUrl(this.baseUrl, entry.image_url) : undefined, imageStatus: status, reviewStatus, rightsStatus, isPublishable: (entry.isPublishable ?? entry.is_publishable) === true, playable: entry.playable === true, imageSourceUrl: typeof entry.image_source_url === "string" ? entry.image_source_url : undefined, imageLicenseName: typeof entry.image_license_name === "string" ? entry.image_license_name : undefined, snapshotId: response.snapshotId, dataVersion: typeof entry.data_version === "string" ? entry.data_version : undefined, generatedAt: typeof entry.generated_at === "string" ? entry.generated_at : undefined, sources: Array.isArray(entry.sources) ? entry.sources as CategoryRankingEntry["sources"] : undefined };
    });
    return { category: { slug: typeof response.category === "string" ? response.category : categorySlug, labelEs: typeof response.categoryLabelEs === "string" ? response.categoryLabelEs : (typeof response.entries[0]?.label_es === "string" ? response.entries[0].label_es : categorySlug), labelEn: typeof response.categoryLabelEn === "string" ? response.categoryLabelEn : (typeof response.entries[0]?.label_en === "string" ? response.entries[0].label_en : categorySlug) }, rankingScope: response.rankingScope ?? "historical_snapshot", snapshotId: response.snapshotId, mode: response.mode ?? "official", status: response.status ?? "official", entries, dataset: response.dataset, scopeLabelEs: response.scopeLabelEs, scopeLabelEn: response.scopeLabelEn, coverageComplete: response.coverageComplete, scope: response.scope, season: response.season, coverageEstimated: response.coverageEstimated, provisionalWarningEs: response.provisionalWarningEs, provisionalWarningEn: response.provisionalWarningEn, source: response.source, degraded: response.degraded, updateDate: response.updateDate, factCount: response.factCount, sourceCount: response.sourceCount, dataVersion: response.dataVersion, contentSha256: response.contentSha256, generatedAt: response.generatedAt, fixtureOnly: response.fixtureOnly, redTypesDifferentiated: response.redTypesDifferentiated, scopeStatus: response.scopeStatus, activeSeasonStatus: response.activeSeasonStatus, seasonInProgress: response.seasonInProgress, observedFacts: response.observedFacts, observedPages: response.observedPages, includedCompetitions: Array.isArray(response.includedCompetitions) ? response.includedCompetitions.filter((value): value is string => typeof value === "string") : undefined, excludedCompetitions: Array.isArray(response.excludedCompetitions) ? response.excludedCompetitions.filter((value): value is string => typeof value === "string") : undefined, blockReason: typeof response.blockReason === "string" ? response.blockReason : null };
  }

  async getRankingCategories(options?: RequestOptions) {
    const response = await this.request<{ categories: Array<Record<string, unknown>> }>("/v1/rankings/catalog", {}, options);
    if (!Array.isArray(response.categories)) throw new RepositoryError("The ranking categories response is invalid", "invalid", 502, "ranking_invalid");
    const validStatuses = new Set<RankingCatalogStatus>(["available_lab", "provisional_lab", "partial_scope", "ranking_not_available", "candidate_not_sufficient", "official_not_ready", "quota_insufficient", "provider_unavailable"]);
    const baseCategories = response.categories.flatMap((category) => {
      if (typeof category.slug !== "string" || typeof category.labelEs !== "string" || typeof category.labelEn !== "string" || typeof category.status !== "string" || !validStatuses.has(category.status as RankingCatalogStatus)) return [];
      const status = category.status as RankingCatalogStatus;
      const isSelectable = category.selectable !== false && ["available_lab", "provisional_lab", "partial_scope"].includes(status);
      return [{
        slug: category.slug,
        labelEs: category.labelEs,
        labelEn: category.labelEn,
        descriptionEs: typeof category.descriptionEs === "string" ? category.descriptionEs : undefined,
        descriptionEn: typeof category.descriptionEn === "string" ? category.descriptionEn : undefined,
        scope: typeof category.scope === "string" ? category.scope : undefined,
        availability: isSelectable ? "provisional" as const : "official" as const,
        status,
        selectable: isSelectable,
        reason: typeof category.blockReason === "string" ? category.blockReason : null,
        lastUpdated: typeof category.lastUpdated === "string" ? category.lastUpdated : null,
        factCount: typeof category.factCount === "number" ? category.factCount : null,
        players: typeof category.players === "number" ? category.players : null,
        provisional: category.provisional === true,
        allowsHistorical: category.allowsHistorical === true,
        allowsActiveSeason: category.allowsActiveSeason === true,
        allowsOfficial: category.allowsOfficial === true,
      }];
    });
    const cardScopes = [{ value: "39", es: "Premier League", en: "Premier League", status: "available_lab" as const }, { value: "140", es: "La Liga", en: "La Liga", status: "available_lab" as const }, { value: "135", es: "Serie A", en: "Serie A", status: "available_lab" as const }, { value: "78", es: "Bundesliga", en: "Bundesliga", status: "quota_insufficient" as const }, { value: "61", es: "Ligue 1", en: "Ligue 1", status: "quota_insufficient" as const }, { value: "94", es: "Primeira Liga", en: "Primeira Liga", status: "quota_insufficient" as const }];
    return baseCategories.flatMap((category) => category.slug === "club-career-yellow-cards" || category.slug === "club-career-red-cards"
      ? [category, ...cardScopes.map((scope) => ({ ...category, slug: `${category.slug}:${scope.value}`, labelEs: `${category.labelEs} — ${scope.es}`, labelEn: `${category.labelEn} — ${scope.en}`, status: scope.status, selectable: scope.status === "available_lab", reason: scope.status === "quota_insufficient" ? "quota_insufficient: cuota API-Football agotada; se conserva el último snapshot válido." : null }))]
      : [category]);
  }

  async createDuel(challengeId: string) {
    const response = await this.request<{ duel: Omit<DuelState, "joinable" | "participantToken">; participantToken: string }>("/v1/duels", { method: "POST", body: JSON.stringify({ challengeId }) });
    const duel = await this.getDuel(response.duel.code);
    return { ...duel, id: response.duel.id, challengeId: response.duel.challengeId, expiresAt: response.duel.expiresAt, participantToken: response.participantToken };
  }

  async getDuel(code: string) {
    const response = await this.request<{ duel: Omit<DuelState, "challenge">; challenge: ApiChallenge; participants: DuelParticipant[] }>(`/v1/duels/${encodeURIComponent(code)}`);
    return { ...response.duel, challenge: normalizeChallenge(response.challenge, this.baseUrl), participants: response.participants };
  }

  async joinDuel(code: string) {
    const response = await this.request<{ duelId: string; challengeId: string; participantToken: string }>(`/v1/duels/${encodeURIComponent(code)}/join`, { method: "POST", body: "{}" });
    const duel = await this.getDuel(code);
    return { ...duel, id: response.duelId, challengeId: response.challengeId, participantToken: response.participantToken };
  }

  async submitDuelResult(code: string, participantToken: string, assignments: AssignmentClaim[]) {
    return this.request<ResultResponse>(`/v1/duels/${encodeURIComponent(code)}/result`, { method: "POST", headers: { "Idempotency-Key": `rango90-duel-${code}-${assignments.length}` }, body: JSON.stringify({ participantToken, result: { assignments } }) });
  }

  async replayDuel(code: string, participantToken: string) {
    const response = await this.request<{ duel: Omit<DuelState, "joinable" | "participantToken">; participantToken: string }>(`/v1/duels/${encodeURIComponent(code)}/replay`, { method: "POST", body: JSON.stringify({ participantToken }) });
    const duel = await this.getDuel(response.duel.code);
    return { ...duel, id: response.duel.id, challengeId: response.duel.challengeId, expiresAt: response.duel.expiresAt, participantToken: response.participantToken };
  }
}

export function createGameRepository(): GameRepository {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (baseUrl) return new HttpGameRepository(baseUrl);
  const unavailable = async (): Promise<never> => {
    throw new RepositoryError("Frontend API is not configured", "server", 500, "api_not_configured");
  };
  return {
    getRuntimeConfig: unavailable,
    getCurrentUser: unavailable,
    login: unavailable,
    register: unavailable,
    logout: unavailable,
    getGoogleAuthStatus: unavailable,
    getDailyChallenge: unavailable,
    startGame: unavailable,
    submitDecision: unavailable,
    submitResult: unavailable,
    expireGame: unavailable,
    getLeaderboard: unavailable,
    getCategoryRanking: unavailable,
    getRankingCategories: unavailable,
    createDuel: unavailable,
    getDuel: unavailable,
    joinDuel: unavailable,
    submitDuelResult: unavailable,
    replayDuel: unavailable,
  };
}

export function getEntityById(challenge: MockChallenge, entityId: string): MockEntity | undefined {
  return challenge.entities.find((entity) => entity.id === entityId);
}
