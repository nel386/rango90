"use client";

/* Dynamic media comes from the API and is already served as an unoptimized local asset. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import { createGameRepository, RepositoryError, type AuthUser, type DuelState, type GameResult, type GameSession, type LeaderboardEntry } from "@/data/game-repository";
import type { Locale, MockCategory, MockChallenge, MockEntity } from "@/data/game-types";

type View = "home" | "game" | "result" | "ranking" | "duels" | "account";
type GamePhase = "playing" | "feedback" | "finished" | "abandoned";
type ChallengeLoadState = "ready" | "loading" | "error";
type Assignment = { ordinal: number; entity: MockEntity; category: MockCategory; score: number | null; timedOut?: boolean };
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
  return Math.max(0, Math.ceil((Date.parse(isoDate) - Date.now()) / 1000));
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
  const initialDuelCode = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("duel")?.toUpperCase() ?? "";
  const [view, setView] = useState<View>(initialDuelCode ? "duels" : "home");
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [gameMode, setGameMode] = useState<GameMode>("daily");
  const [challenge, setChallenge] = useState(fallbackChallenge);
  const [challengeLoadState, setChallengeLoadState] = useState<ChallengeLoadState>("loading");
  const [secondsLeft, setSecondsLeft] = useState(fallbackChallenge.timeLimitSeconds);
  const [session, setSession] = useState<GameSession | null>(null);
  const [officialResult, setOfficialResult] = useState<GameResult | null>(null);
  const [repositoryError, setRepositoryError] = useState<RepositoryError | null>(null);
  const [entityIndex, setEntityIndex] = useState(0);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
  const [submissionState, setSubmissionState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [leaderboardEligible, setLeaderboardEligible] = useState<boolean | null>(null);
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [duelCodeInput, setDuelCodeInput] = useState(initialDuelCode);
  const [duelState, setDuelState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [duelMessage, setDuelMessage] = useState("");
  const [duelToken, setDuelToken] = useState<DuelToken | null>(null);
  const [activeDuel, setActiveDuel] = useState<ActiveDuel | null>(null);
  const [duelComparisonState, setDuelComparisonState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [submissionDuplicate, setSubmissionDuplicate] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const timeoutHandled = useRef(false);
  const submittedResultKey = useRef<string | null>(null);
  const expireRequestStarted = useRef(false);
  const secondsLeftRef = useRef(fallbackChallenge.timeLimitSeconds);

  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

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
  const applyOfficialResult = useCallback((result: GameResult) => {
    setOfficialResult(result);
    setAssignments(result.assignments.map((assignment) => {
      const entity = mockDailyChallenge.entities.find((item) => item.id === assignment.entityId) ?? mockDailyChallenge.entities[assignment.ordinal];
      const category = mockDailyChallenge.categories.find((item) => item.slug === assignment.categorySlug) ?? mockDailyChallenge.categories[assignment.ordinal];
      return { ordinal: assignment.ordinal, entity: entity ?? mockDailyChallenge.entities[0], category: category ?? mockDailyChallenge.categories[0], score: assignment.scoreValue, timedOut: assignment.timedOut };
    }).filter((assignment) => Boolean(assignment.entity && assignment.category)));
  }, [mockDailyChallenge]);

  useEffect(() => {
    let active = true;
    gameRepository.getDailyChallenge().then((loadedChallenge) => {
      if (!active) return;
      setChallenge(loadedChallenge);
      setSecondsLeft(loadedChallenge.timeLimitSeconds);
      setChallengeLoadState("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline"));
      setChallengeLoadState("error");
    });
    return () => { active = false; };
  }, []);

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
    if (timeoutHandled.current || (phase === "finished" && !timedOut && repositoryError?.code !== "time_expired") || phase === "abandoned") return;
    timeoutHandled.current = true;
    const used = new Set(assignments.map((assignment) => assignment.category.slug));
    const categories = mockDailyChallenge.categories.filter((category) => !used.has(category.slug));
    const entities = mockDailyChallenge.entities.slice(assignments.length);
    const timeoutAssignments: Assignment[] = [];
    entities.forEach((entity, index) => {
      const category = categories[index];
      if (category) timeoutAssignments.push({ ordinal: entity.ordinal ?? assignments.length + index, entity, category, score: null, timedOut: true });
    });
    const claims = assignments.map((assignment) => ({ ordinal: assignment.ordinal, entityId: assignment.entity.id, categorySlug: assignment.category.slug, ...(assignment.timedOut ? { timedOut: true } : {}) }));
    timeoutAssignments.forEach((assignment) => claims.push({ ordinal: assignment.ordinal, entityId: assignment.entity.id, categorySlug: assignment.category.slug, timedOut: true }));
    setAssignments([...assignments, ...timeoutAssignments]);
    setTimedOut(true);
    setPhase("finished");
    expireRequestStarted.current = true;
    setSubmissionState("saving");
    if (gameMode === "duel" && activeDuel) {
      gameRepository.submitDuelResult(activeDuel.code, activeDuel.token, claims).then((response) => {
        applyOfficialResult(response.result);
        setLeaderboardEligible(response.leaderboardEligible);
        setSubmissionDuplicate(response.duplicate);
        setSubmissionState("saved");
        void refreshDuelComparison(activeDuel.code, activeDuel.slot);
      }).catch((error: unknown) => {
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
      applyOfficialResult(response.result);
      setLeaderboardEligible(response.leaderboardEligible);
      setSubmissionDuplicate(response.duplicate);
      setSubmissionState("saved");
    }).catch((error: unknown) => {
      setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline"));
      setSubmissionState("error");
    });
  }, [activeDuel, applyOfficialResult, assignments, gameMode, mockDailyChallenge, phase, repositoryError, session, timedOut]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view !== "game" || (phase !== "playing" && phase !== "feedback")) return;
    const timer = window.setInterval(() => {
      if (secondsLeftRef.current <= 1) {
        secondsLeftRef.current = 0;
        setSecondsLeft(0);
        expireCurrentGame();
        return;
      }
      secondsLeftRef.current -= 1;
      setSecondsLeft(secondsLeftRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
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
    if (view !== "result" || assignments.length !== mockDailyChallenge.entities.length) return;
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
      applyOfficialResult(response.result);
      setLeaderboardEligible(response.leaderboardEligible);
      setSubmissionDuplicate(response.duplicate);
      setSubmissionState("saved");
      if (gameMode === "duel" && activeDuel) void refreshDuelComparison(activeDuel.code, activeDuel.slot);
    }).catch((error: unknown) => {
      setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline"));
      setSubmissionState("error");
    });
  }, [activeDuel, applyOfficialResult, assignments, gameMode, mockDailyChallenge.entities.length, mockDailyChallenge.id, officialResult, session, view]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startDaily() {
    setChallengeLoadState("loading");
    setRepositoryError(null);
    try {
      const loadedChallenge = await gameRepository.getDailyChallenge();
      const startedSession = await gameRepository.startGame(loadedChallenge.id);
      setChallenge(startedSession.challenge);
      setGameMode("daily");
      setSession(startedSession);
      setActiveDuel(null);
      setDuelToken(null);
      setAssignments([]);
      setEntityIndex(0);
      setSelectedCategory(null);
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
      setPhase("playing");
      setChallengeLoadState("ready");
      setView("game");
    } catch (error: unknown) {
      setRepositoryError(error instanceof RepositoryError ? error : new RepositoryError("Backend unavailable", "offline"));
      setChallengeLoadState("error");
    }
  }

  function retryChallenge() {
    startDaily();
  }

  function abandonGame() {
    if (view !== "game" || phase === "finished" || phase === "abandoned") return;
    setPhase("abandoned");
  }

  function resetGameToHome() {
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

  function startGoogleAuth() {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (!baseUrl) {
      setAuthMessage(t("errors.server"));
      return;
    }
    window.open(`${baseUrl.replace(/\/$/u, "")}/v1/auth/google/start?returnTo=${encodeURIComponent(window.location.href)}`, "_self", "noopener,noreferrer");
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
    if (!initialDuelCode) return;
    const timer = window.setTimeout(() => void openDuel(initialDuelCode), 0);
    return () => window.clearTimeout(timer);
    // The URL is read once on mount; the async handler owns its state updates.
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
    setPhase("playing");
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

  function assignCategory(category: MockCategory) {
    if (!currentEntity || phase !== "playing" || usedCategorySlugs.has(category.slug)) return;
    setSelectedCategory(category.slug);
    setAssignments((current) => [...current, { ordinal: currentEntity.ordinal ?? entityIndex, entity: currentEntity, category, score: null }]);
    setPhase("feedback");
  }

  function continueGame() {
    if (secondsLeft <= 0) {
      expireCurrentGame();
      return;
    }
    if (entityIndex >= mockDailyChallenge.entities.length - 1) {
      setPhase("finished");
      return;
    }
    setEntityIndex((current) => current + 1);
    setSelectedCategory(null);
    setPhase("playing");
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
    return <nav className="bottom-nav" aria-label={t("navigation.label")}>
      <button className={view === "home" || view === "game" || view === "result" ? "active" : ""} onClick={resetToHome} type="button"><span className="nav-mark">01</span>{t("navigation.home")}</button>
      <button className={view === "ranking" ? "active" : ""} onClick={openRanking} type="button"><span className="nav-mark">90</span>{t("navigation.ranking")}</button>
      <button className={view === "duels" ? "active" : ""} onClick={() => setView("duels")} type="button"><span className="nav-mark">VS</span>{t("navigation.duels")}</button>
      <button className={view === "account" ? "active" : ""} onClick={() => setView("account")} type="button"><span className="nav-mark">ID</span>{t("navigation.account")}</button>
    </nav>;
  }

  function renderChallengeLoading() {
    return <section className="state-view" aria-live="polite"><div className="state-index">01 / {t("states.loading.code")}</div><div className="state-pulse" aria-hidden="true" /><p className="kicker">{t("states.loading.kicker")}</p><h1>{t("states.loading.title")}</h1><p>{t("states.loading.copy")}</p></section>;
  }

  function renderChallengeError() {
    return <section className="state-view state-view-error" role="alert"><div className="state-index">ERR / 01</div><p className="kicker">{t("states.error.kicker")}</p><h1>{t("states.error.title")}</h1><p>{repositoryError ? repositoryErrorMessage(repositoryError) : t("states.error.copy")}</p><button className="button button-primary" type="button" onClick={retryChallenge}>{t("states.error.retry")}</button><button className="text-button" type="button" onClick={resetGameToHome}>{t("states.error.home")}</button></section>;
  }

  function renderHome() {
    return <section className="home-view" aria-labelledby="home-title">
      <div className="home-intro"><p className="kicker">{t("home.kicker")}</p><h1 id="home-title">{t("home.title")}</h1><p className="home-description">{t("home.description")}</p></div>
      <div className="hero-grid">
        <article className="daily-card"><div className="card-index">01 / {t("home.daily.label")}</div><div className="daily-card-content"><p className="card-overline">{t("home.daily.overline")}</p><h2>{mockDailyChallenge.title[locale]}</h2><p>{mockDailyChallenge.subtitle[locale]}</p><div className="daily-meta"><span>{t("home.daily.categories", { count: mockDailyChallenge.categories.length })}</span><span>{t("home.daily.time", { seconds: mockDailyChallenge.timeLimitSeconds })}</span></div><button className="button button-primary" type="button" onClick={startDaily}>{t("home.daily.cta")} <span aria-hidden="true">↗</span></button></div></article>
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
    const isLastDecision = entityIndex === mockDailyChallenge.entities.length - 1;
    const scoreDisplay = assignments.some((assignment) => assignment.score !== null) ? totalScore : "—";
    return <section className="game-view" aria-labelledby="game-title">
      <div className="game-topline"><div><p className="kicker">{t("game.kicker")}</p><h1 id="game-title">{mockDailyChallenge.title[locale]}</h1></div><div className="game-topline-actions"><div className={`timer ${secondsLeft <= 20 ? "timer-warning" : ""}`} aria-label={t("game.timerLabel")}><span aria-live="polite">{formatTime(secondsLeft)}</span><small>{t("game.remaining")}</small></div><button className="abandon-button" type="button" onClick={abandonGame} disabled={phase === "finished" || phase === "abandoned"}>{t("game.abandon")}</button></div></div>
      <div className="game-scoreline"><div><span>{t("game.score")}</span><strong>{scoreDisplay}</strong></div><div className="game-progress" aria-label={t("game.progressLabel", { current: Math.min(assignments.length, decisionCount), total: decisionCount })}><span>{String(Math.min(assignments.length, decisionCount)).padStart(2, "0")}</span><div className="progress-track"><span style={{ width: `${Math.min(progress, 1) * 100}%` }} /></div><span>{String(decisionCount).padStart(2, "0")}</span></div><div className="game-target"><span>{t("game.target")}</span><strong>{mockDailyChallenge.scoreCap ?? "—"}</strong></div></div>
      <div className="decision-layout">
        <article className="entity-card"><div className="entity-card-topline"><span>{t("game.entityPosition", { current: Math.min(entityIndex + 1, decisionCount), total: decisionCount })}</span><span className="entity-type">{currentEntity ? currentEntity.entityType === "player" ? t("game.entityType.player") : currentEntity.entityType === "club" ? t("game.entityType.club") : t("game.entityType.nationalTeam") : null}</span></div>{currentEntity ? <>{currentEntity.imageUrl ? <img className="entity-image" src={currentEntity.imageUrl} alt={currentEntity.name} loading="eager" onError={(event) => { if (currentEntity.imageFallbackUrl && event.currentTarget.src !== currentEntity.imageFallbackUrl) event.currentTarget.src = currentEntity.imageFallbackUrl; }} /> : <div className="entity-monogram" aria-hidden="true">{currentEntity.shortName}</div>}<h2>{currentEntity.name}</h2><p>{t("game.entityPrompt")}</p></> : null}</article>
        <div className="category-panel"><div className="panel-heading"><div><p className="kicker">{t("game.categoryKicker")}</p><h2>{t("game.categoryTitle")}</h2></div><button className="icon-button" type="button" onClick={() => setShowCategoryInfo(true)} aria-label={t("game.infoLabel")}>i</button></div><div className="category-list">
          {mockDailyChallenge.categories.map((category) => { const assignment = assignments.find((item) => item.category.slug === category.slug); const isUsed = Boolean(assignment); return <button className={`category-row ${isUsed ? "category-row-used" : ""} ${selectedCategory === category.slug ? "category-row-selected" : ""}`} disabled={isUsed || phase !== "playing"} key={category.slug} onClick={() => assignCategory(category)} type="button"><span className="category-mark" aria-hidden="true">{category.code}</span><span className="category-copy"><strong>{category.label[locale]}</strong><small>{isUsed ? t("game.used") : t("game.available")}</small></span>{assignment ? <span className={`category-score ${assignment.score === null ? "score-pending" : assignment.score >= 70 ? "score-bad" : assignment.score >= 25 ? "score-mid" : "score-good"}`}>{assignment.score === null ? "—" : `+${assignment.score}`}</span> : <span className="category-arrow" aria-hidden="true">↗</span>}</button>; })}
        </div>
        {phase === "feedback" && latestAssignment ? <div className={`feedback-card ${latestAssignment.score === null ? "feedback-pending" : latestAssignment.score >= 70 ? "feedback-bad" : latestAssignment.score >= 25 ? "feedback-mid" : "feedback-good"}`}><div><span className="feedback-label">{t("game.feedback.label")}</span><strong>{latestAssignment.entity.name}</strong></div><div className="feedback-score"><strong>{latestAssignment.score === null ? "—" : latestAssignment.score}</strong><span>{latestAssignment.score === null ? t("game.feedback.pending") : t("game.feedback.points")}</span></div><p>{latestAssignment.score === null ? t("game.feedback.pendingCopy") : t("game.feedback.copy", { category: latestAssignment.category.label[locale] })}</p><button className="button button-dark" type="button" onClick={continueGame}>{isLastDecision ? t("game.finish") : t("game.next")} <span aria-hidden="true">↗</span></button></div> : null}
        {phase === "finished" ? <div className="feedback-card feedback-timeout"><div><span className="feedback-label">{t(timedOut ? "game.timeout.label" : "game.complete.label")}</span><strong>{t(timedOut ? "game.timeout.title" : "game.complete.title")}</strong></div><p>{t(timedOut ? "game.timeout.copy" : "game.complete.copy")}</p><button className="button button-dark" type="button" onClick={() => setView("result")}>{t("game.resultCta")} <span aria-hidden="true">↗</span></button></div> : null}
        {phase === "abandoned" ? <div className="feedback-card feedback-abandoned"><div><span className="feedback-label">{t("game.abandoned.label")}</span><strong>{t("game.abandoned.title")}</strong></div><p>{t("game.abandoned.copy")}</p><div className="feedback-actions"><button className="button button-dark" type="button" onClick={startDaily}>{t("game.abandoned.restart")}</button><button className="button button-secondary" type="button" onClick={resetGameToHome}>{t("game.abandoned.home")}</button></div></div> : null}
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
    return <section className="simple-view" aria-labelledby="ranking-title"><p className="kicker">{t("ranking.kicker")}</p><h1 id="ranking-title">{t("ranking.title")}</h1><p className="simple-lead">{t("ranking.subtitle")}</p>{leaderboardState === "loading" ? <p className="micro-note">{t("ranking.loading")}</p> : null}{leaderboardState === "error" ? <div className="result-status" role="alert"><p className="micro-note">{repositoryErrorMessage(repositoryError)}</p><button className="button button-secondary" type="button" onClick={openRanking}>{t("ranking.retry")}</button></div> : null}<div className="leaderboard-card"><div className="leaderboard-head"><span>{t("ranking.player")}</span><span>{t("ranking.score")}</span></div>{rows.map((row) => <div className={`leaderboard-row ${row.displayName === t("ranking.you") ? "leaderboard-row-you" : ""}`} key={`${row.rank}-${row.displayName}`}><span className="leaderboard-place">{String(row.rank).padStart(2, "0")}</span><strong>{row.displayName}</strong><span>{row.totalScore}</span></div>)}</div></section>;
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

  return <main className="app-shell">{renderHeader()}{isOffline ? <div className="offline-banner" role="status">{t("offline.banner")}</div> : null}<div className="app-content">{challengeLoadState === "loading" && view !== "duels" ? renderChallengeLoading() : null}{challengeLoadState === "error" && view !== "duels" ? renderChallengeError() : null}{(challengeLoadState === "ready" || view === "duels") && view === "home" ? renderHome() : null}{(challengeLoadState === "ready" || view === "duels") && view === "game" ? renderGame() : null}{(challengeLoadState === "ready" || view === "duels") && view === "result" ? renderResult() : null}{(challengeLoadState === "ready" || view === "duels") && view === "ranking" ? renderRanking() : null}{(challengeLoadState === "ready" || view === "duels") && view === "duels" ? renderDuels() : null}{(challengeLoadState === "ready" || view === "duels") && view === "account" ? renderAccount() : null}</div>{renderNav()}{renderOverlays()}</main>;
}
