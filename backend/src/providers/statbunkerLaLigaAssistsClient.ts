import type { RankingInput } from '../imports/rankingInput.js';

/**
 * StatBunker publishes this table ordered by total appearances, not by
 * assists. We deliberately parse the explicit `A` column and derive the
 * requested ranking from the same homogeneous player table. No zero-valued
 * or synthetic players are added.
 */
export const statbunkerLaLigaAssistsSourceUrl =
  'https://www.statbunker.com/alltimestats/AllTimePlayerStandings?comp_code=LL';
export const statbunkerLaLigaAssistsCategorySlug = 'la-liga-assists';
export const statbunkerLaLigaAssistsTargetSize = 200;
export const statbunkerLaLigaAssistsHosts = [
  'https://www.statbunker.com',
  'https://m.statbunker.com',
  'https://betl.statbunker.com',
  'https://bbs.statbunker.com',
  'https://dr.statbunker.com'
] as const;

export const statbunkerLaLigaAssistsScope =
  'LaLiga masculina; tabla histórica All time Players Record de StatBunker; columna A (assists); top 200 jugadores con asistencias positivas derivado ordenando los valores observados.';

export type StatbunkerLaLigaAssistEntry = {
  sourceRank: number;
  sourceTableRank: number;
  providerPlayerId: number;
  name: string;
  position: string;
  appearances: number;
  goals: number;
  assists: number;
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };
  return value
    .replace(/&#x([0-9a-f]+);/giu, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/giu, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/\s+/gu, ' ')
    .trim();
}

function stripMarkup(value: string): string {
  return decodeHtml(value.replace(/<br\s*\/?>/giu, ' ').replace(/<[^>]+>/gu, ' '))
    .replace(/\s+/gu, ' ')
    .trim();
}

function parseInteger(value: string | undefined): number | null {
  const normalized = value?.replace(/[.,\s]/gu, '').trim() ?? '';
  if (normalized === '-') return 0;
  if (!/^\d+$/u.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function playerName(row: string): string | null {
  const paragraph = /<p\b[^>]*>([\s\S]*?)<\/p>/iu.exec(row)?.[1];
  if (paragraph) return stripMarkup(paragraph);
  const anchor = /<a\b[^>]*>([\s\S]*?)<\/a>/iu.exec(row)?.[1];
  return anchor ? stripMarkup(anchor) : null;
}

/**
 * Parse and rank the explicit assist values from StatBunker's all-time
 * player-record table. `minimumEntries` is injectable only for unit fixtures;
 * production uses the default top-200 requirement.
 */
export function parseStatbunkerLaLigaAssists(
  html: string,
  minimumEntries = statbunkerLaLigaAssistsTargetSize
): StatbunkerLaLigaAssistEntry[] {
  const parsed: StatbunkerLaLigaAssistEntry[] = [];
  const seen = new Set<number>();

  for (const rowMatch of html.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/giu)) {
    const row = rowMatch[1] ?? '';
    const providerPlayerId = Number(/(?:[?&]|&amp;)player_id=(\d+)/iu.exec(row)?.[1] ?? '');
    const name = playerName(row);
    const cells = [...row.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/giu)]
      .map((match) => stripMarkup(match[1] ?? ''));
    if (!Number.isSafeInteger(providerPlayerId) || providerPlayerId < 1 || !name || cells.length < 5) continue;

    const appearances = parseInteger(cells[2]);
    const goals = parseInteger(cells[3]);
    const assists = parseInteger(cells[4]);
    if (appearances === null || goals === null || assists === null) continue;
    if (seen.has(providerPlayerId)) {
      throw new Error(`StatBunker LaLiga assists: jugador duplicado ${providerPlayerId}`);
    }
    seen.add(providerPlayerId);
    parsed.push({
      sourceRank: 0,
      sourceTableRank: parsed.length + 1,
      providerPlayerId,
      name,
      position: cells[1] ?? '',
      appearances,
      goals,
      assists
    });
  }

  const ranked = parsed
    .filter((entry) => entry.assists > 0)
    .sort((left, right) => right.assists - left.assists || left.sourceTableRank - right.sourceTableRank)
    .map((entry, index) => ({ ...entry, sourceRank: index + 1 }));

  if (ranked.length < minimumEntries) {
    throw new Error(`StatBunker LaLiga assists: cobertura insuficiente (${ranked.length}/${minimumEntries} filas positivas)`);
  }
  return ranked;
}

export type StatbunkerLaLigaAssistsFetchOptions = {
  fetchImpl?: typeof fetch;
  minimumEntries?: number;
};

async function fetchHtml(fetchImpl: typeof fetch): Promise<string> {
  let lastError: unknown;
  for (const host of statbunkerLaLigaAssistsHosts) {
    const url = statbunkerLaLigaAssistsSourceUrl.replace('https://www.statbunker.com', host);
    try {
      const response = await fetchImpl(url, {
        headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
        signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      if (!body.trim()) throw new Error('respuesta vacía');
      return body;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`StatBunker LaLiga assists: no se pudo descargar la fuente (${String(lastError)})`);
}

export function buildStatbunkerLaLigaAssistsRanking(
  rows: StatbunkerLaLigaAssistEntry[],
  minimumEntries = statbunkerLaLigaAssistsTargetSize
): RankingInput {
  if (rows.length < minimumEntries) {
    throw new Error(`StatBunker LaLiga assists: cobertura insuficiente (${rows.length}/${minimumEntries} filas positivas)`);
  }
  const selected = rows.slice(0, statbunkerLaLigaAssistsTargetSize);
  return {
    categorySlug: statbunkerLaLigaAssistsCategorySlug,
    source: {
      key: 'statbunker-la-liga-assists',
      name: 'StatBunker LaLiga all-time player records — assists',
      sourceType: 'reference',
      baseUrl: statbunkerLaLigaAssistsSourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `statbunker-la-liga-assists-top-${statbunkerLaLigaAssistsTargetSize}-${new Date().toISOString().slice(0, 10)}`,
    // The table supplies 200 real positive rows, but StatBunker does not
    // publish a sufficiently precise historical start date or redistribution
    // licence for us to claim complete historical/product coverage yet.
    coverageComplete: false,
    allowPartialDraft: true,
    partialDraftReason:
      'La tabla pública aporta 200 filas reales y homogéneas, pero el alcance temporal del registro histórico de asistencias y los derechos de redistribución de StatBunker requieren validación antes de declarar cobertura completa o publicar.',
    reviewed: false,
    entries: selected.map((row) => ({
      entityId: `statbunker:la-liga:player:${row.providerPlayerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.assists,
      evidence: {
        sourceRank: row.sourceRank,
        sourceTableRank: row.sourceTableRank,
        providerPlayerId: row.providerPlayerId,
        position: row.position,
        appearances: row.appearances,
        goals: row.goals,
        assistsColumn: 'A',
        assistDefinition: 'statbunker_explicit_a_column',
        sourceUrl: statbunkerLaLigaAssistsSourceUrl,
        scope: statbunkerLaLigaAssistsScope,
        rightsNote: 'StatBunker/Gumpo copyright; no public redistribution licence verified; review_required.'
      }
    }))
  };
}

export async function fetchStatbunkerLaLigaAssists(
  options: StatbunkerLaLigaAssistsFetchOptions = {}
): Promise<RankingInput> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const rows = parseStatbunkerLaLigaAssists(
    await fetchHtml(fetchImpl),
    options.minimumEntries ?? statbunkerLaLigaAssistsTargetSize
  );
  return buildStatbunkerLaLigaAssistsRanking(rows, options.minimumEntries ?? statbunkerLaLigaAssistsTargetSize);
}
