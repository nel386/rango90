import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://www.besoccer.com/competition/historical-ranking/copa_libertadores/top-scorers';
const ajaxUrl = 'https://www.besoccer.com/ajax/ranking';
const competitionId = 204;

export type BeSoccerCopaLibertadoresGoalEntry = {
  sourceRank: number;
  name: string;
  goals: number;
  externalId: string;
  profileUrl: string;
  imageUrl: string | null;
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value.replaceAll('\\/', '/'), baseUrl).toString();
  } catch {
    return value;
  }
}

/**
 * Parses the ranking table HTML used both in the initial page and in the
 * /ajax/ranking response. The source exposes 20 rows per response; the
 * caller supplies the already-consumed row count so source order is kept.
 */
export function parseBeSoccerCopaLibertadoresGoalsPage(html: string, baseUrl = sourceUrl, rankOffset = 0): BeSoccerCopaLibertadoresGoalEntry[] {
  const rows: BeSoccerCopaLibertadoresGoalEntry[] = [];
  // The AJAX endpoint omits the opening <tr> for its first fragment. Splitting
  // on the closing tag handles both complete table HTML and that fragment
  // without ever allowing a player to consume the next row's value.
  for (const row of html.split(/<\/tr>/gi)) {
    if (!row.includes('data-cy="player"')) continue;
    const playerMatch = /<a\s+href="([^"]+)"[^>]*data-cy="player"[^>]*>[\s\S]*?<p\s+class="player-name[^>]*>\s*<b>([\s\S]*?)<\\?\/b>/i.exec(row);
    const imageMatch = /<img\s+loading="lazy"\s+class="align-middle player-img"\s+src="([^"]+)"/i.exec(row);
    const goalsMatch = /<td><b>(\d+)<\\?\/b>/i.exec(row);
    const profileUrl = absoluteUrl(playerMatch?.[1] ?? '', baseUrl);
    const name = decodeHtml(playerMatch?.[2] ?? '');
    const imageUrl = imageMatch?.[1] ? absoluteUrl(imageMatch[1], baseUrl) : null;
    const goals = Number(goalsMatch?.[1]);
    if (!name || !profileUrl || !Number.isInteger(goals) || goals < 1) continue;
    rows.push({
      sourceRank: rankOffset + rows.length + 1,
      name,
      goals,
      externalId: profileUrl,
      profileUrl,
      imageUrl: imageUrl || null
    });
  }
  return rows;
}

export function parseBeSoccerCopaLibertadoresGoalsResponse(body: string, baseUrl = ajaxUrl, rankOffset = 0): BeSoccerCopaLibertadoresGoalEntry[] {
  let html = body;
  try {
    const payload = JSON.parse(body) as { html?: unknown };
    if (typeof payload.html === 'string') html = payload.html;
  } catch {
    // The parser is also useful with an archived HTML response from a
    // reverse proxy; extract only the JSON string value because some HTML
    // proxies leave attribute quotes unescaped in the surrounding wrapper.
    const prefix = '{"html":"';
    const suffix = '","moreItems"';
    const start = body.indexOf(prefix);
    const end = body.indexOf(suffix, start + prefix.length);
    if (start >= 0 && end > start) {
      html = body.slice(start + prefix.length, end)
        .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\\//g, '/')
        .replace(/\\"/g, '"')
        .replace(/\\&quot;/g, '&quot;');
    }
  }
  return parseBeSoccerCopaLibertadoresGoalsPage(html, baseUrl, rankOffset);
}

function validateTop100(rows: BeSoccerCopaLibertadoresGoalEntry[]): void {
  if (rows.length < 100) throw new Error(`BeSoccer Libertadores: se esperaban al menos 100 filas, llegaron ${rows.length}`);
  const ids = new Set<string>();
  let previousGoals = Number.POSITIVE_INFINITY;
  for (const row of rows.slice(0, 100)) {
    if (ids.has(row.externalId)) throw new Error(`BeSoccer Libertadores: jugador duplicado ${row.externalId}`);
    if (row.goals > previousGoals) throw new Error(`BeSoccer Libertadores: goles fuera de orden en ${row.name}`);
    ids.add(row.externalId);
    previousGoals = row.goals;
  }
}

export async function fetchBeSoccerCopaLibertadoresGoals(): Promise<RankingInput> {
  const pageResponse = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!pageResponse.ok) throw new Error(`BeSoccer Libertadores ${pageResponse.status}`);
  const initialHtml = await pageResponse.text();
  const rankingCall = /generateRanking\(\s*(\d+)\s*,\s*(\d+)\s*,\s*["']top-scorers["']\s*,/u.exec(initialHtml);
  if (!rankingCall) throw new Error('BeSoccer Libertadores: no se pudo identificar la paginación histórica');
  const itemId = Number(rankingCall[1]);
  const year = Number(rankingCall[2]);
  if (itemId !== competitionId || !Number.isInteger(year)) throw new Error('BeSoccer Libertadores: identificadores de ranking inesperados');

  const rows = parseBeSoccerCopaLibertadoresGoalsPage(initialHtml, sourceUrl);
  for (let page = 1; rows.length < 100 && page <= 10; page += 1) {
    const url = new URL(ajaxUrl);
    url.search = new URLSearchParams({ req: 'competition_history_ranking_type', itemId: String(itemId), year: String(year), type: 'goals', group: '-1', page: String(page) }).toString();
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`BeSoccer Libertadores AJAX ${response.status} (página ${page})`);
    const pageRows = parseBeSoccerCopaLibertadoresGoalsResponse(await response.text(), ajaxUrl, rows.length);
    if (pageRows.length === 0) break;
    rows.push(...pageRows);
  }
  validateTop100(rows);
  const topHundred = rows.slice(0, 100);
  return {
    categorySlug: 'copa-libertadores-goals',
    source: {
      key: 'besoccer-copa-libertadores-historical-goals',
      name: 'BeSoccer — historical Copa Libertadores top scorers',
      sourceType: 'reference',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `besoccer-copa-libertadores-goals-top-100-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: topHundred.map((row) => ({
      entityId: `besoccer:copa-libertadores:player:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.goals,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: row.externalId,
        profileUrl: row.profileUrl,
        sourceImageUrl: row.imageUrl,
        sourceUrl,
        scope: 'Goles históricos de jugadores en la Copa Libertadores según la tabla histórica de BeSoccer; top 100 visible; el criterio de competición y los derechos de reutilización deben aprobarse antes de publicar'
      }
    }))
  };
}
