import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const pageUrl = 'https://es.wikipedia.org/wiki/Recopa_Sudamericana';
const apiUrl = 'https://es.wikipedia.org/w/rest.php/v1/page/Recopa_Sudamericana';

type WikipediaPage = {
  latest?: { id?: number; timestamp?: string };
  license?: { url?: string; title?: string };
  source?: string;
};

export type RecopaSudamericanaClubTitleEntry = {
  sourceRank: number;
  name: string;
  externalId: string;
  titles: number;
};

function extractTitlesTable(wikitext: string): string {
  const sectionStart = wikitext.search(/^===\s*Títulos por equipo\s*===\s*$/im);
  if (sectionStart < 0) throw new Error('Recopa Sudamericana: no se encontró la sección de títulos por equipo');
  const section = wikitext.slice(sectionStart);
  const sectionLineEnd = section.indexOf('\n');
  const nextSection = sectionLineEnd >= 0 ? section.slice(sectionLineEnd + 1).search(/^===\s*[^=].*?\s*===\s*$/im) : -1;
  const boundedSection = nextSection >= 0 ? section.slice(0, sectionLineEnd + 1 + nextSection) : section;
  const tableStart = boundedSection.indexOf('{|');
  if (tableStart < 0) throw new Error('Recopa Sudamericana: no se encontró la tabla de títulos');
  const tableEnd = boundedSection.indexOf('\n|}', tableStart);
  if (tableEnd < 0) throw new Error('Recopa Sudamericana: tabla de títulos incompleta');
  return boundedSection.slice(tableStart, tableEnd);
}

function parseClub(block: string): { name: string; externalId: string } | null {
  const boldLinks = [...block.matchAll(/'''\s*(?:\{\{[^}\n]+\}\}\s*)?\[\[([^|\]#]+)(?:\|([^\]]+))?\]\](?:<ref[^>]*>[\s\S]*?<\/ref>)?\s*'''/g)];
  const match = boldLinks[0];
  if (!match?.[1]) return null;
  const target = match[1].trim();
  const name = (match[2] ?? target).replace(/'{2,}/g, '').trim();
  return name && target ? { name, externalId: `https://es.wikipedia.org/wiki/${encodeURIComponent(target.replace(/ /g, '_'))}` } : null;
}

function parseTitles(block: string): number | null {
  const match = /^\|(?:[^|\n]*\|)*\s*'''(\d+)'''/m.exec(block);
  const value = Number(match?.[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function parseWikipediaRecopaSudamericanaClubTitles(wikitext: string): RecopaSudamericanaClubTitleEntry[] {
  const table = extractTitlesTable(wikitext);
  const blocks = [...table.matchAll(/\n\|-[^\n]*\n([\s\S]*?)(?=\n\|-[^\n]*\n|$)/g)].map((match) => match[1] ?? '');
  const rows: RecopaSudamericanaClubTitleEntry[] = [];
  for (const block of blocks) {
    const club = parseClub(block);
    const titles = parseTitles(block);
    if (!club || titles === null) continue;
    rows.push({ sourceRank: rows.length + 1, ...club, titles });
  }
  return rows;
}

function validateRows(rows: RecopaSudamericanaClubTitleEntry[]): void {
  if (rows.length < 1) throw new Error('Recopa Sudamericana: no se encontraron clubes campeones');
  const ids = new Set<string>();
  let previousTitles = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (ids.has(row.externalId)) throw new Error(`Recopa Sudamericana: club duplicado ${row.name}`);
    if (row.titles > previousTitles) throw new Error(`Recopa Sudamericana: títulos fuera de orden en ${row.name}`);
    ids.add(row.externalId);
    previousTitles = row.titles;
  }
}

export async function fetchWikipediaRecopaSudamericanaClubTitles(): Promise<RankingInput> {
  const response = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Wikipedia Recopa Sudamericana ${response.status}`);
  const page = await response.json() as WikipediaPage;
  if (!page.source) throw new Error('Wikipedia Recopa Sudamericana: respuesta sin wikitexto');
  const rows = parseWikipediaRecopaSudamericanaClubTitles(page.source);
  validateRows(rows);
  const revision = page.latest?.id ?? 'unknown';
  const revisionTimestamp = page.latest?.timestamp ?? null;
  return {
    categorySlug: 'recopa-sudamericana-club-titles',
    source: {
      key: 'wikipedia-es-recopa-sudamericana-records',
      name: 'Wikipedia española — palmarés histórico de la Recopa Sudamericana',
      sourceType: 'reference',
      baseUrl: pageUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `wikipedia-es-recopa-sudamericana-club-titles-${revision}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `wikipedia-es:recopa-sudamericana:club:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'club' as const,
      name: row.name,
      rawValue: row.titles,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: row.externalId,
        sourceUrl: pageUrl,
        sourceRevision: revision,
        sourceRevisionTimestamp: revisionTimestamp,
        sourceLicense: page.license?.title ?? 'Creative Commons Attribution-Share Alike 4.0',
        sourceLicenseUrl: page.license?.url ?? 'https://creativecommons.org/licenses/by-sa/4.0/deed.es',
        scope: 'Clubes campeones de la Recopa Sudamericana desde 1989 hasta la última edición completada incluida en la revisión de la fuente'
      }
    }))
  };
}
