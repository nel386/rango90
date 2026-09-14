import type { RankingInput } from '../imports/rankingInput.js';
import { parseStatbunkerWorldCupCountryIds } from './statbunkerWorldCupClient.js';

const countryIndexUrl = 'https://www.statbunker.com/alltimestats/AllTimeCompetitionMostAssists?comp_code=WC';
// `betl` is currently the responsive StatBunker mirror for the all-time
// cards tables; keep the canonical host and existing mirrors as fallbacks.
const statBunkerHosts = ['https://betl.statbunker.com', 'https://dr.statbunker.com', 'https://m.statbunker.com', 'https://ww.statbunker.com', 'https://www.statbunker.com'] as const;
const requestTimeoutMs = 20_000;
const maxAttemptsPerHost = 2;
const metricConfig = {
  yellow_cards: {
    slug: 'world-cup-yellow_cards',
    sourceUrl: 'https://www.statbunker.com/alltimestats/AllTimeYellowCards?comp_code=WC',
    label: 'yellow cards',
    column: 'yellow cards'
  },
  red_cards: {
    slug: 'world-cup-red_cards',
    sourceUrl: 'https://www.statbunker.com/alltimestats/AllTimeRedCards?comp_code=WC',
    label: 'red cards',
    column: 'sent off'
  }
} as const;

export type StatbunkerWorldCupCardMetric = keyof typeof metricConfig;

export type StatbunkerWorldCupCardEntry = {
  sourceRank: number;
  providerPlayerId: number;
  name: string;
  cards: number;
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

export function parseStatbunkerWorldCupCards(html: string, minimumEntries = 50): StatbunkerWorldCupCardEntry[] {
  const rowPattern = /<tr>\s*<td class="tdInline mob">\s*<a[^>]*player_id=(\d+)[^>]*>\s*<p>\s*([^<]+?)\s*<\/p>\s*<\/a>\s*<\/td>\s*<td class="mob">\s*(\d+)\s*<\/td>/gu;
  const entries: StatbunkerWorldCupCardEntry[] = [];
  const seen = new Set<number>();
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(html)) !== null) {
    const providerPlayerId = Number(match[1]);
    const cards = Number(match[3]);
    const name = decodeHtml(match[2] ?? '');
    if (!Number.isInteger(providerPlayerId) || providerPlayerId < 1 || !Number.isInteger(cards) || cards < 1 || !name || seen.has(providerPlayerId)) continue;
    seen.add(providerPlayerId);
    entries.push({ sourceRank: entries.length + 1, providerPlayerId, name, cards });
  }
  if (entries.length < minimumEntries) throw new Error(`StatBunker World Cup cards: cobertura insuficiente (${entries.length} filas)`);
  if (entries.some((entry, index) => index > 0 && entry.cards > entries[index - 1]!.cards)) {
    throw new Error('StatBunker World Cup cards: tabla fuera de orden descendente');
  }
  return entries;
}

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown;
  // StatBunker occasionally stalls on its canonical host. Use the same
  // mirrors as the clean-sheets importer, with a bounded timeout and one
  // controlled retry per host. A successful HTTP response is still required
  // to contain a non-empty body; parsing/coverage validation remains the
  // responsibility of the caller and is never weakened by the fallback.
  for (const host of statBunkerHosts) {
    const hostUrl = url.replace('https://www.statbunker.com', host);
    for (let attempt = 0; attempt < maxAttemptsPerHost; attempt += 1) {
      try {
        const response = await fetch(hostUrl, {
          headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
          signal: AbortSignal.timeout(requestTimeoutMs)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.text();
        if (!body.trim()) throw new Error('respuesta vacía');
        return body;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttemptsPerHost - 1) {
          await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
        }
      }
    }
  }
  throw new Error(`StatBunker World Cup cards: no se pudo descargar ${url} tras ${statBunkerHosts.length * maxAttemptsPerHost} intentos en ${statBunkerHosts.length} hosts (${String(lastError)})`);
}

async function fetchTopTwoHundred(metric: StatbunkerWorldCupCardMetric): Promise<StatbunkerWorldCupCardEntry[]> {
  const config = metricConfig[metric];
  // The all-time table already exposes the ordered player rows on the
  // responsive mirror. Prefer it: it is both faster and less fragile than
  // opening every national-team page. Keep the country aggregation as a
  // validated fallback for mirrors that only expose the index table.
  const rootRows = parseStatbunkerWorldCupCards(await fetchHtml(config.sourceUrl), 0);
  if (rootRows.length >= 200) {
    return rootRows.slice(0, 200).map((row, index) => ({ ...row, sourceRank: index + 1 }));
  }

  const countryIds = parseStatbunkerWorldCupCountryIds(await fetchHtml(countryIndexUrl));
  if (countryIds.length === 0) throw new Error('StatBunker World Cup cards: no se encontraron páginas de selecciones');

  const byProviderId = new Map<number, StatbunkerWorldCupCardEntry>();
  for (let offset = 0; offset < countryIds.length; offset += 4) {
    const batch = countryIds.slice(offset, offset + 4);
    const pages = await Promise.all(batch.map(async (countryId) => {
      const rows = parseStatbunkerWorldCupCards(await fetchHtml(`${config.sourceUrl}&club_id=${countryId}`), 0);
      return rows;
    }));
    for (const rows of pages) {
      for (const row of rows) {
        const current = byProviderId.get(row.providerPlayerId);
        if (!current || row.cards > current.cards) byProviderId.set(row.providerPlayerId, row);
      }
    }
  }

  const rows = [...byProviderId.values()]
    .sort((left, right) => right.cards - left.cards || left.name.localeCompare(right.name, 'es'))
    .slice(0, 200)
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
  if (rows.length < 200) throw new Error(`StatBunker World Cup cards: agregación insuficiente para el top 200 (${rows.length} jugadores)`);
  return rows;
}

export async function fetchStatbunkerWorldCupCards(metric: StatbunkerWorldCupCardMetric): Promise<RankingInput> {
  const config = metricConfig[metric];
  const rows = await fetchTopTwoHundred(metric);
  return {
    categorySlug: config.slug,
    source: {
      key: 'statbunker-world-cup-cards',
      name: `StatBunker World Cup all-time ${config.label}`,
      sourceType: 'reference',
      baseUrl: config.sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `statbunker-world-cup-${metric}-top-200-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: false,
    allowPartialDraft: true,
    partialDraftReason: 'StatBunker es una fuente de referencia: el top 200 está agregado por ID de jugador, pero la definición histórica y los derechos de redistribución requieren revisión independiente.',
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `statbunker:world-cup:player:${row.providerPlayerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.cards,
      evidence: {
        sourceRank: row.sourceRank,
        providerPlayerId: row.providerPlayerId,
        sourceUrl: config.sourceUrl,
        scope: `FIFA World Cup masculino; fases finales; top 200 agregado desde las páginas históricas de selecciones de StatBunker; métrica ${config.column}; pendiente de validación metodológica cruzada y de revisión de derechos`
      }
    }))
  };
}
