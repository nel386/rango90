import { get } from 'node:https';
import type { RankingInput } from '../imports/rankingInput.js';

export const tropheeChampionsUrl = 'https://ligue1.com/fr/articles/l1_article_3668-';
type ParsedTitleRow = { name: string; titles: number };

const winnerToClubId: Record<string, string> = {
  'Paris Saint-Germain': 'ligue1:club:paris-saint-germain',
  'AS Saint-Etienne': 'ligue1:club:as-saint-etienne',
  'Olympique de Marseille': 'ligue1:club:olympique-de-marseille',
  'AS Monaco': 'ligue1:club:as-monaco',
  'FC Nantes': 'ligue1:club:fc-nantes',
  'Olympique Lyonnais': 'ligue1:club:olympique-lyonnais',
  'Girondins de Bordeaux': 'ligue1:club:fc-girondins-de-bordeaux',
  'LOSC Lille': 'ligue1:club:losc',
  'RC Lens': 'ligue1:club:rc-lens'
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ').trim();
}

function visibleText(html: string): string {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

export function parseTropheeChampionsTitles(html: string): ParsedTitleRow[] {
  const text = visibleText(html).replace(/\s+/g, ' ').trim();
  const start = text.indexOf('Les vainqueurs du Trophée des Champions');
  const end = text.indexOf('→ Le palmarès du MVP', start);
  if (start < 0 || end <= start) throw new Error('Trophée des Champions: no se encontró el bloque oficial');
  const section = text.slice(start, end);
  const rows = [...section.matchAll(/(\d{4})\s*:\s*(.*?)(?=\s+\d{4}\s*:|$)/g)]
    .map((match) => (match[2] ?? '').split(/\s+[–-]\s+/)[0]?.replace(/\s*\(\d+\)\s*$/, '').trim() ?? '')
    .filter(Boolean);
  if (rows.length !== 31) throw new Error(`Trophée des Champions: se esperaban 31 ediciones y llegaron ${rows.length}`);
  const counts = new Map<string, number>();
  for (const winner of rows) counts.set(winner, (counts.get(winner) ?? 0) + 1);
  const result = [...counts.entries()].map(([name, titles]) => ({ name, titles }));
  if (result.some((row) => !winnerToClubId[row.name] || row.titles < 1) || result.length !== 8) {
    throw new Error(`Trophée des Champions: campeón no reconocido o universo incompleto (${result.length}/8)`);
  }
  return result.sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name));
}

export async function fetchTropheeChampionsTitles(): Promise<RankingInput> {
  const html = await fetchHtml(tropheeChampionsUrl);
  const rows = parseTropheeChampionsTitles(html);
  return {
    categorySlug: 'trophee-champions-club-titles',
    source: { key: 'ligue1-trophee-champions-official', name: 'Ligue 1 official Trophée des Champions honours', sourceType: 'official', baseUrl: tropheeChampionsUrl, rightsStatus: 'review_required' },
    dataVersion: `trophee-champions-club-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row, index) => ({
      entityId: winnerToClubId[row.name]!, entityType: 'club' as const, name: row.name, rawValue: row.titles,
      evidence: { sourceRank: index + 1, sourceName: row.name, sourceUrl: tropheeChampionsUrl, externalId: `trophee-champions:club:${winnerToClubId[row.name]!.split(':').at(-1)}`, scope: 'Trophée des Champions según el palmarés oficial de Ligue 1; universo cerrado de clubes campeones', closedUniverse: true }
    }))
  };
}

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = get(url, { headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' } }, (response) => {
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) { response.resume(); reject(new Error(`Ligue 1 Trophée des Champions ${response.statusCode ?? 'unknown'}`)); return; }
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error', reject);
    });
    request.setTimeout(60_000, () => request.destroy(new Error('Ligue 1 Trophée des Champions timeout')));
    request.on('error', reject);
  });
}
