import { createHash } from 'node:crypto';

export const GAME_ENGINE_VERSION = 'game-engine-v1';

export type GameCategory = {
  slug: string;
};

/**
 * A published challenge contains the server-side answer matrix. It is a
 * snapshot of game data, not a database row or a live ranking query.
 */
export type GameDecision = {
  ordinal: number;
  entityId: string;
  scoreByCategory: Readonly<Record<string, number>>;
};

export type PublishedGameChallenge = {
  id: string;
  sourceVersion: string;
  challengeSha256: string;
  timeLimitSeconds: number;
  scoreCap: number;
  categories: readonly GameCategory[];
  decisions: readonly GameDecision[];
};

export type DecisionSubmission = {
  ordinal: number;
  entityId: string;
  categorySlug: string;
};

export type GameAssignment = {
  ordinal: number;
  entityId: string;
  categorySlug: string;
  scoreValue: number;
  timedOut: boolean;
};

export type SubmittedAssignment = Pick<GameAssignment, 'ordinal' | 'entityId' | 'categorySlug'> & { timedOut?: boolean };

export type GameState = {
  challengeId: string;
  sourceVersion: string;
  challengeSha256: string;
  startedAtMs: number;
  deadlineAtMs: number;
  currentOrdinal: number;
  assignments: readonly GameAssignment[];
  phase: 'playing' | 'finished';
  timedOut: boolean;
  finishedAtMs?: number;
};

export type GameResult = {
  challengeId: string;
  sourceVersion: string;
  challengeSha256: string;
  engineVersion: typeof GAME_ENGINE_VERSION;
  startedAtMs: number;
  finishedAtMs: number;
  elapsedMilliseconds: number;
  elapsedSeconds: number;
  timedOut: boolean;
  assignments: readonly GameAssignment[];
  totalScore: number;
  resultHash: string;
};

export type PresentedDecision = {
  ordinal: number;
  entityId: string;
  availableCategorySlugs: readonly string[];
};

export type GameErrorCode =
  | 'challenge_invalid'
  | 'clock_invalid'
  | 'game_finished'
  | 'decision_order_invalid'
  | 'entity_invalid'
  | 'category_invalid'
  | 'category_already_used'
  | 'answer_invalid'
  | 'time_expired'
  | 'time_not_expired'
  | 'result_incomplete'
  | 'result_invalid'
  | 'submission_conflict';

export class GameRuleError extends Error {
  readonly code: GameErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: GameErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
    this.details = details;
  }
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function assertChallenge(challenge: PublishedGameChallenge): void {
  if (!challenge.id || !challenge.sourceVersion || !/^[0-9a-f]{64}$/.test(challenge.challengeSha256) || !isPositiveSafeInteger(challenge.timeLimitSeconds) || !isPositiveSafeInteger(challenge.scoreCap) || !Number.isSafeInteger(challenge.timeLimitSeconds * 1000)) {
    throw new GameRuleError('challenge_invalid', 'El reto publicado tiene metadatos inválidos');
  }
  if (challenge.categories.length === 0 || challenge.categories.length !== challenge.decisions.length) {
    throw new GameRuleError('challenge_invalid', 'El reto debe tener el mismo número de categorías y decisiones');
  }

  const categorySlugs = new Set<string>();
  for (const category of challenge.categories) {
    if (!category.slug || categorySlugs.has(category.slug)) {
      throw new GameRuleError('challenge_invalid', `Categoría duplicada o vacía: ${category.slug}`);
    }
    categorySlugs.add(category.slug);
  }

  const entityIds = new Set<string>();
  for (const [index, decision] of challenge.decisions.entries()) {
    if (decision.ordinal !== index || !decision.entityId || entityIds.has(decision.entityId)) {
      throw new GameRuleError('challenge_invalid', `Orden o entidad duplicada en la decisión ${index}`);
    }
    entityIds.add(decision.entityId);
    const answerSlugs = Object.keys(decision.scoreByCategory);
    if (answerSlugs.length !== categorySlugs.size || answerSlugs.some((slug) => !categorySlugs.has(slug))) {
      throw new GameRuleError('challenge_invalid', `Matriz de respuestas incompleta en la decisión ${index}`);
    }
    for (const slug of categorySlugs) {
      const score = decision.scoreByCategory[slug];
      if (score === undefined || !Number.isSafeInteger(score) || score < 1 || score > challenge.scoreCap) {
        throw new GameRuleError('challenge_invalid', `Puntuación inválida para ${decision.entityId}/${slug}`);
      }
    }
  }
}

function assertClock(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new GameRuleError('clock_invalid', 'La marca temporal debe ser un milisegundo entero no negativo');
  }
}

function assertStateMatches(challenge: PublishedGameChallenge, state: GameState): void {
  if (state.challengeId !== challenge.id || state.sourceVersion !== challenge.sourceVersion || state.challengeSha256 !== challenge.challengeSha256) {
    throw new GameRuleError('challenge_invalid', 'La partida no pertenece a la versión del reto publicado');
  }
  if (!Number.isSafeInteger(state.startedAtMs) || !Number.isSafeInteger(state.deadlineAtMs) || state.deadlineAtMs <= state.startedAtMs) {
    throw new GameRuleError('clock_invalid', 'La partida contiene un intervalo temporal inválido');
  }
  if (state.currentOrdinal !== state.assignments.length || state.currentOrdinal < 0 || state.currentOrdinal > challenge.decisions.length) {
    throw new GameRuleError('result_invalid', 'El estado de la partida no es consistente');
  }
}

function usedCategories(state: GameState): Set<string> {
  return new Set(state.assignments.map((assignment) => assignment.categorySlug));
}

export function startGame(challenge: PublishedGameChallenge, startedAtMs: number): GameState {
  assertChallenge(challenge);
  assertClock(startedAtMs);
  return {
    challengeId: challenge.id,
    sourceVersion: challenge.sourceVersion,
    challengeSha256: challenge.challengeSha256,
    startedAtMs,
    deadlineAtMs: startedAtMs + challenge.timeLimitSeconds * 1000,
    currentOrdinal: 0,
    assignments: [],
    phase: 'playing',
    timedOut: false
  };
}

/** Returns only data safe to present to a client; scores remain server-side. */
export function getCurrentDecision(challenge: PublishedGameChallenge, state: GameState): PresentedDecision | null {
  assertChallenge(challenge);
  assertStateMatches(challenge, state);
  if (state.phase === 'finished') return null;
  const decision = challenge.decisions[state.currentOrdinal];
  if (!decision) return null;
  const used = usedCategories(state);
  return {
    ordinal: decision.ordinal,
    entityId: decision.entityId,
    availableCategorySlugs: challenge.categories.filter((category) => !used.has(category.slug)).map((category) => category.slug)
  };
}

function finishState(state: GameState, assignments: readonly GameAssignment[], finishedAtMs: number, timedOut: boolean): GameState {
  return {
    ...state,
    currentOrdinal: assignments.length,
    assignments,
    phase: 'finished',
    timedOut,
    finishedAtMs
  };
}

/**
 * Completes every unanswered decision with the remaining categories in their
 * published order and the score cap. It is deliberately deterministic.
 */
export function expireGame(challenge: PublishedGameChallenge, state: GameState, nowMs: number): GameState {
  assertChallenge(challenge);
  assertStateMatches(challenge, state);
  assertClock(nowMs);
  if (state.phase === 'finished') return state;
  if (nowMs < state.deadlineAtMs) {
    throw new GameRuleError('time_not_expired', 'La partida todavía no ha agotado el tiempo');
  }

  const used = usedCategories(state);
  const remainingCategories = challenge.categories.filter((category) => !used.has(category.slug));
  const timeoutAssignments = challenge.decisions.slice(state.currentOrdinal).map((decision, index) => ({
    ordinal: decision.ordinal,
    entityId: decision.entityId,
    categorySlug: remainingCategories[index]?.slug ?? '',
    scoreValue: challenge.scoreCap,
    timedOut: true
  }));
  if (timeoutAssignments.some((assignment) => !assignment.categorySlug)) {
    throw new GameRuleError('challenge_invalid', 'No hay categorías suficientes para completar el timeout');
  }
  return finishState(state, [...state.assignments, ...timeoutAssignments], state.deadlineAtMs, true);
}

export function submitDecision(challenge: PublishedGameChallenge, state: GameState, submission: DecisionSubmission, nowMs: number): GameState {
  assertChallenge(challenge);
  assertStateMatches(challenge, state);
  assertClock(nowMs);
  if (nowMs < state.startedAtMs) throw new GameRuleError('clock_invalid', 'La respuesta precede al inicio de la partida');
  if (state.phase === 'finished') throw new GameRuleError('game_finished', 'La partida ya ha finalizado');
  if (nowMs >= state.deadlineAtMs) return expireGame(challenge, state, nowMs);

  const decision = challenge.decisions[state.currentOrdinal];
  if (!decision) throw new GameRuleError('result_incomplete', 'No queda ninguna decisión pendiente');
  if (submission.ordinal !== decision.ordinal) {
    throw new GameRuleError('decision_order_invalid', 'La decisión no corresponde al turno actual', { expectedOrdinal: decision.ordinal });
  }
  if (submission.entityId !== decision.entityId) {
    throw new GameRuleError('entity_invalid', 'La entidad no corresponde al turno actual', { expectedEntityId: decision.entityId });
  }
  if (!Object.prototype.hasOwnProperty.call(decision.scoreByCategory, submission.categorySlug)) {
    throw new GameRuleError('answer_invalid', 'La categoría no es una respuesta válida para esta decisión');
  }
  if (usedCategories(state).has(submission.categorySlug)) {
    throw new GameRuleError('category_already_used', 'La categoría ya fue utilizada');
  }

  const assignment: GameAssignment = {
    ordinal: decision.ordinal,
    entityId: decision.entityId,
    categorySlug: submission.categorySlug,
    scoreValue: decision.scoreByCategory[submission.categorySlug] as number,
    timedOut: false
  };
  const assignments = [...state.assignments, assignment];
  return assignments.length === challenge.decisions.length
    ? finishState(state, assignments, nowMs, false)
    : { ...state, currentOrdinal: assignments.length, assignments };
}

export function finishGame(challenge: PublishedGameChallenge, state: GameState, finishedAtMs: number): GameState {
  assertChallenge(challenge);
  assertStateMatches(challenge, state);
  assertClock(finishedAtMs);
  if (state.phase === 'finished') return state;
  if (finishedAtMs < state.startedAtMs) throw new GameRuleError('clock_invalid', 'El final precede al inicio de la partida');
  if (finishedAtMs >= state.deadlineAtMs) return expireGame(challenge, state, finishedAtMs);
  throw new GameRuleError('result_incomplete', 'No se puede finalizar una partida con decisiones pendientes');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function resultHashPayload(result: Omit<GameResult, 'resultHash'>): string {
  return stableSerialize(result);
}

function makeResult(challenge: PublishedGameChallenge, state: GameState): GameResult {
  if (state.phase !== 'finished' || state.assignments.length !== challenge.decisions.length || state.finishedAtMs === undefined) {
    throw new GameRuleError('result_incomplete', 'La partida no tiene un resultado completo');
  }
  const elapsedMilliseconds = state.finishedAtMs - state.startedAtMs;
  const base: Omit<GameResult, 'resultHash'> = {
    challengeId: challenge.id,
    sourceVersion: challenge.sourceVersion,
    challengeSha256: challenge.challengeSha256,
    engineVersion: GAME_ENGINE_VERSION,
    startedAtMs: state.startedAtMs,
    finishedAtMs: state.finishedAtMs,
    elapsedMilliseconds,
    elapsedSeconds: Math.floor(elapsedMilliseconds / 1000),
    timedOut: state.timedOut,
    assignments: state.assignments,
    totalScore: state.assignments.reduce((sum, assignment) => sum + assignment.scoreValue, 0)
  };
  return { ...base, resultHash: createHash('sha256').update(resultHashPayload(base)).digest('hex') };
}

export function calculateGameResult(challenge: PublishedGameChallenge, state: GameState): GameResult {
  assertChallenge(challenge);
  assertStateMatches(challenge, state);
  return makeResult(challenge, state);
}

/**
 * Builds the official result from client choices. Scores, timeout flags and
 * the hash are derived here; none of them are accepted from the client.
 */
export function buildOfficialGameResult(
  challenge: PublishedGameChallenge,
  input: { startedAtMs: number; finishedAtMs: number; assignments: readonly SubmittedAssignment[] }
): GameResult {
  assertChallenge(challenge);
  assertClock(input.startedAtMs);
  assertClock(input.finishedAtMs);
  const timeoutIndex = input.assignments.findIndex((assignment) => assignment.timedOut === true);
  const timedOut = timeoutIndex >= 0;
  const assignments: GameAssignment[] = input.assignments.map((submitted, index) => {
    const decision = challenge.decisions[index];
    const score = decision?.scoreByCategory[submitted.categorySlug];
    const assignmentTimedOut = timedOut && index >= timeoutIndex;
    if (assignmentTimedOut) {
      return { ...submitted, scoreValue: challenge.scoreCap, timedOut: true };
    }
    if (score === undefined) throw new GameRuleError('answer_invalid', 'La asignación enviada no es una respuesta válida');
    return { ...submitted, scoreValue: score, timedOut: false };
  });
  const state: GameState = {
    challengeId: challenge.id,
    sourceVersion: challenge.sourceVersion,
    challengeSha256: challenge.challengeSha256,
    startedAtMs: input.startedAtMs,
    deadlineAtMs: input.startedAtMs + challenge.timeLimitSeconds * 1000,
    currentOrdinal: assignments.length,
    assignments,
    phase: 'finished',
    timedOut,
    finishedAtMs: input.finishedAtMs
  };
  const result = makeResult(challenge, state);
  const validation = validateGameResult(challenge, result);
  if (!validation.valid) throw new GameRuleError('result_invalid', validation.message);
  return result;
}

export function compareResults(left: GameResult, right: GameResult): number {
  if (left.totalScore !== right.totalScore) return left.totalScore - right.totalScore;
  if (left.elapsedMilliseconds !== right.elapsedMilliseconds) return left.elapsedMilliseconds - right.elapsedMilliseconds;
  return left.resultHash.localeCompare(right.resultHash);
}

export type ResultValidation =
  | { valid: true; result: GameResult }
  | { valid: false; code: 'result_invalid'; message: string };

export function validateGameResult(challenge: PublishedGameChallenge, result: GameResult): ResultValidation {
  try {
    assertChallenge(challenge);
    if (result.challengeId !== challenge.id || result.sourceVersion !== challenge.sourceVersion || result.challengeSha256 !== challenge.challengeSha256 || result.engineVersion !== GAME_ENGINE_VERSION) {
      return { valid: false, code: 'result_invalid', message: 'El resultado no pertenece a la versión del reto o del motor' };
    }
    if (!Number.isSafeInteger(result.startedAtMs) || !Number.isSafeInteger(result.finishedAtMs) || result.finishedAtMs < result.startedAtMs) {
      return { valid: false, code: 'result_invalid', message: 'El intervalo temporal del resultado es inválido' };
    }
    if (result.assignments.length !== challenge.decisions.length) {
      return { valid: false, code: 'result_invalid', message: 'El resultado no contiene todas las decisiones' };
    }

    const used = new Set<string>();
    let timedOutStarted = false;
    let totalScore = 0;
    for (const [index, assignment] of result.assignments.entries()) {
      const decision = challenge.decisions[index];
      if (!decision || assignment.ordinal !== decision.ordinal || assignment.entityId !== decision.entityId) {
        return { valid: false, code: 'result_invalid', message: `Orden o entidad inválida en la asignación ${index}` };
      }
      if (used.has(assignment.categorySlug)) {
        return { valid: false, code: 'result_invalid', message: 'El resultado contiene categorías duplicadas' };
      }
      used.add(assignment.categorySlug);
      const expectedScore = decision.scoreByCategory[assignment.categorySlug];
      if (expectedScore === undefined && !assignment.timedOut) {
        return { valid: false, code: 'result_invalid', message: 'Respuesta inválida en el resultado' };
      }
      if (assignment.timedOut) {
        timedOutStarted = true;
        const remaining = challenge.categories.filter((category) => !result.assignments.slice(0, index).some((item) => item.categorySlug === category.slug));
        if (assignment.categorySlug !== remaining[0]?.slug || assignment.scoreValue !== challenge.scoreCap) {
          return { valid: false, code: 'result_invalid', message: 'Asignación de timeout no reproducible' };
        }
      } else {
        if (timedOutStarted || assignment.scoreValue !== expectedScore) {
          return { valid: false, code: 'result_invalid', message: 'Puntuación o secuencia de timeout inválida' };
        }
      }
      totalScore += assignment.scoreValue;
    }

    const deadlineAtMs = result.startedAtMs + challenge.timeLimitSeconds * 1000;
    if (timedOutStarted && !result.timedOut) return { valid: false, code: 'result_invalid', message: 'La marca de timeout no coincide con las asignaciones' };
    if (result.timedOut && !timedOutStarted && result.finishedAtMs !== deadlineAtMs) return { valid: false, code: 'result_invalid', message: 'Un timeout completo debe finalizar exactamente en el límite' };
    if (timedOutStarted ? result.finishedAtMs !== deadlineAtMs : result.finishedAtMs >= deadlineAtMs) {
      return { valid: false, code: 'result_invalid', message: 'El momento de finalización no coincide con el límite' };
    }
    const expectedElapsed = result.finishedAtMs - result.startedAtMs;
    if (result.elapsedMilliseconds !== expectedElapsed || result.elapsedSeconds !== Math.floor(expectedElapsed / 1000) || result.totalScore !== totalScore) {
      return { valid: false, code: 'result_invalid', message: 'Los totales temporales o de puntuación no coinciden' };
    }

    const canonical: Omit<GameResult, 'resultHash'> = {
      challengeId: result.challengeId,
      sourceVersion: result.sourceVersion,
      challengeSha256: result.challengeSha256,
      engineVersion: result.engineVersion,
      startedAtMs: result.startedAtMs,
      finishedAtMs: result.finishedAtMs,
      elapsedMilliseconds: result.elapsedMilliseconds,
      elapsedSeconds: result.elapsedSeconds,
      timedOut: result.timedOut,
      assignments: result.assignments.map((assignment) => ({ ...assignment })),
      totalScore: result.totalScore
    };
    const expectedHash = createHash('sha256').update(resultHashPayload(canonical)).digest('hex');
    if (result.resultHash !== expectedHash) return { valid: false, code: 'result_invalid', message: 'El hash del resultado no coincide' };
    return { valid: true, result };
  } catch (error) {
    if (error instanceof GameRuleError) return { valid: false, code: 'result_invalid', message: error.message };
    throw error;
  }
}

export type ResultSubmission = {
  playerId: string;
  idempotencyKey: string;
  result: GameResult;
};

export type SubmissionReceipt = {
  status: 'accepted' | 'duplicate';
  result: GameResult;
};

/** Local fixture implementation of the future transactional DB boundary. */
export class InMemoryResultSubmissionLedger {
  private readonly byKey = new Map<string, GameResult>();
  private readonly byResult = new Map<string, GameResult>();

  submit(challenge: PublishedGameChallenge, submission: ResultSubmission): SubmissionReceipt {
    const validation = validateGameResult(challenge, submission.result);
    if (!validation.valid) throw new GameRuleError('result_invalid', validation.message);
    if (!submission.playerId || !submission.idempotencyKey) throw new GameRuleError('submission_conflict', 'Faltan las claves de idempotencia');
    const key = `${submission.playerId}:${challenge.id}:${submission.idempotencyKey}`;
    const resultKey = `${submission.playerId}:${challenge.id}:${submission.result.resultHash}`;
    const existingByKey = this.byKey.get(key);
    if (existingByKey) {
      if (existingByKey.resultHash !== submission.result.resultHash) throw new GameRuleError('submission_conflict', 'La clave de idempotencia ya se usó con otro resultado');
      return { status: 'duplicate', result: existingByKey };
    }
    const existingByResult = this.byResult.get(resultKey);
    if (existingByResult) return { status: 'duplicate', result: existingByResult };
    this.byKey.set(key, submission.result);
    this.byResult.set(resultKey, submission.result);
    return { status: 'accepted', result: submission.result };
  }
}
