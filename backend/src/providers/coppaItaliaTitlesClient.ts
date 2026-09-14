import type { RankingInput } from '../imports/rankingInput.js';

export const coppaItaliaPalmaresUrl = 'https://www.legaseriea.it/coppa-italia/albo';

type CoppaItaliaTitleRow = { name: string; titles: number };

const sourceNames = [
  'JUVENTUS', 'INTER', 'ROMA', 'LAZIO', 'NAPOLI', 'FIORENTINA', 'TORINO', 'MILAN',
  'SAMPDORIA', 'BOLOGNA', 'PARMA', 'ATALANTA', 'L.R. VICENZA', 'VENEZIA', 'GENOA', 'VADO'
];

const displayNames: Record<string, string> = {
  JUVENTUS: 'Juventus', INTER: 'Inter', ROMA: 'Roma', LAZIO: 'Lazio', NAPOLI: 'Napoli',
  FIORENTINA: 'Fiorentina', TORINO: 'Torino', MILAN: 'Milan', SAMPDORIA: 'Sampdoria',
  BOLOGNA: 'Bologna', PARMA: 'Parma', ATALANTA: 'Atalanta', 'L.R. VICENZA': 'L.R. Vicenza',
  VENEZIA: 'Venezia', GENOA: 'Genoa', VADO: 'Vado'
};

const stableClubIds: Record<string, string> = {
  JUVENTUS: 'uefa:champions:club:805addd3b0bc63427185cfbe',
  INTER: 'uefa:champions:club:30a4a5bca8f4056c1f696b91',
  ROMA: 'uefa:conference:club:7e325f21b5b5f02606012cea',
  LAZIO: 'legaseriea:club:lazio',
  NAPOLI: 'uefa:europa:club:8f51ddf7b345d5193ceea265',
  FIORENTINA: 'legaseriea:club:fiorentina',
  TORINO: 'legaseriea:club:torino',
  MILAN: 'uefa:champions:club:ec3ae6550b9446364138461d',
  SAMPDORIA: 'legaseriea:club:sampdoria',
  BOLOGNA: 'legaseriea:club:bologna',
  PARMA: 'legaseriea:club:parma',
  ATALANTA: 'legaseriea:club:atalanta',
  'L.R. VICENZA': 'legaseriea:club-lr-vicenza',
  VENEZIA: 'legaseriea:club:venezia',
  GENOA: 'legaseriea:club:genoa',
  VADO: 'legaseriea:club:vado'
};

function decodeHtml(value: string): string {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

function visibleText(html: string): string {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

export function parseCoppaItaliaClubTitles(html: string): CoppaItaliaTitleRow[] {
  const text = visibleText(html);
  const start = text.indexOf('JUVENTUS Totale vittorie:');
  const end = text.indexOf('Lega Serie A', start);
  if (start < 0 || end <= start) throw new Error('Coppa Italia: no se encontró el bloque oficial de palmarés');
  const section = text.slice(start, end);
  const namePattern = sourceNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const rows = [...section.matchAll(new RegExp(`(${namePattern})\\s+Totale vittorie:\\s+(\\d+)`, 'g'))]
    .map((match) => ({ name: match[1] ?? '', titles: Number(match[2]) }))
    .filter((row) => sourceNames.includes(row.name) && Number.isInteger(row.titles) && row.titles > 0);
  if (rows.length !== sourceNames.length || new Set(rows.map((row) => row.name)).size !== rows.length) {
    throw new Error(`Coppa Italia: palmarés incompleto o duplicado (${rows.length}/${sourceNames.length})`);
  }
  return rows.sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name));
}

export async function fetchCoppaItaliaClubTitles(): Promise<RankingInput> {
  const response = await fetch(coppaItaliaPalmaresUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Coppa Italia official palmares ${response.status}`);
  const rows = parseCoppaItaliaClubTitles(await response.text());
  return {
    categorySlug: 'coppa-italia-club-titles',
    source: {
      key: 'legaseriea-coppa-italia-palmares',
      name: 'Lega Serie A official Coppa Italia honours',
      sourceType: 'official',
      baseUrl: coppaItaliaPalmaresUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `coppa-italia-club-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row, index) => ({
      entityId: stableClubIds[row.name]!,
      entityType: 'club' as const,
      name: displayNames[row.name]!,
      rawValue: row.titles,
      evidence: {
        sourceRank: index + 1,
        sourceName: row.name,
        sourceUrl: coppaItaliaPalmaresUrl,
        externalId: `legaseriea:coppa-italia:club:${row.name.toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g, '-')}`,
        scope: 'Títulos de la Coppa Italia según el palmarés oficial de la Lega Serie A; universo cerrado de clubes campeones',
        closedUniverse: true
      }
    }))
  };
}
