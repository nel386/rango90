import type { RankingInput } from '../imports/rankingInput.js';

export const primeiraLigaTitlesUrl = 'https://www.fpf.pt/pt/competicoes/futebol/masculino/liga-nos/vencedores';
const officialReaderUrl = `https://r.jina.ai/${primeiraLigaTitlesUrl}`;

type TitleRow = { season: string; year: number; name: string };

const clubIds: Record<string, string> = {
  'FC Porto': 'uefa:champions:club:a8a971f4d1a008ac1abb1bc5',
  'SL Benfica': 'uefa:champions:club:5093846cbcba23b1096c4f33',
  'Sporting CP': 'fpf:taca-portugal:club:sporting-cp',
  'Boavista FC': 'fpf:taca-portugal:club:boavista-fc',
  'CF Belenenses': 'fpf:taca-portugal:club:cf-belenenses'
};

function normalizeText(value: string): string {
  return value.replaceAll('\u00a0', ' ').replace(/\s+/g, ' ').trim();
}

export function parsePrimeiraLigaClubTitles(markdown: string): TitleRow[] {
  const start = markdown.indexOf('### I Divisão/ I Liga');
  const end = markdown.indexOf('[](https://www.fpf.pt/', start);
  if (start < 0 || end <= start) throw new Error('FPF Primeira Liga: no se encontró el bloque oficial de vencedores');
  const rows = [...markdown.slice(start, end).matchAll(/^\s*(\d{4}\/\d{4})\s+(.+?)\s*$/gm)]
    .map((match) => ({ season: match[1]!, year: Number(match[1]!.slice(0, 4)), name: normalizeText(match[2]!) }))
    .filter((row) => row.name.length > 0 && !row.name.startsWith('#'));
  if (rows.length !== 92) throw new Error(`FPF Primeira Liga: se esperaban 92 temporadas y llegaron ${rows.length}`);
  const seasons = rows.map((row) => row.season);
  if (new Set(seasons).size !== seasons.length || seasons[0] !== '2025/2026' || seasons.at(-1) !== '1934/1935') throw new Error('FPF Primeira Liga: temporadas duplicadas o límites históricos incorrectos');
  if (rows.some((row) => !clubIds[row.name])) throw new Error(`FPF Primeira Liga: campeón no reconocido (${rows.find((row) => !clubIds[row.name])?.name})`);
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  if (counts.size !== 5 || counts.get('SL Benfica') !== 38 || counts.get('FC Porto') !== 31 || counts.get('Sporting CP') !== 21 || counts.get('Boavista FC') !== 1 || counts.get('CF Belenenses') !== 1) {
    throw new Error(`FPF Primeira Liga: recuento de campeones incoherente (${JSON.stringify(Object.fromEntries(counts))})`);
  }
  return rows;
}

export function buildPrimeiraLigaRanking(rows: TitleRow[]): RankingInput {
  const counts = new Map<string, number[]>();
  for (const row of rows) counts.set(row.name, [...(counts.get(row.name) ?? []), row.year]);
  const ordered = [...counts.entries()].sort((left, right) => right[1].length - left[1].length || right[1][0]! - left[1][0]! || left[0].localeCompare(right[0], 'pt'));
  return {
    categorySlug: 'primeira-liga-club-titles',
    source: { key: 'fpf-primeira-liga-palmares', name: 'Federação Portuguesa de Futebol official Primeira Liga honours', sourceType: 'official', baseUrl: primeiraLigaTitlesUrl, rightsStatus: 'review_required' },
    dataVersion: 'primeira-liga-club-titles-2026',
    coverageComplete: true,
    reviewed: false,
    entries: ordered.map(([name, winnerYears], index) => ({
      entityId: clubIds[name]!,
      entityType: 'club' as const,
      name,
      rawValue: winnerYears.length,
      evidence: {
        sourceRank: index + 1,
        sourceUrl: primeiraLigaTitlesUrl,
        winnerYears,
        scope: 'Palmarés oficial de la máxima categoría portuguesa desde 1934/35 hasta 2025/26; se incluyen las denominaciones Campeonato da Liga I Divisão e I Divisão/I Liga tal como las agrupa la FPF',
        closedUniverse: true
      }
    }))
  };
}

export async function fetchPrimeiraLigaClubTitles(): Promise<RankingInput> {
  const markdown = await fetchOfficialMarkdown();
  return buildPrimeiraLigaRanking(parsePrimeiraLigaClubTitles(markdown));
}

async function fetchOfficialMarkdown(): Promise<string> {
  const headers = { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' };
  try {
    const direct = await fetch(primeiraLigaTitlesUrl, { headers, signal: AbortSignal.timeout(30_000) });
    if (direct.ok) {
      const body = await direct.text();
      if (body.includes('### I Divisão/ I Liga') && body.includes('2025/2026')) return body;
    }
  } catch {
    // The FPF page can be protected by its WAF; the reader is only a transport fallback.
  }
  const fallback = await fetch(officialReaderUrl, { headers: { Accept: 'text/markdown', 'User-Agent': headers['User-Agent'] }, signal: AbortSignal.timeout(60_000) });
  if (!fallback.ok) throw new Error(`FPF Primeira Liga official page unavailable (${fallback.status})`);
  return fallback.text();
}
