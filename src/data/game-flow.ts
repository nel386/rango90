export type GameFlowState =
  | 'idle'
  | 'loading_challenge'
  | 'challenge_ready'
  | 'starting_game'
  | 'playing'
  | 'submitting_decision'
  | 'showing_feedback'
  | 'finished'
  | 'abandoned'
  | 'error'
  | 'official_not_ready';

export type GameFlowEvent =
  | { type: 'LOAD_CHALLENGE' }
  | { type: 'CHALLENGE_READY' }
  | { type: 'START_GAME' }
  | { type: 'GAME_STARTED' }
  | { type: 'SUBMIT_DECISION' }
  | { type: 'DECISION_FAILED' }
  | { type: 'FEEDBACK_SHOWN' }
  | { type: 'CONTINUE' }
  | { type: 'FINISH' }
  | { type: 'ABANDON' }
  | { type: 'ERROR'; officialNotReady?: boolean }
  | { type: 'RESET' };

export function transitionGameFlow(state: GameFlowState, event: GameFlowEvent): GameFlowState {
  switch (event.type) {
    case 'LOAD_CHALLENGE': return 'loading_challenge';
    case 'CHALLENGE_READY': return 'challenge_ready';
    case 'START_GAME': return state === 'challenge_ready' ? 'starting_game' : state;
    case 'GAME_STARTED': return 'playing';
    case 'SUBMIT_DECISION': return state === 'playing' ? 'submitting_decision' : state;
    case 'DECISION_FAILED': return state === 'submitting_decision' ? 'playing' : state;
    case 'FEEDBACK_SHOWN': return 'showing_feedback';
    case 'CONTINUE': return state === 'showing_feedback' ? 'playing' : state;
    case 'FINISH': return 'finished';
    case 'ABANDON': return state === 'playing' || state === 'submitting_decision' || state === 'showing_feedback' ? 'abandoned' : state;
    case 'ERROR': return event.officialNotReady ? 'official_not_ready' : 'error';
    case 'RESET': return 'idle';
  }
}

export function canSubmitDecision(state: GameFlowState): boolean {
  return state === 'playing';
}

export function canStartGame(state: GameFlowState): boolean {
  return state === 'challenge_ready';
}

export type FeedbackAdvance = 'next' | 'finish' | 'noop';

export function feedbackAdvance(phase: GamePhaseForAdvance, entityIndex: number, decisionCount: number, complete: boolean): FeedbackAdvance {
  if (phase !== 'feedback') return 'noop';
  return complete || entityIndex >= decisionCount - 1 ? 'finish' : 'next';
}

type GamePhaseForAdvance = 'playing' | 'feedback' | 'finished' | 'abandoned';
