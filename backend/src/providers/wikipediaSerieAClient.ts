import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const pageUrl = 'https://it.wikipedia.org/wiki/Classifica_dei_marcatori_della_Serie_A';
const apiUrl = 'https://it.wikipedia.org/w/rest.php/v1/page/Classifica_dei_marcatori_della_Serie_A';

type WikipediaPage = {
  latest?: { id?: number; timestamp?: string };
  license?: { url?: string; title?: string };
  source?: string;
};

export type WikipediaSerieAGoalEntry = {
  sourceRank: number;
  displayedRank: number;
  name: string;
  externalId: string;
  goals: number;
};

function extractMainTable(wikitext: string): string {
  const start = wikitext.indexOf('{| class="wikitable sortable"');
  if (start < 0) throw new Error('Wikipedia Serie A: no se encontró la tabla principal');
  const end = wikitext.indexOf('\n|}', start);
  if (end < 0) throw new Error('Wikipedia Serie A: tabla principal incompleta');
  return wikitext.slice(start, end);
}

function parseRank(block: string): number | null {
  const match = /^\|\s*(?:'''(\d+)'''|(\d+))\s*$/m.exec(block);
  const value = Number(match?.[1] ?? match?.[2]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function parseName(block: string): { name: string; externalId: string; end: number } | null {
  const match = /\[\[([^|\]#]+)(?:\|([^\]]+))?\]\]/.exec(block);
  if (!match?.[1]) return null;
  const target = match[1].trim();
  const display = (match[2] ?? target).replace(/'{2,}/g, '').trim();
  if (!display || !target) return null;
  return {
    name: display,
    externalId: `https://it.wikipedia.org/wiki/${encodeURIComponent(target.replace(/ /g, '_'))}`,
    end: (match.index ?? 0) + match[0].length
  };
}

function firstNumericCell(text: string): number | null {
  for (const line of text.split('\n')) {
    const value = line
      .replace(/^\|\s*/, '')
      .replace(/(?:align="[^"]*"|rowspan=\d+)\s*\|/g, '')
      .trim();
    if (/^\d+\*?$/.test(value)) return Number(value.replace('*', ''));
  }
  return null;
}

export function parseWikipediaSerieAGoals(wikitext: string): WikipediaSerieAGoalEntry[] {
  const table = extractMainTable(wikitext);
  const blocks = [...table.matchAll(/\n\|-\s*\n([\s\S]*?)(?=\n\|-\s*\n|$)/g)].map((match) => match[1] ?? '');
  const rows: WikipediaSerieAGoalEntry[] = [];
  for (const block of blocks) {
    const displayedRank = parseRank(block);
    const parsedName = parseName(block);
    if (!displayedRank || !parsedName) continue;
    const goals = firstNumericCell(block.slice(parsedName.end));
    if (!goals || goals < 1) continue;
    rows.push({
      sourceRank: rows.length + 1,
      displayedRank,
      name: parsedName.name,
      externalId: parsedName.externalId,
      goals
    });
  }
  return rows;
}

function validateRows(rows: WikipediaSerieAGoalEntry[]): void {
  if (rows.length !== 100) throw new Error(`Wikipedia Serie A: se esperaban 100 filas, llegaron ${rows.length}`);
  const ids = new Set<string>();
  let previousRank = 0;
  let previousGoals = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (ids.has(row.externalId)) throw new Error(`Wikipedia Serie A: jugador duplicado ${row.externalId}`);
    if (row.displayedRank < previousRank) throw new Error(`Wikipedia Serie A: puesto fuera de orden ${row.displayedRank}`);
    if (row.goals > previousGoals) throw new Error(`Wikipedia Serie A: goles fuera de orden en ${row.name}`);
    ids.add(row.externalId);
    previousRank = row.displayedRank;
    previousGoals = row.goals;
  }
}

export async function fetchWikipediaSerieAGoals(): Promise<RankingInput> {
  const response = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Wikipedia Serie A ${response.status}`);
  const page = await response.json() as WikipediaPage;
  if (!page.source) throw new Error('Wikipedia Serie A: respuesta sin wikitexto');
  const rows = parseWikipediaSerieAGoals(page.source);
  validateRows(rows);
  const revision = page.latest?.id ?? 'unknown';
  const revisionTimestamp = page.latest?.timestamp ?? null;
  return {
    categorySlug: 'serie-a-goals',
    source: {
      key: 'wikipedia-it-serie-a-records',
      name: 'Wikipedia italiana — classifica storica dei marcatori di Serie A',
      sourceType: 'reference',
      baseUrl: pageUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `wikipedia-it-serie-a-goals-top-100-${revision}`,
    // The source table is explicitly validated as exactly 100 unique,
    // descending rows. Statistical authority and publication rights remain
    // separate gates, so this can be complete in coverage while staying draft.
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `wikipedia-it:serie-a:player:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.goals,
      evidence: {
        sourceRank: row.sourceRank,
        sourceDisplayedRank: row.displayedRank,
        externalId: row.externalId,
        sourceUrl: pageUrl,
        sourceRevision: revision,
        sourceRevisionTimestamp: revisionTimestamp,
        sourceLicense: page.license?.title ?? 'Creative Commons Attribution-Share Alike 4.0',
        sourceLicenseUrl: page.license?.url ?? 'https://creativecommons.org/licenses/by-sa/4.0/deed.it',
        scope: 'Serie A italiana a grupo único desde 1929/30; se excluyen Alta Italia 1944 y el campeonato mixto Serie A-B 1945/46 según la definición de la página fuente; se conservan los empates del puesto visible'
      }
    }))
  };
}
