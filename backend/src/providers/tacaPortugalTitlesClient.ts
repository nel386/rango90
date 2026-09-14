import type { RankingInput } from '../imports/rankingInput.js';

export const tacaPortugalPalmaresUrl = 'https://www.fpf.pt/pt/Competi%C3%A7%C3%B5es/Futebol-Masculino/Ta%C3%A7a-de-Portugal-Generali-Tranquilidade/Vencedores';

type TacaPortugalTitleRow = { season: string; name: string };

const displayNames = [
  'SCU Torreense', 'FC Porto', 'Sporting CP', 'SC Braga', 'CD Aves', 'SL Benfica',
  'Vitória SC', 'Académica', 'Vitória FC', 'Boavista FC', 'CF Estrela da Amadora',
  'CF Belenenses', 'SC Beira-Mar', 'Leixões SC', 'Carcavelinhos FC', 'CS Marítimo', 'SC Olhanense'
];

const stableClubIds: Record<string, string> = {
  'FC Porto': 'uefa:champions:club:a8a971f4d1a008ac1abb1bc5',
  'SL Benfica': 'uefa:champions:club:5093846cbcba23b1096c4f33'
};

function normalizeText(value: string): string {
  return value
    .replaceAll('\u00a0', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseTacaPortugalClubTitles(markdown: string): TacaPortugalTitleRow[] {
  const start = markdown.indexOf('### **Taça de Portugal**');
  const end = markdown.indexOf('###### Os Nossos Parceiros', start);
  if (start < 0 || end <= start) throw new Error('FPF Taça de Portugal: no se encontró el bloque oficial de vencedores');
  const rows: TacaPortugalTitleRow[] = [];
  for (const rawLine of markdown.slice(start, end).split(/\r?\n/)) {
    const line = normalizeText(rawLine);
    const match = /^(\d{4}\/\d{4})\s+(.+)$/.exec(line);
    if (!match) continue;
    const season = match[1]!;
    const name = normalizeText(match[2]!);
    if (!displayNames.includes(name)) {
      if (/^-+$/.test(name)) continue;
      throw new Error(`FPF Taça de Portugal: vencedor no reconocido: ${name}`);
    }
    rows.push({ season, name });
  }
  if (rows.length !== 103 || new Set(rows.map((row) => row.season)).size !== rows.length) {
    throw new Error(`FPF Taça de Portugal: historial incompleto o duplicado (${rows.length}/103 ediciones)`);
  }
  const counts = new Set(rows.map((row) => row.name));
  if (counts.size !== displayNames.length) throw new Error(`FPF Taça de Portugal: universo de clubes inesperado (${counts.size}/${displayNames.length})`);
  return rows;
}

async function fetchOfficialMarkdown(): Promise<{ markdown: string; retrievedVia: 'fpf' | 'reader-fallback' }> {
  const headers = { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Rango90-data-import/0.1 (football data research)' };
  try {
    const response = await fetch(tacaPortugalPalmaresUrl, { headers, signal: AbortSignal.timeout(30_000) });
    if (response.ok) return { markdown: await response.text(), retrievedVia: 'fpf' };
  } catch {
    // The direct FPF page may be protected by its WAF; use the reader only as transport.
  }
  const fallbackUrl = `https://r.jina.ai/${tacaPortugalPalmaresUrl}`;
  const fallback = await fetch(fallbackUrl, { headers: { Accept: 'text/markdown', 'User-Agent': headers['User-Agent'] }, signal: AbortSignal.timeout(60_000) });
  if (!fallback.ok) throw new Error(`FPF Taça de Portugal official page ${fallback.status}; reader fallback ${fallback.status}`);
  return { markdown: await fallback.text(), retrievedVia: 'reader-fallback' };
}

export async function fetchTacaPortugalClubTitles(): Promise<RankingInput> {
  const fetched = await fetchOfficialMarkdown();
  const rows = parseTacaPortugalClubTitles(fetched.markdown);
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt'));
  return {
    categorySlug: 'taca-portugal-club-titles',
    source: {
      key: 'fpf-taca-portugal-palmares',
      name: 'Federação Portuguesa de Futebol official Taça de Portugal honours',
      sourceType: 'official',
      baseUrl: tacaPortugalPalmaresUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `fpf-taca-portugal-club-titles-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: ordered.map(([name, titles], index) => ({
      entityId: stableClubIds[name] ?? `fpf:taca-portugal:club:${slugify(name)}`,
      entityType: 'club' as const,
      name,
      rawValue: titles,
      evidence: {
        sourceRank: index + 1,
        sourceUrl: tacaPortugalPalmaresUrl,
        retrievalTransport: fetched.retrievedVia,
        externalId: `fpf:taca-portugal:club:${slugify(name)}`,
        scope: 'Títulos de la Taça de Portugal y del Campeonato de Portugal según el palmarés oficial de la FPF; 103 ediciones con vencedor desde 1921/22 hasta 2025/26; universo cerrado de clubes campeones',
        closedUniverse: true
      }
    }))
  };
}
