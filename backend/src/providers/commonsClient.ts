import { config } from '../config.js';

interface CommonsMetadataValue {
  value?: string;
}

interface CommonsPage {
  pageid?: number;
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
    mime?: string;
    sha1?: string;
    extmetadata?: Record<string, CommonsMetadataValue>;
  }>;
}

interface CommonsSearchResponse {
  query?: { pages?: CommonsPage[] };
}

interface CommonsCategorySearchResponse {
  query?: { search?: Array<{ title?: string }> };
}

interface CommonsCategoryMembersResponse {
  query?: { categorymembers?: Array<{ title?: string; ns?: number }> };
}

interface CommonsRestFile {
  title?: string;
  file_description_url?: string;
  preferred?: { width?: number; height?: number; url?: string };
  original?: { width?: number; height?: number; url?: string };
}

interface CommonsRestSearchResponse {
  pages?: Array<{
    key?: string;
    title?: string;
  }>;
}

interface WikidataSearchResult {
  id?: string;
  label?: string;
  description?: string;
}

interface WikidataSearchResponse {
  search?: WikidataSearchResult[];
}

interface WikidataEntityResponse {
  entities?: Record<string, {
    claims?: Record<string, Array<{
      mainsnak?: { datavalue?: { value?: unknown } };
    }>>;
  }>;
}

interface WikipediaPageImagesResponse {
  query?: { pages?: Array<{
    title?: string;
    pageimage?: string;
    description?: string;
    pageprops?: { disambiguation?: string };
  }> };
}

let lastCommonsRequestAt = 0;
let commonsRateLimitedUntil = 0;
let lastWikidataRequestAt = 0;
let lastWikipediaRequestAt = 0;
let commonsRequestTail: Promise<void> = Promise.resolve();
let wikidataRequestTail: Promise<void> = Promise.resolve();
let wikipediaRequestTail: Promise<void> = Promise.resolve();

async function paceCommonsRequest(): Promise<void> {
  const previous = commonsRequestTail;
  let release!: () => void;
  commonsRequestTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    if (Date.now() < commonsRateLimitedUntil) {
      const remainingMs = commonsRateLimitedUntil - Date.now();
      throw new Error(`Wikimedia Commons API: rate limit activo; reintentar en ${Math.ceil(remainingMs / 1000)} s`);
    }
    const waitMs = config.commonsMinRequestIntervalMs - (Date.now() - lastCommonsRequestAt);
    if (waitMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, waitMs));
    lastCommonsRequestAt = Date.now();
  } finally {
    release();
  }
}

async function paceAuxiliaryRequest(kind: 'wikidata' | 'wikipedia'): Promise<void> {
  const previous = kind === 'wikidata' ? wikidataRequestTail : wikipediaRequestTail;
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  if (kind === 'wikidata') wikidataRequestTail = next;
  else wikipediaRequestTail = next;
  await previous;
  try {
    const lastRequestAt = kind === 'wikidata' ? lastWikidataRequestAt : lastWikipediaRequestAt;
    const waitMs = config.commonsMinRequestIntervalMs - (Date.now() - lastRequestAt);
    if (waitMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, waitMs));
    if (kind === 'wikidata') lastWikidataRequestAt = Date.now();
    else lastWikipediaRequestAt = Date.now();
  } finally {
    release();
  }
}

export interface CommonsImageCandidate {
  title: string;
  descriptionUrl: string;
  fileUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  mimeType: string;
  sourceSha1?: string;
  licenseName?: string;
  licenseUrl?: string;
  author?: string;
  description?: string;
  rightsClass: 'permissive' | 'share_alike' | 'unknown_or_restricted';
  reviewRequired: true;
  /** Present only when the file was reached through the person's Wikidata P18 claim. */
  wikidataEntityId?: string;
  wikidataP18?: true;
}

export type CommonsAssetKind = 'portrait' | 'badge';

/**
 * A manifest is a cache of search results, not identity evidence. Revalidate
 * every cached candidate before downloading it again.
 */
export function isValidCommonsCandidate(
  candidate: CommonsImageCandidate,
  kind: CommonsAssetKind,
  entityName: string,
  aliases: string[] = [],
  context?: string
): boolean {
  if (!candidate || typeof candidate !== 'object') return false;
  if (!candidate.title || !candidate.descriptionUrl || !candidate.fileUrl) return false;
  if (!Number.isFinite(candidate.width) || !Number.isFinite(candidate.height)
    || candidate.width <= 0 || candidate.height <= 0) return false;
  // Keep discovery aligned with the staging gate. Historical portraits can
  // be clear while one side is below the delivery size; bounded upscaling is
  // reviewed later and must not be filtered out at discovery time.
  if (kind === 'portrait' && (candidate.width < 320 || candidate.height < 320)) return false;
  if (typeof candidate.mimeType !== 'string' || !candidate.mimeType.startsWith('image/')) return false;
  if (!candidate.licenseName) return false;
  if (kind === 'portrait' && /\.svg(?:$|[?#])/i.test(candidate.fileUrl)) return false;
  if (/\b(?:pdf|djvu|scan|book|document|journal|yearbook)\b/i.test(`${candidate.title} ${candidate.description ?? ''}`)) return false;
  try {
    const descriptionUrl = new URL(candidate.descriptionUrl);
    const fileUrl = new URL(candidate.fileUrl);
    if (descriptionUrl.protocol !== 'https:'
      || descriptionUrl.hostname !== 'commons.wikimedia.org'
      || !descriptionUrl.pathname.startsWith('/wiki/File:')) return false;
    if (fileUrl.protocol !== 'https:' || fileUrl.hostname !== 'upload.wikimedia.org') return false;
  } catch {
    return false;
  }
  const names = [...new Set([entityName, ...aliases].map((name) => name?.trim()).filter(Boolean))];
  if (names.length === 0) return false;
  return kind === 'badge'
    ? isLikelyBadgeCandidate(candidate, names)
    : isLikelyPortraitCandidate(candidate, names, context);
}

export async function searchCommonsCandidates(
  name: string,
  kind: 'portrait' | 'badge',
  limit = 5,
  aliases: string[] = [],
  context?: string,
  options: { fast?: boolean; wikidataOnly?: boolean } = {}
): Promise<CommonsImageCandidate[]> {
  const queryNames = [...new Set([name, ...aliases].filter(Boolean))];
  const candidates = new Map<string, CommonsImageCandidate>();
  let wikidataSearched = false;
  if (queryNames.length === 0) return [];

  // This mode is intentionally strict for the production licence batch:
  // identity must be established by Wikidata's exact person -> P18 link
  // before Commons metadata is fetched. It never falls back to a textual
  // Commons/Wikipedia search, whose result is only a name-level hint.
  if (options.wikidataOnly && kind === 'portrait') {
    return searchWikidataLinkedPortraits(name, aliases, context, limit);
  }
  // Search all reviewed aliases in one Commons request. The old loop made
  // one request per alias, which multiplied rate-limit pressure without
  // changing the identity filter applied below.
  const quotedNames = queryNames
    .map((queryName) => `"${queryName.replaceAll('"', '')}"`)
    .join(' OR ');
  const contextTerm = context?.trim() ? ` ${context.trim()}` : '';
  const searchTerm = kind === 'portrait'
    ? `(${quotedNames})${contextTerm} footballer`
    : `(${quotedNames}) football club crest logo`;
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', searchTerm);
  url.searchParams.set('gsrnamespace', '6');
  // The query combines the canonical name and aliases. Ten results for the
  // whole OR expression is too small for common surnames; fetch a wider
  // candidate window and apply the strict identity filter below.
  url.searchParams.set('gsrlimit', String(Math.min(Math.max(limit * 5, 20), 50)));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|mime|sha1|extmetadata');
  // Keep enough source resolution for the staging gate. The returned width
  // is used as a minimum-quality check before normalizing to 512x512; asking
  // Commons for a 512px thumbnail would incorrectly reject originals that
  // are large enough but happen to be downscaled to 501px or similar.
  url.searchParams.set('iiurlwidth', '960');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  let directError: unknown = null;
  try {
    const payload = await fetchCommonsJson(url);
    for (const candidate of (payload.query?.pages ?? [])
      .map((page) => toCandidate(page))
      .filter((item): item is CommonsImageCandidate => item !== null)
      .filter((candidate) => kind === 'badge'
        ? isLikelyBadgeCandidate(candidate, queryNames)
        : isLikelyPortraitCandidate(candidate, queryNames, context))) {
      candidates.set(candidate.title, candidate);
    }
  } catch (error) {
    directError = error;
  }

  let directCandidates = [...candidates.values()]
    .sort((a, b) => scoreCandidate(b, queryNames, kind) - scoreCandidate(a, queryNames, kind))
    .slice(0, Math.min(Math.max(limit, 1), 10));

  // Fast batch discovery stays bounded to the primary Commons search plus one
  // exact Wikidata P18 lookup. The P18 lookup is cheap and identity-safe; it
  // must remain in the fast path because valid portraits can have unrelated
  // file titles (for example a match photo rather than the player's name).
  if (directCandidates.length === 0 && options.fast) {
    if (directError && !isRetryableCommonsError(directError)) throw directError;
    const exactUrl = new URL('https://commons.wikimedia.org/w/api.php');
    exactUrl.searchParams.set('action', 'query');
    exactUrl.searchParams.set('generator', 'search');
    exactUrl.searchParams.set('gsrsearch', `intitle:"${name.replaceAll('"', '')}"`);
    exactUrl.searchParams.set('gsrnamespace', '6');
    exactUrl.searchParams.set('gsrlimit', String(Math.min(Math.max(limit * 3, 10), 30)));
    exactUrl.searchParams.set('prop', 'imageinfo');
    exactUrl.searchParams.set('iiprop', 'url|size|mime|sha1|extmetadata');
    exactUrl.searchParams.set('iiurlwidth', '960');
    exactUrl.searchParams.set('format', 'json');
    exactUrl.searchParams.set('formatversion', '2');
    try {
      const payload = await fetchCommonsJson(exactUrl);
      directCandidates = (payload.query?.pages ?? [])
        .map((page) => toCandidate(page))
        .filter((item): item is CommonsImageCandidate => item !== null)
        .filter((candidate) => kind === 'badge'
          ? isLikelyBadgeCandidate(candidate, queryNames)
          : isLikelyPortraitCandidate(candidate, queryNames, context))
        .sort((a, b) => scoreCandidate(b, queryNames, kind) - scoreCandidate(a, queryNames, kind))
        .slice(0, Math.min(Math.max(limit, 1), 10));
    } catch (error) {
      if (!isRetryableCommonsError(error)) throw error;
      directCandidates = [];
    }
    if (directCandidates.length > 0) return directCandidates;
    if (kind === 'portrait') {
      try {
        wikidataSearched = true;
        const linkedCandidates = await searchWikidataLinkedPortraits(name, aliases, context, limit);
        if (linkedCandidates.length > 0) return linkedCandidates;
      } catch (error) {
        if (!isRetryableWikidataError(error)) throw error;
      }
    }
    // A temporary Wikidata limit must not end fast discovery. Continue with
    // the bounded Commons REST and Wikipedia fallbacks below; they still
    // require a licence-bearing, identity-compatible candidate.
  }

  if (directCandidates.length === 0) {
    if (kind === 'portrait') {
      // Prefer an exact Wikidata P18 link before broad Commons search. This
      // is both safer for short player names and cheaper for the API quota.
      try {
        wikidataSearched = true;
        directCandidates = await searchWikidataLinkedPortraits(name, aliases, context, limit);
      } catch (error) {
        // Wikidata and Commons have independent rate limits. A temporary
        // Wikidata 429 must not prevent the Commons REST fallback from
        // finding a properly named, licence-bearing file.
        if (!isRetryableWikidataError(error)) throw error;
      }
      if (directCandidates.length > 0) return directCandidates;
    }
    if (kind === 'badge') {
      // Club logos are commonly linked from Wikidata through P154 even when
      // the Commons file title does not contain the club's display name.
      // This exact entity -> file path is safer and more productive than a
      // broad logo search, while the asset remains pending until its licence
      // and trademark status are reviewed.
      try {
        const linkedCandidates = await searchWikidataLinkedBadges(queryNames, limit);
        if (linkedCandidates.length > 0) return linkedCandidates;
      } catch (error) {
        if (!isRetryableWikidataError(error)) throw error;
      }
    }
    // Batch discovery can opt into a bounded path. Keep one REST fallback in
    // fast mode because it indexes files that the Action API misses; do not
    // continue into category/Wikipedia cascades for unresolved players.
    // The REST search API has a separate quota from the Action API and often
    // indexes files that generator=search misses for short player names.
    try {
      directCandidates = await searchCommonsRestCandidates(searchTerm, kind, queryNames, context, limit);
    } catch (error) {
      // Search REST may be throttled even while the Action API is available.
      // Leave the broad search empty and allow the exact Wikidata P18 path
      // below to run; a transient quota response must not mark the player as
      // permanently unresolved.
      if (!isRetryableCommonsError(error)) throw error;
      directCandidates = [];
    }
    if (directCandidates.length === 0 && directError && !isRetryableCommonsError(directError)) throw directError;
    if (directCandidates.length > 0) return directCandidates;
    if (options.fast) {
      // Keep fast discovery bounded, but do not stop before checking the
      // exact English Wikipedia article. Many legitimate player portraits
      // are linked from the article while the Commons file title itself is
      // not searchable by the provider display name. The result is still
      // filtered through Commons metadata and remains pending for review.
      try {
        return await searchWikipediaArticlePortraits(name, aliases, limit);
      } catch (error) {
        if (!isRetryableWikipediaError(error)) throw error;
        return [];
      }
    }
  }

  // Some current players have no Commons file whose title contains the
  // short UEFA display name. Wikidata's P18 claim provides an exact person
  // -> Commons file link without guessing from a surname. It is only a
  // discovery fallback; the asset still remains pending for visual and
  // licence review.
  if (kind === 'portrait' && directCandidates.length === 0) {
    if (!wikidataSearched) {
      try {
        wikidataSearched = true;
        directCandidates = await searchWikidataLinkedPortraits(name, aliases, context, limit);
      } catch (error) {
        if (!isRetryableWikidataError(error)) throw error;
        directCandidates = [];
      }
    }
    if (directCandidates.length > 0) return directCandidates;
    // A number of valid Commons portraits are filed inside an exact player
    // category but are not discoverable by the file title or a Wikidata P18
    // claim. The category name itself is used as the identity evidence; broad
    // surname/team categories are deliberately excluded.
    try {
      directCandidates = await searchExactPlayerCategoryPortraits(queryNames, limit);
    } catch (error) {
      if (!isRetryableCommonsError(error)) throw error;
      directCandidates = [];
    }
    if (directCandidates.length > 0) return directCandidates;
    try {
      return await searchWikipediaArticlePortraits(name, aliases, limit);
    } catch (error) {
      if (!isRetryableWikipediaError(error)) throw error;
      return [];
    }
  }
  return directCandidates;
}

async function searchExactPlayerCategoryPortraits(names: string[], limit: number): Promise<CommonsImageCandidate[]> {
  const candidates = new Map<string, CommonsImageCandidate>();
  for (const name of names.filter((value) => value.split(/\s+/u).length >= 2)) {
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', `intitle:"${name.replaceAll('"', '')}"`);
    searchUrl.searchParams.set('srnamespace', '14');
    searchUrl.searchParams.set('srlimit', '10');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('formatversion', '2');
    const searchPayload = await fetchCommonsJson<CommonsCategorySearchResponse>(searchUrl);
    for (const result of searchPayload.query?.search ?? []) {
      const categoryTitle = result.title;
      if (!categoryTitle || !isExactPlayerCategory(categoryTitle, name)) continue;
      const membersUrl = new URL('https://commons.wikimedia.org/w/api.php');
      membersUrl.searchParams.set('action', 'query');
      membersUrl.searchParams.set('list', 'categorymembers');
      membersUrl.searchParams.set('cmtitle', categoryTitle);
      membersUrl.searchParams.set('cmnamespace', '6');
      membersUrl.searchParams.set('cmlimit', '20');
      membersUrl.searchParams.set('format', 'json');
      membersUrl.searchParams.set('formatversion', '2');
      const membersPayload = await fetchCommonsJson<CommonsCategoryMembersResponse>(membersUrl);
      for (const member of membersPayload.query?.categorymembers ?? []) {
        if (!member.title) continue;
        const candidate = await fetchCommonsFileRest(member.title);
        if (!candidate || !isLikelyPortraitFile(candidate)) continue;
        candidates.set(candidate.title, candidate);
        if (candidates.size >= Math.min(Math.max(limit, 1), 10)) return [...candidates.values()];
      }
    }
  }
  return [...candidates.values()];
}

function isExactPlayerCategory(categoryTitle: string, name: string): boolean {
  const normalizedCategory = normalizeText(categoryTitle.replace(/^Category:/i, ''));
  const normalizedName = normalizeText(name);
  return normalizedCategory === normalizedName
    || normalizedCategory === `${normalizedName} footballer`
    || normalizedCategory === `${normalizedName} association football player`;
}

async function searchCommonsRestCandidates(searchTerm: string, kind: 'portrait' | 'badge', names: string[], context: string | undefined, limit: number): Promise<CommonsImageCandidate[]> {
  const url = new URL('https://api.wikimedia.org/core/v1/commons/search/page');
  url.searchParams.set('q', searchTerm);
  url.searchParams.set('namespace', '6');
  url.searchParams.set('limit', String(Math.min(Math.max(limit * 2, 5), 20)));
  const payload = await fetchCommonsRestJson<CommonsRestSearchResponse>(url);
  const candidates: CommonsImageCandidate[] = [];
  for (const page of payload.pages ?? []) {
    const title = page.title ?? page.key;
    if (!title) continue;
    const candidate = await fetchCommonsFileRest(title);
    if (!candidate) continue;
    // A broad REST search must still prove the entity name and (when needed)
    // team context. The looser portrait-file filter is reserved for an exact
    // Wikidata P18 link; otherwise unrelated PDFs, stadium photos, or other
    // people can become apparent candidates for short names.
    const matches = kind === 'badge'
      ? isLikelyBadgeCandidate(candidate, names)
      : isLikelyPortraitCandidate(candidate, names, context);
    if (!matches) continue;
    candidates.push(candidate);
    if (candidates.length >= Math.min(Math.max(limit, 1), 10)) break;
  }
  return candidates.sort((a, b) => scoreCandidate(b, names, kind) - scoreCandidate(a, names, kind));
}

function isRetryableCommonsError(error: unknown): boolean {
  return /rate limit|\b429\b|\b5\d\d\b/i.test(error instanceof Error ? error.message : String(error));
}

function isRetryableWikidataError(error: unknown): boolean {
  return /rate limit|\b429\b|\b5\d\d\b/i.test(error instanceof Error ? error.message : String(error));
}

function isRetryableWikipediaError(error: unknown): boolean {
  return /rate limit|\b429\b|\b5\d\d\b/i.test(error instanceof Error ? error.message : String(error));
}

export async function searchWikidataLinkedPortraits(name: string, aliases: string[], context: string | undefined, limit: number): Promise<CommonsImageCandidate[]> {
  const queryNames = [...new Set([name, ...aliases].map((value) => value.trim()).filter(Boolean))];
  // UEFA frequently stores only a surname as the display name while an alias
  // contains the actual full name. Search full names first. Appending the
  // current club to every query made Wikidata return no result for perfectly
  // valid people (the club is not consistently present in Wikidata labels),
  // and it also caused several needless retries during batch discovery.
  const fullNameTerms = queryNames
    .filter((value) => value.split(/\s+/u).length >= 2)
    .sort((left, right) => right.length - left.length);
  const shortNameTerms = queryNames
    .filter((value) => !fullNameTerms.includes(value))
    .map((value) => context?.trim() ? `${value} ${context.trim()}` : value);
  const queryTerms = [...new Set([...fullNameTerms, ...shortNameTerms])].slice(0, 3);
  const entities = new Map<string, WikidataSearchResult>();
  for (const queryTerm of queryTerms) {
    const searchUrl = new URL('https://www.wikidata.org/w/api.php');
    searchUrl.searchParams.set('action', 'wbsearchentities');
    searchUrl.searchParams.set('search', queryTerm);
    searchUrl.searchParams.set('language', 'en');
    searchUrl.searchParams.set('uselang', 'en');
    searchUrl.searchParams.set('type', 'item');
    searchUrl.searchParams.set('limit', '5');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('formatversion', '2');
    const payload = await fetchWikidataJson<WikidataSearchResponse>(searchUrl);
    for (const result of payload.search ?? []) {
      if (result.id && result.label) entities.set(result.id, result);
    }
    if (entities.size >= 5) break;
  }

  const candidates: CommonsImageCandidate[] = [];
  for (const [entityId, result] of entities) {
    if (!isLikelyWikidataFootballer(result, queryNames, context)) continue;
    const entityUrl = new URL('https://www.wikidata.org/w/api.php');
    entityUrl.searchParams.set('action', 'wbgetentities');
    entityUrl.searchParams.set('ids', entityId);
    entityUrl.searchParams.set('props', 'claims');
    entityUrl.searchParams.set('format', 'json');
    entityUrl.searchParams.set('formatversion', '2');
    const entityPayload = await fetchWikidataJson<WikidataEntityResponse>(entityUrl);
    const claims = entityPayload.entities?.[entityId]?.claims?.P18 ?? [];
    const fileName = claims
      .map((claim) => claim.mainsnak?.datavalue?.value)
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (!fileName) continue;
    // REST avoids the Action API quota, which is especially important during
    // a discovery batch. The file page is still parsed for license metadata.
    let candidate: CommonsImageCandidate | null = null;
    try {
      candidate = await fetchCommonsFileRest(`File:${fileName}`);
    } catch (error) {
      // The REST endpoint has a separate quota from Action API. If it is
      // temporarily throttled, keep the exact Wikidata P18 match and use the
      // Action API fallback instead of losing a valid candidate altogether.
      if (!isRetryableCommonsError(error)) throw error;
      candidate = await fetchCommonsFile(`File:${fileName}`);
    }
    // P18 is a useful identity signal, but it is not infallible: Wikidata
    // occasionally contains a stale or colliding image claim (especially for
    // short names such as "Fred"). Re-run the same name, context, resolution
    // and raster checks used by the normal discovery path before returning it.
    if (!candidate || !isValidCommonsCandidate(candidate, 'portrait', name, aliases, context)) continue;
    candidates.push({ ...candidate, wikidataEntityId: entityId, wikidataP18: true });
    if (candidates.length >= Math.min(Math.max(limit, 1), 10)) break;
  }
  return candidates;
}

async function searchWikidataLinkedBadges(names: string[], limit: number): Promise<CommonsImageCandidate[]> {
  const queryNames = [...new Set(names.map((value) => value.trim()).filter(Boolean))].slice(0, 3);
  const entities = new Map<string, WikidataSearchResult>();
  for (const queryName of queryNames) {
    const searchUrl = new URL('https://www.wikidata.org/w/api.php');
    searchUrl.searchParams.set('action', 'wbsearchentities');
    searchUrl.searchParams.set('search', queryName);
    searchUrl.searchParams.set('language', 'en');
    searchUrl.searchParams.set('uselang', 'en');
    searchUrl.searchParams.set('type', 'item');
    searchUrl.searchParams.set('limit', '5');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('formatversion', '2');
    const payload = await fetchWikidataJson<WikidataSearchResponse>(searchUrl);
    for (const result of payload.search ?? []) {
      if (result.id && result.label && isLikelyWikidataClub(result, queryName)) entities.set(result.id, result);
    }
    if (entities.size >= 5) break;
  }

  const candidates: CommonsImageCandidate[] = [];
  for (const [entityId] of entities) {
    const entityUrl = new URL('https://www.wikidata.org/w/api.php');
    entityUrl.searchParams.set('action', 'wbgetentities');
    entityUrl.searchParams.set('ids', entityId);
    entityUrl.searchParams.set('props', 'claims');
    entityUrl.searchParams.set('format', 'json');
    entityUrl.searchParams.set('formatversion', '2');
    const entityPayload = await fetchWikidataJson<WikidataEntityResponse>(entityUrl);
    const claims = entityPayload.entities?.[entityId]?.claims?.P154 ?? [];
    const fileName = claims
      .map((claim) => claim.mainsnak?.datavalue?.value)
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (!fileName) continue;
    let candidate: CommonsImageCandidate | null = null;
    try {
      candidate = await fetchCommonsFileRest(`File:${fileName}`);
    } catch (error) {
      if (!isRetryableCommonsError(error)) throw error;
      candidate = await fetchCommonsFile(`File:${fileName}`);
    }
    if (!candidate || !isLikelyBadgeFile(candidate, true)) continue;
    candidates.push(candidate);
    if (candidates.length >= Math.min(Math.max(limit, 1), 10)) break;
  }
  return candidates;
}

function isLikelyWikidataClub(result: WikidataSearchResult, queryName: string): boolean {
  const label = normalizeText(result.label ?? '');
  const query = normalizeText(queryName);
  const description = normalizeText(result.description ?? '');
  return Boolean(query.length > 2 && (label === query || label.includes(query) || query.includes(label))
    && /(football|soccer|futbol|sports club|club|team|association)/i.test(description));
}

function isLikelyBadgeFile(candidate: CommonsImageCandidate, exactLinked = false): boolean {
  const haystack = normalizeText(`${candidate.title} ${candidate.description ?? ''}`);
  if (/\b(flag|stadium|spectators|shirt|jersey|kit|group photo|team photo|map|match|ground|painting|statue|sculpture|stamp|trading card)\b/i.test(haystack)) return false;
  return exactLinked || /\b(crest|logo|badge|emblem|coat of arms|club mark|football club)\b/i.test(haystack);
}

/**
 * Looks for an image declared by an exact full-name Wikipedia article and
 * accepts it only when the same file is present on Commons with explicit
 * image metadata. Local Wikipedia fair-use files therefore never become
 * candidates. This is a fallback for players whose Wikidata item has no P18.
 */
async function searchWikipediaArticlePortraits(name: string, aliases: string[], limit: number): Promise<CommonsImageCandidate[]> {
  const queryNames = [...new Set([name, ...aliases]
    .map((value) => value.trim())
    .filter((value) => value.split(/\s+/).length >= 2))].slice(0, 3);
  const candidates: CommonsImageCandidate[] = [];
  for (const queryName of queryNames) {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', queryName);
    url.searchParams.set('redirects', '1');
    url.searchParams.set('prop', 'pageimages|description|pageprops');
    url.searchParams.set('piprop', 'name|original');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    const payload = await fetchWikipediaJson(url);
    for (const page of payload.query?.pages ?? []) {
      const description = normalizeText(page.description ?? '');
      if (!page.pageimage || page.pageprops?.disambiguation || !/(football|soccer|futsal|goalkeeper|midfielder|defender|forward|striker)/i.test(description)) continue;
      const candidate = await fetchCommonsFile(`File:${page.pageimage}`);
      if (!candidate || !isLikelyPortraitFile(candidate)) continue;
      candidates.push(candidate);
      if (candidates.length >= Math.min(Math.max(limit, 1), 10)) return candidates;
    }
  }
  return candidates;
}

function isLikelyWikidataFootballer(result: WikidataSearchResult, names: string[], context?: string): boolean {
  const label = normalizeText(result.label ?? '');
  const description = normalizeText(result.description ?? '');
  const nameMatches = names.some((name) => {
    const normalized = normalizeText(name);
    return normalized.length > 2 && (label === normalized || label.includes(normalized) || normalized.includes(label));
  });
  if (!nameMatches) return false;
  if (!/(football|soccer|futsal|goalkeeper|midfielder|defender|forward|striker|sportsperson)/i.test(description)) return false;
  // A club/team context is helpful for short names, but it is not required:
  // Wikidata descriptions often omit the current club for active players.
  if (context?.trim() && label.length <= 4 && !description.includes(normalizeText(context))) return false;
  return true;
}

function isLikelyPortraitFile(candidate: CommonsImageCandidate): boolean {
  const haystack = normalizeText(`${candidate.title} ${candidate.description ?? ''}`);
  return !/\b(flag|stadium|spectators|kit|shirt|jersey|logo|crest|badge|group photo|team photo|painting|statue|sculpture|waxwork|stamp|trading card|squad|teammate|with a fan|award ceremony|trophy ceremony|podium)\b/i.test(haystack)
    && !/\b(?:with|and)\b|&/i.test(candidate.title);
}

export async function fetchCommonsFile(title: string): Promise<CommonsImageCandidate | null> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('titles', title);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|mime|sha1|extmetadata');
  url.searchParams.set('iiurlwidth', '960');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const payload = await fetchCommonsJson(url);
  return toCandidate(payload.query?.pages?.[0]);
}

/**
 * Retrieves one explicitly named file through Wikimedia's REST API.
 * It is intentionally not used for search: the description page is still
 * parsed and the result remains pending until a human checks identity.
 */
export async function fetchCommonsFileRest(title: string): Promise<CommonsImageCandidate | null> {
  const normalizedTitle = title.startsWith('File:') ? title : `File:${title}`;
  const canonicalDescriptionUrl = (value: string): string => value
    .replace(/^https:\/\/commons\.wikimedia\.org\/wiki\/File%3A/i, 'https://commons.wikimedia.org/wiki/File:')
    .replace(/^https:\/\/commons\.wikimedia\.org\/wiki\/File%3a/i, 'https://commons.wikimedia.org/wiki/File:');
  const fileUrl = new URL(`https://api.wikimedia.org/core/v1/commons/file/${encodeURIComponent(normalizedTitle.slice(5))}`);
  let fileResponse: Response;
  try {
    fileResponse = await fetchCommonsRestResponse(fileUrl, 'application/json');
  } catch (error) {
    // Commons may rate-limit the REST endpoint while the public file page is
    // still available. The HTML fallback extracts the same rights and file
    // metadata, so a temporary REST 429 does not discard a valid candidate.
    if (!/rate limit|429/i.test(error instanceof Error ? error.message : String(error))) throw error;
    return fetchCommonsFileHtml(normalizedTitle);
  }
  if (fileResponse.status === 404) return null;
  if (!fileResponse.ok) throw new Error(`Wikimedia Commons REST ${fileResponse.status}`);
  const file = (await fileResponse.json()) as CommonsRestFile;
  const original = file.original;
  const preferred = file.preferred;
  if (!file.title || !original?.url || !original.width || !original.height) return null;

  let descriptionResponse: Response;
  try {
    descriptionResponse = await fetchCommonsRestResponse(`https://commons.wikimedia.org/w/rest.php/v1/page/${encodeURIComponent(normalizedTitle)}/html`, 'text/html');
  } catch (error) {
    // The REST file endpoint and the REST description endpoint can be
    // throttled independently. Reuse the HTML file-page parser when only
    // the description request is rate-limited; it preserves the same
    // license/author checks and the asset remains pending for review.
    if (!/rate limit|429/i.test(error instanceof Error ? error.message : String(error))) throw error;
    return fetchCommonsFileHtml(normalizedTitle);
  }
  if (!descriptionResponse.ok) throw new Error(`Wikimedia Commons description ${descriptionResponse.status}`);
  const descriptionHtml = await descriptionResponse.text();
  const licenseName = extractHtmlValue(descriptionHtml, 'licensetpl_short');
  const licenseUrl = extractHtmlValue(descriptionHtml, 'licensetpl_link');
  const author = stripWikitext(extractWikitextValue(descriptionHtml, 'Author'));
  const description = stripWikitext(extractWikitextValue(descriptionHtml, 'Description'));
  const mimeType = mimeTypeFromUrl(original.url);
  return {
    title: `File:${file.title}`,
    descriptionUrl: canonicalDescriptionUrl(file.file_description_url?.startsWith('//') ? `https:${file.file_description_url}` : `https://commons.wikimedia.org/wiki/${encodeURIComponent(normalizedTitle.replaceAll(' ', '_'))}`),
    fileUrl: original.url,
    thumbnailUrl: preferred?.url,
    width: original.width,
    height: original.height,
    mimeType,
    licenseName,
    licenseUrl,
    author,
    description,
    rightsClass: classifyLicense(licenseName),
    reviewRequired: true
  };
}

async function fetchCommonsFileHtml(title: string): Promise<CommonsImageCandidate | null> {
  const normalizedTitle = title.startsWith('File:') ? title : `File:${title}`;
  const encodedTitle = encodeURIComponent(normalizedTitle.replaceAll(' ', '_')).replace(/^File%3A/i, 'File:');
  const pageUrl = `https://commons.wikimedia.org/wiki/${encodedTitle}`;
  const response = await fetch(pageUrl, {
    headers: { 'User-Agent': config.mediaUserAgent, Accept: 'text/html' },
    signal: AbortSignal.timeout(config.mediaDiscoveryRequestTimeoutMs)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Wikimedia Commons page ${response.status}`);
  const html = await response.text();
  const decodeHtml = (value: string): string => value
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
  const originalMatch = html.match(/<a href="(https:\/\/upload\.wikimedia\.org\/[^\"]+)"[^>]*class="internal"[^>]*>Original file/is);
  const infoMatch = html.match(/class="fileInfo"[^>]*>\(([^×]+)×\s*([^ ]+) pixels,.*?MIME type:\s*<span class="mime-type">([^<]+)</is);
  const thumbnailMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
  const thumbnailUrlEncoded = thumbnailMatch?.[1];
  const originalUrlEncoded = originalMatch?.[1];
  const widthRaw = infoMatch?.[1];
  const heightRaw = infoMatch?.[2];
  const mimeRaw = infoMatch?.[3];
  if (!originalUrlEncoded || !widthRaw || !heightRaw || !mimeRaw) return null;
  const width = Number(widthRaw.replace(/[^0-9]/g, ''));
  const height = Number(heightRaw.replace(/[^0-9]/g, ''));
  const fileUrl = decodeHtml(originalUrlEncoded);
  const licenseName = extractHtmlValue(html, 'licensetpl_short');
  const licenseUrl = extractHtmlValue(html, 'licensetpl_link');
  if (!width || !height || !fileUrl || !licenseName) return null;
  return {
    title: normalizedTitle,
    descriptionUrl: pageUrl,
    fileUrl,
    thumbnailUrl: thumbnailUrlEncoded ? decodeHtml(thumbnailUrlEncoded) : undefined,
    width,
    height,
    mimeType: mimeRaw.trim(),
    licenseName,
    licenseUrl,
    author: stripWikitext(extractWikitextValue(html, 'author')),
    description: stripWikitext(extractWikitextValue(html, 'description')),
    rightsClass: classifyLicense(licenseName),
    reviewRequired: true
  };
}

export async function downloadCommonsFile(fileUrl: string): Promise<Buffer> {
  const parsedUrl = new URL(fileUrl);
  if (parsedUrl.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(parsedUrl.hostname)) {
    throw new Error('La descarga no procede de un dominio de archivos de Commons permitido');
  }
  for (let attempt = 0; attempt < config.mediaMaxAttempts; attempt += 1) {
    const response = await fetch(parsedUrl, {
      headers: { 'User-Agent': config.mediaUserAgent },
      signal: AbortSignal.timeout(config.mediaRequestTimeoutMs)
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status !== 429 && response.status < 500) throw new Error(`Descarga de Commons ${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    if (attempt < config.mediaMaxAttempts - 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(waitMs, config.mediaRetryMaxMs)));
    }
  }
  throw new Error('Descarga de Commons: demasiados reintentos por rate limit o error temporal');
}

function toCandidate(page: CommonsPage | undefined): CommonsImageCandidate | null {
  const info = page?.imageinfo?.[0];
  if (!page?.title || !info?.descriptionurl || !info.url || !info.width || !info.height || !info.mime || !info.mime.startsWith('image/')) return null;
  const metadata = info.extmetadata ?? {};
  const licenseName = cleanMetadata(metadata.LicenseShortName);
  return {
    title: page.title,
    descriptionUrl: info.descriptionurl,
    fileUrl: info.url,
    thumbnailUrl: info.thumburl,
    width: info.width,
    height: info.height,
    mimeType: info.mime,
    sourceSha1: info.sha1,
    licenseName,
    licenseUrl: cleanMetadata(metadata.LicenseUrl),
    author: cleanMetadata(metadata.Artist),
    description: cleanMetadata(metadata.ImageDescription),
    rightsClass: classifyLicense(licenseName),
    reviewRequired: true
  };
}

function isLikelyBadgeCandidate(candidate: CommonsImageCandidate, names: string[]): boolean {
  const normalizedHaystack = normalizeText(`${candidate.title} ${candidate.description ?? ''}`);
  const normalizedTitle = normalizeText(candidate.title);
  const hasEntityName = names.some((name) => containsNormalizedPhrase(normalizedHaystack, name, 3));
  if (!hasEntityName) return false;
  if (/\b(flag|stadium|spectators|safety|order|map|kit|shirt|jersey|match|ground|team photo|group photo|players|footballer|coach|manager|staff|trophy|cup final)\b/i.test(normalizedHaystack)) return false;
  if (/\b(?:with|and|versus|vs)\b|&/i.test(normalizedTitle)) return false;
  // Broad text search needs a positive badge signal. Otherwise names such as
  // Celtic, Genoa or Oxford match monuments, ports and university buildings.
  return /\b(crest|logo|badge|emblem|coat of arms|club mark|football club)\b/i.test(normalizedHaystack);
}

function isLikelyPortraitCandidate(candidate: CommonsImageCandidate, names: string[], context?: string): boolean {
  const haystack = `${candidate.title} ${candidate.description ?? ''}`.toLowerCase();
  const normalizedHaystack = normalizeText(haystack);
  let hasName = false;
  let hasFullName = false;
  names.some((name) => {
    const normalizedName = normalizeText(name).trim();
    if (normalizedName.length <= 2) return false;
    if (containsNormalizedPhrase(normalizedHaystack, normalizedName, 3)) {
      hasName = true;
      if (normalizedName.split(/\s+/).length >= 2) hasFullName = true;
      return true;
    }

    const nameTokens = normalizedName.split(/\s+/).filter(Boolean);
    const haystackTokens = normalizedHaystack.split(/[^a-z0-9]+/).filter(Boolean);
    if (nameTokens.length >= 3) {
      // Full-name aliases must retain both ends of the name. This avoids
      // accepting an unrelated "Javier" or "Pedro" merely because a source
      // uses a common surname.
      const firstName = nameTokens[0];
      const surname = nameTokens.at(-1);
      const firstNameIndex = firstName ? haystackTokens.indexOf(firstName) : -1;
      const matched = Boolean(firstName && surname && firstName.length > 2 && surname.length > 3
        && firstNameIndex >= 0
        && haystackTokens.slice(firstNameIndex + 1, firstNameIndex + 4).includes(surname));
      if (matched) {
        hasName = true;
        hasFullName = true;
      }
      return matched;
    }

    // UEFA and other competition tables often expose only an initial plus surname.
    // Matching the surname is useful for short display names, but only when it
    // is reasonably distinctive and the candidate is not a full-name alias.
    const surname = nameTokens.filter((token) => token.length > 3).at(-1);
    const matched = Boolean(surname && haystackTokens.includes(surname));
    if (matched) hasName = true;
    return matched;
  });
  if (!hasName) return false;

  // UEFA often supplies only a surname or a short display name. In that
  // case a name-only Commons search is unsafe: it routinely resolves to a
  // different footballer, coach, or historical figure. Keep a short-name
  // candidate only when the source team is also visible in the file metadata.
  if (context?.trim() && !hasFullName) {
    const normalizedContext = normalizeText(context);
    if (!normalizedContext || !containsNormalizedPhrase(normalizedHaystack, normalizedContext, 3)) return false;
  }

  // Commons search results can have a misleading filename but a caption that
  // explicitly identifies a different person (for example, a file named for
  // Fábio Santos whose description says "Fernando Torres of Chelsea"). Treat
  // that explicit caption as contradictory identity evidence. Generic
  // descriptions are left alone; they still require the normal title/name
  // checks above and manual visual review before staging.
  if (descriptionIdentifiesDifferentPerson(candidate.description, names)) return false;

  return !/\b(flag|stadium|spectators|safety|order|map|kit|shirt|jersey|socks|signature|logo|crest|coat of arms|badge|group photo|team photo|with a fan|dressing room|grave|tomb|memorial|statue|sculpture|waxwork|shirtless|painting|postcard|stamp|trading card|squad|team mate|teammate|coach|manager|managing|trainer|entrenador|tecnico|treinador|melodifestivalen|actor|actress|politician|singer|musician|receives award|award ceremony|trophy ceremony|podium|grab|friedhof|cemetery|cimitero|cimetière|pdf|djvu|scan|book|document|journal|yearbook|school team)\b/i.test(normalizedHaystack)
    && !/\b(?:with|and)\b|&/i.test(candidate.title);
}

function descriptionIdentifiesDifferentPerson(description: string | undefined, names: string[]): boolean {
  if (!description?.trim()) return false;

  // This deliberately recognises only caption-like constructions. Applying a
  // broad named-entity detector here would reject valid Commons descriptions
  // that mention a team, venue or event in passing.
  const captionPattern = /(?:^|[.;|])\s*(?:portrait|photo|photograph|image)?\s*(?:of\s+)?((?:[A-ZÀ-ÖØ-Ý][\p{L}'’.-]+\s+){1,3}[A-ZÀ-ÖØ-Ý][\p{L}'’.-]+)\s+(?:of|at|in|for|playing|wearing|during)\b/u;
  const match = description.match(captionPattern);
  if (!match?.[1]) return false;

  const describedName = normalizeText(match[1]);
  return !names.some((name) => {
    const normalizedName = normalizeText(name);
    return normalizedName.length > 2
      && (describedName === normalizedName
        || describedName.includes(normalizedName)
        || normalizedName.includes(describedName));
  });
}

function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function containsNormalizedPhrase(haystack: string, value: string, minimumLength: number): boolean {
  const normalizedValue = normalizeText(value);
  if (normalizedValue.length < minimumLength) return false;
  const escaped = normalizedValue.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(?:^| )${escaped}(?:$| )`, 'u').test(haystack);
}

async function fetchCommonsJson<T = CommonsSearchResponse>(url: URL): Promise<T> {
  for (let attempt = 0; attempt < config.mediaDiscoveryMaxAttempts; attempt += 1) {
    await paceCommonsRequest();
    const response = await fetch(url, {
      headers: { 'User-Agent': config.mediaUserAgent },
      signal: AbortSignal.timeout(config.mediaDiscoveryRequestTimeoutMs)
    });
    if (response.ok) return (await response.json()) as T;
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const cooldownMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.max(config.commonsMinRequestIntervalMs * 4, 30_000);
      // Keep a discovery batch bounded. A later resumable run can honour a
      // longer provider window without blocking the whole import process.
      commonsRateLimitedUntil = Math.max(commonsRateLimitedUntil, Date.now() + Math.min(cooldownMs, config.mediaRetryMaxMs));
      if (attempt < config.mediaDiscoveryMaxAttempts - 1) continue;
      throw new Error('Wikimedia Commons API: rate limit activo; reintentar después de la ventana de enfriamiento');
    }
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Wikimedia Commons API ${response.status}`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    if (attempt < config.mediaDiscoveryMaxAttempts - 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(waitMs, config.mediaRetryMaxMs)));
    }
  }
  throw new Error('Wikimedia Commons API: demasiados reintentos por rate limit o error temporal');
}

async function fetchWikidataJson<T>(url: URL): Promise<T> {
  for (let attempt = 0; attempt < config.mediaDiscoveryMaxAttempts; attempt += 1) {
    await paceAuxiliaryRequest('wikidata');
    const response = await fetch(url, {
      headers: { 'User-Agent': config.mediaUserAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(config.mediaDiscoveryRequestTimeoutMs)
    });
    if (response.ok) return await response.json() as T;
    if (response.status !== 429 && response.status < 500) throw new Error(`Wikidata API ${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const retryMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    if (attempt < config.mediaDiscoveryMaxAttempts - 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(retryMs, config.mediaRetryMaxMs)));
    }
  }
  throw new Error('Wikidata API: demasiados reintentos por rate limit o error temporal');
}

async function fetchWikipediaJson(url: URL): Promise<WikipediaPageImagesResponse> {
  for (let attempt = 0; attempt < config.mediaDiscoveryMaxAttempts; attempt += 1) {
    await paceAuxiliaryRequest('wikipedia');
    const response = await fetch(url, {
      headers: { 'User-Agent': config.mediaUserAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(config.mediaDiscoveryRequestTimeoutMs)
    });
    if (response.ok) return await response.json() as WikipediaPageImagesResponse;
    if (response.status !== 429 && response.status < 500) throw new Error(`Wikipedia API ${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const retryMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    if (attempt < config.mediaDiscoveryMaxAttempts - 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(retryMs, config.mediaRetryMaxMs)));
    }
  }
  throw new Error('Wikipedia API: demasiados reintentos por rate limit o error temporal');
}

async function paceCommonsRestRequest(): Promise<void> {
  await paceCommonsRequest();
}

async function fetchCommonsRestJson<T>(url: URL): Promise<T> {
  const response = await fetchCommonsRestResponse(url, 'application/json');
  return await response.json() as T;
}

async function fetchCommonsRestResponse(url: URL | string, accept: string): Promise<Response> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < config.mediaDiscoveryMaxAttempts; attempt += 1) {
    await paceCommonsRestRequest();
    const response = await fetch(url, {
      headers: { 'User-Agent': config.mediaUserAgent, Accept: accept },
      signal: AbortSignal.timeout(config.mediaDiscoveryRequestTimeoutMs)
    });
    if (response.ok) return response;
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const cooldownMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.max(config.commonsMinRequestIntervalMs * 4, 30_000);
      commonsRateLimitedUntil = Math.max(commonsRateLimitedUntil, Date.now() + Math.min(cooldownMs, config.mediaRetryMaxMs));
      if (attempt < config.mediaDiscoveryMaxAttempts - 1) continue;
      throw new Error('Wikimedia Commons REST: rate limit activo; reintentar después de la ventana de enfriamiento');
    }
    lastStatus = response.status;
    if (response.status !== 429 && response.status < 500) return response;
    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    if (attempt < config.mediaDiscoveryMaxAttempts - 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(waitMs, config.mediaRetryMaxMs)));
    }
  }
  throw new Error(`Wikimedia Commons REST: demasiados reintentos (último estado ${lastStatus})`);
}

function cleanMetadata(value: CommonsMetadataValue | undefined): string | undefined {
  if (!value?.value) return undefined;
  return value.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || undefined;
}

function extractHtmlValue(html: string, className: string): string | undefined {
  const encodedClassName = className.replaceAll('_', '(?:_|&#95;)');
  const match = html.match(new RegExp(`class="${encodedClassName}"[^>]*>([^<]+)<`, 'i'));
  return match?.[1]?.trim() || undefined;
}

function extractWikitextValue(html: string, key: string): string | undefined {
  // The REST HTML embeds the parsed file information as JSON, but the key
  // casing is not stable (currently it is lower-case: "author",
  // "description"). Keep this case-insensitive so attribution metadata is
  // not silently lost when the REST representation differs from Action API.
  const match = html.match(new RegExp(`\\"${key}\\":\\{\\"wt\\":\\"((?:\\\\.|[^\\"])*)\\"`, 'i'));
  if (!match?.[1]) return undefined;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

function stripWikitext(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

function mimeTypeFromUrl(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function classifyLicense(licenseName: string | undefined): CommonsImageCandidate['rightsClass'] {
  const normalized = licenseName?.toLowerCase() ?? '';
  if (normalized.includes('cc0') || normalized.includes('public domain') || normalized === 'pd') return 'permissive';
  if (normalized.includes('cc by-sa')) return 'share_alike';
  if (normalized.includes('cc by') && !normalized.includes('nc') && !normalized.includes('nd')) return 'permissive';
  return 'unknown_or_restricted';
}

function scoreCandidate(candidate: CommonsImageCandidate, names: string[], kind: 'portrait' | 'badge'): number {
  const haystack = `${candidate.title} ${candidate.description ?? ''}`.toLowerCase();
  let score = 0;
  if (names.some((name) => haystack.includes(name.toLowerCase()))) score += 10;
  if (candidate.rightsClass === 'permissive') score += 4;
  if (candidate.rightsClass === 'share_alike') score += 2;
  if (candidate.width >= 512 && candidate.height >= 512) score += 1;
  if (kind === 'portrait' && /portrait|headshot|footballer|player/i.test(haystack)) score += 2;
  if (kind === 'badge' && /crest|logo|badge|club/i.test(haystack)) score += 2;
  return score;
}
