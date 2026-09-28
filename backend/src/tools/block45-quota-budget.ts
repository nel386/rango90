export type Block45AttemptBudgetInput = {
  dailyRemainingAfterPreflight: number;
  perMinuteLimit: number | null;
  requestedMaxAttempts: number;
  pendingWork: number | null;
  hardCeiling?: number;
  runtimeMinutes?: number;
};

export type Block45AttemptBudget = {
  effectiveAttemptBudget: number;
  dailyAttemptCeiling: number;
  dailyReserveRequests: number;
  requestedAttemptCeiling: number;
  runtimeAttemptCeiling: number;
  pendingWorkCeiling: number | null;
};

/** Budget counts the /status preflight as the first attempt in the same batch. */
export function computeBlock45AttemptBudget(input: Block45AttemptBudgetInput): Block45AttemptBudget {
  const hardCeiling = Math.max(1, Math.floor(input.hardCeiling ?? 10000));
  const runtimeMinutes = Math.max(1, Math.floor(input.runtimeMinutes ?? 40));
  const dailyRemaining = Math.max(0, Math.floor(input.dailyRemainingAfterPreflight));
  const dailyReserveRequests = dailyRemaining > 0 ? Math.max(1, Math.ceil(dailyRemaining * 0.1)) : 0;
  const requestedAttemptCeiling = input.requestedMaxAttempts > 0
    ? Math.min(hardCeiling, Math.floor(input.requestedMaxAttempts))
    : hardCeiling;
  const safePerMinuteRate = input.perMinuteLimit && input.perMinuteLimit > 0 ? input.perMinuteLimit * 0.8 : 10;
  const runtimeAttemptCeiling = Math.max(1, Math.floor(runtimeMinutes * safePerMinuteRate));
  const pendingWorkCeiling = input.pendingWork === null ? null : Math.max(0, Math.floor(input.pendingWork)) + 1;
  const dailyAttemptCeiling = dailyRemaining - dailyReserveRequests + 1;
  const ceilings = [requestedAttemptCeiling, runtimeAttemptCeiling, dailyAttemptCeiling];
  if (pendingWorkCeiling !== null) ceilings.push(pendingWorkCeiling);
  return {
    effectiveAttemptBudget: Math.min(...ceilings),
    dailyAttemptCeiling,
    dailyReserveRequests,
    requestedAttemptCeiling,
    runtimeAttemptCeiling,
    pendingWorkCeiling
  };
}
