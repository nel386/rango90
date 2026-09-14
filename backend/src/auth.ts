import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool } from './db.js';
import { config } from './config.js';

const scrypt = promisify(scryptCallback);
const sessionCookie = 'rango90_session';
const oauthStateCookie = 'rango90_oauth_state';
const sessionDays = 30;

type PublicUser = { id: string; email: string; displayName: string; emailVerified: boolean };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, value] = stored.split(':');
  if (!salt || !value) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(value, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function publicUser(row: { id: string; email: string; display_name: string; email_verified_at: Date | null }): PublicUser {
  return { id: row.id, email: row.email, displayName: row.display_name, emailVerified: Boolean(row.email_verified_at) };
}

function parseCookies(cookieHeader: string | undefined) {
  return Object.fromEntries((cookieHeader ?? '').split(';').flatMap((part) => {
    const [key, ...value] = part.trim().split('=');
    if (!key) return [];
    try {
      return [[key, decodeURIComponent(value.join('='))]];
    } catch {
      return [];
    }
  }));
}

function cookieOptions(maxAge: number) {
  return [`Path=/`, `Max-Age=${maxAge}`, 'HttpOnly', `SameSite=${config.authCookieSameSite}`, config.nodeEnv === 'production' || config.authCookieSameSite === 'none' ? 'Secure' : ''].filter(Boolean).join('; ');
}

function setCookie(reply: FastifyReply, name: string, value: string, maxAge: number) {
  const nextCookie = `${name}=${encodeURIComponent(value)}; ${cookieOptions(maxAge)}`;
  const current = reply.getHeader('Set-Cookie');
  const cookies = Array.isArray(current) ? current.map(String) : current ? [String(current)] : [];
  reply.header('Set-Cookie', [...cookies, nextCookie]);
}

function clearCookie(reply: FastifyReply, name: string) {
  setCookie(reply, name, '', 0);
}

function safeReturnTo(value: string | undefined) {
  if (!value) return config.authFrontendOrigin;
  try {
    const target = new URL(value);
    return target.origin === new URL(config.authFrontendOrigin).origin ? target.toString() : config.authFrontendOrigin;
  } catch {
    return config.authFrontendOrigin;
  }
}

async function createSession(userId: string, reply: FastifyReply) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
    [randomUUID(), userId, hashToken(token)],
  );
  setCookie(reply, sessionCookie, token, sessionDays * 24 * 60 * 60);
}

export async function getCurrentUser(request: FastifyRequest) {
  const token = parseCookies(request.headers.cookie)[sessionCookie];
  if (!token) return null;
  const result = await pool.query<{ id: string; email: string; display_name: string; email_verified_at: Date | null }>(
    `SELECT u.id, u.email, u.display_name, u.email_verified_at
     FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)],
  );
  if (!result.rows[0]) return null;
  void pool.query('UPDATE auth_sessions SET last_seen_at = NOW() WHERE token_hash = $1', [hashToken(token)]);
  return publicUser(result.rows[0]);
}

async function sendVerificationEmail(email: string, token: string) {
  const url = `${config.authVerificationBaseUrl}?token=${encodeURIComponent(token)}`;
  if (config.authEmailWebhookUrl) {
    const response = await fetch(config.authEmailWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: email, verificationUrl: url }),
    });
    if (!response.ok) throw new Error('Verification email delivery failed');
  } else if (config.nodeEnv !== 'production') {
    console.info(`[auth] Verification URL for ${email}: ${url}`);
  }
}

function googleConfigReady() {
  return Boolean(config.googleClientId && config.googleClientSecret && config.googleRedirectUri);
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/v1/auth/register', async (request, reply) => {
    if (config.nodeEnv === 'production' && !config.authEmailWebhookUrl) {
      return reply.code(503).send({ error: 'Email verification is not configured' });
    }
    const body = z.object({
      email: z.string().email().transform((value) => value.toLowerCase()),
      password: z.string().min(8).max(128),
      displayName: z.string().trim().min(2).max(40),
    }).parse(request.body);
    const existing = await pool.query('SELECT id FROM auth_users WHERE email = $1', [body.email]);
    if (existing.rows[0]) return reply.code(409).send({ error: 'Account already exists' });
    const userId = randomUUID();
    const passwordHash = await hashPassword(body.password);
    await pool.query(
      `INSERT INTO auth_users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4)`,
      [userId, body.email, passwordHash, body.displayName],
    );
    const token = randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO auth_email_tokens (id, user_id, token_hash, purpose, expires_at) VALUES ($1, $2, $3, 'verify_email', NOW() + INTERVAL '24 hours')`,
      [randomUUID(), userId, hashToken(token)],
    );
    await sendVerificationEmail(body.email, token);
    await createSession(userId, reply);
    return reply.code(201).send({ user: { id: userId, email: body.email, displayName: body.displayName, emailVerified: false }, verificationRequired: true });
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const body = z.object({ email: z.string().email().transform((value) => value.toLowerCase()), password: z.string().min(1) }).parse(request.body);
    const result = await pool.query<{ id: string; email: string; display_name: string; password_hash: string | null; email_verified_at: Date | null }>(
      `SELECT id, email, display_name, password_hash, email_verified_at FROM auth_users WHERE email = $1`, [body.email],
    );
    const user = result.rows[0];
    if (!user?.password_hash || !(await verifyPassword(body.password, user.password_hash))) return reply.code(401).send({ error: 'Invalid credentials' });
    await createSession(user.id, reply);
    return { user: publicUser(user), verificationRequired: !user.email_verified_at };
  });

  app.get('/v1/auth/session', async (request) => ({ user: await getCurrentUser(request) }));

  app.post('/v1/auth/logout', async (request, reply) => {
    const token = parseCookies(request.headers.cookie)[sessionCookie];
    if (token) await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)]);
    clearCookie(reply, sessionCookie);
    return { ok: true };
  });

  app.get('/v1/auth/verify-email', async (request, reply) => {
    const query = z.object({ token: z.string().min(20) }).parse(request.query);
    const result = await pool.query<{ user_id: string }>(
      `UPDATE auth_email_tokens SET used_at = NOW()
       WHERE token_hash = $1 AND purpose = 'verify_email' AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`, [hashToken(query.token)],
    );
    const row = result.rows[0];
    if (!row) return reply.code(400).send({ error: 'Verification token is invalid or expired' });
    await pool.query('UPDATE auth_users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1', [row.user_id]);
    await createSession(row.user_id, reply);
    return reply.redirect(`${config.authFrontendOrigin}?verified=1`);
  });

  app.get('/v1/auth/google/start', async (request, reply) => {
    if (!googleConfigReady()) return reply.code(503).send({ error: 'Google authentication is not configured' });
    const query = z.object({ returnTo: z.string().url().optional() }).parse(request.query);
    const state = randomBytes(24).toString('base64url');
    setCookie(reply, oauthStateCookie, `${state}|${safeReturnTo(query.returnTo)}`, 10 * 60);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', config.googleClientId);
    url.searchParams.set('redirect_uri', config.googleRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    return reply.redirect(url.toString());
  });

  app.get('/v1/auth/google/callback', async (request, reply) => {
    if (!googleConfigReady()) return reply.code(503).send({ error: 'Google authentication is not configured' });
    const query = z.object({ code: z.string().min(1), state: z.string().min(1) }).parse(request.query);
    const stateCookie = parseCookies(request.headers.cookie)[oauthStateCookie];
    const [expectedState, returnTo] = stateCookie?.split('|') ?? [];
    if (!expectedState || expectedState !== query.state) return reply.code(400).send({ error: 'Invalid OAuth state' });
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: query.code, client_id: config.googleClientId, client_secret: config.googleClientSecret, redirect_uri: config.googleRedirectUri, grant_type: 'authorization_code' }) });
    if (!tokenResponse.ok) return reply.code(502).send({ error: 'Google token exchange failed' });
    const tokenPayload = await tokenResponse.json() as { access_token?: string };
    if (!tokenPayload.access_token) return reply.code(502).send({ error: 'Google access token missing' });
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${tokenPayload.access_token}` } });
    if (!profileResponse.ok) return reply.code(502).send({ error: 'Google profile lookup failed' });
    const profile = await profileResponse.json() as { sub?: string; email?: string; name?: string; email_verified?: boolean };
    if (!profile.sub || !profile.email || profile.email_verified !== true) return reply.code(400).send({ error: 'Google account email is not verified' });
    const userResult = await pool.query<{ id: string; email: string; display_name: string; email_verified_at: Date | null }>(
      `INSERT INTO auth_users (id, email, google_subject, display_name, email_verified_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (email) DO UPDATE SET google_subject = EXCLUDED.google_subject, email_verified_at = COALESCE(auth_users.email_verified_at, NOW()), updated_at = NOW()
       RETURNING id, email, display_name, email_verified_at`, [randomUUID(), profile.email.toLowerCase(), profile.sub, profile.name?.trim().slice(0, 40) || 'Rango 90 player'],
    );
    const googleUser = userResult.rows[0];
    if (!googleUser) return reply.code(500).send({ error: 'Google account could not be created' });
    await createSession(googleUser.id, reply);
    clearCookie(reply, oauthStateCookie);
    return reply.redirect(safeReturnTo(returnTo));
  });
}
