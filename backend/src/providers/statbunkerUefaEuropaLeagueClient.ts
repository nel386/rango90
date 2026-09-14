import type { RankingInput } from '../imports/rankingInput.js';

const sourceRoot = 'https://www.statbunker.com/alltimestats';
const statbunkerHosts = [
  'https://betl.statbunker.com',
  'https://dr.statbunker.com',
  'https://m.statbunker.com',
  'https://ww.statbunker.com',
  'https://www.statbunker.com'
] as const;
const competitionConfig = {
  champions_league: {
    code: 'UCL',
    prefix: 'uefa-champions-league',
    label: 'UEFA Champions League',
    sourceKey: 'statbunker-uefa-champions-league'
  },
  europa: {
    code: 'UCUP',
    prefix: 'uefa-cup-europa-league',
    label: 'UEFA Cup / Europa League',
    sourceKey: 'statbunker-uefa-europa-league'
  },
  euro: {
    // StatBunker uses EC for the English Championship; ECC is the UEFA
    // European Championship. Keeping this explicit prevents importing a
    // completely different competition under the Euro slug.
    code: 'ECC',
    prefix: 'euro',
    label: 'UEFA European Championship',
    sourceKey: 'statbunker-euro'
  },
  world_cup: {
    code: 'WC',
    prefix: 'world-cup',
    label: 'FIFA World Cup',
    sourceKey: 'statbunker-world-cup'
  }
} as const;

const metricConfig = {
  goals: {
    path: 'AllTimeLeadingScorers',
    label: 'goals',
    column: 'Goals'
  },
  assists: {
    path: 'AllTimeCompetitionMostAssists',
    label: 'assists',
    column: 'Assists'
  },
  yellow_cards: {
    path: 'AllTimeYellowCards',
    label: 'yellow cards',
    column: 'Yellow cards'
  },
  red_cards: {
    path: 'AllTimeRedCards',
    label: 'red cards',
    column: 'Sent off'
  }
} as const;

export type StatbunkerUefaEuropaMetric = keyof typeof metricConfig;
export type StatbunkerUefaEuropaCompetition = keyof typeof competitionConfig;

export type StatbunkerUefaEuropaEntry = {
  sourceRank: number;
  providerPlayerId: number;
  name: string;
  value: number;
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkup(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parsePositiveInteger(value: string | undefined): number | null {
  const normalized = value?.replace(/,/g, '.').trim() ?? '';
  if (!/^\d+$/u.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Parse the player rows from one StatBunker all-time table. */
export function parseStatbunkerUefaEuropaRows(
  html: string,
  metric: StatbunkerUefaEuropaMetric,
  minimumEntries = 0
): StatbunkerUefaEuropaEntry[] {
  const rows: StatbunkerUefaEuropaEntry[] = [];
  const seen = new Set<number>();
  for (const rowMatch of html.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gu)) {
    const row = rowMatch[1] ?? '';
    const playerMatch = /player_id=(\d+)[^>]*>[\s\S]*?<p>\s*([^<]+?)\s*<\/p>/u.exec(row);
    if (!playerMatch) continue;
    const cells = [...row.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/gu)].map((match) => stripMarkup(match[1] ?? ''));
    const value = parsePositiveInteger(cells[metric === 'assists' ? 0 : 1]);
    const providerPlayerId = Number(playerMatch[1]);
    const name = decodeHtml(playerMatch[2] ?? '').trim();
    if (!value || !Number.isInteger(providerPlayerId) || providerPlayerId < 1 || !name || seen.has(providerPlayerId)) continue;
    seen.add(providerPlayerId);
    rows.push({ sourceRank: rows.length + 1, providerPlayerId, name, value });
  }
  if (rows.length < minimumEntries) {
    throw new Error(`StatBunker UEFA Europa ${metric}: cobertura insuficiente (${rows.length} filas)`);
  }
  return rows;
}

export function parseStatbunkerUefaEuropaClubIds(html: string, code: string = competitionConfig.europa.code): string[] {
  const pattern = new RegExp(`AllTimeLeadingScorers\\?comp_code=${code}&club_id=(\\d+)`, 'gu');
  return [...new Set([...html.matchAll(pattern)].map((match) => match[1]).filter((id): id is string => Boolean(id)))];
}

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown;
  for (const host of statbunkerHosts) {
    const hostUrl = url.replace('https://www.statbunker.com', host);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(hostUrl, {
          headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
          signal: AbortSignal.timeout(20_000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.text();
        if (!body.trim()) throw new Error('respuesta vacía');
        return body;
      } catch (error) {
        lastError = error;
        if (attempt < 1) await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    }
  }
  throw new Error(`StatBunker UEFA Europa: no se pudo descargar ${url} tras ${statbunkerHosts.length * 2} intentos (${String(lastError)})`);
}

async function fetchTopTwoHundred(competition: StatbunkerUefaEuropaCompetition, metric: StatbunkerUefaEuropaMetric): Promise<{ rows: StatbunkerUefaEuropaEntry[]; coverageComplete: boolean }> {
  const competitionDetails = competitionConfig[competition];
  const config = metricConfig[metric];
  const rootUrl = `${sourceRoot}/${config.path}?comp_code=${competitionDetails.code}`;
  const rootHtml = await fetchHtml(rootUrl);
  const rootRows = parseStatbunkerUefaEuropaRows(rootHtml, metric);
  // The all-time table is already a global ordered ranking for the metric.
  // Prefer it whenever it supplies the requested top 200; the per-country
  // fallback below is only needed for metrics whose public table is shorter.
  if (rootRows.length >= 200) return { rows: rootRows.slice(0, 200), coverageComplete: true };
  const clubIds = parseStatbunkerUefaEuropaClubIds(rootHtml, competitionDetails.code);
  if (clubIds.length === 0) throw new Error(`StatBunker ${competitionDetails.label}: no se encontraron páginas históricas de clubes/selecciones`);

  const totals = new Map<number, StatbunkerUefaEuropaEntry>();
  // StatBunker rate-limits aggressively. Keep one import reasonably quick,
  // but avoid launching eight requests per batch (or several imports at once)
  // and turning a valid source into a stream of 429 responses.
  // Six parallel pages keeps the import practical for the 170+ historical
  // club pages while remaining below the provider's observed rate-limit
  // threshold. A rejected/empty page still aborts the import before any
  // ranking snapshot is written.
  const batchSize = 4;
  for (let offset = 0; offset < clubIds.length; offset += batchSize) {
    const pages = await Promise.all(clubIds.slice(offset, offset + batchSize).map(async (clubId) => {
      const html = await fetchHtml(`${rootUrl}&club_id=${clubId}`);
      return parseStatbunkerUefaEuropaRows(html, metric);
    }));
    for (const rows of pages) {
      for (const row of rows) {
        const current = totals.get(row.providerPlayerId);
        if (current) current.value += row.value;
        else totals.set(row.providerPlayerId, { ...row });
      }
    }
  }

  const rows = [...totals.values()]
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'es'))
    .slice(0, 200)
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
  if (rows.length < 200) throw new Error(`StatBunker ${competitionDetails.label} ${metric}: agregación insuficiente para el top 200 (${rows.length} jugadores)`);
  return { rows, coverageComplete: false };
}

export async function fetchStatbunkerCompetitionRanking(competition: StatbunkerUefaEuropaCompetition, metric: StatbunkerUefaEuropaMetric): Promise<RankingInput> {
  const competitionDetails = competitionConfig[competition];
  const config = metricConfig[metric];
  const rootUrl = `${sourceRoot}/${config.path}?comp_code=${competitionDetails.code}`;
  const result = await fetchTopTwoHundred(competition, metric);
  const rows = result.rows;
  return {
    categorySlug: `${competitionDetails.prefix}-${metric}`,
    source: {
      key: competitionDetails.sourceKey,
      name: `StatBunker ${competitionDetails.label} all-time ${config.label}`,
      sourceType: 'reference',
      baseUrl: rootUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `statbunker-${competition}-${metric}-top-200-${new Date().toISOString().slice(0, 10)}`,
    // The provider is aggregated by club pages and still needs a cross-check
    // against UEFA's historical definition before it can be published.
    coverageComplete: result.coverageComplete,
    ...(result.coverageComplete ? {} : {
      allowPartialDraft: true,
      partialDraftReason: `Agregación por páginas históricas de clubes/selecciones de StatBunker; requiere validación cruzada del alcance de ${competitionDetails.label} y revisión independiente de derechos.`
    }),
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `statbunker:${competition}:player:${row.providerPlayerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.value,
      evidence: {
        sourceRank: row.sourceRank,
        providerPlayerId: row.providerPlayerId,
        sourceUrl: rootUrl,
        scope: `${competitionDetails.label}; tabla global del proveedor o agregado por páginas históricas cuando la tabla global no alcanza 200; métrica ${config.column}; pendiente de validación cruzada`
      }
    }))
  };
}

export function fetchStatbunkerUefaEuropaLeagueRanking(metric: StatbunkerUefaEuropaMetric): Promise<RankingInput> {
  return fetchStatbunkerCompetitionRanking('europa', metric);
}

export function fetchStatbunkerEuroRanking(metric: StatbunkerUefaEuropaMetric): Promise<RankingInput> {
  return fetchStatbunkerCompetitionRanking('euro', metric);
}

// The UEFA Europa Conference League began in 2021/22. These are the five
// completed editions represented by StatBunker through 2025/26. Keep the
// season set explicit: a future refresh must add a new edition deliberately,
// rather than silently changing the historical scope.
const conferenceSeasonIds = [706, 738, 359, 771, 786] as const;
const conferenceHistoricalScope = 'UEFA Europa Conference League; all completed editions 2021/22–2025/26';
const euroSeasonIds = [169, 228, 391, 550, 685, 291] as const;

export async function fetchStatbunkerEuroYellowCards(): Promise<RankingInput> {
  const totals = new Map<number, StatbunkerUefaEuropaEntry>();
  for (const seasonId of euroSeasonIds) {
    const url = `https://www.statbunker.com/competitions/TopYellowCards?comp_id=${seasonId}`;
    const html = await fetchHtml(url);
    for (const row of parseStatbunkerConferenceYellowCards(html)) {
      const current = totals.get(row.providerPlayerId);
      if (current) current.value += row.value;
      else totals.set(row.providerPlayerId, { ...row });
    }
  }
  const rows = [...totals.values()]
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'es'))
    .slice(0, 200)
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
  if (rows.length < 200) throw new Error(`StatBunker EURO amarillas: agregación insuficiente para el top 200 (${rows.length} jugadores)`);
  return {
    categorySlug: 'euro-yellow_cards',
    source: {
      key: 'statbunker-euro',
      name: 'StatBunker UEFA European Championship historical yellow cards',
      sourceType: 'reference',
      baseUrl: 'https://www.statbunker.com/competitions/TopYellowCards',
      rightsStatus: 'review_required'
    },
    dataVersion: `statbunker-euro-yellow-cards-top-200-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: false,
    allowPartialDraft: true,
    partialDraftReason: 'Agregación por ediciones EURO disponibles (2004–2024); requiere validar alcance histórico, definición de tarjeta y derechos antes de publicar.',
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `statbunker:euro:player:${row.providerPlayerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.value,
      evidence: {
        sourceRank: row.sourceRank,
        providerPlayerId: row.providerPlayerId,
        seasonIds: euroSeasonIds,
        sourceUrl: 'https://www.statbunker.com/competitions/TopYellowCards',
        scope: 'UEFA European Championship; amarillas agregadas por ediciones disponibles; pendiente de validar alcance histórico completo y derechos'
      }
    }))
  };
}

export function parseStatbunkerConferenceClubIds(html: string, seasonId: number): string[] {
  const pattern = new RegExp(`MostAssists\\?comp_id=${seasonId}&club_id=(\\d+)`, 'gu');
  return [...new Set([...html.matchAll(pattern)].map((match) => match[1]).filter((id): id is string => Boolean(id)))];
}

export function parseStatbunkerConferenceAssistsClubPage(html: string, minimumEntries = 0): StatbunkerUefaEuropaEntry[] {
  const rows: StatbunkerUefaEuropaEntry[] = [];
  const seen = new Set<number>();
  for (const rowMatch of html.matchAll(/<tr(?![^>]*class=["']hide["'])[^>]*>([\s\S]*?)<\/tr>/gu)) {
    const row = rowMatch[1] ?? '';
    const playerMatch = /player_id=(\d+)[^>]*>[\s\S]*?<p>\s*([^<]+?)\s*<\/p>/u.exec(row);
    if (!playerMatch) continue;
    const cells = [...row.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/gu)].map((match) => stripMarkup(match[1] ?? ''));
    const value = parsePositiveInteger(cells[0]);
    const providerPlayerId = Number(playerMatch[1]);
    const name = decodeHtml(playerMatch[2] ?? '').trim();
    if (!value || !Number.isInteger(providerPlayerId) || providerPlayerId < 1 || !name || seen.has(providerPlayerId)) continue;
    seen.add(providerPlayerId);
    rows.push({ sourceRank: rows.length + 1, providerPlayerId, name, value });
  }
  if (rows.length < minimumEntries) throw new Error(`StatBunker Conference asistencias: cobertura insuficiente (${rows.length} filas)`);
  return rows;
}

export async function fetchStatbunkerConferenceAssists(): Promise<RankingInput> {
  const totals = new Map<number, StatbunkerUefaEuropaEntry>();
  for (const seasonId of conferenceSeasonIds) {
    const rootUrl = `https://www.statbunker.com/competitions/MostAssists?comp_id=${seasonId}`;
    const rootHtml = await fetchHtml(rootUrl);
    const clubIds = parseStatbunkerConferenceClubIds(rootHtml, seasonId);
    for (let index = 0; index < clubIds.length; index += 5) {
      const batch = await Promise.all(clubIds.slice(index, index + 5).map(async (clubId) => {
        const html = await fetchHtml(`${rootUrl}&club_id=${clubId}`);
        return parseStatbunkerConferenceAssistsClubPage(html);
      }));
      for (const rows of batch) {
        for (const row of rows) {
          const current = totals.get(row.providerPlayerId);
          if (current) current.value += row.value;
          else totals.set(row.providerPlayerId, { ...row });
        }
      }
    }
  }
  const rows = [...totals.values()]
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'es'))
    .slice(0, 200)
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
  if (rows.length < 200) throw new Error(`StatBunker UEFA Conference asistencias: agregación insuficiente para el top 200 (${rows.length} jugadores)`);
  return {
    categorySlug: 'uefa-conference-league-assists',
    source: {
      key: 'statbunker-uefa-conference-league',
      name: 'StatBunker UEFA Europa Conference League historical assists',
      sourceType: 'reference',
      baseUrl: 'https://www.statbunker.com/competitions/MostAssists',
      rightsStatus: 'review_required'
    },
    dataVersion: `statbunker-uefa-conference-assists-top-200-${new Date().toISOString().slice(0, 10)}`,
    // The competition has a finite five-season history in this snapshot and
    // all five season pages are fetched before the ranking is built. Rights
    // remain independently blocked by the source's review_required status.
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `statbunker:uefa-conference:player:${row.providerPlayerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.value,
      evidence: {
        sourceRank: row.sourceRank,
        providerPlayerId: row.providerPlayerId,
        seasonIds: conferenceSeasonIds,
        sourceUrl: 'https://www.statbunker.com/competitions/MostAssists',
        scope: `${conferenceHistoricalScope}; asistencias agregadas por páginas de club; definición de asistencia del proveedor; derechos pendientes de revisión`
      }
    }))
  };
}

export function parseStatbunkerConferenceGoals(html: string, minimumEntries = 0): StatbunkerUefaEuropaEntry[] {
  const rows: StatbunkerUefaEuropaEntry[] = [];
  const seen = new Set<number>();
  for (const rowMatch of html.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gu)) {
    const row = rowMatch[1] ?? '';
    const playerMatch = /player_id=(\d+)[^>]*>[\s\S]*?<p>\s*([^<]+?)\s*<\/p>/u.exec(row);
    if (!playerMatch) continue;
    const cells = [...row.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/gu)].map((match) => stripMarkup(match[1] ?? ''));
    const value = parsePositiveInteger(cells[2]);
    const providerPlayerId = Number(playerMatch[1]);
    const name = decodeHtml(playerMatch[2] ?? '').trim();
    if (!value || !Number.isInteger(providerPlayerId) || providerPlayerId < 1 || !name || seen.has(providerPlayerId)) continue;
    seen.add(providerPlayerId);
    rows.push({ sourceRank: rows.length + 1, providerPlayerId, name, value });
  }
  if (rows.length < minimumEntries) throw new Error(`StatBunker Conference goles: cobertura insuficiente (${rows.length} filas)`);
  return rows;
}

export async function fetchStatbunkerConferenceGoals(): Promise<RankingInput> {
  const totals = new Map<number, StatbunkerUefaEuropaEntry>();
  for (const seasonId of conferenceSeasonIds) {
    const url = `https://www.statbunker.com/competitions/TopGoalScorers?comp_id=${seasonId}`;
    const html = await fetchHtml(url);
    for (const row of parseStatbunkerConferenceGoals(html)) {
      const current = totals.get(row.providerPlayerId);
      if (current) current.value += row.value;
      else totals.set(row.providerPlayerId, { ...row });
    }
  }
  const rows = [...totals.values()]
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'es'))
    .slice(0, 200)
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
  if (rows.length < 200) throw new Error(`StatBunker UEFA Conference goles: agregación insuficiente para el top 200 (${rows.length} jugadores)`);
  return {
    categorySlug: 'uefa-conference-league-goals',
    source: {
      key: 'statbunker-uefa-conference-league',
      name: 'StatBunker UEFA Europa Conference League historical goals',
      sourceType: 'reference',
      baseUrl: 'https://www.statbunker.com/competitions/TopGoalScorers',
      rightsStatus: 'review_required'
    },
    dataVersion: `statbunker-uefa-conference-goals-top-200-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `statbunker:uefa-conference:player:${row.providerPlayerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.value,
      evidence: {
        sourceRank: row.sourceRank,
        providerPlayerId: row.providerPlayerId,
        seasonIds: conferenceSeasonIds,
        sourceUrl: 'https://www.statbunker.com/competitions/TopGoalScorers',
        scope: `${conferenceHistoricalScope}; goles agregados por las cinco ediciones; derechos pendientes de revisión`
      }
    }))
  };
}

export function parseStatbunkerConferenceYellowCards(html: string, minimumEntries = 0): StatbunkerUefaEuropaEntry[] {
  const rows: StatbunkerUefaEuropaEntry[] = [];
  const seen = new Set<number>();
  for (const rowMatch of html.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gu)) {
    const row = rowMatch[1] ?? '';
    const playerMatch = /player_id=(\d+)[^>]*>[\s\S]*?<p>\s*([^<]+?)\s*<\/p>/u.exec(row);
    if (!playerMatch) continue;
    const cells = [...row.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/gu)].map((match) => stripMarkup(match[1] ?? ''));
    const value = parsePositiveInteger(cells[2]);
    const providerPlayerId = Number(playerMatch[1]);
    const name = decodeHtml(playerMatch[2] ?? '').trim();
    if (!value || !Number.isInteger(providerPlayerId) || providerPlayerId < 1 || !name || seen.has(providerPlayerId)) continue;
    seen.add(providerPlayerId);
    rows.push({ sourceRank: rows.length + 1, providerPlayerId, name, value });
  }
  if (rows.length < minimumEntries) throw new Error(`StatBunker Conference amarillas: cobertura insuficiente (${rows.length} filas)`);
  return rows;
}

export async function fetchStatbunkerConferenceYellowCards(): Promise<RankingInput> {
  const totals = new Map<number, StatbunkerUefaEuropaEntry>();
  for (const seasonId of conferenceSeasonIds) {
    const url = `https://www.statbunker.com/competitions/TopYellowCards?comp_id=${seasonId}`;
    const html = await fetchHtml(url);
    for (const row of parseStatbunkerConferenceYellowCards(html)) {
      const current = totals.get(row.providerPlayerId);
      if (current) current.value += row.value;
      else totals.set(row.providerPlayerId, { ...row });
    }
  }
  const rows = [...totals.values()]
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'es'))
    .slice(0, 200)
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
  if (rows.length < 200) throw new Error(`StatBunker UEFA Conference amarillas: agregación insuficiente para el top 200 (${rows.length} jugadores)`);
  return {
    categorySlug: 'uefa-conference-league-yellow_cards',
    source: {
      key: 'statbunker-uefa-conference-league',
      name: 'StatBunker UEFA Europa Conference League historical yellow cards',
      sourceType: 'reference',
      baseUrl: 'https://www.statbunker.com/competitions/TopYellowCards',
      rightsStatus: 'review_required'
    },
    dataVersion: `statbunker-uefa-conference-yellow-cards-top-200-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `statbunker:uefa-conference:player:${row.providerPlayerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.value,
      evidence: {
        sourceRank: row.sourceRank,
        providerPlayerId: row.providerPlayerId,
        seasonIds: conferenceSeasonIds,
        sourceUrl: 'https://www.statbunker.com/competitions/TopYellowCards',
        scope: `${conferenceHistoricalScope}; amarillas agregadas por las cinco ediciones; derechos pendientes de revisión`
      }
    }))
  };
}
