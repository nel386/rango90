import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://www.statbunker.com/alltimestats/AllTimeCompetitionMostAssists?comp_code=WC';
const countryLinkPattern = /AllTimeLeadingScorers\?comp_code=WC&club_id=(\d+)/gu;
export const statbunkerWorldCupAssistHosts = [
  'https://dr.statbunker.com',
  'https://m.statbunker.com',
  'https://ww.statbunker.com',
  'https://www.statbunker.com'
] as const;
const requestTimeoutMs = 20_000;
const maxAttemptsPerHost = 2;

export type StatbunkerWorldCupAssistEntry = {
  sourceRank: number;
  providerPlayerId: number;
  name: string;
  assists: number;
};

const knownNames: Record<string, string> = {
  'Kylian Mbappe': 'Kylian Mbappé',
  'Ivan Perisic': 'Ivan Perišić',
  'Thomas Muller': 'Thomas Müller',
  'Bastian Schweinsteiger': 'Bastian Schweinsteiger',
  'Luis Suarez': 'Luis Suárez',
  'Dusan Tadic': 'Dušan Tadić',
  'Achraf Hakimi': 'Achraf Hakimi',
  'Toni Kroos': 'Toni Kroos',
  'Mesut Ozil': 'Mesut Özil',
  'Kaka': 'Kaká',
  'Ousmane Dembele': 'Ousmane Dembélé',
  'Martin Odegaard': 'Martin Ødegaard',
  'Bruno Guimaraes': 'Bruno Guimarães',
  'Vinicius Junior': 'Vinícius Júnior',
  'Aleksandr Golovin': 'Aleksandr Golovin'
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

export function parseStatbunkerWorldCupAssists(html: string, minimumEntries = 200): StatbunkerWorldCupAssistEntry[] {
  const rowPattern = /<tr>\s*<td>(\d+)<\/td>\s*<td>[\s\S]*?player_id=(\d+)[^>]*>[\s\S]*?<p>\s*([^<]+?)\s*<\/p>[\s\S]*?<\/tr>/gu;
  const entries: StatbunkerWorldCupAssistEntry[] = [];
  const seen = new Set<number>();
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(html)) !== null) {
    const assists = Number(match[1]);
    const providerPlayerId = Number(match[2]);
    const rawName = decodeHtml(match[3] ?? '');
    if (!Number.isInteger(assists) || assists < 1 || !Number.isInteger(providerPlayerId) || providerPlayerId < 1 || !rawName || seen.has(providerPlayerId)) continue;
    seen.add(providerPlayerId);
    entries.push({ sourceRank: entries.length + 1, providerPlayerId, name: knownNames[rawName] ?? rawName, assists });
  }
  if (entries.length < minimumEntries) throw new Error(`StatBunker World Cup assists: cobertura insuficiente (${entries.length} filas)`);
  if (entries.some((entry, index) => index > 0 && entry.assists > entries[index - 1]!.assists)) {
    throw new Error('StatBunker World Cup assists: tabla fuera de orden descendente');
  }
  return entries;
}

async function fetchStatbunkerHtml(url = sourceUrl): Promise<string> {
  let lastError: unknown;
  for (const host of statbunkerWorldCupAssistHosts) {
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
  throw new Error(`StatBunker World Cup assists: no se pudo descargar ${url} tras ${statbunkerWorldCupAssistHosts.length * maxAttemptsPerHost} intentos en ${statbunkerWorldCupAssistHosts.length} hosts (${String(lastError)})`);
}

export function parseStatbunkerWorldCupCountryIds(html: string): string[] {
  return [...new Set([...html.matchAll(countryLinkPattern)].map((match) => match[1]).filter((id): id is string => Boolean(id)))];
}

async function fetchTopTwoHundredFromCountryPages(rootHtml: string): Promise<StatbunkerWorldCupAssistEntry[]> {
  const rootRows = parseStatbunkerWorldCupAssists(rootHtml, 0);
  if (rootRows.length >= 200) {
    return rootRows.slice(0, 200).map((row, index) => ({ ...row, sourceRank: index + 1 }));
  }

  const countryIds = parseStatbunkerWorldCupCountryIds(rootHtml);
  if (countryIds.length === 0) throw new Error('StatBunker World Cup assists: no se encontraron páginas de selecciones');

  const byProviderId = new Map<number, StatbunkerWorldCupAssistEntry>();
  for (let offset = 0; offset < countryIds.length; offset += 8) {
    const batch = countryIds.slice(offset, offset + 8);
    const pages = await Promise.all(batch.map(async (countryId) => {
      const countryUrl = `${sourceUrl}&club_id=${countryId}`;
      // Some national teams have no recorded World Cup assists. Their valid
      // StatBunker page contains the table shell but no player rows, so keep
      // them as an empty contribution instead of treating that as a download
      // failure. A completely empty aggregate is still rejected below.
      const rows = parseStatbunkerWorldCupAssists(await fetchStatbunkerHtml(countryUrl), 0);
      return { countryUrl, rows };
    }));
    for (const page of pages) {
      for (const row of page.rows) {
        const current = byProviderId.get(row.providerPlayerId);
        if (!current || row.assists > current.assists) byProviderId.set(row.providerPlayerId, row);
      }
    }
  }

  const rows = [...byProviderId.values()]
    .sort((left, right) => right.assists - left.assists || left.name.localeCompare(right.name, 'es'))
    .slice(0, 200)
    .map((row, index) => ({ ...row, sourceRank: index + 1 }));
  if (rows.length < 200) throw new Error(`StatBunker World Cup assists: agregación insuficiente para el top 200 (${rows.length} jugadores)`);
  return rows;
}

export async function fetchStatbunkerWorldCupAssists(): Promise<RankingInput> {
  const rootHtml = await fetchStatbunkerHtml();
  const rows = await fetchTopTwoHundredFromCountryPages(rootHtml);
  return {
    categorySlug: 'world-cup-assists',
    source: {
      key: 'statbunker-world-cup',
      name: 'StatBunker World Cup all-time assists',
      sourceType: 'reference',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `statbunker-world-cup-assists-top-200-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: false,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `statbunker:world-cup:player:${row.providerPlayerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.assists,
      evidence: {
        sourceRank: row.sourceRank,
        providerPlayerId: row.providerPlayerId,
        sourceUrl,
        scope: 'FIFA World Cup masculino; fases finales; top 200 agregado desde las páginas históricas de selecciones de StatBunker; pendiente de validación metodológica cruzada y de revisión de derechos'
      }
    }))
  };
}
