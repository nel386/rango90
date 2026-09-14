import { config } from '../config.js';

const OPENVERSE_BASE_URL = 'https://api.openverse.org';
const OPENVERSE_IMAGES_URL = `${OPENVERSE_BASE_URL}/v1/images/`;
const OPENVERSE_TOKEN_URL = `${OPENVERSE_BASE_URL}/v1/auth_tokens/token/`;

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let tokenRequest: Promise<string | null> | null = null;
let lastOpenverseRequestAt = 0;
let openverseRequestTail: Promise<void> = Promise.resolve();

async function paceOpenverseRequest(): Promise<void> {
  const previous = openverseRequestTail;
  let release!: () => void;
  openverseRequestTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const waitMs = config.openverseMinRequestIntervalMs - (Date.now() - lastOpenverseRequestAt);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastOpenverseRequestAt = Date.now();
  } finally {
    release();
  }
}

const allowedLicenses: Record<string, string> = {
  by: 'CC BY',
  'by-sa': 'CC BY-SA',
  cc0: 'CC0',
  pdm: 'Public Domain Mark',
  pd: 'Public Domain'
};

const rejectedMediaTerms = /\b(?:fifa|ultimate\s+team|trading\s+card|football\s+card|soccer\s+card|player\s+card|illustration|illustrated|cartoon|drawing|painting|logo|badge|crest|jersey|shirt|figurine|statue|mural|poster|sticker|collage|squad|team\s+photo|group\s+photo)\b/iu;

interface OpenverseApiResult {
  id?: string;
  title?: string;
  foreign_landing_url?: string;
  url?: string;
  creator?: string | null;
  creator_url?: string | null;
  license?: string | null;
  license_version?: string | null;
  license_url?: string | null;
  attribution?: string | null;
  provider?: string | null;
  source?: string | null;
  tags?: Array<{ name?: string | null }>;
  height?: number | null;
  width?: number | null;
  thumbnail?: string | null;
  mimetype?: string | null;
  filetype?: string | null;
}

interface OpenverseApiResponse {
  results?: OpenverseApiResult[];
}

export interface OpenverseImageCandidate {
  id: string;
  title: string;
  sourceUrl: string;
  landingUrl: string;
  thumbnailUrl: string | null;
  creator: string | null;
  creatorUrl: string | null;
  licenseName: string;
  licenseUrl: string;
  licenseCode: string;
  licenseVersion: string | null;
  attribution: string | null;
  providerSource: string | null;
  width: number;
  height: number;
  mimeType: string | null;
  tags: string[];
  identitySignal: string[];
  reviewRequired: true;
}

export interface OpenverseSearchOptions {
  limit?: number;
  aliases?: string[];
  timeoutMs?: number;
}

async function getOpenverseAccessToken(forceRefresh = false): Promise<string | null> {
  const clientId = config.openverseClientId.trim();
  const clientSecret = config.openverseClientSecret.trim();
  if (!clientId || !clientSecret) return null;
  if (!forceRefresh && accessToken && accessTokenExpiresAt > Date.now() + 60_000) return accessToken;
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    });
    const response = await fetch(OPENVERSE_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(config.openverseTimeoutMs)
    });
    if (!response.ok) throw new Error(`Openverse OAuth ${response.status}`);
    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error('Openverse OAuth no devolvió access_token');
    accessToken = payload.access_token;
    accessTokenExpiresAt = Date.now() + Math.max(60, Number(payload.expires_in ?? 3600)) * 1000;
    return accessToken;
  })().finally(() => {
    tokenRequest = null;
  });

  return tokenRequest;
}

async function fetchOpenverseSearch(url: URL, forceRefresh = false, timeoutMs = config.openverseTimeoutMs, attempt = 0): Promise<Response> {
  const token = await getOpenverseAccessToken(forceRefresh);
  const headers = new Headers({ Accept: 'application/json', 'User-Agent': 'Rango90-openverse-review/0.1' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  await paceOpenverseRequest();
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (response.status === 401 && token && !forceRefresh) {
    accessToken = null;
    accessTokenExpiresAt = 0;
    return fetchOpenverseSearch(url, true, timeoutMs);
  }
  // Anonymous Openverse traffic has a much smaller quota. Retrying the same
  // request several times only prolongs a batch-wide 429 storm; callers can
  // record the failed attempt and continue with the next provider. Authenticated
  // requests still use the bounded Retry-After path below.
  if (response.status === 429 && !token) return response;
  if ((response.status === 401 || response.status === 429) && attempt < 2) {
    const retryAfterSeconds = Number(response.headers.get('retry-after'));
    const retryDelayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.min(retryAfterSeconds * 1_000, 30_000)
      : (attempt + 1) * 2_000;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return fetchOpenverseSearch(url, forceRefresh, timeoutMs, attempt + 1);
  }
  return response;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function publicHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function identitySignals(name: string, aliases: string[], result: OpenverseApiResult): string[] {
  const title = result.title ?? '';
  const tags = (result.tags ?? []).map((tag) => tag.name ?? '').filter(Boolean);
  const landing = result.foreign_landing_url ?? '';
  const haystack = normalize([title, ...tags, landing].join(' '));
  const labels = [name, ...aliases].map(normalize).filter(Boolean);
  return labels.filter((label) => {
    const tokens = label.split(' ').filter((token) => token.length >= 2);
    if (tokens.length === 0) return false;
    if (haystack.includes(label)) return true;
    // If a provider omits punctuation or a middle name, still require at
    // least first and last name; surname-only matches are never sufficient.
    return tokens.length >= 2 && tokens.every((token) => haystack.includes(token));
  });
}

function candidateFromResult(name: string, aliases: string[], result: OpenverseApiResult): OpenverseImageCandidate | null {
  const id = result.id?.trim();
  const title = result.title?.trim();
  const sourceUrl = publicHttpsUrl(result.url);
  const landingUrl = publicHttpsUrl(result.foreign_landing_url);
  const licenseCode = result.license?.trim().toLowerCase() ?? '';
  const licenseName = allowedLicenses[licenseCode];
  const licenseUrl = publicHttpsUrl(result.license_url);
  const width = Number(result.width);
  const height = Number(result.height);
  const tags = (result.tags ?? []).map((tag) => tag.name?.trim() ?? '').filter(Boolean);
  const identitySignal = identitySignals(name, aliases, result);
  const mediaText = normalize([title ?? '', ...tags, landingUrl ?? ''].join(' '));

  if (!id || !title || !sourceUrl || !landingUrl || !licenseName || !licenseUrl) return null;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 512 || height < 512) return null;
  if (identitySignal.length === 0 || rejectedMediaTerms.test(mediaText)) return null;
  if (result.mimetype && !result.mimetype.toLowerCase().startsWith('image/')) return null;

  return {
    id,
    title,
    sourceUrl,
    landingUrl,
    thumbnailUrl: publicHttpsUrl(result.thumbnail),
    creator: result.creator?.trim() || null,
    creatorUrl: publicHttpsUrl(result.creator_url),
    licenseName: licenseName + (result.license_version ? ' ' + result.license_version : ''),
    licenseUrl,
    licenseCode,
    licenseVersion: result.license_version?.trim() || null,
    attribution: result.attribution?.trim() || null,
    providerSource: result.source?.trim() || result.provider?.trim() || null,
    width,
    height,
    mimeType: result.mimetype?.trim() || null,
    tags,
    identitySignal,
    reviewRequired: true
  };
}

export function filterOpenversePlayerCandidates(name: string, results: OpenverseApiResult[], aliases: string[] = [], limit = 5): OpenverseImageCandidate[] {
  const unique = new Map<string, OpenverseImageCandidate>();
  for (const result of results) {
    const candidate = candidateFromResult(name, aliases, result);
    if (candidate && !unique.has(candidate.landingUrl)) unique.set(candidate.landingUrl, candidate);
  }
  return [...unique.values()].slice(0, Math.max(0, Math.min(limit, 20)));
}

export async function searchOpenversePlayerCandidates(name: string, options: OpenverseSearchOptions = {}): Promise<{ candidates: OpenverseImageCandidate[]; apiUrl: string }> {
  const aliases = options.aliases ?? [];
  const limit = Math.max(1, Math.min(options.limit ?? 5, 20));
  const queryLabels = [
    `${name} football player`,
    name,
    ...aliases.map((alias) => `${alias} football player`),
    ...aliases
  ].map((query) => query.trim()).filter(Boolean);
  const queries = [...new Set(queryLabels)].slice(0, 4);
  const responses: Array<{ apiUrl: string; payload: OpenverseApiResponse }> = [];
  let lastError: unknown;
  for (const [index, query] of queries.entries()) {
    const apiUrl = new URL(OPENVERSE_IMAGES_URL);
    apiUrl.searchParams.set('q', query);
    apiUrl.searchParams.set('license_type', 'commercial');
    apiUrl.searchParams.set('page_size', String(Math.max(30, limit * 6)));
    try {
      const response = await fetchOpenverseSearch(apiUrl, false, options.timeoutMs ?? config.openverseTimeoutMs);
      if (!response.ok) throw new Error('Openverse ' + response.status);
      responses.push({ apiUrl: apiUrl.toString(), payload: (await response.json()) as OpenverseApiResponse });
    } catch (error) {
      lastError = error;
      if (responses.length === 0) throw error;
      break;
    }
    const currentCandidates = filterOpenversePlayerCandidates(name, responses.flatMap((response) => response.payload.results ?? []), aliases, limit);
    if (currentCandidates.length >= limit) break;
    if (index < queries.length - 1) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (responses.length === 0 && lastError) throw lastError;
  const results = responses.flatMap((response) => response.payload.results ?? []);
  return {
    candidates: filterOpenversePlayerCandidates(name, results, aliases, limit),
    apiUrl: responses.map((response) => response.apiUrl).join('\n')
  };
}

export async function downloadOpenverseImage(imageUrl: string, timeoutMs = 15_000): Promise<{ bytes: Buffer; contentType: string }> {
  const parsed = new URL(imageUrl);
  if (parsed.protocol !== 'https:') throw new Error('Openverse devuelve una URL no HTTPS: ' + imageUrl);
  const response = await fetch(parsed, {
    headers: { Accept: 'image/*', 'User-Agent': 'Rango90-openverse-review/0.1' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error('Openverse imagen ' + response.status);
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') throw new Error('Openverse no devolvió una imagen raster (' + (contentType || 'sin content-type') + ')');
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 15 * 1024 * 1024) throw new Error('Imagen Openverse demasiado grande');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 15 * 1024 * 1024) throw new Error('Tamaño de imagen Openverse no permitido');
  return { bytes, contentType };
}

export function openverseLicenseIsAllowed(code: string): boolean {
  return Object.hasOwn(allowedLicenses, code.trim().toLowerCase());
}
