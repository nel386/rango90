export type RuntimeMetricName =
  | 'challenge_load'
  | 'game_start'
  | 'first_player_visible'
  | 'decision_to_next_player'
  | 'image_primary_load'
  | 'image_fallback_load'
  | 'request_error'
  | 'request_retry';

export function recordRuntimeMetric(name: RuntimeMetricName, startedAt: number, details: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV !== 'development' || typeof performance === 'undefined') return;
  const durationMs = Math.max(0, performance.now() - startedAt);
  console.debug(`[rango90] ${name}`, { durationMs, ...details });
}

export function nowRuntimeMetric(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}
