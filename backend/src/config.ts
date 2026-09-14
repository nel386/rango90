import 'dotenv/config';

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  rateLimitWindowMs: Math.min(Math.max(Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000) || 60_000, 1_000), 3_600_000),
  rateLimitAuthMax: Math.min(Math.max(Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10) || 10, 1), 1_000),
  rateLimitWriteMax: Math.min(Math.max(Number(process.env.RATE_LIMIT_WRITE_MAX ?? 60) || 60, 1), 5_000),
  rateLimitReadMax: Math.min(Math.max(Number(process.env.RATE_LIMIT_READ_MAX ?? 120) || 120, 1), 5_000),
  trustProxy: process.env.TRUST_PROXY === 'true',
  apiFootballBaseUrl: process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io',
  apiFootballKey: process.env.API_FOOTBALL_KEY ?? '',
  apiFootballTimeoutMs: Math.min(Math.max(Number(process.env.API_FOOTBALL_TIMEOUT_MS ?? 15_000) || 15_000, 1_000), 60_000),
  theSportsDbBaseUrl: process.env.THE_SPORTS_DB_BASE_URL ?? 'https://www.thesportsdb.com/api/v1/json/123',
  theSportsDbMinRequestIntervalMs: Math.min(Math.max(Number(process.env.THE_SPORTS_DB_MIN_REQUEST_INTERVAL_MS ?? 2_100) || 2_100, 500), 60_000),
  theSportsDbMaxAttempts: Math.min(Math.max(Number(process.env.THE_SPORTS_DB_MAX_ATTEMPTS ?? 3) || 3, 1), 5),
  openverseClientId: process.env.OPENVERSE_CLIENT_ID ?? '',
  openverseClientSecret: process.env.OPENVERSE_CLIENT_SECRET ?? '',
  openverseTimeoutMs: Math.min(Math.max(Number(process.env.OPENVERSE_TIMEOUT_MS ?? 15_000) || 15_000, 1_000), 60_000),
  openverseMinRequestIntervalMs: Math.min(Math.max(Number(process.env.OPENVERSE_MIN_REQUEST_INTERVAL_MS ?? 1_000) || 1_000, 250), 60_000),
  mediaRoot: process.env.MEDIA_ROOT ?? './storage/media',
  snapshotRoot: process.env.SNAPSHOT_ROOT ?? './storage/source-snapshots',
  mediaCandidateRoot: process.env.MEDIA_CANDIDATE_ROOT ?? './storage/media-candidates',
  mediaUserAgent: process.env.MEDIA_USER_AGENT ?? 'Rango90-media-review/0.1 (contact required)',
  mediaMaxAttempts: Math.min(Math.max(Number(process.env.MEDIA_MAX_ATTEMPTS ?? 3) || 3, 1), 5),
  mediaDiscoveryMaxAttempts: Math.min(Math.max(Number(process.env.MEDIA_DISCOVERY_MAX_ATTEMPTS ?? 1) || 1, 1), 3),
  mediaRetryMaxMs: Math.min(Math.max(Number(process.env.MEDIA_RETRY_MAX_MS ?? 10_000) || 10_000, 1_000), 30_000),
  mediaRequestTimeoutMs: Math.min(Math.max(Number(process.env.MEDIA_REQUEST_TIMEOUT_MS ?? 15_000) || 15_000, 1_000), 60_000),
  mediaDiscoveryRequestTimeoutMs: Math.min(Math.max(Number(process.env.MEDIA_DISCOVERY_REQUEST_TIMEOUT_MS ?? 7_000) || 7_000, 1_000), 30_000),
  // Commons discovery is globally serialized in commonsClient.ts. Keep a
  // conservative 2 req/s default so parallel batches do not spend minutes
  // waiting between otherwise short metadata requests. Operators can still
  // raise this through COMMONS_MIN_REQUEST_INTERVAL_MS when required by the
  // provider or deployment policy.
  commonsMinRequestIntervalMs: Math.min(Math.max(Number(process.env.COMMONS_MIN_REQUEST_INTERVAL_MS ?? 500) || 500, 500), 60_000),
  authFrontendOrigin: process.env.AUTH_FRONTEND_ORIGIN ?? 'http://localhost:3000/es/',
  authVerificationBaseUrl: process.env.AUTH_VERIFICATION_BASE_URL ?? 'http://localhost:4000/v1/auth/verify-email',
  authEmailWebhookUrl: process.env.AUTH_EMAIL_WEBHOOK_URL ?? '',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
  authCookieSameSite: process.env.AUTH_COOKIE_SAMESITE === 'none' ? 'none' : 'lax'
};

if (!config.databaseUrl && config.nodeEnv !== 'test') {
  console.warn('DATABASE_URL no está configurada; los endpoints de base de datos no podrán arrancar.');
}

export function corsOrigins(): string[] {
  return config.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
}

export function validateProductionConfig(): void {
  if (config.nodeEnv !== 'production') return;
  if (!config.databaseUrl) throw new Error('DATABASE_URL es obligatoria en producción');
  const origins = corsOrigins();
  if (origins.length === 0 || origins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('CORS_ORIGIN debe contener únicamente orígenes HTTPS en producción');
  }
  for (const [name, value] of [['AUTH_FRONTEND_ORIGIN', config.authFrontendOrigin], ['AUTH_VERIFICATION_BASE_URL', config.authVerificationBaseUrl]] as const) {
    if (!value.startsWith('https://')) throw new Error(`${name} debe usar HTTPS en producción`);
  }
  if (config.authCookieSameSite === 'none' && !config.authFrontendOrigin.startsWith('https://')) {
    throw new Error('AUTH_COOKIE_SAMESITE=none requiere un frontend HTTPS');
  }
}
