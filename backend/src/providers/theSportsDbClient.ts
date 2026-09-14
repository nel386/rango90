import { config } from '../config.js';

export interface TheSportsDbTeam {
  idTeam: string;
  strTeam: string;
  strBadge?: string | null;
  strLogo?: string | null;
  strTeamBadge?: string | null;
  strCountry?: string | null;
  strLeague?: string | null;
}

interface TheSportsDbSearchResponse {
  teams?: TheSportsDbTeam[] | null;
}

interface TheSportsDbPlayerSearchResponse {
  player?: TheSportsDbPlayer[] | null;
  // lookupplayer.php uses `players`, while searchplayers.php uses `player`.
  players?: TheSportsDbPlayer[] | null;
}

export interface TheSportsDbPlayer {
  idPlayer: string;
  idAPIfootball?: string | null;
  strPlayer: string;
  strSport?: string | null;
  strTeam?: string | null;
  strThumb?: string | null;
  strCutout?: string | null;
  strRender?: string | null;
  strNationality?: string | null;
  strPosition?: string | null;
  strCreativeCommons?: string | null;
  dateBorn?: string | null;
}

export interface TheSportsDbBadgeCandidate {
  externalId: string;
  teamName: string;
  badgeUrl: string;
  teamUrl: string;
  apiUrl: string;
  provider: 'thesportsdb';
  rightsStatus: 'review_required';
}

export interface TheSportsDbPortraitCandidate {
  externalId: string;
  playerName: string;
  portraitUrl: string;
  playerUrl: string;
  apiUrl: string;
  providerSport?: string | null;
  providerTeam?: string | null;
  providerPosition?: string | null;
  providerNationality?: string | null;
  providerBirthDate?: string | null;
  providerCreativeCommons?: string | null;
  provider: 'thesportsdb';
  rightsStatus: 'review_required';
}

export interface TheSportsDbLicenseEvidence {
  licenseName: string;
  licenseUrl: string;
  sourceUrl: string;
}

let lastRequestAt = 0;

const portraitAliases: Record<string, string[]> = {
  'Lewandowski': ['Robert Lewandowski'],
  'Raúl González': ['Raul Gonzalez'],
  'Mbappé': ['Kylian Mbappe'],
  'Ruud van Nistelrooij': ['Ruud van Nistelrooy'],
  'Haaland': ['Erling Haaland'],
  'F. Inzaghi': ['Filippo Inzaghi'],
  'Eusébio': ['Eusebio'],
  'Griezmann': ['Antoine Griezmann'],
  'Del Piero': ['Alessandro Del Piero'],
  'Morientes': ['Fernando Morientes'],
  'Cavani': ['Edinson Cavani'],
  'Puskás': ['Ferenc Puskas'],
  'Džeko': ['Edin Dzeko'],
  "Samuel Eto'o": ['Samuel Etoo'],
  'Reus': ['Marco Reus'],
  'Litmanen': ['Jari Litmanen'],
  'L. de Jong': ['Luuk de Jong'],
  'Lukaku': ['Romelu Lukaku'],
  'Mané': ['Sadio Mane'],
  'Aubameyang': ['Pierre-Emerick Aubameyang'],
  'Bale': ['Gareth Bale'],
  'Solskjær': ['Ole Gunnar Solskjaer'],
  'Cole': ['Andy Cole'],
  'Van Basten': ['Marco van Basten'],
  'Koller': ['Jan Koller'],
  'Higuaín': ['Gonzalo Higuain'],
  'Anelka': ['Nicolas Anelka'],
  'Mario Gomez': ['Mario Gómez'],
  'L. Martínez': ['Lautaro Martinez'],
  'Sané': ['Leroy Sane'],
  'Lisandro': ['Lisandro Lopez'],
  'Romário': ['Romario'],
  'Heung-Min Son': ['Son Heung Min'],
  'Hernán Crespo': ['Hernan Crespo'],
  'Ousmane Dembélé': ['Ousmane Dembele'],
  'Cabral': ['Arthur Cabral'],
  'Ishak': ['Mikael Ishak'],
  'Pavlidis': ['Vangelis Pavlidis'],
  'Orban': ['Gift Orban'],
  'Abraham': ['Tammy Abraham'],
  'Boyle': ['Martin Boyle'],
  'Diks': ['Kevin Diks'],
  'Parrott': ['Troy Parrott'],
  'Jović': ['Luka Jovic'],
  'Islamović': ['Dino Islamovic'],
  'Varga': ['Barnabas Varga'],
  'Živković': ['Andrija Zivkovic'],
  'B. Ibraimi': ['Besart Ibraimi'],
  'Piątek': ['Krzysztof Piatek'],
  'Tissoudali': ['Tarik Tissoudali'],
  'Brynhildsen': ['Ola Brynhildsen'],
  'Do. Peretz': ['Dor Peretz'],
  'D. de Wit': ['Dani de Wit'],
  'Laborde': ['Gaetan Laborde'],
  'Franculino': ['Franculino Dju'],
  'Sappinen': ['Rauno Sappinen'],
  'Skóraś': ['Michal Skoras'],
  'Zahavi': ['Eran Zahavi'],
  'Cuypers': ['Hugo Cuypers'],
  'Korenica': ['Meriton Korenica'],
  'Pululu': ['Afimico Pululu'],
  'Dessers': ['Cyriel Dessers'],
  'Sinisterra': ['Luis Sinisterra'],
  'El Kaabi': ['Ayoub El Kaabi'],
  'Atzili': ['Omer Atzili'],
  'Jesús Imaz': ['Jesus Imaz'],
  'González': ['Nicolas Gonzalez'],
  'Thiago': ['Thiago Rodrigues'],
  'Mijnans': ['Sven Mijnans'],
  'Kučys': ['Armandas Kucys'],
  'Sarr': ['Ismaila Sarr'],
  'Marc Gual': ['Marc Gual'],
  'Velde': ['Kristoffer Velde'],
  'Grech': ['Jake Grech'],
  'A. Thaqi': ['Armend Thaqi'],
  'Bailey': ['Leon Bailey'],
  'Brown': ['Archie Brown'],
  'Chaibi': ['Fares Chaïbi', 'Fares Chaibi'],
  'Ďuriš': ['Michal Ďuriš', 'Michal Duris'],
  'Frederiksberg': ['Árni Frederiksberg', 'Arni Frederiksberg'],
  'Gosens': ['Robin Gosens'],
  'Hadji': ['Samir Hadji'],
  'Kady': ['Kady Borges'],
  'Lushkja': ['Regi Lushkja'],
  'Nguen': ['Tokmac Nguen'],
  'Pinson': ['Virgile Pinson'],
  'Ro. Riski': ['Roope Riski'],
  'S. Jovetić': ['Stevan Jovetić', 'Stevan Jovetic'],
  'Smith': ['Leo Smith'],
  'Sor': ['Yira Sor'],
  'Šturm': ['Danijel Šturm', 'Danijel Sturm'],
  'Watkins': ['Ollie Watkins'],
  'P. Dárdai': ['Palkó Dárdai'],
  'Chakvetadze': ['Giorgi Chakvetadze'],
  'V. Einarsson': ['Viktor Karl Einarsson'],
  'Bislimi': ['Uran Bislimi']
};

export function aliasesForTheSportsDbPortrait(name: string): string[] {
  return portraitAliases[name] ?? [];
}

export async function searchTheSportsDbTeams(name: string): Promise<{ teams: TheSportsDbTeam[]; apiUrl: string }> {
  const apiUrl = new URL(`${config.theSportsDbBaseUrl}/searchteams.php`);
  apiUrl.searchParams.set('t', name);
  const payload = await requestJson<TheSportsDbSearchResponse>(apiUrl);
  return { teams: payload.teams ?? [], apiUrl: apiUrl.toString() };
}

export async function searchTheSportsDbPlayers(name: string): Promise<{ players: TheSportsDbPlayer[]; apiUrl: string }> {
  const apiUrl = new URL(`${config.theSportsDbBaseUrl}/searchplayers.php`);
  apiUrl.searchParams.set('p', name);
  const payload = await requestJson<TheSportsDbPlayerSearchResponse>(apiUrl);
  return { players: payload.player ?? [], apiUrl: apiUrl.toString() };
}

/**
 * Resolves only a unique normalized exact match. It deliberately does not
 * choose the first fuzzy result because the API returns homonymous clubs.
 */
export function selectExactTheSportsDbTeam(teams: TheSportsDbTeam[], name: string, aliases: string[] = []): TheSportsDbTeam | null {
  const acceptedNames = new Set([name, ...aliases].map(normalizeTeamName));
  const matches = teams.filter((team) => acceptedNames.has(normalizeTeamName(team.strTeam)));
  const unique = new Map(matches.filter((team) => team.idTeam && team.strTeam).map((team) => [team.idTeam, team]));
  if (unique.size > 1) throw new Error(`TheSportsDB devuelve varios clubes para ${name}: ${[...unique.values()].map((team) => team.strTeam).join(', ')}`);
  return [...unique.values()][0] ?? null;
}

export async function resolveTheSportsDbBadge(name: string, aliases: string[] = []): Promise<TheSportsDbBadgeCandidate | null> {
  // The free endpoint may return no useful result for a shortened display
  // name (for example "Man Utd"). Try the explicitly curated aliases one by
  // one, but still require an exact match in the response.
  for (const lookupName of [name, ...aliases]) {
    const { teams, apiUrl } = await searchTheSportsDbTeams(lookupName);
    const team = selectExactTheSportsDbTeam(teams, name, aliases);
    const badgeUrl = team?.strBadge ?? team?.strTeamBadge ?? null;
    if (!team || !badgeUrl) continue;
    assertAllowedImageUrl(badgeUrl);
    return {
      externalId: team.idTeam,
      teamName: team.strTeam,
      badgeUrl,
      teamUrl: `https://www.thesportsdb.com/team/${encodeURIComponent(team.idTeam)}`,
      apiUrl,
      provider: 'thesportsdb',
      rightsStatus: 'review_required'
    };
  }
  return null;
}

export async function resolveTheSportsDbPortrait(name: string, aliases: string[] = []): Promise<TheSportsDbPortraitCandidate | null> {
  const resolved = await resolveTheSportsDbPlayer(name, aliases);
  if (!resolved) return null;
  const { player, apiUrl } = resolved;
  const portraitUrl = player.strThumb ?? player.strCutout ?? player.strRender ?? null;
  if (!portraitUrl) return null;
  assertAllowedImageUrl(portraitUrl);
  return {
    externalId: player.idPlayer,
    playerName: player.strPlayer,
    portraitUrl,
    playerUrl: `https://www.thesportsdb.com/player/${encodeURIComponent(player.idPlayer)}`,
    apiUrl,
    providerSport: player.strSport ?? null,
    providerTeam: player.strTeam ?? null,
    providerPosition: player.strPosition ?? null,
    providerNationality: player.strNationality ?? null,
    providerBirthDate: player.dateBorn ?? null,
    providerCreativeCommons: player.strCreativeCommons ?? null,
    provider: 'thesportsdb',
    rightsStatus: 'review_required'
  };
}

export async function resolveTheSportsDbPlayer(name: string, aliases: string[] = []): Promise<{ player: TheSportsDbPlayer; apiUrl: string } | null> {
  const acceptedNames = new Set([name, ...aliases].map(normalizeTeamName));
  for (const lookupName of [name, ...aliases]) {
    const { players, apiUrl } = await searchTheSportsDbPlayers(lookupName);
    const matches = players.filter((player) => acceptedNames.has(normalizeTeamName(player.strPlayer)) && isSoccerPlayer(player));
    const unique = new Map(matches.filter((player) => player.idPlayer && player.strPlayer).map((player) => [player.idPlayer, player]));
    if (unique.size > 1) throw new Error(`TheSportsDB devuelve varios jugadores para ${name}: ${[...unique.values()].map((player) => player.strPlayer).join(', ')}`);
    const player = [...unique.values()][0];
    if (player) return { player, apiUrl };
  }
  return null;
}

/**
 * Resolve a portrait by the provider's stable player ID. This avoids fuzzy
 * name matching for UEFA's abbreviated display names and is preferred when
 * an existing identity link is available.
 */
export async function resolveTheSportsDbPortraitById(externalId: string): Promise<TheSportsDbPortraitCandidate | null> {
  const player = await lookupTheSportsDbPlayerById(externalId);
  if (!player || !isSoccerPlayer(player)) return null;
  const portraitUrl = player.strThumb ?? player.strCutout ?? player.strRender ?? null;
  if (!portraitUrl) return null;
  assertAllowedImageUrl(portraitUrl);
  return {
    externalId: player.idPlayer,
    playerName: player.strPlayer,
    portraitUrl,
    playerUrl: `https://www.thesportsdb.com/player/${encodeURIComponent(player.idPlayer)}`,
    apiUrl: `${config.theSportsDbBaseUrl}/lookupplayer.php?id=${encodeURIComponent(externalId)}`,
    providerSport: player.strSport ?? null,
    providerTeam: player.strTeam ?? null,
    providerPosition: player.strPosition ?? null,
    providerNationality: player.strNationality ?? null,
    providerBirthDate: player.dateBorn ?? null,
    providerCreativeCommons: player.strCreativeCommons ?? null,
    provider: 'thesportsdb',
    rightsStatus: 'review_required'
  };
}

export async function lookupTheSportsDbPlayerById(externalId: string): Promise<TheSportsDbPlayer | null> {
  const apiUrl = new URL(`${config.theSportsDbBaseUrl}/lookupplayer.php`);
  apiUrl.searchParams.set('id', externalId);
  const payload = await requestJson<TheSportsDbPlayerSearchResponse>(apiUrl);
  return [...(payload.players ?? []), ...(payload.player ?? [])].find((item) => item.idPlayer === externalId) ?? null;
}

export async function downloadTheSportsDbImage(imageUrl: string): Promise<Buffer> {
  assertAllowedImageUrl(imageUrl);
  return requestBytes(new URL(imageUrl));
}

/**
 * Reads the concrete Creative Commons link shown on a TheSportsDB player
 * page. The API exposes only strCreativeCommons=Yes, so the page is needed to
 * distinguish CC BY, CC BY-SA, etc. This is evidence only; it does not
 * approve the asset or grant rights beyond the provider's terms.
 */
export async function fetchTheSportsDbPlayerLicense(playerUrl: string): Promise<TheSportsDbLicenseEvidence | null> {
  const source = new URL(playerUrl);
  if (source.protocol !== 'https:' || !['www.thesportsdb.com', 'thesportsdb.com'].includes(source.hostname)
    || !/^\/player\/\d+(?:[-/]|$)/.test(source.pathname)) {
    throw new Error(`URL de jugador TheSportsDB no permitida: ${playerUrl}`);
  }
  const response = await request(source, 'text/html');
  const html = await response.text();
  const rawHref = html.match(/https?:\/\/creativecommons\.org\/(?:licenses|publicdomain)\/[^\"' <]+/i)?.[0];
  if (!rawHref) return null;
  const licenseUrl = rawHref.replace(/&amp;/g, '&').replace(/[),.;]+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(licenseUrl);
  } catch {
    return null;
  }
  const parts = parsed.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part).toLowerCase());
  if (parts[0] === 'licenses' && parts[1] && parts[2]) {
    const names: Record<string, string> = {
      by: 'CC BY',
      'by-sa': 'CC BY-SA',
      'by-nd': 'CC BY-ND',
      'by-nc': 'CC BY-NC',
      'by-nc-sa': 'CC BY-NC-SA',
      'by-nc-nd': 'CC BY-NC-ND'
    };
    const name = names[parts[1]];
    if (name && /^\d+(?:\.\d+)+$/.test(parts[2])) return { licenseName: `${name} ${parts[2]}`, licenseUrl, sourceUrl: source.toString() };
  }
  if (parts[0] === 'publicdomain' && parts[1] === 'zero' && parts[2]) {
    return { licenseName: `CC0 ${parts[2]}`, licenseUrl, sourceUrl: source.toString() };
  }
  return null;
}

function normalizeTeamName(value: string): string {
  return normalizeTheSportsDbName(value);
}

export function normalizeTheSportsDbName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isSoccerPlayer(player: TheSportsDbPlayer): boolean {
  // TheSportsDB is a cross-sport catalogue. Current responses expose
  // strSport; keep null/legacy rows usable, but never accept a known
  // non-football sport or a manager/coach record as a football portrait.
  if (player.strSport && normalizeTeamName(player.strSport) !== 'soccer') return false;
  const position = normalizeTeamName(player.strPosition ?? '');
  return !['manager', 'head coach', 'assistant manager', 'coach'].includes(position);
}

function assertAllowedImageUrl(value: string): void {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || !['r2.thesportsdb.com', 'www.thesportsdb.com', 'thesportsdb.com'].includes(parsed.hostname)) {
    throw new Error(`TheSportsDB devuelve una URL de imagen fuera de los dominios permitidos: ${value}`);
  }
}

async function requestJson<T>(url: URL): Promise<T> {
  const response = await request(url);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) throw new Error(`TheSportsDB no devolvió JSON (${response.status})`);
  return (await response.json()) as T;
}

async function requestBytes(url: URL): Promise<Buffer> {
  const response = await request(url);
  if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error(`TheSportsDB no devolvió una imagen (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

async function request(url: URL, accept = 'application/json'): Promise<Response> {
  const minimumInterval = config.theSportsDbMinRequestIntervalMs;
  const waitMs = Math.max(0, minimumInterval - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, waitMs));
  lastRequestAt = Date.now();

  for (let attempt = 0; attempt < config.theSportsDbMaxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: accept, 'User-Agent': config.mediaUserAgent },
      signal: AbortSignal.timeout(config.mediaRequestTimeoutMs)
    });
    if (response.ok) return response;
    if (response.status !== 429 && response.status < 500) throw new Error(`TheSportsDB ${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const retryMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.max(minimumInterval, 2 ** attempt * 1000);
    if (attempt < config.theSportsDbMaxAttempts - 1) await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(retryMs, config.mediaRetryMaxMs)));
  }
  throw new Error('TheSportsDB: demasiados reintentos por rate limit o error temporal');
}
