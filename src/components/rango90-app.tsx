"use client";

/* Dynamic media comes from the API and is already served as an unoptimized local asset. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import { createGameRepository, RepositoryError, type AuthUser, type CategoryRanking, type CategoryRankingDataset, type DecisionFeedback, type DuelState, type GameResult, type GameSession, type LeaderboardEntry, type RankingCategoryOption, type RuntimeConfig } from "@/data/game-repository";
import type { Locale, MockCategory, MockChallenge, MockEntity } from "@/data/game-types";
import { canStartGame, canSubmitDecision, transitionGameFlow, type GameFlowEvent, type GameFlowState } from "@/data/game-flow";
import { imageRequestIsCurrent, preloadImage } from "@/data/image-preload";
import { nowRuntimeMetric, recordRuntimeMetric } from "@/data/runtime-metrics";
import { secondsUntilDeadline } from "@/data/game-clock";

type View = "home" | "game" | "result" | "ranking" | "category-ranking" | "duels" | "account";
type GamePhase = "playing" | "feedback" | "finished" | "abandoned";
type ChallengeLoadState = "ready" | "loading" | "error";
type Assignment = { ordinal: number; entity: MockEntity; category: MockCategory; score: number | null; timedOut?: boolean; feedback?: DecisionFeedback };
type GameMode = "daily" | "duel";
type DuelToken = { code: string; token: string; slot: number; startedAt?: string; deadlineAt?: string };
type ActiveDuel = DuelToken & { startedAt: string; deadlineAt: string; challenge: MockChallenge };
const gameRepository = createGameRepository();
const fallbackChallenge: MockChallenge = {
  id: "unloaded-challenge",
  kind: "daily",
  title: { es: "", en: "" },
  subtitle: { es: "", en: "" },
  entityType: "player",
  timeLimitSeconds: 90,
  qualificationScore: 250,
  categories: [],
  entities: [],
  sourceVersion: "unloaded",
  difficulty: "balanced",
};

function duelTokenKey(code: string) {
  return `rango90:duel-token:${code}`;
}

function saveDuelToken(value: DuelToken) {
  try {
    window.sessionStorage.setItem(duelTokenKey(value.code), JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing; the current session still works.
  }
}

function readDuelToken(code: string): DuelToken | null {
  try {
    const value = window.sessionStorage.getItem(duelTokenKey(code));
    if (!value) return null;
    const parsed = JSON.parse(value) as DuelToken;
    return parsed.code === code && typeof parsed.token === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function futureIso(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function secondsUntil(isoDate: string) {
  return secondsUntilDeadline(isoDate);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  document.body.appendChild(fallback);
  fallback.select();
  const copied = document.execCommand("copy");
  fallback.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

export function Rango90App({ locale }: { locale: Locale }) {
  const t = useTranslations("Game");
  const [initialDuelCode, setInitialDuelCode] = useState("");
  const [view, setView] = useState<View>("home");
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [gameMode, setGameMode] = useState<GameMode>("daily");
  const [challenge, setChallenge] = useState(fallbackChallenge);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [challengeLoadState, setChallengeLoadState] = useState<ChallengeLoadState>("loading");
  const [flowState, setFlowState] = useState<GameFlowState>("loading_challenge");
  const [secondsLeft, setSecondsLeft] = useState(fallbackChallenge.timeLimitSeconds);
  const [session, setSession] = useState<GameSession | null>(null);
  const [officialResult, setOfficialResult] = useState<GameResult | null>(null);
  const [repositoryError, setRepositoryError] = useState<RepositoryError | null>(null);
  const [entityIndex, setEntityIndex] = useState(0);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<DecisionFeedback | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);
  const [showCategoryInfo, setShowCategoryInfo] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardEntry[]>([]);
  const [leaderboardState, setLeaderboardState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [categoryRanking, setCategoryRanking] = useState<CategoryRanking | null>(null);
  const [rankingCategories, setRankingCategories] = useState<RankingCategoryOption[]>([]);
  const [categoryRankingState, setCategoryRankingState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [selectedRankingCategory, setSelectedRankingCategory] = useState("");
  const [selectedRankingDataset, setSelectedRankingDataset] = useState<CategoryRankingDataset>("active_season_weekly");
  const [submissionState, setSubmissionState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [leaderboardEligible, setLeaderboardEligible] = useState<boolean | null>(null);
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [duelCodeInput, setDuelCodeInput] = useState("");
  const [duelState, setDuelState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [duelMessage, setDuelMessage] = useState("");
  const [duelToken, setDuelToken] = useState<DuelToken | null>(null);
  const [activeDuel, setActiveDuel] = useState<ActiveDuel | null>(null);
  const [duelComparisonState, setDuelComparisonState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [submissionDuplicate, setSubmissionDuplicate] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [imageOverrides, setImageOverrides] = useState<Record<string, string | null>>({});
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const timeoutHandled = useRef(false);
  const submittedResultKey = useRef<string | null>(null);
  const expireRequestStarted = useRef(false);
  const secondsLeftRef = useRef(fallbackChallenge.timeLimitSeconds);
  const mountedRef = useRef(true);
  const challengeAbortRef = useRef<AbortController | null>(null);
  const challengeLoadGenerationRef = useRef(0);
  const startRequestStarted = useRef(false);
  const gameGenerationRef = useRef(0);
  const feedbackTimerRef = useRef<number | null>(null);
  const feedbackGenerationRef = useRef(0);
  const imageRequestIdRef = useRef(0);
  const imageAbortRef = useRef<AbortController | null>(null);
  const imageMetricStartedRef = useRef<number | null>(null);
  const firstPlayerMetricRecordedRef = useRef(false);
  const deadlineAtRef = useRef<string | null>(null);
  const decisionStartedAtRef = useRef<number | null>(null);

  const transitionFlow = useCallback((event: GameFlowEvent) => {
    setFlowState((current) => transitionGameFlow(current, event));
  }, []);

  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      challengeAbortRef.current?.abort();
      imageAbortRef.current?.abort();
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
      imageRequestIdRef.current += 1;
    };
  }, []);

  const loadDailyChallenge = useCallback(async () => {
    const generation = ++challengeLoadGenerationRef.current;
    challengeAbortRef.current?.abort();
    const controller = new AbortController();
    challengeAbortRef.current = controller;
    const startedAt = nowRuntimeMetric();
    setChallengeLoadState("loading");
    setRepositoryError(null);
    transitionFlow({ type: "LOAD_CHALLENGE" });
    try {
      const loadedChallenge = await gameRepository.getDailyChallenge({ signal: controller.signal });
      if (!mountedRef.current || generation !== challengeLoadGenerationRef.current) return;
      setChallenge(loadedChallenge);
      setSecondsLeft(loadedChallenge.timeLimitSeconds);
      deadlineAtRef.current = null;
      setImageOverrides({});
      setChallengeLoadState("ready");
      transitionFlow({ type: "CHALLENGE_READY" });
      recordRuntimeMetric("challenge_load", startedAt, { challengeId: loadedChallenge.id });
    } catch (error: unknown) {
      if (!mountedRef.current || generation !== challengeLoadGenerationRef.current || (error instanceof RepositoryError && error.code === "request_cancelled")) return;
      const normalized = error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline");
      setRepositoryError(normalized);
      setChallengeLoadState("error");
      transitionFlow({ type: "ERROR", officialNotReady: normalized.code === "official_not_ready" });
      recordRuntimeMetric("request_error", startedAt, { operation: "daily_challenge", code: normalized.code, kind: normalized.kind });
    }
  }, [transitionFlow]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => { void loadDailyChallenge(); }, 0);
    return () => {
      window.clearTimeout(kickoff);
      challengeAbortRef.current?.abort();
    };
  }, [loadDailyChallenge]);

  useEffect(() => {
    const updateConnection = () => setIsOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    gameRepository.getRuntimeConfig({ signal: controller.signal }).then((config) => {
      if (mountedRef.current) setRuntimeConfig(config);
    }).catch(() => {
      // The challenge response remains authoritative when the config endpoint
      // is temporarily unavailable.
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    gameRepository.getCurrentUser().then((user) => {
      if (active) setAuthUser(user);
    }).catch(() => {
      if (active) setAuthUser(null);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const modalOpen = showCategoryInfo || showAccountPanel;
    if (!modalOpen) {
      lastFocusedElementRef.current?.focus();
      lastFocusedElementRef.current = null;
      return;
    }
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!panel) return;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)];
    (focusable[0] ?? panel).focus();
    const handleModalKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowCategoryInfo(false);
        setShowAccountPanel(false);
        return;
      }
      if (event.key !== "Tab") return;
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleModalKeydown);
    return () => window.removeEventListener("keydown", handleModalKeydown);
  }, [showAccountPanel, showCategoryInfo]);

  const mockDailyChallenge = challenge;

  const currentEntity = mockDailyChallenge.entities[entityIndex];
  const usedCategorySlugs = useMemo(() => new Set(assignments.map((assignment) => assignment.category.slug)), [assignments]);
  const totalScore = officialResult?.totalScore ?? assignments.reduce((sum, assignment) => sum + (assignment.score ?? 0), 0);
  const decisionCount = mockDailyChallenge.entities.length;
  const progress = decisionCount > 0 ? assignments.length / decisionCount : 0;
  const isQualified = officialResult ? leaderboardEligible === true : false;

  useEffect(() => {
    if (view !== "game" || !currentEntity || typeof window === "undefined") return;
    const requestId = ++imageRequestIdRef.current;
    imageAbortRef.current?.abort();
    const imageController = new AbortController();
    imageAbortRef.current = imageController;
    imageMetricStartedRef.current = nowRuntimeMetric();
    const nextEntity = mockDailyChallenge.entities[entityIndex + 1];
    const targets = [currentEntity, nextEntity].filter((entity): entity is MockEntity => Boolean(entity));
    void Promise.all(targets.map(async (entity) => {
      const primaryStarted = nowRuntimeMetric();
      const primary = await preloadImage({ primary: entity.imageUrl, signal: imageController.signal });
      if (!mountedRef.current || !imageRequestIsCurrent(requestId, imageRequestIdRef.current)) return;
      recordRuntimeMetric("image_primary_load", primaryStarted, { entityId: entity.id, result: primary });
      const fallbackStarted = nowRuntimeMetric();
      const fallback = await preloadImage({ primary: entity.imageFallbackUrl, signal: imageController.signal });
      if (!mountedRef.current || !imageRequestIsCurrent(requestId, imageRequestIdRef.current)) return;
      recordRuntimeMetric("image_fallback_load", fallbackStarted, { entityId: entity.id, result: fallback });
    }));
  }, [currentEntity, entityIndex, mockDailyChallenge.entities, view]);

  const applyOfficialResult = useCallback((result: GameResult) => {
    setOfficialResult(result);
    setAssignments(result.assignments.map((assignment) => {
      const entity = mockDailyChallenge.entities.find((item) => item.id === assignment.entityId) ?? mockDailyChallenge.entities[assignment.ordinal];
      const category = mockDailyChallenge.categories.find((item) => item.slug === assignment.categorySlug) ?? mockDailyChallenge.categories[assignment.ordinal];
      return { ordinal: assignment.ordinal, entity: entity ?? mockDailyChallenge.entities[0], category: category ?? mockDailyChallenge.categories[0], score: assignment.scoreValue, timedOut: assignment.timedOut };
    }).filter((assignment) => Boolean(assignment.entity && assignment.category)));
  }, [mockDailyChallenge]);

  async function refreshDuelComparison(code: string, ownSlot: number) {
    setDuelComparisonState("loading");
    try {
      const refreshed = await gameRepository.getDuel(code);
      setDuel(refreshed);
      setDuelComparisonState("ready");
      if (duelToken?.code !== code) setDuelToken(readDuelToken(code));
      void ownSlot;
    } catch (error: unknown) {
      setDuelComparisonState("error");
      setDuelMessage(repositoryErrorMessage(error instanceof RepositoryError ? error : null));
    }
  }

  const expireCurrentGame = useCallback(() => {
    if (timeoutHandled.current || (phase !== "playing" && phase !== "feedback")) return;
    timeoutHandled.current = true;
    gameGenerationRef.current += 1;
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = null;
    const used = new Set(assignments.map((assignment) => assignment.category.slug));
    const categories = mockDailyChallenge.categories.filter((category) => !used.has(category.slug));
    const entities = mockDailyChallenge.entities.slice(assignments.length);
    const timeoutAssignments: Assignment[] = [];
    entities.forEach((entity, index) => {
      const categoryIndex = categories.findIndex((category) => !category.entityType || category.entityType === entity.entityType);
      const category = categoryIndex >= 0 ? categories.splice(categoryIndex, 1)[0] : undefined;
      if (category) timeoutAssignments.push({ ordinal: entity.ordinal ?? assignments.length + index, entity, category, score: null, timedOut: true });
    });
    const claims = assignments.map((assignment) => ({ ordinal: assignment.ordinal, entityId: assignment.entity.id, categorySlug: assignment.category.slug, ...(assignment.timedOut ? { timedOut: true } : {}) }));
    timeoutAssignments.forEach((assignment) => claims.push({ ordinal: assignment.ordinal, entityId: assignment.entity.id, categorySlug: assignment.category.slug, timedOut: true }));
    setAssignments([...assignments, ...timeoutAssignments]);
    setTimedOut(true);
    setPhase("finished");
    transitionFlow({ type: "FINISH" });
    deadlineAtRef.current = null;
    expireRequestStarted.current = true;
    setSubmissionState("saving");
    const gameGeneration = gameGenerationRef.current;
    if (gameMode === "duel" && activeDuel) {
      gameRepository.submitDuelResult(activeDuel.code, activeDuel.token, claims).then((response) => {
        if (!mountedRef.current || gameGeneration !== gameGenerationRef.current) return;
        applyOfficialResult(response.result);
        setLeaderboardEligible(response.leaderboardEligible);
        setSubmissionDuplicate(response.duplicate);
        setSubmissionState("saved");
        void refreshDuelComparison(activeDuel.code, activeDuel.slot);
      }).catch((error: unknown) => {
        if (!mountedRef.current || gameGeneration !== gameGenerationRef.current) return;
        setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline"));
        setSubmissionState("error");
      });
      return;
    }
    if (!session) {
      setRepositoryError(new RepositoryError("Game session is missing", "session"));
      setSubmissionState("error");
      return;
    }
    gameRepository.expireGame(session, claims).then((response) => {
      if (!mountedRef.current || gameGenerationRef.current !== gameGeneration) return;
      applyOfficialResult(response.result);
      setLeaderboardEligible(response.leaderboardEligible);
      setSubmissionDuplicate(response.duplicate);
      setSubmissionState("saved");
    }).catch((error: unknown) => {
      if (!mountedRef.current || gameGenerationRef.current !== gameGeneration) return;
      setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline"));
      setSubmissionState("error");
    });
  }, [activeDuel, applyOfficialResult, assignments, gameMode, mockDailyChallenge, phase, repositoryError, session, timedOut, transitionFlow]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view !== "game" || !deadlineAtRef.current || (phase !== "playing" && phase !== "feedback")) return;
    const tick = () => {
      const remaining = secondsUntil(deadlineAtRef.current!);
      secondsLeftRef.current = remaining;
      setSecondsLeft(remaining);
      if (remaining <= 0) expireCurrentGame();
    };
    tick();
    const timer = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [expireCurrentGame, phase, view]);

  useEffect(() => {
    if (view !== "ranking") return;
    let active = true;
    gameRepository.getLeaderboard(mockDailyChallenge.id)
      .then((rows) => {
        if (!active) return;
        setLeaderboardRows(rows);
        setRepositoryError(null);
        setLeaderboardState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline"));
        setLeaderboardState("error");
      });
    return () => { active = false; };
  }, [mockDailyChallenge.id, view]);

  useEffect(() => {
    if (view !== "category-ranking" || !selectedRankingCategory) return;
    let active = true;
    gameRepository.getCategoryRanking(selectedRankingCategory, selectedRankingCategory === "uefa-champions-league-goals" || selectedRankingCategory === "uefa-champions-league-assists" || selectedRankingCategory === "world-cup-goals" ? selectedRankingDataset : undefined)
      .then((ranking) => {
        if (!active) return;
        setCategoryRanking(ranking);
        setCategoryRankingState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCategoryRanking(null);
        setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Ranking unavailable", "server"));
        setCategoryRankingState("error");
      });
    return () => { active = false; };
  }, [selectedRankingCategory, selectedRankingDataset, view]);

  useEffect(() => {
    if (view !== "result" || assignments.length !== mockDailyChallenge.entities.length) return;
    let active = true;
    if ((!session && !(gameMode === "duel" && activeDuel)) || officialResult || expireRequestStarted.current) return;
    const resultKey = `${gameMode}:${activeDuel?.code ?? mockDailyChallenge.id}:${assignments.map((assignment) => `${assignment.entity.id}-${assignment.category.slug}`).join(",")}`;
    if (submittedResultKey.current === resultKey) return;
    submittedResultKey.current = resultKey;
    setSubmissionState("saving");
    const claims = assignments.map((assignment) => ({ ordinal: assignment.ordinal, entityId: assignment.entity.id, categorySlug: assignment.category.slug, ...(assignment.timedOut ? { timedOut: true } : {}) }));
    const request = gameMode === "duel" && activeDuel
      ? gameRepository.submitDuelResult(activeDuel.code, activeDuel.token, claims)
      : session
        ? gameRepository.submitResult(session, claims)
        : Promise.reject(new RepositoryError("Game session is missing", "session"));
    request.then((response) => {
      if (!active) return;
      applyOfficialResult(response.result);
      setLeaderboardEligible(response.leaderboardEligible);
      setSubmissionDuplicate(response.duplicate);
      setSubmissionState("saved");
      if (gameMode === "duel" && activeDuel) void refreshDuelComparison(activeDuel.code, activeDuel.slot);
    }).catch((error: unknown) => {
      if (!active) return;
      setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline"));
      setSubmissionState("error");
    });
    return () => { active = false; };
  }, [activeDuel, applyOfficialResult, assignments, gameMode, mockDailyChallenge.entities.length, mockDailyChallenge.id, officialResult, session, view]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startDaily() {
    const intentionalRestart = (view === "result" || phase === "abandoned") && challengeLoadState === "ready";
    if (startRequestStarted.current || (!canStartGame(flowState) && !intentionalRestart) || challengeLoadState !== "ready") return;
    startRequestStarted.current = true;
    const startedAt = nowRuntimeMetric();
    if (!canStartGame(flowState)) transitionFlow({ type: "CHALLENGE_READY" });
    transitionFlow({ type: "START_GAME" });
    setRepositoryError(null);
    try {
      const startedSession = await gameRepository.startGame(challenge.id);
      if (!mountedRef.current) return;
      gameGenerationRef.current += 1;
      setChallenge(startedSession.challenge);
      setGameMode("daily");
      setSession(startedSession);
      setActiveDuel(null);
      setDuelToken(null);
      setAssignments([]);
      setEntityIndex(0);
      setSelectedCategory(null);
      setLatestFeedback(null);
      setDecisionPending(false);
      setSecondsLeft(startedSession.challenge.timeLimitSeconds);
      setTimedOut(false);
      timeoutHandled.current = false;
      setOfficialResult(null);
      setLeaderboardEligible(null);
      setSubmissionDuplicate(false);
      expireRequestStarted.current = false;
      submittedResultKey.current = null;
      setShareMessage("");
      setSubmissionState("idle");
      firstPlayerMetricRecordedRef.current = false;
      setPhase("playing");
      deadlineAtRef.current = startedSession.deadlineAt;
      transitionFlow({ type: "GAME_STARTED" });
      setChallengeLoadState("ready");
      setView("game");
      recordRuntimeMetric("game_start", startedAt, { challengeId: startedSession.challengeId, sessionId: startedSession.id });
    } catch (error: unknown) {
      if (mountedRef.current) {
        const normalized = error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline");
        setRepositoryError(normalized);
        setChallengeLoadState("ready");
        transitionFlow({ type: "ERROR", officialNotReady: normalized.code === "official_not_ready" });
        recordRuntimeMetric("request_error", startedAt, { operation: "start_game", code: normalized.code, kind: normalized.kind });
      }
    } finally {
      startRequestStarted.current = false;
    }
  }

  function retryChallenge() {
    recordRuntimeMetric("request_retry", nowRuntimeMetric(), { operation: "daily_challenge" });
    void loadDailyChallenge();
  }

  function abandonGame() {
    if (view !== "game" || phase === "finished" || phase === "abandoned") return;
    gameGenerationRef.current += 1;
    imageRequestIdRef.current += 1;
    imageAbortRef.current?.abort();
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = null;
    setPhase("abandoned");
    transitionFlow({ type: "ABANDON" });
    setDecisionPending(false);
    setSelectedCategory(null);
  }

  function resetGameToHome() {
    gameGenerationRef.current += 1;
    imageRequestIdRef.current += 1;
    imageAbortRef.current?.abort();
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = null;
    setAssignments([]);
    setEntityIndex(0);
    setSelectedCategory(null);
    setSecondsLeft(mockDailyChallenge.timeLimitSeconds);
    setTimedOut(false);
    timeoutHandled.current = false;
    setShareMessage("");
    setSubmissionState("idle");
    setOfficialResult(null);
    setGameMode("daily");
    setActiveDuel(null);
    setDuelToken(null);
    setLeaderboardEligible(null);
    setSubmissionDuplicate(false);
    setSession(null);
    setRepositoryError(null);
    expireRequestStarted.current = false;
    submittedResultKey.current = null;
    setPhase("playing");
    setChallengeLoadState("ready");
    transitionFlow({ type: "CHALLENGE_READY" });
    deadlineAtRef.current = null;
    setView("home");
  }

  function resetToHome() {
    if (view === "game" && (phase === "playing" || phase === "feedback")) {
      abandonGame();
      return;
    }
    resetGameToHome();
  }

  function openRanking() {
    setRepositoryError(null);
    setLeaderboardRows([]);
    setLeaderboardState("loading");
    setView("ranking");
  }

  function openCategoryRanking() {
    const firstCategory = selectedRankingCategory || mockDailyChallenge.categories[0]?.slug || "";
    setSelectedRankingCategory(firstCategory);
    setCategoryRanking(null);
    setCategoryRankingState("loading");
    setRepositoryError(null);
    setView("category-ranking");
    void gameRepository.getRankingCategories().then((categories) => {
      if (categories.length > 0) {
        setRankingCategories(categories);
        if (!categories.some((category) => category.slug === firstCategory)) setSelectedRankingCategory(categories[0].slug);
      }
    }).catch(() => undefined);
  }

  function retrySubmission() {
    if (repositoryError?.code === "time_expired") {
      expireRequestStarted.current = false;
      timeoutHandled.current = false;
      expireCurrentGame();
      return;
    }
    if (timedOut) {
      expireRequestStarted.current = false;
      timeoutHandled.current = false;
      setRepositoryError(null);
      expireCurrentGame();
      return;
    }
    if (repositoryError?.kind === "session") {
      if (gameMode === "duel") {
        setDuelMessage(t("duels.sessionExpired"));
        setView("duels");
      } else {
        startDaily();
      }
      return;
    }
    if ((!session && !(gameMode === "duel" && activeDuel)) || !assignments.length) return;
    submittedResultKey.current = null;
    setRepositoryError(null);
    setSubmissionState("idle");
  }

  async function submitAuth(event: { preventDefault: () => void }) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const user = authMode === "register"
        ? await gameRepository.register(authEmail, authPassword, authDisplayName)
        : await gameRepository.login(authEmail, authPassword);
      setAuthUser(user);
      setAuthMessage(user.emailVerified ? t("auth.success") : t("auth.verificationRequired"));
    } catch (error: unknown) {
      setAuthMessage(repositoryErrorMessage(error instanceof RepositoryError ? error : new RepositoryError("Authentication failed", "auth")));
    } finally {
      setAuthBusy(false);
    }
  }

  async function startGoogleAuth() {
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (!await gameRepository.getGoogleAuthStatus()) {
        setAuthMessage(locale === "es" ? "Google no está configurado todavía en el servidor." : "Google is not configured on the server yet.");
        return;
      }
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
      if (!baseUrl) throw new RepositoryError("Frontend API is not configured", "server", 500, "api_not_configured");
      window.open(`${baseUrl.replace(/\/$/u, "")}/v1/auth/google/start?returnTo=${encodeURIComponent(window.location.href)}`, "_self");
    } catch (error: unknown) {
      setAuthMessage(error instanceof RepositoryError ? repositoryErrorMessage(error) : t("errors.server"));
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    setAuthBusy(true);
    try {
      await gameRepository.logout();
      setAuthUser(null);
      setAuthMessage(t("auth.loggedOut"));
    } catch (error: unknown) {
      setAuthMessage(repositoryErrorMessage(error instanceof RepositoryError ? error : new RepositoryError("Logout failed", "auth")));
    } finally {
      setAuthBusy(false);
    }
  }

  async function shareResult() {
    const text = `RANGO 90 — ${mockDailyChallenge.title[locale]}: ${totalScore} puntos. ${isQualified ? t("result.shareQualified") : t("result.shareNotQualified")}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "RANGO 90", text });
      } else {
        await copyText(text);
      }
      setShareMessage(t("result.shared"));
    } catch {
      setShareMessage(t("result.shareError"));
    }
  }

  function openAccountPanel() {
    setAuthMessage("");
    setShowAccountPanel(true);
  }

  function repositoryErrorMessage(error: RepositoryError | null) {
    if (!error) return t("errors.generic");
    if (error.code === "daily_challenge_not_found") return t("states.error.noChallenge");
    if (error.code === "official_not_ready") return t("states.officialNotReady.copy");
    if (error.code === "official_test_challenge_rejected") return t("states.officialNotReady.testOnly");
    if (error.code === "ranking_not_available") return t("categoryRanking.unavailable");
    return t(`errors.${error.kind}` as "errors.generic");
  }

  function duelErrorMessage(error: RepositoryError | null) {
    if (!error) return repositoryErrorMessage(null);
    if (error.code === "duel_full") return t("duels.full");
    if (error.code === "duel_not_joinable") return t("duels.notJoinable");
    if (error.code === "duel_participant_exists") return t("duels.participantExists");
    if (error.kind === "expired") return t("duels.expired");
    if (error.kind === "not_found") return t("duels.invalid");
    return repositoryErrorMessage(error);
  }

  async function createDuel() {
    if (challengeLoadState !== "ready") {
      setDuelState("error");
      setDuelMessage(repositoryErrorMessage(repositoryError));
      return;
    }
    setDuelState("loading");
    setDuelMessage("");
    try {
      const created = await gameRepository.createDuel(challenge.id);
      setDuel(created);
      if (created.participantToken) {
        const startedAt = new Date().toISOString();
        const deadlineAt = futureIso(created.challenge?.timeLimitSeconds ?? challenge.timeLimitSeconds);
        const token = { code: created.code, token: created.participantToken, slot: 1, startedAt, deadlineAt };
        saveDuelToken(token);
        setDuelToken(token);
      }
      setDuelState("ready");
    } catch (error: unknown) {
      setDuelState("error");
      setDuelMessage(duelErrorMessage(error instanceof RepositoryError ? error : null));
    }
  }

  async function openDuel(code = duelCodeInput) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return;
    setDuelCodeInput(normalizedCode);
    setDuelState("loading");
    setDuelMessage("");
    try {
      const opened = await gameRepository.getDuel(normalizedCode);
      setDuel(opened);
      setDuelToken(readDuelToken(normalizedCode));
      setDuelState("ready");
    } catch (error: unknown) {
      setDuelState("error");
      setDuelMessage(duelErrorMessage(error instanceof RepositoryError ? error : null));
    }
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("duel")?.toUpperCase() ?? "";
    if (!code) return;
    const timer = window.setTimeout(() => {
      setInitialDuelCode(code);
      setDuelCodeInput(code);
      setView("duels");
      void openDuel(code);
    }, 0);
    return () => window.clearTimeout(timer);
    // The URL is read once after hydration; the async handler owns its state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function joinDuel() {
    if (!duelCodeInput) return;
    setDuelState("loading");
    try {
      const joined = await gameRepository.joinDuel(duelCodeInput);
      setDuel(joined);
      if (joined.participantToken) {
        const startedAt = new Date().toISOString();
        const deadlineAt = futureIso(joined.challenge?.timeLimitSeconds ?? challenge.timeLimitSeconds);
        const token = { code: joined.code, token: joined.participantToken, slot: 2, startedAt, deadlineAt };
        saveDuelToken(token);
        setDuelToken(token);
      }
      setDuelState("ready");
    } catch (error: unknown) {
      setDuelState("error");
      setDuelMessage(duelErrorMessage(error instanceof RepositoryError ? error : null));
    }
  }

  function startDuelGame() {
    if (!duel || !duelToken || !duel.challenge) return;
    gameGenerationRef.current += 1;
    imageRequestIdRef.current += 1;
    const startedAt = duelToken.startedAt ?? new Date().toISOString();
    const deadlineAt = duelToken.deadlineAt ?? new Date(Date.parse(startedAt) + duel.challenge.timeLimitSeconds * 1000).toISOString();
    setChallenge(duel.challenge);
    setChallengeLoadState("ready");
    setGameMode("duel");
    setSession(null);
    setActiveDuel({ ...duelToken, startedAt, deadlineAt, challenge: duel.challenge });
    setAssignments([]);
    setEntityIndex(0);
    setSelectedCategory(null);
    setSecondsLeft(secondsUntil(deadlineAt));
    deadlineAtRef.current = deadlineAt;
    setTimedOut(false);
    timeoutHandled.current = false;
    expireRequestStarted.current = false;
    submittedResultKey.current = null;
    setOfficialResult(null);
    setLeaderboardEligible(null);
    setSubmissionDuplicate(false);
    setRepositoryError(null);
    setDuelComparisonState("idle");
    setSubmissionState("idle");
    firstPlayerMetricRecordedRef.current = false;
    setPhase("playing");
    transitionFlow({ type: "CHALLENGE_READY" });
    transitionFlow({ type: "GAME_STARTED" });
    setView("game");
  }

  async function replayDuel() {
    const token = duelToken ?? (activeDuel ? { code: activeDuel.code, token: activeDuel.token, slot: activeDuel.slot } : null);
    if (!duel || !token) return;
    setDuelState("loading");
    setDuelMessage("");
    try {
      const replayed = await gameRepository.replayDuel(duel.code, token.token);
      setDuel(replayed);
      const startedAt = new Date().toISOString();
      const deadlineAt = futureIso(replayed.challenge?.timeLimitSeconds ?? challenge.timeLimitSeconds);
      const nextToken = { code: replayed.code, token: replayed.participantToken ?? "", slot: token.slot, startedAt, deadlineAt };
      if (nextToken.token) {
        saveDuelToken(nextToken);
        setDuelToken(nextToken);
      }
      setDuelState("ready");
      setDuelComparisonState("idle");
      setView("duels");
    } catch (error: unknown) {
      setDuelState("error");
      setDuelMessage(error instanceof RepositoryError && error.kind === "conflict" ? t("duels.active") : repositoryErrorMessage(error instanceof RepositoryError ? error : null));
    }
  }

  async function copyDuelLink() {
    if (!duel) return;
    const configured = process.env.NEXT_PUBLIC_PUBLIC_WEB_ORIGIN?.trim();
    const target = new URL(configured || window.location.href);
    const configuredPath = configured ? target.pathname.replace(/\/$/u, "") : "";
    const currentPath = window.location.pathname;
    target.pathname = configuredPath && !currentPath.startsWith(`${configuredPath}/`) && currentPath !== configuredPath
      ? `${configuredPath}${currentPath.startsWith("/") ? currentPath : `/${currentPath}`}`
      : currentPath;
    target.search = `?duel=${encodeURIComponent(duel.code)}`;
    target.hash = "";
    const url = target.toString();
    try {
      await copyText(url);
      setDuelMessage(t("duels.copied"));
    } catch {
      setDuelMessage(url);
    }
  }

  function continueAfterFeedback() {
    if (phase !== "feedback") return;
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = null;
    recordRuntimeMetric("decision_to_next_player", decisionStartedAtRef.current ?? nowRuntimeMetric(), { ordinal: entityIndex });
    if (latestFeedback?.complete || entityIndex >= mockDailyChallenge.entities.length - 1) {
      setPhase("finished");
      transitionFlow({ type: "FINISH" });
      deadlineAtRef.current = null;
      setView("result");
      return;
    }
    setEntityIndex((current) => current + 1);
    setSelectedCategory(null);
    setLatestFeedback(null);
    setPhase("playing");
    transitionFlow({ type: "CONTINUE" });
  }

  async function assignCategory(category: MockCategory) {
    if (!currentEntity || !canSubmitDecision(flowState) || phase !== "playing" || usedCategorySlugs.has(category.slug) || decisionPending) return;
    setSelectedCategory(category.slug);
    setDecisionPending(true);
    transitionFlow({ type: "SUBMIT_DECISION" });
    decisionStartedAtRef.current = nowRuntimeMetric();
    const gameGeneration = gameGenerationRef.current;
    try {
      const ordinal = currentEntity.ordinal ?? entityIndex;
      const claim = { ordinal, entityId: currentEntity.id, categorySlug: category.slug };
      const previousClaims = assignments.map((assignment) => ({ ordinal: assignment.ordinal, entityId: assignment.entity.id, categorySlug: assignment.category.slug, ...(assignment.timedOut ? { timedOut: true } : {}) }));
      const feedback = gameMode === "daily" && session
        ? await gameRepository.submitDecision(session, claim, previousClaims)
        : { assignment: { ...claim, scoreValue: 0 }, selectedRank: null, bestCategorySlug: category.slug, bestRank: null, complete: false };
      if (!mountedRef.current || gameGeneration !== gameGenerationRef.current || phase !== "playing") return;
      const nextAssignment = { ordinal, entity: currentEntity, category, score: gameMode === "daily" ? feedback.assignment.scoreValue : null, feedback };
      const nextAssignments = [...assignments, nextAssignment];
      setAssignments(nextAssignments);
      setLatestFeedback(feedback);
      setPhase("feedback");
      transitionFlow({ type: "FEEDBACK_SHOWN" });
    } catch (error: unknown) {
      if (!mountedRef.current || gameGeneration !== gameGenerationRef.current) return;
      setSelectedCategory(null);
      setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline"));
      transitionFlow({ type: "DECISION_FAILED" });
    } finally {
      if (mountedRef.current && gameGeneration === gameGenerationRef.current) setDecisionPending(false);
    }
  }

  function renderHeader() {
    const languageHref = initialDuelCode ? `/?duel=${encodeURIComponent(initialDuelCode)}` : "/";
    return <header className="app-header">
      <button className="brand-lockup" type="button" onClick={resetToHome} aria-label={t("brand.homeLabel")}><span className="brand-word">RANGO</span><span className="brand-number">90</span></button>
      <div className="header-status"><span className={`status-dot ${isOffline ? "status-dot-offline" : ""}`} />{isOffline ? t("header.offline") : t("header.status")}</div>
      <div className="header-actions"><Link className="locale-switch" href={languageHref} locale={locale === "es" ? "en" : "es"} aria-label={t("header.languageLabel")}>{locale === "es" ? "EN" : "ES"}</Link><button className="header-account" type="button" onClick={openAccountPanel}><span>+</span>{t("header.account")}</button></div>
    </header>;
  }

  function renderNav() {
    return <nav className={`bottom-nav ${view === "game" ? "bottom-nav-game" : ""}`} aria-label={t("navigation.label")}>
      <button className={view === "home" || view === "game" || view === "result" ? "active" : ""} onClick={resetToHome} type="button"><span className="nav-mark">01</span>{t("navigation.home")}</button>
      <button className={view === "ranking" || view === "category-ranking" ? "active" : ""} onClick={openRanking} type="button"><span className="nav-mark">90</span>{t("navigation.ranking")}</button>
      <button className={view === "duels" ? "active" : ""} onClick={() => setView("duels")} type="button"><span className="nav-mark">VS</span>{t("navigation.duels")}</button>
      <button className={view === "account" ? "active" : ""} onClick={() => setView("account")} type="button"><span className="nav-mark">ID</span>{t("navigation.account")}</button>
    </nav>;
  }

  function renderChallengeLoading() {
    return <section className="state-view" aria-live="polite"><div className="state-index">01 / {t("states.loading.code")}</div><div className="state-pulse" aria-hidden="true" /><p className="kicker">{t("states.loading.kicker")}</p><h1>{t("states.loading.title")}</h1><p>{t("states.loading.copy")}</p></section>;
  }

  function renderStartingGame() {
    return <section className="state-view" aria-live="polite" aria-busy="true"><div className="state-index">02 / START</div><div className="state-pulse" aria-hidden="true" /><p className="kicker">{t("states.startingGame.title")}</p><h1>{t("states.startingGame.title")}</h1><p>{t("states.startingGame.copy")}</p></section>;
  }

  function renderChallengeError() {
    if (repositoryError?.code === "official_not_ready") {
      const details = repositoryError.details as { blockingCategories?: Array<{ slug: string; reasons: string[] }>; snapshotRequired?: string } | undefined;
      return <section className="state-view state-view-official" role="alert"><div className="state-index">OFF / 01</div><p className="kicker">{t("states.officialNotReady.kicker")}</p><h1>{t("states.officialNotReady.title")}</h1><p>{repositoryErrorMessage(repositoryError)}</p>{details?.blockingCategories?.length ? <div className="official-blockers"><strong>{t("states.officialNotReady.blockers")}</strong>{details.blockingCategories.map((blocker) => <div key={blocker.slug}><b>{blocker.slug}</b><span>{blocker.reasons.join(" ")}</span></div>)}</div> : null}<p className="micro-note">{details?.snapshotRequired ?? t("states.officialNotReady.snapshot")}</p><button className="button button-primary" type="button" onClick={retryChallenge}>{t("states.error.retry")}</button></section>;
    }
    return <section className="state-view state-view-error" role="alert"><div className="state-index">ERR / 01</div><p className="kicker">{t("states.error.kicker")}</p><h1>{t("states.error.title")}</h1><p>{repositoryError ? repositoryErrorMessage(repositoryError) : t("states.error.copy")}</p><button className="button button-primary" type="button" onClick={retryChallenge}>{t("states.error.retry")}</button><button className="text-button" type="button" onClick={resetGameToHome}>{t("states.error.home")}</button></section>;
  }

  function renderHome() {
    return <section className="home-view" aria-labelledby="home-title">
      <div className="home-intro"><p className="kicker">{t("home.kicker")}</p><h1 id="home-title">{t("home.title")}</h1><p className="home-description">{t("home.description")}</p></div>
      <div className="hero-grid">
        <article className="daily-card"><div className="card-index">01 / {t("home.daily.label")}</div><div className="daily-card-content"><p className="card-overline">{t("home.daily.overline")}</p><h2>{mockDailyChallenge.title[locale]}</h2><p>{mockDailyChallenge.subtitle[locale]}</p><div className="daily-meta"><span>{t("home.daily.categories", { count: mockDailyChallenge.categories.length })}</span><span>{t("home.daily.time", { seconds: mockDailyChallenge.timeLimitSeconds })}</span></div><button className="button button-primary" type="button" onClick={() => void startDaily()} disabled={flowState === "starting_game"} aria-busy={flowState === "starting_game"}>{flowState === "starting_game" ? t("states.startingGame.title") : t("home.daily.cta")} <span aria-hidden="true">↗</span></button>{flowState === "starting_game" ? <p className="micro-note" role="status">{t("states.startingGame.copy")}</p> : null}{flowState === "error" && repositoryError ? <p className="micro-note" role="alert">{repositoryErrorMessage(repositoryError)}</p> : null}</div></article>
        <aside className="score-card"><span className="card-index">02 / {t("home.score.label")}</span><strong>—</strong><span>{t("home.score.caption")}</span><div className="score-rule"><span /></div><small>{mockDailyChallenge.scoreCap ? `${t("game.target")}: ${mockDailyChallenge.scoreCap}` : "—"}</small></aside>
      </div>
      <div className="home-lower-grid">
        <section className="section-block"><div className="section-heading"><div><p className="kicker">{t("home.modes.kicker")}</p><h2>{t("home.modes.title")}</h2></div><span className="section-count">03</span></div><div className="mode-grid">
          <button className="mode-tile mode-tile-active" type="button" onClick={startDaily}><span className="mode-code">N</span><strong>{t("home.modes.normal")}</strong><small>{t("home.modes.normalCaption")}</small></button>
          <button className="mode-tile" type="button" onClick={() => setView("duels")}><span className="mode-code">VS</span><strong>{t("home.modes.duel")}</strong><small>{t("home.modes.duelCaption")}</small></button>
          <button className="mode-tile" type="button" onClick={openRanking}><span className="mode-code">H</span><strong>{t("home.modes.history")}</strong><small>{t("home.modes.historyCaption")}</small></button>
        </div></section>
        <section className="principle-card"><p className="kicker">{t("home.principle.kicker")}</p><p>{t("home.principle.copy")}</p><button className="text-button" type="button" onClick={() => setShowCategoryInfo(true)}>{t("home.principle.cta")} <span aria-hidden="true">↗</span></button></section>
      </div>
    </section>;
  }

  function renderGame() {
    const latestAssignment = assignments[assignments.length - 1];
    const bestCategory = latestFeedback ? mockDailyChallenge.categories.find((category) => category.slug === latestFeedback.bestCategorySlug) : undefined;
    const selectedRank = latestFeedback?.selectedRank ?? null;
    const bestRank = latestFeedback?.bestRank ?? null;
    const rankDifference = selectedRank !== null && bestRank !== null ? selectedRank - bestRank : null;
    const imageSource = currentEntity ? (Object.prototype.hasOwnProperty.call(imageOverrides, currentEntity.id) ? imageOverrides[currentEntity.id] ?? undefined : currentEntity.imageUrl ?? currentEntity.imageFallbackUrl) : undefined;
    const scoreDisplay = assignments.some((assignment) => assignment.score !== null) ? totalScore : "—";
    return <section className="game-view" aria-labelledby="game-title">
      <div className="game-topline"><div><p className="kicker">{t("game.kicker")}</p><h1 id="game-title">{mockDailyChallenge.title[locale]}</h1></div><div className="game-topline-actions"><div className={`timer ${secondsLeft <= 20 ? "timer-warning" : ""}`} aria-label={t("game.timerLabel")}><span aria-live="polite">{formatTime(secondsLeft)}</span><small>{t("game.remaining")}</small></div><button className="abandon-button" type="button" onClick={abandonGame} disabled={phase === "finished" || phase === "abandoned"}>{t("game.abandon")}</button></div></div>
      <div className="game-scoreline"><div><span>{t("game.score")}</span><strong>{scoreDisplay}</strong></div><div className="game-progress" aria-label={t("game.progressLabel", { current: Math.min(assignments.length, decisionCount), total: decisionCount })}><span>{String(Math.min(assignments.length, decisionCount)).padStart(2, "0")}</span><div className="progress-track"><span style={{ width: `${Math.min(progress, 1) * 100}%` }} /></div><span>{String(decisionCount).padStart(2, "0")}</span></div><div className="game-target"><span>{t("game.target")}</span><strong>{mockDailyChallenge.scoreCap ?? "—"}</strong></div></div>
      <div className="decision-layout">
        <article className="entity-card"><div className="entity-card-topline"><span>{t("game.entityPosition", { current: Math.min(entityIndex + 1, decisionCount), total: decisionCount })}</span><span className="entity-type">{currentEntity ? currentEntity.entityType === "player" ? t("game.entityType.player") : currentEntity.entityType === "club" ? t("game.entityType.club") : t("game.entityType.nationalTeam") : null}</span></div>{currentEntity ? <>{imageSource ? <img className="entity-image" src={imageSource} alt={currentEntity.name} loading="eager" onLoad={() => { if (!firstPlayerMetricRecordedRef.current) { firstPlayerMetricRecordedRef.current = true; recordRuntimeMetric("first_player_visible", imageMetricStartedRef.current ?? nowRuntimeMetric(), { entityId: currentEntity.id }); } }} onError={(event) => { if (currentEntity.imageFallbackUrl && event.currentTarget.src !== currentEntity.imageFallbackUrl) setImageOverrides((current) => ({ ...current, [currentEntity.id]: currentEntity.imageFallbackUrl ?? null })); else setImageOverrides((current) => ({ ...current, [currentEntity.id]: null })); }} /> : <div className="entity-monogram" aria-hidden="true">{currentEntity.shortName}</div>}<h2>{currentEntity.name}</h2><p>{t("game.entityPrompt")}</p></> : null}</article>
        <div className="category-panel"><div className="panel-heading"><div><p className="kicker">{t("game.categoryKicker")}</p><h2>{t("game.categoryTitle")}</h2></div><button className="icon-button" type="button" onClick={() => setShowCategoryInfo(true)} aria-label={t("game.infoLabel")}>i</button></div><div className="category-list">
          {mockDailyChallenge.categories.map((category) => { const assignment = assignments.find((item) => item.category.slug === category.slug); const isUsed = Boolean(assignment); const isCompatible = !category.entityType || !currentEntity || category.entityType === currentEntity.entityType; return <button className={`category-row ${isUsed ? "category-row-used" : ""} ${!isCompatible ? "category-row-unavailable" : ""} ${selectedCategory === category.slug ? "category-row-selected" : ""}`} disabled={isUsed || !isCompatible || !canSubmitDecision(flowState) || decisionPending} key={category.slug} onClick={() => void assignCategory(category)} type="button"><span className="category-mark" aria-hidden="true">{category.code}</span><span className="category-copy"><strong>{category.label[locale]}</strong><small>{category.competitionLabel?.[locale] ?? (locale === "es" ? "Fútbol · global" : "Football · global")}</small><small>{isUsed ? t("game.used") : !isCompatible ? (locale === "es" ? "No aplica" : "Not applicable") : decisionPending ? t("game.feedback.submitting") : t("game.available")}</small></span>{assignment ? <span className={`category-score ${assignment.score === null ? "score-pending" : assignment.score >= 70 ? "score-bad" : assignment.score >= 25 ? "score-mid" : "score-good"}`}>{assignment.score === null ? "—" : `+${assignment.score}`}</span> : <span className="category-arrow" aria-hidden="true">↗</span>}</button>; })}
        </div>
        {phase === "feedback" && latestAssignment && latestFeedback ? <div className={`feedback-card ${latestAssignment.score === null ? "feedback-pending" : latestAssignment.score >= 70 ? "feedback-bad" : latestAssignment.score >= 25 ? "feedback-mid" : "feedback-good"}`} aria-live="polite"><div><span className="feedback-label">{t("game.feedback.label")}</span><strong>{latestAssignment.entity.name}</strong></div><div className="feedback-score"><strong>{latestAssignment.score === null ? "—" : latestAssignment.score}</strong><span>{latestAssignment.score === null ? t("game.feedback.pending") : t("game.feedback.points")}</span></div><p>{t("game.feedback.chosenCategory", { category: latestAssignment.category.label[locale] })}</p><p>{t("game.feedback.player", { player: latestAssignment.entity.name })}</p><p>{t("game.feedback.rank", { rank: selectedRank ?? "—" })}</p><p>{t("game.feedback.score", { score: latestAssignment.score ?? "—" })}</p><p>{t("game.feedback.bestCategory", { category: bestCategory?.label[locale] ?? "—" })}</p><p>{t("game.feedback.bestRank", { rank: bestRank ?? "—" })}</p>{rankDifference !== null ? <p>{t("game.feedback.difference", { difference: rankDifference })}</p> : null}<strong className="feedback-verdict">{selectedRank !== null && bestRank !== null && selectedRank === bestRank ? t("game.feedback.correct") : t("game.feedback.lessOptimal")}</strong><button className="button button-dark" type="button" onClick={continueAfterFeedback}>{latestFeedback.complete || entityIndex >= mockDailyChallenge.entities.length - 1 ? t("game.finish") : t("game.next")}</button></div> : null}
        {phase === "finished" ? <div className="feedback-card feedback-timeout"><div><span className="feedback-label">{t(timedOut ? "game.timeout.label" : "game.complete.label")}</span><strong>{t(timedOut ? "game.timeout.title" : "game.complete.title")}</strong></div><p>{t(timedOut ? "game.timeout.copy" : "game.complete.copy")}</p><button className="button button-dark" type="button" onClick={() => setView("result")}>{t("game.resultCta")} <span aria-hidden="true">↗</span></button></div> : null}
        {phase === "abandoned" ? <div className="feedback-card feedback-abandoned"><div><span className="feedback-label">{t("game.abandoned.label")}</span><strong>{t("game.abandoned.title")}</strong></div><p>{t("game.abandoned.copy")}</p><div className="feedback-actions"><button className="button button-dark" type="button" onClick={startDaily}>{t("game.abandoned.restart")}</button><button className="button button-secondary" type="button" onClick={resetGameToHome}>{t("game.abandoned.home")}</button></div></div> : null}
        {phase === "playing" && repositoryError && !decisionPending ? <div className="result-status" role="alert"><p className="micro-note">{repositoryErrorMessage(repositoryError)}</p><button className="button button-secondary" type="button" onClick={() => setRepositoryError(null)}>{t("game.feedback.retry")}</button></div> : null}
        </div>
      </div>
    </section>;
  }

  function renderResult() {
    const ownSlot = activeDuel?.slot ?? duelToken?.slot;
    const opponent = ownSlot && duel?.participants ? duel.participants.find((participant) => participant.slot !== ownSlot) : duel?.participants?.[0];
    const opponentFinished = Boolean(opponent?.hasResult && opponent.totalScore !== null);
    const scoreDelta = officialResult && opponentFinished && opponent ? officialResult.totalScore - (opponent.totalScore ?? 0) : null;
    const elapsedDelta = officialResult && opponentFinished && opponent?.elapsedSeconds !== null && opponent?.elapsedSeconds !== undefined ? officialResult.elapsedSeconds - opponent.elapsedSeconds : null;
    const ownWins = Boolean(scoreDelta !== null && (scoreDelta < 0 || (scoreDelta === 0 && (elapsedDelta ?? 0) < 0)));
    const ownTies = Boolean(scoreDelta === 0 && (elapsedDelta === null || elapsedDelta === 0));
return <section className="result-view" aria-labelledby="result-title"><div className="result-heading"><p className="kicker">{t(gameMode === "duel" ? "result.duelKicker" : "result.kicker")}</p><h1 id="result-title">{t("result.title")}</h1><p>{t(gameMode === "duel" ? "result.duelSubtitle" : "result.subtitle")}</p></div><div className="result-score-card"><span>{t("result.scoreLabel")}</span><strong>{officialResult ? totalScore : "—"}</strong><small>{officialResult ? gameMode === "duel" ? t("result.duelOfficial") : isQualified ? t("result.qualified") : t("result.notQualified") : t("result.pending")}</small></div><div className="result-summary"><div className="summary-head"><span>{t("result.breakdown")}</span><span>{t("result.rank")}</span></div>{assignments.map((assignment) => <div className="summary-row" key={`${assignment.entity.id}-${assignment.category.slug}`}><span><b>{assignment.entity.shortName}</b> {assignment.entity.name}</span><span><em>{assignment.category.label[locale]}</em> {assignment.score === null ? "—" : `+${assignment.score}`}</span></div>)}</div>{gameMode === "duel" ? <div className="duel-comparison" aria-live="polite"><div className="comparison-heading"><span>{t("result.duelComparison")}</span><button className="text-button" type="button" onClick={() => activeDuel && void refreshDuelComparison(activeDuel.code, activeDuel.slot)} disabled={duelComparisonState === "loading"}>{t("result.refreshDuel")}</button></div>{duelComparisonState === "loading" ? <p className="micro-note">{t("result.comparisonLoading")}</p> : null}{duelComparisonState === "error" ? <p className="micro-note" role="alert">{duelMessage}</p> : null}{duelComparisonState !== "loading" && duelComparisonState !== "error" ? <><div className="comparison-row"><span>{t("result.you")}</span><strong>{officialResult ? officialResult.totalScore : "—"}</strong></div><div className="comparison-row"><span>{opponent ? t("result.opponent") : t("result.opponentWaiting")}</span><strong>{opponentFinished ? opponent?.totalScore : "—"}</strong></div><p className="comparison-outcome">{opponentFinished ? ownTies ? t("result.draw") : ownWins ? t("result.win") : t("result.loss") : t("result.waitingOpponent")}</p></> : null}</div> : null}<div className="result-actions"><button className="button button-primary" type="button" onClick={shareResult} disabled={!officialResult}>{t("result.share")}</button>{gameMode === "duel" ? <><button className="button button-secondary" type="button" onClick={() => setView("duels")}>{t("result.backToDuels")}</button>{duel && (duel.status === "completed" || duel.status === "expired") ? <button className="button button-secondary" type="button" onClick={replayDuel}>{t("result.rematch")}</button> : null}</> : <><button className="button button-secondary" type="button" onClick={startDaily}>{t("result.replay")}</button><button className="button button-secondary" type="button" onClick={openRanking}>{t("result.ranking")}</button></>}</div>{shareMessage ? <p className="micro-note" role="status">{shareMessage}</p> : null}{submissionState === "saving" ? <p className="micro-note">{t("result.saving")}</p> : null}{submissionState === "saved" ? <p className="micro-note">{submissionDuplicate ? t("result.duplicate") : leaderboardEligible === false ? authUser ? t("result.savedNotQualified") : t("result.savedGuest") : t("result.saved")}</p> : null}{submissionState === "error" ? <div className="result-status" role="alert"><p className="micro-note">{repositoryErrorMessage(repositoryError)}</p><button className="button button-secondary" type="button" onClick={retrySubmission}>{repositoryError?.kind === "session" ? t("result.restart") : t("result.retry")}</button></div> : null}</section>;
  }

  function renderRanking() {
    const rows = leaderboardRows;
    return <section className="simple-view" aria-labelledby="ranking-title"><p className="kicker">{t("ranking.kicker")}</p><h1 id="ranking-title">{t("ranking.title")}</h1><p className="simple-lead">{t("ranking.subtitle")}</p><button className="button button-secondary" type="button" onClick={openCategoryRanking}>{t("ranking.categoryCta")}</button>{leaderboardState === "loading" ? <p className="micro-note">{t("ranking.loading")}</p> : null}{leaderboardState === "error" ? <div className="result-status" role="alert"><p className="micro-note">{repositoryErrorMessage(repositoryError)}</p><button className="button button-secondary" type="button" onClick={openRanking}>{t("ranking.retry")}</button></div> : null}<div className="leaderboard-card"><div className="leaderboard-head"><span>{t("ranking.player")}</span><span>{t("ranking.score")}</span></div>{rows.map((row) => <div className={`leaderboard-row ${row.displayName === t("ranking.you") ? "leaderboard-row-you" : ""}`} key={`${row.rank}-${row.displayName}`}><span className="leaderboard-place">{String(row.rank).padStart(2, "0")}</span><strong>{row.displayName}</strong><span>{row.totalScore}</span></div>)}</div></section>;
  }

  function renderCategoryRanking() {
    const entries = categoryRanking?.entries ?? [];
    const fallbackCategories = mockDailyChallenge.categories.map((category) => ({ slug: category.slug, labelEs: category.label.es, labelEn: category.label.en, availability: "provisional" as const }));
    const categories = rankingCategories.length > 0 ? rankingCategories : fallbackCategories;
    const isChampionsRanking = selectedRankingCategory === "uefa-champions-league-goals" || selectedRankingCategory === "uefa-champions-league-assists";
    const isWorldCupRanking = selectedRankingCategory === "world-cup-goals";
    const isScopedRanking = isChampionsRanking || isWorldCupRanking;
    const scopeSelector = locale === "es" ? "Alcance del ranking" : "Ranking scope";
    const activeSeasonLabel = locale === "es" ? "Temporada activa + histórico" : "Active season + history";
    const historicalBaseLabel = locale === "es" ? "Histórico completo" : "Complete history";
    const factsLabel = locale === "es" ? "Hechos utilizados" : "Facts used";
    const sourcesLabel = locale === "es" ? "Fuentes" : "Sources";
    const updatedLabel = locale === "es" ? "Actualizado" : "Updated";
    return <section className="simple-view category-ranking-view" aria-labelledby="category-ranking-title"><p className="kicker">{t("categoryRanking.kicker")}</p><h1 id="category-ranking-title">{t("categoryRanking.title")}</h1><p className="simple-lead">{t("categoryRanking.subtitle")}</p><p className="micro-note">{t("categoryRanking.scopeNote")}</p><label className="ranking-selector" htmlFor="ranking-category-select">{t("categoryRanking.selector")}</label><select id="ranking-category-select" value={selectedRankingCategory} onChange={(event) => { const nextCategory = event.target.value; setCategoryRankingState("loading"); setCategoryRanking(null); setSelectedRankingCategory(nextCategory); setSelectedRankingDataset(nextCategory === "world-cup-goals" ? "active_edition_weekly" : "active_season_weekly"); }}>{categories.map((category) => <option value={category.slug} key={category.slug}>{locale === "es" ? category.labelEs : category.labelEn}{category.availability === "provisional" ? ` · ${t("categoryRanking.provisionalShort")}` : ""}</option>)}</select>{isScopedRanking ? <><label className="ranking-selector" htmlFor="ranking-dataset-select">{scopeSelector}</label><select id="ranking-dataset-select" value={selectedRankingDataset} onChange={(event) => { setCategoryRankingState("loading"); setCategoryRanking(null); setSelectedRankingDataset(event.target.value as CategoryRankingDataset); }}><option value={isWorldCupRanking ? "active_edition_weekly" : "active_season_weekly"}>{activeSeasonLabel}</option><option value="historical_base">{historicalBaseLabel}</option></select></> : null}{categoryRankingState === "loading" ? <p className="micro-note" aria-live="polite">{t("categoryRanking.loading")}</p> : null}{categoryRankingState === "error" ? <div className="result-status" role="alert"><p className="micro-note">{repositoryErrorMessage(repositoryError)}</p><button className="button button-secondary" type="button" onClick={openCategoryRanking}>{t("categoryRanking.retry")}</button></div> : null}{categoryRankingState === "ready" && categoryRanking ? <><div className="ranking-status" role="status"><strong>{categoryRanking.status === "official" ? t("categoryRanking.official") : t("categoryRanking.provisional")}</strong><span>{locale === "es" ? categoryRanking.scopeLabelEs ?? t("categoryRanking.historical") : categoryRanking.scopeLabelEn ?? t("categoryRanking.historical")}</span><span>{t("categoryRanking.snapshot", { snapshot: categoryRanking.snapshotId })}</span>{categoryRanking.factCount !== undefined ? <span>{factsLabel}: {categoryRanking.factCount}</span> : null}{categoryRanking.sourceCount !== undefined ? <span>{sourcesLabel}: {categoryRanking.sourceCount}</span> : null}<span>{updatedLabel}: {categoryRanking.generatedAt ?? "—"}</span></div><div className="category-ranking-table" role="table" aria-label={categoryRanking.category.slug}><div className="category-ranking-head" role="row"><span>{t("categoryRanking.rank")}</span><span>{t("categoryRanking.player")}</span><span>{t("categoryRanking.value")}</span><span>{t("categoryRanking.score")}</span></div>{entries.map((entry) => <div className="category-ranking-row" role="row" key={`${entry.entityId}-${entry.rank}`}><span className="leaderboard-place">{String(entry.rank).padStart(2, "0")}{entry.tieGroup !== null ? <small>{t("categoryRanking.tie", { group: entry.tieGroup })}</small> : null}</span><span className="ranking-entity">{entry.imageUrl && entry.imageStatus !== "unavailable" ? <img src={entry.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="ranking-monogram" aria-hidden="true">{entry.canonicalName.slice(0, 2).toUpperCase()}</span>}<strong>{entry.canonicalName}</strong>{!entry.playable ? <small>{t("categoryRanking.notPlayable")}</small> : null}</span><span>{entry.rawValue}</span><span>{entry.scoreValue}</span><details><summary>{t("categoryRanking.details")}</summary><p>{t("categoryRanking.media", { status: t(`categoryRanking.mediaStatus.${entry.imageStatus}` as "categoryRanking.mediaStatus.licensed") })}</p><p>{t("categoryRanking.review", { status: t(`categoryRanking.reviewStatus.${entry.reviewStatus}` as "categoryRanking.reviewStatus.approved") })}</p><p>{t("categoryRanking.rights", { status: t(`categoryRanking.rightsStatus.${entry.rightsStatus}` as "categoryRanking.rightsStatus.approved") })}</p><p>{t("categoryRanking.publishable", { status: entry.isPublishable ? t("categoryRanking.yes") : t("categoryRanking.no") })}</p><p>{t("categoryRanking.source", { date: entry.generatedAt ?? "—" })}</p>{entry.sources?.slice(0, 3).map((source) => <p key={`${source.sourceKey}-${source.sourceRecordId}`}>{source.sourceKey} · {source.sourceRecordId} · {source.contentSha256 ?? "—"}</p>)}</details></div>)}</div></> : null}</section>;
  }

  function renderDuels() {
    const ownToken = duelToken?.code === duel?.code ? duelToken : null;
    const challengeUnavailable = challengeLoadState === "error" && !duel;
    const challengeLoading = challengeLoadState === "loading" && !duel;
    return <section className="simple-view" aria-labelledby="duel-title"><p className="kicker">{t("duels.kicker")}</p><h1 id="duel-title">{t("duels.title")}</h1><p className="simple-lead">{t("duels.subtitle")}</p><div className="duel-card"><div className="duel-code">VS / 01</div><h2>{duel ? `${t("duels.cardTitle")} / ${duel.code}` : t("duels.cardTitle")}</h2><p>{duel ? t(`duels.status.${duel.status}`) : t("duels.cardCopy")}</p>{challengeLoading ? <p className="micro-note duel-status" aria-live="polite">{t("states.loading.copy")}</p> : null}{challengeUnavailable ? <div className="result-status" role="alert"><p className="micro-note">{repositoryErrorMessage(repositoryError)}</p><button className="button button-secondary" type="button" onClick={retryChallenge}>{t("states.error.retry")}</button></div> : null}{duelState === "loading" ? <p className="micro-note duel-status" aria-live="polite">{t("duels.loading")}</p> : null}{duel ? <><div className="duel-actions"><button className="button button-primary" type="button" onClick={copyDuelLink}>{t("duels.copyLink")}</button>{duel.joinable && !ownToken ? <button className="button button-secondary" type="button" onClick={joinDuel}>{t("duels.join")}</button> : null}{ownToken && duel.challenge && (duel.status === "open" || duel.status === "active") ? <button className="button button-secondary" type="button" onClick={startDuelGame}>{t("duels.play")}</button> : null}{ownToken && (duel.status === "completed" || duel.status === "expired") ? <button className="button button-secondary" type="button" onClick={replayDuel}>{t("duels.rematch")}</button> : null}</div>{duel.participants?.length ? <div className="duel-participants">{duel.participants.map((participant) => <div className="duel-participant" key={participant.slot}><span>{participant.slot === ownToken?.slot ? t("duels.you") : t("duels.opponent")}</span><strong>{participant.hasResult ? participant.totalScore : "—"}</strong></div>)}</div> : null}</> : <button className="button button-primary" type="button" onClick={createDuel} disabled={duelState === "loading" || challengeLoadState !== "ready"}>{t("duels.cta")}</button>}{duelMessage ? <p className="micro-note" role="status">{duelMessage}</p> : null}{duelState === "error" && !challengeUnavailable ? <button className="button button-secondary" type="button" onClick={() => duel ? openDuel(duel.code) : createDuel()}>{t("duels.retry")}</button> : null}</div><div className="duel-open-card"><label htmlFor="duel-code">{t("duels.codeLabel")}</label><div><input id="duel-code" value={duelCodeInput} onChange={(event) => setDuelCodeInput(event.target.value.toUpperCase())} placeholder={t("duels.codePlaceholder")} maxLength={20} /><button className="button button-dark" type="button" onClick={() => openDuel()} disabled={!duelCodeInput || duelState === "loading"}>{t("duels.open")}</button></div></div><p className="micro-note">{t("duels.note")}</p></section>;
  }

  function renderAccount() {
    return <section className="simple-view" aria-labelledby="account-title"><p className="kicker">{t("account.kicker")}</p><h1 id="account-title">{t("account.title")}</h1><p className="simple-lead">{t("account.subtitle")}</p><div className="account-card"><div className="account-mark">ID</div><div><h2>{authUser ? authUser.displayName : t("account.guestTitle")}</h2><p>{authUser ? authUser.email : t("account.guestCopy")}</p></div>{authUser ? <button className="button button-primary" type="button" onClick={() => void logout()} disabled={authBusy}>{t("auth.logout")}</button> : <button className="button button-primary" type="button" onClick={openAccountPanel}>{t("account.cta")}</button>}</div></section>;
  }

  function renderOverlays() {
    return <>
      {showCategoryInfo ? <div className="modal-scrim" role="presentation" onClick={() => setShowCategoryInfo(false)}><section className="modal-panel category-info-panel" role="dialog" aria-modal="true" aria-labelledby="category-info-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="kicker">{t("info.kicker")}</p><h2 id="category-info-title">{t("info.title")}</h2></div><button className="modal-close" type="button" onClick={() => setShowCategoryInfo(false)} aria-label={t("info.close")}>×</button></div><p className="modal-lead">{t("info.subtitle")}</p><div className="info-list">{mockDailyChallenge.categories.map((category) => <div className="info-row" key={category.slug}><span className="category-mark">{category.code}</span><div><strong>{category.label[locale]}</strong><p>{category.definition[locale]}</p></div></div>)}</div></section></div> : null}
      {showAccountPanel ? <div className="modal-scrim" role="presentation" onClick={() => setShowAccountPanel(false)}><section className="modal-panel auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="kicker">{t("auth.kicker")}</p><h2 id="auth-title">{t("auth.title")}</h2></div><button className="modal-close" type="button" onClick={() => setShowAccountPanel(false)} aria-label={t("auth.close")}>×</button></div><p className="modal-lead">{t("auth.subtitle")}</p>{authUser ? <><p className="auth-message" role="status">{authUser.displayName} · {authUser.email}</p><button className="button button-secondary" type="button" onClick={() => void logout()} disabled={authBusy}>{t("auth.logout")}</button></> : <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>{authMode === "register" ? <label>{t("auth.displayName")}<input required value={authDisplayName} onChange={(event) => setAuthDisplayName(event.target.value)} autoComplete="name" /></label> : null}<label>{t("auth.email")}<input required type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" /></label><label>{t("auth.password")}<input required minLength={8} type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} autoComplete={authMode === "register" ? "new-password" : "current-password"} placeholder="••••••••" /></label><button className="button button-primary" type="submit" disabled={authBusy}>{authMode === "register" ? t("auth.register") : t("auth.submit")}</button><button className="button button-secondary" type="button" onClick={startGoogleAuth} disabled={authBusy}>{t("auth.google")}</button></form>}{authMessage ? <p className="auth-message" role="status">{authMessage}</p> : null}{!authUser ? <button className="auth-switch" type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthMessage(""); }}>{authMode === "login" ? t("auth.switchToRegister") : t("auth.switchToLogin")}</button> : null}<p className="micro-note">{t("auth.note")}</p></section></div> : null}
    </>;
  }

  const labMode = runtimeConfig?.runtimeMode === "lab" || challenge.runtimeMode === "lab";
  return <main className={`app-shell ${view === "game" ? "app-shell-game" : ""}`}>{renderHeader()}{labMode ? <div className="runtime-banner" role="status"><strong>{t("runtime.labTitle")}</strong><span>{t("runtime.provisional")}</span><small>{t("runtime.notOfficial")}</small></div> : null}{isOffline ? <div className="offline-banner" role="status">{t("offline.banner")}</div> : null}<div className="app-content">{flowState === "starting_game" ? renderStartingGame() : null}{flowState !== "starting_game" && challengeLoadState === "loading" && view !== "duels" ? renderChallengeLoading() : null}{flowState !== "starting_game" && challengeLoadState === "error" && view !== "duels" ? renderChallengeError() : null}{flowState !== "starting_game" && (challengeLoadState === "ready" || view === "duels") && view === "home" ? renderHome() : null}{flowState !== "starting_game" && (challengeLoadState === "ready" || view === "duels") && view === "game" ? renderGame() : null}{flowState !== "starting_game" && (challengeLoadState === "ready" || view === "duels") && view === "result" ? renderResult() : null}{flowState !== "starting_game" && (challengeLoadState === "ready" || view === "duels") && view === "ranking" ? renderRanking() : null}{flowState !== "starting_game" && (challengeLoadState === "ready" || view === "duels") && view === "category-ranking" ? renderCategoryRanking() : null}{flowState !== "starting_game" && (challengeLoadState === "ready" || view === "duels") && view === "duels" ? renderDuels() : null}{flowState !== "starting_game" && (challengeLoadState === "ready" || view === "duels") && view === "account" ? renderAccount() : null}</div>{renderNav()}{renderOverlays()}</main>;
}
