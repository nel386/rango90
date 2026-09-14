import type { RankingInput } from '../imports/rankingInput.js';

export const supertacaPortugalTitlesUrl = 'https://www.fpf.pt/pt/Competi%C3%A7%C3%B5es/Futebol-Masculino/Superta%C3%A7a-C%C3%A2ndido-de-Oliveira-Betano/Vencedores';
const officialReaderUrl = `https://r.jina.ai/${supertacaPortugalTitlesUrl}`;

type TitleRow = { year: number; name: string };

const clubIds: Record<string, string> = {
  'FC Porto': 'uefa:champions:club:a8a971f4d1a008ac1abb1bc5',
  'SL Benfica': 'uefa:champions:club:5093846cbcba23b1096c4f33',
  'Sporting CP': 'fpf:taca-portugal:club:sporting-cp',
  'Boavista FC': 'fpf:taca-portugal:club:boavista-fc',
  'Vitória SC': 'fpf:taca-portugal:club:vitoria-sc'
};

function normalizeText(value: string): string {
  return value.replaceAll('\u00a0', ' ').replace(/\s+/g, ' ').trim();
}

export function parseSupertacaPortugalClubTitles(markdown: string): TitleRow[] {
  const start = markdown.indexOf('### Supertaça Cândido de Oliveira');
  const end = markdown.indexOf('[](https://www.fpf.pt/', start);
  if (start < 0 || end <= start) throw new Error('FPF Supertaça: no se encontró el bloque oficial de vencedores');
  const allRows = [...markdown.slice(start, end).matchAll(/^\s*(\d{4})\s+(.+?)\s*$/gm)]
    .map((match) => ({ year: Number(match[1]), name: normalizeText(match[2]!) }));
  if (allRows.length !== 48 || allRows[0]?.year !== 2026 || allRows.at(-1)?.year !== 1979 || new Set(allRows.map((row) => row.year)).size !== 48) {
    throw new Error(`FPF Supertaça: historial incompleto o duplicado (${allRows.length}/48 ediciones listadas)`);
  }
  const unofficial = allRows.filter((row) => /\(prova oficiosa\)$/i.test(row.name));
  if (unofficial.length !== 2 || unofficial[0]?.year !== 1980 || unofficial[1]?.year !== 1979) throw new Error('FPF Supertaça: no se identificaron correctamente las dos pruebas oficiosas');
  const rows = allRows.filter((row) => !/\(prova oficiosa\)$/i.test(row.name)).map((row) => ({ ...row, name: row.name.replace(/\s*\(prova oficiosa\)$/i, '') }));
  if (rows.length !== 46 || rows.some((row) => !clubIds[row.name])) throw new Error(`FPF Supertaça: campeón no reconocido (${rows.find((row) => !clubIds[row.name])?.name})`);
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  if (counts.size !== 5 || counts.get('FC Porto') !== 25 || counts.get('SL Benfica') !== 9 || counts.get('Sporting CP') !== 9 || counts.get('Boavista FC') !== 2 || counts.get('Vitória SC') !== 1) {
    throw new Error(`FPF Supertaça: recuento incoherente (${JSON.stringify(Object.fromEntries(counts))})`);
  }
  return rows;
}

export function buildSupertacaPortugalRanking(rows: TitleRow[]): RankingInput {
  const yearsByClub = new Map<string, number[]>();
  for (const row of rows) yearsByClub.set(row.name, [...(yearsByClub.get(row.name) ?? []), row.year]);
  const ordered = [...yearsByClub.entries()].sort((left, right) => right[1].length - left[1].length || right[1][0]! - left[1][0]! || left[0].localeCompare(right[0], 'pt'));
  return {
    categorySlug: 'supertaca-portugal-club-titles',
    source: { key: 'fpf-supertaca-portugal-palmares', name: 'Federação Portuguesa de Futebol official Supertaça honours', sourceType: 'official', baseUrl: supertacaPortugalTitlesUrl, rightsStatus: 'review_required' },
    dataVersion: 'supertaca-portugal-club-titles-2026',
    coverageComplete: true,
    reviewed: false,
    entries: ordered.map(([name, winnerYears], index) => ({
      entityId: clubIds[name]!, entityType: 'club' as const, name, rawValue: winnerYears.length,
      evidence: { sourceRank: index + 1, sourceUrl: supertacaPortugalTitlesUrl, winnerYears, excludedSeasons: [1979, 1980], scope: 'Palmarés oficial de la Supertaça Cândido de Oliveira desde 1981 hasta 2026; las pruebas de 1979 y 1980 se conservan como listadas por la FPF pero se excluyen por estar marcadas como prova oficiosa', closedUniverse: true }
    }))
  };
}

export async function fetchSupertacaPortugalClubTitles(): Promise<RankingInput> {
  return buildSupertacaPortugalRanking(parseSupertacaPortugalClubTitles(await fetchOfficialMarkdown()));
}

async function fetchOfficialMarkdown(): Promise<string> {
  const headers = { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' };
  try {
    const direct = await fetch(supertacaPortugalTitlesUrl, { headers, signal: AbortSignal.timeout(30_000) });
    if (direct.ok) {
      const body = await direct.text();
      if (body.includes('### Supertaça Cândido de Oliveira') && body.includes('2026 FC Porto')) return body;
    }
  } catch {
    // The FPF page can be protected by its WAF; the reader is only a transport fallback.
  }
  const fallback = await fetch(officialReaderUrl, { headers: { Accept: 'text/markdown', 'User-Agent': headers['User-Agent'] }, signal: AbortSignal.timeout(60_000) });
  if (!fallback.ok) throw new Error(`FPF Supertaça official page unavailable (${fallback.status})`);
  return fallback.text();
}
