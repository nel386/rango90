import { createHash } from 'node:crypto';

const sourceUrl = 'https://www.rsssf.org/players/cleansheets.html';

export type RsssfCleanSheetEntry = {
  sourceRank: number;
  name: string;
  cleanSheetsProfessional: number;
  incompleteGames: number | null;
  cleanSheetsAll: number | null;
  gamesAll: number | null;
  bestSeason: string | null;
  externalId: string;
};

export type RsssfCleanSheetDataset = {
  sourceUrl: string;
  retrievedAt: string;
  sourceUpdatedAt: string | null;
  entries: RsssfCleanSheetEntry[];
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

function decodeRsssfDocument(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let nulBytes = 0;
  for (let index = 1; index < view.length; index += 2) if (view[index] === 0) nulBytes += 1;
  if (nulBytes > Math.min(200, view.length / 20)) return new TextDecoder('utf-16le').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

function extractMainPre(document: string): string {
  const preStart = document.indexOf('<pre>');
  const preEnd = document.indexOf('</pre>', preStart);
  if (preStart < 0 || preEnd < 0) throw new Error('RSSSF clean sheets: bloque pre incompleto');
  return document.slice(preStart + '<pre>'.length, preEnd);
}

function normalizePlayerName(value: string): string {
  const decoded = decodeHtml(value);
  const comma = decoded.indexOf(',');
  if (comma > 0) return `${decoded.slice(comma + 1).trim()} ${decoded.slice(0, comma).trim()}`;
  return decoded;
}

function parseCleanSheetValue(value: string): { cleanSheets: number; incompleteGames: number | null } | null {
  const match = /^(\d+)(?:\*)?\s*(?:\((\d+)(?:\+)?\))?\**$/.exec(value.trim());
  if (!match) return null;
  return { cleanSheets: Number(match[1]), incompleteGames: match[2] ? Number(match[2]) : null };
}

function extractProfessionalSection(pre: string): { section: string; sourceUpdatedAt: string | null } {
  const topLevelIndex = pre.indexOf('\nTop Level');
  const section = topLevelIndex >= 0 ? pre.slice(0, topLevelIndex) : pre;
  const updated = /last updated after matches on\s+([^\n.]+)/i.exec(pre);
  return { section, sourceUpdatedAt: updated?.[1]?.trim() ?? null };
}

export function parseRsssfCleanSheets(document: string): RsssfCleanSheetEntry[] {
  const { section } = extractProfessionalSection(document.includes('<pre>') ? extractMainPre(document) : document);
  const entries: RsssfCleanSheetEntry[] = [];
  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || /^NB:|^included:|^- |^In the first column|^Prof\.level|^all clean|^Top Level/i.test(line)) continue;
    const rowMatch = /^\s*(.*?)\s{2,}(\d+\*?(?:\s*\(\d+\+?\)\**)?)(?:\s+)(\d+\*?(?:\s*\(\d+\+?\))?)\s+\((\d+)\)\s+(.*?)\s*$/.exec(line);
    if (!rowMatch) continue;
    const name = normalizePlayerName(rowMatch[1] ?? '');
    const professional = parseCleanSheetValue(rowMatch[2] ?? '');
    if (!name || !professional) continue;
    const allValue = parseCleanSheetValue(rowMatch[3] ?? '');
    const gamesMatch = rowMatch[4] ? [rowMatch[4], rowMatch[4]] : null;
    const bestSeason = rowMatch[5] ?? null;
    const externalId = `clean-sheets:${createHash('sha256').update(name.toLocaleLowerCase('en-US')).digest('hex').slice(0, 24)}`;
    entries.push({
      sourceRank: entries.length + 1,
      name,
      cleanSheetsProfessional: professional.cleanSheets,
      incompleteGames: professional.incompleteGames,
      cleanSheetsAll: allValue?.cleanSheets ?? null,
      gamesAll: gamesMatch?.[1] ? Number(gamesMatch[1]) : null,
      bestSeason,
      externalId
    });
  }
  if (entries.length < 20) throw new Error(`RSSSF clean sheets: cobertura insuficiente (${entries.length} jugadores)`);
  return entries;
}

export async function fetchRsssfCleanSheets(): Promise<RsssfCleanSheetDataset> {
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`RSSSF clean sheets ${response.status}`);
  const document = decodeRsssfDocument(await response.arrayBuffer());
  const pre = extractMainPre(document);
  const { sourceUpdatedAt } = extractProfessionalSection(pre);
  return { sourceUrl, retrievedAt: new Date().toISOString(), sourceUpdatedAt, entries: parseRsssfCleanSheets(document) };
}
