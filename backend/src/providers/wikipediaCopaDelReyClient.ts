import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const pageUrl = 'https://es.wikipedia.org/wiki/Copa_del_Rey';
const apiUrl = 'https://es.wikipedia.org/w/rest.php/v1/page/Copa_del_Rey';

type WikipediaPage = {
  latest?: { id?: number; timestamp?: string };
  license?: { url?: string; title?: string };
  source?: string;
};

export type CopaDelReyClubTitleEntry = {
  sourceRank: number;
  name: string;
  externalId: string;
  titles: number;
};

function extractPalmaresTable(wikitext: string): string {
  const sectionStart = wikitext.search(/^==\s*Palmarés\s*==\s*$/im);
  if (sectionStart < 0) throw new Error('Copa del Rey: no se encontró la sección de palmarés');
  const section = wikitext.slice(sectionStart);
  const headingEnd = section.indexOf('\n');
  const nextSection = headingEnd >= 0
    ? section.slice(headingEnd + 1).search(/^==\s*[^=].*?\s*==\s*$/im)
    : -1;
  const boundedSection = nextSection >= 0 ? section.slice(0, headingEnd + 1 + nextSection) : section;
  const tableStart = boundedSection.indexOf('{|');
  if (tableStart < 0) throw new Error('Copa del Rey: no se encontró la tabla de palmarés');
  const tableEnd = boundedSection.indexOf('\n|}', tableStart);
  if (tableEnd < 0) throw new Error('Copa del Rey: tabla de palmarés incompleta');
  return boundedSection.slice(tableStart, tableEnd);
}

function parseClub(block: string): { name: string; externalId: string } | null {
  // The source table marks champions in bold. Ignore flag links and extract
  // the first bold wiki link, which is the club column.
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
  // In the live page cells are usually on separate lines, but MediaWiki also
  // permits several cells on one line. The first bold numeric cell is the
  // titles column; later numeric cells are runners-up/finals.
  const match = /\|\s*'''(\d+)'''\s*(?:\||$)/m.exec(block);
  const value = Number(match?.[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function parseWikipediaCopaDelReyClubTitles(wikitext: string): CopaDelReyClubTitleEntry[] {
  const table = extractPalmaresTable(wikitext);
  const blocks = [...table.matchAll(/\n\|-[^\n]*\n([\s\S]*?)(?=\n\|-[^\n]*\n|$)/g)].map((match) => match[1] ?? '');
  const rows: CopaDelReyClubTitleEntry[] = [];
  for (const block of blocks) {
    const club = parseClub(block);
    const titles = parseTitles(block);
    if (!club || titles === null) continue;
    rows.push({ sourceRank: rows.length + 1, ...club, titles });
  }
  return rows;
}

function validateRows(rows: CopaDelReyClubTitleEntry[]): void {
  if (rows.length < 10) throw new Error(`Copa del Rey: se esperaban al menos 10 clubes campeones, llegaron ${rows.length}`);
  const ids = new Set<string>();
  let previousTitles = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (ids.has(row.externalId)) throw new Error(`Copa del Rey: club duplicado ${row.externalId}`);
    if (row.titles > previousTitles) throw new Error(`Copa del Rey: títulos fuera de orden en ${row.name}`);
    ids.add(row.externalId);
    previousTitles = row.titles;
  }
}

export async function fetchWikipediaCopaDelReyClubTitles(): Promise<RankingInput> {
  const response = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Wikipedia Copa del Rey ${response.status}`);
  const page = await response.json() as WikipediaPage;
  if (!page.source) throw new Error('Wikipedia Copa del Rey: respuesta sin wikitexto');
  const rows = parseWikipediaCopaDelReyClubTitles(page.source);
  validateRows(rows);
  const revision = page.latest?.id ?? 'unknown';
  const revisionTimestamp = page.latest?.timestamp ?? null;
  return {
    categorySlug: 'copa-del-rey-club-titles',
    source: {
      key: 'wikipedia-es-copa-del-rey-palmares',
      name: 'Wikipedia española — palmarés de la Copa del Rey (datos oficiales RFEF citados por la página)',
      sourceType: 'reference',
      baseUrl: pageUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `wikipedia-es-copa-del-rey-club-titles-${revision}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `wikipedia-es:copa-del-rey:club:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
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
        scope: 'Palmarés de clubes campeones de la Copa del Rey; la página indica que los datos oficiales de la RFEF estaban actualizados al 19 de abril de 2026'
      }
    }))
  };
}
