import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://www.rsssf.org/miscellaneous/century.html';

export type RsssfInternationalGoalEntry = {
  sourceRank: number;
  displayedRank: number | null;
  name: string;
  country: string | null;
  goals: number;
  caps: number;
  externalId: string;
};

type ParsedRsssfInternationalGoalEntry = RsssfInternationalGoalEntry & {
  displayedRankToken: number | '-' | null;
  period: string;
  externalIdKind: 'source_player_page' | 'name_country_fallback';
};

type RsssfInternationalParseResult = {
  rows: ParsedRsssfInternationalGoalEntry[];
  sourceAsOf: string | null;
  sourceGoalThreshold: number | null;
  sourceTitle: string | null;
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

function cleanPlayerName(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, '')).replace(/^(?:"|“)|(?:"|”)$/g, '').trim();
}

function normalizeExternalIdPart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fallbackExternalId(name: string, country: string | null): string {
  return `name-country:${normalizeExternalIdPart(name)}|${normalizeExternalIdPart(country ?? 'unknown-country')}`;
}

function extractGoalsBlock(html: string): string {
  const sectionStart = html.search(/<h2>\s*<a\s+name=["']goals["'][^>]*>/i);
  if (sectionStart < 0) throw new Error('RSSSF: no se encontró la sección de goles internacionales');
  const preRelativeStart = html.slice(sectionStart).search(/<pre[^>]*>/i);
  if (preRelativeStart < 0) throw new Error('RSSSF: bloque de goles internacionales incompleto');
  const preStart = sectionStart + preRelativeStart;
  const openingTagEnd = html.indexOf('>', preStart);
  const preEndRelative = html.slice(openingTagEnd + 1).search(/<\/pre>/i);
  const preEnd = preEndRelative < 0 ? -1 : openingTagEnd + 1 + preEndRelative;
  if (openingTagEnd < 0 || preEnd < openingTagEnd) throw new Error('RSSSF: bloque de goles internacionales incompleto');
  return html.slice(openingTagEnd + 1, preEnd);
}

function parseRsssfInternationalGoalRows(html: string): RsssfInternationalParseResult {
  const block = extractGoalsBlock(html);
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const sourceTitle = titleMatch ? decodeHtml(titleMatch[1] ?? '') : null;
  const sourceAsOf = /\bup to date as of\s+([^.<\n]+(?:,\s*\d{4})?)/i.exec(block)?.[1]?.trim() ?? null;
  const goalSectionStart = html.search(/<h2>\s*<a\s+name=["']goals["'][^>]*>/i);
  const goalSectionPrefix = goalSectionStart >= 0 ? html.slice(goalSectionStart, html.indexOf('<pre', goalSectionStart)) : '';
  const thresholdMatch = /Players with\s+(\d+)\s+or\s+More Goals/i.exec(goalSectionPrefix);
  const sourceGoalThreshold = thresholdMatch ? Number(thresholdMatch[1]) : null;
  const metricPattern = /\b(\d+)\s+\(\s*(\d+)\s*\)\s+\((\d{4}-\d{4})\)/;
  const playerLinkPattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']*(?:intlg|intl)\.html)["'][^>]*>([\s\S]*?)<\/a>/i;
  const rows: ParsedRsssfInternationalGoalEntry[] = [];

  for (const [lineIndex, line] of block.split(/\r?\n/).entries()) {
    const valueMatch = metricPattern.exec(line);
    if (!valueMatch) continue;

    const countryStart = line.indexOf('[');
    const countryEnd = countryStart >= 0 ? line.indexOf(']', countryStart + 1) : -1;
    const countryBlock = countryStart >= 0 && countryEnd > countryStart
      ? line.slice(countryStart + 1, countryEnd)
      : null;
    const country = countryBlock ? decodeHtml(countryBlock.replace(/<[^>]+>/g, '')) : null;
    const playerLink = playerLinkPattern.exec(line);
    const displayedTokenMatch = /^\s*(\d+|-)\./.exec(line);
    const displayedRankToken: number | '-' | null = displayedTokenMatch
      ? (displayedTokenMatch[1] === '-' ? '-' : Number(displayedTokenMatch[1]))
      : null;
    const displayedRank = typeof displayedRankToken === 'number' ? displayedRankToken : null;
    const name = playerLink
      ? cleanPlayerName(playerLink[2] ?? '')
      : cleanPlayerName((countryStart >= 0 ? line.slice(0, countryStart) : line).replace(/^\s*(?:\d+|-)\.\s*/, ''));
    const externalId = playerLink?.[1] ?? fallbackExternalId(name, country);
    const externalIdKind = playerLink ? 'source_player_page' : 'name_country_fallback';
    const goals = Number(valueMatch[1]);
    const caps = Number(valueMatch[2]);
    const period = valueMatch[3] ?? '';

    // A metric-looking line must either be fully understood or stop the
    // import. Silently skipping one row would shift the real top-200.
    if (!name || !country || !Number.isInteger(goals) || goals < 1 || !Number.isInteger(caps) || caps < 1) {
      throw new Error(`RSSSF: fila estadística no parseable en la línea ${lineIndex + 1}`);
    }
    rows.push({
      sourceRank: rows.length + 1,
      displayedRank,
      name,
      country,
      goals,
      caps,
      externalId,
      displayedRankToken,
      period,
      externalIdKind
    });
  }
  if (rows.length < 200) throw new Error(`RSSSF: cobertura insuficiente para el top 200 (${rows.length} jugadores con fila parseable)`);
  const topTwoHundred = rows.slice(0, 200);
  const ids = new Set<string>();
  const identityKeys = new Set<string>();
  let previousGoals = Number.POSITIVE_INFINITY;
  let rankedRowsSeen = 0;
  for (const [index, row] of topTwoHundred.entries()) {
    if (ids.has(row.externalId)) throw new Error(`RSSSF: jugador duplicado en la fila ${index + 1}: ${row.externalId}`);
    const identityKey = `${normalizeExternalIdPart(row.name)}|${normalizeExternalIdPart(row.country ?? '')}`;
    if (identityKeys.has(identityKey)) throw new Error(`RSSSF: identidad duplicada en la fila ${index + 1}: ${row.name} / ${row.country}`);
    if (row.goals > previousGoals) throw new Error(`RSSSF: goles fuera de orden en la fila ${index + 1}`);
    if (row.displayedRankToken !== '-') {
      rankedRowsSeen += 1;
      if (row.displayedRank !== null && row.displayedRank !== rankedRowsSeen) {
        throw new Error(`RSSSF: rango mostrado incoherente en la fila ${index + 1}: ${row.displayedRank} (esperado ${rankedRowsSeen})`);
      }
      if (row.displayedRank === null && (index === 0 || row.goals !== topTwoHundred[index - 1]!.goals)) {
        throw new Error(`RSSSF: falta el rango mostrado para una fila no empatada (${index + 1})`);
      }
    }
    ids.add(row.externalId);
    identityKeys.add(identityKey);
    previousGoals = row.goals;
  }
  return { rows, sourceAsOf, sourceGoalThreshold, sourceTitle };
}

export function parseRsssfInternationalGoals(html: string): RsssfInternationalGoalEntry[] {
  return parseRsssfInternationalGoalRows(html).rows.slice(0, 200).map((row) => ({
    sourceRank: row.sourceRank,
    displayedRank: row.displayedRank,
    name: row.name,
    country: row.country,
    goals: row.goals,
    caps: row.caps,
    externalId: row.externalId
  }));
}

export async function fetchRsssfInternationalGoals(): Promise<RankingInput> {
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`RSSSF international goals ${response.status}`);
  const html = new TextDecoder('windows-1252').decode(await response.arrayBuffer());
  const parsed = parseRsssfInternationalGoalRows(html);
  const rows = parsed.rows.slice(0, 200);
  if (!parsed.sourceTitle || !/International Goals/i.test(parsed.sourceTitle)) {
    throw new Error('RSSSF: título de fuente inesperado para la tabla internacional');
  }
  if (parsed.sourceGoalThreshold !== 30 || !parsed.sourceAsOf) {
    throw new Error('RSSSF: falta la declaración de universo o fecha de actualización de la tabla');
  }
  return {
    categorySlug: 'national-team-official-goals',
    source: {
      key: 'rsssf-international-records',
      name: 'RSSSF international goals records (30+ table)',
      sourceType: 'reference',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `rsssf-national-team-goals-top-200-${new Date().toISOString().slice(0, 10)}`,
    // RSSSF declares a complete 30+ universe; this keeps the first 200
    // actual player rows, including rows without a player hyperlink.
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `rsssf:international:player:${createHash('sha256').update(`${row.externalId}|${row.country ?? ''}`).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.goals,
      evidence: {
        sourceRank: row.sourceRank,
        sourceDisplayedRank: row.displayedRank,
        externalId: row.externalId,
        externalIdKind: row.externalIdKind,
        country: row.country,
        caps: row.caps,
        period: row.period,
        sourceRowsParsed: parsed.rows.length,
        sourceAsOf: parsed.sourceAsOf,
        sourceGoalThreshold: parsed.sourceGoalThreshold,
        sourcePageTitle: parsed.sourceTitle,
        topN: 200,
        rankingValidation: '200 filas reales; IDs externos/fallback únicos; orden descendente por goles; rangos RSSSF validados con empates y filas no numeradas',
        sourceUrl,
        scope: 'Tabla RSSSF de goles internacionales: partidos de selecciones/representaciones que RSSSF reconoce, competitivos y amistosos cuando la fuente los contabiliza; las excepciones históricas y casos de selecciones amateurs se rigen por las notas de RSSSF. No equivale automáticamente a una definición FIFA única de partido oficial.'
      }
    }))
  };
}
