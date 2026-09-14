import type { FastifyRequest } from 'fastify';

export type RateLimitPolicy = {
  windowMs: number;
  max: number;
  key: string;
};

type Bucket = { startedAt: number; count: number };

/** Process-local limiter for the current single-node deployment. */
export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastCleanup = 0;

  constructor(private readonly now: () => number = Date.now) {}

  check(key: string, policy: RateLimitPolicy): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.now();
    if (now - this.lastCleanup >= policy.windowMs) {
      this.lastCleanup = now;
      for (const [bucketKey, bucket] of this.buckets) {
        if (now - bucket.startedAt >= policy.windowMs) this.buckets.delete(bucketKey);
      }
    }

    const current = this.buckets.get(key);
    if (!current || now - current.startedAt >= policy.windowMs) {
      this.buckets.set(key, { startedAt: now, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= policy.max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((policy.windowMs - (now - current.startedAt)) / 1000))
      };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export function rateLimitPolicy(request: FastifyRequest, config: { rateLimitWindowMs: number; rateLimitAuthMax: number; rateLimitWriteMax: number; rateLimitReadMax: number }): RateLimitPolicy | null {
  const path = request.url.split('?', 1)[0] ?? '';
  const method = request.method.toUpperCase();
  const isAuth = path.startsWith('/v1/auth/');
  const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  const isSensitiveRead = path.includes('/leaderboard') || path.startsWith('/v1/duels/');
  if (!isAuth && !isWrite && !isSensitiveRead) return null;
  const group = isAuth ? 'auth' : isWrite ? 'write' : 'read';
  return {
    windowMs: config.rateLimitWindowMs,
    max: group === 'auth' ? config.rateLimitAuthMax : group === 'write' ? config.rateLimitWriteMax : config.rateLimitReadMax,
    // The key deliberately excludes dynamic ids so clients cannot bypass the
    // limit by rotating game or duel URLs.
    key: `${group}:${request.ip}`
  };
}
