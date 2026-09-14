import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://www.rsssf.org/tablesi/italtops-allt.html';

export type RsssfSerieAGoalEntry = {
  sourceRank: number;
  displayedRank: number | null;
  name: string;
  goals: number;
  matches: number;
  externalId: string;
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

function extractTopscorersBlock(html: string): string {
  const preStart = html.indexOf('<pre>');
  const preEnd = html.indexOf('</pre>', preStart);
  if (preStart < 0 || preEnd < 0) throw new Error('RSSSF Serie A: bloque de goleadores incompleto');
  return html.slice(preStart + '<pre>'.length, preEnd);
}

export function parseRsssfSerieAGoals(html: string): RsssfSerieAGoalEntry[] {
  const block = extractTopscorersBlock(html);
  const rowPattern = /(?:^|\n)\s*(?:(\d+)\.\s+)?<a href="([^"]+)">([^<]+)<\/a>\s+(\d+)\s+(\d+)(?:\*)?/g;
  const rows: RsssfSerieAGoalEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(block)) !== null) {
    const displayedRank = match[1] ? Number(match[1]) : null;
    const href = match[2];
    const name = decodeHtml(match[3] ?? '');
    const goals = Number(match[4]);
    const matches = Number(match[5]);
    if (!href || !name || !Number.isInteger(goals) || goals < 1 || !Number.isInteger(matches) || matches < 1) continue;
    rows.push({
      sourceRank: rows.length + 1,
      displayedRank,
      name,
      goals,
      matches,
      externalId: href
    });
  }
  return rows;
}

export async function fetchRsssfSerieAGoals(): Promise<RankingInput> {
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`RSSSF Serie A ${response.status}`);
  const html = new TextDecoder('windows-1252').decode(await response.arrayBuffer());
  const rows = parseRsssfSerieAGoals(html);
  if (rows.length < 80) throw new Error(`RSSSF Serie A: cobertura inesperadamente baja (${rows.length} jugadores)`);
  return {
    categorySlug: 'serie-a-goals',
    source: {
      key: 'rsssf-serie-a-records',
      name: 'RSSSF Serie A all-time goals',
      sourceType: 'reference',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `rsssf-serie-a-goals-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: false,
    allowPartialDraft: true,
    partialDraftReason: 'La tabla histórica de RSSSF de Serie A solo expone una selección de goleadores; se conserva como contraste y no como top 200 publicable.',
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `rsssf:serie-a:player:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.goals,
      evidence: {
        sourceRank: row.sourceRank,
        sourceDisplayedRank: row.displayedRank,
        externalId: row.externalId,
        matches: row.matches,
        sourceUrl,
        scope: 'Serie A italiana a grupo único desde 1929/30; goles de 1945/46 excluidos explícitamente por RSSSF; los empates conservan el mismo puesto visible'
      }
    }))
  };
}
