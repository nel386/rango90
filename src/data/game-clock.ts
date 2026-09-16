export function secondsUntilDeadline(deadlineAt: string, now = Date.now()): number {
  const deadline = Date.parse(deadlineAt);
  if (Number.isNaN(deadline)) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function deadlineReached(deadlineAt: string, now = Date.now()): boolean {
  const deadline = Date.parse(deadlineAt);
  return Number.isNaN(deadline) || now >= deadline;
}
