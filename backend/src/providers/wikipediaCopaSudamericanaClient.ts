import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const pageUrl = 'https://es.wikipedia.org/wiki/Copa_Sudamericana';
const apiUrl = 'https://es.wikipedia.org/w/rest.php/v1/page/Copa_Sudamericana';

type WikipediaPage = {
  latest?: { id?: number; timestamp?: string };
  license?: { url?: string; title?: string };
  source?: string;
};

export type CopaSudamericanaClubTitleEntry = {
  sourceRank: number;
  name: string;
  externalId: string;
  titles: number;
};

function extractTitlesTable(wikitext: string): string {
  const sectionStart = wikitext.search(/^===\s*Títulos por equipo\s*===\s*$/im);
  if (sectionStart < 0) throw new Error('Copa Sudamericana: no se encontró la sección de títulos por equipo');
  const section = wikitext.slice(sectionStart);
  const nextSection = section.slice(section.indexOf('\n') + 1).search(/^===\s*[^=].*?\s*===\s*$/im);
  const boundedSection = nextSection >= 0 ? section.slice(0, section.indexOf('\n') + 1 + nextSection) : section;
  const tableStart = boundedSection.indexOf('{|');
  if (tableStart < 0) throw new Error('Copa Sudamericana: no se encontró la tabla de títulos');
  const tableEnd = boundedSection.indexOf('\n|}', tableStart);
  if (tableEnd < 0) throw new Error('Copa Sudamericana: tabla de títulos incompleta');
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

export function parseWikipediaCopaSudamericanaClubTitles(wikitext: string): CopaSudamericanaClubTitleEntry[] {
  const table = extractTitlesTable(wikitext);
  const blocks = [...table.matchAll(/\n\|-[^\n]*\n([\s\S]*?)(?=\n\|-[^\n]*\n|$)/g)].map((match) => match[1] ?? '');
  const rows: CopaSudamericanaClubTitleEntry[] = [];
  for (const block of blocks) {
    const club = parseClub(block);
    const titles = parseTitles(block);
    if (!club || titles === null) continue;
    rows.push({ sourceRank: rows.length + 1, ...club, titles });
  }
  return rows;
}

function validateRows(rows: CopaSudamericanaClubTitleEntry[]): void {
  if (rows.length < 1) throw new Error('Copa Sudamericana: no se encontraron clubes campeones');
  const ids = new Set<string>();
  let previousTitles = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (ids.has(row.externalId)) throw new Error(`Copa Sudamericana: club duplicado ${row.name}`);
    if (row.titles > previousTitles) throw new Error(`Copa Sudamericana: títulos fuera de orden en ${row.name}`);
    ids.add(row.externalId);
    previousTitles = row.titles;
  }
}

export async function fetchWikipediaCopaSudamericanaClubTitles(): Promise<RankingInput> {
  const response = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Wikipedia Copa Sudamericana ${response.status}`);
  const page = await response.json() as WikipediaPage;
  if (!page.source) throw new Error('Wikipedia Copa Sudamericana: respuesta sin wikitexto');
  const rows = parseWikipediaCopaSudamericanaClubTitles(page.source);
  validateRows(rows);
  const revision = page.latest?.id ?? 'unknown';
  const revisionTimestamp = page.latest?.timestamp ?? null;
  return {
    categorySlug: 'copa-sudamericana-club-titles',
    source: {
      key: 'wikipedia-es-copa-sudamericana-records',
      name: 'Wikipedia española — palmarés histórico de la Copa Sudamericana',
      sourceType: 'reference',
      baseUrl: pageUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `wikipedia-es-copa-sudamericana-club-titles-${revision}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `wikipedia-es:copa-sudamericana:club:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
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
        scope: 'Clubes campeones de la Copa Sudamericana desde 2002 hasta la última edición completada incluida en la revisión de la fuente'
      }
    }))
  };
}
