import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const pageUrl = 'https://es.wikipedia.org/wiki/Copa_Libertadores_de_Am%C3%A9rica';
const apiUrl = 'https://es.wikipedia.org/w/rest.php/v1/page/Copa_Libertadores_de_Am%C3%A9rica';

type WikipediaPage = {
  latest?: { id?: number; timestamp?: string };
  license?: { url?: string; title?: string };
  source?: string;
};

export type CopaLibertadoresClubTitleEntry = {
  sourceRank: number;
  name: string;
  externalId: string;
  titles: number;
};

function extractPalmaresTable(wikitext: string): string {
  const sectionStart = wikitext.search(/^==\s*Palmarés\s*==\s*$/im);
  if (sectionStart < 0) throw new Error('Copa Libertadores: no se encontró la sección de palmarés');
  const section = wikitext.slice(sectionStart);
  const headingEnd = section.indexOf('\n');
  const nextSection = headingEnd >= 0
    ? section.slice(headingEnd + 1).search(/^==\s*[^=].*?\s*==\s*$/im)
    : -1;
  const boundedSection = nextSection >= 0 ? section.slice(0, headingEnd + 1 + nextSection) : section;
  const tableStart = boundedSection.indexOf('{|');
  if (tableStart < 0) throw new Error('Copa Libertadores: no se encontró la tabla de palmarés');
  const tableEnd = boundedSection.indexOf('\n|}', tableStart);
  if (tableEnd < 0) throw new Error('Copa Libertadores: tabla de palmarés incompleta');
  return boundedSection.slice(tableStart, tableEnd);
}

function parseClub(block: string): { name: string; externalId: string } | null {
  const boldLinks = [...block.matchAll(/'''\s*\[\[([^|\]#]+)(?:\|([^\]]+))?\]\](?:<ref[^>]*>[\s\S]*?<\/ref>)?\s*'''/g)];
  const match = boldLinks[0];
  if (!match?.[1]) return null;
  const target = match[1].trim();
  const name = (match[2] ?? target).replace(/'{2,}/g, '').trim();
  if (!name || !target) return null;
  return {
    name,
    externalId: `https://es.wikipedia.org/wiki/${encodeURIComponent(target.replace(/ /g, '_'))}`
  };
}

function parseTitles(block: string): number | null {
  const match = /^\|(?:[^|\n]*\|)*\s*'''(\d+)'''/m.exec(block);
  const value = Number(match?.[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function parseWikipediaCopaLibertadoresClubTitles(wikitext: string): CopaLibertadoresClubTitleEntry[] {
  const table = extractPalmaresTable(wikitext);
  const blocks = [...table.matchAll(/\n\|-[^\n]*\n([\s\S]*?)(?=\n\|-[^\n]*\n|$)/g)].map((match) => match[1] ?? '');
  const rows: CopaLibertadoresClubTitleEntry[] = [];
  for (const block of blocks) {
    const club = parseClub(block);
    const titles = parseTitles(block);
    if (!club || titles === null) continue;
    rows.push({ sourceRank: rows.length + 1, ...club, titles });
  }
  return rows;
}

function validateRows(rows: CopaLibertadoresClubTitleEntry[]): void {
  if (rows.length !== 27) throw new Error(`Copa Libertadores: se esperaban 27 clubes campeones, llegaron ${rows.length}`);
  const ids = new Set<string>();
  let previousTitles = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (ids.has(row.externalId)) throw new Error(`Copa Libertadores: club duplicado ${row.name}`);
    if (row.titles > previousTitles) throw new Error(`Copa Libertadores: títulos fuera de orden en ${row.name}`);
    ids.add(row.externalId);
    previousTitles = row.titles;
  }
}

export async function fetchWikipediaCopaLibertadoresClubTitles(): Promise<RankingInput> {
  const response = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Wikipedia Copa Libertadores ${response.status}`);
  const page = await response.json() as WikipediaPage;
  if (!page.source) throw new Error('Wikipedia Copa Libertadores: respuesta sin wikitexto');
  const rows = parseWikipediaCopaLibertadoresClubTitles(page.source);
  validateRows(rows);
  const revision = page.latest?.id ?? 'unknown';
  const revisionTimestamp = page.latest?.timestamp ?? null;
  return {
    categorySlug: 'copa-libertadores-club-titles',
    source: {
      key: 'wikipedia-es-copa-libertadores-records',
      name: 'Wikipedia española — palmarés histórico de la Copa Libertadores',
      sourceType: 'reference',
      baseUrl: pageUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `wikipedia-es-copa-libertadores-club-titles-${revision}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `wikipedia-es:copa-libertadores:club:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
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
        scope: 'Clubes campeones de la Copa Libertadores desde 1960 hasta la última edición completada incluida en la revisión de la fuente'
      }
    }))
  };
}
