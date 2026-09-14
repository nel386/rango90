import { get } from 'node:https';
import type { RankingInput } from '../imports/rankingInput.js';

export const ligue1HonoursUrl = 'https://ligue1.com/fr/articles/l1_article_289-le-palmares-des-champions-de-ligue-1';

type ParsedTitleRow = { name: string; titles: number };

const sourceNames = [
  'Paris Saint-Germain', 'AS Saint-Etienne', 'Olympique de Marseille', 'AS Monaco',
  'FC Nantes', 'Olympique Lyonnais', 'Stade de Reims', 'FC Girondins de Bordeaux',
  'OGC Nice', 'LOSC', 'FC Sochaux Montbéliard', 'FC Sète 34',
  'Montpellier Hérault SC', 'RC Lens', 'RC Strasbourg Alsace', 'AJ Auxerre',
  'Olympique Lillois', 'Racing Club de Paris', 'CO Roubaix-Tourcoing'
];

const stableClubIds: Record<string, string> = Object.fromEntries(sourceNames.map((name) => [
  name,
  `ligue1:club:${name.toLocaleLowerCase('fr-FR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`
]));

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/\\u0026/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleText(html: string): string {
  return decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

export function parseLigue1ClubTitles(html: string): ParsedTitleRow[] {
  const text = visibleText(html).replace(/\s+/g, ' ').trim();
  const start = text.indexOf('La liste des clubs sacrés par saison');
  const end = text.indexOf('Classement des clubs les plus titrés', start);
  if (start < 0 || end <= start) throw new Error('Ligue 1: no se encontró el bloque oficial de palmarés');

  const section = text.slice(start, end);
  const seasonPattern = /(\d{4}\/(?:\d{2}|\d{4}))\s*:\s*(.*?)(?=\s+\d{4}\/(?:\d{2}|\d{4})\s*:|$)/g;
  const champions = [...section.matchAll(seasonPattern)].map((match) => match[2]?.trim() ?? '').filter(Boolean);
  if (champions.length < 80) throw new Error(`Ligue 1: histórico incompleto (${champions.length} temporadas)`);

  const counts = new Map<string, number>();
  for (const name of champions) counts.set(name, (counts.get(name) ?? 0) + 1);
  const rows = [...counts.entries()].map(([name, titles]) => ({ name, titles }));
  if (rows.length !== sourceNames.length || rows.some((row) => !sourceNames.includes(row.name) || row.titles < 1)) {
    throw new Error(`Ligue 1: palmarés incompleto o club no reconocido (${rows.length}/${sourceNames.length})`);
  }
  return rows.sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name));
}

export async function fetchLigue1ClubTitles(): Promise<RankingInput> {
  const rows = parseLigue1ClubTitles(await fetchLigue1Html());
  return {
    categorySlug: 'ligue-1-club-titles',
    source: { key: 'ligue1-official-palmares', name: 'Ligue 1 official club honours', sourceType: 'official', baseUrl: ligue1HonoursUrl, rightsStatus: 'review_required' },
    dataVersion: `ligue-1-club-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row, index) => ({
      entityId: stableClubIds[row.name]!, entityType: 'club' as const, name: row.name, rawValue: row.titles,
      evidence: {
        sourceRank: index + 1, sourceName: row.name, sourceUrl: ligue1HonoursUrl,
        externalId: `ligue1:club:${row.name.toLocaleLowerCase('fr-FR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`,
        scope: 'Títulos de la máxima división francesa según el palmarés oficial de Ligue 1; universo cerrado de clubes campeones',
        closedUniverse: true
      }
    }))
  };
}

function fetchLigue1Html(): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = get(ligue1HonoursUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Rango90-data-import/0.1 (football data research)'
      }
    }, (response) => {
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`Ligue 1 official palmares ${response.statusCode ?? 'unknown'}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error', reject);
    });
    request.setTimeout(60_000, () => request.destroy(new Error('Ligue 1 official palmares timeout')));
    request.on('error', reject);
  });
}
